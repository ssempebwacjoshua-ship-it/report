import request from "supertest";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { signToken } from "../../server/services/authService";

// ── Module-level mocks (hoisted) ──────────────────────────────────────────────

const { auditLogCreate, schoolFindUnique, appSettingFindUnique } = vi.hoisted(() => ({
  auditLogCreate: vi.fn(async () => ({})),
  schoolFindUnique: vi.fn(async () => ({
    id: "sch-rc",
    code: "RCSCH",
    name: "RC School",
    subjects: [],
    academicYears: [],
  })),
  appSettingFindUnique: vi.fn(async () => null),
}));

vi.mock("../../server/db/prisma", () => ({
  prisma: {
    school: { findUnique: schoolFindUnique },
    appSetting: { findUnique: appSettingFindUnique },
    auditLog: { create: auditLogCreate },
    // HIGH 1 context service mocks (prevents real DB calls in generate route)
    subject: { findMany: vi.fn(async () => []) },
    academicYear: { findMany: vi.fn(async () => []) },
    schoolClass: { findFirst: vi.fn(async () => null) },
    stream: { findFirst: vi.fn(async () => null) },
    classEnrollment: { findMany: vi.fn(async () => []) },
    subjectMark: { findMany: vi.fn(async () => []) },
  },
}));

// ── Shared test setup ─────────────────────────────────────────────────────────

describe("HIGH 3 ? report comment routes", () => {
  let app: ReturnType<typeof import("../../server").createServer>;
  let authToken: string;

  beforeAll(async () => {
    const { createServer } = await import("../../server");
    app = createServer();
    authToken = signToken({
      userId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
      schoolId: "sch-rc",
      name: "Test Admin",
      email: "admin@rcsch.test",
      role: "ADMIN_OPERATOR",
    });
  });

  beforeEach(() => {
    vi.clearAllMocks();
    schoolFindUnique.mockResolvedValue({ id: "sch-rc", code: "RCSCH", name: "RC School", subjects: [], academicYears: [] });
    auditLogCreate.mockResolvedValue({});
  });

  // ── Accept: audit trail ───────────────────────────────────────────────────

  describe("POST /api/reports/assistant-comment/accept", () => {
    it("writes ai.suggestion.accepted audit row", async () => {
      const res = await request(app)
        .post("/api/reports/assistant-comment/accept")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          studentId: "stu-rc-1",
          comment: "Ann demonstrated consistent effort throughout this term.",
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(auditLogCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            schoolId: "sch-rc",
            action: "ai.suggestion.accepted",
            correlationId: "stu-rc-1",
            details: expect.objectContaining({
              studentId: "stu-rc-1",
              comment: "Ann demonstrated consistent effort throughout this term.",
            }),
          }),
        }),
      );
    }, 15000);

    it("returns 400 when comment exceeds 500 characters (server-side limit enforced)", async () => {
      const res = await request(app)
        .post("/api/reports/assistant-comment/accept")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          studentId: "stu-rc-1",
          comment: "A".repeat(501),
        });

      expect(res.status).toBe(400);
      expect(auditLogCreate).not.toHaveBeenCalled();
    }, 15000);

    it("returns 400 when studentId is missing", async () => {
      const res = await request(app)
        .post("/api/reports/assistant-comment/accept")
        .set("Authorization", `Bearer ${authToken}`)
        .send({ comment: "Good student." });

      expect(res.status).toBe(400);
      expect(auditLogCreate).not.toHaveBeenCalled();
    }, 15000);
  });

  // ── Reject: audit trail ───────────────────────────────────────────────────

  describe("POST /api/reports/assistant-comment/reject", () => {
    it("writes ai.suggestion.rejected audit row", async () => {
      const res = await request(app)
        .post("/api/reports/assistant-comment/reject")
        .set("Authorization", `Bearer ${authToken}`)
        .send({ studentId: "stu-rc-2", reason: "Comment did not match student's profile." });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(auditLogCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            schoolId: "sch-rc",
            action: "ai.suggestion.rejected",
            correlationId: "stu-rc-2",
            details: expect.objectContaining({
              studentId: "stu-rc-2",
              reason: "Comment did not match student's profile.",
            }),
          }),
        }),
      );
    }, 15000);

    it("writes ai.suggestion.rejected without reason (reason is optional)", async () => {
      const res = await request(app)
        .post("/api/reports/assistant-comment/reject")
        .set("Authorization", `Bearer ${authToken}`)
        .send({ studentId: "stu-rc-3" });

      expect(res.status).toBe(200);
      expect(auditLogCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: "ai.suggestion.rejected",
            details: expect.objectContaining({ reason: null }),
          }),
        }),
      );
    }, 15000);

    it("returns 400 when studentId is missing", async () => {
      const res = await request(app)
        .post("/api/reports/assistant-comment/reject")
        .set("Authorization", `Bearer ${authToken}`)
        .send({ reason: "bad" });

      expect(res.status).toBe(400);
      expect(auditLogCreate).not.toHaveBeenCalled();
    }, 15000);
  });

  // ── Generate: honest context handling ────────────────────────────────────

  describe("POST /api/reports/assistant-comment/generate ? honest about missing data", () => {
    it("returns 422 when there is no active term (UI explains missing data honestly)", async () => {
      // The prisma mock has no academicYears, so buildReportAssistantContext returns NO_ACTIVE_TERM
      const res = await request(app)
        .post("/api/reports/assistant-comment/generate")
        .set("Authorization", `Bearer ${authToken}`)
        .send({ classId: "cls-missing" });

      // 422 or 404 ? not a 200 with invented content
      expect([404, 422]).toContain(res.status);
      expect(auditLogCreate).not.toHaveBeenCalled();
    }, 15000);
  });
});

