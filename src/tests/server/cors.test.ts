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
    vi.stubEnv("CLIENT_ORIGIN", "https://report-sigma-one.vercel.app");
    const res = await request(createServer())
      .get("/api/health")
      .set("Origin", "https://report-sigma-one.vercel.app");
    expect(res.headers["access-control-allow-origin"]).toBe("https://report-sigma-one.vercel.app");
  });

  it("allows localhost when CLIENT_ORIGIN is set", async () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("CLIENT_ORIGIN", "https://report-sigma-one.vercel.app");
    const res = await request(createServer())
      .get("/api/health")
      .set("Origin", "http://localhost:5173");
    expect(res.headers["access-control-allow-origin"]).toBe("http://localhost:5173");
  });

  it("rejects unknown origins when CLIENT_ORIGIN is configured", async () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("CLIENT_ORIGIN", "https://report-sigma-one.vercel.app");
    const res = await request(createServer())
      .get("/api/health")
      .set("Origin", "https://evil.example.com");
    expect(res.headers["access-control-allow-origin"]).toBeUndefined();
  });

  it("allows any origin when CLIENT_ORIGIN is not configured (local dev)", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("CLIENT_ORIGIN", ""); // explicit empty = not configured
    const res = await request(createServer())
      .get("/api/health")
      .set("Origin", "https://any-origin.example.com");
    expect(res.headers["access-control-allow-origin"]).toBe("https://any-origin.example.com");
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

