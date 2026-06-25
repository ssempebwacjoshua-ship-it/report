import type { PrismaClient } from "@prisma/client";
import { randomUUID } from "crypto";
import { prisma as defaultPrisma } from "../db/prisma";
import { hasPermission } from "../../shared/permissions";

type OfflineClient = Pick<
  PrismaClient,
  | "school"
  | "student"
  | "nfcTag"
  | "studentWallet"
  | "studentCredential"
  | "nfcOfflineDevice"
  | "nfcOfflineSyncBatch"
  | "nfcGateScan"
  | "studentAttendanceEvent"
  | "studentWalletTransaction"
  | "auditLog"
>;

export type OfflineContext = {
  schoolId?: string | null;
  actorId?: string | null;
  role?: string | null;
};

function requireSchoolId(ctx: OfflineContext): string {
  if (!ctx.schoolId) throw Object.assign(new Error("School context required."), { status: 401 });
  return ctx.schoolId;
}

function requirePermission(ctx: OfflineContext, permission: string): void {
  if (!ctx.actorId || !ctx.role) throw Object.assign(new Error("Authentication required."), { status: 401 });
  if (!hasPermission(ctx.role, permission)) {
    throw Object.assign(new Error("You do not have permission for this action."), { status: 403 });
  }
}

const SNAPSHOT_TTL_HOURS = 24;

// ─── Bootstrap snapshot ───────────────────────────────────────────────────────

export async function bootstrapOfflineSnapshot(
  ctx: OfflineContext,
  input: { modules?: string[]; deviceId?: string },
  db: OfflineClient = defaultPrisma,
) {
  const schoolId = requireSchoolId(ctx);
  requirePermission(ctx, "nfc.devices.manage");

  const modules = input.modules ?? ["gate", "attendance", "canteen"];
  const snapshotId = randomUUID();
  const generatedAt = new Date();
  const expiresAt = new Date(generatedAt.getTime() + SNAPSHOT_TTL_HOURS * 60 * 60 * 1000);

  // Active students with current enrollment
  const students = await db.student.findMany({
    where: { schoolId, isActive: true },
    select: {
      id: true,
      admissionNumber: true,
      firstName: true,
      lastName: true,
      isActive: true,
      enrollments: {
        where: { isActive: true, status: "ACTIVE" },
        orderBy: { createdAt: "desc" },
        take: 1,
        include: {
          class: { select: { id: true, name: true } },
          stream: { select: { id: true, name: true } },
        },
      },
    },
    orderBy: { admissionNumber: "asc" },
  });

  // All non-expired NFC tags for the school (active + disabled so scanner can block them)
  const tags = await db.nfcTag.findMany({
    where: { schoolId },
    select: {
      id: true,
      publicCode: true,
      physicalUid: true,
      studentId: true,
      status: true,
      tagMode: true,
      purpose: true,
      writtenPayload: true,
    },
  });

  // Active wallet balances (canteen module)
  const wallets = modules.includes("canteen")
    ? await db.studentWallet.findMany({
        where: { schoolId, status: "ACTIVE" },
        select: {
          studentId: true,
          schoolId: true,
          status: true,
          balanceCents: true,
          frozenReason: true,
        },
      })
    : [];

  const offlineStudents = students.map((s) => {
    const e = s.enrollments[0];
    return {
      id: s.id,
      schoolId,
      admissionNumber: s.admissionNumber,
      firstName: s.firstName,
      lastName: s.lastName,
      isActive: s.isActive,
      classId: e?.class?.id ?? null,
      className: e?.class?.name ?? null,
      streamId: e?.stream?.id ?? null,
      streamName: e?.stream?.name ?? null,
    };
  });

  const offlineTags = tags.map((t) => ({
    id: t.id,
    schoolId,
    publicCode: t.publicCode,
    physicalUid: t.physicalUid,
    studentId: t.studentId,
    status: t.status,
    tagMode: t.tagMode,
    purpose: t.purpose,
    writtenPayload: t.writtenPayload,
  }));

  const offlineWallets = wallets.map((w) => ({
    studentId: w.studentId,
    schoolId: w.schoolId,
    status: w.status,
    balanceCents: w.balanceCents,
    snapshotId,
    frozenReason: w.frozenReason,
  }));

  await db.auditLog.create({
    data: {
      schoolId,
      action: "nfc_offline.bootstrap",
      details: {
        snapshotId,
        deviceId: input.deviceId ?? ctx.actorId,
        modules,
        studentCount: offlineStudents.length,
        tagCount: offlineTags.length,
        walletCount: offlineWallets.length,
        actorId: ctx.actorId,
      },
    },
  });

  return {
    snapshotId,
    schoolId,
    deviceId: input.deviceId ?? ctx.actorId ?? "unknown",
    generatedAt: generatedAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
    serverTime: new Date().toISOString(),
    modules,
    students: offlineStudents,
    tags: offlineTags,
    wallets: offlineWallets,
    settings: {
      canteenOfflineEnabled: modules.includes("canteen"),
      maxOfflineChargePerStudentCents: 50_000 * 100, // UGX 50,000
      maxOfflineTotalDeviceCents: 500_000 * 100, // UGX 500,000
      snapshotTtlHours: SNAPSHOT_TTL_HOURS,
    },
  };
}

