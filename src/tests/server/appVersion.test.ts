import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createServer } from "../../server/index";

describe("app version endpoint", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns an uncached build version response", async () => {
    const res = await request(createServer()).get("/api/app-version");

    expect(res.status).toBe(200);
    expect(res.body.version).toBeTruthy();
    expect(res.headers["cache-control"]).toContain("no-store");
    expect(res.headers.pragma).toBe("no-cache");
  });

  it("allows unauthenticated production-like app version requests without school context", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("RAILWAY_ENVIRONMENT", "production");
    vi.stubEnv("RAILWAY_GIT_COMMIT_SHA", "public-build-sha");
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    const res = await request(createServer()).get("/api/app-version");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ version: expect.any(String), buildTime: null });
    expect(res.body).not.toHaveProperty("env");
    expect(res.body).not.toHaveProperty("school");
    expect(warnSpy).not.toHaveBeenCalledWith(
      "[resolveSchoolContext] unauthenticated request denied",
      expect.anything(),
    );
    warnSpy.mockRestore();
  });
});
