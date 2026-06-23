import { randomBytes } from "crypto";
import type { PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "../db/prisma";
import { hasPermission } from "../../shared/permissions";

export type NfcTagBatchContext = {
  schoolId?: string | null;
  actorId?: string | null;
  role?: string | null;
};

type BatchClient = Pick<PrismaClient, "nfcTagBatch" | "nfcTag" | "student" | "studentCredential" | "auditLog">;

export type TagMode = "URL" | "UID";

// Statuses that mean a tag is available for allocation to a student
const ALLOCATABLE_STATUSES = new Set([
  "GENERATED",
  "WRITTEN",
  "VERIFIED",
  "REGISTERED",
  "UNALLOCATED",
  "UNASSIGNED", // legacy URL-tag status
]);

function requireSchoolId(ctx: NfcTagBatchContext): string {
  if (!ctx.schoolId) throw Object.assign(new Error("School context required."), { status: 401 });
  return ctx.schoolId;
}

function requireAuth(ctx: NfcTagBatchContext): void {
  if (!ctx.actorId) throw Object.assign(new Error("Authentication required."), { status: 401 });
}

function requirePermission(ctx: NfcTagBatchContext, permission: string): void {
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

function isUrlShaped(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

async function auditTagAction(
  db: BatchClient,
  ctx: NfcTagBatchContext,
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
        actor: { id: ctx.actorId ?? null, role: ctx.role ?? null },
      },
    },
  });
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
    firstName: string;
    lastName: string;
    admissionNumber: string;
    enrollments?: Array<{ class?: { name: string } | null; stream?: { name: string } | null }>;
  } | null;
  _count?: { tapEvents: number };
}) {
  const enrollment = t.student?.enrollments?.[0];
  return {
    id: t.id,
    schoolId: t.schoolId,
    batchId: t.batchId,
    publicCode: t.publicCode,
    physicalUid: t.physicalUid,
    tagMode: (t.tagMode ?? "URL") as TagMode,
    label: t.label,
    type: t.type,
    purpose: t.purpose ?? "STUDENT",
    status: t.status,
    studentId: t.studentId,
    student: t.student
      ? {
          id: t.student.id,
          name: `${t.student.firstName} ${t.student.lastName}`.trim(),
          admissionNumber: t.student.admissionNumber,
          className: enrollment?.class?.name ?? null,
          streamName: enrollment?.stream?.name ?? null,
        }
      : null,
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

const tagWithStudentInclude = {
  student: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      admissionNumber: true,
      enrollments: studentEnrollmentInclude.enrollments,
    },
  },
};

// ─── Create URL tag batch ─────────────────────────────────────────────────────

export async function createUrlTagBatch(
  ctx: NfcTagBatchContext,
  input: { name: string; quantity: number; labelPrefix?: string; baseUrl: string },
  db: BatchClient = defaultPrisma,
) {
  const schoolId = requireSchoolId(ctx);
  requirePermission(ctx, "nfc.tags.manage");

  const { name, quantity, labelPrefix, baseUrl } = input;

  if (!name.trim()) throw Object.assign(new Error("Batch name is required."), { status: 400 });
  if (quantity < 1 || quantity > 500) {
    throw Object.assign(new Error("Quantity must be between 1 and 500."), { status: 400 });
  }

  const batch = await db.nfcTagBatch.create({
    data: { schoolId, name: name.trim(), tagMode: "URL", quantity, createdById: ctx.actorId ?? null },
  });

  const tags = await Promise.all(
    Array.from({ length: quantity }, async (_, i) => {
      const publicCode = generatePublicCode();
      const writtenUrl = `${baseUrl}/t/${publicCode}`;
      const writtenPayload = makeOperationalPayload(publicCode);
      const label = labelPrefix ? `${labelPrefix.trim()}-${String(i + 1).padStart(4, "0")}` : null;
      return db.nfcTag.create({
        data: {
          schoolId,
          batchId: batch.id,
          publicCode,
          tagMode: "URL",
          label,
          writtenUrl,
          writtenPayload,
          status: "GENERATED",
          issuedAt: new Date(),
          createdById: ctx.actorId ?? null,
        },
        include: tagWithStudentInclude,
      });
    }),
  );

  await auditTagAction(db, ctx, "nfc_tag.batch_created", {
    batchId: batch.id,
    batchName: batch.name,
    tagMode: "URL",
    quantity,
  });

  return {
    batch: {
      id: batch.id,
      name: batch.name,
      tagMode: batch.tagMode as TagMode,
      quantity: batch.quantity,
      status: batch.status,
      createdAt: batch.createdAt.toISOString(),
    },
    tags: tags.map(serializeTag),
    generated: tags.length,
  };
}

