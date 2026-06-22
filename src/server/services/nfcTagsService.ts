import { randomBytes, createHash } from "crypto";
import type { PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "../db/prisma";
import type { NfcResolveResult } from "../../shared/types/nfcTags";

type NfcTagsClient = Pick<
  PrismaClient,
  "nfcTag" | "nfcTapEvent" | "student"
>;

export type NfcTagsContext = {
  schoolId?: string | null;
  actorId?: string | null;
  role?: string | null;
};

function requireSchoolId(ctx: NfcTagsContext): string {
  if (!ctx.schoolId) throw Object.assign(new Error("School context required."), { status: 401 });
  return ctx.schoolId;
}

function requireAuth(ctx: NfcTagsContext): void {
  if (!ctx.actorId) throw Object.assign(new Error("Authentication required."), { status: 401 });
}

function generatePublicCode(): string {
  return randomBytes(16).toString("hex");
}

function hashIp(ip: string | undefined): string | null {
  if (!ip) return null;
  return createHash("sha256").update(ip).digest("hex").slice(0, 16);
}

function studentSummary(student: {
  id: string;
  admissionNumber: string;
  firstName: string;
  lastName: string;
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
  };
}

const studentEnrollmentInclude = {
  enrollments: {
    where: { isActive: true, status: "ACTIVE" as const },
    include: {
      class: { select: { name: true } },
      stream: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" as const },
    take: 1,
  },
};

export async function listTags(
  ctx: NfcTagsContext,
  filters: { search?: string; status?: string } = {},
  db: NfcTagsClient = defaultPrisma,
) {
  const schoolId = requireSchoolId(ctx);
  requireAuth(ctx);

  const where: Record<string, unknown> = { schoolId };
  if (filters.status) where.status = filters.status;

  const tags = await db.nfcTag.findMany({
    where,
    include: {
      student: {
        select: {
          id: true,
          admissionNumber: true,
          firstName: true,
          lastName: true,
          enrollments: studentEnrollmentInclude.enrollments,
        },
      },
      _count: { select: { tapEvents: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return {
    tags: tags.map((t) => ({
      id: t.id,
      schoolId: t.schoolId,
      publicCode: t.publicCode,
      label: t.label,
      type: t.type,
      status: t.status,
      studentId: t.studentId,
      student: t.student ? studentSummary(t.student) : null,
      writtenUrl: t.writtenUrl,
      assignedAt: t.assignedAt?.toISOString() ?? null,
      lastSeenAt: t.lastSeenAt?.toISOString() ?? null,
      tapCount: t._count.tapEvents,
      createdAt: t.createdAt.toISOString(),
      updatedAt: t.updatedAt.toISOString(),
    })),
    total: tags.length,
  };
}

export async function generateTags(
  ctx: NfcTagsContext,
  count: number,
  baseUrl: string,
  db: NfcTagsClient = defaultPrisma,
) {
  const schoolId = requireSchoolId(ctx);
  requireAuth(ctx);

  if (count < 1 || count > 100) {
    throw Object.assign(new Error("Count must be between 1 and 100."), { status: 400 });
  }

  const created = await Promise.all(
    Array.from({ length: count }, async () => {
      const publicCode = generatePublicCode();
      const writtenUrl = `${baseUrl}/t/${publicCode}`;
      return db.nfcTag.create({
        data: { schoolId, publicCode, writtenUrl },
        include: {
          student: { select: { id: true, admissionNumber: true, firstName: true, lastName: true } },
          _count: { select: { tapEvents: true } },
        },
      });
    }),
  );

  return {
    tags: created.map((t) => ({
      id: t.id,
      schoolId: t.schoolId,
      publicCode: t.publicCode,
      label: t.label,
      type: t.type,
      status: t.status,
      studentId: t.studentId,
      student: t.student ? studentSummary(t.student) : null,
      writtenUrl: t.writtenUrl,
      assignedAt: null,
      lastSeenAt: null,
      tapCount: 0,
      createdAt: t.createdAt.toISOString(),
      updatedAt: t.updatedAt.toISOString(),
    })),
    generated: created.length,
  };
}

export async function assignTag(
  ctx: NfcTagsContext,
  tagId: string,
  studentId: string,
  db: NfcTagsClient = defaultPrisma,
) {
  const schoolId = requireSchoolId(ctx);
  requireAuth(ctx);

  const tag = await db.nfcTag.findFirst({ where: { id: tagId, schoolId } });
  if (!tag) throw Object.assign(new Error("NFC tag not found."), { status: 404 });
  if (tag.status === "DISABLED") throw Object.assign(new Error("Cannot assign a disabled tag."), { status: 400 });

  const student = await db.student.findFirst({ where: { id: studentId, schoolId, isActive: true } });
  if (!student) throw Object.assign(new Error("Student not found."), { status: 404 });

  const existing = await db.nfcTag.findFirst({ where: { schoolId, studentId, status: "ASSIGNED" } });
  if (existing && existing.id !== tagId) {
    throw Object.assign(new Error("Student already has an active NFC tag assigned."), { status: 409 });
  }

  const updated = await db.nfcTag.update({
    where: { id: tagId },
    data: { studentId, status: "ASSIGNED", assignedAt: new Date() },
    include: {
      student: {
        select: {
          id: true,
          admissionNumber: true,
          firstName: true,
          lastName: true,
          enrollments: studentEnrollmentInclude.enrollments,
        },
      },
      _count: { select: { tapEvents: true } },
    },
  });

  return {
    id: updated.id,
    schoolId: updated.schoolId,
    publicCode: updated.publicCode,
    label: updated.label,
    type: updated.type,
    status: updated.status,
    studentId: updated.studentId,
    student: updated.student ? studentSummary(updated.student) : null,
    writtenUrl: updated.writtenUrl,
    assignedAt: updated.assignedAt?.toISOString() ?? null,
    lastSeenAt: updated.lastSeenAt?.toISOString() ?? null,
    tapCount: updated._count.tapEvents,
    createdAt: updated.createdAt.toISOString(),
    updatedAt: updated.updatedAt.toISOString(),
  };
}

export async function unassignTag(
  ctx: NfcTagsContext,
  tagId: string,
  db: NfcTagsClient = defaultPrisma,
) {
  const schoolId = requireSchoolId(ctx);
  requireAuth(ctx);

  const tag = await db.nfcTag.findFirst({ where: { id: tagId, schoolId } });
  if (!tag) throw Object.assign(new Error("NFC tag not found."), { status: 404 });

  const updated = await db.nfcTag.update({
    where: { id: tagId },
    data: { studentId: null, status: "UNASSIGNED", assignedAt: null },
  });

  return { id: updated.id, status: updated.status };
}

export async function disableTag(
  ctx: NfcTagsContext,
  tagId: string,
  db: NfcTagsClient = defaultPrisma,
) {
  const schoolId = requireSchoolId(ctx);
  requireAuth(ctx);

  const tag = await db.nfcTag.findFirst({ where: { id: tagId, schoolId } });
  if (!tag) throw Object.assign(new Error("NFC tag not found."), { status: 404 });

  const updated = await db.nfcTag.update({
    where: { id: tagId },
    data: { status: "DISABLED" },
  });

  return { id: updated.id, status: updated.status };
}

export async function getTagEvents(
  ctx: NfcTagsContext,
  tagId: string,
  db: NfcTagsClient = defaultPrisma,
) {
  const schoolId = requireSchoolId(ctx);
  requireAuth(ctx);

  const tag = await db.nfcTag.findFirst({ where: { id: tagId, schoolId } });
  if (!tag) throw Object.assign(new Error("NFC tag not found."), { status: 404 });

  const events = await db.nfcTapEvent.findMany({
    where: { tagId },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return {
    events: events.map((e) => ({
      id: e.id,
      publicCode: e.publicCode,
      result: e.result,
      userAgent: e.userAgent,
      createdAt: e.createdAt.toISOString(),
    })),
    total: events.length,
  };
}

export async function resolvePublicCode(
  publicCode: string,
  meta: { userAgent?: string; ip?: string; isAuthenticated?: boolean },
  db: NfcTagsClient = defaultPrisma,
): Promise<{ result: NfcResolveResult; student?: ReturnType<typeof studentSummary> }> {
  const tag = await db.nfcTag.findUnique({
    where: { publicCode },
    include: {
      student: {
        select: {
          id: true,
          admissionNumber: true,
          firstName: true,
          lastName: true,
          enrollments: studentEnrollmentInclude.enrollments,
        },
      },
    },
  });

  let result: NfcResolveResult;

  if (!tag) {
    result = "UNKNOWN";
  } else if (tag.status === "DISABLED") {
    result = "DISABLED";
  } else if (tag.status === "UNASSIGNED" || !tag.studentId) {
    result = "UNASSIGNED";
  } else {
    result = "ASSIGNED";
  }

  // Always log the tap event
  await db.nfcTapEvent.create({
    data: {
      schoolId: tag?.schoolId ?? null,
      tagId: tag?.id ?? null,
      studentId: tag?.studentId ?? null,
      publicCode,
      result,
      userAgent: meta.userAgent?.slice(0, 512) ?? null,
      ipHash: hashIp(meta.ip),
    },
  });

  // Update lastSeenAt on the tag
  if (tag) {
    await db.nfcTag.update({ where: { id: tag.id }, data: { lastSeenAt: new Date() } });
  }

  // Return student details only if authenticated and the tag is assigned
  if (result === "ASSIGNED" && meta.isAuthenticated && tag?.student) {
    return { result, student: studentSummary(tag.student) };
  }

  return { result };
}
