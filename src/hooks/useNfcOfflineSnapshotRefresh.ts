import { useCallback, useEffect, useRef, useState } from "react";
import { fetchOfflineBootstrap } from "../client/nfcOfflineClient";
import { getCanteenSaleSyncSummary, saveBootstrapSnapshot } from "../offline/offlineStore";
import { getSnapshotValidity, type SnapshotValidity } from "../offline/offlineStatus";
import type { OfflineKioskMode, OfflineModule } from "../offline/offlineTypes";

const REFRESH_INTERVAL_MS = 15 * 60 * 1000;
const NEAR_EXPIRY_MS = 30 * 60 * 1000;

function shouldRefresh(validity: SnapshotValidity): boolean {
  if (!validity.meta) return true;
  if (!validity.valid && ["no_snapshot", "expired", "wrong_device", "wrong_school", "missing_module", "empty_students", "empty_tags"].includes(validity.reason ?? "")) {
    return true;
  }
  return new Date(validity.meta.expiresAt).getTime() - Date.now() <= NEAR_EXPIRY_MS;
}

export function useNfcOfflineSnapshotRefresh(input: {
  schoolId?: string | null;
  deviceId: string;
  mode: OfflineKioskMode;
  requiredModule: OfflineModule;
  enabled?: boolean;
  syncBeforeRefresh?: () => Promise<void>;
}) {
  const { schoolId, deviceId, mode, requiredModule, enabled = true, syncBeforeRefresh } = input;
  const [validity, setValidity] = useState<SnapshotValidity | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState("");
  const refreshInFlight = useRef(false);

  const readValidity = useCallback(async () => {
    const next = await getSnapshotValidity({ schoolId: schoolId ?? undefined, deviceId, mode, requiredModule });
    setValidity(next);
    if (!next.valid) {
      console.info("[nfc-offline-snapshot]", next.diagnostics);
    }
    return next;
  }, [deviceId, mode, requiredModule, schoolId]);

  const refreshNow = useCallback(async (reason: string) => {
    if (!enabled || !schoolId || refreshInFlight.current) return;
    if (typeof navigator !== "undefined" && !navigator.onLine) return;

    refreshInFlight.current = true;
    setIsRefreshing(true);
    setRefreshError("");
    try {
      if (mode === "CANTEEN") {
        let summary = await getCanteenSaleSyncSummary(schoolId);
        if ((summary.pending > 0 || summary.syncing > 0) && syncBeforeRefresh) {
          await syncBeforeRefresh();
          summary = await getCanteenSaleSyncSummary(schoolId);
        }
        if (summary.pending > 0 || summary.syncing > 0) {
          throw new Error("Pending canteen sales must sync before register update.");
        }
        if (summary.failed > 0 || summary.conflict > 0) {
          throw new Error("Some canteen sales need retry or reconciliation before register update.");
        }
      }
      const snapshot = await fetchOfflineBootstrap([requiredModule], deviceId, mode);
      await saveBootstrapSnapshot(snapshot);
      const next = await readValidity();
      console.info("[nfc-offline-snapshot]", { refreshReason: reason, ...next.diagnostics });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not refresh offline snapshot.";
      setRefreshError(message);
      const next = await readValidity();
      console.info("[nfc-offline-snapshot]", { refreshReason: reason, refreshFailed: true, error: message, ...next.diagnostics });
    } finally {
      refreshInFlight.current = false;
      setIsRefreshing(false);
    }
  }, [deviceId, enabled, mode, readValidity, requiredModule, schoolId, syncBeforeRefresh]);

  useEffect(() => {
    if (!enabled || !schoolId) return;
    let cancelled = false;

    async function init() {
      const current = await readValidity();
      if (!cancelled && shouldRefresh(current)) {
        void refreshNow(current.reason ?? "near_expiry");
      }
    }

    void init();
    return () => { cancelled = true; };
  }, [enabled, readValidity, refreshNow, schoolId]);

  useEffect(() => {
    if (!enabled || !schoolId) return;
    const timer = window.setInterval(() => {
      if (typeof navigator === "undefined" || navigator.onLine) {
        void refreshNow("interval");
      }
    }, REFRESH_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [enabled, refreshNow, schoolId]);

  useEffect(() => {
    if (!enabled || !schoolId) return;
    const onOnline = () => { void refreshNow("online"); };
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [enabled, refreshNow, schoolId]);

  return { validity, isRefreshing, refreshError, refreshNow };
}
