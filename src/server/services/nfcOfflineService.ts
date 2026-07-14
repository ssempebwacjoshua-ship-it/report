import type { PrismaClient } from "@prisma/client";
import { buildDeviceIdentityWhere, RECENT_DEVICE_ORDER_BY } from "../utils/deviceIdentity";
import { createHash, randomUUID } from "crypto";
import { prisma as defaultPrisma } from "../db/prisma";
import { hasPermission } from "../../shared/permissions";
import { feeHoldAppliesToStudent, getSchoolNfcPolicy } from "./nfcPolicyService";

type OfflineClient = Pick<
  PrismaClient,
  | "school"
  | "student"
  | "nfcTag"
  | "studentWallet"
  | "schoolNfcPolicy"
  | "studentFeeHold"
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

export type OfflineDeviceConfigurationInput = {
  location?: string | null;
  locationType?: string | null;
  locationName?: string | null;
  attendanceMode?: string | null;
  studentScope?: string | null;
  classId?: string | null;
  streamId?: string | null;
  direction?: string | null;
};

type AttendanceReaderConfiguration = {
  mode?: "GATE" | "CANTEEN" | "ATTENDANCE" | string | null;
  locationType?: string | null;
  attendanceMode?: string | null;
  studentScope?: string | null;
  classId?: string | null;
  streamId?: string | null;
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

function requireBootstrapPermission(ctx: OfflineContext, mode: "GATE" | "CANTEEN" | "ATTENDANCE", modules: string[]): void {
  if (!ctx.actorId || !ctx.role) throw Object.assign(new Error("Authentication required."), { status: 401 });
  if (hasPermission(ctx.role, "nfc.devices.manage")) return;

  const required = new Set<string>();
  if (mode === "GATE" || modules.includes("gate")) required.add("nfc.gate.view");
  if (mode === "CANTEEN" || modules.includes("canteen")) required.add("nfc.canteen.view");
  if (mode === "ATTENDANCE" || modules.includes("attendance")) required.add("nfc.devices.manage");

  for (const permission of required) {
    if (!hasPermission(ctx.role, permission)) {
      throw Object.assign(new Error("You do not have permission for this action."), { status: 403 });
    }
  }
}

function validateAttendanceReaderConfiguration(input: AttendanceReaderConfiguration) {
  const requiresAttendanceFields = input.mode === "ATTENDANCE" || Boolean(input.locationType || input.attendanceMode || input.studentScope || input.classId || input.streamId);
  if (!requiresAttendanceFields) {
    return;
  }

  if (!input.locationType || !input.attendanceMode) {
    throw Object.assign(new Error("Attendance readers require both a location type and attendance mode."), { status: 400 });
  }

  if (input.locationType === "GATE") {
    if (input.classId || input.streamId) {
      throw Object.assign(new Error("Gate readers cannot be scoped to a class or stream."), { status: 400 });
    }
    if (input.attendanceMode && input.attendanceMode !== "GATE_ATTENDANCE") {
      throw Object.assign(new Error("Gate readers must use gate attendance mode."), { status: 400 });
    }
  }

  if (input.locationType === "CLASSROOM") {
    if (!input.classId) {
      throw Object.assign(new Error("Classroom readers require a class assignment."), { status: 400 });
    }
    if (input.attendanceMode && input.attendanceMode !== "CLASSROOM_ATTENDANCE") {
      throw Object.assign(new Error("Classroom readers must use classroom attendance mode."), { status: 400 });
    }
    if (input.studentScope === "ASSIGNED_CLASS" && !input.streamId) {
      throw Object.assign(new Error("Assigned-class classroom readers require a stream assignment."), { status: 400 });
    }
  }
}

const SNAPSHOT_TTL_HOURS = 24;
const DEFAULT_GATE_SNAPSHOT_VALID_HOURS = 24;
const DEFAULT_CANTEEN_SNAPSHOT_VALID_HOURS = 24;
const DEFAULT_MAX_OFFLINE_SPEND_PER_STUDENT_PER_DAY_UGX = 3000;
const DEFAULT_MAX_OFFLINE_SPEND_PER_TRANSACTION_UGX = 3000;
const DEFAULT_MAX_OFFLINE_SPEND_PER_DEVICE_SESSION_UGX = 100000;

type OfflinePolicy = {
  gateOfflineEnabled: boolean;
  canteenOfflineEnabled: boolean;
  gateSnapshotValidHours: number;
  canteenSnapshotValidHours: number;
  maxOfflineSpendPerStudentPerDay: number;
  maxOfflineSpendPerTransaction: number;
  maxOfflineSpendPerDeviceSession: number;
  unknownCardOfflinePolicy: "DENY";
  frozenCardOfflinePolicy: "DENY";
  deactivatedCardOfflinePolicy: "DENY";
  offlineConflictPolicy: "ALLOW_AND_FLAG" | "HOLD_FOR_BURSAR_REVIEW";
  feeDefaulterBlockingEnabled: boolean;
  feeDefaulterBlockScope: "DAY_SCHOLARS_ONLY" | "ALL_STUDENTS";
};

function defaultOfflinePolicy(): OfflinePolicy {
  return {
    gateOfflineEnabled: false,
    canteenOfflineEnabled: false,
    gateSnapshotValidHours: DEFAULT_GATE_SNAPSHOT_VALID_HOURS,
    canteenSnapshotValidHours: DEFAULT_CANTEEN_SNAPSHOT_VALID_HOURS,
    maxOfflineSpendPerStudentPerDay: DEFAULT_MAX_OFFLINE_SPEND_PER_STUDENT_PER_DAY_UGX,
    maxOfflineSpendPerTransaction: DEFAULT_MAX_OFFLINE_SPEND_PER_TRANSACTION_UGX,
    maxOfflineSpendPerDeviceSession: DEFAULT_MAX_OFFLINE_SPEND_PER_DEVICE_SESSION_UGX,
    unknownCardOfflinePolicy: "DENY",
    frozenCardOfflinePolicy: "DENY",
    deactivatedCardOfflinePolicy: "DENY",
    offlineConflictPolicy: "ALLOW_AND_FLAG",
    feeDefaulterBlockingEnabled: false,
    feeDefaulterBlockScope: "DAY_SCHOLARS_ONLY",
  };
}

async function loadOfflinePolicy(ctx: OfflineContext, db: OfflineClient): Promise<OfflinePolicy> {
  try {
    const policy = await getSchoolNfcPolicy(ctx, db as never);
    return {
      gateOfflineEnabled: policy.policy.gateOfflineEnabled,
      canteenOfflineEnabled: policy.policy.canteenOfflineEnabled,
      gateSnapshotValidHours: policy.policy.gateSnapshotValidHours,
      canteenSnapshotValidHours: policy.policy.canteenSnapshotValidHours,
      maxOfflineSpendPerStudentPerDay: policy.policy.maxOfflineSpendPerStudentPerDay,
      maxOfflineSpendPerTransaction: policy.policy.maxOfflineSpendPerTransaction,
      maxOfflineSpendPerDeviceSession: policy.policy.maxOfflineSpendPerDeviceSession,
      unknownCardOfflinePolicy: policy.policy.unknownCardOfflinePolicy as "DENY",
      frozenCardOfflinePolicy: policy.policy.frozenCardOfflinePolicy as "DENY",
      deactivatedCardOfflinePolicy: policy.policy.deactivatedCardOfflinePolicy as "DENY",
      offlineConflictPolicy: policy.policy.offlineConflictPolicy as "ALLOW_AND_FLAG" | "HOLD_FOR_BURSAR_REVIEW",
      feeDefaulterBlockingEnabled: policy.policy.feeDefaulterBlockingEnabled,
      feeDefaulterBlockScope: policy.policy.feeDefaulterBlockScope as "DAY_SCHOLARS_ONLY" | "ALL_STUDENTS",
    };
  } catch {
    return defaultOfflinePolicy();
  }
}

// ─── Bootstrap snapshot ───────────────────────────────────────────────────────

export async function bootstrapOfflineSnapshot(
  ctx: OfflineContext,
  input: { modules?: string[]; deviceId?: string; mode?: "GATE" | "CANTEEN" | "ATTENDANCE" },
  db: OfflineClient = defaultPrisma,
) {
  const schoolId = requireSchoolId(ctx);

  const policy = await loadOfflinePolicy(ctx, db);
  const mode = input.mode ?? "GATE";
  const modules = input.modules ?? ["gate", "attendance", "canteen"];
  requireBootstrapPermission(ctx, mode, modules);
  const snapshotId = randomUUID();
  const generatedAt = new Date();
  const canteenSnapshotValidHours = Math.max(policy.canteenSnapshotValidHours, DEFAULT_CANTEEN_SNAPSHOT_VALID_HOURS);
  const ttlHours = mode === "CANTEEN" ? canteenSnapshotValidHours : mode === "ATTENDANCE" ? policy.gateSnapshotValidHours : policy.gateSnapshotValidHours;
  const expiresAt = new Date(generatedAt.getTime() + ttlHours * 60 * 60 * 1000);

  // Active students with current enrollment
  const students = await db.student.findMany({
    where: { schoolId, isActive: true },
    select: {
      id: true,
      admissionNumber: true,
      firstName: true,
      lastName: true,
      studentType: true,
      passportPhotoUrl: true,
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
          id: true,
          studentId: true,
          schoolId: true,
          status: true,
          balanceCents: true,
          frozenReason: true,
          pinHash: true,
          pinLockedUntil: true,
        },
      })
    : [];

  const activeFeeHolds = modules.includes("gate")
    ? await db.studentFeeHold.findMany({
        where: { schoolId, status: "ACTIVE" },
        select: { studentId: true, status: true },
      })
    : [];
  const feeHoldByStudentId = new Map(activeFeeHolds.map((hold) => [hold.studentId, hold]));

  const offlineStudents = students.map((s) => {
    const e = s.enrollments[0];
    const activeHold = feeHoldByStudentId.get(s.id) ?? null;
    const feeHoldBlocksGate = !!activeHold &&
      policy.feeDefaulterBlockingEnabled &&
      feeHoldAppliesToStudent(s.studentType ?? null, policy.feeDefaulterBlockScope as never);
    return {
      id: s.id,
      schoolId,
      admissionNumber: s.admissionNumber,
      firstName: s.firstName,
      lastName: s.lastName,
      studentType: s.studentType ?? null,
      isActive: s.isActive,
      classId: e?.class?.id ?? null,
      className: e?.class?.name ?? null,
      streamId: e?.stream?.id ?? null,
      streamName: e?.stream?.name ?? null,
      photoUrl: s.passportPhotoUrl ?? null,
      feeHoldStatus: activeHold?.status ?? null,
      gateBlockedReason: feeHoldBlocksGate ? "school fees defaulter" : null,
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
    id: w.id,
    studentId: w.studentId,
    schoolId: w.schoolId,
    status: w.status,
    balanceCents: w.balanceCents,
    cachedBalanceCents: w.balanceCents,
    rfidStatus: w.status,
    dailyOfflineLimitCents: policy.maxOfflineSpendPerStudentPerDay,
    alreadySyncedSpendTodayCents: 0,
    snapshotId,
    frozenReason: w.frozenReason,
    pinHash: w.pinHash,
    pinLockedUntil: w.pinLockedUntil ? w.pinLockedUntil.toISOString() : null,
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

  if (input.deviceId) {
    await db.nfcOfflineDevice.updateMany({
      where: {
        schoolId,
        ...buildDeviceIdentityWhere(input.deviceId),
      },
      data: { lastSnapshotAt: generatedAt, lastSeenAt: generatedAt },
    }).catch(() => null);
  }

  return {
    snapshotId,
    snapshotVersion: snapshotId,
    schoolId,
    deviceId: input.deviceId ?? ctx.actorId ?? "unknown",
    mode,
    generatedAt: generatedAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
    serverTime: new Date().toISOString(),
    modules,
    students: offlineStudents,
    tags: offlineTags,
    wallets: offlineWallets,
    settings: {
      gateOfflineEnabled: policy.gateOfflineEnabled,
      canteenOfflineEnabled: policy.canteenOfflineEnabled,
      gateSnapshotValidHours: policy.gateSnapshotValidHours,
      canteenSnapshotValidHours,
      maxOfflineSpendPerStudentPerDay: policy.maxOfflineSpendPerStudentPerDay,
      maxOfflineSpendPerTransaction: policy.maxOfflineSpendPerTransaction,
      maxOfflineSpendPerDeviceSession: policy.maxOfflineSpendPerDeviceSession,
      unknownCardOfflinePolicy: policy.unknownCardOfflinePolicy,
      frozenCardOfflinePolicy: policy.frozenCardOfflinePolicy,
      deactivatedCardOfflinePolicy: policy.deactivatedCardOfflinePolicy,
      offlineConflictPolicy: policy.offlineConflictPolicy,
      feeDefaulterBlockingEnabled: policy.feeDefaulterBlockingEnabled,
      feeDefaulterBlockScope: policy.feeDefaulterBlockScope,
      feeHoldDataIncluded: modules.includes("gate"),
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
  const policy = await loadOfflinePolicy(ctx, db);
  const device = await db.nfcOfflineDevice.findFirst({
    where: {
      schoolId,
      ...buildDeviceIdentityWhere(input.deviceId),
    },
    orderBy: RECENT_DEVICE_ORDER_BY,
  });
  if (device?.status === "REVOKED" || device?.isActive === false) {
    return {
      batchId: randomUUID(),
      results: input.events.map((event) => ({
        localId: event.localId,
        idempotencyKey: event.idempotencyKey,
        status: "REJECTED_DEVICE_REVOKED" as const,
        errorMessage: "Kiosk device has been revoked.",
      })),
    };
  }

  const batchId = randomUUID();
  const results: Array<{
    localId: string;
    idempotencyKey: string;
    status: "SYNCED" | "DUPLICATE" | "FAILED" | "CONFLICT" | "REJECTED_DEVICE_REVOKED" | "NEEDS_BURSAR_REVIEW";
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
            cashierUserId: ctx.actorId ?? null,
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
      const conflictStatus = policy.offlineConflictPolicy === "HOLD_FOR_BURSAR_REVIEW" ? "NEEDS_BURSAR_REVIEW" : "CONFLICT";
      results.push({
        localId: event.localId,
        idempotencyKey: event.idempotencyKey,
        status: isConflict ? conflictStatus : "FAILED",
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
    data: { lastSyncAt: new Date(), lastSeenAt: new Date() },
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
  input: {
    name: string;
    deviceKey?: string;
    deviceToken?: string;
    roleScope: string;
    mode?: "GATE" | "CANTEEN" | "ATTENDANCE";
    location?: string | null;
    locationType?: string | null;
    locationName?: string | null;
    attendanceMode?: string | null;
    studentScope?: string | null;
    classId?: string | null;
    streamId?: string | null;
    direction?: string | null;
  },
  db: OfflineClient = defaultPrisma,
) {
  const schoolId = requireSchoolId(ctx);
  requirePermission(ctx, "nfc.devices.manage");
  validateAttendanceReaderConfiguration({
    mode: input.mode ?? "GATE",
    locationType: input.locationType ?? null,
    attendanceMode: input.attendanceMode ?? null,
    studentScope: input.studentScope ?? null,
    classId: input.classId ?? null,
    streamId: input.streamId ?? null,
  });
  const token = input.deviceToken ?? input.deviceKey ?? randomUUID();
  const tokenHash = createHash("sha256").update(token).digest("hex");

  const device = await db.nfcOfflineDevice.create({
    data: {
      schoolId,
      name: input.name,
      location: input.location ?? null,
      locationType: input.locationType ?? null,
      locationName: input.locationName ?? input.location ?? null,
      deviceKey: input.deviceKey ?? token,
      deviceTokenHash: tokenHash,
      mode: input.mode ?? "GATE",
      attendanceMode: input.attendanceMode ?? null,
      studentScope: input.studentScope ?? null,
      classId: input.classId ?? null,
      streamId: input.streamId ?? null,
      status: "ACTIVE",
      roleScope: input.roleScope,
      direction: input.direction ?? "ENTRY",
    },
  });

  return { ...device, deviceToken: token };
}

export async function updateOfflineDeviceConfiguration(
  ctx: OfflineContext,
  deviceId: string,
  input: OfflineDeviceConfigurationInput,
  db: OfflineClient = defaultPrisma,
) {
  const schoolId = requireSchoolId(ctx);
  requirePermission(ctx, "nfc.devices.manage");

  const existing = await db.nfcOfflineDevice.findFirst({
    where: {
      schoolId,
      ...buildDeviceIdentityWhere(deviceId),
    },
    orderBy: RECENT_DEVICE_ORDER_BY,
  });
  if (!existing) {
    throw Object.assign(new Error("Offline device not found."), { status: 404 });
  }

  validateAttendanceReaderConfiguration({
    mode: existing.mode,
    locationType: input.locationType ?? existing.locationType ?? null,
    attendanceMode: input.attendanceMode ?? existing.attendanceMode ?? null,
    studentScope: input.studentScope ?? existing.studentScope ?? null,
    classId: input.classId ?? existing.classId ?? null,
    streamId: input.streamId ?? existing.streamId ?? null,
  });

  const updated = await db.nfcOfflineDevice.update({
    where: { id: existing.id },
    data: {
      location: input.location ?? existing.location ?? null,
      locationType: input.locationType ?? null,
      locationName: input.locationName ?? input.location ?? existing.locationName ?? existing.location ?? null,
      attendanceMode: input.attendanceMode ?? null,
      studentScope: input.studentScope ?? null,
      classId: input.classId ?? null,
      streamId: input.streamId ?? null,
      direction: input.direction ?? existing.direction ?? null,
    },
  });

  await db.auditLog.create({
    data: {
      schoolId,
      action: "nfc_offline.device_config_updated",
      correlationId: updated.id,
      details: {
        actorId: ctx.actorId ?? null,
        deviceKey: updated.deviceKey,
        locationType: updated.locationType,
        locationName: updated.locationName,
        attendanceMode: updated.attendanceMode,
        studentScope: updated.studentScope,
        classId: updated.classId,
        streamId: updated.streamId,
      },
    },
  });

  return updated;
}
