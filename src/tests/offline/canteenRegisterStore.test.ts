import { beforeEach, describe, expect, it, vi } from "vitest";
import type { OfflineBootstrapSnapshot, OfflineQueuedEvent, OfflineWallet } from "../../offline/offlineTypes";

const dbState = vi.hoisted(() => ({
  meta: new Map<string, unknown>(),
  students: [] as unknown[],
  tags: [] as Array<Record<string, unknown>>,
  wallets: [] as Array<OfflineWallet>,
  syncQueue: [] as OfflineQueuedEvent[],
  canteenCharges: [] as unknown[],
  spendLedger: [] as unknown[],
}));

function createWhere(table: "students" | "tags" | "wallets" | "syncQueue", index: string) {
  return {
    equals(value: unknown) {
      const rows = () => {
        if (table === "students") return dbState.students as Array<Record<string, unknown>>;
        if (table === "tags") return dbState.tags;
        if (table === "wallets") return dbState.wallets as unknown as Array<Record<string, unknown>>;
        return dbState.syncQueue as unknown as Array<Record<string, unknown>>;
      };
      const matches = (row: Record<string, unknown>) => {
        if (Array.isArray(value) && index === "[schoolId+actionType+syncStatus]") {
          return row.schoolId === value[0] && row.actionType === value[1] && row.syncStatus === value[2];
        }
        if (Array.isArray(value) && index === "[schoolId+studentId+dateKey]") {
          return row.schoolId === value[0] && row.studentId === value[1] && row.dateKey === value[2];
        }
        if (Array.isArray(value) && index === "[schoolId+id]") {
          return row.schoolId === value[0] && row.id === value[1];
        }
        return row[index] === value;
      };
      return {
        count: async () => rows().filter(matches).length,
        delete: async () => {
          const kept = rows().filter((row) => !matches(row));
          if (table === "students") dbState.students = kept;
          if (table === "tags") dbState.tags = kept;
          if (table === "wallets") dbState.wallets = kept as unknown as OfflineWallet[];
        },
        filter(predicate: (row: Record<string, unknown>) => boolean) {
          return {
            first: async () => rows().filter(matches).find(predicate) ?? null,
            toArray: async () => rows().filter(matches).filter(predicate),
          };
        },
        first: async () => rows().find(matches) ?? null,
        toArray: async () => rows().filter(matches),
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
      bulkPut: async (rows: unknown[]) => { dbState.students.push(...rows); },
    },
    offline_tags: {
      where: (index: string) => createWhere("tags", index),
      bulkPut: async (rows: Array<Record<string, unknown>>) => { dbState.tags.push(...rows); },
    },
    offline_wallets: {
      where: (index: string) => createWhere("wallets", index),
      bulkPut: async (rows: OfflineWallet[]) => { dbState.wallets.push(...rows); },
      update: async (studentId: string, updates: Partial<OfflineWallet>) => {
        const wallet = dbState.wallets.find((row) => row.studentId === studentId);
        if (wallet) Object.assign(wallet, updates);
      },
    },
    offline_sync_queue: {
      where: (index: string) => createWhere("syncQueue", index),
      put: async (row: OfflineQueuedEvent) => { dbState.syncQueue.push(row); },
    },
    offline_canteen_charges: {
      put: async (row: unknown) => { dbState.canteenCharges.push(row); },
      update: async () => undefined,
    },
    offline_spend_ledger: {
      put: async (row: unknown) => { dbState.spendLedger.push(row); },
      update: async () => undefined,
      where: (index: string) => createWhere("syncQueue", index),
    },
    offline_gate_scans: { update: async () => undefined },
    offline_attendance_events: { update: async () => undefined },
  },
}));

function makeCanteenRegister(): OfflineBootstrapSnapshot {
  return {
    snapshotId: "register-1",
    snapshotVersion: "register-1",
    schoolId: "school-a",
    deviceId: "device-a",
    mode: "CANTEEN",
    generatedAt: "2026-06-28T10:00:00.000Z",
    expiresAt: "2099-06-28T10:00:00.000Z",
    serverTime: "2026-06-28T10:00:00.000Z",
    modules: ["canteen"],
    students: [],
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
    wallets: [{
      id: "wallet-1",
      studentId: "student-1",
      schoolId: "school-a",
      status: "ACTIVE",
      balanceCents: 5000,
      pinHash: "pbkdf2$100000$salt$hash",
      pinLockedUntil: null,
      snapshotId: "register-1",
      frozenReason: null,
    }],
    settings: {
      gateOfflineEnabled: false,
      canteenOfflineEnabled: true,
      gateSnapshotValidHours: 24,
      canteenSnapshotValidHours: 12,
      maxOfflineSpendPerStudentPerDay: 5000,
      maxOfflineSpendPerTransaction: 2000,
      maxOfflineSpendPerDeviceSession: 10000,
      unknownCardOfflinePolicy: "DENY",
      frozenCardOfflinePolicy: "DENY",
      deactivatedCardOfflinePolicy: "DENY",
      offlineConflictPolicy: "ALLOW_AND_FLAG",
    },
  };
}

