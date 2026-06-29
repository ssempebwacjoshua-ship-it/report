import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSnapshotValidity: vi.fn(),
  listPendingQueue: vi.fn(),
  listAllQueueItems: vi.fn(),
  markQueueItemSynced: vi.fn(),
  markQueueItemFailed: vi.fn(),
  markQueueItemConflict: vi.fn(),
}));

vi.mock("../../offline/offlineStatus", () => ({
  getSnapshotValidity: mocks.getSnapshotValidity,
}));

vi.mock("../../offline/offlineStore", () => ({
  listPendingQueue: mocks.listPendingQueue,
  listAllQueueItems: mocks.listAllQueueItems,
  markQueueItemSynced: mocks.markQueueItemSynced,
  markQueueItemFailed: mocks.markQueueItemFailed,
  markQueueItemConflict: mocks.markQueueItemConflict,
}));

describe("useConnectivityStatus", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  beforeEach(() => {
    vi.useRealTimers();
    vi.resetAllMocks();
    Object.defineProperty(navigator, "onLine", { configurable: true, value: false });
    mocks.getSnapshotValidity.mockResolvedValue({
      valid: true,
      reason: undefined,
      diagnostics: {},
    });
    mocks.listPendingQueue.mockResolvedValue([]);
    mocks.listAllQueueItems.mockResolvedValue([
      {
        localId: "local-1",
        schoolId: "school-a",
        deviceId: "device-a",
        snapshotId: "snapshot-1",
        actionType: "CANTEEN_CHARGE",
        sequenceNumber: 1,
        idempotencyKey: "canteen:device-a:1",
        payload: { studentId: "stu-1", amountCents: 2000 },
        payloadHash: "hash",
        previousHash: null,
        eventHash: "event-hash",
        createdAt: "2026-06-28T10:00:00.000Z",
        syncStatus: "PENDING",
      },
    ]);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  it("syncs queued offline actions immediately when the browser comes back online", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/health/ping")) {
        throw new Error("offline");
      }
      if (url.includes("/api/nfc/offline/sync")) {
        return new Response(JSON.stringify({
          batchId: "batch-1",
          results: [
            { localId: "local-1", idempotencyKey: "canteen:device-a:1", status: "SYNCED", serverId: "tx-1" },
          ],
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });

    vi.stubGlobal("fetch", fetchMock);

    const { useConnectivityStatus } = await import("../../hooks/useConnectivityStatus");
    const { result } = renderHook(() => useConnectivityStatus("school-a", "device-a", "canteen"));
    const syncCallCountBeforeOnline = fetchMock.mock.calls.filter(([input]) => String(input).includes("/api/nfc/offline/sync")).length;

    await act(async () => {
      await Promise.resolve();
      window.dispatchEvent(new Event("online"));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mocks.markQueueItemSynced).toHaveBeenCalledWith("local-1", "tx-1");
    expect(fetchMock.mock.calls.filter(([input]) => String(input).includes("/api/nfc/offline/sync")).length).toBe(syncCallCountBeforeOnline + 1);
    expect(fetchMock.mock.calls.some(([input]) => String(input).startsWith("http://localhost:4300/api/health/ping"))).toBe(true);
    expect(result.current.state).toBe("ONLINE");
  });

  it("retries a transient failed sync on the next healthy heartbeat", async () => {
    vi.useFakeTimers();
    let syncAttempts = 0;
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/health/ping")) {
        return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      if (url.includes("/api/nfc/offline/sync")) {
        syncAttempts += 1;
        if (syncAttempts === 1) {
          return new Response(JSON.stringify({ error: "temporary" }), { status: 503, headers: { "Content-Type": "application/json" } });
        }
        return new Response(JSON.stringify({
          batchId: "batch-2",
          results: [
            { localId: "local-1", idempotencyKey: "canteen:device-a:1", status: "SYNCED", serverId: "tx-2" },
          ],
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });

    vi.stubGlobal("fetch", fetchMock);

    const { useConnectivityStatus } = await import("../../hooks/useConnectivityStatus");
    const { result } = renderHook(() => useConnectivityStatus("school-a", "device-a", "canteen"));

    await act(async () => {
      window.dispatchEvent(new Event("online"));
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(syncAttempts).toBe(1);
    expect(result.current.state).toBe("SYNC_FAILED");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(12000);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mocks.markQueueItemSynced).toHaveBeenCalledWith("local-1", "tx-2");
    expect(syncAttempts).toBe(2);
    expect(result.current.state).toBe("ONLINE");
  });
});
