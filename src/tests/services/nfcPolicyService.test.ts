import { describe, expect, it } from "vitest";
import { scanGate } from "../../server/services/nfcOperationsService";
import { clearStudentFeeHold, createStudentFeeHold, updateSchoolNfcPolicy } from "../../server/services/nfcPolicyService";

const ADMIN_CTX = { schoolId: "school-a", actorId: "admin-a", role: "ADMIN_OPERATOR" as const };
const CASHIER_CTX = { schoolId: "school-a", actorId: "cashier-a", role: "CASHIER" as const };
const SECURITY_CTX = { schoolId: "school-a", actorId: "security-a", role: "SECURITY" as const };

function createDb() {
  const students = [
    {
      id: "student-a",
      schoolId: "school-a",
      admissionNumber: "A-001",
      firstName: "Ada",
      lastName: "Lovelace",
      studentType: "DAY" as const,
      isActive: true,
      enrollments: [{ class: { name: "Senior 1" }, stream: { name: "A" } }],
    },
  ];
  const policy = {
    id: "policy-a",
    schoolId: "school-a",
    feeDefaulterBlockingEnabled: false,
    feeDefaulterBlockScope: "DAY_SCHOLARS_ONLY" as const,
    attendanceTapInCutoffEnabled: false,
    tapInCutoffTime: null as string | null,
    cutoffLateAction: "BLOCK_AND_MARK_ABSENT" as const,
    timezone: "Africa/Kampala",
    gateOfflineEnabled: false,
    canteenOfflineEnabled: false,
    gateSnapshotValidHours: 24,
    canteenSnapshotValidHours: 12,
    maxOfflineSpendPerStudentPerDay: 5000,
    maxOfflineSpendPerTransaction: 2000,
    maxOfflineSpendPerDeviceSession: 100000,
    unknownCardOfflinePolicy: "DENY",
    frozenCardOfflinePolicy: "DENY",
    deactivatedCardOfflinePolicy: "DENY",
    offlineConflictPolicy: "ALLOW_AND_FLAG",
    updatedByUserId: null as string | null,
    createdAt: new Date("2026-06-21T08:00:00.000Z"),
    updatedAt: new Date("2026-06-21T08:00:00.000Z"),
  };
  const feeHolds: Array<{
    id: string;
    schoolId: string;
    studentId: string;
    status: "ACTIVE" | "CLEARED" | "CANCELLED";
    reason: string | null;
    balanceDueCents: number | null;
    effectiveFrom: Date | null;
    clearedAt: Date | null;
    createdByUserId: string | null;
    clearedByUserId: string | null;
    createdAt: Date;
    updatedAt: Date;
    student?: (typeof students)[number] | null;
  }> = [];
  const campusMovementEvents: Array<Record<string, unknown>> = [];
  const dailyAttendanceRows: Array<Record<string, unknown>> = [];

  const db = {
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn(db),
    schoolNfcPolicy: {
      upsert: async ({ create, update }: { create: Record<string, unknown>; update: Record<string, unknown> }) => {
        Object.assign(policy, create, update);
        return policy;
      },
    },
    student: {
      findFirst: async ({ where }: { where: { id: string; schoolId: string } }) =>
        students.find((student) => student.id === where.id && student.schoolId === where.schoolId) ?? null,
      findMany: async ({ where }: { where: { schoolId: string } }) => students.filter((student) => student.schoolId === where.schoolId),
    },
    studentFeeHold: {
      findFirst: async ({ where }: { where: { id?: string; schoolId: string; studentId?: string; status?: string } }) =>
        feeHolds.find((hold) => {
          if (hold.schoolId !== where.schoolId) return false;
          if (where.id && hold.id !== where.id) return false;
          if (where.studentId && hold.studentId !== where.studentId) return false;
          if (where.status && hold.status !== where.status) return false;
          return true;
        }) ?? null,
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const student = students.find((item) => item.id === String(data.studentId));
        const hold = {
          id: `hold-${feeHolds.length + 1}`,
          schoolId: String(data.schoolId),
          studentId: String(data.studentId),
          status: "ACTIVE" as const,
          reason: (data.reason as string | null) ?? null,
          balanceDueCents: (data.balanceDueCents as number | null) ?? null,
          effectiveFrom: (data.effectiveFrom as Date | null) ?? null,
          clearedAt: null,
          createdByUserId: (data.createdByUserId as string | null) ?? null,
          clearedByUserId: null,
          createdAt: new Date("2026-06-21T09:00:00.000Z"),
          updatedAt: new Date("2026-06-21T09:00:00.000Z"),
          student,
        };
        feeHolds.push(hold);
        return hold;
      },
      update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const hold = feeHolds.find((item) => item.id === where.id);
        if (!hold) throw new Error("hold missing");
        Object.assign(hold, data, { updatedAt: new Date("2026-06-21T10:00:00.000Z") });
        hold.student = students.find((item) => item.id === hold.studentId);
        return hold;
      },
    },
    studentCredential: {
      findFirst: async ({ where }: { where: { schoolId: string; scanToken?: string; credentialUID?: string; OR?: Array<{ scanToken?: string; credentialUID?: string }> } }) =>
        where.schoolId === "school-a"
        && (
          where.scanToken === "token-a"
          || where.credentialUID === "UID-A"
          || where.OR?.some((condition) => condition.scanToken === "token-a" || condition.credentialUID === "UID-A")
        )
          ? {
              id: "credential-a",
              schoolId: "school-a",
              studentId: "student-a",
              type: "NFC_WRISTBAND",
              credentialUID: "UID-A",
              scanToken: "token-a",
              status: "ACTIVE",
              issuedAt: new Date("2026-06-21T08:00:00.000Z"),
              student: students[0],
            }
          : null,
    },
    nfcTag: {
      findFirst: async () => null,
    },
    nfcGateScan: {
      create: async ({ data }: { data: Record<string, unknown> }) => ({ ...data, id: "gate-1", scannedAt: new Date("2026-06-21T10:00:00.000Z") }),
    },
    campusMovementEvent: {
      findFirst: async () => campusMovementEvents.length > 0 ? campusMovementEvents[campusMovementEvents.length - 1] : null,
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const row = { id: `move-${campusMovementEvents.length + 1}`, ...data };
        campusMovementEvents.push(row);
        return row;
      },
    },
    studentPassOut: {
      findFirst: async () => null,
      update: async ({ data }: { data: Record<string, unknown> }) => data,
    },
    studentAttendanceEvent: {
      findFirst: async () => null,
    },
    dailyAttendance: {
      upsert: async ({ create, update }: { create: Record<string, unknown>; update: Record<string, unknown> }) => {
        const row = { ...create, ...update };
        dailyAttendanceRows.push(row);
        return row;
      },
    },
    auditLog: {
      create: async () => ({}),
    },
  };

  return { db: db as never, feeHolds, policy };
}

