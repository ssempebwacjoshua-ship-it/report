import { beforeEach, describe, expect, it, vi } from "vitest";
import type { OfflineAttendanceEvent, OfflineBootstrapSnapshot, OfflineQueuedEvent, OfflineStudent, OfflineTag, OfflineWallet } from "../../offline/offlineTypes";

const dbState = vi.hoisted(() => ({
  meta: new Map<string, unknown>(),
  students: [] as OfflineStudent[],
  tags: [] as OfflineTag[],
  wallets: [] as OfflineWallet[],
  attendanceEvents: [] as OfflineAttendanceEvent[],
  syncQueue: [] as OfflineQueuedEvent[],
}));

function rowsFor(table: "students" | "tags" | "wallets" | "attendanceEvents" | "syncQueue") {
  if (table === "students") return dbState.students as unknown as Array<Record<string, unknown>>;
  if (table === "tags") return dbState.tags as unknown as Array<Record<string, unknown>>;
  if (table === "wallets") return dbState.wallets as unknown as Array<Record<string, unknown>>;
  if (table === "attendanceEvents") return dbState.attendanceEvents as unknown as Array<Record<string, unknown>>;
  return dbState.syncQueue as unknown as Array<Record<string, unknown>>;
}

function createWhere(table: "students" | "tags" | "wallets" | "attendanceEvents" | "syncQueue", index: string) {
  return {
    equals(value: unknown) {
      const matches = (row: Record<string, unknown>) => {
        if (Array.isArray(value) && index === "[schoolId+actionType+syncStatus]") {
          return row.schoolId === value[0] && row.actionType === value[1] && row.syncStatus === value[2];
        }
        if (Array.isArray(value) && index === "[schoolId+studentId+direction]") {
          return row.schoolId === value[0] && row.studentId === value[1] && row.direction === value[2];
        }
        return row[index] === value;
      };
      return {
        count: async () => rowsFor(table).filter(matches).length,
        delete: async () => {
          const kept = rowsFor(table).filter((row) => !matches(row));
          if (table === "students") dbState.students = kept as unknown as OfflineStudent[];
          if (table === "tags") dbState.tags = kept as unknown as OfflineTag[];
          if (table === "wallets") dbState.wallets = kept as unknown as OfflineWallet[];
        },
        filter(predicate: (row: Record<string, unknown>) => boolean) {
          return {
            first: async () => rowsFor(table).filter(matches).find(predicate) ?? null,
            toArray: async () => rowsFor(table).filter(matches).filter(predicate),
          };
        },
        first: async () => rowsFor(table).find(matches) ?? null,
        toArray: async () => rowsFor(table).filter(matches),
      };
    },
  };
}

vi.mock("../../offline/offlineDb", () => ({
  offlineDb: {
    transaction: async (_mode: string, ...args: unknown[]) => {
      const callback = args.at(-1) as () => Promise<void>;
      await callback();
    },
    offline_meta: {
      get: async (key: string) => dbState.meta.has(key) ? { key, value: dbState.meta.get(key) } : undefined,
      put: async ({ key, value }: { key: string; value: unknown }) => { dbState.meta.set(key, value); },
    },
    offline_students: {
      where: (index: string) => createWhere("students", index),
      bulkPut: async (rows: OfflineStudent[]) => {
        for (const row of rows) {
          dbState.students = dbState.students.filter((existing) => existing.id !== row.id);
          dbState.students.push(row);
        }
      },
    },
    offline_tags: {
      where: (index: string) => createWhere("tags", index),
      bulkPut: async (rows: OfflineTag[]) => {
        for (const row of rows) {
          dbState.tags = dbState.tags.filter((existing) => existing.id !== row.id);
          dbState.tags.push(row);
        }
      },
    },
    offline_wallets: {
      where: (index: string) => createWhere("wallets", index),
      bulkPut: async (rows: OfflineWallet[]) => { dbState.wallets.push(...rows); },
      update: async () => undefined,
    },
    offline_sync_queue: {
      where: (index: string) => createWhere("syncQueue", index),
      put: async (row: OfflineQueuedEvent) => { dbState.syncQueue.push(row); },
      update: async () => undefined,
    },
    offline_attendance_events: {
      where: (index: string) => createWhere("attendanceEvents", index),
      put: async (row: OfflineAttendanceEvent) => { dbState.attendanceEvents.push(row); },
      update: async () => undefined,
    },
    offline_gate_scans: { update: async () => undefined },
    offline_canteen_charges: { update: async () => undefined },
    offline_spend_ledger: { update: async () => undefined },
  },
}));

