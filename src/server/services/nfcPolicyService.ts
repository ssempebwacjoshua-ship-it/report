import prismaPkg from "@prisma/client";
import type { PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "../db/prisma";
import type { SchoolUserRole } from "./authService";
import { hasPermission } from "../../shared/permissions";

const { AttendanceLateAction, FeeDefaulterBlockScope, StudentFeeHoldStatus } = prismaPkg;

type NfcPolicyClient = Pick<PrismaClient, "schoolNfcPolicy" | "studentFeeHold" | "student" | "auditLog"> & {
  $transaction?: <T>(fn: (tx: NfcPolicyClient) => Promise<T>) => Promise<T>;
};

export type NfcPolicyContext = {
  schoolId?: string | null;
  actorId?: string | null;
  role?: SchoolUserRole | string | null;
};

export type NfcPolicyRow = {
  id: string;
  schoolId: string;
  feeDefaulterBlockingEnabled: boolean;
  feeDefaulterBlockScope: FeeDefaulterBlockScope;
  attendanceTapInCutoffEnabled: boolean;
  tapInCutoffTime: string | null;
  cutoffLateAction: AttendanceLateAction;
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
  gateOfflineEnabled: boolean;
  canteenOfflineEnabled: boolean;
  gateSnapshotValidHours: number;
  canteenSnapshotValidHours: number;
  maxOfflineSpendPerStudentPerDay: number;
  maxOfflineSpendPerTransaction: number;
  maxOfflineSpendPerDeviceSession: number;
  unknownCardOfflinePolicy: string;
  frozenCardOfflinePolicy: string;
  deactivatedCardOfflinePolicy: string;
  offlineConflictPolicy: string;
  updatedByUserId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type StudentFeeHoldRow = {
  id: string;
  schoolId: string;
  studentId: string;
  status: StudentFeeHoldStatus;
  reason: string | null;
  balanceDueCents: number | null;
  effectiveFrom: string | null;
  clearedAt: string | null;
  createdByUserId: string | null;
  clearedByUserId: string | null;
  createdAt: string;
  updatedAt: string;
  student: {
    id: string;
    name: string;
    admissionNumber: string;
    className: string | null;
    streamName: string | null;
    studentType: "DAY" | "BOARDING" | null;
    photoUrl: null;
  };
};

export type NfcPolicyResponse = {
  policy: NfcPolicyRow;
};

export type NfcFeeHoldListResponse = {
  policy: NfcPolicyRow;
  feeHolds: StudentFeeHoldRow[];
};

export type NfcStudentLookupRow = {
  id: string;
  studentName: string;
  admissionNumber: string;
  className: string | null;
  streamName: string | null;
  studentType: "DAY" | "BOARDING" | null;
  isActive: boolean;
};

export type NfcPolicyInput = {
  feeDefaulterBlockingEnabled: boolean;
  feeDefaulterBlockScope: FeeDefaulterBlockScope;
  attendanceTapInCutoffEnabled: boolean;
  tapInCutoffTime?: string | null;
  cutoffLateAction: AttendanceLateAction;
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
  gateOfflineEnabled: boolean;
  canteenOfflineEnabled: boolean;
  gateSnapshotValidHours: number;
  canteenSnapshotValidHours: number;
  maxOfflineSpendPerStudentPerDay: number;
  maxOfflineSpendPerTransaction: number;
  maxOfflineSpendPerDeviceSession: number;
  unknownCardOfflinePolicy: "DENY";
  frozenCardOfflinePolicy: "DENY";
  deactivatedCardOfflinePolicy: "DENY";
  offlineConflictPolicy: "ALLOW_AND_FLAG" | "HOLD_FOR_BURSAR_REVIEW";
};

export type StudentFeeHoldInput = {
  studentId: string;
  reason?: string | null;
  balanceDueCents?: number | null;
  effectiveFrom?: string | null;
};

export type StudentFeeHoldFilters = {
  search?: string;
  classId?: string;
  streamId?: string;
  studentType?: string;
  status?: StudentFeeHoldStatus | "ALL";
};

function requireSchoolId(ctx: NfcPolicyContext): string {
  if (!ctx.schoolId) throw Object.assign(new Error("School context required."), { status: 401 });
  return ctx.schoolId;
}

function requirePermission(ctx: NfcPolicyContext, permission: string) {
  if (!ctx.actorId || !ctx.role) throw Object.assign(new Error("Authentication required."), { status: 401 });
  if (!hasPermission(ctx.role, permission)) {
    throw Object.assign(new Error("You do not have permission for this action."), { status: 403 });
  }
}

function runWrite<T>(db: NfcPolicyClient, fn: (tx: NfcPolicyClient) => Promise<T>) {
  return db.$transaction ? db.$transaction(fn) : fn(db);
}

function toStudentSummary(student: {
  id: string;
  admissionNumber: string;
  firstName: string;
  lastName: string;
  studentType: "DAY" | "BOARDING" | null;
  enrollments?: Array<{
    class?: { name: string } | null;
    stream?: { name: string } | null;
  }>;
}) {
  const enrollment = student.enrollments?.[0];
  return {
    id: student.id,
    name: `${student.firstName} ${student.lastName}`.trim(),
    admissionNumber: student.admissionNumber,
    className: enrollment?.class?.name ?? null,
    streamName: enrollment?.stream?.name ?? null,
    studentType: student.studentType,
    photoUrl: null,
  };
}

function formatPolicyRow(policy: {
  id: string;
  schoolId: string;
  feeDefaulterBlockingEnabled: boolean;
  feeDefaulterBlockScope: FeeDefaulterBlockScope;
  attendanceTapInCutoffEnabled: boolean;
  tapInCutoffTime: string | null;
  cutoffLateAction: AttendanceLateAction;
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
  gateOfflineEnabled: boolean;
  canteenOfflineEnabled: boolean;
  gateSnapshotValidHours: number;
  canteenSnapshotValidHours: number;
  maxOfflineSpendPerStudentPerDay: number;
  maxOfflineSpendPerTransaction: number;
  maxOfflineSpendPerDeviceSession: number;
  unknownCardOfflinePolicy: string;
  frozenCardOfflinePolicy: string;
  deactivatedCardOfflinePolicy: string;
  offlineConflictPolicy: string;
  updatedByUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
}): NfcPolicyRow {
  return {
    id: policy.id,
    schoolId: policy.schoolId,
    feeDefaulterBlockingEnabled: policy.feeDefaulterBlockingEnabled,
    feeDefaulterBlockScope: policy.feeDefaulterBlockScope,
    attendanceTapInCutoffEnabled: policy.attendanceTapInCutoffEnabled,
    tapInCutoffTime: policy.tapInCutoffTime,
    cutoffLateAction: policy.cutoffLateAction,
    timezone: policy.timezone,
    duplicateWindowSeconds: policy.duplicateWindowSeconds,
    gateArrivalStart: policy.gateArrivalStart,
    gateArrivalLateAfter: policy.gateArrivalLateAfter,
    gateArrivalEnd: policy.gateArrivalEnd,
    morningClassroomStart: policy.morningClassroomStart,
    morningClassroomEnd: policy.morningClassroomEnd,
    gateDepartureStart: policy.gateDepartureStart,
    gateDepartureEnd: policy.gateDepartureEnd,
    nightPrepStart: policy.nightPrepStart,
    nightPrepEnd: policy.nightPrepEnd,
    nightPrepBoardingOnly: policy.nightPrepBoardingOnly,
    allowAutomaticCheckout: policy.allowAutomaticCheckout,
    recordUnclassifiedScans: policy.recordUnclassifiedScans,
    feeGatePolicyEnabled: policy.feeGatePolicyEnabled,
    gateOfflineEnabled: policy.gateOfflineEnabled,
    canteenOfflineEnabled: policy.canteenOfflineEnabled,
    gateSnapshotValidHours: policy.gateSnapshotValidHours,
    canteenSnapshotValidHours: policy.canteenSnapshotValidHours,
    maxOfflineSpendPerStudentPerDay: policy.maxOfflineSpendPerStudentPerDay,
    maxOfflineSpendPerTransaction: policy.maxOfflineSpendPerTransaction,
    maxOfflineSpendPerDeviceSession: policy.maxOfflineSpendPerDeviceSession,
    unknownCardOfflinePolicy: policy.unknownCardOfflinePolicy,
    frozenCardOfflinePolicy: policy.frozenCardOfflinePolicy,
    deactivatedCardOfflinePolicy: policy.deactivatedCardOfflinePolicy,
    offlineConflictPolicy: policy.offlineConflictPolicy,
    updatedByUserId: policy.updatedByUserId,
    createdAt: policy.createdAt.toISOString(),
    updatedAt: policy.updatedAt.toISOString(),
  };
}

function formatHoldRow(hold: {
  id: string;
  schoolId: string;
  studentId: string;
  status: StudentFeeHoldStatus;
  reason: string | null;
  balanceDueCents: number | null;
  effectiveFrom: Date | null;
  clearedAt: Date | null;
  createdByUserId: string | null;
  clearedByUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
  student: {
    id: string;
    admissionNumber: string;
    firstName: string;
    lastName: string;
    studentType: "DAY" | "BOARDING" | null;
    enrollments?: Array<{
      class?: { name: string } | null;
      stream?: { name: string } | null;
    }>;
  };
}): StudentFeeHoldRow {
  return {
    id: hold.id,
    schoolId: hold.schoolId,
    studentId: hold.studentId,
    status: hold.status,
    reason: hold.reason,
    balanceDueCents: hold.balanceDueCents,
    effectiveFrom: hold.effectiveFrom ? hold.effectiveFrom.toISOString() : null,
    clearedAt: hold.clearedAt ? hold.clearedAt.toISOString() : null,
    createdByUserId: hold.createdByUserId,
    clearedByUserId: hold.clearedByUserId,
    createdAt: hold.createdAt.toISOString(),
    updatedAt: hold.updatedAt.toISOString(),
    student: toStudentSummary(hold.student),
  };
}

function studentWhere(
  schoolId: string,
  filters: { search?: string; classId?: string; streamId?: string; studentType?: string },
) {
  const search = filters.search?.trim();
  return {
    schoolId,
    ...(filters.studentType && filters.studentType !== "ALL"
      ? { studentType: filters.studentType as "DAY" | "BOARDING" }
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

function defaultPolicy(schoolId: string): NfcPolicyRow {
  const now = new Date();
  return {
    id: "",
    schoolId,
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
    feeGatePolicyEnabled: false,
    gateOfflineEnabled: false,
    canteenOfflineEnabled: false,
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
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };
}

function parseTimeToMinutes(value: string) {
  const [hours, minutes] = value.split(":").map((part) => Number(part));
  return (hours * 60) + minutes;
}

function assertValidTimeZone(timeZone: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone }).format(new Date());
  } catch {
    throw Object.assign(new Error("Timezone is not valid."), { status: 400 });
  }
}

function assertNonCrossingWindow(label: string, startTime: string, endTime: string) {
  if (parseTimeToMinutes(endTime) < parseTimeToMinutes(startTime)) {
    throw Object.assign(new Error(`${label} cannot cross midnight.`), { status: 400 });
  }
}

export async function getSchoolNfcPolicy(
  ctx: NfcPolicyContext,
  db: NfcPolicyClient = defaultPrisma,
): Promise<NfcPolicyResponse> {
  const schoolId = requireSchoolId(ctx);
  const policy = await db.schoolNfcPolicy.upsert({
    where: { schoolId },
    create: { schoolId },
    update: {},
  });
  return { policy: formatPolicyRow(policy) };
}

export async function updateSchoolNfcPolicy(
  ctx: NfcPolicyContext,
  input: NfcPolicyInput,
  db: NfcPolicyClient = defaultPrisma,
): Promise<NfcPolicyResponse> {
  const schoolId = requireSchoolId(ctx);
  requirePermission(ctx, "app.admin");
  const merged = { ...defaultPolicy(schoolId), ...input };
  const tapInCutoffTime = merged.attendanceTapInCutoffEnabled ? (merged.tapInCutoffTime?.trim() || null) : null;

  if (merged.attendanceTapInCutoffEnabled && !tapInCutoffTime) {
    throw Object.assign(new Error("Tap-in cut-off time is required when the cut-off is enabled."), { status: 400 });
  }
  assertValidTimeZone(merged.timezone?.trim() || "Africa/Kampala");
  if (tapInCutoffTime && !/^\d{2}:\d{2}$/.test(tapInCutoffTime)) {
    throw Object.assign(new Error("Tap-in cut-off time must use HH:MM."), { status: 400 });
  }
  const timeFields = [
    ["gateArrivalStart", merged.gateArrivalStart],
    ["gateArrivalLateAfter", merged.gateArrivalLateAfter],
    ["gateArrivalEnd", merged.gateArrivalEnd],
    ["morningClassroomStart", merged.morningClassroomStart],
    ["morningClassroomEnd", merged.morningClassroomEnd],
    ["gateDepartureStart", merged.gateDepartureStart],
    ["gateDepartureEnd", merged.gateDepartureEnd],
    ["nightPrepStart", merged.nightPrepStart],
    ["nightPrepEnd", merged.nightPrepEnd],
  ] as const;
  for (const [label, value] of timeFields) {
    if (!/^\d{2}:\d{2}$/.test(value)) {
      throw Object.assign(new Error(`${label} must use HH:MM.`), { status: 400 });
    }
  }
  if (merged.gateArrivalLateAfter < merged.gateArrivalStart || merged.gateArrivalLateAfter > merged.gateArrivalEnd) {
    throw Object.assign(new Error("Gate late threshold must sit inside the arrival window."), { status: 400 });
  }
  assertNonCrossingWindow("Gate arrival window", merged.gateArrivalStart, merged.gateArrivalEnd);
  assertNonCrossingWindow("Morning classroom window", merged.morningClassroomStart, merged.morningClassroomEnd);
  assertNonCrossingWindow("Gate departure window", merged.gateDepartureStart, merged.gateDepartureEnd);
  assertNonCrossingWindow("Night prep window", merged.nightPrepStart, merged.nightPrepEnd);
  if (merged.duplicateWindowSeconds < 15 || merged.duplicateWindowSeconds > 600) {
    throw Object.assign(new Error("Duplicate window must be between 15 and 600 seconds."), { status: 400 });
  }

  const policy = await runWrite(db, async (tx) => {
    const saved = await tx.schoolNfcPolicy.upsert({
      where: { schoolId },
    create: {
      schoolId,
      feeDefaulterBlockingEnabled: merged.feeDefaulterBlockingEnabled,
      feeDefaulterBlockScope: merged.feeDefaulterBlockScope,
      attendanceTapInCutoffEnabled: merged.attendanceTapInCutoffEnabled,
      tapInCutoffTime,
      cutoffLateAction: merged.cutoffLateAction,
      timezone: merged.timezone?.trim() || "Africa/Kampala",
      duplicateWindowSeconds: merged.duplicateWindowSeconds,
      gateArrivalStart: merged.gateArrivalStart,
      gateArrivalLateAfter: merged.gateArrivalLateAfter,
      gateArrivalEnd: merged.gateArrivalEnd,
      morningClassroomStart: merged.morningClassroomStart,
      morningClassroomEnd: merged.morningClassroomEnd,
      gateDepartureStart: merged.gateDepartureStart,
      gateDepartureEnd: merged.gateDepartureEnd,
      nightPrepStart: merged.nightPrepStart,
      nightPrepEnd: merged.nightPrepEnd,
      nightPrepBoardingOnly: merged.nightPrepBoardingOnly,
      allowAutomaticCheckout: merged.allowAutomaticCheckout,
      recordUnclassifiedScans: merged.recordUnclassifiedScans,
      feeGatePolicyEnabled: merged.feeGatePolicyEnabled,
      gateOfflineEnabled: merged.gateOfflineEnabled,
      canteenOfflineEnabled: merged.canteenOfflineEnabled,
      gateSnapshotValidHours: merged.gateSnapshotValidHours,
      canteenSnapshotValidHours: merged.canteenSnapshotValidHours,
      maxOfflineSpendPerStudentPerDay: merged.maxOfflineSpendPerStudentPerDay,
      maxOfflineSpendPerTransaction: merged.maxOfflineSpendPerTransaction,
      maxOfflineSpendPerDeviceSession: merged.maxOfflineSpendPerDeviceSession,
      unknownCardOfflinePolicy: merged.unknownCardOfflinePolicy,
      frozenCardOfflinePolicy: merged.frozenCardOfflinePolicy,
      deactivatedCardOfflinePolicy: merged.deactivatedCardOfflinePolicy,
      offlineConflictPolicy: merged.offlineConflictPolicy,
      updatedByUserId: ctx.actorId ?? null,
    },
    update: {
      feeDefaulterBlockingEnabled: merged.feeDefaulterBlockingEnabled,
      feeDefaulterBlockScope: merged.feeDefaulterBlockScope,
      attendanceTapInCutoffEnabled: merged.attendanceTapInCutoffEnabled,
      tapInCutoffTime,
      cutoffLateAction: merged.cutoffLateAction,
      timezone: merged.timezone?.trim() || "Africa/Kampala",
      duplicateWindowSeconds: merged.duplicateWindowSeconds,
      gateArrivalStart: merged.gateArrivalStart,
      gateArrivalLateAfter: merged.gateArrivalLateAfter,
      gateArrivalEnd: merged.gateArrivalEnd,
      morningClassroomStart: merged.morningClassroomStart,
      morningClassroomEnd: merged.morningClassroomEnd,
      gateDepartureStart: merged.gateDepartureStart,
      gateDepartureEnd: merged.gateDepartureEnd,
      nightPrepStart: merged.nightPrepStart,
      nightPrepEnd: merged.nightPrepEnd,
      nightPrepBoardingOnly: merged.nightPrepBoardingOnly,
      allowAutomaticCheckout: merged.allowAutomaticCheckout,
      recordUnclassifiedScans: merged.recordUnclassifiedScans,
      feeGatePolicyEnabled: merged.feeGatePolicyEnabled,
      gateOfflineEnabled: merged.gateOfflineEnabled,
      canteenOfflineEnabled: merged.canteenOfflineEnabled,
      gateSnapshotValidHours: merged.gateSnapshotValidHours,
      canteenSnapshotValidHours: merged.canteenSnapshotValidHours,
      maxOfflineSpendPerStudentPerDay: merged.maxOfflineSpendPerStudentPerDay,
      maxOfflineSpendPerTransaction: merged.maxOfflineSpendPerTransaction,
      maxOfflineSpendPerDeviceSession: merged.maxOfflineSpendPerDeviceSession,
      unknownCardOfflinePolicy: merged.unknownCardOfflinePolicy,
      frozenCardOfflinePolicy: merged.frozenCardOfflinePolicy,
      deactivatedCardOfflinePolicy: merged.deactivatedCardOfflinePolicy,
      offlineConflictPolicy: merged.offlineConflictPolicy,
      updatedByUserId: ctx.actorId ?? null,
    },
  });

    await tx.auditLog.create({
      data: {
        schoolId,
        action: "nfc_policy.updated",
        details: { actor: { id: ctx.actorId ?? null }, policy: formatPolicyRow(saved) },
      },
    });

    return saved;
  });

  return { policy: formatPolicyRow(policy) };
}

export async function getActiveStudentFeeHold(
  db: NfcPolicyClient,
  schoolId: string,
  studentId: string,
) {
  return db.studentFeeHold.findFirst({
    where: { schoolId, studentId, status: StudentFeeHoldStatus.ACTIVE },
    orderBy: { createdAt: "desc" },
  });
}

export function feeHoldAppliesToStudent(studentType: "DAY" | "BOARDING" | null, scope: FeeDefaulterBlockScope) {
  if (scope === "ALL_STUDENTS") return true;
  return studentType !== "BOARDING";
}

export async function listStudentFeeHolds(
  ctx: NfcPolicyContext,
  filters: StudentFeeHoldFilters = {},
  db: NfcPolicyClient = defaultPrisma,
): Promise<NfcFeeHoldListResponse> {
  const schoolId = requireSchoolId(ctx);
  requirePermission(ctx, "nfc.fee-holds.manage");
  const policy = await getSchoolNfcPolicy(ctx, db);
  const studentFilter = {
    ...(filters.studentType && filters.studentType !== "ALL"
      ? { studentType: filters.studentType as "DAY" | "BOARDING" }
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
    ...(filters.search?.trim()
      ? {
          OR: [
            { firstName: { contains: filters.search.trim(), mode: "insensitive" as const } },
            { lastName: { contains: filters.search.trim(), mode: "insensitive" as const } },
            { admissionNumber: { contains: filters.search.trim(), mode: "insensitive" as const } },
          ],
        }
      : {}),
  };
  const feeHolds = await db.studentFeeHold.findMany({
    where: {
      schoolId,
      ...(filters.status && filters.status !== "ALL" ? { status: filters.status } : {}),
      ...(Object.keys(studentFilter).length ? { student: studentFilter } : {}),
    },
    include: {
      student: {
        select: {
          id: true,
          admissionNumber: true,
          firstName: true,
          lastName: true,
          studentType: true,
          enrollments: {
            where: { isActive: true, status: "ACTIVE" as const },
            include: { class: { select: { name: true } }, stream: { select: { name: true } } },
            orderBy: { createdAt: "desc" as const },
            take: 1,
          },
        },
      },
    },
    orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
  });

  return { policy: policy.policy, feeHolds: feeHolds.map((hold) => formatHoldRow(hold as never)) };
}

export async function createStudentFeeHold(
  ctx: NfcPolicyContext,
  input: StudentFeeHoldInput,
  db: NfcPolicyClient = defaultPrisma,
) {
  const schoolId = requireSchoolId(ctx);
  requirePermission(ctx, "nfc.fee-holds.manage");
  if (!input.studentId) throw Object.assign(new Error("Student is required."), { status: 400 });

  const student = await db.student.findFirst({
    where: { id: input.studentId, schoolId },
    select: {
      id: true,
      admissionNumber: true,
      firstName: true,
      lastName: true,
      studentType: true,
      enrollments: {
        where: { isActive: true, status: "ACTIVE" as const },
        include: { class: { select: { name: true } }, stream: { select: { name: true } } },
        orderBy: { createdAt: "desc" as const },
        take: 1,
      },
    },
  });
  if (!student) throw Object.assign(new Error("Student not found."), { status: 404 });

  const created = await runWrite(db, async (tx) => {
    const hold = await tx.studentFeeHold.create({
      data: {
        schoolId,
        studentId: student.id,
        status: StudentFeeHoldStatus.ACTIVE,
        reason: input.reason?.trim() || null,
        balanceDueCents: input.balanceDueCents ?? null,
        effectiveFrom: input.effectiveFrom ? new Date(input.effectiveFrom) : new Date(),
        createdByUserId: ctx.actorId ?? null,
      },
      include: {
        student: {
          select: {
            id: true,
            admissionNumber: true,
            firstName: true,
            lastName: true,
            studentType: true,
            enrollments: {
              where: { isActive: true, status: "ACTIVE" as const },
              include: { class: { select: { name: true } }, stream: { select: { name: true } } },
              orderBy: { createdAt: "desc" as const },
              take: 1,
            },
          },
        },
      },
    });
    await tx.auditLog.create({
      data: {
        schoolId,
        action: "student_fee_hold.created",
        details: { actor: { id: ctx.actorId ?? null }, holdId: hold.id, studentId: student.id, reason: hold.reason, balanceDueCents: hold.balanceDueCents },
      },
    });
    return hold;
  });

  return { feeHold: formatHoldRow(created as never) };
}

export async function clearStudentFeeHold(
  ctx: NfcPolicyContext,
  holdId: string,
  reason?: string | null,
  db: NfcPolicyClient = defaultPrisma,
) {
  const schoolId = requireSchoolId(ctx);
  requirePermission(ctx, "nfc.fee-holds.manage");

  const hold = await db.studentFeeHold.findFirst({
    where: { id: holdId, schoolId },
    include: {
      student: {
        select: {
          id: true,
          admissionNumber: true,
          firstName: true,
          lastName: true,
          studentType: true,
          enrollments: {
            where: { isActive: true, status: "ACTIVE" as const },
            include: { class: { select: { name: true } }, stream: { select: { name: true } } },
            orderBy: { createdAt: "desc" as const },
            take: 1,
          },
        },
      },
    },
  });
  if (!hold) throw Object.assign(new Error("Fee hold not found."), { status: 404 });
  if (hold.status !== StudentFeeHoldStatus.ACTIVE) throw Object.assign(new Error("Fee hold is not active."), { status: 409 });

  const updated = await runWrite(db, async (tx) => {
    const cleared = await tx.studentFeeHold.update({
      where: { id: hold.id },
      data: {
        status: StudentFeeHoldStatus.CLEARED,
        clearedAt: new Date(),
        clearedByUserId: ctx.actorId ?? null,
        reason: reason?.trim() ? reason.trim() : hold.reason,
      },
      include: {
        student: {
          select: {
            id: true,
            admissionNumber: true,
            firstName: true,
            lastName: true,
            studentType: true,
            enrollments: {
              where: { isActive: true, status: "ACTIVE" as const },
              include: { class: { select: { name: true } }, stream: { select: { name: true } } },
              orderBy: { createdAt: "desc" as const },
              take: 1,
            },
          },
        },
      },
    });
    await tx.auditLog.create({
      data: {
        schoolId,
        action: "student_fee_hold.cleared",
        details: { actor: { id: ctx.actorId ?? null }, holdId: hold.id, studentId: hold.studentId, reason: reason ?? null },
      },
    });
    return cleared;
  });

  return { feeHold: formatHoldRow(updated as never) };
}

export async function searchNfcFeeHoldStudents(
  ctx: NfcPolicyContext,
  filters: { search?: string; classId?: string; streamId?: string; studentType?: string } = {},
  db: NfcPolicyClient = defaultPrisma,
) {
  const schoolId = requireSchoolId(ctx);
  requirePermission(ctx, "nfc.fee-holds.manage");
  const students = await db.student.findMany({
    where: {
      ...studentWhere(schoolId, filters),
      isActive: true,
    },
    select: {
      id: true,
      admissionNumber: true,
      firstName: true,
      lastName: true,
      studentType: true,
      isActive: true,
      enrollments: {
        where: { isActive: true, status: "ACTIVE" as const },
        include: { class: { select: { name: true } }, stream: { select: { name: true } } },
        orderBy: { createdAt: "desc" as const },
        take: 1,
      },
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    take: 30,
  });

  return {
    students: students.map((student) => ({
      id: student.id,
      studentName: `${student.firstName} ${student.lastName}`.trim(),
      admissionNumber: student.admissionNumber,
      className: student.enrollments[0]?.class?.name ?? null,
      streamName: student.enrollments[0]?.stream?.name ?? null,
      studentType: student.studentType,
      isActive: student.isActive,
    })),
  };
}

export function getTimeParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: Number(map.hour),
    minute: Number(map.minute),
    second: Number(map.second),
  };
}

export function zonedDateToUtc(year: number, month: number, day: number, hour: number, minute: number, second: number, timeZone: string) {
  const target = Date.UTC(year, month - 1, day, hour, minute, second);
  let guess = target;
  for (let index = 0; index < 3; index += 1) {
    const parts = getTimeParts(new Date(guess), timeZone);
    const rendered = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
    const diff = target - rendered;
    guess += diff;
    if (diff === 0) break;
  }
  return new Date(guess);
}

export function getZonedDayRange(date: Date, timeZone: string) {
  const parts = getTimeParts(date, timeZone);
  const start = zonedDateToUtc(parts.year, parts.month, parts.day, 0, 0, 0, timeZone);
  const nextDay = zonedDateToUtc(parts.year, parts.month, parts.day + 1, 0, 0, 0, timeZone);
  return { start, end: nextDay };
}

export function getZonedDayRangeByKey(dateKey: string, timeZone: string) {
  const [year, month, day] = dateKey.split("-").map((part) => Number(part));
  if (!year || !month || !day) {
    throw Object.assign(new Error("Invalid date key."), { status: 400 });
  }
  const start = zonedDateToUtc(year, month, day, 0, 0, 0, timeZone);
  const end = zonedDateToUtc(year, month, day + 1, 0, 0, 0, timeZone);
  return { start, end };
}

export function getZonedDateKey(date: Date, timeZone: string) {
  const parts = getTimeParts(date, timeZone);
  return `${String(parts.year).padStart(4, "0")}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

export function getZonedTimeString(date: Date, timeZone: string) {
  const parts = getTimeParts(date, timeZone);
  return `${String(parts.hour).padStart(2, "0")}:${String(parts.minute).padStart(2, "0")}`;
}

export function isAfterCutoff(date: Date, timeZone: string, cutoffTime: string) {
  const current = getZonedTimeString(date, timeZone);
  return current > cutoffTime;
}

export function shouldBlockForFeeHold(
  student: { studentType: "DAY" | "BOARDING" | null },
  policy: NfcPolicyRow,
  hold: { status: StudentFeeHoldStatus } | null,
) {
  if (!policy.feeDefaulterBlockingEnabled || !hold || hold.status !== StudentFeeHoldStatus.ACTIVE) return false;
  return feeHoldAppliesToStudent(student.studentType, policy.feeDefaulterBlockScope);
}

export function createDefaultPolicy(schoolId: string) {
  return defaultPolicy(schoolId);
}
