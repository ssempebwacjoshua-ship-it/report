import request from "supertest";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { signToken } from "../../server/services/authService";
import { getNextClassCode } from "../../server/services/promotionService";

// UUIDs for test fixtures — must have version bit (3rd group starts 4) and variant (4th starts 8-b)
const ID = {
  school:    "aaaaaaaa-aaaa-4aaa-8aaa-000000000001",
  user:      "aaaaaaaa-aaaa-4aaa-8aaa-000000000002",
  year1:     "bbbbbbbb-bbbb-4bbb-8bbb-000000000001",
  term1:     "cccccccc-cccc-4ccc-8ccc-000000000001",
  year2:     "bbbbbbbb-bbbb-4bbb-8bbb-000000000002",
  term2_1:   "cccccccc-cccc-4ccc-8ccc-000000000002",
  classP3:   "dddddddd-dddd-4ddd-8ddd-000000000001",
  classP4:   "dddddddd-dddd-4ddd-8ddd-000000000002",
  classS6:   "dddddddd-dddd-4ddd-8ddd-000000000003",
  streamA:   "eeeeeeee-eeee-4eee-8eee-000000000001",
  enroll1:   "ffffffff-ffff-4fff-8fff-000000000001",
  enroll2:   "ffffffff-ffff-4fff-8fff-000000000002",
  enrollS6:  "ffffffff-ffff-4fff-8fff-000000000003",
  enrollNew: "ffffffff-ffff-4fff-8fff-000000000010",
  enrollOld: "ffffffff-ffff-4fff-8fff-000000000011",
  enrollNewR:"ffffffff-ffff-4fff-8fff-000000000012",
  student1:  "11111111-1111-4111-8111-000000000001",
  student2:  "11111111-1111-4111-8111-000000000002",
  studentS6: "11111111-1111-4111-8111-000000000003",
  batch1:    "22222222-2222-4222-8222-000000000001",
  batch2:    "22222222-2222-4222-8222-000000000002",
};

// ── Module-level mocks ────────────────────────────────────────────────────────

const {
  schoolFindUnique,
  appSettingFindUnique,
  classEnrollmentFindMany,
  classEnrollmentFindUnique,
  classEnrollmentFindFirst,
  classEnrollmentCreate,
  classEnrollmentUpdate,
  classEnrollmentDelete,
  subjectMarkFindMany,
  subjectMarkFindFirst,
  schoolClassFindFirst,
  streamFindFirst,
  promotionBatchCreate,
  promotionBatchFindFirst,
  promotionBatchFindMany,
  promotionBatchUpdate,
  promotionActionCreate,
  promotionActionUpdate,
  auditLogCreate,
} = vi.hoisted(() => ({
  schoolFindUnique: vi.fn(),
  appSettingFindUnique: vi.fn(async () => null),
  classEnrollmentFindMany: vi.fn(async () => []),
  classEnrollmentFindUnique: vi.fn(async () => null),
  classEnrollmentFindFirst: vi.fn(async () => null),
  classEnrollmentCreate: vi.fn(async (args: { data: unknown }) => ({ id: "ffffffff-0000-0000-0000-000000000099", ...(args.data as object) })),
  classEnrollmentUpdate: vi.fn(async () => ({})),
  classEnrollmentDelete: vi.fn(async () => ({})),
  subjectMarkFindMany: vi.fn(async () => []),
  subjectMarkFindFirst: vi.fn(async () => null),
  schoolClassFindFirst: vi.fn(async () => null),
  streamFindFirst: vi.fn(async () => null),
  promotionBatchCreate: vi.fn(async (args: { data: unknown }) => ({ id: ID.batch1, status: "APPLIED", actions: [], ...(args.data as object) })),
  promotionBatchFindFirst: vi.fn(async () => null),
  promotionBatchFindMany: vi.fn(async () => []),
  promotionBatchUpdate: vi.fn(async () => ({})),
  promotionActionCreate: vi.fn(async () => ({ id: "33333333-3333-4333-8333-000000000001" })),
  promotionActionUpdate: vi.fn(async () => ({})),
  auditLogCreate: vi.fn(async () => ({})),
}));

