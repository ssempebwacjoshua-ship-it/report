import {
  AttendanceDirection,
  AttendanceScanSource,
  AttendanceScanStatus,
  CredentialStatus,
  CredentialType,
  GateScanResult,
  StudentWalletStatus,
  WalletTransactionType,
  type PrismaClient,
} from "@prisma/client";
import { prisma as defaultPrisma } from "../db/prisma";
import type { SchoolUserRole } from "./authService";
import { normalizeCredentialUID } from "./studentCredentialService";

type NfcOperationsClient = Pick<
  PrismaClient,
  "student" | "studentCredential" | "studentWallet" | "studentWalletTransaction" | "studentAttendanceEvent" | "nfcGateScan"
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
  const match = clean.match(/\/nfc\/t\/([^/?#]+)/i);
  return {
    token: match ? decodeURIComponent(match[1] ?? "") : clean,
    uid: normalizeCredentialUID(clean),
  };
}

async function runWrite<T>(db: NfcOperationsClient, fn: (tx: NfcOperationsClient) => Promise<T>) {
  return db.$transaction ? db.$transaction(fn) : fn(db);
}

async function findCredential(db: NfcOperationsClient, schoolId: string, tokenOrUid: string): Promise<CredentialForNfc | null> {
  const { token, uid } = extractTokenOrUid(tokenOrUid);
  const credential = await db.studentCredential.findFirst({
    where: {
      schoolId,
      type: CredentialType.NFC_WRISTBAND,
      OR: [{ scanToken: token }, { credentialUID: uid }],
    },
    include: credentialInclude,
  });
  return credential as CredentialForNfc | null;
}

function blockedReason(credential: CredentialForNfc | null) {
  if (!credential) return "unknown token";
  if (credential.status !== CredentialStatus.ACTIVE) return "lost or deactivated wristband";
  if (!credential.student.isActive) return "inactive student";
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
            ? `/student-credentials?credentialId=${encodeURIComponent(typed.id)}`
            : `/nfc/t/${encodeURIComponent(cleanToken)}`;

  return {
    found: true,
    mode,
    targetPath,
    valid: !reason,
    actionBlocked: Boolean(reason),
    credentialStatus: typed.status,
    studentStatus: typed.student.isActive ? "ACTIVE" as const : "INACTIVE" as const,
    student: { ...studentSummary(typed.student), schoolName: typed.school.name },
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
  input: { tokenOrUid: string; direction?: AttendanceDirection },
  db: NfcOperationsClient = defaultPrisma,
) {
  const schoolId = requireSchoolId(ctx);
  requireRole(ctx, ["TEACHER"]);
  const credential = await findCredential(db, schoolId, input.tokenOrUid);
  const reason = blockedReason(credential);
  if (!credential) throw Object.assign(new Error("NFC credential not found."), { status: 404 });
  const direction = input.direction ?? AttendanceDirection.TAP_IN;
  const { start, end } = todayRange();
  const duplicate = reason
    ? null
    : await db.studentAttendanceEvent.findFirst({
        where: { schoolId, studentId: credential.studentId, direction, status: AttendanceScanStatus.VALID, scannedAt: { gte: start, lt: end } },
      });
  await db.studentAttendanceEvent.create({
    data: {
      schoolId,
      studentId: credential.studentId,
      credentialId: credential.id,
      direction,
      source: AttendanceScanSource.NFC_WRISTBAND,
      status: reason ? AttendanceScanStatus.BLOCKED : duplicate ? AttendanceScanStatus.DUPLICATE : AttendanceScanStatus.VALID,
      reason: reason ?? (duplicate ? "duplicate tap" : null),
    },
  });
  return getAttendanceDashboard(ctx, {}, db);
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
  input: { tokenOrUid: string; amountCents: number; description?: string; idempotencyKey?: string },
  db: NfcOperationsClient = defaultPrisma,
) {
  const schoolId = requireSchoolId(ctx);
  requireRole(ctx, ["CANTEEN", "CASHIER"]);
  if (!Number.isInteger(input.amountCents) || input.amountCents <= 0) throw Object.assign(new Error("Charge amount must be greater than zero."), { status: 400 });

  return runWrite(db, async (tx) => {
    const credential = await findCredential(tx, schoolId, input.tokenOrUid);
    const reason = blockedReason(credential);
    if (reason || !credential) return { ok: false, reason: reason ?? "unknown token" };
    const wallet = await tx.studentWallet.upsert({
      where: { studentId: credential.studentId },
      create: { schoolId, studentId: credential.studentId, balanceCents: 0 },
      update: {},
    });
    if (wallet.status === StudentWalletStatus.FROZEN) return { ok: false, reason: "wallet frozen", student: studentSummary(credential.student), wallet };
    if (wallet.balanceCents < input.amountCents) return { ok: false, reason: "insufficient balance", student: studentSummary(credential.student), wallet };
    const existing = input.idempotencyKey
      ? await tx.studentWalletTransaction.findUnique({ where: { schoolId_idempotencyKey: { schoolId, idempotencyKey: input.idempotencyKey } } })
      : null;
    if (existing) return { ok: false, reason: "duplicate charge attempt", student: studentSummary(credential.student), wallet };
    const updatedWallet = await tx.studentWallet.update({
      where: { id: wallet.id },
      data: { balanceCents: wallet.balanceCents - input.amountCents },
    });
    const transaction = await tx.studentWalletTransaction.create({
      data: {
        schoolId,
        studentId: credential.studentId,
        walletId: wallet.id,
        credentialId: credential.id,
        cashierUserId: ctx.actorId ?? null,
        type: WalletTransactionType.CHARGE,
        amountCents: -input.amountCents,
        description: input.description?.trim() || null,
        idempotencyKey: input.idempotencyKey ?? null,
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
      student: studentSummary(credential.student),
      wallet: { id: updatedWallet.id, balanceCents: updatedWallet.balanceCents, status: updatedWallet.status },
    };
  });
}

export async function scanGate(ctx: NfcOperationsContext, input: { tokenOrUid: string }, db: NfcOperationsClient = defaultPrisma) {
  const schoolId = requireSchoolId(ctx);
  requireRole(ctx, ["SECURITY", "GATE_SECURITY"]);
  const credential = await findCredential(db, schoolId, input.tokenOrUid);
  const reason = blockedReason(credential);
  const result = reason ? GateScanResult.BLOCKED : GateScanResult.ALLOWED;
  const scan = await db.nfcGateScan.create({
    data: {
      schoolId,
      studentId: credential?.studentId ?? null,
      credentialId: credential?.id ?? null,
      scannedByUserId: ctx.actorId ?? null,
      result,
      reason,
    },
  });
  const lastAttendance = credential
    ? await db.studentAttendanceEvent.findFirst({ where: { schoolId, studentId: credential.studentId }, orderBy: { scannedAt: "desc" } })
    : null;
  return {
    result,
    reason,
    scannedAt: scan.scannedAt.toISOString(),
    student: credential ? studentSummary(credential.student) : undefined,
    credentialStatus: credential?.status ?? "UNKNOWN",
    todayAttendanceStatus: lastAttendance?.direction ?? "NONE",
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
