import request from "supertest";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { signToken } from "../../server/services/authService";

// ── Module-level mocks (hoisted) ──────────────────────────────────────────────

const {
  auditLogCreate,
  schoolFindUnique,
  appSettingFindUnique,
  schoolClassFindFirst,
  streamFindFirst,
  classEnrollmentFindMany,
  subjectMarkFindMany,
  studentFindFirst,
  generateStudentCommentDraftMock,
} = vi.hoisted(() => ({
  auditLogCreate: vi.fn(async () => ({})),
  schoolFindUnique: vi.fn(async () => ({
    id: "sch-rc",
    code: "RCSCH",
    name: "RC School",
    subjects: [],
    academicYears: [],
  })),
  appSettingFindUnique: vi.fn(async () => null),
  schoolClassFindFirst: vi.fn(async () => ({ id: "cls-1", name: "Senior 1", schoolId: "sch-rc" })),
  streamFindFirst: vi.fn(async () => ({ id: "str-1", name: "A", schoolId: "sch-rc", classId: "cls-1" })),
  classEnrollmentFindMany: vi.fn(async () => []),
  subjectMarkFindMany: vi.fn(async () => []),
  studentFindFirst: vi.fn(async () => ({ id: "stu-rc-1" })),
  generateStudentCommentDraftMock: vi.fn(async (student: { studentId: string }) => ({
    status: "DRAFT",
    studentId: student.studentId,
    comment: "Steady progress this term.",
  })),
}));

vi.mock("../../server/services/reportCommentService", async () => {
  const actual = await vi.importActual<typeof import("../../server/services/reportCommentService")>("../../server/services/reportCommentService");
  return {
    ...actual,
    generateStudentCommentDraft: generateStudentCommentDraftMock,
  };
});

