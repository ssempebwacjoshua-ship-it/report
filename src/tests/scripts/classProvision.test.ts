import { describe, it, expect, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";
import {
  provisionCanonicalClasses,
  repairSchoolClasses,
} from "../../scripts/repairPreviewClasses";

// ── Prisma mock helpers ───────────────────────────────────────────────────────

type UpsertCall = { where: { schoolId_code: { code: string } }; create: { code: string } };

function makeSchoolMock(schoolId = "school-uuid-1") {
  return { findUnique: vi.fn(async () => ({ id: schoolId, code: "TEST-SCHOOL" })) };
}

function makeUpsertMock() {
  return vi.fn(async ({ create }: UpsertCall) => create);
}

function makeSubjectMock(existing: object | null = null) {
  return {
    findFirst: vi.fn(async () => existing),
    create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({ id: `subject-${data.code}`, ...data })),
    update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({ id: "subject-existing", ...data })),
  };
}

// ── provisionCanonicalClasses ─────────────────────────────────────────────────

describe("provisionCanonicalClasses ? secondary school", () => {
  it("upserts exactly S1 through S6 for sections = [SECONDARY]", async () => {
    const upsert = makeUpsertMock();
    const mockPrisma = {
      school: makeSchoolMock(),
      schoolClass: { upsert },
      subject: makeSubjectMock(),
    } as unknown as PrismaClient;

    await provisionCanonicalClasses(mockPrisma, "TEST-SCHOOL", ["SECONDARY"]);

    const codes = upsert.mock.calls.map((c) => (c[0] as UpsertCall).create.code);
    expect(codes).toHaveLength(6);
    expect(codes).toEqual(expect.arrayContaining(["S1", "S2", "S3", "S4", "S5", "S6"]));
  });

  it("sets correct level and name for each secondary class", async () => {
    const upsert = makeUpsertMock();
    const mockPrisma = {
      school: makeSchoolMock(),
      schoolClass: { upsert },
      subject: makeSubjectMock(),
    } as unknown as PrismaClient;

    await provisionCanonicalClasses(mockPrisma, "TEST-SCHOOL", ["SECONDARY"]);

    const creates = upsert.mock.calls.map((c) => (c[0] as UpsertCall).create);
    const s1 = creates.find((c) => c.code === "S1") as { name: string; level: number } | undefined;
    expect(s1).toBeDefined();
    expect(s1!.name).toBe("Senior 1");
  });
});

describe("provisionCanonicalClasses ? primary school", () => {
  it("upserts exactly P1 through P7 for sections = [PRIMARY]", async () => {
    const upsert = makeUpsertMock();
    const mockPrisma = {
      school: makeSchoolMock(),
      schoolClass: { upsert },
      subject: makeSubjectMock(),
    } as unknown as PrismaClient;

    await provisionCanonicalClasses(mockPrisma, "TEST-SCHOOL", ["PRIMARY"]);

    const codes = upsert.mock.calls.map((c) => (c[0] as UpsertCall).create.code);
    expect(codes).toHaveLength(7);
    expect(codes).toEqual(expect.arrayContaining(["P1", "P2", "P3", "P4", "P5", "P6", "P7"]));
  });

  it("seeds primary subjects when primary classes are provisioned", async () => {
    const subjects = makeSubjectMock();
    const mockPrisma = {
      school: makeSchoolMock(),
      schoolClass: { upsert: makeUpsertMock() },
      subject: subjects,
    } as unknown as PrismaClient;

    await provisionCanonicalClasses(mockPrisma, "TEST-SCHOOL", ["PRIMARY"]);

    expect(subjects.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ name: "Mathematics", code: "MATH" }),
    });
    expect(subjects.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ name: "Social Studies", code: "SST" }),
    });
  });

  it("does not duplicate subjects when provisioning is re-run", async () => {
    const subjects = makeSubjectMock({ id: "subject-existing", schoolId: "school-uuid-1", name: "Mathematics", code: "MATH" });
    const mockPrisma = {
      school: makeSchoolMock(),
      schoolClass: { upsert: makeUpsertMock() },
      subject: subjects,
    } as unknown as PrismaClient;

    await provisionCanonicalClasses(mockPrisma, "TEST-SCHOOL", ["PRIMARY"]);

    expect(subjects.create).not.toHaveBeenCalled();
    expect(subjects.update).toHaveBeenCalled();
  });
});

