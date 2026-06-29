import Dexie, { type Table } from "dexie";
import type {
  OfflineAttendanceEvent,
  OfflineCanteenCharge,
  OfflineGateScan,
  OfflineMeta,
  OfflineQueuedEvent,
  OfflineStudent,
  OfflineTag,
  OfflineWallet,
  OfflineSpendLedgerEntry,
} from "./offlineTypes";

class SchoolConnectOfflineDb extends Dexie {
  offline_meta!: Table<OfflineMeta, string>;
  offline_students!: Table<OfflineStudent, string>;
  offline_tags!: Table<OfflineTag, string>;
  offline_wallets!: Table<OfflineWallet, string>;
  offline_gate_scans!: Table<OfflineGateScan, string>;
  offline_attendance_events!: Table<OfflineAttendanceEvent, string>;
  offline_canteen_charges!: Table<OfflineCanteenCharge, string>;
  offline_spend_ledger!: Table<OfflineSpendLedgerEntry, string>;
  offline_sync_queue!: Table<OfflineQueuedEvent, string>;

  constructor() {
    super("SchoolConnectOfflineDb");

    this.version(1).stores({
      offline_meta:
        "key",

      offline_students:
        "id, schoolId, admissionNumber, classId, streamId, isActive, [schoolId+admissionNumber], [schoolId+classId+streamId]",

      offline_tags:
        "id, schoolId, publicCode, physicalUid, studentId, status, tagMode, [schoolId+publicCode], [schoolId+physicalUid], [schoolId+studentId]",

      offline_wallets:
        "studentId, schoolId, status, snapshotId, [schoolId+studentId]",

      offline_gate_scans:
        "localId, schoolId, deviceId, studentId, tagId, syncStatus, createdAt, idempotencyKey, [schoolId+syncStatus], [schoolId+createdAt]",

      offline_attendance_events:
        "localId, schoolId, deviceId, studentId, direction, syncStatus, createdAt, idempotencyKey, [schoolId+studentId+direction], [schoolId+syncStatus]",

      offline_canteen_charges:
        "localId, schoolId, deviceId, studentId, walletId, syncStatus, createdAt, idempotencyKey, [schoolId+studentId], [schoolId+syncStatus]",

      offline_spend_ledger:
        "localId, schoolId, deviceId, studentId, dateKey, syncStatus, createdAt, [schoolId+studentId+dateKey], [schoolId+syncStatus]",

      offline_sync_queue:
        "localId, schoolId, deviceId, actionType, syncStatus, createdAt, idempotencyKey, sequenceNumber, [schoolId+syncStatus], [schoolId+actionType+syncStatus]",
    });

    this.version(2).stores({
      offline_meta: "key",
      offline_students:
        "id, schoolId, admissionNumber, classId, streamId, isActive, [schoolId+admissionNumber], [schoolId+classId+streamId]",
      offline_tags:
        "id, schoolId, publicCode, physicalUid, studentId, status, tagMode, [schoolId+publicCode], [schoolId+physicalUid], [schoolId+studentId]",
      offline_wallets:
        "studentId, schoolId, status, snapshotId, [schoolId+studentId]",
      offline_gate_scans:
        "localId, schoolId, deviceId, studentId, tagId, syncStatus, createdAt, idempotencyKey, [schoolId+syncStatus], [schoolId+createdAt]",
      offline_attendance_events:
        "localId, schoolId, deviceId, studentId, direction, syncStatus, createdAt, idempotencyKey, [schoolId+studentId+direction], [schoolId+syncStatus]",
      offline_canteen_charges:
        "localId, schoolId, deviceId, studentId, walletId, syncStatus, createdAt, idempotencyKey, [schoolId+studentId], [schoolId+syncStatus]",
      offline_spend_ledger:
        "localId, schoolId, deviceId, studentId, dateKey, syncStatus, createdAt, [schoolId+studentId+dateKey], [schoolId+syncStatus]",
      offline_sync_queue:
        "localId, schoolId, deviceId, actionType, syncStatus, createdAt, idempotencyKey, sequenceNumber, [schoolId+syncStatus], [schoolId+actionType+syncStatus]",
    });

    this.version(3).stores({
      offline_meta: "key",
      offline_students:
        "id, schoolId, admissionNumber, classId, streamId, isActive, [schoolId+admissionNumber], [schoolId+classId+streamId]",
      offline_tags:
        "id, schoolId, publicCode, physicalUid, publicCodeHash, physicalUidHash, studentId, status, tagMode, [schoolId+publicCode], [schoolId+physicalUid], [schoolId+publicCodeHash], [schoolId+physicalUidHash], [schoolId+studentId]",
      offline_wallets:
        "studentId, schoolId, status, snapshotId, [schoolId+studentId]",
      offline_gate_scans:
        "localId, schoolId, deviceId, studentId, tagId, syncStatus, createdAt, idempotencyKey, [schoolId+syncStatus], [schoolId+createdAt]",
      offline_attendance_events:
        "localId, schoolId, deviceId, studentId, direction, syncStatus, createdAt, idempotencyKey, [schoolId+studentId+direction], [schoolId+syncStatus]",
      offline_canteen_charges:
        "localId, schoolId, deviceId, studentId, walletId, syncStatus, createdAt, idempotencyKey, [schoolId+studentId], [schoolId+syncStatus]",
      offline_spend_ledger:
        "localId, schoolId, deviceId, studentId, dateKey, syncStatus, createdAt, [schoolId+studentId+dateKey], [schoolId+syncStatus]",
      offline_sync_queue:
        "localId, schoolId, deviceId, actionType, syncStatus, createdAt, idempotencyKey, sequenceNumber, [schoolId+syncStatus], [schoolId+actionType+syncStatus]",
    });

    this.version(4).stores({
      offline_meta: "key",
      offline_students:
        "id, schoolId, admissionNumber, classId, streamId, isActive, [schoolId+admissionNumber], [schoolId+classId+streamId]",
      offline_tags:
        "id, schoolId, publicCode, physicalUid, publicCodeHash, physicalUidHash, studentId, status, tagMode, [schoolId+publicCode], [schoolId+physicalUid], [schoolId+publicCodeHash], [schoolId+physicalUidHash], [schoolId+studentId]",
      offline_wallets:
        "studentId, id, schoolId, status, snapshotId, [schoolId+studentId], [schoolId+id]",
      offline_gate_scans:
        "localId, schoolId, deviceId, studentId, tagId, syncStatus, createdAt, idempotencyKey, [schoolId+syncStatus], [schoolId+createdAt]",
      offline_attendance_events:
        "localId, schoolId, deviceId, studentId, direction, syncStatus, createdAt, idempotencyKey, [schoolId+studentId+direction], [schoolId+syncStatus]",
      offline_canteen_charges:
        "localId, schoolId, deviceId, studentId, walletId, syncStatus, createdAt, idempotencyKey, [schoolId+studentId], [schoolId+syncStatus]",
      offline_spend_ledger:
        "localId, schoolId, deviceId, studentId, dateKey, syncStatus, createdAt, [schoolId+studentId+dateKey], [schoolId+syncStatus]",
      offline_sync_queue:
        "localId, schoolId, deviceId, actionType, syncStatus, createdAt, idempotencyKey, sequenceNumber, [schoolId+syncStatus], [schoolId+actionType+syncStatus]",
    });
  }
}

export const offlineDb = new SchoolConnectOfflineDb();
