import type { PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "../db/prisma";
import { hasPermission } from "../../shared/permissions";
import { getSchoolNfcPolicy, getZonedDateKey, getZonedDayRangeByKey } from "./nfcPolicyService";

type AttendanceContext = {
  schoolId?: string | null;
  actorId?: string | null;
  role?: string | null;
};

type AttendanceDb = Pick<
  PrismaClient,
  | "schoolNfcPolicy"
  | "student"
  | "studentFeeHold"
  | "studentGateHold"
  | "dailyAttendance"
  | "campusMovementEvent"
  | "classroomAttendanceEvent"
  | "nfcOfflineDevice"
  | "auditLog"
>;

export type LocationAttendanceFilters = {
  date?: string;
  classId?: string;
  streamId?: string;
  search?: string;
  studentType?: "ALL" | "DAY" | "BOARDING";
};

export type GateAttendanceFilters = LocationAttendanceFilters & {
  attendanceStatus?: "ALL" | "PRESENT" | "LATE" | "ABSENT";
  campusStatus?: "ALL" | "ON_CAMPUS" | "OFF_CAMPUS";
  departureMissing?: boolean;
};

export type ClassroomAttendanceFilters = LocationAttendanceFilters & {
  sessionType?: "ALL" | "MORNING_CLASS" | "NIGHT_PREP" | "UNCLASSIFIED";
};

export type GateAttendanceRow = {
  studentId: string;
  studentName: string;
  admissionNumber: string;
  className: string | null;
  streamName: string | null;
  scholarType: "DAY" | "BOARDING" | null;
  attendanceStatus: "PRESENT" | "LATE" | "ABSENT";
  arrivalTime: string | null;
  lateIndicator: boolean;
  departureTime: string | null;
  departureNotRecorded: boolean;
  campusStatus: "ON_CAMPUS" | "OFF_CAMPUS";
  feeHoldAttempt: boolean;
  manualOverride: boolean;
  readerUsed: string | null;
  offlineSynced: boolean;
  lastRestrictedAttemptAt: string | null;
};

export type GateAttendanceReport = {
  date: string;
  summary: {
    totalStudents: number;
    present: number;
    late: number;
    absent: number;
    onCampus: number;
    offCampus: number;
    departureMissing: number;
    restrictedAttempts: number;
    manualOverrides: number;
  };
  rows: GateAttendanceRow[];
};

export type ClassroomAttendanceRow = {
  id: string;
  studentId: string;
  studentName: string;
  admissionNumber: string;
  className: string | null;
  streamName: string | null;
  scholarType: "DAY" | "BOARDING" | null;
  morningAttendance: boolean;
  nightPrepAttendance: boolean;
  missingBoarder: boolean;
  wrongClassAttempt: boolean;
  sessionClosedScan: boolean;
  readerUsed: string | null;
  originalDeviceTime: string;
  eventType: string;
  eventStatus: string;
};

export type ClassroomAttendanceReport = {
  date: string;
  summary: {
    totalEvents: number;
    morningPresent: number;
    nightPrepPresent: number;
    missingBoarders: number;
    wrongClassAttempts: number;
    sessionClosedScans: number;
  };
  rows: ClassroomAttendanceRow[];
};

function requireSchoolId(ctx: AttendanceContext) {
  if (!ctx.schoolId) {
    throw Object.assign(new Error("School context required."), { status: 401 });
  }
  return ctx.schoolId;
}

function requireAttendancePermission(ctx: AttendanceContext) {
  if (!ctx.actorId || !ctx.role) {
    throw Object.assign(new Error("Authentication required."), { status: 401 });
  }
  if (!hasPermission(ctx.role, "nfc.devices.manage") && !hasPermission(ctx.role, "app.admin")) {
    throw Object.assign(new Error("You do not have permission for this action."), { status: 403 });
  }
}

function requireOverridePermission(ctx: AttendanceContext) {
  if (!ctx.actorId || !ctx.role) {
    throw Object.assign(new Error("Authentication required."), { status: 401 });
  }
  if (!hasPermission(ctx.role, "app.admin")) {
    throw Object.assign(new Error("Only school administrators can approve gate overrides."), { status: 403 });
  }
}

function validateDate(date?: string) {
  if (!date) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw Object.assign(new Error("Date must use YYYY-MM-DD."), { status: 400 });
  }
  return date;
}

