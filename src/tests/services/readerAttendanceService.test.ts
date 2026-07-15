import { describe, expect, it } from "vitest";
import { processLocationAwareReaderEvent, type LocationAwareReaderDevice } from "../../server/services/readerAttendanceService";

type StudentRecord = {
  id: string;
  firstName: string;
  lastName: string;
  studentType: "DAY" | "BOARDING";
  isActive: boolean;
  classId: string | null;
  streamId: string | null;
};

function createDb(options: {
  studentType?: "DAY" | "BOARDING";
  classId?: string | null;
  streamId?: string | null;
  feeGatePolicyEnabled?: boolean;
  activeFeeHold?: boolean;
  approvedGateOverride?: boolean;
  overrideClaimSequence?: number[];
} = {}) {
  const student: StudentRecord = {
    id: "student-1",
    firstName: "Ada",
    lastName: "Lovelace",
    studentType: options.studentType ?? "DAY",
    isActive: true,
    classId: options.classId ?? "class-a",
    streamId: options.streamId ?? "stream-a",
  };
  const dailyAttendances: Array<Record<string, any>> = [];
  const campusMovementEvents: Array<Record<string, any>> = [];
  const classroomAttendanceEvents: Array<Record<string, any>> = [];
  const nfcGateScans: Array<Record<string, any>> = [];
  const feeHolds = options.activeFeeHold ? [{
    id: "fee-hold-1",
    schoolId: "school-1",
    studentId: student.id,
    status: "ACTIVE",
    updatedAt: new Date("2026-07-11T00:00:00.000Z"),
  }] : [];
  const gateHolds = options.approvedGateOverride ? [{
    id: "hold-1",
    schoolId: "school-1",
    studentId: student.id,
    status: "APPROVED",
    activeFrom: new Date("2026-07-11T00:00:00.000Z"),
    activeUntil: null,
    overrideUntil: null,
    updatedAt: new Date("2026-07-11T00:00:00.000Z"),
  }] : [];
  const overrideClaimSequence = [...(options.overrideClaimSequence ?? [])];

  return {
    schoolNfcPolicy: {
      findUnique: async () => ({
        schoolId: "school-1",
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
        feeGatePolicyEnabled: options.feeGatePolicyEnabled ?? false,
      }),
    },
    studentCredential: {
      findFirst: async () => ({
        id: "cred-1",
        studentId: student.id,
        status: "ACTIVE",
        student: {
          id: student.id,
          firstName: student.firstName,
          lastName: student.lastName,
          studentType: student.studentType,
          isActive: student.isActive,
          enrollments: [{ classId: student.classId, streamId: student.streamId }],
        },
      }),
    },
    nfcTag: {
      findFirst: async () => null,
    },
    studentFeeHold: {
      findFirst: async () => feeHolds[0] ?? null,
    },
    studentGateHold: {
      findFirst: async () => gateHolds[0] ?? null,
      updateMany: async ({ where, data }: { where: Record<string, any>; data: Record<string, any> }) => {
        const next = overrideClaimSequence.length > 0 ? overrideClaimSequence.shift() ?? 0 : null;
        if (next !== null) {
          if (next === 1) {
            const hold = gateHolds.find((item) => item.id === where.id);
            if (hold) Object.assign(hold, data);
          }
          return { count: next };
        }
        const hold = gateHolds.find((item) =>
          item.id === where.id
          && item.schoolId === where.schoolId
          && item.studentId === where.studentId
          && item.status === where.status);
        if (!hold) return { count: 0 };
        Object.assign(hold, data);
        return { count: 1 };
      },
    },
    dailyAttendance: {
      findFirst: async ({ where }: { where: { schoolId: string; studentId: string; attendanceDate: Date } }) =>
        dailyAttendances.find((item) => item.schoolId === where.schoolId
          && item.studentId === where.studentId
          && item.attendanceDate.getTime() === where.attendanceDate.getTime()) ?? null,
      upsert: async ({ where, create }: { where: { schoolId_studentId_attendanceDate: { schoolId: string; studentId: string; attendanceDate: Date } }; create: Record<string, any> }) => {
        const existing = dailyAttendances.find((item) => item.schoolId === where.schoolId_studentId_attendanceDate.schoolId
          && item.studentId === where.schoolId_studentId_attendanceDate.studentId
          && item.attendanceDate.getTime() === where.schoolId_studentId_attendanceDate.attendanceDate.getTime());
        if (existing) return existing;
        const row = { id: `daily-${dailyAttendances.length + 1}`, ...create };
        dailyAttendances.push(row);
        return row;
      },
    },
    campusMovementEvent: {
      findFirst: async ({ where, orderBy }: { where: Record<string, any>; orderBy?: { occurredAt: "desc" | "asc" } }) => {
        const filtered = campusMovementEvents.filter((item) => {
          if (where.schoolId && item.schoolId !== where.schoolId) return false;
          if (where.studentId && item.studentId !== where.studentId) return false;
          if (where.readerId && item.readerId !== where.readerId) return false;
          if (where.type?.in && !where.type.in.includes(item.type)) return false;
          if (where.occurredAt?.gte && item.occurredAt < where.occurredAt.gte) return false;
          if (where.occurredAt?.lte && item.occurredAt > where.occurredAt.lte) return false;
          if (where.occurredAt?.lt && item.occurredAt >= where.occurredAt.lt) return false;
          return true;
        });
        filtered.sort((a, b) => orderBy?.occurredAt === "asc" ? a.occurredAt.getTime() - b.occurredAt.getTime() : b.occurredAt.getTime() - a.occurredAt.getTime());
        return filtered[0] ?? null;
      },
      create: async ({ data }: { data: Record<string, any> }) => {
        const row = { id: `move-${campusMovementEvents.length + 1}`, ...data };
        campusMovementEvents.push(row);
        return row;
      },
    },
    classroomAttendanceEvent: {
      findFirst: async ({ where, orderBy }: { where: Record<string, any>; orderBy?: { occurredAt: "desc" | "asc" } }) => {
        const filtered = classroomAttendanceEvents.filter((item) => {
          if (where.schoolId && item.schoolId !== where.schoolId) return false;
          if (where.studentId && item.studentId !== where.studentId) return false;
          if (where.readerId && item.readerId !== where.readerId) return false;
          if (where.sessionType && item.sessionType !== where.sessionType) return false;
          if (where.sessionDate && item.sessionDate.getTime() !== where.sessionDate.getTime()) return false;
          if (where.status?.in && !where.status.in.includes(item.status)) return false;
          if (where.occurredAt?.gte && item.occurredAt < where.occurredAt.gte) return false;
          if (where.occurredAt?.lte && item.occurredAt > where.occurredAt.lte) return false;
          return true;
        });
        filtered.sort((a, b) => orderBy?.occurredAt === "asc" ? a.occurredAt.getTime() - b.occurredAt.getTime() : b.occurredAt.getTime() - a.occurredAt.getTime());
        return filtered[0] ?? null;
      },
      create: async ({ data }: { data: Record<string, any> }) => {
        const row = { id: `class-${classroomAttendanceEvents.length + 1}`, ...data };
        classroomAttendanceEvents.push(row);
        return row;
      },
    },
    nfcGateScan: {
      create: async ({ data }: { data: Record<string, any> }) => {
        const row = { id: `gate-${nfcGateScans.length + 1}`, scannedAt: new Date("2026-07-11T10:00:00.000Z"), ...data };
        nfcGateScans.push(row);
        return row;
      },
    },
    stores: {
      dailyAttendances,
      campusMovementEvents,
      classroomAttendanceEvents,
      nfcGateScans,
      gateHolds,
    },
  };
}

