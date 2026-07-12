import { describe, expect, it } from "vitest";
import {
  approveGateOverride,
  getCanonicalAttendanceRegister,
  getDashboardAttendanceSummary,
  listGateAttendanceReport,
} from "../../server/services/locationAttendanceService";

const ADMIN_CTX = { schoolId: "school-1", actorId: "admin-1", role: "ADMIN_OPERATOR" as const };

type StudentFixture = {
  id: string;
  schoolId: string;
  admissionNumber: string;
  firstName: string;
  lastName: string;
  studentType: "DAY" | "BOARDING";
  isActive: boolean;
  className?: string;
  streamName?: string;
};

type DailyFixture = { schoolId: string; studentId: string; status: string };
type MovementFixture = {
  id: string;
  schoolId: string;
  studentId: string;
  readerId: string;
  type: string;
  occurredAt: Date;
  offlineSynced?: boolean;
};
type LegacyFixture = {
  id: string;
  schoolId: string;
  studentId: string;
  direction: string;
  scannedAt: Date;
  source: string;
  status: string;
  reason: string | null;
};

function createDb(fixtures?: {
  students?: StudentFixture[];
  daily?: DailyFixture[];
  movements?: MovementFixture[];
  legacy?: LegacyFixture[];
}) {
  const gateOverrides: Array<Record<string, any>> = [];
  const auditLogs: Array<Record<string, any>> = [];
  const students = fixtures?.students ?? [];
  const daily = fixtures?.daily ?? [];
  const movements = fixtures?.movements ?? [];
  const legacy = fixtures?.legacy ?? [];

  return {
    schoolNfcPolicy: {
      upsert: async () => ({
        id: "policy-1",
        schoolId: "school-1",
        feeDefaulterBlockingEnabled: false,
        feeDefaulterBlockScope: "DAY_SCHOLARS_ONLY",
        attendanceTapInCutoffEnabled: false,
        tapInCutoffTime: null,
        cutoffLateAction: "BLOCK_AND_MARK_ABSENT",
        timezone: "Africa/Kampala",
        duplicateWindowSeconds: 60,
        gateArrivalStart: "05:30",
        gateArrivalLateAfter: "08:00",
        gateArrivalEnd: "10:00",
        morningClassroomStart: "06:30",
        morningClassroomEnd: "10:00",
        gateDepartureStart: "14:00",
        gateDepartureEnd: "19:00",
        nightPrepStart: "18:30",
        nightPrepEnd: "22:30",
        nightPrepBoardingOnly: true,
        allowAutomaticCheckout: false,
        recordUnclassifiedScans: true,
        feeGatePolicyEnabled: true,
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
        updatedByUserId: null,
        createdAt: new Date("2026-07-11T00:00:00.000Z"),
        updatedAt: new Date("2026-07-11T00:00:00.000Z"),
      }),
    },
    student: {
      findMany: async ({ where }: { where?: Record<string, any> }) =>
        students
          .filter((student) => student.schoolId === where?.schoolId && student.isActive === where?.isActive)
          .map((student) => ({
            id: student.id,
            admissionNumber: student.admissionNumber,
            firstName: student.firstName,
            lastName: student.lastName,
            studentType: student.studentType,
            enrollments: [{
              class: student.className ? { name: student.className } : null,
              stream: student.streamName ? { name: student.streamName } : null,
            }],
          })),
      findFirst: async () => ({
        id: "student-1",
        studentType: "DAY",
        firstName: "Ada",
        lastName: "Lovelace",
      }),
    },
    studentFeeHold: {
      findFirst: async () => ({
        id: "fee-hold-1",
        schoolId: "school-1",
        studentId: "student-1",
        status: "ACTIVE",
        updatedAt: new Date("2026-07-11T00:00:00.000Z"),
      }),
    },
    studentGateHold: {
      findFirst: async ({ where }: { where: Record<string, any> }) =>
        gateOverrides.find((row) => row.status === where.status) ?? null,
      create: async ({ data }: { data: Record<string, any> }) => {
        const row = { id: `override-${gateOverrides.length + 1}`, ...data };
        gateOverrides.push(row);
        return row;
      },
    },
    dailyAttendance: {
      findMany: async ({ where }: { where: { schoolId: string; studentId: { in: string[] } } }) =>
        daily
          .filter((row) => row.schoolId === where.schoolId && where.studentId.in.includes(row.studentId))
          .map((row) => ({ studentId: row.studentId, status: row.status })),
    },
    campusMovementEvent: {
      findMany: async ({ where }: { where: { schoolId: string; studentId: { in: string[] } } }) =>
        movements
          .filter((row) => row.schoolId === where.schoolId && where.studentId.in.includes(row.studentId))
          .map((row) => ({
            id: row.id,
            studentId: row.studentId,
            readerId: row.readerId,
            type: row.type,
            occurredAt: row.occurredAt,
            receivedAt: row.occurredAt,
            offlineSynced: row.offlineSynced ?? false,
          })),
    },
    studentAttendanceEvent: {
      findMany: async ({ where }: { where: { schoolId: string; studentId: { in: string[] } } }) =>
        legacy
          .filter((row) => row.schoolId === where.schoolId && where.studentId.in.includes(row.studentId))
          .map((row) => ({ ...row })),
    },
    classroomAttendanceEvent: {
      findMany: async () => ([]),
    },
    nfcOfflineDevice: {
      findMany: async () => ([{ id: "reader-1", name: "Attendance Gate 01", locationName: "Main Entrance", location: "Main Entrance" }]),
    },
    auditLog: {
      create: async ({ data }: { data: Record<string, any> }) => {
        auditLogs.push(data);
        return data;
      },
    },
    stores: { gateOverrides, auditLogs },
  };
}