describe("Local Canteen Register storage", () => {
  beforeEach(() => {
    dbState.meta.clear();
    dbState.students = [];
    dbState.tags = [];
    dbState.wallets = [];
    dbState.syncQueue = [];
    dbState.canteenCharges = [];
    dbState.spendLedger = [];
  });

  it("stores canteen NFC lookup values as hashes instead of raw payloads", async () => {
    const { saveBootstrapSnapshot } = await import("../../offline/offlineStore");

    await saveBootstrapSnapshot(makeCanteenRegister());

    expect(dbState.tags[0]?.publicCode).toBe("");
    expect(dbState.tags[0]?.physicalUid).toBeNull();
    expect(dbState.tags[0]?.publicCodeHash).toEqual(expect.any(String));
    expect(dbState.wallets[0]?.localStartingBalanceCents).toBe(5000);
    expect(dbState.wallets[0]?.pinHash).toBe("pbkdf2$100000$salt$hash");
    expect(dbState.meta.has("canteen-register:school-a:device-a")).toBe(true);
  });

  it("does not wipe existing gate or attendance offline data when saving a canteen register", async () => {
    dbState.students.push({ id: "gate-student", schoolId: "school-a", admissionNumber: "G001" });
    dbState.tags.push({ id: "gate-tag", schoolId: "school-a", publicCode: "GATE001", physicalUid: "GATEUID" });
    dbState.wallets.push({
      id: "gate-wallet",
      studentId: "gate-student",
      schoolId: "school-a",
      status: "ACTIVE",
      balanceCents: 1000,
      snapshotId: "gate-snapshot",
      frozenReason: null,
    });
    const { saveBootstrapSnapshot } = await import("../../offline/offlineStore");

    await saveBootstrapSnapshot(makeCanteenRegister());

    expect(dbState.students.some((row) => (row as { id?: string }).id === "gate-student")).toBe(true);
    expect(dbState.tags.some((row) => row.id === "gate-tag")).toBe(true);
    expect(dbState.wallets.some((row) => row.id === "gate-wallet")).toBe(true);
  });

  it("does not overwrite the register while canteen sales are pending", async () => {
    dbState.syncQueue.push({
      localId: "sale-1",
      schoolId: "school-a",
      deviceId: "device-a",
      snapshotId: "register-1",
      actionType: "CANTEEN_CHARGE",
      sequenceNumber: 1,
      idempotencyKey: "canteen:device-a:1",
      payload: {},
      payloadHash: "hash",
      previousHash: null,
      eventHash: "event",
      createdAt: "2026-06-28T10:00:00.000Z",
      syncStatus: "PENDING",
    });
    const { saveBootstrapSnapshot } = await import("../../offline/offlineStore");

    await expect(saveBootstrapSnapshot(makeCanteenRegister())).rejects.toThrow(/pending canteen sales/i);
  });

  it("reports failed canteen sales separately from normal pending sales", async () => {
    dbState.syncQueue.push({
      localId: "sale-1",
      schoolId: "school-a",
      deviceId: "device-a",
      snapshotId: "register-1",
      actionType: "CANTEEN_CHARGE",
      sequenceNumber: 1,
      idempotencyKey: "canteen:device-a:1",
      payload: {},
      payloadHash: "hash",
      previousHash: null,
      eventHash: "event",
      createdAt: "2026-06-28T10:00:00.000Z",
      syncStatus: "FAILED",
    });
    const { getCanteenSaleSyncSummary, hasPendingCanteenSales, saveBootstrapSnapshot } = await import("../../offline/offlineStore");

    await expect(hasPendingCanteenSales("school-a")).resolves.toBe(false);
    await expect(getCanteenSaleSyncSummary("school-a")).resolves.toMatchObject({ failed: 1, pending: 0 });
    await expect(saveBootstrapSnapshot(makeCanteenRegister())).rejects.toThrow(/reconciliation/i);
  });

  it("queues a local canteen sale without a raw NFC token and deducts local balance", async () => {
    const { queueCanteenCharge, saveBootstrapSnapshot } = await import("../../offline/offlineStore");
    await saveBootstrapSnapshot(makeCanteenRegister());

    await queueCanteenCharge({
      schoolId: "school-a",
      deviceId: "device-a",
      snapshotId: "register-1",
      studentId: "student-1",
      walletId: "wallet-1",
      payload: {
        actionType: "CANTEEN_CHARGE",
        tokenOrUidHash: "hashed-token",
        studentId: "student-1",
        walletId: "wallet-1",
        amountCents: 1200,
        pinVerified: true,
        pinVerifiedAt: "2026-06-28T10:10:00.000Z",
        description: "Lunch",
        cashierUserId: "cashier-1",
        chargedAt: "2026-06-28T10:10:00.000Z",
      },
    });

    expect((dbState.syncQueue[0]?.payload as { tokenOrUid?: string; tokenOrUidHash?: string }).tokenOrUid).toBeUndefined();
    expect((dbState.syncQueue[0]?.payload as { tokenOrUidHash?: string }).tokenOrUidHash).toBe("hashed-token");
    expect(dbState.wallets[0]?.localCurrentBalanceCents).toBe(3800);
  });
});
