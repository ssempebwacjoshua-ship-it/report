import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSnapshotValidity: vi.fn(),
  getRetryableAttendanceQueueItems: vi.fn(),
  getRetryableCanteenQueueItems: vi.fn(),
  getRetryableGateQueueItems: vi.fn(),
  listPendingQueue: vi.fn(),
  markQueueItemSynced: vi.fn(),
  markQueueItemFailed: vi.fn(),
  markQueueItemConflict: vi.fn(),
}));

vi.mock("../../offline/offlineStatus", () => ({
  getSnapshotValidity: mocks.getSnapshotValidity,
}));

vi.mock("../../offline/offlineStore", () => ({
  getRetryableAttendanceQueueItems: mocks.getRetryableAttendanceQueueItems,
  getRetryableCanteenQueueItems: mocks.getRetryableCanteenQueueItems,
  getRetryableGateQueueItems: mocks.getRetryableGateQueueItems,
  listPendingQueue: mocks.listPendingQueue,
  markQueueItemSynced: mocks.markQueueItemSynced,
  markQueueItemFailed: mocks.markQueueItemFailed,
  markQueueItemConflict: mocks.markQueueItemConflict,
}));

function pendingCanteenEvent(index: number) {
  return {
    localId: `local-${index}`,
    schoolId: "school-a",
    deviceId: "device-a",
    snapshotId: "snapshot-1",
    actionType: "CANTEEN_CHARGE",
    sequenceNumber: index,
    idempotencyKey: `canteen:device-a:${index}`,
    payload: { studentId: `stu-${index}`, amountCents: 2000 },
    payloadHash: `hash-${index}`,
    previousHash: index > 1 ? `hash-${index - 1}` : null,
    eventHash: `event-hash-${index}`,
    createdAt: `2026-06-28T10:${String(index).padStart(2, "0")}:00.000Z`,
    syncStatus: "PENDING",
  };
}

