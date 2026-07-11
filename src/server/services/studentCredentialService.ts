import prismaPkg, { Prisma, type PrismaClient } from "@prisma/client";
import { randomBytes } from "node:crypto";
import { prisma as defaultPrisma } from "../db/prisma";
import { normalizeCredentialUID } from "../../shared/utils/credentialNormalization";

const { CredentialStatus, CredentialType } = prismaPkg;

export type StudentCredentialContext = {
  schoolId?: string | null;
  actorId?: string | null;
  actorEmail?: string | null;
  actorName?: string | null;
  role?: string | null;
};

export type CredentialScanContext = "GATE" | "CLASS" | "WALLET" | "VERIFY";
export type CredentialScanStatus = "ACTIVE" | "NOT_FOUND" | "DEACTIVATED" | "STUDENT_INACTIVE";

type StudentCredentialClient = Pick<PrismaClient, "student" | "studentCredential" | "auditLog">;
type StudentCredentialDb = StudentCredentialClient & {
  $transaction?: <T>(
    fn: (tx: StudentCredentialClient) => Promise<T>,
    options?: { maxWait?: number; timeout?: number },
  ) => Promise<T>;
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

// Allocation query only needs student (credentials + enrollments are accessed via relations)
type AllocationDb = Pick<PrismaClient, "student">;

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

export { normalizeCredentialUID };

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

async function runCredentialWrite<T>(
  db: StudentCredentialDb,
  fn: (tx: StudentCredentialClient) => Promise<T>,
  options?: { maxWait?: number; timeout?: number },
): Promise<T> {
  return db.$transaction ? db.$transaction(fn, options) : fn(db);
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

const REACTIVATE_ALLOWED_ROLES = ["ADMIN_OPERATOR"];

export async function reactivateStudentCredential(
  ctx: StudentCredentialContext,
  credentialId: string,
  reason: string,
  db: StudentCredentialClient = defaultPrisma,
) {
  const schoolId = requireSchoolId(ctx);
  if (!ctx.actorId) throw Object.assign(new Error("Authentication required."), { status: 401 });
  if (!ctx.role || !REACTIVATE_ALLOWED_ROLES.includes(ctx.role)) {
    throw Object.assign(new Error("Only administrators can re-enable NFC credentials."), { status: 403 });
  }
  const cleanReason = reason.trim();
  if (!cleanReason) throw Object.assign(new Error("Re-activation reason is required."), { status: 400 });

  const existing = await db.studentCredential.findFirst({
    where: { id: credentialId, schoolId },
    include: credentialInclude,
  });
  if (!existing) throw Object.assign(new Error("Credential not found for this school."), { status: 404 });

  if (existing.status === CredentialStatus.ACTIVE) {
    throw Object.assign(new Error("This credential is already active."), { status: 400 });
  }

  // Guard: no other active credential for the same student + type
  const conflicting = await db.studentCredential.findFirst({
    where: { schoolId, studentId: existing.studentId, type: existing.type, status: CredentialStatus.ACTIVE, id: { not: credentialId } },
  });
  if (conflicting) {
    throw Object.assign(new Error("Student already has an active NFC credential. Deactivate it first."), { status: 409 });
  }

  const reactivated = await db.studentCredential.update({
    where: { id: credentialId },
    data: {
      status: CredentialStatus.ACTIVE,
      deactivatedAt: null,
      deactivatedReason: null,
    },
    include: credentialInclude,
  });

  await auditCredentialAction(db, ctx, "student_credential.reactivated", {
    credentialId,
    studentId: existing.studentId,
    type: existing.type,
    credentialUID: existing.credentialUID,
    reason: cleanReason,
  });

  return { credential: serializeCredential(reactivated as CredentialWithStudent) };
}

const allocationEnrollmentInclude = {
  where: { isActive: true, status: "ACTIVE" as const },
  include: {
    class: { select: { id: true, name: true } },
    stream: { select: { id: true, name: true } },
  },
  orderBy: { createdAt: "desc" as const },
  take: 1,
} as const;

export async function getCredentialAllocation(
  ctx: StudentCredentialContext,
  filters: {
    classId?: string;
    streamId?: string;
    status?: "ALL" | "ALLOCATED" | "UNALLOCATED" | "DEACTIVATED";
    search?: string;
  } = {},
  db: AllocationDb = defaultPrisma,
) {
  const schoolId = requireSchoolId(ctx);
  const search = filters.search?.trim();

  const students = await db.student.findMany({
    where: {
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
                ...(filters.classId ? { classId: filters.classId } : {}),
                ...(filters.streamId ? { streamId: filters.streamId } : {}),
              },
            },
          }
        : {}),
    },
    include: {
      credentials: { where: { type: CredentialType.NFC_WRISTBAND } },
      enrollments: allocationEnrollmentInclude,
    },
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
  });

  type RawStudent = (typeof students)[number];
  type RawCred = RawStudent["credentials"][number];

  function serializeAllocationCredential(cred: RawCred, stu: RawStudent) {
    const enrollment = stu.enrollments[0];
    return {
      id: cred.id,
      type: cred.type as string,
      credentialUID: cred.credentialUID,
      scanToken: cred.scanToken,
      nfcUrl: cred.scanToken ? `/nfc/t/${cred.scanToken}` : null,
      status: cred.status as string,
      issuedAt: cred.issuedAt.toISOString(),
      deactivatedAt: cred.deactivatedAt?.toISOString() ?? null,
      deactivatedReason: cred.deactivatedReason,
      student: {
        id: stu.id,
        name: getStudentName(stu),
        admissionNumber: stu.admissionNumber,
        className: enrollment?.class?.name ?? null,
        streamName: enrollment?.stream?.name ?? null,
        isActive: stu.isActive,
      },
    };
  }

  const rows = students.map((stu) => {
    const activeCred = stu.credentials.find((c) => c.status === CredentialStatus.ACTIVE) ?? null;
    const deactivatedCount = stu.credentials.filter((c) => c.status === CredentialStatus.DEACTIVATED).length;

    const allocationStatus: "ALLOCATED" | "UNALLOCATED" | "DEACTIVATED" = activeCred
      ? "ALLOCATED"
      : deactivatedCount > 0
      ? "DEACTIVATED"
      : "UNALLOCATED";

    const enrollment = stu.enrollments[0];
    return {
      student: {
        id: stu.id,
        name: getStudentName(stu),
        admissionNumber: stu.admissionNumber,
        classId: enrollment?.class?.id ?? null,
        className: enrollment?.class?.name ?? null,
        streamId: enrollment?.stream?.id ?? null,
        streamName: enrollment?.stream?.name ?? null,
        isActive: stu.isActive,
      },
      activeCredential: activeCred ? serializeAllocationCredential(activeCred, stu) : null,
      deactivatedCredentialsCount: deactivatedCount,
      allocationStatus,
    };
  });

  const summary = {
    totalStudents: rows.length,
    allocated: rows.filter((r) => r.allocationStatus === "ALLOCATED").length,
    unallocated: rows.filter((r) => r.allocationStatus === "UNALLOCATED").length,
    deactivated: rows.filter((r) => r.allocationStatus === "DEACTIVATED").length,
  };

  const filteredRows =
    filters.status && filters.status !== "ALL"
      ? rows.filter((r) => r.allocationStatus === filters.status)
      : rows;

  return { summary, rows: filteredRows };
}