describe("NFC policy and fee holds", () => {
  it("lets ADMIN_OPERATOR update policy", async () => {
    const { db, policy } = createDb();
    const result = await updateSchoolNfcPolicy(ADMIN_CTX, {
      feeDefaulterBlockingEnabled: true,
      feeDefaulterBlockScope: "ALL_STUDENTS",
      attendanceTapInCutoffEnabled: true,
      tapInCutoffTime: "08:00",
      cutoffLateAction: "ALLOW_BUT_MARK_LATE",
      timezone: "Africa/Kampala",
      gateOfflineEnabled: true,
      canteenOfflineEnabled: true,
      gateSnapshotValidHours: 24,
      canteenSnapshotValidHours: 12,
      maxOfflineSpendPerStudentPerDay: 5000,
      maxOfflineSpendPerTransaction: 2000,
      maxOfflineSpendPerDeviceSession: 100000,
      unknownCardOfflinePolicy: "DENY",
      frozenCardOfflinePolicy: "DENY",
      deactivatedCardOfflinePolicy: "DENY",
      offlineConflictPolicy: "ALLOW_AND_FLAG",
    }, db);

    expect(result.policy.feeDefaulterBlockingEnabled).toBe(true);
    expect(policy.feeDefaulterBlockScope).toBe("ALL_STUDENTS");
  });

  it("rejects SECURITY from updating policy", async () => {
    const { db } = createDb();
    await expect(updateSchoolNfcPolicy(SECURITY_CTX, {
      feeDefaulterBlockingEnabled: true,
      feeDefaulterBlockScope: "DAY_SCHOLARS_ONLY",
      attendanceTapInCutoffEnabled: false,
      tapInCutoffTime: null,
      cutoffLateAction: "BLOCK_AND_MARK_ABSENT",
      timezone: "Africa/Kampala",
      gateOfflineEnabled: false,
      canteenOfflineEnabled: false,
      gateSnapshotValidHours: 24,
      canteenSnapshotValidHours: 12,
      maxOfflineSpendPerStudentPerDay: 5000,
      maxOfflineSpendPerTransaction: 2000,
      maxOfflineSpendPerDeviceSession: 100000,
      unknownCardOfflinePolicy: "DENY",
      frozenCardOfflinePolicy: "DENY",
      deactivatedCardOfflinePolicy: "DENY",
      offlineConflictPolicy: "ALLOW_AND_FLAG",
    }, db)).rejects.toMatchObject({ status: 403 });
  });

  it("rejects invalid timezone values", async () => {
    const { db } = createDb();
    await expect(updateSchoolNfcPolicy(ADMIN_CTX, {
      feeDefaulterBlockingEnabled: true,
      feeDefaulterBlockScope: "DAY_SCHOLARS_ONLY",
      attendanceTapInCutoffEnabled: false,
      tapInCutoffTime: null,
      cutoffLateAction: "BLOCK_AND_MARK_ABSENT",
      timezone: "Mars/Phobos",
      gateOfflineEnabled: true,
      canteenOfflineEnabled: true,
      gateSnapshotValidHours: 24,
      canteenSnapshotValidHours: 12,
      maxOfflineSpendPerStudentPerDay: 5000,
      maxOfflineSpendPerTransaction: 2000,
      maxOfflineSpendPerDeviceSession: 100000,
      unknownCardOfflinePolicy: "DENY",
      frozenCardOfflinePolicy: "DENY",
      deactivatedCardOfflinePolicy: "DENY",
      offlineConflictPolicy: "ALLOW_AND_FLAG",
    }, db)).rejects.toMatchObject({ status: 400 });
  });

  it("lets CASHIER create and clear fee holds", async () => {
    const { db, feeHolds } = createDb();
    const created = await createStudentFeeHold(CASHIER_CTX, {
      studentId: "student-a",
      reason: "Fees overdue",
      balanceDueCents: 120000,
      effectiveFrom: "2026-06-21",
    }, db);
    expect(created.feeHold.status).toBe("ACTIVE");
    expect(feeHolds).toHaveLength(1);

    const cleared = await clearStudentFeeHold(CASHIER_CTX, created.feeHold.id, "Parent paid", db);
    expect(cleared.feeHold.status).toBe("CLEARED");
    expect(feeHolds[0]?.status).toBe("CLEARED");
  });

  it("clear stops future blocking", async () => {
    const { db } = createDb();
    await updateSchoolNfcPolicy(ADMIN_CTX, {
      feeDefaulterBlockingEnabled: true,
      feeDefaulterBlockScope: "DAY_SCHOLARS_ONLY",
      attendanceTapInCutoffEnabled: false,
      tapInCutoffTime: null,
      cutoffLateAction: "BLOCK_AND_MARK_ABSENT",
      timezone: "Africa/Kampala",
      gateOfflineEnabled: true,
      canteenOfflineEnabled: true,
      gateSnapshotValidHours: 24,
      canteenSnapshotValidHours: 12,
      maxOfflineSpendPerStudentPerDay: 5000,
      maxOfflineSpendPerTransaction: 2000,
      maxOfflineSpendPerDeviceSession: 100000,
      unknownCardOfflinePolicy: "DENY",
      frozenCardOfflinePolicy: "DENY",
      deactivatedCardOfflinePolicy: "DENY",
      offlineConflictPolicy: "ALLOW_AND_FLAG",
    }, db);
    const created = await createStudentFeeHold(CASHIER_CTX, { studentId: "student-a", reason: "Fees overdue" }, db);

    const blocked = await scanGate({ schoolId: "school-a", actorId: "security-a", role: "SECURITY" }, { tokenOrUid: "token-a" }, db);
    expect(blocked.result).toBe("BLOCKED");

    await clearStudentFeeHold(CASHIER_CTX, created.feeHold.id, "Paid", db);
    const allowed = await scanGate({ schoolId: "school-a", actorId: "security-a", role: "SECURITY" }, { tokenOrUid: "token-a" }, db);
    expect(allowed.result).toBe("ALLOWED");
  });
});