describe("useConnectivityStatus", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers();
    mocks.getSnapshotValidity.mockResolvedValue({ valid: true, reason: undefined, diagnostics: {} });
    mocks.listPendingQueue.mockResolvedValue([]);
    mocks.getRetryableGateQueueItems.mockResolvedValue([]);
    mocks.getRetryableAttendanceQueueItems.mockResolvedValue([]);
    mocks.getRetryableCanteenQueueItems.mockResolvedValue([pendingCanteenEvent(1)]);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("does not schedule a new heartbeat timer after unmount while the first heartbeat is still pending", async () => {
    let resolveHeartbeat!: (value: Response) => void;
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/health/ping")) {
        return new Promise<Response>((resolve) => {
          resolveHeartbeat = resolve;
        });
      }
      throw new Error(`Unexpected fetch ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const { useConnectivityStatus } = await import("../../hooks/useConnectivityStatus");
    const { unmount } = renderHook(() => useConnectivityStatus("school-a", "device-a", "canteen"));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    unmount();

    await act(async () => {
      resolveHeartbeat(new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "Content-Type": "application/json" } }));
      await Promise.resolve();
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(24000);
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("stops polling after unmount once the timer has already been initialized", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/health/ping")) {
        return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      throw new Error(`Unexpected fetch ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const { useConnectivityStatus } = await import("../../hooks/useConnectivityStatus");
    const { unmount } = renderHook(() => useConnectivityStatus("school-a", "device-a", "canteen"));

    await act(async () => {
      await Promise.resolve();
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(12000);
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    unmount();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(36000);
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("keeps only the active instance polling during rapid mount and unmount cycles", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);

    const { useConnectivityStatus } = await import("../../hooks/useConnectivityStatus");
    const first = renderHook(() => useConnectivityStatus("school-a", "device-a", "canteen"));
    const second = renderHook(() => useConnectivityStatus("school-a", "device-a", "canteen"));

    first.unmount();

    await act(async () => {
      await Promise.resolve();
      await vi.advanceTimersByTimeAsync(12000);
    });

    const callsAfterSecondTick = fetchMock.mock.calls.length;
    second.unmount();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(24000);
    });

    expect(fetchMock.mock.calls.length).toBe(callsAfterSecondTick);
  });

  it("removes online and offline listeners on unmount", async () => {
    const addEventListenerSpy = vi.spyOn(window, "addEventListener");
    const removeEventListenerSpy = vi.spyOn(window, "removeEventListener");
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);

    const { useConnectivityStatus } = await import("../../hooks/useConnectivityStatus");
    const { unmount } = renderHook(() => useConnectivityStatus("school-a", "device-a", "canteen"));

    expect(addEventListenerSpy).toHaveBeenCalledWith("online", expect.any(Function));
    expect(addEventListenerSpy).toHaveBeenCalledWith("offline", expect.any(Function));

    unmount();

    expect(removeEventListenerSpy).toHaveBeenCalledWith("online", expect.any(Function));
    expect(removeEventListenerSpy).toHaveBeenCalledWith("offline", expect.any(Function));
  });

  it("triggers at most one sync for a single online event", async () => {
    let syncAttempts = 0;
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/health/ping")) {
        return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      if (url.includes("/api/nfc/offline/sync")) {
        syncAttempts += 1;
        return new Response(JSON.stringify({
          batchId: "batch-1",
          results: [
            { localId: "local-1", idempotencyKey: "canteen:device-a:1", status: "SYNCED", serverId: "tx-1" },
          ],
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      throw new Error(`Unexpected fetch ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const { useConnectivityStatus } = await import("../../hooks/useConnectivityStatus");
    renderHook(() => useConnectivityStatus("school-a", "device-a", "canteen"));

    await act(async () => {
      window.dispatchEvent(new Event("online"));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(syncAttempts).toBe(1);
    expect(mocks.markQueueItemSynced).toHaveBeenCalledWith("local-1", "tx-1");
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
      throw new Error(`Unexpected fetch ${url}`);
    });

    vi.stubGlobal("fetch", fetchMock);

    const { useConnectivityStatus } = await import("../../hooks/useConnectivityStatus");
    const { result } = renderHook(() => useConnectivityStatus("school-a", "device-a", "canteen"));

    await act(async () => {
      window.dispatchEvent(new Event("online"));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mocks.markQueueItemSynced).toHaveBeenCalledWith("local-1", "tx-1");
    expect(result.current.state).toBe("ONLINE");
  });

  it("retries a transient failed sync on the next healthy heartbeat", async () => {
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
      throw new Error(`Unexpected fetch ${url}`);
    });

    vi.stubGlobal("fetch", fetchMock);

    const { useConnectivityStatus } = await import("../../hooks/useConnectivityStatus");
    const { result } = renderHook(() => useConnectivityStatus("school-a", "device-a", "canteen"));

    await act(async () => {
      window.dispatchEvent(new Event("online"));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(syncAttempts).toBe(1);
    expect(result.current.state).toBe("SYNC_FAILED");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(12000);
      await Promise.resolve();
    });

    expect(syncAttempts).toBe(2);
    expect(mocks.markQueueItemSynced).toHaveBeenCalledWith("local-1", "tx-2");
    expect(result.current.state).toBe("ONLINE");
  });

  it("uses bounded sync batches even with a large pending queue", async () => {
    const largeQueue = Array.from({ length: 60 }, (_, index) => pendingCanteenEvent(index + 1));
    mocks.getRetryableCanteenQueueItems.mockResolvedValue(largeQueue);

    let syncedBody: { events: Array<{ localId: string }> } | null = null;
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/api/health/ping")) {
        return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      if (url.includes("/api/nfc/offline/sync")) {
        syncedBody = JSON.parse(String(init?.body));
        return new Response(JSON.stringify({
          batchId: "batch-bounded",
          results: syncedBody.events.map((event, index) => ({
            localId: event.localId,
            idempotencyKey: `canteen:device-a:${index + 1}`,
            status: "SYNCED",
            serverId: `tx-${index + 1}`,
          })),
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      throw new Error(`Unexpected fetch ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const { useConnectivityStatus } = await import("../../hooks/useConnectivityStatus");
    const { result } = renderHook(() => useConnectivityStatus("school-a", "device-a", "canteen"));

    await act(async () => {
      await result.current.triggerSync();
    });

    expect(syncedBody?.events).toHaveLength(25);
  });
});
