import type { PrismaClient } from "@prisma/client";
import { CredentialStatus, CredentialType, Prisma } from "@prisma/client";
import { randomBytes } from "node:crypto";
import { prisma as defaultPrisma } from "../db/prisma";

export type StudentCredentialContext = {
  schoolId?: string | null;
  actorId?: string | null;
  actorEmail?: string | null;
  actorName?: string | null;
};

export type CredentialScanContext = "GATE" | "CLASS" | "WALLET" | "VERIFY";
export type CredentialScanStatus = "ACTIVE" | "NOT_FOUND" | "DEACTIVATED" | "STUDENT_INACTIVE";

type StudentCredentialClient = Pick<PrismaClient, "student" | "studentCredential" | "auditLog">;
type StudentCredentialDb = StudentCredentialClient & {
  $transaction?: <T>(fn: (tx: StudentCredentialClient) => Promise<T>) => Promise<T>;
};

// Extended client type used only by amendStudentCredential (requires usage-history counts)
type CredentialAmendClient = Pick<PrismaClient,
  | "student"
  | "studentCredential"
  | "auditLog"
  | "studentAttendanceEvent"
  | "studentWalletTransaction"
  | "nfcGateScan"
>;

const ACTIVE_STUDENT_CREDENTIAL_MESSAGE = "Student already has an active NFC wristband. Deactivate or mark it lost before issuing another.";

type EnrollmentSummary = {
  class?: { name: string } | null;
  stream?: { name: string } | null;
};

type StudentSummary = {
  id: string;
  admissionNumber: string;
  firstName: string;
  lastName: string;
  isActive: boolean;
  enrollments?: EnrollmentSummary[];
};

type CredentialWithStudent = {
  id: string;
  schoolId: string;
  studentId: string;
  type: CredentialType;
  credentialUID: string;
  scanToken: string | null;
  status: CredentialStatus;
  issuedAt: Date;
  deactivatedAt: Date | null;
  deactivatedReason: string | null;
  student: StudentSummary;
};

export function normalizeCredentialUID(value: string): string {
  return value.trim().toUpperCase();
}

export function generateCredentialScanToken(): string {
  return randomBytes(24).toString("base64url");
}

function requireSchoolId(ctx: StudentCredentialContext): string {
  if (!ctx.schoolId) throw Object.assign(new Error("School context required."), { status: 401 });
  return ctx.schoolId;
}

function getStudentName(student: Pick<StudentSummary, "firstName" | "lastName">): string {
  return `${student.firstName} ${student.lastName}`.trim();
}

function getEnrollmentSummary(student: StudentSummary) {
  const enrollment = student.enrollments?.[0];
  return {
    className: enrollment?.class?.name ?? null,
    streamName: enrollment?.stream?.name ?? null,
  };
}

function safeStudentDetails(student: StudentSummary) {
  const enrollment = getEnrollmentSummary(student);
  return {
    id: student.id,
    name: getStudentName(student),
    admissionNumber: student.admissionNumber,
    className: enrollment.className,
    streamName: enrollment.streamName,
    photoUrl: null,
  };
}

function serializeCredential(row: CredentialWithStudent) {
  const enrollment = getEnrollmentSummary(row.student);
  return {
    id: row.id,
    type: row.type,
    credentialUID: row.credentialUID,
    scanToken: row.scanToken,
    nfcUrl: row.scanToken ? `/nfc/t/${row.scanToken}` : null,
    status: row.status,
    issuedAt: row.issuedAt.toISOString(),
    deactivatedAt: row.deactivatedAt?.toISOString() ?? null,
    deactivatedReason: row.deactivatedReason,
    student: {
      id: row.student.id,
      name: getStudentName(row.student),
      admissionNumber: row.student.admissionNumber,
      className: enrollment.className,
      streamName: enrollment.streamName,
      isActive: row.student.isActive,
    },
  };
}

