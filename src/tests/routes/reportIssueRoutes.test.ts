import request from "supertest";
import { describe, expect, it, beforeAll } from "vitest";
import { createServer } from "../../server";
import { COMMENT_LIMITS } from "../../shared/utils/reportComments";

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
    const { prisma } = await import("../../server/db/prisma");
    const school = await prisma.school.findUnique({ where: { code: "SCU-PREVIEW" } });
    const token = signToken({
      userId: "00000000-0000-0000-0000-000000000001",
      schoolId: school?.id ?? "00000000-0000-0000-0000-000000000002",
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

describe("reportIssueRoutes — comment character limits", () => {
  let authToken: string;

  beforeAll(async () => {
    const { signToken } = await import("../../server/services/authService");
    const { prisma } = await import("../../server/db/prisma");
    const school = await prisma.school.findUnique({ where: { code: "SCU-PREVIEW" } });
    authToken = signToken({
      userId: "00000000-0000-0000-0000-000000000001",
      schoolId: school?.id ?? "00000000-0000-0000-0000-000000000002",
      name: "Test Admin",
      email: "test@test.com",
      role: "ADMIN_OPERATOR",
    });
  });

  const VALID_UUID = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";

  it("rejects classTeacherComment exceeding 500 characters", async () => {
    const res = await request(createServer())
      .post("/api/reports/issue")
      .set("Authorization", `Bearer ${authToken}`)
      .send({
        studentId: VALID_UUID,
        classId: VALID_UUID,
        reportComments: { classTeacherComment: "A".repeat(COMMENT_LIMITS.classTeacherComment + 1) },
      });
    expect(res.status).toBe(400);
  });

  it("rejects headTeacherComment exceeding 500 characters", async () => {
    const res = await request(createServer())
      .post("/api/reports/issue")
      .set("Authorization", `Bearer ${authToken}`)
      .send({
        studentId: VALID_UUID,
        classId: VALID_UUID,
        reportComments: { headTeacherComment: "B".repeat(COMMENT_LIMITS.headTeacherComment + 1) },
      });
    expect(res.status).toBe(400);
  });

  it("rejects conductNote exceeding 300 characters", async () => {
    const res = await request(createServer())
      .post("/api/reports/issue")
      .set("Authorization", `Bearer ${authToken}`)
      .send({
        studentId: VALID_UUID,
        classId: VALID_UUID,
        reportComments: { conductNote: "C".repeat(COMMENT_LIMITS.conductNote + 1) },
      });
    expect(res.status).toBe(400);
  });

  it("rejects classTeacherName exceeding 100 characters", async () => {
    const res = await request(createServer())
      .post("/api/reports/issue")
      .set("Authorization", `Bearer ${authToken}`)
      .send({
        studentId: VALID_UUID,
        classId: VALID_UUID,
        reportComments: { classTeacherName: "D".repeat(COMMENT_LIMITS.classTeacherName + 1) },
      });
    expect(res.status).toBe(400);
  });

  it("accepts reportComments well within the character limits", async () => {
    const res = await request(createServer())
      .post("/api/reports/issue")
      .set("Authorization", `Bearer ${authToken}`)
      .send({
        studentId: VALID_UUID,
        classId: VALID_UUID,
        reportComments: {
          classTeacherComment: "Well done this term.",
          headTeacherComment: "Keep it up.",
          conductNote: "Good conduct.",
          classTeacherName: "Mrs Smith",
        },
      });
    // 404 = student not found in DB (comment limits did not reject); NOT 400
    expect(res.status).not.toBe(400);
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