describe("provisionCanonicalClasses ? nursery school", () => {
  it("upserts Baby/Middle/Top for sections = [NURSERY]", async () => {
    const upsert = makeUpsertMock();
    const mockPrisma = {
      school: makeSchoolMock(),
      schoolClass: { upsert },
      subject: makeSubjectMock(),
    } as unknown as PrismaClient;

    await provisionCanonicalClasses(mockPrisma, "TEST-SCHOOL", ["NURSERY"]);

    const codes = upsert.mock.calls.map((c) => (c[0] as UpsertCall).create.code);
    expect(codes).toHaveLength(3);
    expect(codes).toEqual(expect.arrayContaining(["BABY", "MIDDLE", "TOP"]));
  });
});

describe("provisionCanonicalClasses ? multi-section school", () => {
  it("upserts 13 classes for PRIMARY + SECONDARY", async () => {
    const upsert = makeUpsertMock();
    const mockPrisma = {
      school: makeSchoolMock(),
      schoolClass: { upsert },
      subject: makeSubjectMock(),
    } as unknown as PrismaClient;

    await provisionCanonicalClasses(mockPrisma, "TEST-SCHOOL", ["PRIMARY", "SECONDARY"]);
    expect(upsert.mock.calls).toHaveLength(13); // 7 + 6
  });

  it("throws when school code is not found", async () => {
    const mockPrisma = {
      school: { findUnique: vi.fn(async () => null) },
      schoolClass: { upsert: makeUpsertMock() },
      subject: makeSubjectMock(),
    } as unknown as PrismaClient;

    await expect(
      provisionCanonicalClasses(mockPrisma, "UNKNOWN", ["SECONDARY"]),
    ).rejects.toThrow("School not found: UNKNOWN");
  });
});

// ── repairSchoolClasses ───────────────────────────────────────────────────────

function makeTxMock(overrides: Record<string, unknown> = {}) {
  return {
    schoolClass: {
      findUnique: vi.fn(async () => null),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({ ...data, id: "new-s1" })),
      update: vi.fn(async () => ({})),
    },
    stream: {
      findMany: vi.fn(async () => []),
      findUnique: vi.fn(async () => null),
      update: vi.fn(async () => ({})),
      delete: vi.fn(async () => ({})),
    },
    classEnrollment: { updateMany: vi.fn(async () => ({ count: 0 })) },
    subjectMark: { updateMany: vi.fn(async () => ({ count: 0 })) },
    ...overrides,
  };
}

