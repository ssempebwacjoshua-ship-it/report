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

export type DashboardAttendanceSummary = {
  date: string;
  timezone: string;
  totalStudents: number;
  present: number;
  absent: number;
  late: number;
  attendanceRate: number;
  onCampus: number;
  offCampus: number;
  lastUpdatedAt: string;
  latestScans?: Array<{
    studentId: string;
    studentName: string;
    admissionNumber: string;
    className: string | null;
    streamName: string | null;
    eventType: string;
    status: "PRESENT" | "LATE" | "DEPARTED" | "BLOCKED";
    occurredAt: string;
    readerUsed: string | null;
    offlineSynced: boolean;
  }>;
  classSummaries?: Array<{
    className: string;
    streamName: string | null;
    totalStudents: number;
    present: number;
    late: number;
    absent: number;
    onCampus: number;
    offCampus: number;
  }>;
};

export type AttendanceRegisterRow = {
  student: {
    id: string;
    name: string;
    admissionNumber: string;
    className: string | null;
    streamName: string | null;
    studentType: "DAY" | "BOARDING" | null;
    photoUrl: string | null;
  };
  tapIn: { id: string; scannedAt: string; source: string } | null;
  tapOut: { id: string; scannedAt: string; source: string } | null;
  lastScan: { id: string; direction: string; scannedAt: string; status: string; reason: string | null } | null;
  currentStatus: "ABSENT" | "PRESENT" | "LATE" | "OUT" | "OUT_ONLY" | "BLOCKED" | "DUPLICATE";
};

