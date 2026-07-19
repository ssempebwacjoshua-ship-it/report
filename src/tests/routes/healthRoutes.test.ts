import request from "supertest";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { createServer } from "../../server";

describe("healthRoutes ? /health (public)", () => {
  it("returns JSON ok status", async () => {
    const res = await request(createServer()).get("/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, service: "school-connect-reports-lab" });
  });

  it("respects CORS origin config", async () => {
    vi.stubEnv("CLIENT_ORIGIN", "https://example.com");
    const res = await request(createServer()).get("/health").set("Origin", "https://example.com");
    expect(res.headers["access-control-allow-origin"]).toBe("https://example.com");
  });
});

// ── HIGH 4: public health endpoint must not leak secrets ─────────────────────

describe("healthRoutes ? /api/health does not leak secrets", () => {
  it("returns only ok and service fields ? no env values", async () => {
    const res = await request(createServer()).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(Object.keys(res.body)).toEqual(["ok", "service"]);
    const body = JSON.stringify(res.body);
    expect(body).not.toMatch(/JWT_SECRET|DATABASE_URL|GEMINI_API_KEY|PLATFORM_ADMIN_KEY/);
  });
});

describe("healthRoutes ? /api/health/runtime", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns non-secret runtime diagnostics", async () => {
    vi.stubEnv("CLIENT_ORIGIN", "https://schools.ssamenj.online");
    vi.stubEnv("ALLOWED_ORIGINS", "https://schools.ssamenj.online,https://report-sigma-one.vercel.app,https://ssamenj.online,https://www.ssamenj.online");
    const res = await request(createServer()).get("/api/health/runtime");

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(Array.isArray(res.body.allowedOrigins)).toBe(true);
    expect(res.body.allowedOrigins).toContain("https://schools.ssamenj.online");
    expect(res.body.appVersion).toBeTruthy();
    expect(res.headers["cache-control"]).toContain("no-store");
  });
});

// ── HIGH 4: /api/health/env is internal-only ─────────────────────────────────

describe("healthRoutes ? /api/health/env (internal key required)", () => {
  const TEST_KEY = "test-internal-key-health-h4";
  let app: ReturnType<typeof createServer>;
  const savedKey = process.env.INTERNAL_TEST_KEY;

  beforeAll(() => {
    process.env.INTERNAL_TEST_KEY = TEST_KEY;
    app = createServer();
  });

  afterEach(() => {
    process.env.INTERNAL_TEST_KEY = TEST_KEY;
  });

  it("returns 403 without x-internal-test-key", async () => {
    const res = await request(app).get("/api/health/env");
    expect(res.status).toBe(403);
  });

  it("returns 403 with the wrong key", async () => {
    const res = await request(app)
      .get("/api/health/env")
      .set("x-internal-test-key", "wrong-key");
    expect(res.status).toBe(403);
  });

  it("returns 403 when INTERNAL_TEST_KEY is not configured on the server", async () => {
    delete process.env.INTERNAL_TEST_KEY;
    const appNoKey = createServer();
    const res = await request(appNoKey)
      .get("/api/health/env")
      .set("x-internal-test-key", TEST_KEY);
    expect(res.status).toBe(403);
    process.env.INTERNAL_TEST_KEY = savedKey;
  });

  it("returns SET/MISSING statuses ? never the actual secret values", async () => {
    process.env.JWT_SECRET = "a-strong-secret-value-32-characters-long";
    const res = await request(app)
      .get("/api/health/env")
      .set("x-internal-test-key", TEST_KEY);

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);

    const env = res.body.env as Record<string, string>;
    for (const value of Object.values(env)) {
      expect(["SET", "MISSING"]).toContain(value);
    }
    expect(JSON.stringify(res.body)).not.toContain("a-strong-secret-value");
  });
});