function buildStudentWhere(schoolId: string, filters: LocationAttendanceFilters) {
  const search = filters.search?.trim();
  return {
    schoolId,
    isActive: true,
    ...(filters.studentType && filters.studentType !== "ALL"
      ? { studentType: filters.studentType }
      : {}),
    ...(search
      ? {
          OR: [
            { firstName: { contains: search, mode: "insensitive" as const } },
            { lastName: { contains: search, mode: "insensitive" as const } },
            { admissionNumber: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {}),
    ...(filters.classId || filters.streamId
      ? {
          enrollments: {
            some: {
              isActive: true,
              status: "ACTIVE" as const,
              classId: filters.classId || undefined,
              streamId: filters.streamId || undefined,
            },
          },
        }
      : {}),
  };
}

function sortByName<T extends { studentName: string; admissionNumber?: string }>(rows: T[]) {
  return rows.sort((left, right) =>
    left.studentName.localeCompare(right.studentName, undefined, { sensitivity: "base" })
    || (left.admissionNumber ?? "").localeCompare(right.admissionNumber ?? "", undefined, { sensitivity: "base" }));
}

export async function listGateAttendanceReport(
  ctx: AttendanceContext,
  filters: GateAttendanceFilters = {},
  db: AttendanceDb = defaultPrisma,
): Promise<GateAttendanceReport> {
  const schoolId = requireSchoolId(ctx);
  requireAttendancePermission(ctx);
  const policy = await getSchoolNfcPolicy(ctx, db as never);
  const dateKey = validateDate(filters.date) ?? getZonedDateKey(new Date(), policy.policy.timezone);
  const { start, end } = getZonedDayRangeByKey(dateKey, policy.policy.timezone);

  const students = await db.student.findMany({
    where: buildStudentWhere(schoolId, filters),
    select: {
      id: true,
      admissionNumber: true,
      firstName: true,
      lastName: true,
      studentType: true,
      enrollments: {
        where: { isActive: true, status: "ACTIVE" as const },
        orderBy: { createdAt: "desc" as const },
        take: 1,
        include: {
          class: { select: { name: true } },
          stream: { select: { name: true } },
        },
      },
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });

  const studentIds = students.map((student) => student.id);
  if (studentIds.length === 0) {
    return {
      date: dateKey,
      summary: { totalStudents: 0, present: 0, late: 0, absent: 0, onCampus: 0, offCampus: 0, departureMissing: 0, restrictedAttempts: 0, manualOverrides: 0 },
      rows: [],
    };
  }

  const [dailyAttendances, movementEvents, readers] = await Promise.all([
    db.dailyAttendance.findMany({
      where: { schoolId, studentId: { in: studentIds }, attendanceDate: start },
      select: { studentId: true, status: true },
    }),
    db.campusMovementEvent.findMany({
      where: { schoolId, studentId: { in: studentIds }, occurredAt: { gte: start, lt: end } },
      orderBy: [{ occurredAt: "asc" }, { receivedAt: "asc" }],
      select: {
        id: true,
        studentId: true,
        readerId: true,
        type: true,
        occurredAt: true,
        offlineSynced: true,
      },
    }),
    db.nfcOfflineDevice.findMany({
      where: { schoolId },
      select: { id: true, name: true, locationName: true, location: true },
    }),
  ]);

  const dailyByStudent = new Map(dailyAttendances.map((row) => [row.studentId, row]));
  const readersById = new Map(readers.map((reader) => [reader.id, reader]));
  const eventsByStudent = new Map<string, typeof movementEvents>();
  for (const event of movementEvents) {
    const list = eventsByStudent.get(event.studentId) ?? [];
    list.push(event);
    eventsByStudent.set(event.studentId, list);
  }

  const rows = students.map((student) => {
    const enrollment = student.enrollments[0];
    const daily = dailyByStudent.get(student.id);
    const events = eventsByStudent.get(student.id) ?? [];
    const arrival = events.find((event) => event.type === "GATE_ENTRY") ?? null;
    const departure = [...events].reverse().find((event) => event.type === "GATE_EXIT") ?? null;
    const restrictedAttempt = [...events].reverse().find((event) => event.type === "RESTRICTED_ENTRY_ATTEMPT") ?? null;
    const manualOverride = events.some((event) => event.type === "MANUAL_GATE_OVERRIDE");
    const readerNames = [arrival?.readerId, departure?.readerId]
      .filter((value): value is string => Boolean(value))
      .map((readerId) => {
        const reader = readersById.get(readerId);
        return reader?.locationName ?? reader?.location ?? reader?.name ?? null;
      })
      .filter((value): value is string => Boolean(value));
    const attendanceStatus = (daily?.status as "PRESENT" | "LATE" | undefined) ?? "ABSENT";
    const departureNotRecorded = Boolean(arrival && !departure);
    const campusStatus = departure ? "OFF_CAMPUS" : arrival ? "ON_CAMPUS" : "OFF_CAMPUS";
    return {
      studentId: student.id,
      studentName: `${student.firstName} ${student.lastName}`.trim(),
      admissionNumber: student.admissionNumber,
      className: enrollment?.class?.name ?? null,
      streamName: enrollment?.stream?.name ?? null,
      scholarType: student.studentType,
      attendanceStatus,
      arrivalTime: arrival?.occurredAt.toISOString() ?? null,
      lateIndicator: attendanceStatus === "LATE",
      departureTime: departure?.occurredAt.toISOString() ?? null,
      departureNotRecorded,
      campusStatus,
      feeHoldAttempt: Boolean(restrictedAttempt),
      manualOverride,
      readerUsed: readerNames.length > 0 ? readerNames.join(" -> ") : null,
      offlineSynced: events.some((event) => event.offlineSynced),
      lastRestrictedAttemptAt: restrictedAttempt?.occurredAt.toISOString() ?? null,
    } satisfies GateAttendanceRow;
  }).filter((row) => {
    if (filters.attendanceStatus && filters.attendanceStatus !== "ALL" && row.attendanceStatus !== filters.attendanceStatus) return false;
    if (filters.campusStatus && filters.campusStatus !== "ALL" && row.campusStatus !== filters.campusStatus) return false;
    if (filters.departureMissing && !row.departureNotRecorded) return false;
    return true;
  });

  sortByName(rows);

  return {
    date: dateKey,
    summary: {
      totalStudents: rows.length,
      present: rows.filter((row) => row.attendanceStatus === "PRESENT").length,
      late: rows.filter((row) => row.attendanceStatus === "LATE").length,
      absent: rows.filter((row) => row.attendanceStatus === "ABSENT").length,
      onCampus: rows.filter((row) => row.campusStatus === "ON_CAMPUS").length,
      offCampus: rows.filter((row) => row.campusStatus === "OFF_CAMPUS").length,
      departureMissing: rows.filter((row) => row.departureNotRecorded).length,
      restrictedAttempts: rows.filter((row) => row.feeHoldAttempt).length,
      manualOverrides: rows.filter((row) => row.manualOverride).length,
    },
    rows,
  };
}

export async function listClassroomAttendanceReport(
  ctx: AttendanceContext,
  filters: ClassroomAttendanceFilters = {},
  db: AttendanceDb = defaultPrisma,
): Promise<ClassroomAttendanceReport> {
  const schoolId = requireSchoolId(ctx);
  requireAttendancePermission(ctx);
  const policy = await getSchoolNfcPolicy(ctx, db as never);
  const dateKey = validateDate(filters.date) ?? getZonedDateKey(new Date(), policy.policy.timezone);
  const { start, end } = getZonedDayRangeByKey(dateKey, policy.policy.timezone);

  const students = await db.student.findMany({
    where: buildStudentWhere(schoolId, filters),
    select: {
      id: true,
      admissionNumber: true,
      firstName: true,
      lastName: true,
      studentType: true,
      enrollments: {
        where: { isActive: true, status: "ACTIVE" as const },
        orderBy: { createdAt: "desc" as const },
        take: 1,
        include: {
          class: { select: { name: true } },
          stream: { select: { name: true } },
        },
      },
    },
  });
  const studentIds = students.map((student) => student.id);
  const readers = await db.nfcOfflineDevice.findMany({
    where: { schoolId, locationType: "CLASSROOM" },
    select: { id: true, name: true, locationName: true, location: true },
  });
  const readersById = new Map(readers.map((reader) => [reader.id, reader]));

  const events = studentIds.length === 0
    ? []
    : await db.classroomAttendanceEvent.findMany({
        where: {
          schoolId,
          studentId: { in: studentIds },
          sessionDate: start,
          ...(filters.sessionType && filters.sessionType !== "ALL" ? { sessionType: filters.sessionType } : {}),
        },
        orderBy: [{ occurredAt: "desc" }, { receivedAt: "desc" }],
        select: {
          id: true,
          studentId: true,
          readerId: true,
          sessionType: true,
          status: true,
          deviceTime: true,
        },
      });

  const studentMap = new Map(students.map((student) => [student.id, student]));
  const eventRows = events.map((event) => {
    const student = studentMap.get(event.studentId);
    const enrollment = student?.enrollments[0];
    const reader = readersById.get(event.readerId);
    return {
      id: event.id,
      studentId: event.studentId,
      studentName: student ? `${student.firstName} ${student.lastName}`.trim() : "Unknown student",
      admissionNumber: student?.admissionNumber ?? "-",
      className: enrollment?.class?.name ?? null,
      streamName: enrollment?.stream?.name ?? null,
      scholarType: student?.studentType ?? null,
      morningAttendance: event.sessionType === "MORNING_CLASS" && event.status === "PRESENT",
      nightPrepAttendance: event.sessionType === "NIGHT_PREP" && event.status === "PRESENT",
      missingBoarder: false,
      wrongClassAttempt: event.status === "WRONG_CLASS",
      sessionClosedScan: event.status === "SESSION_CLOSED",
      readerUsed: reader?.locationName ?? reader?.location ?? reader?.name ?? null,
      originalDeviceTime: event.deviceTime.toISOString(),
      eventType: event.sessionType,
      eventStatus: event.status,
    } satisfies ClassroomAttendanceRow;
  });

  const missingBoarders = students.filter((student) => {
    if (student.studentType !== "BOARDING") return false;
    return !events.some((event) => event.studentId === student.id && event.sessionType === "NIGHT_PREP" && event.status === "PRESENT");
  });

  for (const student of missingBoarders) {
    const enrollment = student.enrollments[0];
    eventRows.push({
      id: `missing-${student.id}`,
      studentId: student.id,
      studentName: `${student.firstName} ${student.lastName}`.trim(),
      admissionNumber: student.admissionNumber,
      className: enrollment?.class?.name ?? null,
      streamName: enrollment?.stream?.name ?? null,
      scholarType: student.studentType,
      morningAttendance: false,
      nightPrepAttendance: false,
      missingBoarder: true,
      wrongClassAttempt: false,
      sessionClosedScan: false,
      readerUsed: null,
      originalDeviceTime: start.toISOString(),
      eventType: "NIGHT_PREP",
      eventStatus: "MISSING_BOARDER",
    });
  }

  sortByName(eventRows);

  return {
    date: dateKey,
    summary: {
      totalEvents: eventRows.length,
      morningPresent: eventRows.filter((row) => row.morningAttendance).length,
      nightPrepPresent: eventRows.filter((row) => row.nightPrepAttendance).length,
      missingBoarders: eventRows.filter((row) => row.missingBoarder).length,
      wrongClassAttempts: eventRows.filter((row) => row.wrongClassAttempt).length,
      sessionClosedScans: eventRows.filter((row) => row.sessionClosedScan).length,
    },
    rows: eventRows,
  };
}

export async function approveGateOverride(
  ctx: AttendanceContext,
  input: { studentId: string; reason: string; expiresAt: string },
  db: AttendanceDb = defaultPrisma,
) {
  const schoolId = requireSchoolId(ctx);
  requireOverridePermission(ctx);
  const reason = input.reason.trim();
  if (!reason) {
    throw Object.assign(new Error("Override reason is required."), { status: 400 });
  }
  const expiresAt = new Date(input.expiresAt);
  if (Number.isNaN(expiresAt.getTime()) || expiresAt <= new Date()) {
    throw Object.assign(new Error("Override expiry must be a future date and time."), { status: 400 });
  }

  const policy = await getSchoolNfcPolicy(ctx, db as never);
  const student = await db.student.findFirst({
    where: { id: input.studentId, schoolId, isActive: true },
    select: { id: true, studentType: true, firstName: true, lastName: true },
  });
  if (!student) {
    throw Object.assign(new Error("Student not found."), { status: 404 });
  }
  if (!policy.policy.feeGatePolicyEnabled || student.studentType === "BOARDING") {
    throw Object.assign(new Error("Manual gate overrides only apply to fee-restricted day scholars."), { status: 409 });
  }

  const feeHold = await db.studentFeeHold.findFirst({
    where: { schoolId, studentId: student.id, status: "ACTIVE" },
    orderBy: { updatedAt: "desc" },
  });
  if (!feeHold) {
    throw Object.assign(new Error("Student does not have an active fee restriction."), { status: 409 });
  }

  const existing = await db.studentGateHold.findFirst({
    where: {
      schoolId,
      studentId: student.id,
      status: "APPROVED",
      activeUntil: { gte: new Date() },
    },
    orderBy: { updatedAt: "desc" },
  });
  if (existing) {
    return {
      gateOverride: {
        id: existing.id,
        status: existing.status,
        activeUntil: existing.activeUntil?.toISOString() ?? null,
      },
      idempotent: true,
    };
  }

  const created = await db.studentGateHold.create({
    data: {
      schoolId,
      studentId: student.id,
      status: "APPROVED",
      reason,
      requestedByUserId: ctx.actorId,
      approvedByUserId: ctx.actorId,
      activeFrom: new Date(),
      activeUntil: expiresAt,
      overrideReason: reason,
    },
  });

  await db.auditLog.create({
    data: {
      schoolId,
      action: "student_gate_override.approved",
      correlationId: created.id,
      details: {
        actorUserId: ctx.actorId,
        studentId: student.id,
        studentName: `${student.firstName} ${student.lastName}`.trim(),
        expiresAt: expiresAt.toISOString(),
        reason,
      },
    },
  });

  return {
    gateOverride: {
      id: created.id,
      status: created.status,
      activeUntil: created.activeUntil?.toISOString() ?? null,
    },
    idempotent: false,
  };
}