export type AttendanceRegisterResponse = {
  date: string;
  summary: {
    totalStudents: number;
    present: number;
    out: number;
    absent: number;
    blockedScans: number;
    duplicateScans: number;
  };
  rows: AttendanceRegisterRow[];
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

type PopulationStudent = {
  id: string;
  admissionNumber: string;
  firstName: string;
  lastName: string;
  studentType: "DAY" | "BOARDING" | null;
  enrollments: Array<{
    class: { name: string } | null;
    stream: { name: string } | null;
  }>;
};

type DailyAttendanceRow = {
  studentId: string;
  status: string;
};

type MovementEvent = {
  id: string;
  studentId: string;
  readerId: string;
  type: string;
  occurredAt: Date;
  receivedAt?: Date;
  offlineSynced: boolean;
};

type ReaderRow = {
  id: string;
  name: string;
  locationName: string | null;
  location: string | null;
};

type CanonicalAttendanceSnapshot = {
  date: string;
  timezone: string;
  rows: GateAttendanceRow[];
  summary: DashboardAttendanceSummary;
};

type SnapshotBuildOptions = {
  skipPermissionCheck?: boolean;
};

function requireSchoolId(ctx: AttendanceContext) {
  if (!ctx.schoolId) {
    throw Object.assign(new Error("School context required."), { status: 401 });
  }
  return ctx.schoolId;
}

function requireReadPermission(ctx: AttendanceContext) {
  if (!ctx.actorId || !ctx.role) {
    throw Object.assign(new Error("Authentication required."), { status: 401 });
  }
  if (
    !hasPermission(ctx.role, "app.admin")
    && !hasPermission(ctx.role, "nfc.devices.manage")
    && !hasPermission(ctx.role, "nfc.gate.view")
  ) {
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

function sortRegisterRows(rows: AttendanceRegisterRow[]) {
  return rows.sort((left, right) =>
    left.student.name.localeCompare(right.student.name, undefined, { sensitivity: "base" })
    || left.student.admissionNumber.localeCompare(right.student.admissionNumber, undefined, { sensitivity: "base" }));
}

function getReaderLabel(readersById: Map<string, ReaderRow>, readerId: string | null | undefined) {
  if (!readerId) return null;
  const reader = readersById.get(readerId);
  return reader?.locationName ?? reader?.location ?? reader?.name ?? null;
}

function getStudentName(student: Pick<PopulationStudent, "firstName" | "lastName">) {
  return `${student.firstName} ${student.lastName}`.trim();
}

function mapEventsByStudent<T extends { studentId: string }>(rows: T[]) {
  const byStudent = new Map<string, T[]>();
  for (const row of rows) {
    const list = byStudent.get(row.studentId) ?? [];
    list.push(row);
    byStudent.set(row.studentId, list);
  }
  return byStudent;
}

function buildLatestScanStatus(eventType: string): "PRESENT" | "LATE" | "DEPARTED" | "BLOCKED" {
  if (eventType === "GATE_EXIT") return "DEPARTED";
  if (eventType === "RESTRICTED_ENTRY_ATTEMPT") return "BLOCKED";
  return "PRESENT";
}

function buildGateSummary(rows: GateAttendanceRow[]) {
  const late = rows.filter((row) => row.attendanceStatus === "LATE").length;
  const presentOnly = rows.filter((row) => row.attendanceStatus === "PRESENT").length;
  const present = presentOnly + late;
  const totalStudents = rows.length;
  return {
    totalStudents,
    present,
    late,
    absent: rows.filter((row) => row.attendanceStatus === "ABSENT").length,
    onCampus: rows.filter((row) => row.campusStatus === "ON_CAMPUS").length,
    offCampus: rows.filter((row) => row.campusStatus === "OFF_CAMPUS").length,
    departureMissing: rows.filter((row) => row.departureNotRecorded).length,
    restrictedAttempts: rows.filter((row) => row.feeHoldAttempt).length,
    manualOverrides: rows.filter((row) => row.manualOverride).length,
  };
}

async function buildCanonicalAttendanceSnapshot(
  ctx: AttendanceContext,
  filters: LocationAttendanceFilters = {},
  db: AttendanceDb = defaultPrisma,
  options: SnapshotBuildOptions = {},
): Promise<CanonicalAttendanceSnapshot> {
  const schoolId = requireSchoolId(ctx);
  if (!options.skipPermissionCheck) {
    requireReadPermission(ctx);
  }
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
      timezone: policy.policy.timezone,
      rows: [],
      summary: {
        date: dateKey,
        timezone: policy.policy.timezone,
        totalStudents: 0,
        present: 0,
        absent: 0,
        late: 0,
        attendanceRate: 0,
        onCampus: 0,
        offCampus: 0,
        lastUpdatedAt: new Date().toISOString(),
        latestScans: [],
        classSummaries: [],
      },
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
        receivedAt: true,
        offlineSynced: true,
      },
    }),
    db.nfcOfflineDevice.findMany({
      where: { schoolId },
      select: { id: true, name: true, locationName: true, location: true },
    }),
  ]);

  const dailyByStudent = new Map(dailyAttendances.map((row: DailyAttendanceRow) => [row.studentId, row]));
  const readersById = new Map(readers.map((reader: ReaderRow) => [reader.id, reader]));
  const movementByStudent = mapEventsByStudent(movementEvents as MovementEvent[]);
  const studentsById = new Map(students.map((student) => [student.id, student]));

  const rows = students.map((student) => {
    const enrollment = student.enrollments[0];
    const daily = dailyByStudent.get(student.id);
    const events = movementByStudent.get(student.id) ?? [];

    const validMovements = events.filter((event) => event.type === "GATE_ENTRY" || event.type === "GATE_EXIT");
    const entries = validMovements.filter((event) => event.type === "GATE_ENTRY");
    const exits = validMovements.filter((event) => event.type === "GATE_EXIT");
    const latestValidMovement = validMovements.length > 0 ? validMovements[validMovements.length - 1] : null;
    const latestRestrictedAttempt = [...events].reverse().find((event) => event.type === "RESTRICTED_ENTRY_ATTEMPT") ?? null;
    const manualOverride = events.some((event) => event.type === "MANUAL_GATE_OVERRIDE");

    const attendanceStatus = daily?.status === "LATE"
      ? "LATE"
      : daily?.status === "PRESENT"
        ? "PRESENT"
        : "ABSENT";
    const campusStatus = latestValidMovement?.type === "GATE_ENTRY" ? "ON_CAMPUS" : "OFF_CAMPUS";

    const readerNames = Array.from(new Set(
      [entries[0]?.readerId, exits[exits.length - 1]?.readerId]
        .map((readerId) => getReaderLabel(readersById, readerId))
        .filter((value): value is string => Boolean(value)),
    ));

    return {
      studentId: student.id,
      studentName: getStudentName(student),
      admissionNumber: student.admissionNumber,
      className: enrollment?.class?.name ?? null,
      streamName: enrollment?.stream?.name ?? null,
      scholarType: student.studentType,
      attendanceStatus,
      arrivalTime: entries[0]?.occurredAt.toISOString() ?? null,
      lateIndicator: attendanceStatus === "LATE",
      departureTime: exits.length > 0 ? exits[exits.length - 1]!.occurredAt.toISOString() : null,
      departureNotRecorded: latestValidMovement?.type === "GATE_ENTRY",
      campusStatus,
      feeHoldAttempt: Boolean(latestRestrictedAttempt),
      manualOverride,
      readerUsed: readerNames.length > 0 ? readerNames.join(" -> ") : null,
      offlineSynced: events.some((event) => event.offlineSynced),
      lastRestrictedAttemptAt: latestRestrictedAttempt?.occurredAt.toISOString() ?? null,
    } satisfies GateAttendanceRow;
  });

  sortByName(rows);
  const gateSummary = buildGateSummary(rows);
  const latestScans = [...movementEvents]
    .sort((left, right) => right.occurredAt.getTime() - left.occurredAt.getTime())
    .map((event) => {
      const student = studentsById.get(event.studentId);
      if (!student) return null;
      const enrollment = student.enrollments[0];
      return {
        studentId: student.id,
        studentName: getStudentName(student),
        admissionNumber: student.admissionNumber,
        className: enrollment?.class?.name ?? null,
        streamName: enrollment?.stream?.name ?? null,
        eventType: event.type,
        status: buildLatestScanStatus(event.type),
        occurredAt: event.occurredAt.toISOString(),
        readerUsed: getReaderLabel(readersById, event.readerId),
        offlineSynced: Boolean(event.offlineSynced),
      };
    })
    .filter((row): row is NonNullable<typeof row> => Boolean(row))
    .slice(0, 8);
  const classSummaryMap = new Map<string, NonNullable<DashboardAttendanceSummary["classSummaries"]>[number]>();
  for (const row of rows) {
    const key = `${row.className ?? "Unassigned"}::${row.streamName ?? ""}`;
    const current = classSummaryMap.get(key) ?? {
      className: row.className ?? "Unassigned",
      streamName: row.streamName ?? null,
      totalStudents: 0,
      present: 0,
      late: 0,
      absent: 0,
      onCampus: 0,
      offCampus: 0,
    };
    current.totalStudents += 1;
    if (row.attendanceStatus === "LATE") {
      current.present += 1;
      current.late += 1;
    } else if (row.attendanceStatus === "PRESENT") {
      current.present += 1;
    } else {
      current.absent += 1;
    }
    if (row.campusStatus === "ON_CAMPUS") current.onCampus += 1;
    else current.offCampus += 1;
    classSummaryMap.set(key, current);
  }
  const classSummaries = [...classSummaryMap.values()]
    .sort((left, right) => left.className.localeCompare(right.className) || (left.streamName ?? "").localeCompare(right.streamName ?? ""));

  return {
    date: dateKey,
    timezone: policy.policy.timezone,
    rows,
    summary: {
      date: dateKey,
      timezone: policy.policy.timezone,
      totalStudents: gateSummary.totalStudents,
      present: gateSummary.present,
      absent: gateSummary.absent,
      late: gateSummary.late,
      attendanceRate: gateSummary.totalStudents > 0
        ? Number(((gateSummary.present / gateSummary.totalStudents) * 100).toFixed(1))
        : 0,
      onCampus: gateSummary.onCampus,
      offCampus: gateSummary.offCampus,
      lastUpdatedAt: new Date().toISOString(),
      latestScans,
      classSummaries,
    },
  };
}