// ─── Bulk import UID wristbands ───────────────────────────────────────────────

export async function bulkImportUids(
  ctx: NfcTagBatchContext,
  input: { batchName: string; uids: string[]; reason?: string },
  db: BatchClient = defaultPrisma,
) {
  const schoolId = requireSchoolId(ctx);
  requirePermission(ctx, "nfc.tags.manage");

  const { batchName, uids } = input;

  if (!batchName.trim()) throw Object.assign(new Error("Batch name is required."), { status: 400 });
  if (!uids.length) throw Object.assign(new Error("No UIDs provided."), { status: 400 });

  // Normalize
  const normalized = uids.map((u) => u.trim().toUpperCase()).filter(Boolean);

  // Validate: not URL-shaped
  for (const uid of normalized) {
    if (isUrlShaped(uid)) {
      throw Object.assign(
        new Error(`"${uid}" looks like a URL, not a wristband UID. Do not mix URL-based NFC tags with UID-based wristbands.`),
        { status: 400 },
      );
    }
  }

  // Intra-request duplicates
  const seen = new Set<string>();
  for (const uid of normalized) {
    if (seen.has(uid)) {
      throw Object.assign(new Error(`Duplicate UID in request: ${uid}`), { status: 400 });
    }
    seen.add(uid);
  }

  // Check for existing physicalUid conflicts in this school
  const existing = await db.nfcTag.findMany({
    where: { schoolId, physicalUid: { in: normalized } },
    select: { physicalUid: true, status: true },
  });
  if (existing.length > 0) {
    const conflicts = existing.map((e) => e.physicalUid).join(", ");
    throw Object.assign(
      new Error(`These UIDs already exist in inventory for this school: ${conflicts}`),
      { status: 409 },
    );
  }

  const batch = await db.nfcTagBatch.create({
    data: {
      schoolId,
      name: batchName.trim(),
      tagMode: "UID",
      quantity: normalized.length,
      createdById: ctx.actorId ?? null,
    },
  });

  const tags = await Promise.all(
    normalized.map((uid) =>
      db.nfcTag.create({
        data: {
          schoolId,
          batchId: batch.id,
          publicCode: generatePublicCode(), // required by DB NOT NULL; never written to tag
          physicalUid: uid,
          tagMode: "UID",
          status: "REGISTERED",
          issuedAt: new Date(),
          createdById: ctx.actorId ?? null,
        },
        include: tagWithStudentInclude,
      }),
    ),
  );

  await auditTagAction(db, ctx, "nfc_tag.registered", {
    batchId: batch.id,
    batchName: batch.name,
    count: tags.length,
    reason: input.reason,
  });

  return {
    batch: {
      id: batch.id,
      name: batch.name,
      tagMode: batch.tagMode as TagMode,
      quantity: batch.quantity,
      status: batch.status,
      createdAt: batch.createdAt.toISOString(),
    },
    tags: tags.map(serializeTag),
    registered: tags.length,
  };
}

// ─── List batches ─────────────────────────────────────────────────────────────

