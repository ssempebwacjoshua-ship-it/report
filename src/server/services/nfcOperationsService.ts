import prismaPkg from "@prisma/client";
import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "../db/prisma";
import type { SchoolUserRole } from "./authService";
import { assertPinFormat, checkPin, hashWalletPin } from "./walletPinService";
import { canOperateAttendance, hasPermission } from "../../shared/permissions";
import { normalizeNfcScanValue } from "../../shared/utils/nfcPayload";
import {
  getSchoolNfcPolicy,
  getActiveStudentFeeHold,
  getZonedDayRange,
  getZonedDayRangeByKey,
  getZonedDateKey,
  isAfterCutoff,
  shouldBlockForFeeHold,
} from "./nfcPolicyService";
import {
  getCanonicalAttendanceRegister,
  type AttendanceRegisterResponse,
} from "./locationAttendanceService";
import {
  mapCredentialFailureReason,
  resolveNfcCredential,
} from "./nfcCredentialResolver";

const {
  AttendanceDirection,
  AttendanceLateAction,
  AttendanceScanSource,
  AttendanceScanStatus,
  CredentialStatus,
  CredentialType,
  GateScanResult,
  StudentWalletStatus,
  WalletTransactionType,
} = prismaPkg;

type NfcOperationsClient = Pick<
  PrismaClient,
  "student" | "studentCredential" | "studentWallet" | "studentWalletTransaction" | "studentAttendanceEvent" | "nfcGateScan" | "auditLog" | "nfcTag" | "schoolNfcPolicy" | "studentFeeHold" | "studentPassOut"
> & {
  $transaction?: <T>(fn: (tx: NfcOperationsClient) => Promise<T>) => Promise<T>;
};

export type NfcOperationsContext = {
  schoolId?: string | null;
  actorId?: string | null;
  role?: SchoolUserRole | string | null;
};

const studentInclude = {
  enrollments: {
    where: { isActive: true, status: "ACTIVE" as const },
    include: { class: { select: { id: true, name: true } }, stream: { select: { id: true, name: true } } },
    orderBy: { createdAt: "desc" as const },
    take: 1,
  },
};

const credentialInclude = {
  student: {
    select: {
      id: true,
      admissionNumber: true,
      firstName: true,
      lastName: true,
      studentType: true,
      isActive: true,
      enrollments: studentInclude.enrollments,
    },
  },
};

type StudentForNfc = {
  id: string;
  admissionNumber: string;
  firstName: string;
  lastName: string;
  studentType: "DAY" | "BOARDING" | null;
  isActive: boolean;
  enrollments?: Array<{
    class?: { id?: string; name: string } | null;
    stream?: { id?: string; name: string } | null;
  }>;
};

type CredentialForNfc = {
  id: string;
  schoolId: string;
  studentId: string;
  type: CredentialType;
  credentialUID: string;
  scanToken: string | null;
  status: CredentialStatus;
  issuedAt: Date;
  student: StudentForNfc;
};

function requireSchoolId(ctx: NfcOperationsContext): string {
  if (!ctx.schoolId) throw Object.assign(new Error("School context required."), { status: 401 });
  return ctx.schoolId;
}

function requireRole(ctx: NfcOperationsContext, allowed: string[]) {
  if (!ctx.actorId || !ctx.role) throw Object.assign(new Error("Authentication required."), { status: 401 });
  if (ctx.role === "ADMIN_OPERATOR" || allowed.includes(ctx.role)) return;
  throw Object.assign(new Error("You do not have permission for this NFC action."), { status: 403 });
}

function logPermissionDenied(ctx: NfcOperationsContext, permission: string, route?: string) {
  console.warn("[nfc-permission-denied]", {
    path: route ?? "unknown",
    role: ctx.role ?? null,
    requiredPermission: permission,
    actorId: ctx.actorId ?? null,
    schoolId: ctx.schoolId ?? null,
  });
}

function requirePermission(ctx: NfcOperationsContext, permission: string, route?: string) {
  if (!ctx.actorId || !ctx.role) throw Object.assign(new Error("Authentication required."), { status: 401 });
  if (!hasPermission(ctx.role, permission)) {
    logPermissionDenied(ctx, permission, route);
    throw Object.assign(new Error("You do not have permission for this action."), { status: 403 });
  }
}

function requireAnyPermission(ctx: NfcOperationsContext, permissions: string[], route?: string) {
  if (!ctx.actorId || !ctx.role) throw Object.assign(new Error("Authentication required."), { status: 401 });
  if (!permissions.some((permission) => hasPermission(ctx.role, permission))) {
    logPermissionDenied(ctx, permissions.join(" | "), route);
    throw Object.assign(new Error("You do not have permission for this action."), { status: 403 });
  }
}