export async function getDashboardAttendanceSummary(
  ctx: AttendanceContext,
  db: AttendanceDb = defaultPrisma,
): Promise<DashboardAttendanceSummary> {
  const snapshot = await buildCanonicalAttendanceSnapshot(ctx, {}, db);
  return snapshot.summary;
}

export async function getDashboardAttendanceSummaryForSchool(
  schoolId: string,
  db: AttendanceDb = defaultPrisma,
): Promise<DashboardAttendanceSummary> {
  const snapshot = await buildCanonicalAttendanceSnapshot({ schoolId, actorId: null, role: null }, {}, db, {
    skipPermissionCheck: true,
  });
  return snapshot.summary;
}

export async function listGateAttendanceReport(
  ctx: AttendanceContext,
  filters: GateAttendanceFilters = {},
  db: AttendanceDb = defaultPrisma,
): Promise<GateAttendanceReport> {
  const snapshot = await buildCanonicalAttendanceSnapshot(ctx, filters, db);

  const rows = snapshot.rows.filter((row) => {
    if (filters.attendanceStatus === "PRESENT" && row.attendanceStatus === "ABSENT") return false;
    if (filters.attendanceStatus && filters.attendanceStatus !== "ALL" && filters.attendanceStatus !== "PRESENT" && row.attendanceStatus !== filters.attendanceStatus) {
      return false;
    }
    if (filters.campusStatus && filters.campusStatus !== "ALL" && row.campusStatus !== filters.campusStatus) return false;
    if (filters.departureMissing && !row.departureNotRecorded) return false;
    return true;
  });

  return {
    date: snapshot.date,
    summary: buildGateSummary(rows),
    rows,
  };
}