export async function listTagBatches(
  ctx: NfcTagBatchContext,
  filters: { tagMode?: TagMode } = {},
  db: BatchClient = defaultPrisma,
) {
  const schoolId = requireSchoolId(ctx);
  requirePermission(ctx, "nfc.tags.manage");

  const where: Record<string, unknown> = { schoolId };
  if (filters.tagMode) where.tagMode = filters.tagMode;

  const batches = await db.nfcTagBatch.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { tags: true } },
      tags: {
        select: { status: true },
      },
    },
  });

  return {
    batches: batches.map((b) => {
      const statusCounts: Record<string, number> = {};
      for (const t of b.tags) {
        statusCounts[t.status] = (statusCounts[t.status] ?? 0) + 1;
      }
      const written = (statusCounts["WRITTEN"] ?? 0) + (statusCounts["VERIFIED"] ?? 0);
      const verified = statusCounts["VERIFIED"] ?? 0;
      const unallocated =
        (statusCounts["UNALLOCATED"] ?? 0) +
        (statusCounts["REGISTERED"] ?? 0) +
        (statusCounts["GENERATED"] ?? 0) +
        (statusCounts["UNASSIGNED"] ?? 0); // legacy
      const assigned = (statusCounts["ASSIGNED"] ?? 0);
      const disabled = (statusCounts["DISABLED"] ?? 0);
      const lost = (statusCounts["LOST"] ?? 0);

      return {
        id: b.id,
        name: b.name,
        tagMode: b.tagMode as TagMode,
        quantity: b.quantity,
        status: b.status,
        totalTags: b._count.tags,
        written,
        verified,
        unallocated,
        assigned,
        disabled,
        lost,
        createdAt: b.createdAt.toISOString(),
        updatedAt: b.updatedAt.toISOString(),
      };
    }),
    total: batches.length,
  };
}

// ─── List tag inventory ───────────────────────────────────────────────────────

export async function listTagInventory(
  ctx: NfcTagBatchContext,
  filters: {
    batchId?: string;
    tagMode?: TagMode;
    status?: string;
    search?: string;
  } = {},
  db: BatchClient = defaultPrisma,
) {
  const schoolId = requireSchoolId(ctx);
  requirePermission(ctx, "nfc.tags.manage");

  const where: Record<string, unknown> = { schoolId };
  if (filters.batchId) where.batchId = filters.batchId;
  if (filters.tagMode) where.tagMode = filters.tagMode;

  // Map allocationStatus filter to raw status values
  if (filters.status && filters.status !== "ALL") {
    switch (filters.status) {
      case "UNALLOCATED":
        where.status = { in: ["UNALLOCATED", "GENERATED", "WRITTEN", "VERIFIED", "REGISTERED", "UNASSIGNED"] };
        break;
      case "ASSIGNED":
        where.status = "ASSIGNED";
        break;
      case "DISABLED":
        where.status = "DISABLED";
        break;
      case "LOST":
        where.status = "LOST";
        break;
      default:
        where.status = filters.status;
    }
  }

  if (filters.search) {
    const q = filters.search.trim();
    where.OR = [
      { label: { contains: q, mode: "insensitive" } },
      { publicCode: { contains: q, mode: "insensitive" } },
      { physicalUid: { contains: q, mode: "insensitive" } },
      {
        student: {
          OR: [
            { firstName: { contains: q, mode: "insensitive" } },
            { lastName: { contains: q, mode: "insensitive" } },
            { admissionNumber: { contains: q, mode: "insensitive" } },
          ],
        },
      },
    ];
  }

  const tags = await db.nfcTag.findMany({
    where,
    include: tagWithStudentInclude,
    orderBy: { createdAt: "desc" },
    take: 500,
  });

  return { tags: tags.map(serializeTag), total: tags.length };
}

// ─── Verify tag ───────────────────────────────────────────────────────────────

