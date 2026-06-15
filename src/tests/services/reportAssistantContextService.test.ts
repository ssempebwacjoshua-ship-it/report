import { describe, expect, it, vi } from "vitest";
import { buildReportAssistantContext } from "../../server/services/reportAssistantContextService";
import type { PrismaClient } from "@prisma/client";

const SCHOOL_ID = "sch-1";
const CLASS_ID = "cls-1";
const STREAM_ID = "str-1";
const TERM_ID = "trm-1";
const YEAR_ID = "yr-1";
const SUBJ_MATH = "subj-math";
const SUBJ_ENG = "subj-eng";
const STU_A = "stu-a";
const STU_B = "stu-b";

function makeSchool(overrides: Record<string, unknown> = {}) {
  return {
    id: SCHOOL_ID,
    code: "TEST",
    name: "Test School",
    subjects: [
      { id: SUBJ_MATH, name: "Mathematics", sortOrder: 1, isActive: true },
      { id: SUBJ_ENG, name: "English", sortOrder: 2, isActive: true },
    ],
    academicYears: [
      {
        id: YEAR_ID,
        name: "2025/2026",
        isActive: true,
        terms: [{ id: TERM_ID, name: "Term 1", isActive: true }],
      },
    ],
    ...overrides,
  };
}

function makeEnrollment(studentId: string, admissionNumber: string, name: [string, string]) {
  return {
    studentId,
    student: {
      id: studentId,
      admissionNumber,
      firstName: name[0],
      lastName: name[1],
      guardianContacts: [{ canReceiveReports: true, phone: "+256700000000", email: null }],
    },
  };
}

function makeMark(
  studentId: string,
  subjectId: string,
  assessmentType: "BOT" | "MOT" | "EOT",
  status: "FINALIZED" | "DRAFT" = "FINALIZED",
) {
  return { studentId, subjectId, assessmentType, status, marks: 75 };
}

function buildMock(options: {
  school?: ReturnType<typeof makeSchool> | null;
  classRecord?: object | null;
  streamRecord?: object | null;
  enrollments?: ReturnType<typeof makeEnrollment>[];
  marks?: ReturnType<typeof makeMark>[];
}) {
  const {
    school = makeSchool(),
    classRecord = { id: CLASS_ID, name: "Senior 1", schoolId: SCHOOL_ID },
    streamRecord = { id: STREAM_ID, name: "A", schoolId: SCHOOL_ID },
    enrollments = [],
    marks = [],
  } = options;

  return {
    appSetting: { findUnique: vi.fn(async () => null) },
    school: { findUnique: vi.fn(async () => school) },
    schoolClass: { findFirst: vi.fn(async () => classRecord) },
    stream: { findFirst: vi.fn(async () => streamRecord) },
    classEnrollment: { findMany: vi.fn(async () => enrollments) },
    subjectMark: { findMany: vi.fn(async () => marks) },
  } as unknown as PrismaClient;
}

const query = {
  schoolCode: "TEST",
  classId: CLASS_ID,
  streamId: STREAM_ID,
  assessmentType: "EOT" as const,
};

// ─── validity / edge cases ──────────────────────────────────────────────────

describe("reportAssistantContextService — context validity", () => {
  it("returns SCHOOL_NOT_FOUND when school does not exist", async () => {
    const ctx = await buildReportAssistantContext(
      buildMock({ school: null }),
      query,
    );
    expect(ctx.readinessCode).toBe("SCHOOL_NOT_FOUND");
    expect(ctx.schoolFound).toBe(false);
    expect(ctx.isReadyToIssue).toBe(false);
  });

  it("returns NO_ACTIVE_TERM when school has no active term", async () => {
    const ctx = await buildReportAssistantContext(
      buildMock({ school: makeSchool({ academicYears: [] }) }),
      query,
    );
    expect(ctx.readinessCode).toBe("NO_ACTIVE_TERM");
    expect(ctx.hasActiveTerm).toBe(false);
  });

  it("returns CLASS_NOT_FOUND when classId does not belong to school", async () => {
    const ctx = await buildReportAssistantContext(
      buildMock({ classRecord: null }),
      query,
    );
    expect(ctx.readinessCode).toBe("CLASS_NOT_FOUND");
    expect(ctx.classFound).toBe(false);
  });

  it("returns NO_SUBJECTS when school has no subjects", async () => {
    const ctx = await buildReportAssistantContext(
      buildMock({ school: makeSchool({ subjects: [] }) }),
      query,
    );
    expect(ctx.readinessCode).toBe("NO_SUBJECTS");
    expect(ctx.hasSubjects).toBe(false);
  });

  it("returns NO_STUDENTS when class has no active enrollments", async () => {
    const ctx = await buildReportAssistantContext(
      buildMock({ enrollments: [] }),
      query,
    );
    expect(ctx.readinessCode).toBe("NO_STUDENTS");
    expect(ctx.hasStudents).toBe(false);
    expect(ctx.totalStudents).toBe(0);
  });
});