vi.mock("../../server/db/prisma", () => ({
  prisma: {
    school: { findUnique: schoolFindUnique },
    appSetting: { findUnique: appSettingFindUnique },
    classEnrollment: {
      findMany: classEnrollmentFindMany,
      findUnique: classEnrollmentFindUnique,
      findFirst: classEnrollmentFindFirst,
      create: classEnrollmentCreate,
      update: classEnrollmentUpdate,
      delete: classEnrollmentDelete,
    },
    subjectMark: { findMany: subjectMarkFindMany, findFirst: subjectMarkFindFirst },
    schoolClass: { findFirst: schoolClassFindFirst },
    stream: { findFirst: streamFindFirst },
    promotionBatch: {
      create: promotionBatchCreate,
      findFirst: promotionBatchFindFirst,
      findMany: promotionBatchFindMany,
      update: promotionBatchUpdate,
    },
    promotionAction: { create: promotionActionCreate, update: promotionActionUpdate },
    auditLog: { create: auditLogCreate },
  },
}));

// ── Shared setup ──────────────────────────────────────────────────────────────

describe("promotionRoutes", () => {
  let app: ReturnType<typeof import("../../server").createServer>;
  let token: string;

  beforeAll(async () => {
    const { createServer } = await import("../../server");
    app = createServer();
    token = signToken({
      userId: ID.user,
      schoolId: ID.school,
      name: "Head Teacher",
      email: "hm@school.test",
      role: "ADMIN_OPERATOR",
    });
  }, 30000);

  beforeEach(() => {
    vi.clearAllMocks();
    schoolFindUnique.mockResolvedValue({ id: ID.school, code: "PROMSCH", name: "Promotion Test School" });
    auditLogCreate.mockResolvedValue({});
    appSettingFindUnique.mockResolvedValue(null);
  });

  // ── Preview ───────────────────────────────────────────────────────────────

  describe("POST /api/promotions/preview", () => {
    it("returns empty candidates when no enrollments", async () => {
      classEnrollmentFindMany.mockResolvedValue([]);

      const res = await request(app)
        .post("/api/promotions/preview")
        .set("Authorization", `Bearer ${token}`)
        .send({ academicYearId: ID.year1, termId: ID.term1, assessmentType: "EOT", scoreThreshold: 40 });

      expect(res.status).toBe(200);
      expect(res.body.candidates).toEqual([]);
    }, 15000);

    it("generates promotion candidates with correct decisions", async () => {
      classEnrollmentFindMany.mockResolvedValue([
        {
          id: ID.enroll1,
          studentId: ID.student1,
          student: { id: ID.student1, firstName: "Alice", lastName: "Banda", admissionNumber: "2024/001" },
          class: { id: ID.classP3, name: "P3", code: "P3" },
          stream: { id: ID.streamA, name: "A", code: "A" },
        },
        {
          id: ID.enroll2,
          studentId: ID.student2,
          student: { id: ID.student2, firstName: "Bob", lastName: "Kato", admissionNumber: "2024/002" },
          class: { id: ID.classP3, name: "P3", code: "P3" },
          stream: { id: ID.streamA, name: "A", code: "A" },
        },
      ]);
      subjectMarkFindMany.mockResolvedValue([
        { studentId: ID.student1, marks: "75" },
        { studentId: ID.student2, marks: "30" },
      ]);

      const res = await request(app)
        .post("/api/promotions/preview")
        .set("Authorization", `Bearer ${token}`)
        .send({ academicYearId: ID.year1, termId: ID.term1, assessmentType: "EOT", scoreThreshold: 40 });

      expect(res.status).toBe(200);
      const { candidates } = res.body as { candidates: Array<{ studentId: string; decision: string; toClassCode: string | null }> };
      expect(candidates).toHaveLength(2);

      const alice = candidates.find((c) => c.studentId === ID.student1);
      const bob   = candidates.find((c) => c.studentId === ID.student2);
      expect(alice?.decision).toBe("PROMOTE");
      expect(alice?.toClassCode).toBe("P4");
      expect(bob?.decision).toBe("REPEAT");
    }, 15000);

    it("marks S6 students as GRADUATE regardless of score", async () => {
      classEnrollmentFindMany.mockResolvedValue([
        {
          id: ID.enrollS6,
          studentId: ID.studentS6,
          student: { id: ID.studentS6, firstName: "Carol", lastName: "Nkusi", admissionNumber: "2024/003" },
          class: { id: ID.classS6, name: "Senior 6", code: "S6" },
          stream: { id: ID.streamA, name: "Arts", code: "ARTS" },
        },
      ]);
      subjectMarkFindMany.mockResolvedValue([{ studentId: ID.studentS6, marks: "90" }]);

      const res = await request(app)
        .post("/api/promotions/preview")
        .set("Authorization", `Bearer ${token}`)
        .send({ academicYearId: ID.year1, termId: ID.term1, assessmentType: "EOT" });

      expect(res.status).toBe(200);
      const { candidates } = res.body as { candidates: Array<{ decision: string; toClassCode: string | null }> };
      expect(candidates[0].decision).toBe("GRADUATE");
      expect(candidates[0].toClassCode).toBeNull();
    }, 15000);

    it("returns 401 without auth token", async () => {
      const res = await request(app)
        .post("/api/promotions/preview")
        .send({ academicYearId: ID.year1, termId: ID.term1 });
      expect(res.status).toBe(401);
    }, 15000);
  });

  // ── Apply ─────────────────────────────────────────────────────────────────

  describe("POST /api/promotions/apply", () => {
    const validDecision = {
      studentId: ID.student1,
      enrollmentId: ID.enroll1,
      fromClassName: "P3",
      fromClassCode: "P3",
      fromStreamName: "A",
      toClassCode: "P4",
      decision: "PROMOTE",
      averageScore: 75,
      studentName: "Alice Banda",
    };

    const applyBody = {
      academicYearId: ID.year1,
      termId: ID.term1,
      assessmentType: "EOT",
      scoreThreshold: 40,
      targetAcademicYearId: ID.year2,
      targetTermId: ID.term2_1,
    };

    it("creates a promotion batch and returns batchId", async () => {
      promotionBatchCreate.mockResolvedValue({ id: ID.batch1, status: "APPLIED" });
      schoolClassFindFirst.mockResolvedValue({ id: ID.classP4, name: "P4", code: "P4" });
      streamFindFirst.mockResolvedValue({ id: ID.streamA, name: "A", code: "A" });
      classEnrollmentFindUnique.mockResolvedValue({ stream: { code: "A" } });
      classEnrollmentFindFirst.mockResolvedValue(null);
      classEnrollmentCreate.mockResolvedValue({ id: ID.enrollNew });
      classEnrollmentUpdate.mockResolvedValue({});
      promotionActionCreate.mockResolvedValue({ id: "33333333-0000-0000-0000-000000000001" });

      const res = await request(app)
        .post("/api/promotions/apply")
        .set("Authorization", `Bearer ${token}`)
        .send({ ...applyBody, decisions: [validDecision] });

      expect(res.status).toBe(201);
      expect(res.body.batchId).toBe(ID.batch1);
      expect(promotionBatchCreate).toHaveBeenCalledTimes(1);
      expect(auditLogCreate).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ action: "promotion.apply" }) }),
      );
    }, 15000);

    it("creates a new enrollment when promoting", async () => {
      promotionBatchCreate.mockResolvedValue({ id: ID.batch1, status: "APPLIED" });
      schoolClassFindFirst.mockResolvedValue({ id: ID.classP4, name: "P4", code: "P4" });
      streamFindFirst.mockResolvedValue({ id: ID.streamA, name: "A", code: "A" });
      classEnrollmentFindUnique.mockResolvedValue({ stream: { code: "A" } });
      classEnrollmentFindFirst.mockResolvedValue(null);
      classEnrollmentCreate.mockResolvedValue({ id: ID.enrollNew });
      classEnrollmentUpdate.mockResolvedValue({});
      promotionActionCreate.mockResolvedValue({ id: "33333333-0000-0000-0000-000000000002" });

      await request(app)
        .post("/api/promotions/apply")
        .set("Authorization", `Bearer ${token}`)
        .send({ ...applyBody, decisions: [validDecision] });

      expect(classEnrollmentCreate).toHaveBeenCalledTimes(1);
    }, 15000);

    it("preserves old enrollment (marks it COMPLETED, not deleted)", async () => {
      promotionBatchCreate.mockResolvedValue({ id: ID.batch1, status: "APPLIED" });
      schoolClassFindFirst.mockResolvedValue({ id: ID.classP4, name: "P4", code: "P4" });
      streamFindFirst.mockResolvedValue({ id: ID.streamA, name: "A", code: "A" });
      classEnrollmentFindUnique.mockResolvedValue({ stream: { code: "A" } });
      classEnrollmentFindFirst.mockResolvedValue(null);
      classEnrollmentCreate.mockResolvedValue({ id: ID.enrollNew });
      classEnrollmentUpdate.mockResolvedValue({});
      promotionActionCreate.mockResolvedValue({ id: "33333333-0000-0000-0000-000000000003" });

      await request(app)
        .post("/api/promotions/apply")
        .set("Authorization", `Bearer ${token}`)
        .send({ ...applyBody, decisions: [validDecision] });

      expect(classEnrollmentUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: ID.enroll1 },
          data: expect.objectContaining({ status: "COMPLETED", isActive: false }),
        }),
      );
      expect(classEnrollmentDelete).not.toHaveBeenCalled();
    }, 15000);

    it("repeat keeps student in same class for target year", async () => {
      promotionBatchCreate.mockResolvedValue({ id: ID.batch1, status: "APPLIED" });
      schoolClassFindFirst.mockResolvedValue({ id: ID.classP3, name: "P3", code: "P3" });
      streamFindFirst.mockResolvedValue({ id: ID.streamA, name: "A", code: "A" });
      classEnrollmentFindUnique.mockResolvedValue({ stream: { code: "A" } });
      classEnrollmentFindFirst.mockResolvedValue(null);
      classEnrollmentCreate.mockResolvedValue({ id: ID.enrollNew });
      classEnrollmentUpdate.mockResolvedValue({});
      promotionActionCreate.mockResolvedValue({ id: "33333333-0000-0000-0000-000000000004" });

      await request(app)
        .post("/api/promotions/apply")
        .set("Authorization", `Bearer ${token}`)
        .send({
          ...applyBody,
          decisions: [{ ...validDecision, decision: "REPEAT", toClassCode: null }],
        });

      // Service uses fromClassCode (P3) for repeat
      expect(schoolClassFindFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ code: "P3" }) }),
      );
    }, 15000);

    it("does not create duplicate enrollment on re-run (same student already enrolled)", async () => {
      promotionBatchCreate.mockResolvedValue({ id: ID.batch1, status: "APPLIED" });
      schoolClassFindFirst.mockResolvedValue({ id: ID.classP4, name: "P4", code: "P4" });
      streamFindFirst.mockResolvedValue({ id: ID.streamA, name: "A", code: "A" });
      classEnrollmentFindUnique.mockResolvedValue({ stream: { code: "A" } });
      classEnrollmentFindFirst.mockResolvedValue({ id: ID.enrollNew }); // already enrolled
      classEnrollmentUpdate.mockResolvedValue({});
      promotionActionCreate.mockResolvedValue({ id: "33333333-0000-0000-0000-000000000005" });

      const res = await request(app)
        .post("/api/promotions/apply")
        .set("Authorization", `Bearer ${token}`)
        .send({ ...applyBody, decisions: [validDecision] });

      expect(res.status).toBe(201);
      expect(classEnrollmentCreate).not.toHaveBeenCalled(); // no new enrollment
      expect(res.body.errors.length).toBeGreaterThan(0);
    }, 15000);

    it("returns 400 when decisions array is empty", async () => {
      const res = await request(app)
        .post("/api/promotions/apply")
        .set("Authorization", `Bearer ${token}`)
        .send({ ...applyBody, decisions: [] });
      expect(res.status).toBe(400);
    }, 15000);
  });

  // ── Reverse ───────────────────────────────────────────────────────────────

  describe("POST /api/promotions/batches/:id/reverse", () => {
    it("reverses a batch cleanly when new enrollment has no marks", async () => {
      promotionBatchFindFirst.mockResolvedValue({
        id: ID.batch1,
        schoolId: ID.school,
        status: "APPLIED",
        actions: [
          {
            id: "44444444-4444-4444-8444-000000000001",
            studentId: ID.student1,
            studentName: "Alice Banda",
            fromEnrollmentId: ID.enrollOld,
            toEnrollmentId: ID.enrollNew,
            decision: "PROMOTE",
            status: "APPLIED",
          },
        ],
      });
      subjectMarkFindFirst.mockResolvedValue(null); // no marks
      classEnrollmentFindUnique.mockResolvedValue({ academicYearId: ID.year2, termId: ID.term2_1 });
      classEnrollmentUpdate.mockResolvedValue({});
      classEnrollmentDelete.mockResolvedValue({});
      promotionActionUpdate.mockResolvedValue({});
      promotionBatchUpdate.mockResolvedValue({});

      const res = await request(app)
        .post(`/api/promotions/batches/${ID.batch1}/reverse`)
        .set("Authorization", `Bearer ${token}`)
        .send();

      expect(res.status).toBe(200);
      expect(res.body.reversed).toBe(1);
      expect(res.body.blocked).toHaveLength(0);
      expect(classEnrollmentDelete).toHaveBeenCalledWith({ where: { id: ID.enrollNew } });
      expect(classEnrollmentUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: ID.enrollOld }, data: expect.objectContaining({ status: "ACTIVE" }) }),
      );
      expect(auditLogCreate).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ action: "promotion.reverse" }) }),
      );
    }, 15000);

    it("blocks reversal when new class has marks", async () => {
      promotionBatchFindFirst.mockResolvedValue({
        id: ID.batch2,
        schoolId: ID.school,
        status: "APPLIED",
        actions: [
          {
            id: "44444444-4444-4444-8444-000000000002",
            studentId: ID.student2,
            studentName: "Bob Kato",
            fromEnrollmentId: ID.enrollOld,
            toEnrollmentId: ID.enrollNewR,
            decision: "PROMOTE",
            status: "APPLIED",
          },
        ],
      });
      classEnrollmentFindUnique.mockResolvedValue({ academicYearId: ID.year2, termId: ID.term2_1 });
      subjectMarkFindFirst.mockResolvedValue({ id: "mark-001" }); // marks exist

      const res = await request(app)
        .post(`/api/promotions/batches/${ID.batch2}/reverse`)
        .set("Authorization", `Bearer ${token}`)
        .send();

      expect(res.status).toBe(200);
      expect(res.body.reversed).toBe(0);
      expect(res.body.blocked).toHaveLength(1);
      expect(res.body.blocked[0].studentName).toBe("Bob Kato");
      expect(classEnrollmentDelete).not.toHaveBeenCalled();
    }, 15000);

    it("returns error when batch not found", async () => {
      promotionBatchFindFirst.mockResolvedValue(null);

      const res = await request(app)
        .post(`/api/promotions/batches/${ID.batch1}/reverse`)
        .set("Authorization", `Bearer ${token}`)
        .send();

      expect([404, 500]).toContain(res.status);
    }, 15000);
  });

  // ── Class progression unit tests ──────────────────────────────────────────

  describe("getNextClassCode (class progression map)", () => {
    it("BABY → MIDDLE",   () => expect(getNextClassCode("BABY")).toBe("MIDDLE"));
    it("MIDDLE → TOP",    () => expect(getNextClassCode("MIDDLE")).toBe("TOP"));
    it("TOP → P1",        () => expect(getNextClassCode("TOP")).toBe("P1"));
    it("P1 → P2",         () => expect(getNextClassCode("P1")).toBe("P2"));
    it("P3 → P4",         () => expect(getNextClassCode("P3")).toBe("P4"));
    it("P7 → S1",         () => expect(getNextClassCode("P7")).toBe("S1"));
    it("S1 → S2",         () => expect(getNextClassCode("S1")).toBe("S2"));
    it("S4 → S5",         () => expect(getNextClassCode("S4")).toBe("S5"));
    it("S6 → GRADUATE",   () => expect(getNextClassCode("S6")).toBe("GRADUATE"));
    it("unknown → GRADUATE", () => expect(getNextClassCode("XYZ")).toBe("GRADUATE"));
  });
});
