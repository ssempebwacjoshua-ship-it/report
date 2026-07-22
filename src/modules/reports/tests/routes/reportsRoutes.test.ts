import { describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { getReportContext } from "../../server/repositories/schoolRepository";
import { loadReportEngineInput } from "../../server/repositories/reportsRepository";
import { defaultSettingsSections } from "../../../../shared/types/settings";

const SCHOOL_CODE = "SCU-PREVIEW";
const SCHOOL_ID = "school-1";
const CLS = "aaaaaaaa-0000-0000-0000-000000000001";

function makePrisma(subjectMarkFindMany: ReturnType<typeof vi.fn>) {
  const enrollments = [{
    studentId: "stu-1",
    student: {
      id: "stu-1",
      admissionNumber: "S1-001",
      firstName: "Alice",
      lastName: "Namusoke",
      guardianContacts: [],
      isActive: true,
    },
    class: { id: CLS, name: "Senior 1", code: "S1" },
    stream: { id: "stream-1", name: "A" },
  }];
  const school = {
    id: SCHOOL_ID,
    code: SCHOOL_CODE,
    name: "Test School",
    academicYears: [{
      id: "year-1",
      name: "2025/2026",
      isActive: true,
      startsOn: new Date("2025-01-01T00:00:00.000Z"),
      endsOn: new Date("2026-12-31T00:00:00.000Z"),
      terms: [{
        id: "term-1",
        name: "Term 1",
        isActive: true,
        startsOn: new Date("2026-02-01T00:00:00.000Z"),
        endsOn: new Date("2026-05-31T00:00:00.000Z"),
      }],
    }],
    subjects: [{ id: "subject-1", name: "Mathematics", sortOrder: 1 }],
  };

  return {
    school: { findUnique: vi.fn(async () => school) },
    schoolClass: { findFirst: vi.fn(async () => ({ id: CLS, name: "Senior 1", code: "S1" })) },
    stream: { findFirst: vi.fn(async () => ({ id: "stream-1" })) },
    classEnrollment: { findMany: vi.fn(async ({ where }: any) => (where.studentId === "student-missing" ? [] : enrollments)) },
    subjectMark: { findMany: subjectMarkFindMany },
    promotionAction: { findMany: vi.fn(async () => []) },
    appSetting: { findUnique: vi.fn(async () => null) },
  } as unknown as PrismaClient;
}

describe("loadReportEngineInput ? mark status filtering", () => {
  const filters = {
    schoolCode: SCHOOL_CODE,
    classId: CLS,
    streamId: "",
    assessmentType: "BOT" as const,
  };

  it("passes status: FINALIZED to subjectMark.findMany", async () => {
    const subjectMarkFindMany = vi.fn(async () => []);
    await loadReportEngineInput(makePrisma(subjectMarkFindMany), filters);

    expect(subjectMarkFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: "FINALIZED" }),
      }),
    );
  });

  it("never queries with status: DRAFT", async () => {
    const subjectMarkFindMany = vi.fn(async () => []);
    await loadReportEngineInput(makePrisma(subjectMarkFindMany), filters);

    for (const [arg] of subjectMarkFindMany.mock.calls as Array<[{ where?: { status?: string } }]>) {
      expect(arg.where?.status).not.toBe("DRAFT");
    }
  });

  it("includes returned FINALIZED marks in the engine input marks list", async () => {
    const finalizedMark = {
      id: "mark-1",
      studentId: "stu-1",
      subjectId: "subject-1",
      assessmentType: "BOT",
      marks: 82,
      status: "FINALIZED",
      comments: null,
    };
    const subjectMarkFindMany = vi.fn(async () => [finalizedMark]);
    const result = await loadReportEngineInput(makePrisma(subjectMarkFindMany), filters);

    expect(result.marks).toHaveLength(1);
    expect(result.marks[0].studentId).toBe("stu-1");
    expect(result.marks[0].marks).toBe(82);
  });

  it("returns a clear empty reason for class and stream mismatch", async () => {
    const prisma = {
      school: { findUnique: vi.fn(async () => ({
        id: SCHOOL_ID,
        code: SCHOOL_CODE,
        name: "Test School",
        academicYears: [{
          id: "year-1",
          name: "2025/2026",
          isActive: true,
          startsOn: new Date("2025-01-01T00:00:00.000Z"),
          endsOn: new Date("2026-12-31T00:00:00.000Z"),
          terms: [{
            id: "term-1",
            name: "Term 1",
            isActive: true,
            startsOn: new Date("2026-02-01T00:00:00.000Z"),
            endsOn: new Date("2026-05-31T00:00:00.000Z"),
          }],
        }],
        subjects: [{ id: "subject-1", name: "Mathematics", sortOrder: 1 }],
      })) },
      schoolClass: { findFirst: vi.fn(async () => ({ id: CLS, name: "Senior 1", code: "S1" })) },
      stream: { findFirst: vi.fn(async () => null) },
      classEnrollment: { findMany: vi.fn(async () => []) },
      subjectMark: { findMany: vi.fn(async () => []) },
      promotionAction: { findMany: vi.fn(async () => []) },
      appSetting: { findUnique: vi.fn(async () => null) },
    } as unknown as PrismaClient;

    const result = await loadReportEngineInput(prisma, {
      schoolCode: SCHOOL_CODE,
      classId: CLS,
      streamId: "stream-b",
      assessmentType: "TERM_SUMMARY",
    });

    expect(result.students).toEqual([]);
    expect(result.emptyReasonOverride).toBe("Selected stream does not belong to the selected class for this school.");
  });

  it("fails safely when a filtered student is not enrolled in the selected class", async () => {
    const subjectMarkFindMany = vi.fn(async () => []);
    const prisma = makePrisma(subjectMarkFindMany) as any;

    const result = await loadReportEngineInput(prisma, {
      schoolCode: SCHOOL_CODE,
      classId: CLS,
      studentId: "student-missing",
      assessmentType: "BOT",
    });

    expect(result.students).toEqual([]);
    expect(result.emptyReasonOverride).toBe("Selected student is not enrolled in the requested school/class/stream for the active term.");
  });
});

