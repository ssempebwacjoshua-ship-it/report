import {
  createElement,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { getApiBaseUrl } from "../client/apiBase";
import { getSnapshotValidity } from "../offline/offlineStatus";
import {
  getRetryableAttendanceQueueItems,
  getRetryableCanteenQueueItems,
  getRetryableGateQueueItems,
  listPendingQueue,
  markQueueItemConflict,
  markQueueItemFailed,
  markQueueItemSynced,
} from "../offline/offlineStore";
import type { OfflineModule, OfflineQueuedEvent, OfflineSyncResponse } from "../offline/offlineTypes";

export type ConnectivityState =
  | "ONLINE"
  | "DEGRADED"
  | "OFFLINE_READY"
  | "OFFLINE_NOT_READY"
  | "SYNCING"
  | "SYNC_FAILED";

type ConnectivityController = {
  state: ConnectivityState;
  pendingCount: number;
  isOffline: boolean;
  isOfflineReady: boolean;
  refreshPendingCount: () => Promise<void>;
  triggerSync: (module?: OfflineModule) => Promise<void>;
};

const connectivityContext = createContext<ConnectivityController | null>(null);

const HEARTBEAT_PATH = "/api/health/ping";
const HEARTBEAT_INTERVAL_MS = 12000;
const HEARTBEAT_TIMEOUT_MS = 5000;
const SYNC_TIMEOUT_MS = 30000;
const SYNC_BATCH_SIZE = 25;
const DEGRADED_THRESHOLD = 1;
const OFFLINE_THRESHOLD = 3;

function modeForModule(module?: OfflineModule) {
  if (module === "gate") return "GATE" as const;
  if (module === "canteen") return "CANTEEN" as const;
  if (module === "attendance") return "ATTENDANCE" as const;
  return undefined;
}

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
}

function clearWindowTimer(ref: React.MutableRefObject<number | null>) {
  if (ref.current !== null) {
    window.clearTimeout(ref.current);
    ref.current = null;
  }
}

function dedupeAndSortQueueItems(groups: OfflineQueuedEvent[][]) {
  const unique = new Map<string, OfflineQueuedEvent>();
  for (const group of groups) {
    for (const item of group) {
      if (!unique.has(item.localId)) unique.set(item.localId, item);
    }
  }

  return Array.from(unique.values()).sort((a, b) => a.sequenceNumber - b.sequenceNumber);
}

function updateConnectivityDiagnostics(partial: Partial<{
  coordinatorCount: number;
  activeHeartbeatTimerCount: number;
  syncInFlight: boolean;
}>) {
  if (!import.meta.env.DEV || typeof window === "undefined") return;

  const win = window as Window & {
    __SC_CONNECTIVITY_DIAGNOSTICS__?: {
      coordinatorCount: number;
      activeHeartbeatTimerCount: number;
      syncInFlight: boolean;
    };
  };

  win.__SC_CONNECTIVITY_DIAGNOSTICS__ = {
    coordinatorCount: partial.coordinatorCount ?? win.__SC_CONNECTIVITY_DIAGNOSTICS__?.coordinatorCount ?? 0,
    activeHeartbeatTimerCount: partial.activeHeartbeatTimerCount ?? win.__SC_CONNECTIVITY_DIAGNOSTICS__?.activeHeartbeatTimerCount ?? 0,
    syncInFlight: partial.syncInFlight ?? win.__SC_CONNECTIVITY_DIAGNOSTICS__?.syncInFlight ?? false,
  };
}

