import { randomBytes, createHash } from "crypto";
import type { PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "../db/prisma";
import type { NfcResolveResult } from "../../shared/types/nfcTags";
import { hasPermission } from "../../shared/permissions";

type NfcTagsClient = Pick<
  PrismaClient,
  "nfcTag" | "nfcTapEvent" | "student" | "auditLog"
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

function requirePermission(ctx: NfcTagsContext, permission: string): void {
  if (!ctx.actorId || !ctx.role) {
    throw Object.assign(new Error("Authentication required."), { status: 401 });
  }
  if (!hasPermission(ctx.role, permission)) {
    throw Object.assign(new Error("You do not have permission for this NFC action."), { status: 403 });
  }
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

function makeOperationalPayload(publicCode: string) {
  return `SCNFC:${publicCode}`;
}

function serializeTag(t: {
  id: string;
  schoolId: string;
  batchId: string | null;
  publicCode: string;
  physicalUid: string | null;
  tagMode: string;
  label: string | null;
  type: string;
  purpose: string;
  status: string;
  studentId: string | null;
  writtenUrl: string | null;
  writtenPayload?: string | null;
  issuedAt: Date | null;
  writtenAt: Date | null;
  verifiedAt: Date | null;
  assignedAt: Date | null;
  lastSeenAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  student?: {
    id: string;
    admissionNumber: string;
    firstName: string;
    lastName: string;
    enrollments?: Array<{ class?: { name: string } | null; stream?: { name: string } | null }>;
  } | null;
  _count?: { tapEvents: number };
}) {
  return {
    id: t.id,
    schoolId: t.schoolId,
    batchId: t.batchId,
    publicCode: t.publicCode,
    physicalUid: t.physicalUid,
    tagMode: (t.tagMode ?? "URL") as "URL" | "UID" | "TEXT",
    label: t.label,
    type: t.type,
    purpose: t.purpose ?? "STUDENT",
    status: t.status,
    studentId: t.studentId,
    student: t.student ? studentSummary(t.student) : null,
    writtenUrl: t.writtenUrl,
    writtenPayload: t.writtenPayload ?? makeOperationalPayload(t.publicCode),
    issuedAt: t.issuedAt?.toISOString() ?? null,
    writtenAt: t.writtenAt?.toISOString() ?? null,
    verifiedAt: t.verifiedAt?.toISOString() ?? null,
    assignedAt: t.assignedAt?.toISOString() ?? null,
    lastSeenAt: t.lastSeenAt?.toISOString() ?? null,
    tapCount: t._count?.tapEvents ?? 0,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
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
  requirePermission(ctx, "nfc.tags.manage");

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

  return { tags: tags.map(serializeTag), total: tags.length };
}

export async function generateTags(
  ctx: NfcTagsContext,
  count: number,
  baseUrl: string,
  db: NfcTagsClient = defaultPrisma,
) {
  const schoolId = requireSchoolId(ctx);
  requirePermission(ctx, "nfc.tags.manage");

  if (count < 1 || count > 100) {
    throw Object.assign(new Error("Count must be between 1 and 100."), { status: 400 });
  }

  const created = await Promise.all(
    Array.from({ length: count }, async () => {
      const publicCode = generatePublicCode();
      const writtenUrl = `${baseUrl}/t/${publicCode}`;
      const writtenPayload = makeOperationalPayload(publicCode);
      return db.nfcTag.create({
        data: { schoolId, publicCode, tagMode: "TEXT", writtenUrl, writtenPayload },
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
    }),
  );

  return { tags: created.map(serializeTag), generated: created.length };
}

export async function resolveStudentByIdentifier(
  schoolId: string,
  assignment: { studentId?: string | null; admissionNumber?: string | null },
  db: Pick<NfcTagsClient, "student">,
): Promise<{ id: string; admissionNumber: string; firstName: string; lastName: string }> {
  if (assignment.admissionNumber) {
    const found = await db.student.findFirst({
      where: { schoolId, admissionNumber: assignment.admissionNumber.trim(), isActive: true },
    });
    if (!found) throw Object.assign(new Error("Student not found in this school."), { status: 404 });
    return found as { id: string; admissionNumber: string; firstName: string; lastName: string };
  }
  if (assignment.studentId) {
    const found = await db.student.findFirst({ where: { id: assignment.studentId, schoolId, isActive: true } });
    if (!found) throw Object.assign(new Error("Student not found."), { status: 404 });
    return found as { id: string; admissionNumber: string; firstName: string; lastName: string };
  }
  throw Object.assign(new Error("Provide studentId or admissionNumber."), { status: 400 });
}

export async function assignTag(
  ctx: NfcTagsContext,
  tagId: string,
  assignment: { studentId?: string; admissionNumber?: string },
  db: NfcTagsClient = defaultPrisma,
) {
  const schoolId = requireSchoolId(ctx);
  requirePermission(ctx, "nfc.tags.manage");

  const tag = await db.nfcTag.findFirst({ where: { id: tagId, schoolId } });
  if (!tag) throw Object.assign(new Error("NFC tag not found."), { status: 404 });
  if (tag.status === "DISABLED") throw Object.assign(new Error("Cannot assign a disabled tag."), { status: 400 });

  const student = await resolveStudentByIdentifier(schoolId, assignment, db);
  const studentId = student.id;

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

  return serializeTag(updated);
}

export async function unassignTag(
  ctx: NfcTagsContext,
  tagId: string,
  db: NfcTagsClient = defaultPrisma,
) {
  const schoolId = requireSchoolId(ctx);
  requirePermission(ctx, "nfc.tags.manage");

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
  requirePermission(ctx, "nfc.tags.manage");

  const tag = await db.nfcTag.findFirst({ where: { id: tagId, schoolId } });
  if (!tag) throw Object.assign(new Error("NFC tag not found."), { status: 404 });

  const updated = await db.nfcTag.update({
    where: { id: tagId },
    data: { status: "DISABLED" },
  });

  return { id: updated.id, status: updated.status };
}

const ENABLE_ALLOWED_ROLES = ["ADMIN_OPERATOR"];
const ALREADY_ACTIVE_STATUSES = new Set(["UNASSIGNED", "ASSIGNED", "UNALLOCATED", "GENERATED", "WRITTEN", "VERIFIED", "REGISTERED"]);

export async function enableTag(
  ctx: NfcTagsContext,
  tagId: string,
  reason: string,
  db: NfcTagsClient = defaultPrisma,
) {
  const schoolId = requireSchoolId(ctx);
  requirePermission(ctx, "nfc.tags.manage");
  const cleanReason = reason?.trim();
  if (!cleanReason) throw Object.assign(new Error("Re-enable reason is required."), { status: 400 });

  const tag = await db.nfcTag.findFirst({ where: { id: tagId, schoolId } });
  if (!tag) throw Object.assign(new Error("NFC tag not found."), { status: 404 });

  if (ALREADY_ACTIVE_STATUSES.has(tag.status)) {
    return { id: tag.id, status: tag.status, alreadyActive: true };
  }

  const newStatus = tag.studentId ? "ASSIGNED" : "UNASSIGNED";
  const updated = await db.nfcTag.update({
    where: { id: tagId },
    data: { status: newStatus },
  });

  await db.auditLog.create({
    data: {
      schoolId,
      action: "nfc_tag.enabled",
      details: {
        tagId,
        previousStatus: tag.status,
        newStatus,
        studentId: tag.studentId ?? null,
        reason: cleanReason,
        actor: { id: ctx.actorId ?? null },
      },
    },
  });

  return { id: updated.id, status: updated.status, alreadyActive: false };
}

export async function getTagEvents(
  ctx: NfcTagsContext,
  tagId: string,
  db: NfcTagsClient = defaultPrisma,
) {
  const schoolId = requireSchoolId(ctx);
  requirePermission(ctx, "nfc.tags.manage");

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

  const UNALLOCATED_STATUSES = new Set(["UNASSIGNED", "UNALLOCATED", "GENERATED", "WRITTEN", "VERIFIED", "REGISTERED"]);

  if (!tag) {
    result = "UNKNOWN";
  } else if (tag.status === "DISABLED") {
    result = "DISABLED";
  } else if (!tag.studentId || UNALLOCATED_STATUSES.has(tag.status)) {
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