type MockSubject = {
  id: string;
  name: string;
  code: string;
  sortOrder: number;
  isActive: boolean;
};

function makeContextSchool(subjects: MockSubject[] = []) {
  return {
    id: SCHOOL_ID,
    code: SCHOOL_CODE,
    name: "Test School",
    academicYears: [{
      id: "year-1",
      name: "2025/2026",
      isActive: true,
      startsOn: new Date("2025-01-01T00:00:00.000Z"),
      endsOn: new Date("2026-12-31T00:00:00.000Z"),
      terms: [{
        id: "term-1",
        name: "Term 1",
        isActive: true,
        startsOn: new Date("2026-02-01T00:00:00.000Z"),
        endsOn: new Date("2026-05-31T00:00:00.000Z"),
      }],
    }],
    classes: [
      { id: "class-p1", name: "P1", code: "P1", level: 10 },
      { id: "class-p2", name: "P2", code: "P2", level: 11 },
    ],
    streams: [{ id: "stream-a", name: "A", code: "A", classId: "class-p1" }],
    subjects,
  };
}

function makeContextPrisma(options: {
  initialSubjects?: MockSubject[];
  refetchedSubjects?: MockSubject[];
  sections?: Array<"NURSERY" | "PRIMARY" | "SECONDARY">;
}) {
  const school = makeContextSchool(options.initialSubjects ?? []);
  const subjectFindFirst = vi.fn(async () => null);
  const subjectCreate = vi.fn(async ({ data }: { data: { code: string; name: string } }) => ({
    id: `subject-${data.code}`,
    ...data,
  }));
  const subjectUpdate = vi.fn(async ({ data }: { data: object }) => ({ id: "subject-existing", ...data }));
  const subjectFindMany = vi.fn(async () => options.refetchedSubjects ?? []);
  const subjectDelete = vi.fn(async () => ({}));

  const mockPrisma = {
    school: { findUnique: vi.fn(async () => school) },
    appSetting: {
      findUnique: vi.fn(async () => ({
        sections: {
          ...defaultSettingsSections,
          school: {
            ...defaultSettingsSections.school,
            schoolSections: options.sections ?? ["PRIMARY"],
          },
        },
        updatedAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedBy: null,
      })),
    },
    term: { findMany: vi.fn(async () => [{ id: "term-1", name: "Term 1", isActive: true }]) },
    subject: {
      findFirst: subjectFindFirst,
      create: subjectCreate,
      update: subjectUpdate,
      findMany: subjectFindMany,
      delete: subjectDelete,
    },
  } as unknown as PrismaClient;

  return { mockPrisma, subjectCreate, subjectFindMany, subjectDelete };
}

const STUDENT_ID = "stu-aaaaaaaa-4aaa-8aaa-000000000001";
const ENROLLMENT_MOCK = {
  studentId: STUDENT_ID,
  student: {
    id: STUDENT_ID,
    admissionNumber: "S1-001",
    firstName: "Alice",
    lastName: "Namusoke",
    guardianContacts: [],
    isActive: true,
  },
  class: { id: CLS, name: "Senior 1", code: "S1" },
  stream: { id: "stream-1", name: "A" },
};

