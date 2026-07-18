import { AttendanceDirection, AttendanceScanStatus, CredentialStatus, CredentialType, GateScanResult } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { getAttendanceDashboard, getAttendanceRegister, scanAttendance, scanGate } from "../../server/services/nfcOperationsService";

function createDb(options: {
  studentType?: "DAY" | "BOARDING";
  feeHoldStatus?: "ACTIVE" | "CLEARED" | "CANCELLED";
  feeDefaulterBlockingEnabled?: boolean;
  feeDefaulterBlockScope?: "DAY_SCHOLARS_ONLY" | "ALL_STUDENTS";
  attendanceTapInCutoffEnabled?: boolean;
  tapInCutoffTime?: string | null;
  cutoffLateAction?: "BLOCK_AND_MARK_ABSENT" | "ALLOW_BUT_MARK_LATE";
  timezone?: string;
} = {}) {
  const schoolStudentType = options.studentType ?? "DAY";
  const students = [
    {
      id: "student-a",
      schoolId: "school-a",
      admissionNumber: "A-001",
      firstName: "Ada",
      lastName: "Lovelace",
      studentType: schoolStudentType,
      isActive: true,
      enrollments: [{ class: { id: "class-a", name: "Senior 1" }, stream: { id: "stream-a", name: "A" } }],
    },
    {
      id: "student-b",
      schoolId: "school-b",
      admissionNumber: "B-001",
      firstName: "Grace",
      lastName: "Hopper",
      studentType: "BOARDING" as const,
      isActive: true,
      enrollments: [{ class: { id: "class-b", name: "Senior 2" }, stream: { id: "stream-b", name: "B" } }],
    },
  ];
  const credentials = [
    {
      id: "credential-a",
      schoolId: "school-a",
      studentId: "student-a",
      type: CredentialType.NFC_WRISTBAND,
      credentialUID: "UID-A",
      scanToken: "token-a",
      status: CredentialStatus.ACTIVE,
      issuedAt: new Date("2026-06-21T08:00:00.000Z"),
      student: students[0],
    },
    {
      id: "credential-b",
      schoolId: "school-b",
      studentId: "student-b",
      type: CredentialType.NFC_WRISTBAND,
      credentialUID: "UID-B",
      scanToken: "token-b",
      status: CredentialStatus.ACTIVE,
      issuedAt: new Date("2026-06-21T08:00:00.000Z"),
      student: students[1],
    },
  ];
  const events: Array<{
    id: string;
    schoolId: string;
    studentId: string;
    credentialId: string;
    direction: AttendanceDirection;
    source: "NFC_WRISTBAND";
    status: AttendanceScanStatus;
    reason: string | null;
    scannedAt: Date;
    student: (typeof students)[number];
  }> = [];
  const gateScans: Array<Record<string, unknown>> = [];
  const campusMovementEvents: Array<Record<string, unknown>> = [];
  const dailyAttendanceRows: Array<Record<string, unknown>> = [];
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
  }> = options.feeHoldStatus
    ? [{
        id: "hold-a",
        schoolId: "school-a",
        studentId: "student-a",
        status: options.feeHoldStatus,
        reason: "Fees overdue",
        balanceDueCents: 100000,
        effectiveFrom: new Date("2026-06-20T00:00:00.000Z"),
        clearedAt: null,
        createdByUserId: "admin-a",
        clearedByUserId: null,
        createdAt: new Date("2026-06-20T00:00:00.000Z"),
        updatedAt: new Date("2026-06-20T00:00:00.000Z"),
      }]
    : [];
  const policy = {
    id: "policy-a",
    schoolId: "school-a",
    feeDefaulterBlockingEnabled: options.feeDefaulterBlockingEnabled ?? false,
    feeDefaulterBlockScope: options.feeDefaulterBlockScope ?? "DAY_SCHOLARS_ONLY",
    attendanceTapInCutoffEnabled: options.attendanceTapInCutoffEnabled ?? false,
    tapInCutoffTime: options.tapInCutoffTime ?? null,
    cutoffLateAction: options.cutoffLateAction ?? "BLOCK_AND_MARK_ABSENT",
    timezone: options.timezone ?? "Africa/Kampala",
    updatedByUserId: null as string | null,
    createdAt: new Date("2026-06-21T08:00:00.000Z"),
    updatedAt: new Date("2026-06-21T08:00:00.000Z"),
  };

  const db = {
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn(db),
    studentCredential: {
      findFirst: async ({ where }: { where: { schoolId: string; scanToken?: string; credentialUID?: string; OR?: Array<{ scanToken?: string; credentialUID?: string }> } }) =>
        credentials.find((credential) =>
          credential.schoolId === where.schoolId
          && (
            where.scanToken === credential.scanToken
            || where.credentialUID === credential.credentialUID
            || where.OR?.some((condition) => condition.scanToken === credential.scanToken || condition.credentialUID === credential.credentialUID)
          ),
        ) ?? null,
    },
    schoolNfcPolicy: {
      upsert: async ({ create, update }: { create: Record<string, unknown>; update: Record<string, unknown> }) => {
        Object.assign(policy, create, update);
        return policy;
      },
    },
    studentFeeHold: {
      findFirst: async ({ where }: { where: { schoolId: string; studentId: string; status: string } }) =>
        feeHolds.find((hold) => hold.schoolId === where.schoolId && hold.studentId === where.studentId && hold.status === where.status) ?? null,
    },
    studentAttendanceEvent: {
      findMany: async ({ where }: { where: { schoolId: string } }) => events.filter((event) => event.schoolId === where.schoolId),
      findFirst: async ({
        where,
      }: {
        where: {
          schoolId: string;
          studentId: string;
          direction: AttendanceDirection;
          status: AttendanceScanStatus | { in: AttendanceScanStatus[] };
          scannedAt?: { gte: Date; lt: Date };
        };
      }) =>
        events.find((event) => {
          if (event.schoolId !== where.schoolId || event.studentId !== where.studentId || event.direction !== where.direction) return false;
          if (typeof where.status === "string") return event.status === where.status;
          if (!where.status.in.includes(event.status)) return false;
          return true;
        }) ?? null,
      create: async ({ data }: { data: Omit<(typeof events)[number], "id" | "scannedAt" | "student"> }) => {
        const student = students.find((item) => item.id === data.studentId);
        if (!student) throw new Error("student missing");
        const event = { ...data, id: `event-${events.length + 1}`, scannedAt: new Date(), student };
        events.push(event);
        return event;
      },
    },
    student: {
      findMany: async ({ where, include }: { where: { schoolId: string }; include?: { attendanceEvents?: { where: { scannedAt: { gte: Date; lt: Date } } } } }) => {
        const filteredStudents = students.filter((student) => student.schoolId === where.schoolId);
        if (!include?.attendanceEvents) return filteredStudents;
        return filteredStudents.map((student) => ({
          ...student,
          attendanceEvents: events.filter((event) => {
            if (event.schoolId !== student.schoolId || event.studentId !== student.id) return false;
            const range = include.attendanceEvents?.where.scannedAt;
            if (!range) return true;
            return event.scannedAt >= range.gte && event.scannedAt < range.lt;
          }),
        }));
      },
    },
    dailyAttendance: {
      findMany: async () => [],
      upsert: async ({ create, update }: { create: Record<string, unknown>; update: Record<string, unknown> }) => {
        const row = { ...create, ...update };
        dailyAttendanceRows.push(row);
        return row;
      },
    },
    campusMovementEvent: {
      findMany: async () => campusMovementEvents,
      findFirst: async () => campusMovementEvents.length > 0 ? campusMovementEvents[campusMovementEvents.length - 1] : null,
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const row = { id: `move-${campusMovementEvents.length + 1}`, ...data };
        campusMovementEvents.push(row);
        return row;
      },
    },
    classroomAttendanceEvent: {
      findMany: async () => [],
    },
    studentPassOut: {
      findFirst: async () => null,
      update: async ({ data }: { data: Record<string, unknown> }) => data,
    },
    nfcOfflineDevice: {
      findMany: async () => [],
    },
    nfcTag: {
      findFirst: async () => null,
    },
    school: {
      findUnique: async () => ({
        academicYears: [{
          id: "year-a",
          name: "2025/2026",
          terms: [{ id: "term-a", name: "Term 1" }],
        }],
      }),
    },
    nfcGateScan: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const row = {
          ...data,
          id: `gate-${gateScans.length + 1}`,
          scannedAt: new Date("2026-06-21T09:00:00.000Z"),
        };
        gateScans.push(row);
        return row;
      },
    },
    auditLog: {
      create: vi.fn(async () => ({})),
    },
  };

  return { db: db as never, events, gateScans, feeHolds, policy, students };
}

