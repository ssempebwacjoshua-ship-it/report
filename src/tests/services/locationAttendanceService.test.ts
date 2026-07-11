import { describe, expect, it } from "vitest";
import { approveGateOverride, listGateAttendanceReport } from "../../server/services/locationAttendanceService";

const ADMIN_CTX = { schoolId: "school-1", actorId: "admin-1", role: "ADMIN_OPERATOR" as const };

function createDb() {
  const gateOverrides: Array<Record<string, any>> = [];
  const auditLogs: Array<Record<string, any>> = [];
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
      findMany: async () => ([
        {
          id: "student-1",
          admissionNumber: "A-001",
          firstName: "Ada",
          lastName: "Lovelace",
          studentType: "DAY",
          enrollments: [{ class: { name: "Senior 1" }, stream: { name: "A" } }],
        },
      ]),
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
      findFirst: async ({ where }: { where: Record<string, any> }) => gateOverrides.find((row) => row.status === where.status) ?? null,
      create: async ({ data }: { data: Record<string, any> }) => {
        const row = { id: `override-${gateOverrides.length + 1}`, ...data };
        gateOverrides.push(row);
        return row;
      },
    },
    dailyAttendance: {
      findMany: async () => ([{ studentId: "student-1", status: "PRESENT" }]),
    },
    campusMovementEvent: {
      findMany: async () => ([
        { id: "evt-1", studentId: "student-1", readerId: "reader-1", type: "GATE_ENTRY", occurredAt: new Date("2026-07-11T04:45:00.000Z"), offlineSynced: false },
        { id: "evt-2", studentId: "student-1", readerId: "reader-1", type: "RESTRICTED_ENTRY_ATTEMPT", occurredAt: new Date("2026-07-11T04:40:00.000Z"), offlineSynced: false },
      ]),
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
  it("builds a gate report row with restricted-attempt metadata", async () => {
    const db = createDb();
    const report = await listGateAttendanceReport(ADMIN_CTX, { date: "2026-07-11" }, db as never);

    expect(report.summary.totalStudents).toBe(1);
    expect(report.rows[0]).toMatchObject({
      studentName: "Ada Lovelace",
      attendanceStatus: "PRESENT",
      feeHoldAttempt: true,
      campusStatus: "ON_CAMPUS",
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
