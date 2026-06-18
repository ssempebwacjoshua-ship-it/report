import request from "supertest";
import { describe, expect, it } from "vitest";
import { createServer } from "../../server";

describe("parentRoutes - GET /api/p/:token", () => {
  it("returns 404 JSON for non-existent token", async () => {
    const fakeToken = "a".repeat(64);
    const res = await request(createServer()).get(`/api/p/${fakeToken}`);
    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({
      code: "REPORT_LINK_NOT_FOUND",
      message: "Report link not found or expired",
    });
  });

  it("returns 404 JSON for obviously invalid token", async () => {
    const res = await request(createServer()).get("/api/p/invalid-token");
    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({
      code: "REPORT_LINK_NOT_FOUND",
      message: "Report link not found or expired",
    });
  });
});

describe("parentRoutes - POST /api/p/:token/downloaded", () => {
  it("returns 404 JSON for non-existent token", async () => {
    const fakeToken = "b".repeat(64);
    const res = await request(createServer()).post(`/api/p/${fakeToken}/downloaded`);
    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({
      code: "REPORT_LINK_NOT_FOUND",
      message: "Report link not found or expired",
    });
  });
});

describe("verifyRoutes - GET /api/verify/:code", () => {
  it("returns 404 with found:false for unknown code", async () => {
    const res = await request(createServer()).get("/api/verify/NONEXISTENT-CODE");
    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ found: false });
  });

  it("normalises code to uppercase", async () => {
    const res = await request(createServer()).get("/api/verify/nonexistent-code");
    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ found: false });
  });
});

