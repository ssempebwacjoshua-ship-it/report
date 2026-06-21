import type { PrismaClient } from "@prisma/client";
import { CredentialStatus, CredentialType, Prisma } from "@prisma/client";
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
  status: CredentialStatus;
  issuedAt: Date;
  deactivatedAt: Date | null;
  deactivatedReason: string | null;
  student: StudentSummary;
};

export function normalizeCredentialUID(value: string): string {
  return value.trim().toUpperCase();
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

export async function issueStudentCredential(
  ctx: StudentCredentialContext,
  input: { studentId: string; credentialUID: string; type?: CredentialType },
  db: StudentCredentialClient = defaultPrisma,
) {
  const schoolId = requireSchoolId(ctx);
  const credentialUID = normalizeCredentialUID(input.credentialUID);
  const type = input.type ?? CredentialType.NFC_WRISTBAND;
  if (!credentialUID) throw Object.assign(new Error("Credential UID is required."), { status: 400 });

  const student = await db.student.findFirst({
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

  const existing = await db.studentCredential.findUnique({
    where: { schoolId_type_credentialUID: { schoolId, type, credentialUID } },
    include: credentialInclude,
  });

  if (existing?.status === CredentialStatus.ACTIVE) {
    throw Object.assign(new Error("This NFC wristband is already active for a student in this school."), { status: 409 });
  }

  try {
    const credential = existing
      ? await db.studentCredential.update({
          where: { id: existing.id },
          data: {
            studentId: student.id,
            status: CredentialStatus.ACTIVE,
            issuedAt: new Date(),
            deactivatedAt: null,
            deactivatedReason: null,
            issuedById: ctx.actorId ?? null,
          },
          include: credentialInclude,
        })
      : await db.studentCredential.create({
          data: {
            schoolId,
            studentId: student.id,
            type,
            credentialUID,
            issuedById: ctx.actorId ?? null,
          },
          include: credentialInclude,
        });

    await auditCredentialAction(db, ctx, "student_credential.issued", {
      credentialId: credential.id,
      studentId: student.id,
      type,
      credentialUID,
      reissued: Boolean(existing),
    });

    return { credential: serializeCredential(credential as CredentialWithStudent) };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw Object.assign(new Error("This NFC wristband is already registered in this school."), { status: 409 });
    }
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
      issuedAt: credential.issuedAt.toISOString(),
    },
  };
}
