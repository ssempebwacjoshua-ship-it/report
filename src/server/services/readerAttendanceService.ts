import type { Prisma } from "@prisma/client";
import { CredentialStatus, CredentialType, GateScanResult } from "@prisma/client";
import { prisma as defaultPrisma } from "../db/prisma";
import {
  attendanceProfileToLegacyStudentType,
  resolveAttendanceProfile,
  type AttendanceProfile,
} from "../../shared/attendanceProfiles";
import { maskCredentialValue, normalizeCredentialForLookup } from "../../shared/utils/credentialNormalization";
import { getTimeParts, getZonedDateKey, zonedDateToUtc } from "./nfcPolicyService";

export type ReaderGatewayResponse = {
  success: boolean;
  action: string;
  status?: string;
  message: string;
  beep: "success" | "duplicate" | "warning" | "error" | "none";
  studentName?: string;
  feedback: { beep: "success" | "duplicate" | "warning" | "error" | "none" };
};

export type LocationAwareReaderDevice = {
  id: string;
  schoolId: string;
  deviceKey: string;
  name: string;
  location: string | null;
  locationType: string | null;
  locationName: string | null;
  mode: string;
  attendanceMode: string | null;
  studentScope: string | null;
  classId: string | null;
  streamId: string | null;
  direction: string | null;
  roleScope: string;
  isActive: boolean;
  status: string;
};

type EventBody = {
  eventId: string;
  credential?: string;
  credentialUID?: string;
  format?: string;
  rawWiegandBitCount?: number;
  rawWiegandHex?: string;
  rawWiegandDecimal?: string;
  facilityCode?: string;
  cardNumber?: string;
  deviceTime?: string;
  firmwareVersion?: string;
  retryCount?: number;
  syncStatus?: string;
};

type ReaderAttendanceDb = Pick<
  Prisma.TransactionClient,
  "schoolNfcPolicy" | "studentCredential" | "nfcTag" | "studentFeeHold" | "studentGateHold" | "dailyAttendance" | "campusMovementEvent" | "classroomAttendanceEvent" | "nfcGateScan"
>;

type ResolvedStudent = {
  studentId: string;
  studentName: string;
  attendanceProfile: AttendanceProfile;
  studentType: "DAY" | "BOARDING" | null;
  classId: string | null;
  streamId: string | null;
  credentialId: string | null;
  blockedReason: string | null;
};

type AttendancePolicy = {
  timezone: string;
  duplicateWindowSeconds: number;
  gateArrivalStart: string;
  gateArrivalLateAfter: string;
  gateArrivalEnd: string;
  morningClassroomStart: string;
  morningClassroomEnd: string;
  gateDepartureStart: string;
  gateDepartureEnd: string;
  nightPrepStart: string;
  nightPrepEnd: string;
  nightPrepBoardingOnly: boolean;
  allowAutomaticCheckout: boolean;
  recordUnclassifiedScans: boolean;
  feeGatePolicyEnabled: boolean;
};

type ProcessedReaderAttendance = {
  response: ReaderGatewayResponse;
  scannedAt: Date;
  statusCode: number;
};

function respond(
  action: string,
  status: string,
  message: string,
  beep: ReaderGatewayResponse["beep"],
  success = true,
  studentName?: string,
): ReaderGatewayResponse {
  return {
    success,
    action,
    status,
    message,
    beep,
    ...(studentName ? { studentName } : {}),
    feedback: { beep },
  };
}

export function isLocationAwareReader(device: LocationAwareReaderDevice) {
  return Boolean(device.locationType && (device.attendanceMode || device.locationType));
}

function effectiveAttendanceMode(device: LocationAwareReaderDevice) {
  return device.attendanceMode
    || (device.locationType === "GATE" ? "GATE_ATTENDANCE" : device.locationType === "CLASSROOM" ? "CLASSROOM_ATTENDANCE" : null);
}

