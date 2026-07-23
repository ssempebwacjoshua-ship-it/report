import { describe, expect, it } from "vitest";
import { getDashboardStats } from "../../server/services/dashboardService";
import { getDashboardAttendanceSummary } from "../../server/services/locationAttendanceService";

const ADMIN_CTX = { schoolId: "school-1", actorId: "admin-1", role: "ADMIN_OPERATOR" as const };

function createDashboardDb() {
  const students = [
    { id: "student-1", schoolId: "school-1", isActive: true, enrolledCurrentTerm: true, studentType: "DAY", admissionNumber: "A-001", firstName: "Ada", lastName: "Lovelace", className: "Senior 1", streamName: "A" },
    { id: "student-2", schoolId: "school-1", isActive: true, enrolledCurrentTerm: true, studentType: "BOARDING", admissionNumber: "A-002", firstName: "Alan", lastName: "Turing", className: "Senior 1", streamName: "B" },
    { id: "student-3", schoolId: "school-1", isActive: true, enrolledCurrentTerm: false, studentType: "DAY", admissionNumber: "A-003", firstName: "Grace", lastName: "Withdrawn", className: "Senior 2", streamName: "A" },
    { id: "student-4", schoolId: "school-1", isActive: false, enrolledCurrentTerm: true, studentType: "DAY", admissionNumber: "A-004", firstName: "Mary", lastName: "Inactive", className: "Senior 2", streamName: "A" },
  ];

  const filterCurrentPopulation = (where?: Record<string, any>) =>
    students
      .filter((student) => student.schoolId === where?.schoolId && student.isActive === where?.isActive)
      .filter((student) => {
        const enrollmentWhere = where?.enrollments?.some;
        if (!enrollmentWhere) return true;
        return (student.enrolledCurrentTerm ?? true)
          && enrollmentWhere.isActive === true
          && enrollmentWhere.status === "ACTIVE";
      });

  return {
    school: {
      findUnique: async ({ where }: { where: { code?: string; id?: string } }) => {
        if (where.code === "test-school" || where.id === "school-1") {
          return {
            id: "school-1",
            code: "test-school",
            name: "Test School",
            academicYears: [{
              id: "year-1",
              name: "2026",
              terms: [{ id: "term-1", name: "Term 2" }],
            }],
          };
        }
        return null;
      },
    },
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
      count: async ({ where }: { where?: Record<string, any> }) => filterCurrentPopulation(where).length,
      findMany: async ({ where }: { where?: Record<string, any> }) =>
        filterCurrentPopulation(where).map((student) => ({
          id: student.id,
          admissionNumber: student.admissionNumber,
          firstName: student.firstName,
          lastName: student.lastName,
          attendanceProfile: student.studentType === "BOARDING" ? "BOARDER" : "DAY_SCHOLAR",
          studentType: student.studentType,
          enrollments: [{
            class: student.className ? { name: student.className } : null,
            stream: student.streamName ? { name: student.streamName } : null,
          }],
        })),
    },
    dailyAttendance: {
      findMany: async () => ([]),
    },
    campusMovementEvent: {
      findMany: async () => ([]),
    },
    nfcOfflineDevice: {
      findMany: async () => ([]),
    },
    markImportBatch: {
      count: async () => 0,
      findMany: async () => [],
    },
    issuedReport: {
      count: async () => 0,
    },
    inventoryItem: {
      findMany: async () => [],
    },
    inventoryStockMovement: {
      findMany: async () => [],
    },
    studentReportingRecord: {
      findMany: async () => [],
    },
    auditLog: {
      findMany: async () => [],
      create: async ({ data }: { data: Record<string, unknown> }) => data,
    },
    studentFeeHold: {
      findFirst: async () => null,
    },
    studentGateHold: {
      findFirst: async () => null,
      create: async ({ data }: { data: Record<string, unknown> }) => data,
    },
    classroomAttendanceEvent: {
      findMany: async () => [],
    },
  };
}

describe("dashboardService", () => {
  it("uses the same current enrolled student population for enrollment and attendance widgets", async () => {
    const db = createDashboardDb();

    const [stats, attendance] = await Promise.all([
      getDashboardStats(db as never, "test-school"),
      getDashboardAttendanceSummary(ADMIN_CTX, db as never),
    ]);

    expect(stats.enrolledStudents).toBe(2);
    expect(stats.inventory).toEqual({
      itemsTracked: 0,
      lowStock: 0,
      reportingToday: 0,
      requirementsReceived: 0,
      reconciliationIssues: 0,
    });
    expect(attendance.totalStudents).toBe(2);
    expect(attendance.absent).toBe(2);
    expect(attendance.dayScholarsAbsent).toBe(1);
    expect(attendance.boardersNotSeenToday).toBe(1);
    expect(attendance.attendanceRate).toBe(0);
  });
});
