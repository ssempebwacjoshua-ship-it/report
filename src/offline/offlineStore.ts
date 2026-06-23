// offlineStore — the ONLY way pages/hooks may access IndexedDB.
// Read-only snapshot tables (students/tags/wallets) are exposed as read functions only.
// Action tables (gate_scans, attendance_events, canteen_charges) are append-only through typed queue helpers.
// No page may import offlineDb directly.

import type {
  OfflineActionType,
  OfflineAttendanceEvent,
  OfflineBootstrapSnapshot,
  OfflineCanteenCharge,
  OfflineGateScan,
  OfflineQueuedEvent,
  OfflineSnapshotMeta,
  OfflineStudent,
  OfflineSyncStatus,
  OfflineTag,
  OfflineWallet,
} from "./offlineTypes";
import { offlineDb } from "./offlineDb";
import { createOfflineEventHash, hashPayload } from "./offlineHash";

// ─── Meta ─────────────────────────────────────────────────────────────────────

export async function getMeta<T>(key: string): Promise<T | undefined> {
  const row = await offlineDb.offline_meta.get(key);
  return row?.value as T | undefined;
}

async function setMeta(key: string, value: unknown): Promise<void> {
  await offlineDb.offline_meta.put({ key, value });
}

// ─── Sequence / chain tracking per device ────────────────────────────────────

async function nextSeq(deviceId: string): Promise<number> {
  const key = `seq:${deviceId}`;
  const n = ((await getMeta<number>(key)) ?? 0) + 1;
  await setMeta(key, n);
  return n;
}

async function getLastHash(deviceId: string): Promise<string | null> {
  return (await getMeta<string>(`lastHash:${deviceId}`)) ?? null;
}

async function saveLastHash(deviceId: string, hash: string): Promise<void> {
  await setMeta(`lastHash:${deviceId}`, hash);
}

// ─── Bootstrap snapshot ───────────────────────────────────────────────────────

export async function saveBootstrapSnapshot(snapshot: OfflineBootstrapSnapshot): Promise<void> {
  await offlineDb.transaction(
    "rw",
    offlineDb.offline_meta,
    offlineDb.offline_students,
    offlineDb.offline_tags,
    offlineDb.offline_wallets,
    async () => {
      await offlineDb.offline_students.where("schoolId").equals(snapshot.schoolId).delete();
      await offlineDb.offline_tags.where("schoolId").equals(snapshot.schoolId).delete();
      await offlineDb.offline_wallets.where("schoolId").equals(snapshot.schoolId).delete();

      if (snapshot.students.length) await offlineDb.offline_students.bulkPut(snapshot.students);
      if (snapshot.tags.length) await offlineDb.offline_tags.bulkPut(snapshot.tags);
      if (snapshot.wallets.length) await offlineDb.offline_wallets.bulkPut(snapshot.wallets);

      const meta: OfflineSnapshotMeta = {
        snapshotId: snapshot.snapshotId,
        schoolId: snapshot.schoolId,
        deviceId: snapshot.deviceId,
        generatedAt: snapshot.generatedAt,
        expiresAt: snapshot.expiresAt,
        modules: snapshot.modules,
        settings: snapshot.settings,
      };
      await setMeta("snapshot:current", meta);
    },
  );
}

export async function getSnapshotMeta(): Promise<OfflineSnapshotMeta | null> {
  return (await getMeta<OfflineSnapshotMeta>("snapshot:current")) ?? null;
}

// ─── Read-only snapshot lookups ───────────────────────────────────────────────

export async function getTagByScanValue(schoolId: string, normalizedValue: string): Promise<OfflineTag | null> {
  const byCode = await offlineDb.offline_tags
    .where("[schoolId+publicCode]")
    .equals([schoolId, normalizedValue])
    .first();
  if (byCode) return byCode;

  const byUid = await offlineDb.offline_tags
    .where("[schoolId+physicalUid]")
    .equals([schoolId, normalizedValue])
    .first();
  return byUid ?? null;
}