// ─── readiness logic ────────────────────────────────────────────────────────

describe("reportAssistantContextService — readiness logic", () => {
  it("returns READY when all students have finalized marks for all subjects", async () => {
    const ctx = await buildReportAssistantContext(
      buildMock({
        enrollments: [
          makeEnrollment(STU_A, "001", ["Ann", "Bee"]),
          makeEnrollment(STU_B, "002", ["Bob", "Cee"]),
        ],
        marks: [
          makeMark(STU_A, SUBJ_MATH, "EOT", "FINALIZED"),
          makeMark(STU_A, SUBJ_ENG, "EOT", "FINALIZED"),
          makeMark(STU_B, SUBJ_MATH, "EOT", "FINALIZED"),
          makeMark(STU_B, SUBJ_ENG, "EOT", "FINALIZED"),
        ],
      }),
      query,
    );
    expect(ctx.readinessCode).toBe("READY");
    expect(ctx.isReadyToIssue).toBe(true);
    expect(ctx.studentsReadyToIssue).toBe(2);
    expect(ctx.studentsWithNoMarks).toBe(0);
    expect(ctx.studentsWithMissingMarks).toBe(0);
    expect(ctx.issues).toHaveLength(0);
  });

  it("returns NO_FINALIZED_MARKS when all marks are DRAFT", async () => {
    const ctx = await buildReportAssistantContext(
      buildMock({
        enrollments: [makeEnrollment(STU_A, "001", ["Ann", "Bee"])],
        marks: [
          makeMark(STU_A, SUBJ_MATH, "EOT", "DRAFT"),
          makeMark(STU_A, SUBJ_ENG, "EOT", "DRAFT"),
        ],
      }),
      query,
    );
    expect(ctx.readinessCode).toBe("NO_FINALIZED_MARKS");
    expect(ctx.finalizedMarkCount).toBe(0);
    expect(ctx.draftMarkCount).toBe(2);
    expect(ctx.isReadyToIssue).toBe(false);
  });

  it("returns MISSING_MARKS when a student is missing a subject", async () => {
    const ctx = await buildReportAssistantContext(
      buildMock({
        enrollments: [makeEnrollment(STU_A, "001", ["Ann", "Bee"])],
        marks: [makeMark(STU_A, SUBJ_MATH, "EOT", "FINALIZED")], // missing English
      }),
      query,
    );
    expect(ctx.readinessCode).toBe("MISSING_MARKS");
    expect(ctx.studentsWithMissingMarks).toBe(1);
    expect(ctx.students[0]!.missingSubjectNames).toContain("English");
  });

  it("counts students with no marks at all", async () => {
    const ctx = await buildReportAssistantContext(
      buildMock({
        enrollments: [
          makeEnrollment(STU_A, "001", ["Ann", "Bee"]),
          makeEnrollment(STU_B, "002", ["Bob", "Cee"]),
        ],
        marks: [makeMark(STU_A, SUBJ_MATH, "EOT")], // STU_B has nothing
      }),
      query,
    );
    expect(ctx.studentsWithNoMarks).toBe(1);
    expect(ctx.students.find((s) => s.studentId === STU_B)!.hasAnyMark).toBe(false);
  });
});

// ─── draft detection ─────────────────────────────────────────────────────────

describe("reportAssistantContextService — draft marks", () => {
  it("reports draftSubjectNames for subjects with only DRAFT status", async () => {
    const ctx = await buildReportAssistantContext(
      buildMock({
        enrollments: [makeEnrollment(STU_A, "001", ["Ann", "Bee"])],
        marks: [
          makeMark(STU_A, SUBJ_MATH, "EOT", "FINALIZED"),
          makeMark(STU_A, SUBJ_ENG, "EOT", "DRAFT"), // draft — counts as missing
        ],
      }),
      query,
    );
    const student = ctx.students[0]!;
    expect(student.draftSubjectNames).toContain("English");
    expect(student.missingSubjectNames).toContain("English"); // DRAFT does not satisfy FINALIZED requirement
    expect(ctx.draftMarkCount).toBe(1);
    expect(ctx.warnings.some((w) => w.includes("DRAFT"))).toBe(true);
  });
});

