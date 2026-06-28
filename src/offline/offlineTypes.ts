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

export type OfflineModule = "gate" | "attendance" | "canteen";
export type OfflineKioskMode = "GATE" | "CANTEEN" | "ATTENDANCE";
export type OfflineDeviceStatus = "ACTIVE" | "REVOKED";
export type OfflineConflictPolicy = "ALLOW_AND_FLAG" | "HOLD_FOR_BURSAR_REVIEW";

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
  studentType?: "DAY" | "BOARDING" | null;
  classId: string | null;
  className: string | null;
  streamId: string | null;
  streamName: string | null;
  photoUrl?: string | null;
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
  id: string;
  studentId: string;
  schoolId: string;
  status: string; // ACTIVE | FROZEN
  balanceCents: number;
  snapshotId: string;
  frozenReason: string | null;
  dailyOfflineLimitCents?: number;
  alreadySyncedSpendTodayCents?: number;
  cachedBalanceCents?: number;
  rfidStatus?: string;
  deactivated?: boolean;
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

export interface OfflineSpendLedgerEntry {
  localId: string;
  schoolId: string;
  deviceId: string;
  studentId: string;
  dateKey: string;
  amountCents: number;
  syncStatus: OfflineSyncStatus;
  createdAt: string;
}

// ─── Snapshot (sent from server bootstrap endpoint) ───────────────────────────

export interface OfflineBootstrapSnapshot {
  snapshotId: string;
  snapshotVersion: string;
  schoolId: string;
  deviceId: string;
  mode?: OfflineKioskMode;
  generatedAt: string;
  expiresAt: string;
  serverTime: string;
  modules: OfflineModule[];
  students: OfflineStudent[];
  tags: OfflineTag[];
  wallets: OfflineWallet[];
  settings: {
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
    offlineConflictPolicy: OfflineConflictPolicy;
  };
  signature?: string;
}

export interface OfflineSnapshotMeta {
  snapshotId: string;
  snapshotVersion: string;
  schoolId: string;
  deviceId: string;
  mode?: OfflineKioskMode;
  generatedAt: string;
  expiresAt: string;
  modules: OfflineModule[];
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
  status: "SYNCED" | "DUPLICATE" | "FAILED" | "CONFLICT" | "REJECTED_DEVICE_REVOKED" | "NEEDS_BURSAR_REVIEW";
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
