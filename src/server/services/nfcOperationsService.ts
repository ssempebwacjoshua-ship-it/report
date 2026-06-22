import {
  AttendanceDirection,
  AttendanceScanSource,
  AttendanceScanStatus,
  CredentialStatus,
  CredentialType,
  GateScanResult,
  StudentWalletStatus,
  WalletTransactionType,
  type Prisma,
  type PrismaClient,
} from "@prisma/client";
import { prisma as defaultPrisma } from "../db/prisma";
import type { SchoolUserRole } from "./authService";
import { normalizeCredentialUID } from "./studentCredentialService";
import { assertPinFormat, checkPin, hashWalletPin } from "./walletPinService";

type NfcOperationsClient = Pick<
  PrismaClient,
  "student" | "studentCredential" | "studentWallet" | "studentWalletTransaction" | "studentAttendanceEvent" | "nfcGateScan" | "auditLog" | "nfcTag"
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

function extractTokenOrUid(value: string) {
  const clean = value.trim();
  // Handles /nfc/t/:token, /t/:publicCode, and full URLs containing either path
  const match = clean.match(/(?:\/nfc)?\/t\/([^/?#\s]+)/i);
  const extracted = match ? decodeURIComponent(match[1] ?? "") : clean;
  return {
    token: extracted,
    uid: normalizeCredentialUID(extracted),
  };
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

async function resolveNfcScanTarget(
  db: NfcOperationsClient,
  schoolId: string,
  tokenOrUid: string,
): Promise<NfcScanTarget | null> {
  const { token, uid } = extractTokenOrUid(tokenOrUid);

  // 1. StudentCredential by scanToken or credentialUID
  const credential = await db.studentCredential.findFirst({
    where: { schoolId, type: CredentialType.NFC_WRISTBAND, OR: [{ scanToken: token }, { credentialUID: uid }] },
    include: credentialInclude,
  }) as CredentialForNfc | null;

  if (credential) {
    const reason = blockedReason(credential);
    return { student: credential.student, credential, nfcTagId: null, blocked: Boolean(reason), reason };
  }

  const tagInclude = {
    student: { select: { id: true, admissionNumber: true, firstName: true, lastName: true, isActive: true, enrollments: studentInclude.enrollments } },
  };
  const tagStatusFilter = { notIn: ["DISABLED", "LOST"] };

  // 2. NfcTag by publicCode (case-sensitive, as stored)
  const tagByCode = await db.nfcTag.findFirst({
    where: { schoolId, publicCode: token, studentId: { not: null }, status: tagStatusFilter },
    include: tagInclude,
  });

  if (tagByCode?.student) {
    const student = tagByCode.student as StudentForNfc;
    const reason = student.isActive ? null : "inactive student";
    return { student, credential: null, nfcTagId: tagByCode.id, blocked: !student.isActive, reason };
  }

  // 3. NfcTag by physicalUid (case-insensitive)
  if (uid) {
    const tagByUid = await db.nfcTag.findFirst({
      where: { schoolId, physicalUid: { equals: uid, mode: "insensitive" }, studentId: { not: null }, status: tagStatusFilter },
      include: tagInclude,
    });

    if (tagByUid?.student) {
      const student = tagByUid.student as StudentForNfc;
      const reason = student.isActive ? null : "inactive student";
      return { student, credential: null, nfcTagId: tagByUid.id, blocked: !student.isActive, reason };
    }
  }

  return null;
}

function buildStudentWhere(schoolId: string, filters: { search?: string; classId?: string; streamId?: string }) {
  const search = filters.search?.trim();
  return {
    schoolId,
    isActive: true,
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
  const cleanToken = token.trim();
  if (!cleanToken) throw Object.assign(new Error("NFC token is required."), { status: 400 });
  const credential = await db.studentCredential.findUnique({
    where: { scanToken: cleanToken },
    include: { ...credentialInclude, school: { select: { id: true, name: true } } },
  });
  if (!credential) return { found: false, mode: "PUBLIC_ID" as const, credentialStatus: "INVALID" as const, valid: false };
  if (ctx?.schoolId && ctx.schoolId !== credential.schoolId) throw Object.assign(new Error("You do not have access to this NFC credential."), { status: 403 });

  const typed = credential as CredentialForNfc & { school: { name: string } };
  const reason = blockedReason(typed);
  const role = ctx?.role;
  const mode = role === "SECURITY" || role === "GATE_SECURITY"
    ? "GATE_SECURITY"
    : role === "CANTEEN" || role === "CASHIER"
      ? "CANTEEN_CHARGE"
      : role === "TEACHER"
        ? "ATTENDANCE_SCAN"
        : role === "ADMIN_OPERATOR"
          ? "ADMIN_CREDENTIAL"
          : "PUBLIC_ID";
  const targetPath = reason
    ? undefined
    : mode === "GATE_SECURITY"
      ? `/gate/nfc/${encodeURIComponent(cleanToken)}`
      : mode === "CANTEEN_CHARGE"
        ? `/canteen/nfc/${encodeURIComponent(cleanToken)}`
        : mode === "ATTENDANCE_SCAN"
          ? `/nfc-attendance?token=${encodeURIComponent(cleanToken)}`
          : mode === "ADMIN_CREDENTIAL"
            ? `/nfc/wristbands?credentialId=${encodeURIComponent(typed.id)}`
            : `/nfc/t/${encodeURIComponent(cleanToken)}`;

  // Never expose student PII to unauthenticated callers.
  const studentPayload = ctx?.actorId
    ? { ...studentSummary(typed.student), schoolName: typed.school.name }
    : undefined;

  return {
    found: true,
    mode,
    targetPath,
    valid: !reason,
    actionBlocked: Boolean(reason),
    credentialStatus: typed.status,
    studentStatus: typed.student.isActive ? "ACTIVE" as const : "INACTIVE" as const,
    ...(studentPayload !== undefined ? { student: studentPayload } : {}),
    credential: { id: typed.id, nfcUrl: `/nfc/t/${cleanToken}` },
  };
}

export async function getAttendanceDashboard(
  ctx: NfcOperationsContext,
  filters: { search?: string; classId?: string; streamId?: string } = {},
  db: NfcOperationsClient = defaultPrisma,
) {
  const schoolId = requireSchoolId(ctx);
  requireRole(ctx, ["TEACHER"]);
  const { start, end } = todayRange();
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
  const tappedInIds = new Set(events.filter((event) => event.direction === AttendanceDirection.TAP_IN && event.status === AttendanceScanStatus.VALID).map((event) => event.studentId));
  return {
    summary: {
      totalTappedIn: tappedInIds.size,
      totalTappedOut: events.filter((event) => event.direction === AttendanceDirection.TAP_OUT && event.status === AttendanceScanStatus.VALID).length,
      lateArrivals: events.filter((event) => event.direction === AttendanceDirection.TAP_IN && event.scannedAt.getHours() >= 8).length,
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
  requireRole(ctx, ["TEACHER"]);

  const target = await resolveNfcScanTarget(db, schoolId, input.tokenOrUid);
  if (!target) throw Object.assign(new Error("NFC token not recognized."), { status: 404 });

  const direction = input.direction ?? AttendanceDirection.TAP_IN;
  const { start, end } = todayRange();

  const duplicate = !target.blocked
    ? await db.studentAttendanceEvent.findFirst({
        where: { schoolId, studentId: target.student.id, direction, status: AttendanceScanStatus.VALID, scannedAt: { gte: start, lt: end } },
      })
    : null;

  const status = target.blocked
    ? AttendanceScanStatus.BLOCKED
    : duplicate
      ? AttendanceScanStatus.DUPLICATE
      : AttendanceScanStatus.VALID;

  const eventReason = target.reason ?? (duplicate ? "duplicate tap" : null);

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

  const dashboard = await getAttendanceDashboard(ctx, {}, db);

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

export async function getWalletDashboard(
  ctx: NfcOperationsContext,
  filters: { search?: string; classId?: string; streamId?: string } = {},
  db: NfcOperationsClient = defaultPrisma,
) {
  const schoolId = requireSchoolId(ctx);
  requireRole(ctx, ["CANTEEN", "CASHIER"]);
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
  requireRole(ctx, ["CANTEEN", "CASHIER"]);
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

    // PIN verification — must happen inside the transaction so updates are atomic
    const pinResult = await checkPin(wallet, input.pin);
    if (!pinResult.ok) {
      if (pinResult.reason === "no_pin") {
        throw Object.assign(new Error("Wallet PIN is not set. An admin must set a PIN before this wallet can be charged."), { status: 403 });
      }
      if (pinResult.reason === "locked") {
        throw Object.assign(new Error("Wallet PIN is temporarily locked due to too many failed attempts. Try again in 15 minutes."), { status: 403 });
      }
      // wrong_pin: increment attempts, possibly lock, audit
      const newAttempts = wallet.pinFailedAttempts + 1;
      const lockedUntil = pinResult.pinLockedUntil ?? null;
      await tx.studentWallet.update({
        where: { id: wallet.id },
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
        throw Object.assign(new Error("Too many incorrect PIN attempts. Wallet PIN is now locked for 15 minutes."), { status: 403 });
      }
      throw Object.assign(new Error("Incorrect PIN."), { status: 401 });
    }

    // PIN correct — reset counters and record verification
    await tx.studentWallet.update({
      where: { id: wallet.id },
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
    const existing = input.idempotencyKey
      ? await tx.studentWalletTransaction.findUnique({ where: { schoolId_idempotencyKey: { schoolId, idempotencyKey: input.idempotencyKey } } })
      : null;
    if (existing) return { ok: false, reason: "duplicate charge attempt", student: studentSummary(target.student), wallet };
    const balanceAfterCharge = wallet.balanceCents - input.amountCents;
    const updatedWallet = await tx.studentWallet.update({
      where: { id: wallet.id },
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
      wallet: { id: updatedWallet.id, balanceCents: updatedWallet.balanceCents, status: updatedWallet.status },
    };
  });
}

export async function setWalletPin(
  ctx: NfcOperationsContext,
  input: { walletId: string; pin: string; reason: string },
  db: NfcOperationsClient = defaultPrisma,
) {
  const schoolId = requireSchoolId(ctx);
  requireRole(ctx, []);
  assertPinFormat(input.pin);
  if (!input.reason.trim()) throw Object.assign(new Error("Reason is required."), { status: 400 });

  const wallet = await db.studentWallet.findFirst({ where: { id: input.walletId, schoolId } });
  if (!wallet) throw Object.assign(new Error("Wallet not found."), { status: 404 });

  const pinHash = await hashWalletPin(input.pin);
  await db.studentWallet.update({
    where: { id: wallet.id },
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
  requireRole(ctx, ["CANTEEN", "CASHIER"]);
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
  requireRole(ctx, ["CANTEEN", "CASHIER"]);
  assertPinFormat(input.newPin);

  const wallet = await db.studentWallet.findFirst({ where: { id: input.walletId, schoolId } });
  if (!wallet) throw Object.assign(new Error("Wallet not found."), { status: 404 });
  if (!wallet.pinHash) throw Object.assign(new Error("No PIN is currently set on this wallet."), { status: 400 });

  const pinResult = await checkPin(wallet, input.oldPin);
  if (!pinResult.ok) {
    if (pinResult.reason === "locked") throw Object.assign(new Error("Wallet PIN is locked."), { status: 403 });
    throw Object.assign(new Error("Old PIN is incorrect."), { status: 401 });
  }

  const newHash = await hashWalletPin(input.newPin);
  await db.studentWallet.update({
    where: { id: wallet.id },
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
  requireRole(ctx, []);
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
  await db.studentWallet.update({
    where: { id: wallet.id },
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
  requireRole(ctx, ["CANTEEN", "CASHIER"]);
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
  requireRole(ctx, ["SECURITY", "GATE_SECURITY"]);

  const target = await resolveNfcScanTarget(db, schoolId, input.tokenOrUid);
  const result = target && !target.blocked ? GateScanResult.ALLOWED : GateScanResult.BLOCKED;
  const reason = target ? target.reason : "unknown token";

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
  };
}

const TOP_UP_ALLOWED_ROLES = ["CANTEEN", "CASHIER"] as const;

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

export async function resolveWalletStudent(
  ctx: NfcOperationsContext,
  input: { studentId?: string; admissionNumber?: string; tokenOrUid?: string },
  db: NfcOperationsClient = defaultPrisma,
) {
  const schoolId = requireSchoolId(ctx);
  requireRole(ctx, [...TOP_UP_ALLOWED_ROLES]);
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
  paymentMethod: "CASH" | "MOBILE_MONEY" | "BANK" | "MANUAL_ADJUSTMENT";
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
  requireRole(ctx, [...TOP_UP_ALLOWED_ROLES]);
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

    const walletSnap = await tx.studentWallet.upsert({
      where: { studentId },
      create: { schoolId, studentId, balanceCents: 0 },
      update: {},
    });
    const balanceBefore = walletSnap.balanceCents;
    const walletId = walletSnap.id;

    const updatedWallet = await tx.studentWallet.update({
      where: { id: walletId },
      data: { balanceCents: balanceBefore + amountCents },
    });

    const transaction = await tx.studentWalletTransaction.create({
      data: {
        schoolId,
        studentId,
        walletId,
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
      walletBefore: { id: walletId, balanceCents: balanceBefore },
      wallet: { id: updatedWallet.id, balanceCents: updatedWallet.balanceCents, status: updatedWallet.status },
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
  requireRole(ctx, [...WALLET_MGMT_ROLES]);

  const where: Prisma.StudentWalletTransactionWhereInput = { schoolId };

  if (filters.dateFrom || filters.dateTo) {
    where.createdAt = {
      ...(filters.dateFrom ? { gte: new Date(filters.dateFrom) } : {}),
      ...(filters.dateTo ? { lt: new Date(new Date(filters.dateTo).getTime() + 86400000) } : {}),
    };
  }
  if (filters.studentId) where.studentId = filters.studentId;
  if (filters.cashierUserId) where.cashierUserId = filters.cashierUserId;
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
  requireRole(ctx, [...WALLET_MGMT_ROLES]);
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

    const updatedWallet = await tx.studentWallet.update({
      where: { id: wallet.id },
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
      wallet: { id: updatedWallet.id, balanceCents: updatedWallet.balanceCents, status: updatedWallet.status },
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

    const updatedWallet = await tx.studentWallet.update({
      where: { id: walletSnap.id },
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
      wallet: { id: updatedWallet.id, balanceCents: updatedWallet.balanceCents, status: updatedWallet.status },
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
  requireRole(ctx, [...WALLET_MGMT_ROLES]);

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
  requireRole(ctx, ["SECURITY", "GATE_SECURITY"]);
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
