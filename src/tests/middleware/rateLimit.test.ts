import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { createRateLimiter, rateLimitWhen } from "../../server/middleware/rateLimiters";

describe("rate limiting middleware", () => {
  it("returns the safe API envelope after the configured limit", async () => {
    const app = express();
    app.use(rateLimitWhen(
      (req) => req.path === "/api/auth/login",
      createRateLimiter({ name: "test-auth", windowMs: 60_000, max: 2 }),
    ));
    app.post("/api/auth/login", (_req, res) => res.json({ ok: true }));

    await request(app).post("/api/auth/login").expect(200);
    await request(app).post("/api/auth/login").expect(200);
    const res = await request(app)
      .post("/api/auth/login")
      .set("x-request-id", "rate-limit-test")
      .expect(429);

    expect(res.headers["retry-after"]).toBeDefined();
    expect(res.body).toMatchObject({
      ok: false,
      error: true,
      code: "RATE_LIMITED",
      message: "Too many requests. Please wait a moment and try again.",
      requestId: "rate-limit-test",
      details: [],
    });
  });

  it("does not count requests that do not match the predicate", async () => {
    const app = express();
    app.use(rateLimitWhen(
      (req) => req.path === "/api/auth/login",
      createRateLimiter({ name: "test-auth-bypass", windowMs: 60_000, max: 1 }),
    ));
    app.get("/api/health", (_req, res) => res.json({ ok: true }));
    app.post("/api/auth/login", (_req, res) => res.json({ ok: true }));

    await request(app).get("/api/health").expect(200);
    await request(app).get("/api/health").expect(200);
    await request(app).post("/api/auth/login").expect(200);
    await request(app).post("/api/auth/login").expect(429);
  });
});