function parseDeviceTime(value: string | undefined) {
  if (!value) return new Date();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

function addDays(dateKey: string, days: number) {
  const base = new Date(`${dateKey}T00:00:00Z`);
  base.setUTCDate(base.getUTCDate() + days);
  return base.toISOString().slice(0, 10);
}

function resolveWindow(occurredAt: Date, timeZone: string, startTime: string, endTime: string) {
  const parts = getTimeParts(occurredAt, timeZone);
  const localTime = `${String(parts.hour).padStart(2, "0")}:${String(parts.minute).padStart(2, "0")}`;
  const currentKey = getZonedDateKey(occurredAt, timeZone);
  if (endTime > startTime) {
    if (localTime >= startTime && localTime <= endTime) return { dateKey: currentKey };
    return null;
  }
  if (localTime >= startTime) return { dateKey: currentKey };
  if (localTime <= endTime) return { dateKey: addDays(currentKey, -1) };
  return null;
}

function attendanceDate(dateKey: string, timeZone: string) {
  const [year, month, day] = dateKey.split("-").map((part) => Number(part));
  return zonedDateToUtc(year, month, day, 0, 0, 0, timeZone);
}

function studentMatchesScope(device: LocationAwareReaderDevice, student: ResolvedStudent) {
  switch (device.studentScope) {
    case "DAY_SCHOLARS":
      return student.attendanceProfile !== "BOARDER";
    case "BOARDING_STUDENTS":
      return student.attendanceProfile === "BOARDER";
    case "ASSIGNED_CLASS":
      return (!device.classId || device.classId === student.classId)
        && (!device.streamId || device.streamId === student.streamId);
    case "ALL_STUDENTS":
    case null:
    case undefined:
      return true;
    default:
      return true;
  }
}

async function loadPolicy(schoolId: string, db: ReaderAttendanceDb): Promise<AttendancePolicy> {
  const policy = await db.schoolNfcPolicy.findUnique({ where: { schoolId } });
  return {
    timezone: policy?.timezone ?? "Africa/Kampala",
    duplicateWindowSeconds: policy?.duplicateWindowSeconds ?? 60,
    gateArrivalStart: policy?.gateArrivalStart ?? "05:30",
    gateArrivalLateAfter: policy?.gateArrivalLateAfter ?? "08:00",
    gateArrivalEnd: policy?.gateArrivalEnd ?? "10:00",
    morningClassroomStart: policy?.morningClassroomStart ?? "06:30",
    morningClassroomEnd: policy?.morningClassroomEnd ?? "10:00",
    gateDepartureStart: policy?.gateDepartureStart ?? "14:00",
    gateDepartureEnd: policy?.gateDepartureEnd ?? "19:00",
    nightPrepStart: policy?.nightPrepStart ?? "18:30",
    nightPrepEnd: policy?.nightPrepEnd ?? "22:30",
    nightPrepBoardingOnly: policy?.nightPrepBoardingOnly ?? true,
    allowAutomaticCheckout: policy?.allowAutomaticCheckout ?? false,
    recordUnclassifiedScans: policy?.recordUnclassifiedScans ?? true,
    feeGatePolicyEnabled: policy?.feeGatePolicyEnabled ?? false,
  };
}

async function resolveStudentForReader(
  schoolId: string,
  body: EventBody,
  db: ReaderAttendanceDb,
): Promise<ResolvedStudent | null> {
  const tokenOrUid = body.credentialUID ?? body.credential;
  if (!tokenOrUid) return null;
  const normalized = normalizeCredentialForLookup({
    value: tokenOrUid,
    cardNumber: body.cardNumber,
    facilityCode: body.facilityCode,
    rawWiegandDecimal: body.rawWiegandDecimal,
    rawWiegandHex: body.rawWiegandHex,
  });

  const credential = await db.studentCredential.findFirst({
    where: {
      schoolId,
      type: CredentialType.NFC_WRISTBAND,
      OR: [
        ...(normalized.tokenValues.length ? [{ scanToken: { in: normalized.tokenValues } }] : []),
        ...(normalized.lookupValues.length ? [{ credentialUID: { in: normalized.lookupValues } }] : []),
      ],
    },
    include: {
      student: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          attendanceProfile: true,
          studentType: true,
          isActive: true,
          enrollments: {
            where: { isActive: true, status: "ACTIVE" as const },
            orderBy: { createdAt: "desc" as const },
            take: 1,
            select: { classId: true, streamId: true },
          },
        },
      },
    },
  });
  if (credential) {
    return {
      studentId: credential.studentId,
      studentName: `${credential.student.firstName} ${credential.student.lastName}`.trim(),
      attendanceProfile: resolveAttendanceProfile(credential.student),
      studentType: attendanceProfileToLegacyStudentType(resolveAttendanceProfile(credential.student)),
      classId: credential.student.enrollments[0]?.classId ?? null,
      streamId: credential.student.enrollments[0]?.streamId ?? null,
      credentialId: credential.id,
      blockedReason: credential.status !== CredentialStatus.ACTIVE
        ? "Wristband is disabled"
        : !credential.student.isActive
          ? "Student is inactive"
          : null,
    };
  }

  const tag = await db.nfcTag.findFirst({
    where: {
      schoolId,
      OR: [
        ...(normalized.tokenValues.length ? [{ publicCode: { in: normalized.tokenValues } }] : []),
        ...(normalized.lookupValues.map((value) => ({ physicalUid: { equals: value, mode: "insensitive" as const } }))),
      ],
    },
    include: {
      student: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          attendanceProfile: true,
          studentType: true,
          isActive: true,
          enrollments: {
            where: { isActive: true, status: "ACTIVE" as const },
            orderBy: { createdAt: "desc" as const },
            take: 1,
            select: { classId: true, streamId: true },
          },
        },
      },
    },
  });
  if (!tag?.studentId || !tag.student) return null;
  return {
    studentId: tag.studentId,
    studentName: `${tag.student.firstName} ${tag.student.lastName}`.trim(),
    attendanceProfile: resolveAttendanceProfile(tag.student),
    studentType: attendanceProfileToLegacyStudentType(resolveAttendanceProfile(tag.student)),
    classId: tag.student.enrollments[0]?.classId ?? null,
    streamId: tag.student.enrollments[0]?.streamId ?? null,
    credentialId: null,
    blockedReason: tag.status === "DISABLED" || tag.status === "LOST"
      ? "Wristband is disabled"
      : !tag.student.isActive
        ? "Student is inactive"
        : null,
  };
}