export async function verifyTag(
  ctx: NfcTagBatchContext,
  tagId: string,
  db: BatchClient = defaultPrisma,
) {
  const schoolId = requireSchoolId(ctx);
  requirePermission(ctx, "nfc.tags.manage");

  const tag = await db.nfcTag.findFirst({ where: { id: tagId, schoolId } });
  if (!tag) throw Object.assign(new Error("NFC tag not found."), { status: 404 });
  if (tag.status === "ASSIGNED") {
    throw Object.assign(new Error("Tag is already assigned to a student."), { status: 409 });
  }
  if (tag.status === "DISABLED" || tag.status === "LOST") {
    throw Object.assign(new Error("Cannot verify a disabled or lost tag."), { status: 409 });
  }

  const updated = await db.nfcTag.update({
    where: { id: tagId },
    data: { status: "VERIFIED", verifiedAt: new Date() },
    include: tagWithStudentInclude,
  });

  await auditTagAction(db, ctx, "nfc_tag.verified", { tagId, tagMode: tag.tagMode });

  return serializeTag(updated);
}

// ─── Amend tag ────────────────────────────────────────────────────────────────

export async function amendTag(
  ctx: NfcTagBatchContext,
  tagId: string,
  input: { label?: string; physicalUid?: string; status?: string; reason: string },
  db: BatchClient = defaultPrisma,
) {
  const schoolId = requireSchoolId(ctx);
  requirePermission(ctx, "nfc.tags.manage");

  if (!input.reason?.trim()) throw Object.assign(new Error("Reason is required."), { status: 400 });

  const tag = await db.nfcTag.findFirst({ where: { id: tagId, schoolId } });
  if (!tag) throw Object.assign(new Error("NFC tag not found."), { status: 404 });

  const patch: Record<string, unknown> = {};

  if (input.label !== undefined) patch.label = input.label.trim() || null;

  if (input.physicalUid !== undefined) {
    const uid = input.physicalUid.trim().toUpperCase();
    if (!uid) throw Object.assign(new Error("physicalUid cannot be empty."), { status: 400 });
    if (isUrlShaped(uid)) {
      throw Object.assign(new Error("physicalUid must not be a URL."), { status: 400 });
    }
    // Check uniqueness within school (excluding self)
    const conflict = await db.nfcTag.findFirst({
      where: { schoolId, physicalUid: uid, id: { not: tagId } },
    });
    if (conflict) {
      throw Object.assign(new Error(`UID ${uid} is already registered in inventory for this school.`), { status: 409 });
    }
    patch.physicalUid = uid;
  }

  if (input.status !== undefined) {
    const allowed = ["GENERATED", "WRITTEN", "VERIFIED", "REGISTERED", "UNALLOCATED", "ASSIGNED", "DISABLED", "LOST", "UNASSIGNED"];
    if (!allowed.includes(input.status)) {
      throw Object.assign(new Error(`Invalid status: ${input.status}`), { status: 400 });
    }
    patch.status = input.status;
  }

  if (Object.keys(patch).length === 0) {
    throw Object.assign(new Error("Provide at least one field to amend."), { status: 400 });
  }

  const updated = await db.nfcTag.update({
    where: { id: tagId },
    data: patch,
    include: tagWithStudentInclude,
  });

  await auditTagAction(db, ctx, "nfc_tag.amended", {
    tagId,
    changes: patch,
    reason: input.reason,
  });

  return serializeTag(updated);
}

// ─── Bulk allocate from inventory ─────────────────────────────────────────────