function gateReader(overrides: Partial<LocationAwareReaderDevice> = {}): LocationAwareReaderDevice {
  return {
    id: "reader-1",
    schoolId: "school-1",
    deviceKey: "attendance-gate-01",
    name: "Attendance Gate 01",
    location: "Main Gate",
    locationType: "GATE",
    locationName: "Main Gate",
    mode: "ATTENDANCE",
    attendanceMode: "GATE_ATTENDANCE",
    studentScope: "DAY_SCHOLARS",
    classId: null,
    streamId: null,
    direction: "ENTRY",
    roleScope: "ADMIN_OPERATOR",
    isActive: true,
    status: "ACTIVE",
    ...overrides,
  };
}

function classroomReader(overrides: Partial<LocationAwareReaderDevice> = {}): LocationAwareReaderDevice {
  return {
    ...gateReader(),
    id: "reader-2",
    deviceKey: "s1a-classroom-01",
    name: "Senior 1 A",
    locationType: "CLASSROOM",
    locationName: "Senior 1 A",
    attendanceMode: "CLASSROOM_ATTENDANCE",
    studentScope: "ASSIGNED_CLASS",
    classId: "class-a",
    streamId: "stream-a",
    ...overrides,
  };
}

describe("readerAttendanceService", () => {
  it("records a gate arrival and daily attendance for a day scholar", async () => {
    const db = createDb();
    const result = await processLocationAwareReaderEvent(gateReader(), {
      eventId: "event-1",
      credential: "WB-1",
      deviceTime: "2026-07-11T04:45:00.000Z",
    }, db as never);

    expect(result.statusCode).toBe(200);
    expect(result.response).toMatchObject({
      success: true,
      action: "GATE_ENTRY",
      status: "PRESENT",
      message: "Arrival recorded",
      beep: "success",
    });
    expect(db.stores.dailyAttendances).toHaveLength(1);
    expect(db.stores.campusMovementEvents[0]?.type).toBe("GATE_ENTRY");
  });

  it("treats a repeated arrival inside the duplicate window as duplicate", async () => {
    const db = createDb();
    await processLocationAwareReaderEvent(gateReader(), {
      eventId: "event-1",
      credential: "WB-1",
      deviceTime: "2026-07-11T04:45:00.000Z",
    }, db as never);
    const duplicate = await processLocationAwareReaderEvent(gateReader(), {
      eventId: "event-2",
      credential: "WB-1",
      deviceTime: "2026-07-11T04:45:30.000Z",
    }, db as never);

    expect(duplicate.response.status).toBe("DUPLICATE");
    expect(duplicate.response.beep).toBe("duplicate");
    expect(db.stores.campusMovementEvents).toHaveLength(1);
  });

  it("records a gate departure later without erasing the daily attendance", async () => {
    const db = createDb();
    await processLocationAwareReaderEvent(gateReader(), {
      eventId: "event-entry",
      credential: "WB-1",
      deviceTime: "2026-07-11T04:45:00.000Z",
    }, db as never);
    const departure = await processLocationAwareReaderEvent(gateReader(), {
      eventId: "event-2",
      credential: "WB-1",
      deviceTime: "2026-07-11T12:45:00.000Z",
    }, db as never);

    expect(departure.response).toMatchObject({
      success: true,
      action: "GATE_EXIT",
      status: "DEPARTED",
      message: "Departure recorded",
    });
    expect(db.stores.dailyAttendances).toHaveLength(1);
    expect(db.stores.campusMovementEvents.map((item) => item.type)).toEqual(["GATE_ENTRY", "GATE_EXIT"]);
  });

  it("records a late arrival after the configured threshold", async () => {
    const db = createDb();
    const result = await processLocationAwareReaderEvent(gateReader(), {
      eventId: "event-late",
      credential: "WB-1",
      deviceTime: "2026-07-11T05:30:00.000Z",
    }, db as never);

    expect(result.response.status).toBe("LATE");
    expect(db.stores.dailyAttendances[0]?.status).toBe("LATE");
  });

  it("records an unclassified daytime scan without changing attendance", async () => {
    const db = createDb();
    db.stores.dailyAttendances.push({
      id: "daily-1",
      schoolId: "school-1",
      studentId: "student-1",
      attendanceDate: new Date("2026-07-10T21:00:00.000Z"),
      status: "PRESENT",
      firstRecordedAt: new Date("2026-07-11T04:45:00.000Z"),
      source: "GATE_READER",
    });

    const result = await processLocationAwareReaderEvent(gateReader(), {
      eventId: "event-unclassified",
      credential: "WB-1",
      deviceTime: "2026-07-11T08:30:00.000Z",
    }, db as never);

    expect(result.statusCode).toBe(202);
    expect(result.response).toMatchObject({
      success: true,
      status: "UNCLASSIFIED",
      message: "Scan recorded for review",
      beep: "out_of_session",
    });
    expect(db.stores.dailyAttendances).toHaveLength(1);
    expect(db.stores.campusMovementEvents[0]?.type).toBe("UNCLASSIFIED_GATE_SCAN");
  });

  it("logs an unknown credential as a blocked gate scan instead of dropping it", async () => {
    const db = createDb();
    db.studentCredential.findFirst = async () => null;
    db.nfcTag.findFirst = async () => null;

    const result = await processLocationAwareReaderEvent(gateReader(), {
      eventId: "event-unknown",
      credential: "UNKNOWN-WRISTBAND",
      deviceTime: "2026-07-11T08:30:00.000Z",
    }, db as never);

    expect(result.response.status).toBe("UNKNOWN_CREDENTIAL");
    expect(result.statusCode).toBe(404);
    expect(result.response.beep).toBe("unknown");
    expect(db.stores.nfcGateScans).toHaveLength(1);
    expect(db.stores.nfcGateScans[0]).toMatchObject({
      schoolId: "school-1",
      studentId: null,
      credentialId: null,
      result: "BLOCKED",
      reason: "Unassigned NFC card",
    });
  });

  it("does not fabricate a departure outside the dismissal window", async () => {
    const db = createDb();
    db.stores.dailyAttendances.push({
      id: "daily-1",
      schoolId: "school-1",
      studentId: "student-1",
      attendanceDate: new Date("2026-07-10T21:00:00.000Z"),
      status: "PRESENT",
      firstRecordedAt: new Date("2026-07-11T04:45:00.000Z"),
      source: "GATE_READER",
    });

    const result = await processLocationAwareReaderEvent(gateReader(), {
      eventId: "event-no-departure",
      credential: "WB-1",
      deviceTime: "2026-07-11T11:30:00.000Z",
    }, db as never);

    expect(result.statusCode).toBe(202);
    expect(result.response).toMatchObject({
      success: true,
      status: "UNCLASSIFIED",
      beep: "out_of_session",
    });
    expect(db.stores.campusMovementEvents[0]?.type).toBe("UNCLASSIFIED_GATE_SCAN");
  });

  it("blocks a fee-restricted day scholar until an approved override is used", async () => {
    const blockedDb = createDb({ feeGatePolicyEnabled: true, activeFeeHold: true });
    const blocked = await processLocationAwareReaderEvent(gateReader(), {
      eventId: "event-fee-hold",
      credential: "WB-1",
      deviceTime: "2026-07-11T04:45:00.000Z",
    }, blockedDb as never);

    expect(blocked.statusCode).toBe(403);
    expect(blocked.response.status).toBe("FEES_HOLD");
    expect(blockedDb.stores.campusMovementEvents[0]?.type).toBe("RESTRICTED_ENTRY_ATTEMPT");

    const overrideDb = createDb({ feeGatePolicyEnabled: true, activeFeeHold: true, approvedGateOverride: true });
    const allowed = await processLocationAwareReaderEvent(gateReader(), {
      eventId: "event-override",
      credential: "WB-1",
      deviceTime: "2026-07-11T04:45:00.000Z",
    }, overrideDb as never);

    expect(allowed.statusCode).toBe(200);
    expect(overrideDb.stores.campusMovementEvents.map((item) => item.type)).toEqual(["MANUAL_GATE_OVERRIDE", "GATE_ENTRY"]);
    expect(overrideDb.stores.gateHolds[0]?.status).toBe("CONSUMED");
  });

  it("treats an override that loses the claim race as unavailable and keeps the fee restriction", async () => {
    const db = createDb({
      feeGatePolicyEnabled: true,
      activeFeeHold: true,
      approvedGateOverride: true,
      overrideClaimSequence: [0],
    });

    const result = await processLocationAwareReaderEvent(gateReader(), {
      eventId: "event-claim-race",
      credential: "WB-1",
      deviceTime: "2026-07-11T04:45:00.000Z",
    }, db as never);

    expect(result.statusCode).toBe(403);
    expect(result.response.status).toBe("FEES_HOLD");
    expect(db.stores.gateHolds[0]?.status).toBe("APPROVED");
    expect(db.stores.campusMovementEvents.map((item) => item.type)).toEqual(["RESTRICTED_ENTRY_ATTEMPT"]);
    expect(db.stores.dailyAttendances).toHaveLength(0);
  });

  it("does not allow a consumed override to be used again by a different event", async () => {
    const db = createDb({ feeGatePolicyEnabled: true, activeFeeHold: true, approvedGateOverride: true });

    const first = await processLocationAwareReaderEvent(gateReader(), {
      eventId: "event-override-first",
      credential: "WB-1",
      deviceTime: "2026-07-11T04:45:00.000Z",
    }, db as never);
    const second = await processLocationAwareReaderEvent(gateReader(), {
      eventId: "event-override-second",
      credential: "WB-1",
      deviceTime: "2026-07-11T04:46:30.000Z",
    }, db as never);

    expect(first.statusCode).toBe(200);
    expect(second.statusCode).toBe(403);
    expect(second.response.status).toBe("FEES_HOLD");
    expect(db.stores.campusMovementEvents.map((item) => item.type)).toEqual([
      "MANUAL_GATE_OVERRIDE",
      "GATE_ENTRY",
      "RESTRICTED_ENTRY_ATTEMPT",
    ]);
  });

  it("rejects a day scholar from night prep", async () => {
    const db = createDb({ studentType: "DAY" });
    const result = await processLocationAwareReaderEvent(classroomReader(), {
      eventId: "event-3",
      credential: "WB-1",
      deviceTime: "2026-07-11T16:00:00.000Z",
    }, db as never);

    expect(result.statusCode).toBe(403);
    expect(result.response.status).toBe("DAY_SCHOLAR_NOT_ELIGIBLE");
  });

  it("records morning classroom attendance for the assigned class without gate movement", async () => {
    const db = createDb({ studentType: "BOARDING" });
    const result = await processLocationAwareReaderEvent(classroomReader(), {
      eventId: "event-4",
      credential: "WB-1",
      deviceTime: "2026-07-11T05:00:00.000Z",
    }, db as never);

    expect(result.statusCode).toBe(200);
    expect(result.response.status).toBe("MORNING_CLASS_PRESENT");
    expect(db.stores.classroomAttendanceEvents).toHaveLength(1);
    expect(db.stores.campusMovementEvents).toHaveLength(0);
  });

  it("records classroom attendance for all students without requiring a class assignment", async () => {
    const db = createDb({ studentType: "BOARDING" });
    const result = await processLocationAwareReaderEvent(classroomReader({
      studentScope: "ALL_STUDENTS",
      classId: null,
      streamId: null,
    }), {
      eventId: "event-4b",
      credential: "WB-1",
      deviceTime: "2026-07-11T05:00:00.000Z",
    }, db as never);

    expect(result.statusCode).toBe(200);
    expect(result.response.status).toBe("MORNING_CLASS_PRESENT");
    expect(db.stores.classroomAttendanceEvents).toHaveLength(1);
    expect(db.stores.classroomAttendanceEvents[0]).toMatchObject({
      classId: null,
      streamId: null,
      status: "PRESENT",
    });
  });

  it("records only campus movement for a boarder gate scan", async () => {
    const db = createDb({ studentType: "BOARDING" });
    const result = await processLocationAwareReaderEvent(gateReader({ studentScope: "ALL_STUDENTS" }), {
      eventId: "event-boarder-gate",
      credential: "WB-1",
      deviceTime: "2026-07-11T04:45:00.000Z",
    }, db as never);

    expect(result.statusCode).toBe(200);
    expect(result.response).toMatchObject({
      success: true,
      action: "GATE_ENTRY",
      status: "MOVEMENT_RECORDED",
      message: "Campus entry recorded",
    });
    expect(db.stores.dailyAttendances).toHaveLength(0);
    expect(db.stores.campusMovementEvents.map((item) => item.type)).toEqual(["GATE_ENTRY"]);
  });

  it("does not let a day scholar classroom scan establish school-day attendance", async () => {
    const db = createDb({ studentType: "DAY" });
    const result = await processLocationAwareReaderEvent(classroomReader(), {
      eventId: "event-day-classroom",
      credential: "WB-1",
      deviceTime: "2026-07-11T05:00:00.000Z",
    }, db as never);

    expect(result.statusCode).toBe(200);
    expect(result.response.status).toBe("MORNING_CLASS_PRESENT");
    expect(db.stores.classroomAttendanceEvents).toHaveLength(1);
    expect(db.stores.dailyAttendances).toHaveLength(0);
  });

  it("records an after-hours classroom scan for review without flagging it as a duplicate failure", async () => {
    const db = createDb({ studentType: "BOARDING" });
    const result = await processLocationAwareReaderEvent(classroomReader(), {
      eventId: "event-after-hours-classroom",
      credential: "WB-1",
      deviceTime: "2026-07-11T20:50:00.000Z",
    }, db as never);

    expect(result.statusCode).toBe(202);
    expect(result.response).toMatchObject({
      success: true,
      action: "CLASSROOM_ATTENDANCE",
      status: "SESSION_CLOSED",
      message: "Scan recorded for review",
      beep: "out_of_session",
    });
    expect(db.stores.classroomAttendanceEvents).toHaveLength(1);
    expect(db.stores.classroomAttendanceEvents[0]).toMatchObject({
      sessionType: "UNCLASSIFIED",
      status: "SESSION_CLOSED",
    });
  });
});