export async function getStudentById(schoolId: string, studentId: string): Promise<OfflineStudent | null> {
  const s = await offlineDb.offline_students.get(studentId);
  return s && s.schoolId === schoolId ? s : null;
}

export async function getOfflineWallet(schoolId: string, studentId: string): Promise<OfflineWallet | null> {
  const w = await offlineDb.offline_wallets.where("[schoolId+studentId]").equals([schoolId, studentId]).first();
  return w ?? null;
}

// ─── Canteen debit calculation (never mutates wallet) ────────────────────────

export async function getAvailableOfflineBalance(
  schoolId: string,
  deviceId: string,
  studentId: string,
  snapshotBalance: number,
): Promise<number> {
  const pending = await offlineDb.offline_canteen_charges
    .where("[schoolId+studentId]")
    .equals([schoolId, studentId])
    .filter((r) => r.deviceId === deviceId && (r.syncStatus === "PENDING" || r.syncStatus === "SYNCING"))
    .toArray();
  const spent = pending.reduce((sum, r) => sum + ((r.payload as { amountCents: number }).amountCents ?? 0), 0);
  return Math.max(0, snapshotBalance - spent);
}

// ─── Internal helper that builds + stores any queued event ───────────────────

async function buildAndQueue<T extends OfflineQueuedEvent>(
  schoolId: string,
  deviceId: string,
  snapshotId: string,
  actionType: OfflineActionType,
  payload: unknown,
  extra: Omit<T, keyof OfflineQueuedEvent>,
): Promise<T> {
  const localId = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  const sequenceNumber = await nextSeq(deviceId);
  const previousHash = await getLastHash(deviceId);
  const payloadHash = await hashPayload(payload);
  const eventHash = await createOfflineEventHash({ previousHash, payloadHash, deviceId, sequenceNumber, createdAt, actionType });
  const idempotencyKey = `${actionType.toLowerCase()}:${deviceId}:${sequenceNumber}`;

  const base: OfflineQueuedEvent = {
    localId,
    schoolId,
    deviceId,
    snapshotId,
    actionType,
    sequenceNumber,
    idempotencyKey,
    payload,
    payloadHash,
    previousHash,
    eventHash,
    createdAt,
    syncStatus: "PENDING",
  };

  const record = { ...base, ...extra } as T;
  await offlineDb.offline_sync_queue.put(record);
  await saveLastHash(deviceId, eventHash);
  return record;
}

// ─── Queue writers ────────────────────────────────────────────────────────────

export async function queueGateScan(input: {
  schoolId: string;
  deviceId: string;
  snapshotId: string;
  studentId: string | null;
  tagId: string | null;
  payload: {
    actionType: "GATE_SCAN";
    tokenOrUid: string;
    publicCode?: string | null;
    physicalUid?: string | null;
    studentId?: string | null;
    tagId?: string | null;
    result: string;
    reason?: string | null;
    scannedAt: string;
  };
}): Promise<OfflineGateScan> {
  const record = await buildAndQueue<OfflineGateScan>(
    input.schoolId, input.deviceId, input.snapshotId, "GATE_SCAN", input.payload,
    { studentId: input.studentId, tagId: input.tagId },
  );
  await offlineDb.offline_gate_scans.put(record);
  return record;
}

export async function queueAttendanceEvent(input: {
  schoolId: string;
  deviceId: string;
  snapshotId: string;
  studentId: string | null;
  direction: string;
  payload: {
    actionType: "ATTENDANCE_SCAN";
    tokenOrUid: string;
    studentId?: string | null;
    tagId?: string | null;
    direction: string;
    status: string;
    reason?: string | null;
    scannedAt: string;
  };
}): Promise<OfflineAttendanceEvent> {
  const record = await buildAndQueue<OfflineAttendanceEvent>(
    input.schoolId, input.deviceId, input.snapshotId, "ATTENDANCE_SCAN", input.payload,
    { studentId: input.studentId, direction: input.direction },
  );
  await offlineDb.offline_attendance_events.put(record);
  return record;
}

