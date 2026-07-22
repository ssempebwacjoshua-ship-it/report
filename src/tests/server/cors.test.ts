import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createServer } from "../../server";

// Gemini services are not used by these tests but are imported transitively.
vi.mock("../../server/services/geminiOcrService", () => ({
  extractMarksWithGemini: vi.fn(),
}));
vi.mock("../../server/services/geminiRosterService", () => ({
  parseRosterImagePerfect: vi.fn(),
}));

describe("CORS origin control", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("allows the configured CLIENT_ORIGIN", async () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("CLIENT_ORIGIN", "https://ssamenj.online");
    const res = await request(createServer())
      .get("/api/health")
      .set("Origin", "https://ssamenj.online");
    expect(res.headers["access-control-allow-origin"]).toBe("https://ssamenj.online");
  });

  it("allows the www origin during transition", async () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("CLIENT_ORIGIN", "https://ssamenj.online");
    const res = await request(createServer())
      .get("/api/health")
      .set("Origin", "https://www.ssamenj.online");
    expect(res.headers["access-control-allow-origin"]).toBe("https://www.ssamenj.online");
  });

  it("rejects unknown origins when CLIENT_ORIGIN is configured", async () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("CLIENT_ORIGIN", "https://ssamenj.online");
    const res = await request(createServer())
      .get("/api/health")
      .set("Origin", "https://evil.example.com");
    expect(res.headers["access-control-allow-origin"]).toBeUndefined();
  });

  it("succeeds for OPTIONS preflight on auth login", async () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("CLIENT_ORIGIN", "https://schools.ssamenj.online");
    vi.stubEnv("ALLOWED_ORIGINS", "https://schools.ssamenj.online,https://report-sigma-one.vercel.app,https://ssamenj.online,https://www.ssamenj.online");
    const res = await request(createServer())
      .options("/api/auth/login")
      .set("Origin", "https://schools.ssamenj.online")
      .set("Access-Control-Request-Method", "POST")
      .set("Access-Control-Request-Headers", "content-type,authorization");

    expect(res.status).toBe(204);
    expect(res.headers["access-control-allow-origin"]).toBe("https://schools.ssamenj.online");
    expect(res.headers["access-control-allow-credentials"]).toBe("true");
  });

  it("allows OPTIONS preflight on /api/settings from the schools domain", async () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("CLIENT_ORIGIN", "https://schools.ssamenj.online");
    vi.stubEnv("ALLOWED_ORIGINS", "https://schools.ssamenj.online,https://report-sigma-one.vercel.app,https://ssamenj.online,https://www.ssamenj.online");
    const res = await request(createServer())
      .options("/api/settings")
      .set("Origin", "https://schools.ssamenj.online")
      .set("Access-Control-Request-Method", "GET")
      .set("Access-Control-Request-Headers", "authorization,content-type");

    expect(res.status).toBe(204);
    expect(res.headers["access-control-allow-origin"]).toBe("https://schools.ssamenj.online");
    expect(res.headers["access-control-allow-credentials"]).toBe("true");
  });

  it("returns CORS headers on GET /api/health/ping from the schools domain", async () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("CLIENT_ORIGIN", "https://schools.ssamenj.online");
    vi.stubEnv("ALLOWED_ORIGINS", "https://schools.ssamenj.online,https://report-sigma-one.vercel.app,https://ssamenj.online,https://www.ssamenj.online");
    const res = await request(createServer())
      .get("/api/health/ping")
      .set("Origin", "https://schools.ssamenj.online");

    expect(res.status).toBe(200);
    expect(res.headers["access-control-allow-origin"]).toBe("https://schools.ssamenj.online");
    expect(res.headers["cache-control"]).toContain("no-store");
  });

  it("allows reader credential capture preflight with cache-control from ssamenj.online", async () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("CLIENT_ORIGIN", "https://ssamenj.online");
    const res = await request(createServer())
      .options("/api/nfc/tags/reader-credential-captures/capture-1")
      .set("Origin", "https://ssamenj.online")
      .set("Access-Control-Request-Method", "GET")
      .set("Access-Control-Request-Headers", "authorization,cache-control,pragma");

    expect(res.status).toBe(204);
    expect(res.headers["access-control-allow-origin"]).toBe("https://ssamenj.online");
    expect(res.headers["access-control-allow-credentials"]).toBe("true");
    expect(res.headers["access-control-allow-headers"]).toContain("Cache-Control");
    expect(res.headers["access-control-allow-headers"]).toContain("Pragma");
    expect(res.headers["access-control-allow-headers"]).toContain("Authorization");
  });

  it("allows localhost when CLIENT_ORIGIN is not configured (local dev)", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("CLIENT_ORIGIN", ""); // explicit empty = not configured
    const res = await request(createServer())
      .get("/api/health")
      .set("Origin", "http://localhost:5173");
    expect(res.headers["access-control-allow-origin"]).toBe("http://localhost:5173");
  });

  it("rejects browser origins in production when CLIENT_ORIGIN is not configured", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("CLIENT_ORIGIN", "");
    const res = await request(createServer())
      .get("/api/health")
      .set("Origin", "https://any-origin.example.com");
    expect(res.headers["access-control-allow-origin"]).toBeUndefined();
  });
});

describe("security headers", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("sets baseline browser hardening headers without blocking same-origin previews", async () => {
    const res = await request(createServer()).get("/api/health");

    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["x-frame-options"]).toBe("SAMEORIGIN");
    expect(res.headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(res.headers["permissions-policy"]).toBe("camera=(), microphone=(), geolocation=()");
  });
});

