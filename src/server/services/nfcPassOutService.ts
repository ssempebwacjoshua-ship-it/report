import type { StudentPassOutStatus as PrismaStudentPassOutStatus } from "@prisma/client";
import type { PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "../db/prisma";
import type { SchoolUserRole } from "./authService";
import { hasPermission } from "../../shared/permissions";

type NfcPassOutClient = Pick<PrismaClient, "studentPassOut" | "student" | "auditLog"> & {
  $transaction?: <T>(fn: (tx: NfcPassOutClient) => Promise<T>) => Promise<T>;
};

export type NfcPassOutContext = {
  schoolId?: string | null;
  actorId?: string | null;
  role?: SchoolUserRole | string | null;
};

export type StudentPassOutFilters = {
  search?: string;
  classId?: string;
  streamId?: string;
  status?: PrismaStudentPassOutStatus | "ALL";
  activeOnly?: boolean;
};

export type StudentPassOutInput = {
  studentId: string;
  reason: string;
  activeFrom: string;
  activeUntil: string;
};

function requireSchoolId(ctx: NfcPassOutContext): string {
  if (!ctx.schoolId) throw Object.assign(new Error("School context required."), { status: 401 });
  return ctx.schoolId;
}

function requirePermission(ctx: NfcPassOutContext, permission: string) {
  if (!ctx.actorId || !ctx.role) throw Object.assign(new Error("Authentication required."), { status: 401 });
  if (!hasPermission(ctx.role, permission)) {
    throw Object.assign(new Error("You do not have permission for this action."), { status: 403 });
  }
}

const PASS_OUT_STATUS = {
  APPROVED: "APPROVED",
  CHECKED_OUT: "CHECKED_OUT",
  RETURNED: "RETURNED",
  CANCELLED: "CANCELLED",
  EXPIRED: "EXPIRED",
} as const;

function runWrite<T>(db: NfcPassOutClient, fn: (tx: NfcPassOutClient) => Promise<T>) {
  return db.$transaction ? db.$transaction(fn) : fn(db);
}

function studentWhere(
  schoolId: string,
  filters: { search?: string; classId?: string; streamId?: string },
) {
  const search = filters.search?.trim();
  return {
    schoolId,
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

function toStudentSummary(student: {
  id: string;
  admissionNumber: string;
  firstName: string;
  lastName: string;
  studentType: "DAY" | "BOARDING" | null;
  isActive?: boolean;
  enrollments?: Array<{
    class?: { name: string } | null;
    stream?: { name: string } | null;
  }>;
}) {
  const enrollment = student.enrollments?.[0];
  return {
    id: student.id,
    studentName: `${student.firstName} ${student.lastName}`.trim(),
    admissionNumber: student.admissionNumber,
    className: enrollment?.class?.name ?? null,
    streamName: enrollment?.stream?.name ?? null,
    studentType: student.studentType,
    isActive: student.isActive ?? true,
  };
}

function formatPassOutRow(passOut: {
  id: string;
  schoolId: string;
  studentId: string;
  status: PrismaStudentPassOutStatus;
  reason: string;
  approvedAt: Date | null;
  activeFrom: Date;
  activeUntil: Date;
  checkedOutAt: Date | null;
  checkedInAt: Date | null;
  cancelledAt: Date | null;
  cancellationReason: string | null;
  createdByUserId: string | null;
  approvedByUserId: string | null;
  cancelledByUserId: string | null;
  checkoutMovementEventId: string | null;
  checkinMovementEventId: string | null;
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
}) {
  const now = Date.now();
  const isExpired = (
    passOut.status === PASS_OUT_STATUS.APPROVED || passOut.status === PASS_OUT_STATUS.CHECKED_OUT
  ) && passOut.activeUntil.getTime() < now;

  return {
    id: passOut.id,
    schoolId: passOut.schoolId,
    studentId: passOut.studentId,
    status: isExpired ? "EXPIRED" : passOut.status,
    reason: passOut.reason,
    approvedAt: passOut.approvedAt?.toISOString() ?? null,
    activeFrom: passOut.activeFrom.toISOString(),
    activeUntil: passOut.activeUntil.toISOString(),
    checkedOutAt: passOut.checkedOutAt?.toISOString() ?? null,
    checkedInAt: passOut.checkedInAt?.toISOString() ?? null,
    cancelledAt: passOut.cancelledAt?.toISOString() ?? null,
    cancellationReason: passOut.cancellationReason,
    createdByUserId: passOut.createdByUserId,
    approvedByUserId: passOut.approvedByUserId,
    cancelledByUserId: passOut.cancelledByUserId,
    checkoutMovementEventId: passOut.checkoutMovementEventId,
    checkinMovementEventId: passOut.checkinMovementEventId,
    createdAt: passOut.createdAt.toISOString(),
    updatedAt: passOut.updatedAt.toISOString(),
    student: toStudentSummary(passOut.student),
  };
}

export async function searchPassOutStudents(
  ctx: NfcPassOutContext,
  filters: { search?: string; classId?: string; streamId?: string } = {},
  db: NfcPassOutClient = defaultPrisma,
) {
  const schoolId = requireSchoolId(ctx);
  requirePermission(ctx, "app.admin");
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

  return { students: students.map(toStudentSummary) };
}

export async function listStudentPassOuts(
  ctx: NfcPassOutContext,
  filters: StudentPassOutFilters = {},
  db: NfcPassOutClient = defaultPrisma,
) {
  const schoolId = requireSchoolId(ctx);
  requirePermission(ctx, "app.admin");
  const now = new Date();
  const studentFilter = {
    ...(filters.classId || filters.streamId || filters.search?.trim()
      ? studentWhere(schoolId, {
          search: filters.search,
          classId: filters.classId,
          streamId: filters.streamId,
        })
      : {}),
  };

  const passOuts = await db.studentPassOut.findMany({
    where: {
      schoolId,
      ...(filters.status && filters.status !== "ALL" ? { status: filters.status } : {}),
      ...(filters.activeOnly
        ? {
            status: { in: [PASS_OUT_STATUS.APPROVED, PASS_OUT_STATUS.CHECKED_OUT] },
            activeFrom: { lte: now },
            activeUntil: { gte: now },
          }
        : {}),
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
    orderBy: [{ status: "asc" }, { activeFrom: "desc" }, { createdAt: "desc" }],
  });

  return { passOuts: passOuts.map((passOut) => formatPassOutRow(passOut as never)) };
}

export async function createStudentPassOut(
  ctx: NfcPassOutContext,
  input: StudentPassOutInput,
  db: NfcPassOutClient = defaultPrisma,
) {
  const schoolId = requireSchoolId(ctx);
  requirePermission(ctx, "app.admin");

  const reason = input.reason.trim();
  if (!reason) throw Object.assign(new Error("Pass-out reason is required."), { status: 400 });

  const activeFrom = new Date(input.activeFrom);
  const activeUntil = new Date(input.activeUntil);
  if (Number.isNaN(activeFrom.getTime()) || Number.isNaN(activeUntil.getTime())) {
    throw Object.assign(new Error("Valid pass-out start and end times are required."), { status: 400 });
  }
  if (activeUntil <= activeFrom) {
    throw Object.assign(new Error("Pass-out end time must be after the start time."), { status: 400 });
  }

  const student = await db.student.findFirst({
    where: { id: input.studentId, schoolId, isActive: true },
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

  const overlapping = await db.studentPassOut.findFirst({
    where: {
      schoolId,
      studentId: student.id,
      status: { in: [PASS_OUT_STATUS.APPROVED, PASS_OUT_STATUS.CHECKED_OUT] },
      cancelledAt: null,
      activeFrom: { lte: activeUntil },
      activeUntil: { gte: activeFrom },
    },
  });
  if (overlapping) {
    throw Object.assign(new Error("An overlapping approved pass-out already exists for this student."), { status: 409 });
  }

  const created = await runWrite(db, async (tx) => {
    const passOut = await tx.studentPassOut.create({
      data: {
        schoolId,
        studentId: student.id,
        status: PASS_OUT_STATUS.APPROVED,
        reason,
        approvedAt: new Date(),
        activeFrom,
        activeUntil,
        createdByUserId: ctx.actorId ?? null,
        approvedByUserId: ctx.actorId ?? null,
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
        action: "student_pass_out.created",
        details: {
          actor: { id: ctx.actorId ?? null },
          passOutId: passOut.id,
          studentId: passOut.studentId,
          activeFrom: passOut.activeFrom.toISOString(),
          activeUntil: passOut.activeUntil.toISOString(),
          reason: passOut.reason,
        },
      },
    });
    return passOut;
  });

  return { passOut: formatPassOutRow(created as never) };
}

export async function cancelStudentPassOut(
  ctx: NfcPassOutContext,
  passOutId: string,
  reason: string,
  db: NfcPassOutClient = defaultPrisma,
) {
  const schoolId = requireSchoolId(ctx);
  requirePermission(ctx, "app.admin");
  const cancellationReason = reason.trim();
  if (!cancellationReason) throw Object.assign(new Error("Cancellation reason is required."), { status: 400 });

  const passOut = await db.studentPassOut.findFirst({
    where: { id: passOutId, schoolId },
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
  if (!passOut) throw Object.assign(new Error("Pass-out not found."), { status: 404 });
  if (passOut.status !== PASS_OUT_STATUS.APPROVED) {
    throw Object.assign(new Error("Only approved pass-outs can be cancelled before gate use."), { status: 409 });
  }

  const updated = await runWrite(db, async (tx) => {
    const cancelled = await tx.studentPassOut.update({
      where: { id: passOut.id },
      data: {
        status: PASS_OUT_STATUS.CANCELLED,
        cancelledAt: new Date(),
        cancelledByUserId: ctx.actorId ?? null,
        cancellationReason,
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
        action: "student_pass_out.cancelled",
        details: {
          actor: { id: ctx.actorId ?? null },
          passOutId: passOut.id,
          studentId: passOut.studentId,
          reason: cancellationReason,
        },
      },
    });
    return cancelled;
  });

  return { passOut: formatPassOutRow(updated as never) };
}