export async function getCanonicalAttendanceRegister(
  ctx: AttendanceContext,
  filters: LocationAttendanceFilters = {},
  db: AttendanceDb = defaultPrisma,
): Promise<AttendanceRegisterResponse> {
  const snapshot = await buildCanonicalAttendanceSnapshot(ctx, filters, db);
  const schoolId = requireSchoolId(ctx);
  const { start, end } = getZonedDayRangeByKey(snapshot.date, snapshot.timezone);

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
  const movementEvents = studentIds.length === 0
    ? []
    : await db.campusMovementEvent.findMany({
        where: { schoolId, studentId: { in: studentIds }, occurredAt: { gte: start, lt: end } },
        orderBy: [{ occurredAt: "asc" }, { receivedAt: "asc" }],
        select: {
          id: true,
          studentId: true,
          readerId: true,
          type: true,
          occurredAt: true,
          receivedAt: true,
          offlineSynced: true,
        },
      });

  const gateRowsByStudent = new Map(snapshot.rows.map((row) => [row.studentId, row]));
  const movementByStudent = mapEventsByStudent(movementEvents as MovementEvent[]);

  let blockedScans = 0;
  const duplicateScans = 0;

  const rows = students.map((student) => {
    const enrollment = student.enrollments[0];
    const gateRow = gateRowsByStudent.get(student.id);
    const canonicalEvents = movementByStudent.get(student.id) ?? [];
    const latestCanonicalEvent = canonicalEvents.length > 0 ? canonicalEvents[canonicalEvents.length - 1] : null;
    const latestRestrictedAttempt = [...canonicalEvents].reverse().find((event) => event.type === "RESTRICTED_ENTRY_ATTEMPT") ?? null;
    if (latestRestrictedAttempt) blockedScans += 1;

    let currentStatus: AttendanceRegisterRow["currentStatus"];
    if (gateRow?.arrivalTime && gateRow.departureTime && gateRow.campusStatus === "OFF_CAMPUS") {
      currentStatus = "OUT";
    } else if (gateRow?.attendanceStatus === "LATE") {
      currentStatus = "LATE";
    } else if (gateRow?.attendanceStatus === "PRESENT") {
      currentStatus = "PRESENT";
    } else if (gateRow?.departureTime) {
      currentStatus = "OUT_ONLY";
    } else if (latestRestrictedAttempt) {
      currentStatus = "BLOCKED";
    } else {
      currentStatus = "ABSENT";
    }

    return {
      student: {
        id: student.id,
        name: getStudentName(student),
        admissionNumber: student.admissionNumber,
        className: enrollment?.class?.name ?? null,
        streamName: enrollment?.stream?.name ?? null,
        studentType: student.studentType,
        photoUrl: null,
      },
      tapIn: gateRow?.arrivalTime
        ? { id: `${student.id}:tap-in`, scannedAt: gateRow.arrivalTime, source: "PHYSICAL_READER" }
        : null,
      tapOut: gateRow?.departureTime
        ? { id: `${student.id}:tap-out`, scannedAt: gateRow.departureTime, source: "PHYSICAL_READER" }
        : null,
      lastScan: latestCanonicalEvent
        ? {
            id: latestCanonicalEvent.id,
            direction: latestCanonicalEvent.type,
            scannedAt: latestCanonicalEvent.occurredAt.toISOString(),
            status: latestCanonicalEvent.type === "RESTRICTED_ENTRY_ATTEMPT" ? "BLOCKED" : latestCanonicalEvent.type,
            reason: latestCanonicalEvent.type === "RESTRICTED_ENTRY_ATTEMPT" ? "Restricted entry attempt" : null,
          }
        : null,
      currentStatus,
    } satisfies AttendanceRegisterRow;
  });

  sortRegisterRows(rows);
  const late = rows.filter((row) => row.currentStatus === "LATE").length;
  const present = rows.filter((row) => row.currentStatus === "PRESENT").length + late;
  const out = rows.filter((row) => row.currentStatus === "OUT" || row.currentStatus === "OUT_ONLY").length;
  const absent = rows.filter((row) => row.currentStatus === "ABSENT").length;

  return {
    date: snapshot.date,
    summary: {
      totalStudents: rows.length,
      present,
      out,
      absent,
      blockedScans,
      duplicateScans,
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
  requireReadPermission(ctx);
  const policy = await getSchoolNfcPolicy(ctx, db as never);
  const dateKey = validateDate(filters.date) ?? getZonedDateKey(new Date(), policy.policy.timezone);
  const { start } = getZonedDayRangeByKey(dateKey, policy.policy.timezone);

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
  const readersById = new Map(readers.map((reader: ReaderRow) => [reader.id, reader]));

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
      studentName: student ? getStudentName(student) : "Unknown student",
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
      studentName: getStudentName(student),
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
        studentName: getStudentName(student),
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
