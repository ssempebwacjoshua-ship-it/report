import { AttendanceDirection, GateScanResult } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

const { notifyParentStudentPassOutMock } = vi.hoisted(() => ({
  notifyParentStudentPassOutMock: vi.fn(async () => ({ submitted: 1, failed: 0, skipped: 0 })),
}));

vi.mock("../../server/services/nfcPassOutNotificationService", () => ({
  notifyParentStudentPassOut: notifyParentStudentPassOutMock,
}));

import { getAttendanceDashboard, getGateAdminDashboard, scanAttendance, getGateDashboard, scanGate } from "../../server/services/nfcOperationsService";

const GATE_CTX = { schoolId: "school-a", actorId: "gate-a", role: "GATE_SECURITY" as const };

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
  const dailyAttendances: Array<Record<string, unknown>> = [];
  const campusMovementEvents: Array<Record<string, unknown>> = [];
  const studentPassOuts: Array<Record<string, unknown>> = [];
  const visitorVisits: Array<Record<string, unknown>> = [];
  const failedDeliveries: Array<Record<string, unknown>> = [];

  const db = {
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn(db),
    schoolNfcPolicy: {
      upsert: async () => policy,
    },
    studentFeeHold: {
      findFirst: async () => null,
    },
    studentCredential: {
      findFirst: async ({ where }: { where: { schoolId?: string; scanToken?: string; credentialUID?: string; OR?: Array<{ scanToken?: string; credentialUID?: string }> } }) => {
        const matchesToken = where.scanToken === "token-a"
          || where.credentialUID === "UID-A"
          || where.credentialUID === "12-1"
          || Boolean(where.OR?.some((condition) =>
            condition.scanToken === "token-a"
            || condition.credentialUID === "UID-A"
            || condition.credentialUID === "12-1"));
        if (!matchesToken) return null;
        if (where.schoolId && where.schoolId !== "school-a") return null;
        return {
          id: "credential-a",
          schoolId: "school-a",
          studentId: "student-a",
          type: "NFC_WRISTBAND",
          credentialUID: where.credentialUID === "12-1" ? "12-1" : "UID-A",
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
    dailyAttendance: {
      upsert: async ({ create }: { create: Record<string, unknown> }) => {
        const row = { id: `daily-${dailyAttendances.length + 1}`, ...create };
        dailyAttendances.push(row);
        return row;
      },
    },
    campusMovementEvent: {
      findFirst: async () => campusMovementEvents.length > 0 ? campusMovementEvents[campusMovementEvents.length - 1] : null,
      findMany: async () => campusMovementEvents,
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const row = { id: `move-${campusMovementEvents.length + 1}`, ...data };
        campusMovementEvents.push(row);
        return row;
      },
    },
    studentPassOut: {
      count: async ({ where }: { where: Record<string, any> }) => studentPassOuts.filter((row) => {
        if (row.schoolId !== where.schoolId) return false;
        if (where.status?.in && !where.status.in.includes(row.status)) return false;
        if (typeof where.status === "string" && row.status !== where.status) return false;
        if (where.activeFrom?.lte && row.activeFrom > where.activeFrom.lte) return false;
        if (where.activeUntil?.gte && row.activeUntil < where.activeUntil.gte) return false;
        return true;
      }).length,
      findFirst: async ({ where }: { where: Record<string, any> }) => {
        if (where?.studentId) {
          return studentPassOuts.find((row) => {
            const statuses = where.status?.in as string[] | undefined;
            const activeFromLte = where.activeFrom?.lte as Date | undefined;
            const activeUntilGte = where.activeUntil?.gte as Date | undefined;
            return row.studentId === where.studentId
              && row.schoolId === where.schoolId
              && (!statuses || statuses.includes(String(row.status)))
              && (!where.cancelledAt || row.cancelledAt === null)
              && (!activeFromLte || row.activeFrom <= activeFromLte)
              && (!activeUntilGte || row.activeUntil >= activeUntilGte);
          }) ?? null;
        }
        return studentPassOuts[studentPassOuts.length - 1] ?? null;
      },
      findMany: async ({ where, take }: { where: Record<string, any>; take?: number }) => {
        const statuses = where.status?.in as string[] | undefined;
        const activeFromLte = where.activeFrom?.lte as Date | undefined;
        const activeUntilGte = where.activeUntil?.gte as Date | undefined;
        return studentPassOuts
          .filter((row) => row.studentId === where.studentId
            && row.schoolId === where.schoolId
            && (!statuses || statuses.includes(String(row.status)))
            && (!where.cancelledAt || row.cancelledAt === null)
            && (!activeFromLte || row.activeFrom <= activeFromLte)
            && (!activeUntilGte || row.activeUntil >= activeUntilGte))
          .sort((a, b) => Number(b.createdAt ?? 0) - Number(a.createdAt ?? 0))
          .slice(0, take ?? undefined);
      },
      update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const index = studentPassOuts.findIndex((row) => row.id === where.id);
        const updated = { ...studentPassOuts[index], ...data };
        studentPassOuts[index] = updated;
        return updated;
      },
    },
    visitorVisit: {
      count: async ({ where }: { where: Record<string, any> }) => visitorVisits.filter((row) => row.schoolId === where.schoolId && row.status === where.status && row.checkedOutAt === where.checkedOutAt).length,
      findMany: async () => visitorVisits,
    },
    communicationDelivery: {
      count: async ({ where }: { where: Record<string, any> }) => failedDeliveries.filter((row) => row.schoolId === where.schoolId && row.channel === where.channel && row.status === where.status).length,
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

  return { db: db as never, dailyAttendances, campusMovementEvents, studentPassOuts, visitorVisits, failedDeliveries, students, policy };
}

describe("NFC gate operations", () => {
  it("lets GATE_SECURITY load the gate dashboard and scan gate tokens", async () => {
    notifyParentStudentPassOutMock.mockClear();
    const { db, dailyAttendances, campusMovementEvents } = createDb();
    const ctx = GATE_CTX;

    const dashboard = await getGateDashboard(ctx, db);
    const scan = await scanGate(ctx, {
      tokenOrUid: "token-a",
      deviceId: "11111111-1111-1111-1111-111111111111",
      idempotencyKey: "gate-live-1",
    }, db);

    expect(dashboard.recentScans).toHaveLength(1);
    expect(scan.result).toBe(GateScanResult.ALLOWED);
    expect(scan.credentialStatus).toBe("ACTIVE");
    expect(dailyAttendances).toHaveLength(1);
    expect(dailyAttendances[0]).toMatchObject({
      schoolId: "school-a",
      studentId: "student-a",
      status: "PRESENT",
      source: "GATE_PWA",
    });
    expect(campusMovementEvents).toHaveLength(1);
    expect(campusMovementEvents[0]).toMatchObject({
      schoolId: "school-a",
      studentId: "student-a",
      readerId: "11111111-1111-1111-1111-111111111111",
      type: "GATE_ENTRY",
      eventId: "gate-live-1",
    });
    expect(notifyParentStudentPassOutMock).not.toHaveBeenCalled();
  });

  it("keeps the old live gate path working with direct credential UID lookups", async () => {
    const { db } = createDb();
    const ctx = GATE_CTX;

    const scan = await scanGate(ctx, {
      tokenOrUid: "12-1",
      deviceId: "11111111-1111-1111-1111-111111111111",
      idempotencyKey: "gate-live-w26-1",
    }, db);

    expect(scan.result).toBe(GateScanResult.ALLOWED);
    expect(scan.student?.id).toBe("student-a");
    expect(scan.credentialStatus).toBe("ACTIVE");
  });

  it("checks a student out when an active approved pass-out exists and the student is on campus", async () => {
    notifyParentStudentPassOutMock.mockClear();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-18T10:30:00.000Z"));
    try {
      const { db, campusMovementEvents, studentPassOuts } = createDb();
      studentPassOuts.push({
        id: "passout-1",
        schoolId: "school-a",
        studentId: "student-a",
        status: "APPROVED",
        activeFrom: new Date("2026-07-18T00:00:00.000Z"),
        activeUntil: new Date("2026-07-18T23:59:59.000Z"),
        checkedOutAt: null,
        checkedInAt: null,
        cancelledAt: null,
        createdAt: new Date("2026-07-18T08:00:00.000Z"),
      });
      campusMovementEvents.push({
        id: "move-entry-1",
        schoolId: "school-a",
        studentId: "student-a",
        readerId: "reader-a",
        type: "GATE_ENTRY",
        occurredAt: new Date("2026-07-18T07:00:00.000Z"),
      });

      const scan = await scanGate(GATE_CTX, {
        tokenOrUid: "token-a",
        deviceId: "11111111-1111-1111-1111-111111111111",
        idempotencyKey: "passout-checkout-1",
      }, db);

      expect(scan.result).toBe(GateScanResult.ALLOWED);
      expect(scan.passOutAction).toBe("CHECKED_OUT");
      expect(scan.passOutId).toBe("passout-1");
      expect(scan.parentSmsStatus).toBe("QUEUED");
      expect(campusMovementEvents.at(-1)).toMatchObject({
        type: "PASS_OUT_CHECKOUT",
        metadata: expect.objectContaining({
          passOutId: "passout-1",
          passOutAction: "CHECK_OUT",
        }),
      });
      expect(studentPassOuts[0]).toMatchObject({
        status: "CHECKED_OUT",
        checkoutMovementEventId: "move-2",
      });
      expect(notifyParentStudentPassOutMock).toHaveBeenCalledWith(
        expect.objectContaining({ schoolId: "school-a", actorId: "gate-a" }),
        expect.objectContaining({
          studentId: "student-a",
          passOutId: "passout-1",
          movementEventId: "move-2",
          event: "CHECK_OUT",
        }),
        db,
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it("checks a student back in when an active checked-out pass-out exists and the student is off campus", async () => {
    notifyParentStudentPassOutMock.mockClear();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-18T10:30:00.000Z"));
    try {
      const { db, campusMovementEvents, studentPassOuts, dailyAttendances } = createDb();
      studentPassOuts.push({
        id: "passout-1",
        schoolId: "school-a",
        studentId: "student-a",
        status: "CHECKED_OUT",
        activeFrom: new Date("2026-07-18T00:00:00.000Z"),
        activeUntil: new Date("2026-07-18T23:59:59.000Z"),
        checkedOutAt: new Date("2026-07-18T09:00:00.000Z"),
        checkedInAt: null,
        cancelledAt: null,
        createdAt: new Date("2026-07-18T08:00:00.000Z"),
      });
      campusMovementEvents.push({
        id: "move-exit-1",
        schoolId: "school-a",
        studentId: "student-a",
        readerId: "reader-a",
        type: "GATE_EXIT",
        occurredAt: new Date("2026-07-18T09:00:00.000Z"),
      });

      const scan = await scanGate(GATE_CTX, {
        tokenOrUid: "token-a",
        deviceId: "11111111-1111-1111-1111-111111111111",
        idempotencyKey: "passout-return-1",
      }, db);

      expect(scan.result).toBe(GateScanResult.ALLOWED);
      expect(scan.passOutAction).toBe("CHECKED_IN");
      expect(scan.passOutId).toBe("passout-1");
      expect(scan.parentSmsStatus).toBe("QUEUED");
      expect(campusMovementEvents.at(-1)).toMatchObject({
        type: "PASS_OUT_CHECKIN",
        metadata: expect.objectContaining({
          passOutId: "passout-1",
          passOutAction: "CHECK_IN",
        }),
      });
      expect(studentPassOuts[0]).toMatchObject({
        status: "RETURNED",
        checkinMovementEventId: "move-2",
      });
      expect(dailyAttendances).toHaveLength(1);
      expect(notifyParentStudentPassOutMock).toHaveBeenCalledWith(
        expect.objectContaining({ schoolId: "school-a", actorId: "gate-a" }),
        expect.objectContaining({
          studentId: "student-a",
          passOutId: "passout-1",
          movementEventId: "move-2",
          event: "CHECK_IN",
        }),
        db,
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not check out an expired pass-out and keeps normal gate behavior", async () => {
    notifyParentStudentPassOutMock.mockClear();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-18T10:30:00.000Z"));
    try {
      const { db, campusMovementEvents, studentPassOuts } = createDb();
      studentPassOuts.push({
        id: "passout-expired",
        schoolId: "school-a",
        studentId: "student-a",
        status: "APPROVED",
        activeFrom: new Date("2026-07-18T07:00:00.000Z"),
        activeUntil: new Date("2026-07-18T08:00:00.000Z"),
        checkedOutAt: null,
        checkedInAt: null,
        cancelledAt: null,
        createdAt: new Date("2026-07-18T06:00:00.000Z"),
      });

      const scan = await scanGate(GATE_CTX, {
        tokenOrUid: "token-a",
        deviceId: "11111111-1111-1111-1111-111111111111",
        idempotencyKey: "expired-passout-1",
      }, db);

      expect(scan.result).toBe(GateScanResult.ALLOWED);
      expect(scan.passOutAction).toBeNull();
      expect(studentPassOuts[0]).toMatchObject({ status: "APPROVED", checkedOutAt: null });
      expect(campusMovementEvents.at(-1)).toMatchObject({ type: "GATE_ENTRY" });
      expect(notifyParentStudentPassOutMock).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps the gate scan successful when pass-out SMS notification fails", async () => {
    notifyParentStudentPassOutMock.mockRejectedValueOnce(new Error("SMS provider down"));
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-18T10:30:00.000Z"));
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const { db, studentPassOuts } = createDb();
      studentPassOuts.push({
        id: "passout-1",
        schoolId: "school-a",
        studentId: "student-a",
        status: "APPROVED",
        activeFrom: new Date("2026-07-18T00:00:00.000Z"),
        activeUntil: new Date("2026-07-18T23:59:59.000Z"),
        checkedOutAt: null,
        checkedInAt: null,
        cancelledAt: null,
        createdAt: new Date("2026-07-18T08:00:00.000Z"),
      });

      const scan = await scanGate(GATE_CTX, {
        tokenOrUid: "token-a",
        deviceId: "11111111-1111-1111-1111-111111111111",
        idempotencyKey: "passout-sms-failure-1",
      }, db);

      expect(scan.result).toBe(GateScanResult.ALLOWED);
      expect(scan.passOutAction).toBe("CHECKED_OUT");
      expect(scan.parentSmsStatus).toBe("FAILED");
      expect(studentPassOuts[0]).toMatchObject({ status: "CHECKED_OUT" });
      expect(warnSpy).toHaveBeenCalledWith("[nfc-passout-notification]", expect.objectContaining({
        passOutId: "passout-1",
        message: "SMS provider down",
      }));
    } finally {
      warnSpy.mockRestore();
      vi.useRealTimers();
    }
  });

  it("blocks GATE_SECURITY from the admin attendance dashboard but allows explicit attendance operation scans", async () => {
    const { db } = createDb();
    const ctx = { schoolId: "school-a", actorId: "gate-a", role: "GATE_SECURITY" as const };
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    await expect(getAttendanceDashboard(ctx, {}, db)).rejects.toMatchObject({ status: 403 });
    const scan = await scanAttendance(ctx, { tokenOrUid: "token-a", direction: AttendanceDirection.TAP_IN }, db);
    expect(scan.scan.status).toBe("VALID");
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

  it("builds an admin gate dashboard with tenant-scoped summaries and activity", async () => {
    const { db, campusMovementEvents, studentPassOuts, visitorVisits, failedDeliveries, students } = createDb();
    studentPassOuts.push(
      {
        id: "passout-1",
        schoolId: "school-a",
        studentId: "student-a",
        status: "APPROVED",
        activeFrom: new Date("2026-07-18T00:00:00.000Z"),
        activeUntil: new Date("2026-07-18T23:59:59.000Z"),
      },
      {
        id: "passout-2",
        schoolId: "school-a",
        studentId: "student-a",
        status: "CHECKED_OUT",
        activeFrom: new Date("2026-07-18T00:00:00.000Z"),
        activeUntil: new Date("2026-07-18T23:59:59.000Z"),
      },
    );
    campusMovementEvents.push({
      id: "move-1",
      schoolId: "school-a",
      studentId: "student-a",
      type: "GATE_EXIT",
      occurredAt: new Date("2026-07-18T08:45:00.000Z"),
      metadata: { passOutAction: "CHECK_OUT" },
      student: students[0],
    });
    visitorVisits.push({
      id: "visit-1",
      schoolId: "school-a",
      status: "CHECKED_IN",
      hostName: "Bursar",
      checkedInAt: new Date("2026-07-18T08:10:00.000Z"),
      checkedOutAt: null,
      visitor: { fullName: "Mary Nakiwala", phone: "256700000001" },
    });
    failedDeliveries.push({
      id: "delivery-1",
      schoolId: "school-a",
      channel: "SMS",
      status: "FAILED",
    });

    const dashboard = await getGateAdminDashboard({ schoolId: "school-a", actorId: "admin-a", role: "ADMIN_OPERATOR" }, db);

    expect(dashboard.summary).toMatchObject({
      activePassOuts: 2,
      studentsCurrentlyOut: 1,
      visitorsCurrentlyInside: 1,
      failedParentSms: 1,
    });
    expect(dashboard.activity[0]).toMatchObject({
      type: "PASS_OUT_CHECKOUT",
      summary: "Ada Lovelace",
    });
    expect(dashboard.activity.some((row) => row.type === "VISITOR_CHECKIN")).toBe(true);
  });

  it("returns specific gate-blocked reasons for wrong-school and unassigned tags", async () => {
    const { students, policy } = createDb();
    const blockedMovements: Array<Record<string, unknown>> = [];
    const tagDb = {
      $transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn(tagDb),
      schoolNfcPolicy: {
        upsert: async () => policy,
      },
      studentFeeHold: {
        findFirst: async () => null,
      },
      studentCredential: {
        findFirst: async ({ where }: { where: { schoolId?: string; scanToken?: string; credentialUID?: string; OR?: Array<{ scanToken?: string; credentialUID?: string }> } }) => {
          const wantsWrongSchool = where.scanToken === "wrong-school"
            || where.credentialUID === "wrong-school"
            || Boolean(where.OR?.some((condition) => condition.scanToken === "wrong-school" || condition.credentialUID === "wrong-school"));
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
          const wantsUnassigned = where.publicCode === "unassigned"
            || where.physicalUid?.equals === "unassigned"
            || where.OR?.some((condition) => condition.publicCode === "unassigned" || condition.physicalUid?.equals === "unassigned");
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
      dailyAttendance: {
        upsert: vi.fn(),
      },
      campusMovementEvent: {
        findFirst: async () => null,
        create: async ({ data }: { data: Record<string, unknown> }) => {
          blockedMovements.push(data);
          return { id: `move-${blockedMovements.length}`, ...data };
        },
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
    expect(blockedMovements).toHaveLength(0);
  });
});