function makePrismaWithEnrollments(
  enrollments: object[],
  promotionActions: object[],
) {
  const school = {
    id: SCHOOL_ID,
    code: SCHOOL_CODE,
    name: "Test School",
    academicYears: [{
      id: "year-1",
      name: "2025/2026",
      isActive: true,
      startsOn: new Date("2025-01-01T00:00:00.000Z"),
      endsOn: new Date("2026-12-31T00:00:00.000Z"),
      terms: [{
        id: "term-1",
        name: "Term 1",
        isActive: true,
        startsOn: new Date("2026-02-01T00:00:00.000Z"),
        endsOn: new Date("2026-05-31T00:00:00.000Z"),
      }],
    }],
    subjects: [{ id: "subject-1", name: "Mathematics", sortOrder: 1 }],
  };

  return {
    school: { findUnique: vi.fn(async () => school) },
    schoolClass: { findFirst: vi.fn(async () => ({ id: CLS, name: "Senior 1", code: "S1" })) },
    stream: { findFirst: vi.fn(async () => ({ id: "stream-1" })) },
    classEnrollment: { findMany: vi.fn(async () => enrollments) },
    subjectMark: { findMany: vi.fn(async () => []) },
    promotionAction: { findMany: vi.fn(async () => promotionActions) },
    appSetting: { findUnique: vi.fn(async () => null) },
  } as unknown as PrismaClient;
}

describe("loadReportEngineInput ? progressionText from promotion actions", () => {
  const filters = {
    schoolCode: SCHOOL_CODE,
    classId: CLS,
    streamId: "",
    assessmentType: "TERM_SUMMARY" as const,
  };

  it("sets progressionText to 'Promoted to Senior 2' for a PROMOTE action", async () => {
    const prisma = makePrismaWithEnrollments(
      [ENROLLMENT_MOCK],
      [{
        studentId: STUDENT_ID,
        decision: "PROMOTE",
        fromClassName: "Senior 1",
        toClassName: "Senior 2",
      }],
    );
    const input = await loadReportEngineInput(prisma, filters);
    expect(input.promotionsByStudentId![STUDENT_ID]).toBe("Promoted to Senior 2");
  });

  it("sets progressionText to 'To repeat Senior 1' for a REPEAT action", async () => {
    const prisma = makePrismaWithEnrollments(
      [ENROLLMENT_MOCK],
      [{
        studentId: STUDENT_ID,
        decision: "REPEAT",
        fromClassName: "Senior 1",
        toClassName: null,
      }],
    );
    const input = await loadReportEngineInput(prisma, filters);
    expect(input.promotionsByStudentId![STUDENT_ID]).toBe("To repeat Senior 1");
  });

  it("leaves progressionText undefined for students with no promotion action", async () => {
    const prisma = makePrismaWithEnrollments([ENROLLMENT_MOCK], []);
    const input = await loadReportEngineInput(prisma, filters);
    expect(input.promotionsByStudentId![STUDENT_ID]).toBeUndefined();
  });
});

describe("getReportContext ? subject auto-healing", () => {
  it("auto-provisions subjects when classes exist and active subjects are empty", async () => {
    const { mockPrisma, subjectCreate } = makeContextPrisma({
      refetchedSubjects: [{ id: "subject-math", name: "Mathematics", code: "MATH", sortOrder: 2, isActive: true }],
    });

    await getReportContext(mockPrisma, SCHOOL_CODE);

    expect(subjectCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ schoolId: SCHOOL_ID, name: "Mathematics", code: "MATH" }),
    });
  });

  it("returns newly created subjects in the same report context response", async () => {
    const { mockPrisma } = makeContextPrisma({
      refetchedSubjects: [
        { id: "subject-eng", name: "English", code: "ENG", sortOrder: 1, isActive: true },
        { id: "subject-math", name: "Mathematics", code: "MATH", sortOrder: 2, isActive: true },
      ],
    });

    const context = await getReportContext(mockPrisma, SCHOOL_CODE);

    expect(context.subjects).toEqual([
      { id: "subject-eng", name: "English", code: "ENG" },
      { id: "subject-math", name: "Mathematics", code: "MATH" },
    ]);
  });

  it("does not delete existing custom subjects", async () => {
    const { mockPrisma, subjectCreate, subjectDelete } = makeContextPrisma({
      initialSubjects: [{ id: "subject-custom", name: "Robotics", code: "ROBOT", sortOrder: 99, isActive: true }],
    });

    const context = await getReportContext(mockPrisma, SCHOOL_CODE);

    expect(subjectCreate).not.toHaveBeenCalled();
    expect(subjectDelete).not.toHaveBeenCalled();
    expect(context.subjects).toEqual([{ id: "subject-custom", name: "Robotics", code: "ROBOT" }]);
  });

  it("does not create duplicate subjects when active subjects already exist", async () => {
    const { mockPrisma, subjectCreate, subjectFindMany } = makeContextPrisma({
      initialSubjects: [{ id: "subject-math", name: "Mathematics", code: "MATH", sortOrder: 1, isActive: true }],
    });

    await getReportContext(mockPrisma, SCHOOL_CODE);

    expect(subjectCreate).not.toHaveBeenCalled();
    expect(subjectFindMany).not.toHaveBeenCalled();
  });
});

