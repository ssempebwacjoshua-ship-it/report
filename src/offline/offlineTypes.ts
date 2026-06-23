// ─── Core sync types ──────────────────────────────────────────────────────────

export type OfflineSyncStatus =
  | "PENDING"
  | "SYNCING"
  | "SYNCED"
  | "FAILED"
  | "CONFLICT";

export type OfflineActionType =
  | "GATE_SCAN"
  | "ATTENDANCE_SCAN"
  | "CANTEEN_CHARGE";

// ─── IndexedDB table shapes ───────────────────────────────────────────────────

export interface OfflineMeta {
  key: string;
  value: unknown;
}

export interface OfflineStudent {
  id: string;
  schoolId: string;
  admissionNumber: string;
  firstName: string;
  lastName: string;
  isActive: boolean;
  classId: string | null;
  className: string | null;
  streamId: string | null;
  streamName: string | null;
}

export interface OfflineTag {
  id: string;
  schoolId: string;
  publicCode: string;
  physicalUid: string | null;
  studentId: string | null;
  status: string; // ASSIGNED | UNASSIGNED | DISABLED | LOST | etc.
  tagMode: string;
  purpose: string;
  writtenPayload: string | null;
}

export interface OfflineWallet {
  studentId: string;
  schoolId: string;
  status: string; // ACTIVE | FROZEN
  balanceCents: number;
  snapshotId: string;
  frozenReason: string | null;
}

// Base for all queued offline events (sits in offline_sync_queue)
export interface OfflineQueuedEvent {
  localId: string;
  schoolId: string;
  deviceId: string;
  snapshotId: string;
  actionType: OfflineActionType;
  sequenceNumber: number;
  idempotencyKey: string;
  payload: unknown;
  payloadHash: string;
  previousHash: string | null;
  eventHash: string;
  createdAt: string; // ISO string
  syncStatus: OfflineSyncStatus;
  serverId?: string;
  errorMessage?: string;
}

export interface OfflineGateScan extends OfflineQueuedEvent {
  studentId: string | null;
  tagId: string | null;
}

export interface OfflineAttendanceEvent extends OfflineQueuedEvent {
  studentId: string | null;
  direction: string; // TAP_IN | TAP_OUT
}

export interface OfflineCanteenCharge extends OfflineQueuedEvent {
  studentId: string | null;
  walletId: string | null;
}

// ─── Snapshot (sent from server bootstrap endpoint) ───────────────────────────

export interface OfflineBootstrapSnapshot {
  snapshotId: string;
  schoolId: string;
  deviceId: string;
  generatedAt: string;
  expiresAt: string;
  serverTime: string;
  modules: string[];
  students: OfflineStudent[];
  tags: OfflineTag[];
  wallets: OfflineWallet[];
  settings: {
    canteenOfflineEnabled: boolean;
    maxOfflineChargePerStudentCents: number;
    maxOfflineTotalDeviceCents: number;
    snapshotTtlHours: number;
  };
  signature?: string;
}

export interface OfflineSnapshotMeta {
  snapshotId: string;
  schoolId: string;
  deviceId: string;
  generatedAt: string;
  expiresAt: string;
  modules: string[];
  settings: OfflineBootstrapSnapshot["settings"];
}

// ─── Sync request / response ──────────────────────────────────────────────────

export interface OfflineSyncRequest {
  deviceId: string;
  snapshotId: string;
  events: OfflineQueuedEvent[];
}

export interface OfflineSyncItemResult {
  localId: string;
  idempotencyKey: string;
  status: "SYNCED" | "DUPLICATE" | "FAILED" | "CONFLICT";
  serverId?: string;
  errorMessage?: string;
}

export interface OfflineSyncResponse {
  batchId: string;
  results: OfflineSyncItemResult[];
}

// ─── Offline resolver return type ─────────────────────────────────────────────

export interface OfflineResolveResult {
  found: boolean;
  blocked: boolean;
  reason?: string;
  student?: OfflineStudent;
  tag?: OfflineTag;
  wallet?: OfflineWallet;
}
