import { AttendanceDirection, GateScanResult } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { getAttendanceDashboard, scanAttendance, getGateDashboard, scanGate } from "../../server/services/nfcOperationsService";

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
      enrollments: [{ class: { id: "class-a", name: "Senior 1" }, stream: { id: "stream-a", name: "A" } }],
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
    createdAt: new Date("2026-06-21T08:00:00.000Z"),
    updatedAt: new Date("2026-06-21T08:00:00.000Z"),
    updatedByUserId: null as string | null,
  };
  const gateScans = [
    {
      id: "gate-1",
      schoolId: "school-a",
      result: GateScanResult.ALLOWED,
      reason: null,
      scannedAt: new Date("2026-06-21T09:00:00.000Z"),
      student: students[0],
      credential: { status: "ACTIVE" as const },
    },
  ];

  const db = {
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn(db),
    schoolNfcPolicy: {
      upsert: async () => policy,
    },
    studentFeeHold: {
      findFirst: async () => null,
    },
    studentCredential: {
      findFirst: async ({ where }: { where: { schoolId?: string; OR: Array<{ scanToken?: string; credentialUID?: string }> } }) => {
        const matchesToken = where.OR.some((condition) => condition.scanToken === "token-a" || condition.credentialUID === "UID-A");
        if (!matchesToken) return null;
        if (where.schoolId && where.schoolId !== "school-a") return null;
        return {
          id: "credential-a",
          schoolId: "school-a",
          studentId: "student-a",
          type: "NFC_WRISTBAND",
          credentialUID: "UID-A",
          scanToken: "token-a",
          status: "ACTIVE",
          issuedAt: new Date("2026-06-21T08:00:00.000Z"),
          student: students[0],
        };
      },
    },
    nfcTag: {
      findFirst: async () => null,
    },
    nfcGateScan: {
      findMany: async () => gateScans,
      create: async ({ data }: { data: Record<string, unknown> }) => ({ ...data, id: "gate-2", scannedAt: new Date("2026-06-21T10:00:00.000Z") }),
    },
    studentAttendanceEvent: {
      findMany: async () => [],
      findFirst: async () => null,
      create: async ({ data }: { data: Record<string, unknown> }) => ({ ...data, id: "event-1", scannedAt: new Date("2026-06-21T10:00:00.000Z") }),
    },
    student: {
      findMany: async () => students,
    },
    auditLog: {
      create: vi.fn(async () => ({})),
    },
  };

  return { db: db as never };
}

describe("NFC gate operations", () => {
  it("lets GATE_SECURITY load the gate dashboard and scan gate tokens", async () => {
    const { db } = createDb();
    const ctx = { schoolId: "school-a", actorId: "gate-a", role: "GATE_SECURITY" as const };

    const dashboard = await getGateDashboard(ctx, db);
    const scan = await scanGate(ctx, { tokenOrUid: "token-a" }, db);

    expect(dashboard.recentScans).toHaveLength(1);
    expect(scan.result).toBe(GateScanResult.ALLOWED);
    expect(scan.credentialStatus).toBe("ACTIVE");
  });

  it("blocks GATE_SECURITY from attendance dashboard and attendance scans", async () => {
    const { db } = createDb();
    const ctx = { schoolId: "school-a", actorId: "gate-a", role: "GATE_SECURITY" as const };
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    await expect(getAttendanceDashboard(ctx, {}, db)).rejects.toMatchObject({ status: 403 });
    await expect(scanAttendance(ctx, { tokenOrUid: "token-a", direction: AttendanceDirection.TAP_IN }, db)).rejects.toMatchObject({ status: 403 });
    expect(warnSpy).toHaveBeenCalledWith(
      "[nfc-permission-denied]",
      expect.objectContaining({
        path: "GET /api/nfc/attendance",
        role: "GATE_SECURITY",
        requiredPermission: "nfc.devices.manage",
        actorId: "gate-a",
        schoolId: "school-a",
      }),
    );
    warnSpy.mockRestore();
  });

  it("still lets ADMIN_OPERATOR load the attendance dashboard", async () => {
    const { db } = createDb();
    const ctx = { schoolId: "school-a", actorId: "admin-a", role: "ADMIN_OPERATOR" as const };

    const dashboard = await getAttendanceDashboard(ctx, {}, db);

    expect(dashboard.summary.totalTappedIn).toBe(0);
    expect(dashboard.summary.notYetTapped).toBe(1);
  });

  it("returns specific gate-blocked reasons for wrong-school and unassigned tags", async () => {
    const tagDb = {
      $transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn(tagDb),
      studentFeeHold: {
        findFirst: async () => null,
      },
      studentCredential: {
        findFirst: async ({ where }: { where: { schoolId?: string; OR: Array<{ scanToken?: string; credentialUID?: string }> } }) => {
          const wantsWrongSchool = where.OR.some((condition) => condition.scanToken === "wrong-school" || condition.credentialUID === "wrong-school");
          if (!wantsWrongSchool) return null;
          if (where.schoolId) return null;
          return {
            id: "credential-x",
            schoolId: "school-b",
            studentId: "student-x",
            type: "NFC_WRISTBAND",
            credentialUID: "wrong-school",
            scanToken: "wrong-school",
            status: "ACTIVE",
            issuedAt: new Date("2026-06-21T08:00:00.000Z"),
            student: {
              id: "student-x",
              schoolId: "school-b",
              admissionNumber: "B-001",
              firstName: "Grace",
              lastName: "Hopper",
              studentType: "DAY",
              isActive: true,
              enrollments: [],
            },
          };
        },
      },
      nfcTag: {
        findFirst: async ({ where }: { where: { publicCode?: string; physicalUid?: { equals: string }; OR?: Array<{ publicCode?: string; physicalUid?: { equals: string } }> } }) => {
          const wantsUnassigned = where.publicCode === "unassigned" || where.OR?.some((condition) => condition.publicCode === "unassigned");
          if (wantsUnassigned) {
            return {
              id: "tag-1",
              schoolId: "school-a",
              publicCode: "unassigned",
              physicalUid: null,
              studentId: null,
              status: "REGISTERED",
              student: null,
            };
          }
          return null;
        },
      },
      nfcGateScan: {
        create: async ({ data }: { data: Record<string, unknown> }) => ({ ...data, id: "gate-x", scannedAt: new Date("2026-06-21T10:00:00.000Z") }),
      },
      studentAttendanceEvent: {
        findFirst: async () => null,
      },
      auditLog: {
        create: vi.fn(async () => ({})),
      },
    } as never;

    const wrongSchool = await scanGate({ schoolId: "school-a", actorId: "gate-a", role: "GATE_SECURITY" }, { tokenOrUid: "wrong-school" }, tagDb);
    const unassigned = await scanGate({ schoolId: "school-a", actorId: "gate-a", role: "GATE_SECURITY" }, { tokenOrUid: "unassigned" }, tagDb);

    expect(wrongSchool.reason).toBe("wrong school tag");
    expect(unassigned.reason).toBe("tag not assigned");
  });
});
