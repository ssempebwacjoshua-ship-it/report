import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createServer } from "../../server";

describe("healthRoutes", () => {
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