describe("NFC attendance operations", () => {
  it("records school-scoped NFC attendance scans and protects duplicates", async () => {
    const { db, events } = createDb();
    const ctx = { schoolId: "school-a", actorId: "device-a", role: "GATE_SECURITY" };

    const first = await scanAttendance(ctx, { tokenOrUid: "token-a", direction: AttendanceDirection.TAP_IN }, db);
    const duplicate = await scanAttendance(ctx, { tokenOrUid: "token-a", direction: AttendanceDirection.TAP_IN }, db);

    expect(first.summary.totalTappedIn).toBe(1);
    expect(duplicate.events.some((event) => event.status === AttendanceScanStatus.DUPLICATE)).toBe(true);
    expect(events.every((event) => event.schoolId === "school-a")).toBe(true);
  });

  it("keeps fee defaulter blocking off by default", async () => {
    const { db } = createDb({ feeHoldStatus: "ACTIVE" });
    const gate = await scanGate({ schoolId: "school-a", actorId: "security-a", role: "SECURITY" }, { tokenOrUid: "token-a" }, db);
    const attendance = await scanAttendance({ schoolId: "school-a", actorId: "device-a", role: "GATE_SECURITY" }, { tokenOrUid: "token-a", direction: AttendanceDirection.TAP_IN }, db);

    expect(gate.result).toBe(GateScanResult.ALLOWED);
    expect(attendance.scan.status).toBe(AttendanceScanStatus.VALID);
  });

  it("keeps attendance dashboard scoped by schoolId", async () => {
    const { db, events } = createDb();
    events.push({
      id: "foreign-event",
      schoolId: "school-b",
      studentId: "student-b",
      credentialId: "credential-b",
      direction: AttendanceDirection.TAP_IN,
      source: "NFC_WRISTBAND",
      status: AttendanceScanStatus.VALID,
      reason: null,
      scannedAt: new Date("2026-06-21T07:30:00.000Z"),
      student: {
        id: "student-b",
        schoolId: "school-b",
        admissionNumber: "B-001",
        firstName: "Grace",
        lastName: "Hopper",
        studentType: "BOARDING",
        isActive: true,
        enrollments: [{ class: { id: "class-b", name: "Senior 2" }, stream: { id: "stream-b", name: "B" } }],
      },
    });

    const dashboard = await getAttendanceDashboard({ schoolId: "school-a", actorId: "device-a", role: "ADMIN_OPERATOR" }, {}, db);

    expect(dashboard.events).toEqual([]);
    expect(dashboard.summary.notYetTapped).toBe(1);
  });

  it("blocks fee-defaulter scans when policy is enabled", async () => {
    const { db } = createDb({ feeDefaulterBlockingEnabled: true, feeHoldStatus: "ACTIVE" });
    const gate = await scanGate({ schoolId: "school-a", actorId: "security-a", role: "SECURITY" }, { tokenOrUid: "token-a" }, db);
    const attendance = await scanAttendance({ schoolId: "school-a", actorId: "device-a", role: "GATE_SECURITY" }, { tokenOrUid: "token-a", direction: AttendanceDirection.TAP_IN }, db);

    expect(gate.result).toBe(GateScanResult.BLOCKED);
    expect(gate.reason).toBe("school fees defaulter");
    expect(attendance.scan.status).toBe(AttendanceScanStatus.BLOCKED);
    expect(attendance.scan.reason).toBe("school fees defaulter");
  });

  it("does not block a boarding student when scope is day scholars only", async () => {
    const { db } = createDb({ studentType: "BOARDING", feeDefaulterBlockingEnabled: true, feeHoldStatus: "ACTIVE" });
    const gate = await scanGate({ schoolId: "school-a", actorId: "security-a", role: "SECURITY" }, { tokenOrUid: "token-a" }, db);

    expect(gate.result).toBe(GateScanResult.ALLOWED);
  });

  it("blocks a boarding student when the scope covers all students", async () => {
    const { db } = createDb({ studentType: "BOARDING", feeDefaulterBlockingEnabled: true, feeDefaulterBlockScope: "ALL_STUDENTS", feeHoldStatus: "ACTIVE" });
    const gate = await scanGate({ schoolId: "school-a", actorId: "security-a", role: "SECURITY" }, { tokenOrUid: "token-a" }, db);

    expect(gate.result).toBe(GateScanResult.BLOCKED);
    expect(gate.reason).toBe("school fees defaulter");
  });

  it("allows tap-in before cut-off", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-24T04:30:00.000Z"));
    try {
      const { db } = createDb({ attendanceTapInCutoffEnabled: true, tapInCutoffTime: "08:00" });
      const scan = await scanAttendance({ schoolId: "school-a", actorId: "device-a", role: "GATE_SECURITY" }, { tokenOrUid: "token-a", direction: AttendanceDirection.TAP_IN }, db);
      expect(scan.scan.status).toBe(AttendanceScanStatus.VALID);
    } finally {
      vi.useRealTimers();
    }
  });

  it("blocks tap-in after cut-off and keeps the student absent", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-24T06:30:00.000Z"));
    try {
      const { db } = createDb({ attendanceTapInCutoffEnabled: true, tapInCutoffTime: "08:00" });
      const scan = await scanAttendance({ schoolId: "school-a", actorId: "device-a", role: "GATE_SECURITY" }, { tokenOrUid: "token-a", direction: AttendanceDirection.TAP_IN }, db);
      const register = await getAttendanceRegister({ schoolId: "school-a", actorId: "device-a", role: "ADMIN_OPERATOR" }, { date: "2026-06-24" }, db);

      expect(scan.scan.status).toBe(AttendanceScanStatus.BLOCKED);
      expect(scan.scan.reason).toBe("attendance cut-off passed");
      expect(register.rows[0]?.currentStatus).toBe("ABSENT");
    } finally {
      vi.useRealTimers();
    }
  });

  it("blocks administrators from directly invoking manual attendance punch operations", async () => {
    const { db } = createDb();

    await expect(
      scanAttendance(
        { schoolId: "school-a", actorId: "admin-a", role: "ADMIN_OPERATOR" },
        { tokenOrUid: "token-a", direction: AttendanceDirection.TAP_IN },
        db,
      ),
    ).rejects.toMatchObject({ status: 403 });
  });

  it("logs unknown attendance scans as blocked gate scans before returning 404", async () => {
    const { db, gateScans } = createDb();
    db.studentCredential.findFirst = async () => null;

    await expect(
      scanAttendance(
        { schoolId: "school-a", actorId: "device-a", role: "GATE_SECURITY" },
        { tokenOrUid: "unknown-credential", direction: AttendanceDirection.TAP_IN },
        db,
      ),
    ).rejects.toMatchObject({ status: 404 });

    expect(gateScans).toHaveLength(1);
    expect(gateScans[0]).toMatchObject({
      schoolId: "school-a",
      studentId: null,
      credentialId: null,
      result: GateScanResult.BLOCKED,
      reason: "Unassigned NFC card",
    });
  });
});