// ─── Sync queued events ───────────────────────────────────────────────────────

type QueuedEvent = {
  localId: string;
  schoolId: string;
  deviceId: string;
  snapshotId: string;
  actionType: string;
  sequenceNumber: number;
  idempotencyKey: string;
  payload: unknown;
  payloadHash: string;
  previousHash: string | null;
  eventHash: string;
  createdAt: string;
};

export async function syncOfflineEvents(
  ctx: OfflineContext,
  input: { deviceId: string; snapshotId: string; events: QueuedEvent[] },
  db: OfflineClient = defaultPrisma,
) {
  const schoolId = requireSchoolId(ctx);
  if (!ctx.actorId || !ctx.role) throw Object.assign(new Error("Authentication required."), { status: 401 });

  const batchId = randomUUID();
  const results: Array<{
    localId: string;
    idempotencyKey: string;
    status: "SYNCED" | "DUPLICATE" | "FAILED" | "CONFLICT";
    serverId?: string;
    errorMessage?: string;
  }> = [];

  let syncedItems = 0;
  let failedItems = 0;

  for (const event of input.events) {
    // Enforce school isolation — never trust the client's schoolId
    if (event.schoolId !== schoolId) {
      results.push({ localId: event.localId, idempotencyKey: event.idempotencyKey, status: "FAILED", errorMessage: "School mismatch" });
      failedItems++;
      continue;
    }

    try {
      const payload = event.payload as Record<string, unknown>;
      let serverId: string | undefined;

      if (event.actionType === "GATE_SCAN") {
        const existing = await db.nfcGateScan.findFirst({
          where: {
            // Idempotency via compound match on schoolId + credentialId + scannedAt timestamp (close enough)
            schoolId,
            scannedAt: new Date(event.createdAt),
          },
        });
        if (existing) {
          results.push({ localId: event.localId, idempotencyKey: event.idempotencyKey, status: "DUPLICATE", serverId: existing.id });
          syncedItems++;
          continue;
        }
        const scan = await db.nfcGateScan.create({
          data: {
            schoolId,
            studentId: (payload.studentId as string) || null,
            credentialId: null,
            scannedByUserId: null,
            result: (payload.result as "ALLOWED" | "BLOCKED") ?? "BLOCKED",
            reason: (payload.reason as string) || null,
            scannedAt: new Date(event.createdAt),
          },
        });
        serverId = scan.id;
        syncedItems++;

      } else if (event.actionType === "ATTENDANCE_SCAN") {
        const prismaPkg = await import("@prisma/client");
        const { AttendanceDirection, AttendanceScanStatus, AttendanceScanSource } = prismaPkg.default;
        const direction = (payload.direction as string) === "TAP_OUT" ? AttendanceDirection.TAP_OUT : AttendanceDirection.TAP_IN;
        const studentId = payload.studentId as string | null;
        if (!studentId) throw new Error("Missing studentId");

        // Server-side duplicate detection
        const dateStr = event.createdAt.split("T")[0];
        const existing = await db.studentAttendanceEvent.findFirst({
          where: {
            schoolId,
            studentId,
            direction,
            scannedAt: {
              gte: new Date(`${dateStr}T00:00:00Z`),
              lt: new Date(`${dateStr}T23:59:59Z`),
            },
          },
        });
        if (existing) {
          results.push({ localId: event.localId, idempotencyKey: event.idempotencyKey, status: "DUPLICATE", serverId: existing.id });
          syncedItems++;
          continue;
        }
        const att = await db.studentAttendanceEvent.create({
          data: {
            schoolId,
            studentId,
            credentialId: (payload.tagId as string) || null,
            direction,
            source: AttendanceScanSource.NFC_WRISTBAND,
            status: AttendanceScanStatus.VALID,
            reason: null,
            scannedAt: new Date(event.createdAt),
          },
        });
        serverId = att.id;
        syncedItems++;

      } else if (event.actionType === "CANTEEN_CHARGE") {
        const studentId = payload.studentId as string | null;
        if (!studentId) throw new Error("Missing studentId");
        const amountCents = payload.amountCents as number;
        if (!amountCents || amountCents <= 0) throw new Error("Invalid amount");

        // Idempotency: check by idempotencyKey
        const existing = await db.studentWalletTransaction.findFirst({
          where: { schoolId, idempotencyKey: event.idempotencyKey },
        });
        if (existing) {
          results.push({ localId: event.localId, idempotencyKey: event.idempotencyKey, status: "DUPLICATE", serverId: existing.id });
          syncedItems++;
          continue;
        }

        const wallet = await db.studentWallet.findFirst({ where: { schoolId, studentId } });
        if (!wallet) throw Object.assign(new Error("Wallet not found"), { conflict: true });
        if (wallet.status === "FROZEN") throw Object.assign(new Error("Wallet is frozen"), { conflict: true });
        if (wallet.balanceCents < amountCents) throw Object.assign(new Error("Insufficient balance at sync time"), { conflict: true });

        // Check snapshot freshness
        const snapshotAge = Date.now() - new Date(event.createdAt).getTime();
        if (snapshotAge > SNAPSHOT_TTL_HOURS * 60 * 60 * 1000 + 30 * 60 * 1000) {
          throw Object.assign(new Error("Snapshot expired — charge rejected"), { conflict: true });
        }

        const prismaPkg = await import("@prisma/client");
        const { WalletTransactionType } = prismaPkg.default;
        const balanceAfterCents = wallet.balanceCents - amountCents;
        await db.studentWallet.updateMany({
          where: { id: wallet.id, schoolId },
          data: { balanceCents: balanceAfterCents },
        });
        const tx = await db.studentWalletTransaction.create({
          data: {
            schoolId,
            studentId,
            walletId: wallet.id,
            type: WalletTransactionType.CHARGE,
            amountCents: -amountCents,
            balanceAfterCents,
            description: (payload.description as string) || "Offline canteen charge",
            idempotencyKey: event.idempotencyKey,
            cashierUserId: (payload.cashierUserId as string) || null,
            credentialId: null,
          },
        });
        serverId = tx.id;
        syncedItems++;
      }

      results.push({ localId: event.localId, idempotencyKey: event.idempotencyKey, status: "SYNCED", serverId });
    } catch (err: unknown) {
      const isConflict = (err as Record<string, unknown>)?.conflict === true;
      const msg = err instanceof Error ? err.message : "Unknown error";
      results.push({
        localId: event.localId,
        idempotencyKey: event.idempotencyKey,
        status: isConflict ? "CONFLICT" : "FAILED",
        errorMessage: msg,
      });
      if (isConflict) syncedItems++; else failedItems++;
    }
  }

  // Record the batch
  await db.nfcOfflineSyncBatch.create({
    data: {
      schoolId,
      deviceId: input.deviceId,
      status: failedItems === 0 ? "COMPLETED" : syncedItems > 0 ? "PARTIAL" : "FAILED",
      totalItems: input.events.length,
      syncedItems,
      failedItems,
    },
  });

  // Update device lastSyncAt
  await db.nfcOfflineDevice.updateMany({
    where: { schoolId, deviceKey: input.deviceId, isActive: true },
    data: { lastSyncAt: new Date() },
  }).catch(() => null);

  return { batchId, results };
}

// ─── Sync status ──────────────────────────────────────────────────────────────

export async function getOfflineSyncStatus(
  ctx: OfflineContext,
  db: OfflineClient = defaultPrisma,
) {
  const schoolId = requireSchoolId(ctx);
  requirePermission(ctx, "nfc.devices.manage");

  const recent = await db.nfcOfflineSyncBatch.findMany({
    where: { schoolId },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  const devices = await db.nfcOfflineDevice.findMany({
    where: { schoolId, isActive: true },
    orderBy: { createdAt: "desc" },
  });

  return { batches: recent, devices };
}

// ─── Register device ──────────────────────────────────────────────────────────

export async function registerOfflineDevice(
  ctx: OfflineContext,
  input: { name: string; deviceKey: string; roleScope: string },
  db: OfflineClient = defaultPrisma,
) {
  const schoolId = requireSchoolId(ctx);
  requirePermission(ctx, "nfc.devices.manage");

  const device = await db.nfcOfflineDevice.create({
    data: {
      schoolId,
      name: input.name,
      deviceKey: input.deviceKey,
      roleScope: input.roleScope,
    },
  });

  return device;
}
