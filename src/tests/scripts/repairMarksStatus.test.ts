import { describe, expect, it, vi } from "vitest";
import { repairMarksStatus } from "../../../scripts/repair-marks-status";
import { DESTRUCTIVE_CONFIRMATION_TOKEN } from "../../server/utils/productionSafety";
import type { PrismaClient } from "@prisma/client";

const SCHOOL_ID = "sch-repair-1";
const MARK_ID_1 = "mark-1";
const MARK_ID_2 = "mark-2";

const stuckMark = {
  id: MARK_ID_1,
  studentId: "stu-1",
  subjectId: "sub-1",
  assessmentType: "EOT",
  marks: 75,
  createdAt: new Date(Date.now() - 48 * 60 * 60 * 1000),
};

function buildMock(stuckMarks: typeof stuckMark[] = [stuckMark]) {
  const updateMany = vi.fn(async () => ({ count: stuckMarks.length }));
  return {
    db: {
      school: { findUnique: vi.fn(async () => ({ id: SCHOOL_ID, code: "REPSCH" })) },
      subjectMark: {
        findMany: vi.fn(async () => stuckMarks),
        updateMany,
      },
    } as unknown as PrismaClient,
    updateMany,
  };
}

function allowDestructiveTestRepair() {
  vi.stubEnv("ALLOW_DESTRUCTIVE_OPERATIONS", "true");
  vi.stubEnv("CONFIRM_DESTRUCTIVE_OPERATION", DESTRUCTIVE_CONFIRMATION_TOKEN);
}

describe("repairMarksStatus dry-run mode", () => {
  it("returns wouldRepair count but does NOT call updateMany", async () => {
    const { db, updateMany } = buildMock();

    const result = await repairMarksStatus({ dryRun: true, schoolCode: "REPSCH", limit: 100, db });

    expect(result.dryRun).toBe(true);
    expect(result.repaired).toBe(0);
    expect((result as { wouldRepair?: number }).wouldRepair).toBe(1);
    expect(updateMany).not.toHaveBeenCalled();
  });

  it("dry-run with no stuck marks reports zero and still does not write", async () => {
    const { db, updateMany } = buildMock([]);

    const result = await repairMarksStatus({ dryRun: true, schoolCode: "REPSCH", limit: 100, db });

    expect(result.repaired).toBe(0);
    expect(updateMany).not.toHaveBeenCalled();
  });
});

describe("repairMarksStatus live mode", () => {
  it("calls updateMany with the stuck mark IDs when dryRun is false", async () => {
    allowDestructiveTestRepair();
    const { db, updateMany } = buildMock();

    const result = await repairMarksStatus({ dryRun: false, schoolCode: "REPSCH", limit: 100, db });

    expect(result.repaired).toBe(1);
    expect(result.dryRun).toBe(false);
    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: { in: [MARK_ID_1] } }),
        data: { status: "FINALIZED" },
      }),
    );
  });

  it("repairs multiple stuck marks in a single updateMany call", async () => {
    allowDestructiveTestRepair();
    const mark2 = { ...stuckMark, id: MARK_ID_2 };
    const { db, updateMany } = buildMock([stuckMark, mark2]);

    const result = await repairMarksStatus({ dryRun: false, schoolCode: "REPSCH", limit: 100, db });

    expect(result.repaired).toBe(2);
    expect(updateMany).toHaveBeenCalledTimes(1);
    const callArgs = updateMany.mock.calls[0]?.[0] as { where: { id: { in: string[] } } };
    expect(callArgs.where.id.in).toContain(MARK_ID_1);
    expect(callArgs.where.id.in).toContain(MARK_ID_2);
  });
});

describe("repairMarksStatus school not found", () => {
  it("returns repaired=0 and does not call updateMany when school is missing", async () => {
    const updateMany = vi.fn();
    const db = {
      school: { findUnique: vi.fn(async () => null) },
      subjectMark: { updateMany },
    } as unknown as PrismaClient;

    const result = await repairMarksStatus({ dryRun: false, schoolCode: "NOSCHOOL", limit: 100, db });

    expect(result.repaired).toBe(0);
    expect(updateMany).not.toHaveBeenCalled();
  });
});