export async function bulkAllocateCredentials(
  ctx: StudentCredentialContext,
  input: { reason: string; assignments: Array<{ studentId: string; credentialUID: string }> },
  db: StudentCredentialDb = defaultPrisma,
) {
  const schoolId = requireSchoolId(ctx);
  const cleanReason = input.reason.trim();
  if (!cleanReason) throw Object.assign(new Error("Reason is required."), { status: 400 });
  if (!input.assignments?.length) throw Object.assign(new Error("At least one assignment is required."), { status: 400 });

  // Validate and normalize UIDs up front (before any DB access)
  const normalized = input.assignments.map((a, i) => {
    const trimmed = a.credentialUID?.trim() ?? "";
    if (!trimmed) throw Object.assign(new Error(`Row ${i + 1}: Wristband UID is required.`), { status: 400 });
    const lower = trimmed.toLowerCase();
    if (lower.startsWith("http://") || lower.startsWith("https://")) {
      throw Object.assign(new Error(`Row ${i + 1}: Wristband UID must not be a URL.`), { status: 400 });
    }
    return { studentId: a.studentId, credentialUID: normalizeCredentialUID(trimmed) };
  });

  // Detect intra-request duplicate UIDs
  const seenUIDs = new Set<string>();
  for (const a of normalized) {
    if (seenUIDs.has(a.credentialUID)) {
      throw Object.assign(new Error(`Duplicate wristband UID in request: ${a.credentialUID}`), { status: 400 });
    }
    seenUIDs.add(a.credentialUID);
  }

  // Detect intra-request duplicate student IDs
  const seenStudents = new Set<string>();
  for (const a of normalized) {
    if (seenStudents.has(a.studentId)) {
      throw Object.assign(new Error(`Duplicate studentId in request: ${a.studentId}`), { status: 400 });
    }
    seenStudents.add(a.studentId);
  }

  // ── Step 2: Bulk-preload all required data outside the transaction ────────
  const studentIds = normalized.map((a) => a.studentId);
  const uids = normalized.map((a) => a.credentialUID);

  const [studentList, credentialsByUID, activeCredsByStudent] = await Promise.all([
    db.student.findMany({
      where: { schoolId, id: { in: studentIds } },
      select: {
        id: true,
        admissionNumber: true,
        firstName: true,
        lastName: true,
        isActive: true,
        enrollments: studentInclude.enrollments,
      },
    }),
    db.studentCredential.findMany({
      where: { schoolId, type: CredentialType.NFC_WRISTBAND, credentialUID: { in: uids } },
      include: credentialInclude,
    }),
    db.studentCredential.findMany({
      where: {
        schoolId,
        studentId: { in: studentIds },
        type: CredentialType.NFC_WRISTBAND,
        status: CredentialStatus.ACTIVE,
      },
    }),
  ]);

  // ── Step 3: Prevalidate — fail fast before opening any transaction ────────
  const studentMap = new Map(studentList.map((s) => [s.id, s]));
  const credByUID = new Map(
    (credentialsByUID as CredentialWithStudent[]).map((c) => [c.credentialUID, c]),
  );
  const activeByStudentId = new Map(
    (activeCredsByStudent as { studentId: string }[]).map((c) => [c.studentId, c]),
  );

  for (let i = 0; i < normalized.length; i++) {
    const { studentId, credentialUID } = normalized[i];
    const rowLabel = `Row ${i + 1}`;

    const student = studentMap.get(studentId);
    if (!student) {
      throw Object.assign(
        new Error(`${rowLabel}: Student ${studentId} not found for this school.`),
        { status: 404 },
      );
    }
    if (!student.isActive) {
      throw Object.assign(
        new Error(`${rowLabel}: Student ${getStudentName(student)} is not active.`),
        { status: 400 },
      );
    }

    const existingByUID = credByUID.get(credentialUID);
    if (existingByUID?.status === CredentialStatus.ACTIVE) {
      throw Object.assign(
        new Error(`${rowLabel}: Wristband UID ${credentialUID} is already registered to another student.`),
        { status: 409 },
      );
    }
    // Any non-DEACTIVATED existing credential (e.g. LOST) cannot be reused
    if (existingByUID && existingByUID.status !== CredentialStatus.DEACTIVATED) {
      throw Object.assign(
        new Error(`${rowLabel}: Wristband UID ${credentialUID} has status ${existingByUID.status} and cannot be reused.`),
        { status: 409 },
      );
    }

    if (activeByStudentId.has(studentId)) {
      throw Object.assign(
        new Error(`${rowLabel}: ${getStudentName(student)}: ${ACTIVE_STUDENT_CREDENTIAL_MESSAGE}`),
        { status: 409 },
      );
    }
  }

  // ── Step 4: Transaction for writes only — no reads, no heavy includes ─────
  const credentialIds: string[] = [];
  try {
    await runCredentialWrite(db, async (tx) => {
      for (const { studentId, credentialUID } of normalized) {
        const existingByUID = credByUID.get(credentialUID);
        let cred: { id: string };
        if (existingByUID) {
          cred = await tx.studentCredential.update({
            where: { id: existingByUID.id },
            data: {
              studentId,
              status: CredentialStatus.ACTIVE,
              issuedAt: new Date(),
              deactivatedAt: null,
              deactivatedReason: null,
              scanToken: existingByUID.scanToken ?? generateCredentialScanToken(),
              issuedById: ctx.actorId ?? null,
            },
          });
        } else {
          cred = await tx.studentCredential.create({
            data: {
              schoolId,
              studentId,
              type: CredentialType.NFC_WRISTBAND,
              credentialUID,
              scanToken: generateCredentialScanToken(),
              issuedById: ctx.actorId ?? null,
            },
          });
        }
        credentialIds.push(cred.id);
      }

      await auditCredentialAction(tx, ctx, "student_credential.bulk_allocated", {
        reason: cleanReason,
        count: credentialIds.length,
        credentialIds,
      });
    }, { maxWait: 10_000, timeout: 20_000 });
  } catch (error) {
    const mapped = mapUniqueCredentialError(error);
    if (mapped) throw mapped;
    throw error;
  }

  // ── Step 5: Post-fetch credentials with full include (outside transaction) ─
  const credentials = await db.studentCredential.findMany({
    where: { id: { in: credentialIds }, schoolId },
    include: credentialInclude,
  });

  return { credentials: (credentials as CredentialWithStudent[]).map(serializeCredential) };
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
