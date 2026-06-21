import { AttendanceDirection, AttendanceScanSource, CredentialStatus, CredentialType } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { scanStudentAttendance } from "../../server/services/studentAttendanceService";

type StudentRow = {
  id: string;
  schoolId: string;
  admissionNumber: string;
  firstName: string;
  lastName: string;
  isActive: boolean;
  enrollments: Array<{
    classId: string;
    streamId: string;
    class: { name: string };
    stream: { name: string };
  }>;
};

type CredentialRow = {
  id: string;
  schoolId: string;
  studentId: string;
  type: CredentialType;
  credentialUID: string;
  status: CredentialStatus;
  student: StudentRow;
};

type AttendanceEventRow = {
  id: string;
  schoolId: string;
  studentId: string;
  credentialId: string;
  classId: string | null;
  streamId: string | null;
  direction: AttendanceDirection;
  scanSource: AttendanceScanSource;
  scannedAt: Date;
};

function createAttendanceDb() {
  const students: StudentRow[] = [
    {
      id: "student-a",
      schoolId: "school-a",
      admissionNumber: "A-001",
      firstName: "Ada",
      lastName: "Lovelace",
      isActive: true,
      enrollments: [{
        classId: "class-a",
        streamId: "stream-a",
        class: { name: "Senior 1" },
        stream: { name: "A" },
      }],
    },
    {
      id: "student-inactive",
      schoolId: "school-a",
      admissionNumber: "A-002",
      firstName: "Inactive",
      lastName: "Learner",
      isActive: false,
      enrollments: [{
        classId: "class-a",
        streamId: "stream-a",
        class: { name: "Senior 1" },
        stream: { name: "A" },
      }],
    },
  ];

  const credentials: CredentialRow[] = [
    {
      id: "credential-active",
      schoolId: "school-a",
      studentId: "student-a",
      type: CredentialType.NFC_WRISTBAND,
      credentialUID: "AB12",
      status: CredentialStatus.ACTIVE,
      student: students[0],
    },
    {
      id: "credential-deactivated",
      schoolId: "school-a",
      studentId: "student-a",
      type: CredentialType.NFC_WRISTBAND,
      credentialUID: "LOST1",
      status: CredentialStatus.DEACTIVATED,
      student: students[0],
    },
    {
      id: "credential-inactive-student",
      schoolId: "school-a",
      studentId: "student-inactive",
      type: CredentialType.NFC_WRISTBAND,
      credentialUID: "INACTIVE1",
      status: CredentialStatus.ACTIVE,
      student: students[1],
    },
  ];
  const events: AttendanceEventRow[] = [];

  const db = {
    studentCredential: {
      findUnique: async ({ where }: { where: { schoolId_type_credentialUID: { schoolId: string; type: CredentialType; credentialUID: string } } }) =>
        credentials.find(
          (credential) =>
            credential.schoolId === where.schoolId_type_credentialUID.schoolId
            && credential.type === where.schoolId_type_credentialUID.type
            && credential.credentialUID === where.schoolId_type_credentialUID.credentialUID,
        ) ?? null,
    },
    studentAttendanceEvent: {
      findFirst: async ({ where }: { where: { schoolId: string; credentialId: string; direction: AttendanceDirection; scannedAt: { gte: Date } } }) =>
        events
          .filter(
            (event) =>
              event.schoolId === where.schoolId
              && event.credentialId === where.credentialId
              && event.direction === where.direction
              && event.scannedAt >= where.scannedAt.gte,
          )
          .sort((a, b) => b.scannedAt.getTime() - a.scannedAt.getTime())[0] ?? null,
      create: async ({ data }: { data: Omit<AttendanceEventRow, "id"> }) => {
        const row = { id: `event-${events.length + 1}`, ...data };
        events.push(row);
        return row;
      },
    },
  };

  return { db: db as never, events };
}

describe("student credential attendance scanning", () => {
  it("records an active NFC wristband tap-in with safe student details", async () => {
    const { db, events } = createAttendanceDb();

    const result = await scanStudentAttendance(
      { schoolId: "school-a" },
      { credentialUID: " ab12 ", direction: AttendanceDirection.TAP_IN, scannedAt: new Date("2026-06-21T08:00:00.000Z") },
      db,
    );

    expect(result).toMatchObject({
      status: "RECORDED",
      student: {
        id: "student-a",
        name: "Ada Lovelace",
        admissionNumber: "A-001",
        className: "Senior 1",
        streamName: "A",
      },
      event: {
        direction: "TAP_IN",
        scanSource: "NFC_WRISTBAND",
      },
    });
    expect(events[0]).toMatchObject({
      schoolId: "school-a",
      studentId: "student-a",
      credentialId: "credential-active",
      classId: "class-a",
      streamId: "stream-a",
    });
    expect(result.student).not.toHaveProperty("guardianContacts");
  });

  it("records tap-out separately", async () => {
    const { db, events } = createAttendanceDb();

    const result = await scanStudentAttendance(
      { schoolId: "school-a" },
      { credentialUID: "AB12", direction: AttendanceDirection.TAP_OUT, scannedAt: new Date("2026-06-21T16:00:00.000Z") },
      db,
    );

    expect(result).toMatchObject({ status: "RECORDED", event: { direction: "TAP_OUT" } });
    expect(events[0].direction).toBe(AttendanceDirection.TAP_OUT);
  });

  it("prevents duplicate tap-ins within the short window", async () => {
    const { db, events } = createAttendanceDb();
    events.push({
      id: "event-existing",
      schoolId: "school-a",
      studentId: "student-a",
      credentialId: "credential-active",
      classId: "class-a",
      streamId: "stream-a",
      direction: AttendanceDirection.TAP_IN,
      scanSource: AttendanceScanSource.NFC_WRISTBAND,
      scannedAt: new Date("2026-06-21T08:00:00.000Z"),
    });

    const result = await scanStudentAttendance(
      { schoolId: "school-a" },
      { credentialUID: "AB12", direction: AttendanceDirection.TAP_IN, scannedAt: new Date("2026-06-21T08:01:00.000Z") },
      db,
    );

    expect(result).toMatchObject({ status: "DUPLICATE_TAP_IN", event: { duplicateOf: "event-existing" } });
    expect(events).toHaveLength(1);
  });

  it("blocks attendance for a deactivated wristband", async () => {
    const { db, events } = createAttendanceDb();

    await expect(scanStudentAttendance({ schoolId: "school-a" }, { credentialUID: "LOST1" }, db)).resolves.toMatchObject({
      status: "DEACTIVATED",
      credential: { id: "credential-deactivated" },
    });
    expect(events).toHaveLength(0);
  });

  it("keeps attendance scans isolated by school", async () => {
    const { db, events } = createAttendanceDb();

    await expect(scanStudentAttendance({ schoolId: "school-b" }, { credentialUID: "AB12" }, db)).resolves.toEqual({
      status: "NOT_FOUND",
    });
    expect(events).toHaveLength(0);
  });

  it("blocks attendance for an inactive student", async () => {
    const { db, events } = createAttendanceDb();

    await expect(scanStudentAttendance({ schoolId: "school-a" }, { credentialUID: "INACTIVE1" }, db)).resolves.toMatchObject({
      status: "STUDENT_INACTIVE",
      student: { id: "student-inactive" },
    });
    expect(events).toHaveLength(0);
  });
});