function makeAttendanceRegister(): OfflineBootstrapSnapshot {
  return {
    snapshotId: "attendance-register-1",
    snapshotVersion: "attendance-register-1",
    schoolId: "school-a",
    deviceId: "attendance-phone-1",
    mode: "ATTENDANCE",
    generatedAt: "2026-06-29T08:00:00.000Z",
    expiresAt: "2099-06-29T08:00:00.000Z",
    serverTime: "2026-06-29T08:00:00.000Z",
    modules: ["attendance"],
    students: [{
      id: "student-1",
      schoolId: "school-a",
      admissionNumber: "A001",
      firstName: "Ada",
      lastName: "Lovelace",
      isActive: true,
      classId: "class-1",
      className: "P4",
      streamId: "stream-1",
      streamName: "A",
    }],
    tags: [{
      id: "tag-1",
      schoolId: "school-a",
      publicCode: "PUB001",
      physicalUid: "UID001",
      studentId: "student-1",
      status: "ASSIGNED",
      tagMode: "WRISTBAND",
      purpose: "STUDENT",
      writtenPayload: null,
    }],
    wallets: [],
    settings: {
      gateOfflineEnabled: true,
      canteenOfflineEnabled: false,
      gateSnapshotValidHours: 24,
      canteenSnapshotValidHours: 12,
      maxOfflineSpendPerStudentPerDay: 3000,
      maxOfflineSpendPerTransaction: 3000,
      maxOfflineSpendPerDeviceSession: 100000,
      unknownCardOfflinePolicy: "DENY",
      frozenCardOfflinePolicy: "DENY",
      deactivatedCardOfflinePolicy: "DENY",
      offlineConflictPolicy: "ALLOW_AND_FLAG",
    },
  };
}

describe("Local Attendance Register", () => {
  beforeEach(() => {
    dbState.meta.clear();
    dbState.students = [];
    dbState.tags = [];
    dbState.wallets = [];
    dbState.attendanceEvents = [];
    dbState.syncQueue = [];
  });

  it("stores attendance students and hashed NFC lookup values", async () => {
    const { saveBootstrapSnapshot } = await import("../../offline/offlineStore");

    await saveBootstrapSnapshot(makeAttendanceRegister());

    expect(dbState.students).toHaveLength(1);
    expect(dbState.tags[0]?.publicCode).toBe("");
    expect(dbState.tags[0]?.physicalUid).toBeNull();
    expect(dbState.tags[0]?.publicCodeHash).toEqual(expect.any(String));
    expect(dbState.meta.has("snapshot:school-a:attendance-phone-1:ATTENDANCE")).toBe(true);
  });

  it("punches IN then OUT from local attendance events", async () => {
    const { getNextAttendanceDirection, queueAttendanceEvent } = await import("../../offline/offlineStore");

    await expect(getNextAttendanceDirection("school-a", "student-1", "2026-06-29")).resolves.toBe("TAP_IN");
    const queued = await queueAttendanceEvent({
      schoolId: "school-a",
      deviceId: "attendance-phone-1",
      snapshotId: "attendance-register-1",
      studentId: "student-1",
      direction: "TAP_IN",
      payload: {
        actionType: "ATTENDANCE_SCAN",
        tokenOrUidHash: "hash-token",
        studentId: "student-1",
        direction: "TAP_IN",
        status: "VALID",
        scannedAt: "2026-06-29T08:00:00.000Z",
      },
    });

    await expect(getNextAttendanceDirection("school-a", "student-1", queued.createdAt.slice(0, 10))).resolves.toBe("TAP_OUT");
  });

  it("prevents accidental duplicate punch within cooldown", async () => {
    const { hasRecentAttendancePunch, queueAttendanceEvent } = await import("../../offline/offlineStore");

    await queueAttendanceEvent({
      schoolId: "school-a",
      deviceId: "attendance-phone-1",
      snapshotId: "attendance-register-1",
      studentId: "student-1",
      direction: "TAP_IN",
      payload: {
        actionType: "ATTENDANCE_SCAN",
        tokenOrUidHash: "hash-token",
        studentId: "student-1",
        direction: "TAP_IN",
        status: "VALID",
        scannedAt: "2026-06-29T08:00:00.000Z",
      },
    });

    const createdAt = dbState.attendanceEvents[0]!.createdAt;
    await expect(hasRecentAttendancePunch("school-a", "student-1", "TAP_IN", new Date(new Date(createdAt).getTime() + 5000).toISOString())).resolves.toBe(true);
    await expect(hasRecentAttendancePunch("school-a", "student-1", "TAP_IN", new Date(new Date(createdAt).getTime() + 60000).toISOString())).resolves.toBe(false);
  });

  it("updates attendance register without wiping canteen local data or unsynced attendance events", async () => {
    dbState.wallets.push({
      id: "wallet-1",
      studentId: "canteen-student",
      schoolId: "school-a",
      status: "ACTIVE",
      balanceCents: 5000,
      snapshotId: "canteen-register",
      frozenReason: null,
    });
    dbState.syncQueue.push({
      localId: "attendance-pending-1",
      schoolId: "school-a",
      deviceId: "attendance-phone-1",
      snapshotId: "attendance-register-old",
      actionType: "ATTENDANCE_SCAN",
      sequenceNumber: 1,
      idempotencyKey: "attendance:1",
      payload: {},
      payloadHash: "hash",
      previousHash: null,
      eventHash: "event",
      createdAt: "2026-06-29T08:00:00.000Z",
      syncStatus: "PENDING",
    });
    const { saveBootstrapSnapshot } = await import("../../offline/offlineStore");

    await saveBootstrapSnapshot(makeAttendanceRegister());

    expect(dbState.wallets.some((wallet) => wallet.id === "wallet-1")).toBe(true);
    expect(dbState.syncQueue.some((item) => item.localId === "attendance-pending-1")).toBe(true);
  });
});