async function hasActiveFeeHold(
  schoolId: string,
  studentId: string,
  db: ReaderAttendanceDb,
) {
  return db.studentFeeHold.findFirst({
    where: {
      schoolId,
      studentId,
      status: "ACTIVE",
    },
    orderBy: { updatedAt: "desc" },
  });
}

async function findApprovedGateOverride(
  schoolId: string,
  studentId: string,
  occurredAt: Date,
  db: ReaderAttendanceDb,
) {
  return db.studentGateHold.findFirst({
    where: {
      schoolId,
      studentId,
      status: "APPROVED",
      OR: [{ activeFrom: null }, { activeFrom: { lte: occurredAt } }],
      AND: [{ OR: [{ activeUntil: null }, { activeUntil: { gte: occurredAt } }] }],
    },
    orderBy: { updatedAt: "desc" },
  });
}

async function consumeApprovedGateOverride(
  hold: {
    id: string;
    schoolId: string;
    studentId: string;
  },
  occurredAt: Date,
  db: ReaderAttendanceDb,
) {
  const claimed = await db.studentGateHold.updateMany({
    where: {
      id: hold.id,
      schoolId: hold.schoolId,
      studentId: hold.studentId,
      status: "APPROVED",
      OR: [{ activeFrom: null }, { activeFrom: { lte: occurredAt } }],
      AND: [{ OR: [{ activeUntil: null }, { activeUntil: { gte: occurredAt } }] }],
    },
    data: {
      status: "CONSUMED",
      overrideUntil: occurredAt,
    },
  });
  return claimed.count === 1;
}

function isBoarder(student: ResolvedStudent) {
  return student.attendanceProfile === "BOARDER";
}

function shouldCreateDailyAttendanceFromGate(student: ResolvedStudent) {
  return !isBoarder(student);
}

function shouldCreateDailyAttendanceFromClassroom(student: ResolvedStudent, sessionType: "MORNING_CLASS" | "NIGHT_PREP") {
  return sessionType === "MORNING_CLASS" && isBoarder(student);
}

async function upsertDailyAttendance(
  schoolId: string,
  studentId: string,
  date: Date,
  status: "PRESENT" | "LATE",
  source: string,
  occurredAt: Date,
  db: ReaderAttendanceDb,
) {
  return db.dailyAttendance.upsert({
    where: {
      schoolId_studentId_attendanceDate: {
        schoolId,
        studentId,
        attendanceDate: date,
      },
    },
    create: {
      schoolId,
      studentId,
      attendanceDate: date,
      status,
      firstRecordedAt: occurredAt,
      source,
    },
    update: {},
  });
}

