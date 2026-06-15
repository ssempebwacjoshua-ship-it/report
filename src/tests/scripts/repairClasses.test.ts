import type { PrismaClient } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { repairSchoolClasses } from "../../scripts/repairPreviewClasses";

// ── Fixture data ─────────────────────────────────────────────────────────────

const SCHOOL_ID = "school-1";
const SCHOOL_CODE = "SCU-PREVIEW";

const CANONICAL_S1_ID = "class-s1-canonical";
const BAD_S1A_ID = "class-s1a";
const BAD_S1B_ID = "class-s1b";

const STREAM_A_ID = "stream-a";
const STREAM_B_ID = "stream-b";

const badClasses = [
  { id: BAD_S1A_ID, schoolId: SCHOOL_ID, name: "Senior 1 A", code: "S1A", level: 20 },
  { id: BAD_S1B_ID, schoolId: SCHOOL_ID, name: "Senior 1 B", code: "S1B", level: 20 },
];

const streamsUnderS1A = [{ id: STREAM_A_ID, schoolId: SCHOOL_ID, classId: BAD_S1A_ID, name: "A", code: "A" }];
const streamsUnderS1B = [{ id: STREAM_B_ID, schoolId: SCHOOL_ID, classId: BAD_S1B_ID, name: "B", code: "B" }];

// ── Prisma mock builder ───────────────────────────────────────────────────────

function makePrisma(overrides: {
  classes?: object[];
  streamsForClass?: (classId: string) => object[];
  canonicalClassExists?: boolean;
  streamCollision?: boolean;
}): PrismaClient {
  const {
    classes = badClasses,
    streamsForClass = (id) => (id === BAD_S1A_ID ? streamsUnderS1A : streamsUnderS1B),
    canonicalClassExists = false,
    streamCollision = false,
  } = overrides;

  const classUpsertedById: Record<string, object> = {};
  if (canonicalClassExists) {
    classUpsertedById[CANONICAL_S1_ID] = {
      id: CANONICAL_S1_ID,
      schoolId: SCHOOL_ID,
      name: "Senior 1",
      code: "S1",
      level: 20,
    };
  }

  let createdClass: object | null = null;

  const schoolClassFindUnique = vi.fn(async ({ where }: { where: { schoolId_code?: object } }) => {
    if (canonicalClassExists) {
      return { id: CANONICAL_S1_ID, schoolId: SCHOOL_ID, name: "Senior 1", code: "S1", level: 20 };
    }
    return null;
  });

  const schoolClassCreate = vi.fn(async ({ data }: { data: object }) => {
    createdClass = { id: CANONICAL_S1_ID, ...data };
    return createdClass;
  });

  const schoolClassUpdate = vi.fn(async () => ({}));

  const streamFindMany = vi.fn(async ({ where }: { where: { classId: string } }) =>
    streamsForClass(where.classId),
  );

  const streamFindUnique = vi.fn(async () =>
    streamCollision
      ? { id: "collision-stream-id", classId: CANONICAL_S1_ID, code: "A" }
      : null,
  );

  const streamUpdate = vi.fn(async () => ({}));
  const streamDelete = vi.fn(async () => ({}));

  const enrollmentUpdateMany = vi.fn(async () => ({ count: 3 }));
  const markUpdateMany = vi.fn(async () => ({ count: 5 }));

  const txProxy = {
    schoolClass: {
      findUnique: schoolClassFindUnique,
      create: schoolClassCreate,
      update: schoolClassUpdate,
    },
    stream: {
      findMany: streamFindMany,
      findUnique: streamFindUnique,
      update: streamUpdate,
      delete: streamDelete,
    },
    classEnrollment: { updateMany: enrollmentUpdateMany },
    subjectMark: { updateMany: markUpdateMany },
  };

  return {
    school: {
      findUnique: vi.fn(async () => ({ id: SCHOOL_ID, code: SCHOOL_CODE })),
    },
    schoolClass: {
      findMany: vi.fn(async () => classes),
    },
    $transaction: vi.fn(async (fn: (tx: object) => Promise<unknown>) => fn(txProxy)),
    // expose for assertions
    _tx: txProxy,
  } as unknown as PrismaClient;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("repairSchoolClasses — school not found", () => {
  it("returns skipped entry when school does not exist", async () => {
    const prisma = {
      school: { findUnique: vi.fn(async () => null) },
    } as unknown as PrismaClient;

    const result = await repairSchoolClasses(prisma, "GHOST-SCHOOL");
    expect(result.skipped).toContain("School not found: GHOST-SCHOOL");
    expect(result.badClassesFound).toBe(0);
  });
});

describe("repairSchoolClasses — canonical class creation", () => {
  it("creates the canonical S1 class when it does not exist", async () => {
    const prisma = makePrisma({ classes: [badClasses[0]], canonicalClassExists: false });
    const tx = (prisma as unknown as { _tx: { schoolClass: { create: ReturnType<typeof vi.fn> } } })._tx;

    await repairSchoolClasses(prisma, SCHOOL_CODE);

    expect(tx.schoolClass.create).toHaveBeenCalledOnce();
    expect(tx.schoolClass.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ code: "S1", name: "Senior 1", level: 20 }),
      }),
    );
  });

  it("does not create a new class when canonical S1 already exists", async () => {
    const prisma = makePrisma({ classes: [badClasses[0]], canonicalClassExists: true });
    const tx = (prisma as unknown as { _tx: { schoolClass: { create: ReturnType<typeof vi.fn> } } })._tx;

    await repairSchoolClasses(prisma, SCHOOL_CODE);

    expect(tx.schoolClass.create).not.toHaveBeenCalled();
  });
});