function useConnectivityController(schoolId?: string, deviceId?: string, enabled = true): ConnectivityController {
  const [state, setState] = useState<ConnectivityState>("ONLINE");
  const [pendingCount, setPendingCount] = useState(0);

  const cancelledRef = useRef(false);
  const failedRef = useRef(0);
  const stateRef = useRef<ConnectivityState>("ONLINE");
  const syncingRef = useRef(false);
  const heartbeatTimerRef = useRef<number | null>(null);
  const heartbeatAbortRef = useRef<AbortController | null>(null);
  const heartbeatTimeoutRef = useRef<number | null>(null);
  const syncAbortRef = useRef<AbortController | null>(null);
  const syncTimeoutRef = useRef<number | null>(null);

  const updateState = useCallback((next: ConnectivityState) => {
    if (cancelledRef.current) return;
    stateRef.current = next;
    setState(next);
  }, []);

  const refreshPendingCount = useCallback(async () => {
    if (!schoolId || cancelledRef.current) return;
    try {
      const pending = await listPendingQueue(schoolId);
      if (cancelledRef.current) return;
      setPendingCount(pending.length);
    } catch {
      // IndexedDB unavailable - ignore
    }
  }, [schoolId]);

  const loadPendingBatch = useCallback(async (requiredModule?: OfflineModule) => {
    if (!schoolId) return [];

    const groups = requiredModule === "canteen"
      ? [await getRetryableCanteenQueueItems(schoolId)]
      : requiredModule === "attendance"
        ? [await getRetryableAttendanceQueueItems(schoolId)]
        : requiredModule === "gate"
          ? [await getRetryableGateQueueItems(schoolId)]
          : await Promise.all([
              getRetryableGateQueueItems(schoolId),
              getRetryableAttendanceQueueItems(schoolId),
              getRetryableCanteenQueueItems(schoolId),
            ]);

    return dedupeAndSortQueueItems(groups).slice(0, SYNC_BATCH_SIZE);
  }, [schoolId]);

  const runSync = useCallback(async (requiredModule?: OfflineModule) => {
    if (!schoolId || !deviceId || syncingRef.current || cancelledRef.current) return;

    syncingRef.current = true;
    updateConnectivityDiagnostics({ syncInFlight: true });
    updateState("SYNCING");

    syncAbortRef.current?.abort();
    clearWindowTimer(syncTimeoutRef);

    const controller = new AbortController();
    syncAbortRef.current = controller;
    syncTimeoutRef.current = window.setTimeout(() => controller.abort(), SYNC_TIMEOUT_MS);

    try {
      const pending = await loadPendingBatch(requiredModule);
      if (cancelledRef.current || controller.signal.aborted) return;

      if (pending.length === 0) {
        updateState("ONLINE");
        return;
      }

      const token = localStorage.getItem("sc_auth_token");
      const snapshotId = pending[0]?.snapshotId ?? "";
      const body = JSON.stringify({ deviceId, snapshotId, events: pending });
      const res = await fetch(`${getApiBaseUrl()}/api/nfc/offline/sync`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body,
        signal: controller.signal,
      });

      if (!res.ok) throw new Error(`Sync HTTP ${res.status}`);

      const data = (await res.json()) as OfflineSyncResponse;
      if (cancelledRef.current || controller.signal.aborted) return;

      let anyFailed = false;
      for (const result of data.results) {
        if (result.status === "SYNCED" || result.status === "DUPLICATE") {
          await markQueueItemSynced(result.localId, result.serverId);
          continue;
        }

        if (result.status === "CONFLICT" || result.status === "NEEDS_BURSAR_REVIEW") {
          await markQueueItemConflict(result.localId, result.errorMessage ?? "Conflict");
          anyFailed = true;
          continue;
        }

        if (result.status === "REJECTED_DEVICE_REVOKED") {
          await markQueueItemFailed(result.localId, result.errorMessage ?? "Device revoked");
          anyFailed = true;
          continue;
        }

        await markQueueItemFailed(result.localId, result.errorMessage ?? "Server rejected");
        anyFailed = true;
      }

      await refreshPendingCount();
      if (cancelledRef.current || controller.signal.aborted) return;
      updateState(anyFailed ? "SYNC_FAILED" : "ONLINE");
    } catch (error) {
      if (isAbortError(error)) return;
      console.error("[offline-sync]", error);
      if (!cancelledRef.current) updateState("SYNC_FAILED");
    } finally {
      if (syncAbortRef.current === controller) syncAbortRef.current = null;
      clearWindowTimer(syncTimeoutRef);
      syncingRef.current = false;
      updateConnectivityDiagnostics({ syncInFlight: false });
    }
  }, [deviceId, loadPendingBatch, refreshPendingCount, schoolId, updateState]);

  const heartbeat = useCallback(async () => {
    if (cancelledRef.current) return;

    heartbeatAbortRef.current?.abort();
    clearWindowTimer(heartbeatTimeoutRef);

    const controller = new AbortController();
    heartbeatAbortRef.current = controller;
    heartbeatTimeoutRef.current = window.setTimeout(() => controller.abort(), HEARTBEAT_TIMEOUT_MS);

    try {
      const res = await fetch(`${getApiBaseUrl()}${HEARTBEAT_PATH}`, {
        method: "GET",
        cache: "no-store",
        signal: controller.signal,
      });
      if (!res.ok) throw new Error("ping failed");
      if (cancelledRef.current || controller.signal.aborted) return;

      failedRef.current = 0;
      const previous = stateRef.current;

      if (previous === "OFFLINE_READY" || previous === "OFFLINE_NOT_READY" || previous === "SYNC_FAILED") {
        await runSync();
        if (cancelledRef.current || controller.signal.aborted) return;
      }

      if (stateRef.current !== "SYNCING") updateState("ONLINE");
    } catch (error) {
      if (isAbortError(error)) return;

      failedRef.current += 1;
      const failures = failedRef.current;
      const previous = stateRef.current;

      if (previous === "ONLINE" || previous === "DEGRADED" || previous === "SYNC_FAILED") {
        if (failures === DEGRADED_THRESHOLD) {
          updateState("DEGRADED");
        } else if (failures >= OFFLINE_THRESHOLD) {
          const validity = await getSnapshotValidity({ schoolId, deviceId, requiredModule: undefined, mode: modeForModule(undefined) });
          if (cancelledRef.current || controller.signal.aborted) return;
          updateState(validity.valid ? "OFFLINE_READY" : "OFFLINE_NOT_READY");
        }
      }
    } finally {
      if (heartbeatAbortRef.current === controller) heartbeatAbortRef.current = null;
      clearWindowTimer(heartbeatTimeoutRef);
      await refreshPendingCount();
    }
  }, [deviceId, refreshPendingCount, runSync, schoolId, updateState]);

  useEffect(() => {
    if (!enabled) return;

    cancelledRef.current = false;
    updateConnectivityDiagnostics({
      coordinatorCount:
        ((window as Window & { __SC_CONNECTIVITY_DIAGNOSTICS__?: { coordinatorCount: number } })
          .__SC_CONNECTIVITY_DIAGNOSTICS__?.coordinatorCount ?? 0) + 1,
    });

    const scheduleNextTick = () => {
      if (cancelledRef.current) return;
      clearWindowTimer(heartbeatTimerRef);
      heartbeatTimerRef.current = window.setTimeout(() => {
        void tick();
      }, HEARTBEAT_INTERVAL_MS);
      updateConnectivityDiagnostics({ activeHeartbeatTimerCount: heartbeatTimerRef.current === null ? 0 : 1 });
    };

    const tick = async () => {
      if (cancelledRef.current) return;
      await heartbeat();
      if (cancelledRef.current) return;
      scheduleNextTick();
    };

    const handleOnline = () => {
      if (cancelledRef.current) return;
      failedRef.current = 0;
      void runSync();
    };

    const handleOffline = () => {
      if (cancelledRef.current) return;
      failedRef.current = Math.max(failedRef.current, DEGRADED_THRESHOLD);
      if (stateRef.current === "ONLINE") updateState("DEGRADED");
    };

    void tick();
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      cancelledRef.current = true;
      clearWindowTimer(heartbeatTimerRef);
      clearWindowTimer(heartbeatTimeoutRef);
      clearWindowTimer(syncTimeoutRef);
      heartbeatAbortRef.current?.abort();
      syncAbortRef.current?.abort();
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      updateConnectivityDiagnostics({
        coordinatorCount: Math.max(
          0,
          ((window as Window & { __SC_CONNECTIVITY_DIAGNOSTICS__?: { coordinatorCount: number } })
            .__SC_CONNECTIVITY_DIAGNOSTICS__?.coordinatorCount ?? 1) - 1,
        ),
        activeHeartbeatTimerCount: 0,
        syncInFlight: false,
      });
    };
  }, [enabled, heartbeat, runSync, updateState]);

  return {
    state,
    pendingCount,
    isOffline: state === "OFFLINE_READY" || state === "OFFLINE_NOT_READY",
    isOfflineReady: state === "OFFLINE_READY",
    refreshPendingCount,
    triggerSync: runSync,
  };
}

export function ConnectivityProvider({
  children,
  schoolId,
  deviceId,
}: {
  children: ReactNode;
  schoolId?: string;
  deviceId?: string;
}) {
  const controller = useConnectivityController(schoolId, deviceId);

  return createElement(connectivityContext.Provider, { value: controller }, children);
}

export function useConnectivityStatus(schoolId?: string, deviceId?: string, requiredModule?: OfflineModule) {
  const shared = useContext(connectivityContext);
  const local = useConnectivityController(shared ? undefined : schoolId, shared ? undefined : deviceId, !shared);
  const controller = shared ?? local;

  return useMemo(() => ({
    state: controller.state,
    pendingCount: controller.pendingCount,
    isOffline: controller.isOffline,
    isOfflineReady: controller.isOfflineReady,
    refreshPendingCount: controller.refreshPendingCount,
    triggerSync: () => controller.triggerSync(requiredModule),
  }), [controller, requiredModule]);
}
