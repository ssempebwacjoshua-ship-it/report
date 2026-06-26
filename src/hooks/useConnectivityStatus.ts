import { useCallback, useEffect, useRef, useState } from "react";
import { isSnapshotValid } from "../offline/offlineStatus";
import { listPendingQueue, listAllQueueItems, markQueueItemSynced, markQueueItemFailed, markQueueItemConflict } from "../offline/offlineStore";
import type { OfflineSyncResponse } from "../offline/offlineTypes";
import { getApiBaseUrl } from "../client/apiBase";
import type { OfflineModule } from "../offline/offlineTypes";

export type ConnectivityState =
  | "ONLINE"
  | "DEGRADED"
  | "OFFLINE_READY"
  | "OFFLINE_NOT_READY"
  | "SYNCING"
  | "SYNC_FAILED";

const HEARTBEAT_URL = "/api/health/ping";
const HEARTBEAT_INTERVAL_MS = 12000;
const DEGRADED_THRESHOLD = 1;
const OFFLINE_THRESHOLD = 3;

export function useConnectivityStatus(schoolId?: string, deviceId?: string, requiredModule?: OfflineModule) {
  const [state, setState] = useState<ConnectivityState>("ONLINE");
  const [pendingCount, setPendingCount] = useState(0);
  const failedRef = useRef(0);
  const stateRef = useRef<ConnectivityState>("ONLINE");
  const syncingRef = useRef(false);

  const updateState = useCallback((next: ConnectivityState) => {
    stateRef.current = next;
    setState(next);
  }, []);

  const refreshPendingCount = useCallback(async () => {
    if (!schoolId) return;
    try {
      const pending = await listPendingQueue(schoolId);
      setPendingCount(pending.length);
    } catch {
      // IndexedDB unavailable — ignore
    }
  }, [schoolId]);

  const runSync = useCallback(async () => {
    if (!schoolId || !deviceId || syncingRef.current) return;
    syncingRef.current = true;
    updateState("SYNCING");

    try {
      const all = await listAllQueueItems(schoolId);
      const pending = all.filter((e) => e.syncStatus === "PENDING");
      if (pending.length === 0) {
        updateState("ONLINE");
        syncingRef.current = false;
        return;
      }

      const snapshotId = pending[0]?.snapshotId ?? "";
      const body = JSON.stringify({ deviceId, snapshotId, events: pending });
      const token = localStorage.getItem("sc_auth_token");
      const res = await fetch(`${getApiBaseUrl()}/api/nfc/offline/sync`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body,
        signal: AbortSignal.timeout(30000),
      });

      if (!res.ok) throw new Error(`Sync HTTP ${res.status}`);

      const data = (await res.json()) as OfflineSyncResponse;
      let anyFailed = false;

      for (const r of data.results) {
        if (r.status === "SYNCED" || r.status === "DUPLICATE") {
          await markQueueItemSynced(r.localId, r.serverId);
        } else if (r.status === "CONFLICT") {
          await markQueueItemConflict(r.localId, r.errorMessage ?? "Conflict");
          anyFailed = true;
        } else {
          await markQueueItemFailed(r.localId, r.errorMessage ?? "Server rejected");
          anyFailed = true;
        }
      }

      await refreshPendingCount();
      updateState(anyFailed ? "SYNC_FAILED" : "ONLINE");
    } catch (err) {
      console.error("[offline-sync]", err);
      updateState("SYNC_FAILED");
    } finally {
      syncingRef.current = false;
    }
  }, [schoolId, deviceId, updateState, refreshPendingCount]);

  const heartbeat = useCallback(async () => {
    try {
      const res = await fetch(HEARTBEAT_URL, {
        method: "GET",
        cache: "no-store",
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) throw new Error("ping failed");

      failedRef.current = 0;
      const prev = stateRef.current;

      if (prev === "OFFLINE_READY" || prev === "OFFLINE_NOT_READY") {
        // Back online — auto-sync
        void runSync();
      } else if (prev !== "SYNCING" && prev !== "SYNC_FAILED") {
        updateState("ONLINE");
      }
    } catch {
      failedRef.current += 1;
      const failures = failedRef.current;
      const prev = stateRef.current;

      if (prev === "ONLINE" || prev === "DEGRADED" || prev === "SYNC_FAILED") {
        if (failures === DEGRADED_THRESHOLD) {
          updateState("DEGRADED");
        } else if (failures >= OFFLINE_THRESHOLD) {
          const valid = await isSnapshotValid({ schoolId, requiredModule });
          updateState(valid ? "OFFLINE_READY" : "OFFLINE_NOT_READY");
        }
      }
    }

    await refreshPendingCount();
  }, [schoolId, requiredModule, updateState, refreshPendingCount, runSync]);

  useEffect(() => {
    let timer: ReturnType<typeof setInterval>;
    async function init() {
      await heartbeat();
      timer = setInterval(() => { void heartbeat(); }, HEARTBEAT_INTERVAL_MS);
    }
    void init();
    return () => clearInterval(timer);
  }, [heartbeat]);

  return {
    state,
    pendingCount,
    isOffline: state === "OFFLINE_READY" || state === "OFFLINE_NOT_READY",
    isOfflineReady: state === "OFFLINE_READY",
    refreshPendingCount,
    triggerSync: runSync,
  };
}