describe("locationAttendanceService", () => {
  it("counts PRESENT and LATE students as present, excludes inactive/cross-school records, and computes campus state correctly", async () => {
    const db = createDb({
      students: [
        { id: "student-1", schoolId: "school-1", admissionNumber: "A-001", firstName: "Ada", lastName: "Lovelace", studentType: "DAY", isActive: true, className: "Senior 1", streamName: "A" },
        { id: "student-2", schoolId: "school-1", admissionNumber: "A-002", firstName: "Grace", lastName: "Hopper", studentType: "DAY", isActive: true, className: "Senior 1", streamName: "A" },
        { id: "student-3", schoolId: "school-1", admissionNumber: "A-003", firstName: "Alan", lastName: "Turing", studentType: "BOARDING", isActive: true, className: "Senior 1", streamName: "B" },
        { id: "student-4", schoolId: "school-1", admissionNumber: "A-004", firstName: "Mary", lastName: "Jackson", studentType: "DAY", isActive: false, className: "Senior 2", streamName: "A" },
        { id: "student-9", schoolId: "school-2", admissionNumber: "B-001", firstName: "Other", lastName: "School", studentType: "DAY", isActive: true },
      ],
      daily: [
        { schoolId: "school-1", studentId: "student-1", status: "PRESENT" },
        { schoolId: "school-1", studentId: "student-2", status: "LATE" },
        { schoolId: "school-2", studentId: "student-9", status: "PRESENT" },
      ],
      movements: [
        { id: "evt-1", schoolId: "school-1", studentId: "student-1", readerId: "reader-1", type: "GATE_ENTRY", occurredAt: new Date("2026-07-11T04:45:00.000Z") },
        { id: "evt-2", schoolId: "school-1", studentId: "student-1", readerId: "reader-1", type: "GATE_ENTRY", occurredAt: new Date("2026-07-11T04:46:00.000Z") },
        { id: "evt-3", schoolId: "school-1", studentId: "student-2", readerId: "reader-1", type: "GATE_ENTRY", occurredAt: new Date("2026-07-11T05:10:00.000Z") },
        { id: "evt-4", schoolId: "school-1", studentId: "student-2", readerId: "reader-1", type: "GATE_EXIT", occurredAt: new Date("2026-07-11T14:10:00.000Z") },
        { id: "evt-5", schoolId: "school-1", studentId: "student-3", readerId: "reader-1", type: "RESTRICTED_ENTRY_ATTEMPT", occurredAt: new Date("2026-07-11T05:15:00.000Z") },
      ],
    });

    const summary = await getDashboardAttendanceSummary(ADMIN_CTX, db as never);
    const report = await listGateAttendanceReport(ADMIN_CTX, { date: "2026-07-11" }, db as never);

    expect(summary.totalStudents).toBe(3);
    expect(summary.present).toBe(2);
    expect(summary.late).toBe(1);
    expect(summary.absent).toBe(1);
    expect(summary.attendanceRate).toBe(66.7);
    expect(summary.onCampus).toBe(1);
    expect(summary.offCampus).toBe(2);

    expect(report.summary.present).toBe(2);
    expect(report.summary.late).toBe(1);
    expect(report.summary.absent).toBe(1);
    expect(report.rows.find((row) => row.studentId === "student-1")?.campusStatus).toBe("ON_CAMPUS");
    expect(report.rows.find((row) => row.studentId === "student-2")?.campusStatus).toBe("OFF_CAMPUS");
    expect(report.rows.find((row) => row.studentId === "student-3")?.attendanceStatus).toBe("ABSENT");
  });

  it("returns a safe zero attendance percentage when no active students exist", async () => {
    const db = createDb({ students: [] });

    const summary = await getDashboardAttendanceSummary(ADMIN_CTX, db as never);

    expect(summary.totalStudents).toBe(0);
    expect(summary.present).toBe(0);
    expect(summary.absent).toBe(0);
    expect(summary.attendanceRate).toBe(0);
  });

  it("uses only canonical physical-reader attendance in the register", async () => {
    const db = createDb({
      students: [
        { id: "student-1", schoolId: "school-1", admissionNumber: "A-001", firstName: "Ada", lastName: "Lovelace", studentType: "DAY", isActive: true, className: "Senior 1", streamName: "A" },
        { id: "student-2", schoolId: "school-1", admissionNumber: "A-002", firstName: "Grace", lastName: "Hopper", studentType: "DAY", isActive: true, className: "Senior 1", streamName: "A" },
      ],
      daily: [
        { schoolId: "school-1", studentId: "student-1", status: "PRESENT" },
      ],
      movements: [
        { id: "evt-1", schoolId: "school-1", studentId: "student-1", readerId: "reader-1", type: "GATE_ENTRY", occurredAt: new Date("2026-07-11T04:45:00.000Z") },
        { id: "evt-2", schoolId: "school-1", studentId: "student-1", readerId: "reader-1", type: "GATE_EXIT", occurredAt: new Date("2026-07-11T14:45:00.000Z") },
      ],
      legacy: [
        { id: "legacy-1", schoolId: "school-1", studentId: "student-1", direction: "TAP_IN", scannedAt: new Date("2026-07-11T04:40:00.000Z"), source: "BROWSER", status: "DUPLICATE", reason: "duplicate" },
        { id: "legacy-2", schoolId: "school-1", studentId: "student-2", direction: "TAP_IN", scannedAt: new Date("2026-07-11T04:50:00.000Z"), source: "BROWSER", status: "VALID", reason: null },
      ],
    });

    const register = await getCanonicalAttendanceRegister(ADMIN_CTX, { date: "2026-07-11" }, db as never);

    expect(register.summary.totalStudents).toBe(2);
    expect(register.summary.duplicateScans).toBe(0);
    expect(register.rows.find((row) => row.student.id === "student-1")).toMatchObject({
      currentStatus: "OUT",
      tapIn: { source: "PHYSICAL_READER" },
    });
    expect(register.rows.find((row) => row.student.id === "student-2")).toMatchObject({
      currentStatus: "ABSENT",
      tapIn: null,
    });
  });

  it("approves a manual gate override with audit logging", async () => {
    const db = createDb();
    const result = await approveGateOverride(ADMIN_CTX, {
      studentId: "student-1",
      reason: "Approved by bursar after payment plan review",
      expiresAt: "2099-07-11T18:30:00.000Z",
    }, db as never);

    expect(result.idempotent).toBe(false);
    expect(db.stores.gateOverrides).toHaveLength(1);
    expect(db.stores.gateOverrides[0]?.status).toBe("APPROVED");
    expect(db.stores.auditLogs[0]?.action).toBe("student_gate_override.approved");
  });
});
