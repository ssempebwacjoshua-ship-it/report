import request from "supertest";
import { describe, expect, it } from "vitest";
import { createServer } from "../../server";

describe("reportIssueRoutes — POST /api/reports/issue", () => {
  it("returns 401 without Authorization header", async () => {
    const res = await request(createServer())
      .post("/api/reports/issue")
      .send({
        schoolCode: "SCU-PREVIEW",
        studentId: "00000000-0000-0000-0000-000000000001",
        classId: "00000000-0000-0000-0000-000000000002",
      });
    expect(res.status).toBe(401);
  });

  it("returns 401 with invalid Bearer token", async () => {
    const res = await request(createServer())
      .post("/api/reports/issue")
      .set("Authorization", "Bearer invalid.jwt.token")
      .send({
        schoolCode: "SCU-PREVIEW",
        studentId: "00000000-0000-0000-0000-000000000001",
        classId: "00000000-0000-0000-0000-000000000002",
      });
    expect(res.status).toBe(401);
  });

  it("returns 400 when studentId is not a valid UUID", async () => {
    // Need a valid-looking token — use signToken directly
    const { signToken } = await import("../../server/services/authService");
    const token = signToken({
      userId: "00000000-0000-0000-0000-000000000001",
      schoolId: "00000000-0000-0000-0000-000000000002",
      name: "Test Admin",
      email: "test@test.com",
      role: "ADMIN_OPERATOR",
    });

    const res = await request(createServer())
      .post("/api/reports/issue")
      .set("Authorization", `Bearer ${token}`)
      .send({ schoolCode: "SCU-PREVIEW", studentId: "not-a-uuid", classId: "some-class" });
    expect(res.status).toBe(400);
  });
});

describe("reportIssueRoutes — GET /api/reports/issued", () => {
  it("returns 401 without auth", async () => {
    const res = await request(createServer()).get("/api/reports/issued");
    expect(res.status).toBe(401);
  });
});

describe("reportIssueRoutes — PATCH /api/reports/issued/:id/revoke", () => {
  it("returns 401 without auth", async () => {
    const res = await request(createServer()).patch(
      "/api/reports/issued/00000000-0000-0000-0000-000000000001/revoke",
    );
    expect(res.status).toBe(401);
  });
});
