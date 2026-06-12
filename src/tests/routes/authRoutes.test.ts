import request from "supertest";
import { describe, expect, it } from "vitest";
import { createServer } from "../../server";

describe("authRoutes /api/auth/login", () => {
  it("returns JSON success for seeded admin credentials", async () => {
    const res = await request(createServer())
      .post("/api/auth/login")
      .send({ email: "admin@schoolconnect.test", password: "password123", schoolCode: "SCU-PREVIEW" });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("token");
    expect(res.body).toHaveProperty("user");
    expect(res.body.user).toMatchObject({
      email: "admin@schoolconnect.test",
      role: "ADMIN_OPERATOR",
    });
  });

  it("returns 401 for unknown email", async () => {
    const res = await request(createServer())
      .post("/api/auth/login")
      .send({ email: "nobody@unknown.test", password: "password123", schoolCode: "SCU-PREVIEW" });
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty("error");
  });

  it("returns 400 for invalid email format", async () => {
    const res = await request(createServer())
      .post("/api/auth/login")
      .send({ email: "not-an-email", password: "password123" });
    expect(res.status).toBe(400);
  });

  it("returns 400 when password is missing", async () => {
    const res = await request(createServer())
      .post("/api/auth/login")
      .send({ email: "admin@schoolconnect.test", password: "" });
    expect(res.status).toBe(400);
  });

  it("returns 401 for non-existent school code", async () => {
    const res = await request(createServer())
      .post("/api/auth/login")
      .send({ email: "admin@test.com", password: "password123", schoolCode: "NO-SUCH-SCHOOL" });
    expect(res.status).toBe(401);
  });
});

describe("authRoutes /api/auth/me", () => {
  it("returns 401 without Authorization header", async () => {
    const res = await request(createServer()).get("/api/auth/me");
    expect(res.status).toBe(401);
  });

  it("returns 401 with malformed token", async () => {
    const res = await request(createServer())
      .get("/api/auth/me")
      .set("Authorization", "Bearer not.a.valid.jwt");
    expect(res.status).toBe(401);
  });

  it("returns 401 with Bearer prefix but empty token", async () => {
    const res = await request(createServer())
      .get("/api/auth/me")
      .set("Authorization", "Bearer ");
    expect(res.status).toBe(401);
  });
});

describe("authRoutes /api/auth/logout", () => {
  it("always returns 200", async () => {
    const res = await request(createServer()).post("/api/auth/logout");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });
});
