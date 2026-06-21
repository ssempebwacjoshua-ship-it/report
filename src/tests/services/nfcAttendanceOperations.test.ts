import { AttendanceDirection, AttendanceScanStatus, CredentialStatus, CredentialType } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { getAttendanceDashboard, scanAttendance } from "../../server/services/nfcOperationsService";

function createDb() {
  const students = [
    {
      id: "student-a",
      schoolId: "school-a",
      admissionNumber: "A-001",
      firstName: "Ada",
      lastName: "Lovelace",
      isActive: true,
      enrollments: [{ class: { id: "class-a", name: "Senior 1" }, stream: { id: "stream-a", name: "A" } }],
    },
    {
      id: "student-b",
      schoolId: "school-b",
      admissionNumber: "B-001",
      firstName: "Grace",
      lastName: "Hopper",
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

  const db = {
    studentCredential: {
      findFirst: async ({ where }: { where: { schoolId: string; OR: Array<{ scanToken?: string; credentialUID?: string }> } }) =>
        credentials.find((credential) =>
          credential.schoolId === where.schoolId
          && where.OR.some((condition) => condition.scanToken === credential.scanToken || condition.credentialUID === credential.credentialUID),
        ) ?? null,
    },
    studentAttendanceEvent: {
      findMany: async ({ where }: { where: { schoolId: string } }) => events.filter((event) => event.schoolId === where.schoolId),
      findFirst: async ({ where }: { where: { schoolId: string; studentId: string; direction: AttendanceDirection; status: AttendanceScanStatus } }) =>
        events.find((event) => event.schoolId === where.schoolId && event.studentId === where.studentId && event.direction === where.direction && event.status === where.status) ?? null,
      create: async ({ data }: { data: Omit<(typeof events)[number], "id" | "scannedAt" | "student"> }) => {
        const student = students.find((item) => item.id === data.studentId);
        if (!student) throw new Error("student missing");
        const event = { ...data, id: `event-${events.length + 1}`, scannedAt: new Date("2026-06-21T07:30:00.000Z"), student };
        events.push(event);
        return event;
      },
    },
    student: {
      findMany: async ({ where }: { where: { schoolId: string } }) => students.filter((student) => student.schoolId === where.schoolId),
    },
  };

  return { db: db as never, events };
}

describe("NFC attendance operations", () => {
  it("records school-scoped NFC attendance scans and protects duplicates", async () => {
    const { db, events } = createDb();
    const ctx = { schoolId: "school-a", actorId: "teacher-a", role: "TEACHER" };

    const first = await scanAttendance(ctx, { tokenOrUid: "token-a", direction: AttendanceDirection.TAP_IN }, db);
    const duplicate = await scanAttendance(ctx, { tokenOrUid: "token-a", direction: AttendanceDirection.TAP_IN }, db);

    expect(first.summary.totalTappedIn).toBe(1);
    expect(duplicate.events.some((event) => event.status === AttendanceScanStatus.DUPLICATE)).toBe(true);
    expect(events.every((event) => event.schoolId === "school-a")).toBe(true);
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
        isActive: true,
        enrollments: [{ class: { id: "class-b", name: "Senior 2" }, stream: { id: "stream-b", name: "B" } }],
      },
    });

    const dashboard = await getAttendanceDashboard({ schoolId: "school-a", actorId: "teacher-a", role: "TEACHER" }, {}, db);

    expect(dashboard.events).toEqual([]);
    expect(dashboard.summary.notYetTapped).toBe(1);
  });
});