export async function bulkAllocateFromInventory(
  ctx: NfcTagBatchContext,
  input: {
    assignments: Array<{ tagId: string; studentId: string }>;
    reason: string;
  },
  db: BatchClient = defaultPrisma,
) {
  const schoolId = requireSchoolId(ctx);
  requirePermission(ctx, "nfc.tags.manage");

  if (!input.reason?.trim()) throw Object.assign(new Error("Reason is required."), { status: 400 });
  if (!input.assignments.length) throw Object.assign(new Error("No assignments provided."), { status: 400 });

  // Intra-request duplicate checks
  const seenTagIds = new Set<string>();
  const seenStudentIds = new Set<string>();
  for (const { tagId, studentId } of input.assignments) {
    if (seenTagIds.has(tagId)) throw Object.assign(new Error(`Duplicate tagId in request: ${tagId}`), { status: 400 });
    if (seenStudentIds.has(studentId)) throw Object.assign(new Error(`Duplicate studentId in request: ${studentId}`), { status: 400 });
    seenTagIds.add(tagId);
    seenStudentIds.add(studentId);
  }

  const results: ReturnType<typeof serializeTag>[] = [];
  const credentialIds: string[] = [];

  for (let i = 0; i < input.assignments.length; i++) {
    const { tagId, studentId } = input.assignments[i];
    const rowLabel = `Row ${i + 1}`;

    // Load tag
    const tag = await db.nfcTag.findFirst({ where: { id: tagId, schoolId } });
    if (!tag) throw Object.assign(new Error(`${rowLabel}: NFC tag not found.`), { status: 404 });

    if (!ALLOCATABLE_STATUSES.has(tag.status)) {
      throw Object.assign(
        new Error(`${rowLabel}: Tag "${tag.physicalUid ?? tag.publicCode}" has status ${tag.status} and cannot be allocated.`),
        { status: 409 },
      );
    }

    // Load student
    const student = await db.student.findFirst({
      where: { id: studentId, schoolId, isActive: true },
    });
    if (!student) throw Object.assign(new Error(`${rowLabel}: Student not found or inactive.`), { status: 404 });

    // For UID-mode tags: create StudentCredential
    if (tag.tagMode === "UID") {
      if (!tag.physicalUid) {
        throw Object.assign(new Error(`${rowLabel}: UID-mode tag has no physicalUid set.`), { status: 400 });
      }

      // Check if student already has an active NFC_WRISTBAND credential
      const existingCred = await db.studentCredential.findFirst({
        where: { schoolId, studentId, type: "NFC_WRISTBAND" as never, status: "ACTIVE" as never },
      });
      if (existingCred) {
        throw Object.assign(
          new Error(`${rowLabel}: Student already has an active NFC wristband. Deactivate it before allocating another.`),
          { status: 409 },
        );
      }

      // Check if this UID is already active on another student
      const uidConflict = await db.studentCredential.findFirst({
        where: {
          schoolId,
          type: "NFC_WRISTBAND" as never,
          status: "ACTIVE" as never,
          credentialUID: tag.physicalUid,
        },
      });
      if (uidConflict) {
        throw Object.assign(
          new Error(`${rowLabel}: UID ${tag.physicalUid} is already registered as an active wristband.`),
          { status: 409 },
        );
      }

      // Reactivate deactivated credential with same UID, or create new
      const deactivated = await db.studentCredential.findFirst({
        where: { schoolId, studentId, type: "NFC_WRISTBAND" as never, credentialUID: tag.physicalUid, status: "DEACTIVATED" as never },
      });

      let cred: { id: string };
      if (deactivated) {
        cred = await db.studentCredential.update({
          where: { id: deactivated.id },
          data: { status: "ACTIVE" as never, issuedAt: new Date(), deactivatedAt: null, deactivatedReason: null },
        });
      } else {
        const { randomBytes: rb } = await import("crypto");
        const scanToken = rb(24).toString("base64url");
        cred = await db.studentCredential.create({
          data: {
            schoolId,
            studentId,
            type: "NFC_WRISTBAND" as never,
            credentialUID: tag.physicalUid,
            scanToken,
            status: "ACTIVE" as never,
            issuedAt: new Date(),
            issuedById: ctx.actorId ?? null,
          },
        });
      }
      credentialIds.push(cred.id);
    }

    // Update tag: ASSIGNED + link student
    const updated = await db.nfcTag.update({
      where: { id: tagId },
      data: { status: "ASSIGNED", studentId, assignedAt: new Date() },
      include: tagWithStudentInclude,
    });

    results.push(serializeTag(updated));
  }

  await auditTagAction(db, ctx, "nfc_tag.allocated", {
    count: results.length,
    credentialCount: credentialIds.length,
    reason: input.reason,
  });

  return { tags: results, credentialCount: credentialIds.length };
}