function todayRange(now = new Date()) {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

function getStudentName(student: Pick<StudentForNfc, "firstName" | "lastName">) {
  return `${student.firstName} ${student.lastName}`.trim();
}

function studentSummary(student: StudentForNfc) {
  const enrollment = student.enrollments?.[0];
  return {
    id: student.id,
    name: getStudentName(student),
    admissionNumber: student.admissionNumber,
    className: enrollment?.class?.name ?? null,
    streamName: enrollment?.stream?.name ?? null,
    photoUrl: null,
  };
}

function isStudentCurrentlyOnCampus(latestMovement: { type: string } | null) {
  return latestMovement?.type === "GATE_ENTRY" || latestMovement?.type === "MANUAL_GATE_OVERRIDE";
}

async function runWrite<T>(db: NfcOperationsClient, fn: (tx: NfcOperationsClient) => Promise<T>) {
  return db.$transaction ? db.$transaction(fn) : fn(db);
}

function blockedReason(credential: CredentialForNfc | null) {
  if (!credential) return "unknown token";
  if (credential.status !== CredentialStatus.ACTIVE) return "lost or deactivated wristband";
  if (!credential.student.isActive) return "inactive student";
  return null;
}

type NfcScanTarget = {
  student: StudentForNfc;
  credential: CredentialForNfc | null;
  nfcTagId: string | null;
  blocked: boolean;
  reason: string | null;
};

type ResolveTargetOptions = {
  applyFeeHoldBlocking?: boolean;
};

async function resolveNfcScanTarget(
  db: NfcOperationsClient,
  schoolId: string,
  tokenOrUid: string,
  options: ResolveTargetOptions = {},
): Promise<NfcScanTarget | null> {
  const resolved = await resolveNfcCredential(db as never, {
    schoolId,
    value: tokenOrUid,
  });
  if (!resolved.ok) return null;

  const student = {
    ...resolved.student,
    enrollments: (resolved.student.enrollments as StudentForNfc["enrollments"]) ?? [],
  } as StudentForNfc;
  const reason = resolved.credential ? blockedReason(resolved.credential as CredentialForNfc) : !resolved.student.isActive ? "inactive student" : null;
  if (reason) {
    return { student, credential: (resolved.credential as CredentialForNfc | null) ?? null, nfcTagId: resolved.tag?.id ?? null, blocked: true, reason };
  }
  if (options.applyFeeHoldBlocking) {
    const policy = await getSchoolNfcPolicy({ schoolId, actorId: null, role: null }, db);
    const activeHold = await getActiveStudentFeeHold(db, schoolId, student.id);
    if (shouldBlockForFeeHold(student, policy.policy, activeHold)) {
      return { student, credential: (resolved.credential as CredentialForNfc | null) ?? null, nfcTagId: resolved.tag?.id ?? null, blocked: true, reason: "school fees defaulter" };
    }
  }
  return {
    student,
    credential: (resolved.credential as CredentialForNfc | null) ?? null,
    nfcTagId: resolved.tag?.id ?? null,
    blocked: false,
    reason: null,
  };
}

async function resolveGateBlockedReason(
  db: NfcOperationsClient,
  schoolId: string,
  tokenOrUid: string,
): Promise<string> {
  const resolved = await resolveNfcCredential(db as never, {
    schoolId,
    value: tokenOrUid,
  });
  return resolved.ok ? "unknown token" : mapCredentialFailureReason(resolved.reason);
}

function buildStudentWhere(
  schoolId: string,
  filters: { search?: string; classId?: string; streamId?: string; studentType?: string },
) {
  const search = filters.search?.trim();
  return {
    schoolId,
    isActive: true,
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

export async function resolveNfcTokenForRole(token: string, ctx: NfcOperationsContext | null, db: NfcOperationsClient = defaultPrisma) {
  const cleanToken = normalizeNfcScanValue(token);
  if (!cleanToken) throw Object.assign(new Error("NFC token is required."), { status: 400 });
  const role = ctx?.role;
  const mode = role && hasPermission(role, "nfc.wallets.topup")
    ? "WALLET_TOP_UP"
    : role === "SECURITY" || role === "GATE_SECURITY"
    ? "GATE_SECURITY"
    : role === "CANTEEN" || role === "CASHIER"
      ? "CANTEEN_CHARGE"
      : role === "ADMIN_OPERATOR"
        ? "WALLET_TOP_UP"
        : "PUBLIC_ID";

  const tag = await db.nfcTag.findFirst({
    where: {
      publicCode: cleanToken,
      ...(ctx?.schoolId ? { schoolId: ctx.schoolId } : {}),
    },
    include: {
      school: { select: { id: true, name: true } },
      student: {
        select: {
          id: true,
          admissionNumber: true,
          firstName: true,
          lastName: true,
          isActive: true,
          enrollments: studentInclude.enrollments,
        },
      },
    },
  });

  const credential = tag ? null : await db.studentCredential.findFirst({
    where: {
      scanToken: cleanToken,
      ...(ctx?.schoolId ? { schoolId: ctx.schoolId } : {}),
    },
    include: { ...credentialInclude, school: { select: { id: true, name: true } } },
  });

  const resolved = tag ?? credential;
  if (!resolved) {
    return { found: false, mode, credentialStatus: "INVALID" as const, valid: false };
  }

  if (ctx?.schoolId && resolved.schoolId !== ctx.schoolId) {
    throw Object.assign(new Error("You do not have access to this NFC credential."), { status: 403 });
  }

  const student = "student" in resolved ? resolved.student : null;
  const schoolName = "school" in resolved ? resolved.school.name : undefined;
  const isTag = "publicCode" in resolved;
  const status = isTag ? resolved.status : CredentialStatus.ACTIVE;
  const unassignedTagStatuses = new Set(["UNASSIGNED", "UNALLOCATED", "GENERATED", "WRITTEN", "VERIFIED", "REGISTERED"]);
  const reason = !student
    ? "unknown token"
    : isTag
      ? (resolved.status === "DISABLED" || resolved.status === "LOST")
        ? "lost or deactivated wristband"
        : (!resolved.studentId || unassignedTagStatuses.has(resolved.status))
          ? "unknown token"
          : !student.isActive
            ? "inactive student"
            : null
      : resolved.status !== CredentialStatus.ACTIVE
        ? "lost or deactivated wristband"
        : !student.isActive
          ? "inactive student"
          : null;
  const resolvedStudent = student && student.isActive ? student : null;
  const targetPath = reason || !resolvedStudent
    ? undefined
    : mode === "WALLET_TOP_UP"
      ? `/students/${encodeURIComponent(resolvedStudent.id)}/wallet/top-up`
      : mode === "GATE_SECURITY"
        ? `/gate/nfc/${encodeURIComponent(cleanToken)}`
        : mode === "CANTEEN_CHARGE"
          ? `/canteen/nfc/${encodeURIComponent(cleanToken)}`
          : mode === "PUBLIC_ID"
            ? `/nfc/t/${encodeURIComponent(cleanToken)}`
            : `/students/${encodeURIComponent(resolvedStudent.id)}/wallet`;

  const studentPayload = ctx?.actorId && resolvedStudent
    ? { ...studentSummary(resolvedStudent), ...(schoolName ? { schoolName } : {}) }
    : undefined;

  return {
    found: true,
    mode,
    targetPath,
    valid: !reason,
    actionBlocked: Boolean(reason),
    credentialStatus: reason ? "DEACTIVATED" as const : "ACTIVE" as const,
    studentStatus: resolvedStudent ? "ACTIVE" as const : "INACTIVE" as const,
    ...(studentPayload !== undefined ? { student: studentPayload } : {}),
    credential: { id: resolved.id, nfcUrl: `/nfc/t/${encodeURIComponent(cleanToken)}` },
  };
}

export async function getAttendanceDashboard(
  ctx: NfcOperationsContext,
  filters: { search?: string; classId?: string; streamId?: string } = {},
  db: NfcOperationsClient = defaultPrisma,
) {
  const schoolId = requireSchoolId(ctx);
  requirePermission(ctx, "nfc.devices.manage", "GET /api/nfc/attendance");
  return buildAttendanceDashboardData(schoolId, filters, db);
}

async function buildAttendanceDashboardData(
  schoolId: string,
  filters: { search?: string; classId?: string; streamId?: string } = {},
  db: NfcOperationsClient = defaultPrisma,
) {
  const policy = await getSchoolNfcPolicy({ schoolId, actorId: null, role: null }, db);
  const { start, end } = getZonedDayRange(new Date(), policy.policy.timezone);
  const [events, students] = await Promise.all([
    db.studentAttendanceEvent.findMany({
      where: { schoolId, scannedAt: { gte: start, lt: end } },
      include: { student: { select: { id: true, admissionNumber: true, firstName: true, lastName: true, isActive: true, enrollments: studentInclude.enrollments } } },
      orderBy: { scannedAt: "desc" },
      take: 50,
    }),
    db.student.findMany({
      where: buildStudentWhere(schoolId, filters),
      select: { id: true },
    }),
  ]);
  const tappedInIds = new Set(events.filter((event) => event.direction === AttendanceDirection.TAP_IN && [AttendanceScanStatus.VALID, AttendanceScanStatus.LATE].includes(event.status)).map((event) => event.studentId));
  return {
    summary: {
      totalTappedIn: tappedInIds.size,
      totalTappedOut: events.filter((event) => event.direction === AttendanceDirection.TAP_OUT && event.status === AttendanceScanStatus.VALID).length,
      lateArrivals: events.filter((event) => event.direction === AttendanceDirection.TAP_IN && event.status === AttendanceScanStatus.LATE).length,
      notYetTapped: Math.max(0, students.length - tappedInIds.size),
    },
    events: events.map((event) => ({
      id: event.id,
      scannedAt: event.scannedAt.toISOString(),
      direction: event.direction,
      source: event.source,
      status: event.status,
      reason: event.reason,
      student: studentSummary(event.student as StudentForNfc),
    })),
  };
}

export async function scanAttendance(
  ctx: NfcOperationsContext,
  input: { tokenOrUid: string; direction?: AttendanceDirection; idempotencyKey?: string; deviceId?: string },
  db: NfcOperationsClient = defaultPrisma,
) {
  const schoolId = requireSchoolId(ctx);
  if (!ctx.actorId || !ctx.role) throw Object.assign(new Error("Authentication required."), { status: 401 });
  if (!canOperateAttendance(ctx.role)) {
    logPermissionDenied(ctx, "nfc.attendance.operate", "POST /api/nfc/attendance/scan");
    throw Object.assign(new Error("You do not have permission for this action."), { status: 403 });
  }
  const policy = await getSchoolNfcPolicy(ctx, db);
  const target = await resolveNfcScanTarget(db, schoolId, input.tokenOrUid, { applyFeeHoldBlocking: true });
  if (!target) {
    await db.nfcGateScan.create({
      data: {
        schoolId,
        studentId: null,
        credentialId: null,
        scannedByUserId: ctx.actorId ?? null,
        result: GateScanResult.BLOCKED,
        reason: "Unassigned NFC card",
      },
    });
    throw Object.assign(new Error("NFC token not recognized."), { status: 404 });
  }

  const direction = input.direction ?? AttendanceDirection.TAP_IN;
  const { start, end } = getZonedDayRange(new Date(), policy.policy.timezone);

  const duplicate = !target.blocked
    ? await db.studentAttendanceEvent.findFirst({
        where: { schoolId, studentId: target.student.id, direction, status: { in: [AttendanceScanStatus.VALID, AttendanceScanStatus.LATE] }, scannedAt: { gte: start, lt: end } },
      })
    : null;

  const afterCutoff = direction === AttendanceDirection.TAP_IN
    && policy.policy.attendanceTapInCutoffEnabled
    && !!policy.policy.tapInCutoffTime
    && isAfterCutoff(new Date(), policy.policy.timezone, policy.policy.tapInCutoffTime);
  const cutoffBlocksTapIn = afterCutoff && policy.policy.cutoffLateAction === AttendanceLateAction.BLOCK_AND_MARK_ABSENT;

  const status = target.blocked
    ? AttendanceScanStatus.BLOCKED
    : duplicate
      ? AttendanceScanStatus.DUPLICATE
      : cutoffBlocksTapIn
        ? AttendanceScanStatus.BLOCKED
        : afterCutoff && direction === AttendanceDirection.TAP_IN
          ? AttendanceScanStatus.LATE
          : AttendanceScanStatus.VALID;

  const eventReason = target.reason
    ?? (duplicate ? "duplicate tap" : null)
    ?? (cutoffBlocksTapIn ? "attendance cut-off passed" : null)
    ?? (status === AttendanceScanStatus.LATE ? "late tap-in" : null);

  const event = await db.studentAttendanceEvent.create({
    data: {
      schoolId,
      studentId: target.student.id,
      credentialId: target.credential?.id ?? null,
      direction,
      source: AttendanceScanSource.NFC_WRISTBAND,
      status,
      reason: eventReason,
    },
  });

  if (status === AttendanceScanStatus.BLOCKED || status === AttendanceScanStatus.LATE) {
    await db.auditLog.create({
      data: {
        schoolId,
        action: status === AttendanceScanStatus.LATE ? "nfc_attendance.late" : "nfc_attendance.blocked",
        details: {
          studentId: target.student.id,
          reason: eventReason,
          direction,
          actor: { id: ctx.actorId ?? null },
        },
      },
    });
  }

  const dashboard = await buildAttendanceDashboardData(schoolId, {}, db);

  return {
    scan: {
      student: studentSummary(target.student),
      direction,
      status,
      reason: eventReason,
      scannedAt: event.scannedAt.toISOString(),
    },
    ...dashboard,
  };
}

export type AttendanceRegisterRow = {
  student: {
    id: string;
    name: string;
    admissionNumber: string;
    className: string | null;
    streamName: string | null;
    studentType: "DAY" | "BOARDING" | null;
    photoUrl: null;
  };
  tapIn: { id: string; scannedAt: string; source: string } | null;
  tapOut: { id: string; scannedAt: string; source: string } | null;
  lastScan: { id: string; direction: string; scannedAt: string; status: string; reason: string | null } | null;
  currentStatus: "ABSENT" | "PRESENT" | "LATE" | "OUT" | "OUT_ONLY" | "BLOCKED" | "DUPLICATE";
};

export async function getAttendanceRegister(
  ctx: NfcOperationsContext,
  filters: { date?: string; classId?: string; streamId?: string; search?: string; studentType?: string } = {},
  db: NfcOperationsClient = defaultPrisma,
): Promise<AttendanceRegisterResponse> {
  return getCanonicalAttendanceRegister(ctx, filters, db as never);
}

export async function listAttendanceClasses(
  ctx: NfcOperationsContext,
  db: NfcOperationsClient = defaultPrisma,
) {
  const schoolId = requireSchoolId(ctx);
  requireAnyPermission(ctx, ["nfc.devices.manage", "nfc.fee-holds.manage"]);
  const classes = await db.schoolClass.findMany({
    where: { schoolId },
    orderBy: { level: "asc" },
    select: {
      id: true,
      name: true,
      code: true,
      streams: {
        select: { id: true, name: true, code: true },
        orderBy: { name: "asc" },
      },
    },
  });
  return { classes };
}

export async function getWalletDashboard(
  ctx: NfcOperationsContext,
  filters: { search?: string; classId?: string; streamId?: string } = {},
  db: NfcOperationsClient = defaultPrisma,
) {
  const schoolId = requireSchoolId(ctx);
  requirePermission(ctx, "nfc.wallets.pin.manage");
  const { start, end } = todayRange();
  const [students, wallets, todayCharges] = await Promise.all([
    db.student.findMany({
      where: buildStudentWhere(schoolId, filters),
      select: {
        id: true,
        admissionNumber: true,
        firstName: true,
        lastName: true,
        isActive: true,
        enrollments: studentInclude.enrollments,
        credentials: { where: { type: CredentialType.NFC_WRISTBAND, status: CredentialStatus.ACTIVE }, take: 1 },
        wallet: { include: { transactions: { orderBy: { createdAt: "desc" }, take: 1 } } },
      },
      take: 100,
    }),
    db.studentWallet.findMany({ where: { schoolId } }),
    db.studentWalletTransaction.findMany({ where: { schoolId, type: WalletTransactionType.CHARGE, createdAt: { gte: start, lt: end } } }),
  ]);
  return {
    summary: {
      totalActiveWallets: wallets.filter((wallet) => wallet.status === StudentWalletStatus.ACTIVE).length,
      totalBalanceCents: wallets.reduce((sum, wallet) => sum + wallet.balanceCents, 0),
      frozenWallets: wallets.filter((wallet) => wallet.status === StudentWalletStatus.FROZEN).length,
      todayCanteenSpendCents: todayCharges.reduce((sum, charge) => sum + Math.abs(charge.amountCents), 0),
    },
    wallets: students.map((student) => {
      const wallet = student.wallet;
      const lastTransaction = wallet?.transactions?.[0] ?? null;
      return {
        student: studentSummary(student as StudentForNfc),
        wallet: {
          id: wallet?.id ?? "",
          balanceCents: wallet?.balanceCents ?? 0,
          status: wallet?.status ?? StudentWalletStatus.ACTIVE,
          frozenReason: wallet?.frozenReason ?? null,
          pinSet: !!wallet?.pinHash,
          pinLockedUntil: wallet?.pinLockedUntil ? wallet.pinLockedUntil.toISOString() : null,
        },
        activeCredentialStatus: student.credentials[0]?.status ?? "NONE",
        lastTransaction: lastTransaction
          ? {
              amountCents: lastTransaction.amountCents,
              type: lastTransaction.type,
              description: lastTransaction.description,
              createdAt: lastTransaction.createdAt.toISOString(),
            }
          : null,
      };
    }),
  };
}

export async function chargeCanteen(
  ctx: NfcOperationsContext,
  input: { tokenOrUid: string; amountCents: number; pin: string; description?: string; idempotencyKey?: string; deviceId?: string },
  db: NfcOperationsClient = defaultPrisma,
) {
  const schoolId = requireSchoolId(ctx);
  requirePermission(ctx, "nfc.canteen.charge");
  if (!Number.isInteger(input.amountCents) || input.amountCents <= 0) throw Object.assign(new Error("Charge amount must be greater than zero."), { status: 400 });
  assertPinFormat(input.pin);

  const target = await resolveNfcScanTarget(db, schoolId, input.tokenOrUid);
  if (!target) return { ok: false, reason: "unknown token" };
  if (target.blocked) return { ok: false, reason: target.reason ?? "blocked" };

  return runWrite(db, async (tx) => {
    const wallet = await tx.studentWallet.upsert({
      where: { studentId: target.student.id },
      create: { schoolId, studentId: target.student.id, balanceCents: 0 },
      update: {},
    });
    if (wallet.status === StudentWalletStatus.FROZEN) return { ok: false, reason: "wallet frozen", student: studentSummary(target.student), wallet };

    // Idempotency check before PIN — avoids burning a PIN attempt on a duplicate request
    const existing = input.idempotencyKey
      ? await tx.studentWalletTransaction.findUnique({ where: { schoolId_idempotencyKey: { schoolId, idempotencyKey: input.idempotencyKey } } })
      : null;
    if (existing) {
      return {
        ok: true,
        duplicate: true,
        transaction: { id: existing.id, amountCents: existing.amountCents, balanceAfterCents: existing.balanceAfterCents, createdAt: existing.createdAt.toISOString() },
        student: studentSummary(target.student),
        wallet,
      };
    }

    // PIN verification — must happen inside the transaction so updates are atomic
    const pinResult = await checkPin(wallet, input.pin);
    if (!pinResult.ok) {
      if (pinResult.reason === "no_pin") {
        throw Object.assign(new Error("Wallet PIN is not set. An admin must set a PIN before this wallet can be charged."), { status: 409, code: "WALLET_PIN_NOT_SET" });
      }
      if (pinResult.reason === "locked") {
        throw Object.assign(new Error("Wallet PIN is temporarily locked due to too many failed attempts. Try again in 15 minutes."), { status: 423, code: "WALLET_PIN_LOCKED" });
      }
      // wrong_pin: increment attempts, possibly lock, audit
      const newAttempts = wallet.pinFailedAttempts + 1;
      const lockedUntil = pinResult.pinLockedUntil ?? null;
      await tx.studentWallet.updateMany({
        where: { id: wallet.id, schoolId },
        data: { pinFailedAttempts: newAttempts, pinLockedUntil: lockedUntil },
      });
      await tx.auditLog.create({
        data: {
          schoolId,
          action: "wallet_pin.failed_attempt",
          details: { walletId: wallet.id, studentId: target.student.id, attempts: newAttempts, locked: !!lockedUntil },
        },
      });
      if (lockedUntil) {
        await tx.auditLog.create({
          data: {
            schoolId,
            action: "wallet_pin.locked",
            details: { walletId: wallet.id, studentId: target.student.id, lockedUntil },
          },
        });
        throw Object.assign(new Error("Too many incorrect PIN attempts. Wallet PIN is now locked for 15 minutes."), { status: 423, code: "WALLET_PIN_LOCKED" });
      }
      throw Object.assign(new Error("Incorrect PIN."), { status: 422, code: "WALLET_PIN_INCORRECT" });
    }

    // PIN correct — reset counters and record verification
    await tx.studentWallet.updateMany({
      where: { id: wallet.id, schoolId },
      data: { pinFailedAttempts: 0, pinLockedUntil: null, pinLastVerifiedAt: new Date() },
    });
    await tx.auditLog.create({
      data: {
        schoolId,
        action: "wallet_pin.verified",
        details: { walletId: wallet.id, studentId: target.student.id },
      },
    });

    if (wallet.balanceCents < input.amountCents) return { ok: false, reason: "insufficient balance", student: studentSummary(target.student), wallet };
    const balanceAfterCharge = wallet.balanceCents - input.amountCents;
    await tx.studentWallet.updateMany({
      where: { id: wallet.id, schoolId },
      data: { balanceCents: balanceAfterCharge },
    });
    const transaction = await tx.studentWalletTransaction.create({
      data: {
        schoolId,
        studentId: target.student.id,
        walletId: wallet.id,
        credentialId: target.credential?.id ?? null,
        cashierUserId: ctx.actorId ?? null,
        type: WalletTransactionType.CHARGE,
        amountCents: -input.amountCents,
        balanceAfterCents: balanceAfterCharge,
        description: input.description?.trim() || null,
        idempotencyKey: input.idempotencyKey ?? null,
      },
    });
    await tx.auditLog.create({
      data: {
        schoolId,
        action: "student_wallet.charge",
        details: {
          studentId: target.student.id,
          walletId: wallet.id,
          amountCents: input.amountCents,
          description: input.description ?? null,
          pinVerified: true,
          actor: { id: ctx.actorId ?? null },
        },
      },
    });
    return {
      ok: true,
      transaction: {
        id: transaction.id,
        amountCents: transaction.amountCents,
        description: transaction.description,
        createdAt: transaction.createdAt.toISOString(),
      },
      student: studentSummary(target.student),
      wallet: { id: wallet.id, balanceCents: balanceAfterCharge, status: wallet.status },
    };
  });
}

export async function setWalletPin(
  ctx: NfcOperationsContext,
  input: { walletId: string; pin: string; reason: string },
  db: NfcOperationsClient = defaultPrisma,
) {
  const schoolId = requireSchoolId(ctx);
  requirePermission(ctx, "nfc.wallets.pin.manage");
  assertPinFormat(input.pin);
  if (!input.reason.trim()) throw Object.assign(new Error("Reason is required."), { status: 400 });

  const wallet = await db.studentWallet.findFirst({ where: { id: input.walletId, schoolId } });
  if (!wallet) throw Object.assign(new Error("Wallet not found."), { status: 404 });

  const pinHash = await hashWalletPin(input.pin);
  await db.studentWallet.updateMany({
    where: { id: wallet.id, schoolId },
    data: { pinHash, pinSetAt: new Date(), pinFailedAttempts: 0, pinLockedUntil: null },
  });
  await db.auditLog.create({
    data: {
      schoolId,
      action: "wallet_pin.set",
      details: { walletId: wallet.id, studentId: wallet.studentId, reason: input.reason, actor: { id: ctx.actorId ?? null } },
    },
  });
  return { ok: true, pinSet: true };
}

export async function getWalletPinStatus(
  ctx: NfcOperationsContext,
  walletId: string,
  db: NfcOperationsClient = defaultPrisma,
) {
  const schoolId = requireSchoolId(ctx);
  requirePermission(ctx, "nfc.wallets.pin.manage");
  const wallet = await db.studentWallet.findFirst({ where: { id: walletId, schoolId } });
  if (!wallet) throw Object.assign(new Error("Wallet not found."), { status: 404 });
  const now = new Date();
  const locked = !!wallet.pinLockedUntil && wallet.pinLockedUntil > now;
  return {
    pinSet: !!wallet.pinHash,
    locked,
    pinLockedUntil: locked ? wallet.pinLockedUntil!.toISOString() : null,
    pinFailedAttempts: wallet.pinFailedAttempts,
  };
}

export async function changeWalletPin(
  ctx: NfcOperationsContext,
  input: { walletId: string; oldPin: string; newPin: string },
  db: NfcOperationsClient = defaultPrisma,
) {
  const schoolId = requireSchoolId(ctx);
  requirePermission(ctx, "nfc.wallets.pin.manage");
  assertPinFormat(input.newPin);

  const wallet = await db.studentWallet.findFirst({ where: { id: input.walletId, schoolId } });
  if (!wallet) throw Object.assign(new Error("Wallet not found."), { status: 404 });
  if (!wallet.pinHash) throw Object.assign(new Error("No PIN is currently set on this wallet."), { status: 400 });

  const pinResult = await checkPin(wallet, input.oldPin);
  if (!pinResult.ok) {
    if (pinResult.reason === "locked") throw Object.assign(new Error("Wallet PIN is locked."), { status: 423, code: "WALLET_PIN_LOCKED" });
    throw Object.assign(new Error("Old PIN is incorrect."), { status: 422, code: "WALLET_PIN_INCORRECT" });
  }

  const newHash = await hashWalletPin(input.newPin);
  await db.studentWallet.updateMany({
    where: { id: wallet.id, schoolId },
    data: { pinHash: newHash, pinSetAt: new Date(), pinFailedAttempts: 0, pinLockedUntil: null },
  });
  await db.auditLog.create({
    data: {
      schoolId,
      action: "wallet_pin.changed",
      details: { walletId: wallet.id, studentId: wallet.studentId, actor: { id: ctx.actorId ?? null } },
    },
  });
  return { ok: true };
}

export async function setStudentWalletPin(
  ctx: NfcOperationsContext,
  input: { studentId: string; pin: string; reason: string },
  db: NfcOperationsClient = defaultPrisma,
) {
  const schoolId = requireSchoolId(ctx);
  requirePermission(ctx, "nfc.wallets.pin.manage");
  assertPinFormat(input.pin);
  if (!input.reason.trim()) throw Object.assign(new Error("Reason is required."), { status: 400 });

  const student = await db.student.findFirst({ where: { id: input.studentId, schoolId } });
  if (!student) throw Object.assign(new Error("Student not found."), { status: 404 });

  let wallet = await db.studentWallet.findFirst({ where: { studentId: input.studentId, schoolId } });
  if (!wallet) {
    wallet = await db.studentWallet.create({
      data: { schoolId, studentId: input.studentId, balanceCents: 0 },
    });
  }

  const pinHash = await hashWalletPin(input.pin);
  await db.studentWallet.updateMany({
    where: { id: wallet.id, schoolId },
    data: { pinHash, pinSetAt: new Date(), pinFailedAttempts: 0, pinLockedUntil: null },
  });
  await db.auditLog.create({
    data: {
      schoolId,
      action: "wallet_pin.set",
      details: { walletId: wallet.id, studentId: input.studentId, reason: input.reason, actor: { id: ctx.actorId ?? null } },
    },
  });
  return {
    walletId: wallet.id,
    studentId: input.studentId,
    pinSet: true,
    pinLocked: false,
    pinLockedUntil: null,
  };
}

export async function getStudentWalletPinStatus(
  ctx: NfcOperationsContext,
  studentId: string,
  db: NfcOperationsClient = defaultPrisma,
) {
  const schoolId = requireSchoolId(ctx);
  requirePermission(ctx, "nfc.wallets.pin.manage");
  const wallet = await db.studentWallet.findFirst({ where: { studentId, schoolId } });
  if (!wallet) return { pinSet: false, locked: false, pinLockedUntil: null, pinFailedAttempts: 0 };
  const now = new Date();
  const locked = !!wallet.pinLockedUntil && wallet.pinLockedUntil > now;
  return {
    pinSet: !!wallet.pinHash,
    locked,
    pinLockedUntil: locked ? wallet.pinLockedUntil!.toISOString() : null,
    pinFailedAttempts: wallet.pinFailedAttempts,
  };
}

export async function scanGate(
  ctx: NfcOperationsContext,
  input: { tokenOrUid: string; idempotencyKey?: string; deviceId?: string },
  db: NfcOperationsClient = defaultPrisma,
) {
  const schoolId = requireSchoolId(ctx);
  requirePermission(ctx, "nfc.gate.scan", "POST /api/nfc/gate/scan");
  const policy = await getSchoolNfcPolicy(ctx, db);
  const now = new Date();
  const readerId = input.deviceId?.trim() || ctx.actorId || null;

  const target = await resolveNfcScanTarget(db, schoolId, input.tokenOrUid, { applyFeeHoldBlocking: true });
  const result = target && !target.blocked ? GateScanResult.ALLOWED : GateScanResult.BLOCKED;
  const reason = target ? target.reason : await resolveGateBlockedReason(db, schoolId, input.tokenOrUid);

  const scan = await db.nfcGateScan.create({
    data: {
      schoolId,
      studentId: target?.student.id ?? null,
      credentialId: target?.credential?.id ?? null,
      scannedByUserId: ctx.actorId ?? null,
      result,
      reason,
    },
  });

  if (result === GateScanResult.BLOCKED) {
    if (target?.student.id && readerId) {
      const eventId = input.idempotencyKey?.trim() || `gate-scan:${scan.id}`;
      await db.campusMovementEvent.create({
        data: {
          eventId,
          schoolId,
          studentId: target.student.id,
          readerId,
          type: "RESTRICTED_ENTRY_ATTEMPT",
          occurredAt: scan.scannedAt,
          deviceTime: now,
          offlineSynced: false,
          metadata: {
            source: "GATE_PWA",
            gateScanId: scan.id,
            scannedByUserId: ctx.actorId ?? null,
            reason,
          },
        },
      });
    }
    await db.auditLog.create({
      data: {
        schoolId,
        action: "nfc_gate.blocked",
        details: { studentId: target?.student.id ?? null, reason, actor: { id: ctx.actorId ?? null } },
      },
    });
  } else if (target?.student.id && readerId) {
    const latestMovement = await db.campusMovementEvent.findFirst({
      where: {
        schoolId,
        studentId: target.student.id,
        type: { in: ["GATE_ENTRY", "MANUAL_GATE_OVERRIDE", "GATE_EXIT"] },
      },
      orderBy: { occurredAt: "desc" },
    });
    const activePassOut = await db.studentPassOut.findFirst({
      where: {
        schoolId,
        studentId: target.student.id,
        status: { in: ["APPROVED", "CHECKED_OUT"] as never },
        activeFrom: { lte: now },
        activeUntil: { gte: now },
        cancelledAt: null,
      },
      orderBy: { createdAt: "desc" },
    });
    const onCampus = isStudentCurrentlyOnCampus(latestMovement);
    const movementType = activePassOut
      ? (onCampus ? "GATE_EXIT" : "GATE_ENTRY")
      : onCampus
        ? "GATE_EXIT"
        : "GATE_ENTRY";

    if (movementType === "GATE_ENTRY") {
      const isLate = policy.policy.attendanceTapInCutoffEnabled
        && !!policy.policy.tapInCutoffTime
        && isAfterCutoff(now, policy.policy.timezone, policy.policy.tapInCutoffTime);
      const { start } = getZonedDayRange(now, policy.policy.timezone);
      await db.dailyAttendance.upsert({
        where: {
          schoolId_studentId_attendanceDate: {
            schoolId,
            studentId: target.student.id,
            attendanceDate: start,
          },
        },
        create: {
          schoolId,
          studentId: target.student.id,
          attendanceDate: start,
          status: isLate ? "LATE" : "PRESENT",
          firstRecordedAt: scan.scannedAt,
          source: "GATE_PWA",
        },
        update: {},
      });
    }

    const eventId = input.idempotencyKey?.trim() || `gate-scan:${scan.id}`;
    const movement = await db.campusMovementEvent.create({
      data: {
        eventId,
        schoolId,
        studentId: target.student.id,
        readerId,
        type: movementType,
        occurredAt: scan.scannedAt,
        deviceTime: now,
        offlineSynced: false,
        metadata: {
          source: "GATE_PWA",
          gateScanId: scan.id,
          scannedByUserId: ctx.actorId ?? null,
          passOutId: activePassOut?.id ?? null,
          passOutAction: activePassOut ? (movementType === "GATE_EXIT" ? "CHECK_OUT" : "CHECK_IN") : null,
        },
      },
    });

    if (activePassOut) {
      const passOutUpdate = movementType === "GATE_EXIT"
        ? {
            status: "CHECKED_OUT",
            checkedOutAt: activePassOut.checkedOutAt ?? scan.scannedAt,
            checkoutMovementEventId: movement.id,
          }
        : {
            status: "RETURNED",
            checkedInAt: scan.scannedAt,
            checkinMovementEventId: movement.id,
          };
      await db.studentPassOut.update({
        where: { id: activePassOut.id },
        data: passOutUpdate as never,
      });
      await db.auditLog.create({
        data: {
          schoolId,
          action: movementType === "GATE_EXIT" ? "student_pass_out.checked_out" : "student_pass_out.returned",
          details: {
            actor: { id: ctx.actorId ?? null },
            passOutId: activePassOut.id,
            studentId: target.student.id,
            gateScanId: scan.id,
            movementEventId: movement.id,
          },
        },
      });
    }
  }

  const lastAttendance = target
    ? await db.studentAttendanceEvent.findFirst({ where: { schoolId, studentId: target.student.id }, orderBy: { scannedAt: "desc" } })
    : null;

  return {
    result,
    reason,
    scannedAt: scan.scannedAt.toISOString(),
    student: target ? studentSummary(target.student) : undefined,
    credentialStatus: target?.credential?.status ?? (target ? "ACTIVE" : "UNKNOWN"),
    todayAttendanceStatus: lastAttendance?.direction ?? "NONE",
    passOut: target?.student.id
      ? await db.studentPassOut.findFirst({
          where: { schoolId, studentId: target.student.id },
          orderBy: { createdAt: "desc" },
        }).then((row) => row ? {
          id: row.id,
          status: row.status,
          activeFrom: row.activeFrom.toISOString(),
          activeUntil: row.activeUntil.toISOString(),
          checkedOutAt: row.checkedOutAt?.toISOString() ?? null,
          checkedInAt: row.checkedInAt?.toISOString() ?? null,
        } : null)
      : null,
  };
}

async function resolveStudentAndCredential(
  db: NfcOperationsClient,
  schoolId: string,
  input: { studentId?: string | null; admissionNumber?: string | null; tokenOrUid?: string | null },
): Promise<{ student: StudentForNfc; credentialId?: string }> {
  if (input.tokenOrUid) {
    const target = await resolveNfcScanTarget(db, schoolId, input.tokenOrUid);
    if (!target) throw Object.assign(new Error("NFC wristband not found in this school."), { status: 404 });
    if (target.reason && target.reason !== "inactive student") throw Object.assign(new Error(`NFC wristband is ${target.reason}.`), { status: 400 });
    if (!target.student.isActive) throw Object.assign(new Error("Student is inactive."), { status: 400 });
    return { student: target.student, credentialId: target.credential?.id };
  }
  if (input.admissionNumber) {
    const found = await db.student.findFirst({
      where: { schoolId, admissionNumber: input.admissionNumber.trim(), isActive: true },
      include: { enrollments: studentInclude.enrollments },
    });
    if (!found) throw Object.assign(new Error("Student not found in this school."), { status: 404 });
    return { student: found as StudentForNfc };
  }
  if (input.studentId) {
    const found = await db.student.findFirst({
      where: { id: input.studentId, schoolId, isActive: true },
      include: { enrollments: studentInclude.enrollments },
    });
    if (!found) throw Object.assign(new Error("Student not found."), { status: 404 });
    return { student: found as StudentForNfc };
  }
  throw Object.assign(new Error("Provide studentId, admissionNumber, or tokenOrUid."), { status: 400 });
}

export async function getStudentWalletDetail(
  ctx: NfcOperationsContext,
  studentId: string,
  db: NfcOperationsClient = defaultPrisma,
) {
  const schoolId = requireSchoolId(ctx);
  requireAnyPermission(ctx, ["nfc.wallets.topup", "nfc.canteen.transactions.view"]);
  const student = await db.student.findFirst({
    where: { id: studentId, schoolId },
    include: { enrollments: studentInclude.enrollments },
  });
  if (!student) throw Object.assign(new Error("Student not found for this school."), { status: 404 });

  const wallet = await db.studentWallet.findFirst({ where: { studentId, schoolId } });
  const transactions = await db.studentWalletTransaction.findMany({
    where: { schoolId, studentId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return {
    student: studentSummary(student as StudentForNfc),
    wallet: wallet
      ? {
          id: wallet.id,
          balanceCents: wallet.balanceCents,
          status: wallet.status,
          currency: "UGX" as const,
        }
      : null,
    transactions: transactions.map((transaction) => ({
      id: transaction.id,
      type: transaction.type,
      amountCents: transaction.amountCents,
      balanceAfterCents: transaction.balanceAfterCents ?? null,
      paymentMethod: transaction.paymentMethod ?? null,
      reference: transaction.reference ?? null,
      description: transaction.description ?? null,
      createdAt: transaction.createdAt.toISOString(),
    })),
  };
}

export async function resolveWalletStudent(
  ctx: NfcOperationsContext,
  input: { studentId?: string; admissionNumber?: string; tokenOrUid?: string },
  db: NfcOperationsClient = defaultPrisma,
) {
  const schoolId = requireSchoolId(ctx);
  requireAnyPermission(ctx, ["nfc.canteen.charge", "nfc.wallets.topup"]);
  const { student, credentialId } = await resolveStudentAndCredential(db, schoolId, input);
  const wallet = await db.studentWallet.findFirst({ where: { studentId: student.id, schoolId } });
  return {
    student: studentSummary(student),
    wallet: wallet ? { id: wallet.id, balanceCents: wallet.balanceCents, status: wallet.status, pinSet: !!wallet.pinHash } : null,
    credentialId: credentialId ?? null,
  };
}

export type WalletTopUpInput = {
  studentId?: string;
  admissionNumber?: string;
  tokenOrUid?: string;
  amountUgx: number;
  paymentMethod: "CASH" | "MOBILE_MONEY" | "PARENT_DEPOSIT" | "ADJUSTMENT";
  reference?: string;
  notes?: string;
  idempotencyKey?: string;
};

export async function topUpWallet(
  ctx: NfcOperationsContext,
  input: WalletTopUpInput,
  db: NfcOperationsClient = defaultPrisma,
) {
  const schoolId = requireSchoolId(ctx);
  requirePermission(ctx, "nfc.wallets.topup");
  const amountCents = Math.round(input.amountUgx * 100);
  if (!Number.isFinite(amountCents) || amountCents <= 0) {
    throw Object.assign(new Error("Top-up amount must be greater than zero."), { status: 400 });
  }

  const { student, credentialId } = await resolveStudentAndCredential(db, schoolId, input);
  const studentId = student.id;

  const ikey = input.idempotencyKey?.trim() || null;

  return runWrite(db, async (tx) => {
    // Idempotency: return existing transaction if duplicate key
    if (ikey) {
      const existing = await tx.studentWalletTransaction.findUnique({
        where: { schoolId_idempotencyKey: { schoolId, idempotencyKey: ikey } },
      });
      if (existing) {
        const wallet = await tx.studentWallet.findFirst({ where: { studentId, schoolId } });
        return {
          ok: true,
          duplicate: true,
          transaction: { id: existing.id, amountCents: existing.amountCents, paymentMethod: existing.paymentMethod, reference: existing.reference, createdAt: existing.createdAt.toISOString() },
          student: studentSummary(student),
          wallet: wallet ? { id: wallet.id, balanceCents: wallet.balanceCents, status: wallet.status } : null,
        };
      }
    }

    let wallet = await tx.studentWallet.findFirst({ where: { studentId, schoolId } });
    if (!wallet) {
      wallet = await tx.studentWallet.create({
        data: { schoolId, studentId, balanceCents: 0 },
      });
    }

    const balanceBefore = wallet.balanceCents;
    await tx.studentWallet.updateMany({
      where: { id: wallet.id, schoolId },
      data: { balanceCents: { increment: amountCents } },
    });

    const transaction = await tx.studentWalletTransaction.create({
      data: {
        schoolId,
        studentId,
        walletId: wallet.id,
        credentialId: credentialId ?? null,
        cashierUserId: ctx.actorId ?? null,
        type: WalletTransactionType.TOP_UP,
        amountCents,
        balanceAfterCents: balanceBefore + amountCents,
        paymentMethod: input.paymentMethod,
        reference: input.reference?.trim() || null,
        description: input.notes?.trim() || null,
        idempotencyKey: ikey,
      },
    });

    await tx.auditLog.create({
      data: {
        schoolId,
        action: "student_wallet.top_up",
        details: {
          studentId,
          amountUgx: input.amountUgx,
          paymentMethod: input.paymentMethod,
          reference: input.reference ?? null,
          actor: { id: ctx.actorId ?? null },
        },
      },
    });

    return {
      ok: true,
      duplicate: false,
      transaction: {
        id: transaction.id,
        amountCents: transaction.amountCents,
        paymentMethod: transaction.paymentMethod,
        reference: transaction.reference,
        createdAt: transaction.createdAt.toISOString(),
      },
      student: studentSummary(student),
      walletBefore: { id: wallet.id, balanceCents: balanceBefore },
      wallet: { id: wallet.id, balanceCents: balanceBefore + amountCents, status: wallet.status },
    };
  });
}

const WALLET_MGMT_ROLES = ["CANTEEN", "CASHIER"] as const;
const ADMIN_ONLY_ROLES = ["ADMIN_OPERATOR"] as const;

// ─── Transaction list ─────────────────────────────────────────────────────────

export type WalletTransactionFilters = {
  dateFrom?: string;
  dateTo?: string;
  studentId?: string;
  admissionNumber?: string;
  classId?: string;
  streamId?: string;
  cashierUserId?: string;
  type?: string;
  search?: string;
};

export async function listWalletTransactions(
  ctx: NfcOperationsContext,
  filters: WalletTransactionFilters = {},
  db: NfcOperationsClient = defaultPrisma,
) {
  const schoolId = requireSchoolId(ctx);
  requirePermission(ctx, "nfc.canteen.transactions.view");

  const where: Prisma.StudentWalletTransactionWhereInput = { schoolId };

  // CASHIER and CANTEEN roles see only their own charge transactions
  const isRestrictedCanteenRole = ctx.role === "CASHIER" || ctx.role === "CANTEEN";
  if (isRestrictedCanteenRole) {
    where.cashierUserId = ctx.actorId ?? "__none__";
    where.type = WalletTransactionType.CHARGE;
  } else {
    if (filters.cashierUserId) where.cashierUserId = filters.cashierUserId;
  }

  if (filters.dateFrom || filters.dateTo) {
    where.createdAt = {
      ...(filters.dateFrom ? { gte: new Date(filters.dateFrom) } : {}),
      ...(filters.dateTo ? { lt: new Date(new Date(filters.dateTo).getTime() + 86400000) } : {}),
    };
  }
  if (filters.studentId) where.studentId = filters.studentId;
  if (filters.type && Object.values(WalletTransactionType).includes(filters.type as WalletTransactionType)) {
    where.type = filters.type as WalletTransactionType;
  }
  if (filters.admissionNumber || filters.classId || filters.streamId || filters.search) {
    const search = filters.search?.trim();
    where.student = {
      ...(filters.admissionNumber ? { admissionNumber: { equals: filters.admissionNumber.trim(), mode: "insensitive" } } : {}),
      ...(filters.classId || filters.streamId
        ? { enrollments: { some: { isActive: true, status: "ACTIVE" as const, classId: filters.classId || undefined, streamId: filters.streamId || undefined } } }
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
    };
  }

  const rows = await db.studentWalletTransaction.findMany({
    where,
    include: {
      student: {
        select: {
          id: true, admissionNumber: true, firstName: true, lastName: true,
          enrollments: studentInclude.enrollments,
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return {
    transactions: rows.map((row) => ({
      id: row.id,
      type: row.type,
      amountCents: row.amountCents,
      balanceAfterCents: row.balanceAfterCents ?? null,
      paymentMethod: row.paymentMethod ?? null,
      reference: row.reference ?? null,
      description: row.description ?? null,
      idempotencyKey: row.idempotencyKey ?? null,
      reversalOfId: row.reversalOfId ?? null,
      cashierUserId: row.cashierUserId ?? null,
      createdAt: row.createdAt.toISOString(),
      student: studentSummary(row.student as StudentForNfc),
    })),
  };
}

// ─── Reversal ────────────────────────────────────────────────────────────────

export async function reverseTransaction(
  ctx: NfcOperationsContext,
  transactionId: string,
  reason: string,
  db: NfcOperationsClient = defaultPrisma,
) {
  const schoolId = requireSchoolId(ctx);
  if (!ctx.actorId || !ctx.role) throw Object.assign(new Error("Authentication required."), { status: 401 });
  if (ctx.role !== "ADMIN_OPERATOR") {
    throw Object.assign(new Error("Only administrators can reverse wallet transactions."), { status: 403 });
  }
  if (!reason?.trim()) throw Object.assign(new Error("Reversal reason is required."), { status: 400 });

  return runWrite(db, async (tx) => {
    const original = await tx.studentWalletTransaction.findFirst({
      where: { id: transactionId, schoolId },
    });
    if (!original) throw Object.assign(new Error("Transaction not found."), { status: 404 });
    if (original.type === WalletTransactionType.REVERSAL) {
      throw Object.assign(new Error("Cannot reverse a reversal."), { status: 400 });
    }

    // Check not already reversed
    const alreadyReversed = await tx.studentWalletTransaction.findFirst({
      where: { schoolId, reversalOfId: transactionId, type: WalletTransactionType.REVERSAL },
    });
    if (alreadyReversed) throw Object.assign(new Error("Transaction has already been reversed."), { status: 409 });

    const wallet = await tx.studentWallet.findFirst({ where: { id: original.walletId, schoolId } });
    if (!wallet) throw Object.assign(new Error("Wallet not found."), { status: 404 });

    // Reversal inverts the original amount
    const reversalAmount = -original.amountCents;
    const balanceAfter = wallet.balanceCents + reversalAmount;

    await tx.studentWallet.updateMany({
      where: { id: wallet.id, schoolId },
      data: { balanceCents: balanceAfter },
    });

    const reversal = await tx.studentWalletTransaction.create({
      data: {
        schoolId,
        studentId: original.studentId,
        walletId: original.walletId,
        credentialId: original.credentialId ?? null,
        cashierUserId: ctx.actorId ?? null,
        type: WalletTransactionType.REVERSAL,
        amountCents: reversalAmount,
        balanceAfterCents: balanceAfter,
        description: reason.trim(),
        reversalOfId: transactionId,
      },
    });

    await tx.auditLog.create({
      data: {
        schoolId,
        action: "student_wallet.reversed",
        details: {
          originalTransactionId: transactionId,
          studentId: original.studentId,
          reversalAmount,
          reason: reason.trim(),
          actor: { id: ctx.actorId ?? null },
        },
      },
    });

    return {
      ok: true,
      reversal: {
        id: reversal.id,
        amountCents: reversal.amountCents,
        description: reversal.description,
        reversalOfId: transactionId,
        createdAt: reversal.createdAt.toISOString(),
      },
      wallet: { id: wallet.id, balanceCents: balanceAfter, status: wallet.status },
    };
  });
}

// ─── Adjustment ───────────────────────────────────────────────────────────────

export type WalletAdjustInput = {
  studentId?: string;
  admissionNumber?: string;
  amountUgx: number;
  reason: string;
};

export async function adjustWallet(
  ctx: NfcOperationsContext,
  input: WalletAdjustInput,
  db: NfcOperationsClient = defaultPrisma,
) {
  const schoolId = requireSchoolId(ctx);
  // Only ADMIN_OPERATOR — requireRole already allows ADMIN_OPERATOR via bypass
  if (!ctx.actorId || !ctx.role) throw Object.assign(new Error("Authentication required."), { status: 401 });
  if (ctx.role !== "ADMIN_OPERATOR") throw Object.assign(new Error("Only administrators can make manual adjustments."), { status: 403 });
  if (!input.reason?.trim()) throw Object.assign(new Error("Adjustment reason is required."), { status: 400 });

  const amountCents = Math.round(input.amountUgx * 100);
  if (!Number.isFinite(amountCents) || amountCents === 0) {
    throw Object.assign(new Error("Adjustment amount must be non-zero."), { status: 400 });
  }

  const { student } = await resolveStudentAndCredential(db, schoolId, input);
  const studentId = student.id;

  return runWrite(db, async (tx) => {
    const walletSnap = await tx.studentWallet.upsert({
      where: { studentId },
      create: { schoolId, studentId, balanceCents: 0 },
      update: {},
    });
    const balanceBefore = walletSnap.balanceCents;
    const balanceAfter = balanceBefore + amountCents;

    await tx.studentWallet.updateMany({
      where: { id: walletSnap.id, schoolId },
      data: { balanceCents: balanceAfter },
    });

    const txn = await tx.studentWalletTransaction.create({
      data: {
        schoolId,
        studentId,
        walletId: walletSnap.id,
        cashierUserId: ctx.actorId ?? null,
        type: WalletTransactionType.ADJUSTMENT,
        amountCents,
        balanceAfterCents: balanceAfter,
        description: input.reason.trim(),
      },
    });

    await tx.auditLog.create({
      data: {
        schoolId,
        action: "student_wallet.adjusted",
        details: {
          studentId,
          amountUgx: input.amountUgx,
          balanceBefore,
          balanceAfter,
          reason: input.reason.trim(),
          actor: { id: ctx.actorId ?? null },
        },
      },
    });

    return {
      ok: true,
      transaction: {
        id: txn.id,
        amountCents: txn.amountCents,
        description: txn.description,
        createdAt: txn.createdAt.toISOString(),
      },
      student: studentSummary(student),
      walletBefore: { id: walletSnap.id, balanceCents: balanceBefore },
      wallet: { id: walletSnap.id, balanceCents: balanceAfter, status: walletSnap.status },
    };
  });
}

// ─── Daily summary ────────────────────────────────────────────────────────────

export async function getDailySummary(
  ctx: NfcOperationsContext,
  filters: { date?: string; cashierUserId?: string } = {},
  db: NfcOperationsClient = defaultPrisma,
) {
  const schoolId = requireSchoolId(ctx);
  requirePermission(ctx, "nfc.canteen.view");

  const date = filters.date ? new Date(filters.date) : new Date();
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  const transactions = await db.studentWalletTransaction.findMany({
    where: {
      schoolId,
      createdAt: { gte: start, lt: end },
      ...(filters.cashierUserId ? { cashierUserId: filters.cashierUserId } : {}),
    },
  });

  const charges = transactions.filter((t) => t.type === WalletTransactionType.CHARGE);
  const topUps = transactions.filter((t) => t.type === WalletTransactionType.TOP_UP);
  const reversals = transactions.filter((t) => t.type === WalletTransactionType.REVERSAL);
  const adjustments = transactions.filter((t) => t.type === WalletTransactionType.ADJUSTMENT);

  const totalChargesCents = charges.reduce((sum, t) => sum + Math.abs(t.amountCents), 0);
  const totalTopUpsCents = topUps.reduce((sum, t) => sum + t.amountCents, 0);
  const totalReversalsCents = reversals.reduce((sum, t) => sum + Math.abs(t.amountCents), 0);

  return {
    date: start.toISOString().slice(0, 10),
    summary: {
      totalChargesCents,
      totalTopUpsCents,
      totalReversalsCents,
      netSpendCents: totalChargesCents - totalReversalsCents,
      chargeCount: charges.length,
      topUpCount: topUps.length,
      reversalCount: reversals.length,
      adjustmentCount: adjustments.length,
    },
    transactions: transactions.map((t) => ({
      id: t.id,
      type: t.type,
      amountCents: t.amountCents,
      balanceAfterCents: t.balanceAfterCents ?? null,
      description: t.description ?? null,
      studentId: t.studentId,
      cashierUserId: t.cashierUserId ?? null,
      createdAt: t.createdAt.toISOString(),
    })),
  };
}

export async function getGateDashboard(ctx: NfcOperationsContext, db: NfcOperationsClient = defaultPrisma) {
  const schoolId = requireSchoolId(ctx);
  requirePermission(ctx, "nfc.gate.view", "GET /api/nfc/gate");
  const scans = await db.nfcGateScan.findMany({
    where: { schoolId },
    include: { student: { select: { id: true, admissionNumber: true, firstName: true, lastName: true, isActive: true, enrollments: studentInclude.enrollments } }, credential: true },
    orderBy: { scannedAt: "desc" },
    take: 20,
  });
  return {
    recentScans: scans.map((scan) => ({
      result: scan.result,
      reason: scan.reason,
      scannedAt: scan.scannedAt.toISOString(),
      student: scan.student ? studentSummary(scan.student as StudentForNfc) : undefined,
      credentialStatus: scan.credential?.status ?? "UNKNOWN",
      todayAttendanceStatus: "NONE" as const,
    })),
  };
}