async function processGateAttendance(
  device: LocationAwareReaderDevice,
  student: ResolvedStudent,
  body: EventBody,
  scannedAt: Date,
  policy: AttendancePolicy,
  db: ReaderAttendanceDb,
): Promise<ProcessedReaderAttendance> {
  const arrivalWindow = resolveWindow(scannedAt, policy.timezone, policy.gateArrivalStart, policy.gateArrivalEnd);
  const departureWindow = resolveWindow(scannedAt, policy.timezone, policy.gateDepartureStart, policy.gateDepartureEnd);
  const duplicateCutoff = new Date(scannedAt.getTime() - (policy.duplicateWindowSeconds * 1000));
  const dayKey = getZonedDateKey(scannedAt, policy.timezone);
  const dailyDate = attendanceDate(dayKey, policy.timezone);

  const recentMovement = await db.campusMovementEvent.findFirst({
    where: {
      schoolId: device.schoolId,
      studentId: student.studentId,
      occurredAt: { gte: duplicateCutoff, lte: scannedAt },
    },
    orderBy: { occurredAt: "desc" },
  });

  if (arrivalWindow) {
    if (!studentMatchesScope(device, student)) {
      return {
        response: respond("GATE_ENTRY", "NOT_ELIGIBLE", "Student is not allowed at this gate", "error", false, student.studentName),
        scannedAt,
        statusCode: 403,
      };
    }
    if (recentMovement?.type === "GATE_ENTRY") {
      return {
        response: respond("ATTENDANCE", "DUPLICATE", "Attendance already recorded", "duplicate", true, student.studentName),
        scannedAt,
        statusCode: 200,
      };
    }
    let feeHold = policy.feeGatePolicyEnabled && shouldCreateDailyAttendanceFromGate(student)
      ? await hasActiveFeeHold(device.schoolId, student.studentId, db)
      : null;
    let approvedOverride = feeHold
      ? await findApprovedGateOverride(device.schoolId, student.studentId, scannedAt, db)
      : null;

    if (approvedOverride) {
      const claimed = await consumeApprovedGateOverride({
        id: approvedOverride.id,
        schoolId: device.schoolId,
        studentId: student.studentId,
      }, scannedAt, db);
      if (!claimed) {
        approvedOverride = null;
        feeHold = policy.feeGatePolicyEnabled && shouldCreateDailyAttendanceFromGate(student)
          ? await hasActiveFeeHold(device.schoolId, student.studentId, db)
          : null;
      }
    }

    if (feeHold && !approvedOverride) {
      await db.campusMovementEvent.create({
        data: {
          eventId: body.eventId,
          schoolId: device.schoolId,
          studentId: student.studentId,
          readerId: device.id,
          type: "RESTRICTED_ENTRY_ATTEMPT",
          occurredAt: scannedAt,
          deviceTime: scannedAt,
          offlineSynced: Boolean(body.syncStatus),
          metadata: { locationType: device.locationType, locationName: device.locationName ?? device.location ?? null },
        },
      });
      return {
        response: respond("GATE_ENTRY", "FEES_HOLD", "Please report to the school office", "error", false, student.studentName),
        scannedAt,
        statusCode: 403,
      };
    }

    if (approvedOverride) {
      await db.campusMovementEvent.create({
        data: {
          eventId: `${body.eventId}:override`,
          schoolId: device.schoolId,
          studentId: student.studentId,
          readerId: device.id,
          type: "MANUAL_GATE_OVERRIDE",
          occurredAt: scannedAt,
          deviceTime: scannedAt,
          offlineSynced: Boolean(body.syncStatus),
          metadata: {
            locationType: device.locationType,
            locationName: device.locationName ?? device.location ?? null,
            gateHoldId: approvedOverride.id,
            overrideReason: approvedOverride.overrideReason ?? approvedOverride.reason ?? null,
          },
        },
      });
    }

    const timeString = `${String(getTimeParts(scannedAt, policy.timezone).hour).padStart(2, "0")}:${String(getTimeParts(scannedAt, policy.timezone).minute).padStart(2, "0")}`;
    const dailyStatus = timeString >= policy.gateArrivalLateAfter ? "LATE" : "PRESENT";
    if (shouldCreateDailyAttendanceFromGate(student)) {
      await upsertDailyAttendance(device.schoolId, student.studentId, dailyDate, dailyStatus, "GATE_READER", scannedAt, db);
    }
    await db.campusMovementEvent.create({
      data: {
        eventId: body.eventId,
        schoolId: device.schoolId,
        studentId: student.studentId,
        readerId: device.id,
        type: "GATE_ENTRY",
        occurredAt: scannedAt,
        deviceTime: scannedAt,
        offlineSynced: Boolean(body.syncStatus),
        metadata: {
          locationType: device.locationType,
          locationName: device.locationName ?? device.location ?? null,
          attendanceStatus: shouldCreateDailyAttendanceFromGate(student) ? dailyStatus : "MOVEMENT_ONLY",
          manualOverride: Boolean(approvedOverride),
        },
      },
    });
    return {
      response: shouldCreateDailyAttendanceFromGate(student)
        ? respond("GATE_ENTRY", dailyStatus, dailyStatus === "LATE" ? "Late arrival recorded" : "Arrival recorded", "success", true, student.studentName)
        : respond("GATE_ENTRY", "MOVEMENT_RECORDED", "Campus entry recorded", "success", true, student.studentName),
      scannedAt,
      statusCode: 200,
    };
  }

  if (departureWindow) {
    const dayStart = attendanceDate(departureWindow.dateKey, policy.timezone);
    const nextDay = new Date(dayStart);
    nextDay.setUTCDate(nextDay.getUTCDate() + 1);
    const attendanceToday = await db.dailyAttendance.findFirst({
      where: {
        schoolId: device.schoolId,
        studentId: student.studentId,
        attendanceDate: dayStart,
      },
    });
    const movementToday = await db.campusMovementEvent.findFirst({
      where: {
        schoolId: device.schoolId,
        studentId: student.studentId,
        occurredAt: { gte: dayStart, lt: nextDay },
        type: { in: ["GATE_ENTRY", "MANUAL_GATE_OVERRIDE", "GATE_EXIT"] },
      },
      orderBy: { occurredAt: "desc" },
    });
    if (recentMovement?.type === "GATE_EXIT") {
      return {
        response: respond("ATTENDANCE", "DUPLICATE", "Attendance already recorded", "duplicate", true, student.studentName),
        scannedAt,
        statusCode: 200,
      };
    }
    if (movementToday?.type === "GATE_ENTRY" || movementToday?.type === "MANUAL_GATE_OVERRIDE" || attendanceToday) {
      await db.campusMovementEvent.create({
        data: {
          eventId: body.eventId,
          schoolId: device.schoolId,
          studentId: student.studentId,
          readerId: device.id,
          type: "GATE_EXIT",
          occurredAt: scannedAt,
          deviceTime: scannedAt,
          offlineSynced: Boolean(body.syncStatus),
          metadata: { locationType: device.locationType, locationName: device.locationName ?? device.location ?? null },
        },
      });
      return {
        response: respond("GATE_EXIT", "DEPARTED", "Departure recorded", "success", true, student.studentName),
        scannedAt,
        statusCode: 200,
      };
    }
  }

  if (policy.recordUnclassifiedScans) {
    await db.campusMovementEvent.create({
      data: {
        eventId: body.eventId,
        schoolId: device.schoolId,
        studentId: student.studentId,
        readerId: device.id,
        type: "UNCLASSIFIED_GATE_SCAN",
        occurredAt: scannedAt,
        deviceTime: scannedAt,
        offlineSynced: Boolean(body.syncStatus),
        metadata: { locationType: device.locationType, locationName: device.locationName ?? device.location ?? null },
      },
    });
  }
  return {
    response: respond("GATE_SCAN", "UNCLASSIFIED", "Scan recorded for review", "duplicate", true, student.studentName),
    scannedAt,
    statusCode: 200,
  };
}