const studentInclude = {
  enrollments: {
    where: { isActive: true, status: "ACTIVE" as const },
    include: { class: { select: { name: true } }, stream: { select: { name: true } } },
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

async function auditCredentialAction(
  db: StudentCredentialClient,
  ctx: StudentCredentialContext,
  action: string,
  details: Record<string, unknown>,
) {
  if (!ctx.schoolId) return;
  await db.auditLog.create({
    data: {
      schoolId: ctx.schoolId,
      action,
      details: {
        ...details,
        actor: {
          id: ctx.actorId ?? null,
          email: ctx.actorEmail ?? null,
          name: ctx.actorName ?? null,
        },
      },
    },
  });
}

function isPrismaUniqueViolation(error: unknown): error is { code: "P2002"; meta?: { target?: unknown } } {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002"
  ) || (
    typeof error === "object"
    && error !== null
    && (error as { code?: unknown }).code === "P2002"
  );
}

function isActiveStudentCredentialConstraint(error: { meta?: { target?: unknown } }) {
  const target = error.meta?.target;
  if (typeof target === "string") return target.includes("StudentCredential_one_active_per_student_type_idx");
  if (Array.isArray(target)) {
    const fields = target.map(String);
    return ["schoolId", "studentId", "type"].every((field) => fields.includes(field));
  }
  return false;
}

function mapUniqueCredentialError(error: unknown): Error | null {
  if (!isPrismaUniqueViolation(error)) return null;
  const message = isActiveStudentCredentialConstraint(error)
    ? ACTIVE_STUDENT_CREDENTIAL_MESSAGE
    : "This NFC wristband is already registered in this school.";
  return Object.assign(new Error(message), { status: 409 });
}

async function runCredentialWrite<T>(db: StudentCredentialDb, fn: (tx: StudentCredentialClient) => Promise<T>): Promise<T> {
  return db.$transaction ? db.$transaction(fn) : fn(db);
}

export async function issueStudentCredential(
  ctx: StudentCredentialContext,
  input: { studentId: string; credentialUID: string; type?: CredentialType },
  db: StudentCredentialDb = defaultPrisma,
) {
  const schoolId = requireSchoolId(ctx);
  const credentialUID = normalizeCredentialUID(input.credentialUID);
  const type = input.type ?? CredentialType.NFC_WRISTBAND;
  if (!credentialUID) throw Object.assign(new Error("Credential UID is required."), { status: 400 });

  try {
    return await runCredentialWrite(db, async (tx) => {
      const student = await tx.student.findFirst({
        where: { id: input.studentId, schoolId },
        select: {
          id: true,
          admissionNumber: true,
          firstName: true,
          lastName: true,
          isActive: true,
          enrollments: studentInclude.enrollments,
        },
      });
      if (!student) throw Object.assign(new Error("Student not found for this school."), { status: 404 });
      if (!student.isActive) throw Object.assign(new Error("Cannot issue a credential to an inactive student."), { status: 400 });

      const existing = await tx.studentCredential.findUnique({
        where: { schoolId_type_credentialUID: { schoolId, type, credentialUID } },
        include: credentialInclude,
      });

      if (existing?.status === CredentialStatus.ACTIVE) {
        throw Object.assign(new Error("This NFC wristband is already active for a student in this school."), { status: 409 });
      }

      const activeForStudent = await tx.studentCredential.findFirst({
        where: {
          schoolId,
          studentId: student.id,
          type,
          status: CredentialStatus.ACTIVE,
        },
      });

      if (activeForStudent && activeForStudent.id !== existing?.id) {
        throw Object.assign(new Error(ACTIVE_STUDENT_CREDENTIAL_MESSAGE), { status: 409 });
      }

      const credential = existing
        ? await tx.studentCredential.update({
            where: { id: existing.id },
            data: {
              studentId: student.id,
              status: CredentialStatus.ACTIVE,
              issuedAt: new Date(),
              deactivatedAt: null,
              deactivatedReason: null,
              scanToken: existing.scanToken ?? generateCredentialScanToken(),
              issuedById: ctx.actorId ?? null,
            },
            include: credentialInclude,
          })
        : await tx.studentCredential.create({
            data: {
              schoolId,
              studentId: student.id,
              type,
              credentialUID,
              scanToken: generateCredentialScanToken(),
              issuedById: ctx.actorId ?? null,
            },
            include: credentialInclude,
          });

      await auditCredentialAction(tx, ctx, "student_credential.issued", {
        credentialId: credential.id,
        studentId: student.id,
        type,
        credentialUID,
        reissued: Boolean(existing),
      });

      return { credential: serializeCredential(credential as CredentialWithStudent) };
    });
  } catch (error) {
    const mapped = mapUniqueCredentialError(error);
    if (mapped) throw mapped;
    throw error;
  }
}

export async function listStudentCredentials(
  ctx: StudentCredentialContext,
  filters: { search?: string; studentId?: string; status?: CredentialStatus; type?: CredentialType } = {},
  db: StudentCredentialClient = defaultPrisma,
) {
  const schoolId = requireSchoolId(ctx);
  const search = filters.search?.trim();
  const credentials = await db.studentCredential.findMany({
    where: {
      schoolId,
      type: filters.type ?? CredentialType.NFC_WRISTBAND,
      studentId: filters.studentId || undefined,
      status: filters.status,
      ...(search
        ? {
            OR: [
              { credentialUID: { contains: search, mode: "insensitive" as const } },
              { student: { firstName: { contains: search, mode: "insensitive" as const } } },
              { student: { lastName: { contains: search, mode: "insensitive" as const } } },
              { student: { admissionNumber: { contains: search, mode: "insensitive" as const } } },
            ],
          }
        : {}),
    },
    include: credentialInclude,
    orderBy: [{ status: "asc" }, { issuedAt: "desc" }],
  });
  return { credentials: (credentials as CredentialWithStudent[]).map(serializeCredential) };
}

export async function deactivateStudentCredential(
  ctx: StudentCredentialContext,
  credentialId: string,
  reason: string,
  db: StudentCredentialClient = defaultPrisma,
) {
  const schoolId = requireSchoolId(ctx);
  const cleanReason = reason.trim();
  if (!cleanReason) throw Object.assign(new Error("Deactivation reason is required."), { status: 400 });

  const existing = await db.studentCredential.findFirst({
    where: { id: credentialId, schoolId },
    include: credentialInclude,
  });
  if (!existing) throw Object.assign(new Error("Credential not found for this school."), { status: 404 });

  const credential = await db.studentCredential.update({
    where: { id: credentialId },
    data: {
      status: CredentialStatus.DEACTIVATED,
      deactivatedAt: new Date(),
      deactivatedReason: cleanReason,
    },
    include: credentialInclude,
  });

  await auditCredentialAction(db, ctx, "student_credential.deactivated", {
    credentialId,
    studentId: existing.studentId,
    type: existing.type,
    credentialUID: existing.credentialUID,
    reason: cleanReason,
  });

  return { credential: serializeCredential(credential as CredentialWithStudent) };
}

export async function amendStudentCredential(
  ctx: StudentCredentialContext,
  credentialId: string,
  input: { studentId?: string; credentialUID?: string; reason: string },
  db: CredentialAmendClient = defaultPrisma,
) {
  const schoolId = requireSchoolId(ctx);
  const cleanReason = input.reason.trim();
  if (!cleanReason) throw Object.assign(new Error("Amendment reason is required."), { status: 400 });

  if (input.studentId === undefined && input.credentialUID === undefined) {
    throw Object.assign(new Error("Provide studentId or credentialUID to amend."), { status: 400 });
  }

  // Validate UID before normalizing
  if (input.credentialUID !== undefined) {
    const trimmed = input.credentialUID.trim();
    if (!trimmed) throw Object.assign(new Error("Wristband UID cannot be empty."), { status: 400 });
    const lower = trimmed.toLowerCase();
    if (lower.startsWith("http://") || lower.startsWith("https://")) {
      throw Object.assign(new Error("Wristband UID must not be a URL."), { status: 400 });
    }
  }
  const newUID = input.credentialUID !== undefined ? normalizeCredentialUID(input.credentialUID) : undefined;

  const credential = await db.studentCredential.findFirst({
    where: { id: credentialId, schoolId },
    include: credentialInclude,
  });
  if (!credential) throw Object.assign(new Error("Credential not found for this school."), { status: 404 });

  const oldStudentId = credential.studentId;
  const oldCredentialUID = credential.credentialUID;
  const changingStudent = input.studentId !== undefined && input.studentId !== oldStudentId;

  if (changingStudent) {
    // Block if this wristband already has any usage history
    const [attendanceCount, walletCount, gateCount] = await Promise.all([
      db.studentAttendanceEvent.count({ where: { credentialId } }),
      db.studentWalletTransaction.count({ where: { credentialId } }),
      db.nfcGateScan.count({ where: { credentialId } }),
    ]);
    if (attendanceCount > 0 || walletCount > 0 || gateCount > 0) {
      throw Object.assign(
        new Error("This wristband already has activity. Deactivate it and issue a new wristband instead."),
        { status: 409 },
      );
    }

    const newStudent = await db.student.findFirst({
      where: { id: input.studentId, schoolId },
      select: { id: true, isActive: true },
    });
    if (!newStudent) throw Object.assign(new Error("Student not found for this school."), { status: 404 });
    if (!newStudent.isActive) throw Object.assign(new Error("Cannot assign to an inactive student."), { status: 400 });

    // Prevent target student from having another active wristband
    const targetHasActive = await db.studentCredential.findFirst({
      where: {
        schoolId,
        studentId: input.studentId,
        type: credential.type as CredentialType,
        status: CredentialStatus.ACTIVE,
        NOT: { id: credentialId },
      },
    });
    if (targetHasActive) {
      throw Object.assign(new Error(ACTIVE_STUDENT_CREDENTIAL_MESSAGE), { status: 409 });
    }
  }

  if (newUID !== undefined && newUID !== oldCredentialUID) {
    // Block if another active wristband in this school already uses that UID
    const duplicate = await db.studentCredential.findFirst({
      where: {
        schoolId,
        type: credential.type as CredentialType,
        credentialUID: newUID,
        status: CredentialStatus.ACTIVE,
        NOT: { id: credentialId },
      },
    });
    if (duplicate) {
      throw Object.assign(
        new Error("This NFC wristband is already active for a student in this school."),
        { status: 409 },
      );
    }
  }

  const updated = await db.studentCredential.update({
    where: { id: credentialId },
    data: {
      ...(changingStudent ? { studentId: input.studentId } : {}),
      ...(newUID !== undefined ? { credentialUID: newUID } : {}),
    },
    include: credentialInclude,
  });

  await auditCredentialAction(db, ctx, "student_credential.amended", {
    credentialId,
    oldStudentId,
    newStudentId: changingStudent ? input.studentId : oldStudentId,
    oldCredentialUID,
    newCredentialUID: newUID ?? oldCredentialUID,
    reason: cleanReason,
  });

  return { credential: serializeCredential(updated as CredentialWithStudent) };
}

export async function scanStudentCredential(
  ctx: StudentCredentialContext,
  input: { credentialUID: string; context?: CredentialScanContext; type?: CredentialType },
  db: StudentCredentialClient = defaultPrisma,
) {
  const schoolId = requireSchoolId(ctx);
  const credentialUID = normalizeCredentialUID(input.credentialUID);
  const type = input.type ?? CredentialType.NFC_WRISTBAND;
  if (!credentialUID) throw Object.assign(new Error("Credential UID is required."), { status: 400 });

  const credential = await db.studentCredential.findUnique({
    where: { schoolId_type_credentialUID: { schoolId, type, credentialUID } },
    include: credentialInclude,
  });

  if (!credential) return { status: "NOT_FOUND" as const };
  if (credential.status === CredentialStatus.DEACTIVATED) {
    return {
      status: "DEACTIVATED" as const,
      credential: {
        id: credential.id,
        credentialUID: credential.credentialUID,
        scanToken: credential.scanToken,
        nfcUrl: credential.scanToken ? `/nfc/t/${credential.scanToken}` : null,
        issuedAt: credential.issuedAt.toISOString(),
      },
    };
  }
  if (!credential.student.isActive) {
    return {
      status: "STUDENT_INACTIVE" as const,
      student: safeStudentDetails(credential.student),
      credential: {
        id: credential.id,
        credentialUID: credential.credentialUID,
        scanToken: credential.scanToken,
        nfcUrl: credential.scanToken ? `/nfc/t/${credential.scanToken}` : null,
        issuedAt: credential.issuedAt.toISOString(),
      },
    };
  }
  return {
    status: "ACTIVE" as const,
    student: safeStudentDetails(credential.student),
    credential: {
      id: credential.id,
      credentialUID: credential.credentialUID,
      scanToken: credential.scanToken,
      nfcUrl: credential.scanToken ? `/nfc/t/${credential.scanToken}` : null,
      issuedAt: credential.issuedAt.toISOString(),
    },
  };
}