vi.mock("../../server/db/prisma", () => ({
  prisma: {
    school: { findUnique: schoolFindUnique },
    appSetting: { findUnique: appSettingFindUnique },
    auditLog: { create: auditLogCreate },
    student: { findFirst: studentFindFirst },
    // HIGH 1 context service mocks (prevents real DB calls in generate route)
    subject: { findMany: vi.fn(async () => []) },
    academicYear: { findMany: vi.fn(async () => []) },
    schoolClass: { findFirst: schoolClassFindFirst },
    stream: { findFirst: streamFindFirst },
    classEnrollment: { findMany: classEnrollmentFindMany },
    subjectMark: { findMany: subjectMarkFindMany },
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
      tokenVersion: 0,
    });
  }, 30000);

  beforeEach(() => {
    vi.clearAllMocks();
    schoolFindUnique.mockResolvedValue({ id: "sch-rc", code: "RCSCH", name: "RC School", subjects: [], academicYears: [] });
    schoolClassFindFirst.mockResolvedValue({ id: "cls-1", name: "Senior 1", schoolId: "sch-rc" });
    streamFindFirst.mockResolvedValue({ id: "str-1", name: "A", schoolId: "sch-rc", classId: "cls-1" });
    classEnrollmentFindMany.mockResolvedValue([]);
    subjectMarkFindMany.mockResolvedValue([]);
    studentFindFirst.mockResolvedValue({ id: "stu-rc-1" });
    generateStudentCommentDraftMock.mockResolvedValue({
      status: "DRAFT",
      studentId: "stu-rc-1",
      comment: "Steady progress this term.",
    });
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

    it("returns 400 when comment exceeds the shared report comment limit", async () => {
      const res = await request(app)
        .post("/api/reports/assistant-comment/accept")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          studentId: "stu-rc-1",
          comment: "A".repeat(241),
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

    it("returns 404 when student does not belong to the signed-in school", async () => {
      studentFindFirst.mockResolvedValueOnce(null);

      const res = await request(app)
        .post("/api/reports/assistant-comment/accept")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          studentId: "stu-foreign",
          comment: "Steady progress this term.",
        });

      expect(res.status).toBe(404);
      expect(res.body.error).toBe("Student not found.");
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

    it("returns 404 when student does not belong to the signed-in school", async () => {
      studentFindFirst.mockResolvedValueOnce(null);

      const res = await request(app)
        .post("/api/reports/assistant-comment/reject")
        .set("Authorization", `Bearer ${authToken}`)
        .send({ studentId: "stu-foreign" });

      expect(res.status).toBe(404);
      expect(res.body.error).toBe("Student not found.");
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

    it("writes ai.suggestion.generated audit row for a successful draft generation request", async () => {
      schoolFindUnique.mockResolvedValue({
        id: "sch-rc",
        code: "RCSCH",
        name: "RC School",
        subjects: [
          { id: "subj-1", name: "Mathematics", sortOrder: 1, isActive: true },
          { id: "subj-2", name: "English", sortOrder: 2, isActive: true },
        ],
        academicYears: [{
          id: "yr-1",
          name: "2025/2026",
          isActive: true,
          startsOn: new Date("2025-01-01T00:00:00.000Z"),
          endsOn: new Date("2025-12-31T00:00:00.000Z"),
          terms: [{
            id: "trm-1",
            name: "Term 1",
            isActive: true,
            startsOn: new Date("2025-02-01T00:00:00.000Z"),
            endsOn: new Date("2025-05-31T00:00:00.000Z"),
          }],
        }],
      });
      classEnrollmentFindMany.mockResolvedValueOnce([{
        studentId: "stu-rc-1",
        student: {
          id: "stu-rc-1",
          admissionNumber: "001",
          firstName: "Ann",
          lastName: "Bee",
          guardianContacts: [{ canReceiveReports: true, phone: "+256700000000", email: null }],
        },
      }]);
      subjectMarkFindMany.mockResolvedValueOnce([
        { studentId: "stu-rc-1", subjectId: "subj-1", assessmentType: "EOT", status: "FINALIZED", marks: 77 },
        { studentId: "stu-rc-1", subjectId: "subj-2", assessmentType: "EOT", status: "FINALIZED", marks: 81 },
      ]);
      const res = await request(app)
        .post("/api/reports/assistant-comment/generate")
        .set("Authorization", `Bearer ${authToken}`)
        .send({ classId: "cls-1", streamId: "str-1", assessmentType: "EOT" });

      expect(res.status).toBe(200);
      expect(res.body.draftCount).toBe(1);
      expect(generateStudentCommentDraftMock).toHaveBeenCalledTimes(1);
      expect(auditLogCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            schoolId: "sch-rc",
            action: "ai.suggestion.generated",
            correlationId: "cls-1",
            details: expect.objectContaining({
              classId: "cls-1",
              streamId: "str-1",
              draftCount: 1,
              unavailableCount: 0,
              incompleteCount: 0,
              totalStudents: 1,
            }),
          }),
        }),
      );
    }, 15000);

    it("returns 404 when the requested stream does not belong to the class", async () => {
      schoolFindUnique.mockResolvedValue({
        id: "sch-rc",
        code: "RCSCH",
        name: "RC School",
        subjects: [{ id: "subj-1", name: "Mathematics", sortOrder: 1, isActive: true }],
        academicYears: [{
          id: "yr-1",
          name: "2025/2026",
          isActive: true,
          startsOn: new Date("2025-01-01T00:00:00.000Z"),
          endsOn: new Date("2025-12-31T00:00:00.000Z"),
          terms: [{
            id: "trm-1",
            name: "Term 1",
            isActive: true,
            startsOn: new Date("2025-02-01T00:00:00.000Z"),
            endsOn: new Date("2025-05-31T00:00:00.000Z"),
          }],
        }],
      });
      streamFindFirst.mockResolvedValueOnce(null);

      const res = await request(app)
        .post("/api/reports/assistant-comment/generate")
        .set("Authorization", `Bearer ${authToken}`)
        .send({ classId: "cls-1", streamId: "str-foreign" });

      expect(res.status).toBe(404);
      expect(res.body.readinessCode).toBe("STREAM_NOT_FOUND");
      expect(auditLogCreate).not.toHaveBeenCalled();
    }, 15000);
  });
});