describe("repairSchoolClasses ? S1B migration", () => {
  it("migrates old S1B enrollments to canonical S1", async () => {
    const oldClass = { id: "old-s1b", code: "S1B", name: "Senior 1 B", schoolId: "school-1" };
    const tx = makeTxMock({
      stream: {
        findMany: vi.fn(async () => [
          { id: "stream-b", code: "B", name: "B", classId: "old-s1b", schoolId: "school-1" },
        ]),
        findUnique: vi.fn(async () => null),
        update: vi.fn(async () => ({})),
        delete: vi.fn(async () => ({})),
      },
      classEnrollment: { updateMany: vi.fn(async () => ({ count: 5 })) },
      subjectMark: { updateMany: vi.fn(async () => ({ count: 30 })) },
    });

    const mockPrisma = {
      school: makeSchoolMock("school-1"),
      schoolClass: {
        findMany: vi.fn(async () => [oldClass]),
        findUnique: vi.fn(async () => null),
        create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({ ...data, id: "new-s1" })),
        update: vi.fn(async () => ({})),
      },
      stream: { findMany: vi.fn(async () => []) },
      classEnrollment: { count: vi.fn(async () => 5) },
      subjectMark: { count: vi.fn(async () => 30) },
      $transaction: vi.fn(async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx)),
    } as unknown as PrismaClient;

    const result = await repairSchoolClasses(mockPrisma, "TEST-SCHOOL");

    // Enrollments migrated to the new canonical classId
    expect(tx.classEnrollment.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { classId: "new-s1" } }),
    );
    expect(result.enrollmentsMigrated).toBe(5);
  });

  it("migrates old S1B marks to canonical S1", async () => {
    const oldClass = { id: "old-s1b", code: "S1B", name: "Senior 1 B", schoolId: "school-1" };
    const tx = makeTxMock({
      stream: {
        findMany: vi.fn(async () => [
          { id: "stream-b", code: "B", name: "B", classId: "old-s1b", schoolId: "school-1" },
        ]),
        findUnique: vi.fn(async () => null),
        update: vi.fn(async () => ({})),
        delete: vi.fn(async () => ({})),
      },
      classEnrollment: { updateMany: vi.fn(async () => ({ count: 3 })) },
      subjectMark: { updateMany: vi.fn(async () => ({ count: 135 })) },
    });

    const mockPrisma = {
      school: makeSchoolMock("school-1"),
      schoolClass: {
        findMany: vi.fn(async () => [oldClass]),
        findUnique: vi.fn(async () => null),
        create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({ ...data, id: "new-s1" })),
        update: vi.fn(async () => ({})),
      },
      stream: { findMany: vi.fn(async () => []) },
      classEnrollment: { count: vi.fn(async () => 3) },
      subjectMark: { count: vi.fn(async () => 135) },
      $transaction: vi.fn(async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx)),
    } as unknown as PrismaClient;

    const result = await repairSchoolClasses(mockPrisma, "TEST-SCHOOL");

    // Marks migrated to canonical classId
    expect(tx.subjectMark.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { classId: "new-s1" } }),
    );
    expect(result.marksMigrated).toBe(135);
  });

  it("re-parents stream from S1B to canonical S1 when stream code has no collision", async () => {
    const oldClass = { id: "old-s1b", code: "S1B", name: "Senior 1 B", schoolId: "school-1" };
    const streamB = { id: "stream-b", code: "B", name: "B", classId: "old-s1b", schoolId: "school-1" };
    const tx = makeTxMock({
      stream: {
        findMany: vi.fn(async () => [streamB]),
        findUnique: vi.fn(async () => null), // no collision at canonical S1
        update: vi.fn(async () => ({})),
        delete: vi.fn(async () => ({})),
      },
      classEnrollment: { updateMany: vi.fn(async () => ({ count: 0 })) },
      subjectMark: { updateMany: vi.fn(async () => ({ count: 0 })) },
    });

    const mockPrisma = {
      school: makeSchoolMock("school-1"),
      schoolClass: {
        findMany: vi.fn(async () => [oldClass]),
        findUnique: vi.fn(async () => null),
        create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({ ...data, id: "new-s1" })),
        update: vi.fn(async () => ({})),
      },
      stream: { findMany: vi.fn(async () => [streamB]) },
      classEnrollment: { count: vi.fn(async () => 0) },
      subjectMark: { count: vi.fn(async () => 0) },
      $transaction: vi.fn(async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx)),
    } as unknown as PrismaClient;

    const result = await repairSchoolClasses(mockPrisma, "TEST-SCHOOL");

    expect(tx.stream.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { classId: "new-s1" } }),
    );
    expect(result.streamsReparented).toBe(1);
  });

  it("skips a bad class that cannot derive a canonical parent", async () => {
    const weirdClass = { id: "weird-1", code: "CUSTOM_CLASS", name: "Custom Class", schoolId: "school-1" };

    const mockPrisma = {
      school: makeSchoolMock("school-1"),
      schoolClass: {
        findMany: vi.fn(async () => [weirdClass]),
        findUnique: vi.fn(async () => null),
        create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => data),
        update: vi.fn(async () => ({})),
      },
      stream: { findMany: vi.fn(async () => []) },
      $transaction: vi.fn(async (fn: (t: unknown) => Promise<unknown>) => fn({})),
    } as unknown as PrismaClient;

    const result = await repairSchoolClasses(mockPrisma, "TEST-SCHOOL");

    expect(result.skipped.length).toBeGreaterThan(0);
    expect(result.skipped[0]).toContain("CUSTOM_CLASS");
    expect(result.classesRepaired).toBe(0);
  });
});