// ─── TERM_SUMMARY (requires BOT + MOT + EOT) ─────────────────────────────────

describe("reportAssistantContextService — TERM_SUMMARY assessment type", () => {
  const tsQuery = { ...query, assessmentType: "TERM_SUMMARY" as const };

  it("READY only when all three types are finalized for all subjects", async () => {
    const ctx = await buildReportAssistantContext(
      buildMock({
        enrollments: [makeEnrollment(STU_A, "001", ["Ann", "Bee"])],
        marks: [
          makeMark(STU_A, SUBJ_MATH, "BOT"),
          makeMark(STU_A, SUBJ_MATH, "MOT"),
          makeMark(STU_A, SUBJ_MATH, "EOT"),
          makeMark(STU_A, SUBJ_ENG, "BOT"),
          makeMark(STU_A, SUBJ_ENG, "MOT"),
          makeMark(STU_A, SUBJ_ENG, "EOT"),
        ],
      }),
      tsQuery,
    );
    expect(ctx.readinessCode).toBe("READY");
  });

  it("MISSING_MARKS when only BOT+MOT are present (EOT missing)", async () => {
    const ctx = await buildReportAssistantContext(
      buildMock({
        enrollments: [makeEnrollment(STU_A, "001", ["Ann", "Bee"])],
        marks: [
          makeMark(STU_A, SUBJ_MATH, "BOT"),
          makeMark(STU_A, SUBJ_MATH, "MOT"),
          makeMark(STU_A, SUBJ_ENG, "BOT"),
          makeMark(STU_A, SUBJ_ENG, "MOT"),
        ],
      }),
      tsQuery,
    );
    expect(ctx.readinessCode).toBe("MISSING_MARKS");
  });
});

// ─── contact readiness warning ───────────────────────────────────────────────

describe("reportAssistantContextService — contact readiness", () => {
  it("warns when a student has no valid parent contact", async () => {
    const noContactEnrollment = {
      studentId: STU_A,
      student: {
        id: STU_A,
        admissionNumber: "001",
        firstName: "Ann",
        lastName: "Bee",
        guardianContacts: [], // no contacts
      },
    };
    const ctx = await buildReportAssistantContext(
      buildMock({
        enrollments: [noContactEnrollment],
        marks: [makeMark(STU_A, SUBJ_MATH, "EOT"), makeMark(STU_A, SUBJ_ENG, "EOT")],
      }),
      query,
    );
    expect(ctx.students[0]!.contactReady).toBe(false);
    expect(ctx.warnings.some((w) => w.includes("parent contact"))).toBe(true);
  });
});

// ─── output shape guarantees ─────────────────────────────────────────────────

describe("reportAssistantContextService — output shape", () => {
  it("returns correct class/stream/term names in the context", async () => {
    const ctx = await buildReportAssistantContext(
      buildMock({
        enrollments: [makeEnrollment(STU_A, "001", ["Ann", "Bee"])],
        marks: [makeMark(STU_A, SUBJ_MATH, "EOT"), makeMark(STU_A, SUBJ_ENG, "EOT")],
      }),
      query,
    );
    expect(ctx.className).toBe("Senior 1");
    expect(ctx.streamName).toBe("A");
    expect(ctx.academicYear).toBe("2025/2026");
    expect(ctx.term).toBe("Term 1");
    expect(ctx.totalSubjects).toBe(2);
    expect(ctx.totalStudents).toBe(1);
  });

  it("returns per-student summaries with correct fields", async () => {
    const ctx = await buildReportAssistantContext(
      buildMock({
        enrollments: [makeEnrollment(STU_A, "001", ["Ann", "Bee"])],
        marks: [makeMark(STU_A, SUBJ_MATH, "EOT"), makeMark(STU_A, SUBJ_ENG, "EOT")],
      }),
      query,
    );
    const student = ctx.students[0]!;
    expect(student.studentId).toBe(STU_A);
    expect(student.admissionNumber).toBe("001");
    expect(student.name).toBe("Ann Bee");
    expect(student.hasAllFinalized).toBe(true);
    expect(student.missingSubjectNames).toHaveLength(0);
  });
});