async function processClassroomAttendance(
  device: LocationAwareReaderDevice,
  student: ResolvedStudent,
  body: EventBody,
  scannedAt: Date,
  policy: AttendancePolicy,
  db: ReaderAttendanceDb,
): Promise<ProcessedReaderAttendance> {
  if (!device.classId) {
    return {
      response: respond("CLASSROOM_ATTENDANCE", "MISCONFIGURED", "Classroom reader is missing class assignment", "error", false),
      scannedAt,
      statusCode: 409,
    };
  }
  const morningWindow = resolveWindow(scannedAt, policy.timezone, policy.morningClassroomStart, policy.morningClassroomEnd);
  const nightPrepWindow = resolveWindow(scannedAt, policy.timezone, policy.nightPrepStart, policy.nightPrepEnd);
  const duplicateCutoff = new Date(scannedAt.getTime() - (policy.duplicateWindowSeconds * 1000));

  let sessionType: "MORNING_CLASS" | "NIGHT_PREP" | null = null;
  let sessionDateKey: string | null = null;
  if (morningWindow) {
    sessionType = "MORNING_CLASS";
    sessionDateKey = morningWindow.dateKey;
  } else if (nightPrepWindow) {
    sessionType = "NIGHT_PREP";
    sessionDateKey = nightPrepWindow.dateKey;
  }

  if (!sessionType || !sessionDateKey) {
    if (policy.recordUnclassifiedScans) {
      await db.classroomAttendanceEvent.create({
        data: {
          eventId: body.eventId,
          schoolId: device.schoolId,
          studentId: student.studentId,
          readerId: device.id,
          classId: device.classId,
          streamId: device.streamId,
          sessionDate: attendanceDate(getZonedDateKey(scannedAt, policy.timezone), policy.timezone),
          sessionType: "UNCLASSIFIED",
          status: "SESSION_CLOSED",
          occurredAt: scannedAt,
          deviceTime: scannedAt,
          metadata: { locationName: device.locationName ?? device.location ?? null },
        },
      });
    }
    return {
      response: respond("CLASSROOM_ATTENDANCE", "SESSION_CLOSED", "Scan recorded for review", "duplicate", false, student.studentName),
      scannedAt,
      statusCode: 409,
    };
  }

  if (sessionType === "NIGHT_PREP" && policy.nightPrepBoardingOnly && !isBoarder(student)) {
    await db.classroomAttendanceEvent.create({
      data: {
        eventId: body.eventId,
        schoolId: device.schoolId,
        studentId: student.studentId,
        readerId: device.id,
        classId: device.classId,
        streamId: device.streamId,
        sessionDate: attendanceDate(sessionDateKey, policy.timezone),
        sessionType,
        status: "NOT_ELIGIBLE",
        occurredAt: scannedAt,
        deviceTime: scannedAt,
        metadata: { locationName: device.locationName ?? device.location ?? null },
      },
    });
    return {
      response: respond("CLASSROOM_ATTENDANCE", "DAY_SCHOLAR_NOT_ELIGIBLE", "Day scholars are not eligible for night prep", "error", false, student.studentName),
      scannedAt,
      statusCode: 403,
    };
  }

  if (!studentMatchesScope(device, student)) {
    const status = sessionType === "NIGHT_PREP" && !isBoarder(student) ? "DAY_SCHOLAR_NOT_ELIGIBLE" : "WRONG_CLASS";
    const message = status === "WRONG_CLASS" ? "Student is not assigned to this classroom" : "Day scholars are not eligible for night prep";
    await db.classroomAttendanceEvent.create({
      data: {
        eventId: body.eventId,
        schoolId: device.schoolId,
        studentId: student.studentId,
        readerId: device.id,
        classId: device.classId,
        streamId: device.streamId,
        sessionDate: attendanceDate(sessionDateKey, policy.timezone),
        sessionType,
        status: status === "WRONG_CLASS" ? "WRONG_CLASS" : "NOT_ELIGIBLE",
        occurredAt: scannedAt,
        deviceTime: scannedAt,
        metadata: { locationName: device.locationName ?? device.location ?? null },
      },
    });
    return {
      response: respond("CLASSROOM_ATTENDANCE", status, message, "error", false, student.studentName),
      scannedAt,
      statusCode: 403,
    };
  }

  const duplicate = await db.classroomAttendanceEvent.findFirst({
    where: {
      schoolId: device.schoolId,
      studentId: student.studentId,
      readerId: device.id,
      sessionType,
      sessionDate: attendanceDate(sessionDateKey, policy.timezone),
      occurredAt: { gte: duplicateCutoff, lte: scannedAt },
      status: { in: ["PRESENT", "DUPLICATE"] },
    },
    orderBy: { occurredAt: "desc" },
  });
  if (duplicate) {
    return {
      response: respond("ATTENDANCE", "DUPLICATE", "Attendance already recorded", "duplicate", true, student.studentName),
      scannedAt,
      statusCode: 200,
    };
  }

  await db.classroomAttendanceEvent.create({
    data: {
      eventId: body.eventId,
      schoolId: device.schoolId,
      studentId: student.studentId,
      readerId: device.id,
      classId: device.classId,
      streamId: device.streamId,
      sessionDate: attendanceDate(sessionDateKey, policy.timezone),
      sessionType,
      status: "PRESENT",
      occurredAt: scannedAt,
      deviceTime: scannedAt,
      metadata: { locationName: device.locationName ?? device.location ?? null },
    },
  });
  if (shouldCreateDailyAttendanceFromClassroom(student, sessionType)) {
    await upsertDailyAttendance(device.schoolId, student.studentId, attendanceDate(sessionDateKey, policy.timezone), "PRESENT", "CLASSROOM_READER", scannedAt, db);
  }
  return {
    response: respond(
      "CLASSROOM_ATTENDANCE",
      sessionType === "MORNING_CLASS" ? "MORNING_CLASS_PRESENT" : "NIGHT_PREP_PRESENT",
      sessionType === "MORNING_CLASS" ? "Morning attendance recorded" : "Night prep attendance recorded",
      "success",
      true,
      student.studentName,
    ),
    scannedAt,
    statusCode: 200,
  };
}

