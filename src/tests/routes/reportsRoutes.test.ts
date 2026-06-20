import { describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { loadReportEngineInput } from "../../server/repositories/reportsRepository";

const SCHOOL_CODE = "SCU-PREVIEW";
const SCHOOL_ID = "school-1";
const CLS = "aaaaaaaa-0000-0000-0000-000000000001";

function makePrisma(subjectMarkFindMany: ReturnType<typeof vi.fn>) {
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
    schoolClass: { findUnique: vi.fn(async () => ({ id: CLS, name: "Senior 1", code: "S1" })) },
    classEnrollment: { findMany: vi.fn(async () => []) },
    subjectMark: { findMany: subjectMarkFindMany },
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
});