describe("repairSchoolClasses — stream re-parenting", () => {
  it("re-parents stream A from S1A to canonical S1", async () => {
    const prisma = makePrisma({ classes: [badClasses[0]] });
    const tx = (prisma as unknown as { _tx: { stream: { update: ReturnType<typeof vi.fn>; delete: ReturnType<typeof vi.fn> } } })._tx;

    const result = await repairSchoolClasses(prisma, SCHOOL_CODE);

    expect(tx.stream.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: STREAM_A_ID },
        data: { classId: CANONICAL_S1_ID },
      }),
    );
    expect(tx.stream.delete).not.toHaveBeenCalled();
    expect(result.streamsReparented).toBe(1);
  });

  it("merges and deletes old stream when collision exists under canonical class", async () => {
    const prisma = makePrisma({ classes: [badClasses[0]], streamCollision: true });
    const tx = (prisma as unknown as { _tx: { stream: { update: ReturnType<typeof vi.fn>; delete: ReturnType<typeof vi.fn> } } })._tx;

    const result = await repairSchoolClasses(prisma, SCHOOL_CODE);

    expect(tx.stream.delete).toHaveBeenCalledWith({ where: { id: STREAM_A_ID } });
    // stream.update should NOT be called for re-parenting (collision path skips it)
    expect(tx.stream.update).not.toHaveBeenCalled();
    expect(result.streamsReparented).toBe(0);
  });
});

describe("repairSchoolClasses — enrollment and mark migration", () => {
  it("updates ClassEnrollment.classId to canonical class", async () => {
    const prisma = makePrisma({ classes: [badClasses[0]] });
    const tx = (prisma as unknown as { _tx: { classEnrollment: { updateMany: ReturnType<typeof vi.fn> } } })._tx;

    await repairSchoolClasses(prisma, SCHOOL_CODE);

    expect(tx.classEnrollment.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { classId: BAD_S1A_ID },
        data: { classId: CANONICAL_S1_ID },
      }),
    );
  });

  it("updates SubjectMark.classId to canonical class", async () => {
    const prisma = makePrisma({ classes: [badClasses[0]] });
    const tx = (prisma as unknown as { _tx: { subjectMark: { updateMany: ReturnType<typeof vi.fn> } } })._tx;

    await repairSchoolClasses(prisma, SCHOOL_CODE);

    expect(tx.subjectMark.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { classId: BAD_S1A_ID },
        data: { classId: CANONICAL_S1_ID },
      }),
    );
  });

  it("accumulates counts across multiple bad classes", async () => {
    const prisma = makePrisma({ classes: badClasses });
    const result = await repairSchoolClasses(prisma, SCHOOL_CODE);

    // mock returns { count: 3 } for enrollments, { count: 5 } for marks — times 2 bad classes
    expect(result.enrollmentsMigrated).toBe(6);
    expect(result.marksMigrated).toBe(10);
  });
});

describe("repairSchoolClasses — bad class archiving", () => {
  it("renames bad class to ARCHIVED: prefix", async () => {
    const prisma = makePrisma({ classes: [badClasses[0]] });
    const tx = (prisma as unknown as { _tx: { schoolClass: { update: ReturnType<typeof vi.fn> } } })._tx;

    await repairSchoolClasses(prisma, SCHOOL_CODE);

    expect(tx.schoolClass.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: BAD_S1A_ID },
        data: {
          name: "ARCHIVED: Senior 1 A",
          code: "ARCHIVED:S1A",
        },
      }),
    );
  });

  it("skips already-archived classes", async () => {
    const archivedClass = {
      id: "class-archived",
      schoolId: SCHOOL_ID,
      name: "ARCHIVED: Senior 1 A",
      code: "ARCHIVED:S1A",
      level: 20,
    };
    const prisma = makePrisma({ classes: [archivedClass] });

    const result = await repairSchoolClasses(prisma, SCHOOL_CODE);

    expect(result.badClassesFound).toBe(0);
    expect(result.classesRepaired).toBe(0);
  });
});

describe("repairSchoolClasses — result summary", () => {
  it("returns correct counts for two bad classes", async () => {
    const prisma = makePrisma({ classes: badClasses });
    const result = await repairSchoolClasses(prisma, SCHOOL_CODE);

    expect(result.schoolCode).toBe(SCHOOL_CODE);
    expect(result.badClassesFound).toBe(2);
    expect(result.classesRepaired).toBe(2);
    expect(result.streamsReparented).toBe(2);
    expect(result.skipped).toHaveLength(0);
  });

  it("skips bad codes that cannot be parsed to a canonical parent", async () => {
    const unparseableClass = {
      id: "class-weird",
      schoolId: SCHOOL_ID,
      name: "WEIRD",
      code: "WEIRD",
      level: 99,
    };
    const prisma = makePrisma({ classes: [unparseableClass] });
    const result = await repairSchoolClasses(prisma, SCHOOL_CODE);

    expect(result.skipped.some((s) => s.includes("WEIRD"))).toBe(true);
    expect(result.classesRepaired).toBe(0);
  });
});