export async function queueCanteenCharge(input: {
  schoolId: string;
  deviceId: string;
  snapshotId: string;
  studentId: string;
  walletId: string | null;
  payload: {
    actionType: "CANTEEN_CHARGE";
    tokenOrUid: string;
    studentId: string;
    walletId: string | null;
    tagId?: string | null;
    amountCents: number;
    description?: string | null;
    cashierUserId: string;
    chargedAt: string;
  };
}): Promise<OfflineCanteenCharge> {
  const record = await buildAndQueue<OfflineCanteenCharge>(
    input.schoolId, input.deviceId, input.snapshotId, "CANTEEN_CHARGE", input.payload,
    { studentId: input.studentId, walletId: input.walletId },
  );
  await offlineDb.offline_canteen_charges.put(record);
  return record;
}

// ─── Queue status reads ───────────────────────────────────────────────────────

export async function listPendingQueue(schoolId: string): Promise<OfflineQueuedEvent[]> {
  return offlineDb.offline_sync_queue
    .where("[schoolId+syncStatus]")
    .equals([schoolId, "PENDING"])
    .toArray();
}

export async function listAllQueueItems(schoolId: string): Promise<OfflineQueuedEvent[]> {
  return offlineDb.offline_sync_queue.where("schoolId").equals(schoolId).sortBy("sequenceNumber");
}

// ─── Queue status mutations (server result applied here only) ─────────────────

async function patchQueueItem(localId: string, updates: Partial<OfflineQueuedEvent>): Promise<void> {
  await offlineDb.offline_sync_queue.update(localId, updates);
  // Best-effort update in the typed tables as well
  await offlineDb.offline_gate_scans.update(localId, updates).catch(() => null);
  await offlineDb.offline_attendance_events.update(localId, updates).catch(() => null);
  await offlineDb.offline_canteen_charges.update(localId, updates).catch(() => null);
}

export async function markQueueItemSynced(localId: string, serverId?: string): Promise<void> {
  const up: Partial<OfflineQueuedEvent> = { syncStatus: "SYNCED" };
  if (serverId) up.serverId = serverId;
  await patchQueueItem(localId, up);
}

export async function markQueueItemFailed(localId: string, errorMessage: string): Promise<void> {
  await patchQueueItem(localId, { syncStatus: "FAILED", errorMessage });
}

export async function markQueueItemConflict(localId: string, errorMessage: string): Promise<void> {
  await patchQueueItem(localId, { syncStatus: "CONFLICT", errorMessage });
}

export async function clearSyncedItems(schoolId: string): Promise<void> {
  const keys = await offlineDb.offline_sync_queue
    .where("[schoolId+syncStatus]")
    .equals([schoolId, "SYNCED"])
    .primaryKeys();
  await offlineDb.offline_sync_queue.bulkDelete(keys);
  await offlineDb.offline_gate_scans.bulkDelete(keys).catch(() => null);
  await offlineDb.offline_attendance_events.bulkDelete(keys).catch(() => null);
  await offlineDb.offline_canteen_charges.bulkDelete(keys).catch(() => null);
}

// ─── Offline attendance duplicate check ──────────────────────────────────────

export async function hasPendingAttendanceForDirection(
  schoolId: string,
  studentId: string,
  direction: string,
  date: string, // YYYY-MM-DD
): Promise<boolean> {
  const items = await offlineDb.offline_attendance_events
    .where("[schoolId+studentId+direction]")
    .equals([schoolId, studentId, direction])
    .filter((r) => r.createdAt.startsWith(date) && (r.syncStatus === "PENDING" || r.syncStatus === "SYNCED" || r.syncStatus === "SYNCING"))
    .count();
  return items > 0;
}