export async function processLocationAwareReaderEvent(
  device: LocationAwareReaderDevice,
  body: EventBody,
  db: ReaderAttendanceDb = defaultPrisma,
): Promise<ProcessedReaderAttendance> {
  const scannedAt = parseDeviceTime(body.deviceTime);
  const policy = await loadPolicy(device.schoolId, db);
  const student = await resolveStudentForReader(device.schoolId, body, db);
  if (!student) {
    await db.nfcGateScan.create({
      data: {
        schoolId: device.schoolId,
        studentId: null,
        credentialId: null,
        scannedByUserId: null,
        result: GateScanResult.BLOCKED,
        reason: "Unassigned NFC card",
      },
    });
    return {
      response: respond("ATTENDANCE", "UNKNOWN_CREDENTIAL", "Wristband not registered", "error", false),
      scannedAt,
      statusCode: 404,
    };
  }
  if (student.blockedReason) {
    return {
      response: respond("ATTENDANCE", "BLOCKED", student.blockedReason, "error", false, student.studentName),
      scannedAt,
      statusCode: 403,
    };
  }
  const attendanceMode = effectiveAttendanceMode(device);
  if (device.locationType === "GATE" && attendanceMode === "GATE_ATTENDANCE") {
    return processGateAttendance(device, student, body, scannedAt, policy, db);
  }
  if (device.locationType === "CLASSROOM" && attendanceMode === "CLASSROOM_ATTENDANCE") {
    return processClassroomAttendance(device, student, body, scannedAt, policy, db);
  }
  return {
    response: respond("ATTENDANCE", "MISCONFIGURED", "Reader attendance configuration is incomplete", "error", false),
    scannedAt,
    statusCode: 409,
  };
}

export function buildReaderCredentialDiagnostics(body: EventBody) {
  const tokenOrUid = body.credentialUID ?? body.credential ?? "";
  const normalized = normalizeCredentialForLookup({
    value: tokenOrUid,
    cardNumber: body.cardNumber,
    facilityCode: body.facilityCode,
    rawWiegandDecimal: body.rawWiegandDecimal,
    rawWiegandHex: body.rawWiegandHex,
  });
  return {
    receivedMasked: tokenOrUid ? maskCredentialValue(tokenOrUid) : null,
    normalizedMasked: tokenOrUid ? maskCredentialValue(normalized.canonical) : null,
    lookupCount: normalized.lookupValues.length,
    format: body.format ?? null,
    rawWiegandBitCount: body.rawWiegandBitCount ?? null,
    rawWiegandHexMasked: maskCredentialValue(body.rawWiegandHex),
    facilityCodeMasked: maskCredentialValue(body.facilityCode),
    cardNumberMasked: maskCredentialValue(body.cardNumber),
  };
}
