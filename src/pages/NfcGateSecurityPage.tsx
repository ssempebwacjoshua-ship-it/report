import { useEffect, useRef, useState } from "react";
import { WifiOffRegular, ArrowSyncRegular } from "@fluentui/react-icons";
import { NfcScanPanel } from "../components/nfc/NfcScanPanel";
import { useNfcScanner, type ScanResult } from "../hooks/useNfcScanner";
import { useConnectivityStatus } from "../hooks/useConnectivityStatus";
import { useAuth } from "../contexts/AuthContext";
import { fetchNfcGateDashboard, scanNfcGate } from "../client/studentCredentialsClient";
import { resolveOfflineNfcScan } from "../offline/offlineResolver";
import { queueGateScan, getSnapshotMeta } from "../offline/offlineStore";
import type { NfcGateDashboard, NfcGateScanResponse } from "../shared/types/studentCredentials";
import type { OfflineResolveResult } from "../offline/offlineTypes";

function getDeviceId(): string {
  const key = "schoolconnect_nfc_device_id";
  let id = localStorage.getItem(key);
  if (!id) { id = crypto.randomUUID(); localStorage.setItem(key, id); }
  return id;
}

type LocalScanResult = NfcGateScanResponse | { result: "ALLOWED" | "BLOCKED"; reason?: string; student?: { name: string; admissionNumber: string; className?: string | null; streamName?: string | null }; scannedAt: string; offline?: true; queued?: boolean };

export function NfcGateSecurityPage() {
  const { user, token, loading: authLoading } = useAuth();
  const deviceId = useRef(getDeviceId()).current;

  const { state: connState, isOfflineReady, pendingCount } = useConnectivityStatus(user?.schoolId, deviceId, "gate");

  const [scanResult, setScanResult] = useState<LocalScanResult | null>(null);
  const [dashboard, setDashboard] = useState<NfcGateDashboard | null>(null);
  const [loadError, setLoadError] = useState("");
  const [offlineQueue, setOfflineQueue] = useState<Array<{ result: string; student?: string; scannedAt: string }>>([]);

  async function load() {
    if (isOfflineReady) return;
    if (!user || !token) {
      setDashboard(null);
      setLoadError("Please sign in again.");
      return;
    }
    try {
      setLoadError("");
      setDashboard(await fetchNfcGateDashboard());
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not load gate scans.";
      setDashboard(null);
      if (/session|unauthori[sz]ed|login|sign in/i.test(message)) {
        setLoadError("Please sign in again.");
      } else if (/access|forbidden|permission/i.test(message)) {
        setLoadError("Gate access is blocked for this account. Ask an administrator to check the Gate Security role.");
      } else {
        setLoadError(message);
      }
    }
  }

  useEffect(() => {
    if (authLoading) return;
    void load();
  }, [authLoading, isOfflineReady, token, user?.schoolId]);

  const handleScan = async ({ tokenOrUid, idempotencyKey, deviceId: scanDeviceId }: ScanResult) => {
    if (isOfflineReady) {
      // Offline path — resolve locally then queue
      if (!user?.schoolId) return;
      const resolve: OfflineResolveResult = await resolveOfflineNfcScan(user.schoolId, tokenOrUid);
      const meta = await getSnapshotMeta();
      const scannedAt = new Date().toISOString();

      const localResult: "ALLOWED" | "BLOCKED" = resolve.blocked ? "BLOCKED" : "ALLOWED";

      await queueGateScan({
        schoolId: user.schoolId,
        deviceId: scanDeviceId ?? deviceId,
        snapshotId: meta?.snapshotId ?? "unknown",
        studentId: resolve.student?.id ?? null,
        tagId: resolve.tag?.id ?? null,
        payload: {
          actionType: "GATE_SCAN",
          tokenOrUid,
          publicCode: resolve.tag?.publicCode ?? null,
          physicalUid: resolve.tag?.physicalUid ?? null,
          studentId: resolve.student?.id ?? null,
          tagId: resolve.tag?.id ?? null,
          result: localResult,
          reason: resolve.reason ?? null,
          scannedAt,
        },
      });

      const offlineData: LocalScanResult = {
        result: localResult,
        reason: resolve.reason,
        student: resolve.student
          ? {
              name: `${resolve.student.firstName} ${resolve.student.lastName}`.trim(),
              admissionNumber: resolve.student.admissionNumber,
              className: resolve.student.className,
              streamName: resolve.student.streamName,
            }
          : undefined,
        scannedAt,
        offline: true,
        queued: true,
      };

      setScanResult(offlineData);
      setOfflineQueue((prev) => [
        { result: localResult, student: resolve.student ? `${resolve.student.firstName} ${resolve.student.lastName}`.trim() : undefined, scannedAt },
        ...prev.slice(0, 19),
      ]);
    } else {
      // Online path — send to server
      const result = await scanNfcGate({ tokenOrUid, idempotencyKey, deviceId: scanDeviceId });
      setScanResult(result);
      void load().catch(() => null);
    }
  };

  const scanner = useNfcScanner({ onScan: handleScan });
  const result = scanResult?.result;
  const allowed = result === "ALLOWED";

  if (authLoading) {
    return (
      <main className="grid gap-5">
        <header className="page-header">
          <p className="text-xs font-bold uppercase tracking-wide text-blue-600">NFC Operations</p>
          <h1 className="text-xl font-bold text-slate-950 sm:text-2xl">Gate Security</h1>
        </header>
        <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-500 shadow-sm">
          Checking your gate session...
        </div>
      </main>
    );
  }

  if (!user || !token) {
    return (
      <main className="grid gap-5">
        <header className="page-header">
          <p className="text-xs font-bold uppercase tracking-wide text-blue-600">NFC Operations</p>
          <h1 className="text-xl font-bold text-slate-950 sm:text-2xl">Gate Security</h1>
        </header>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 shadow-sm">
          Please sign in again to continue using Gate Security.
        </div>
      </main>
    );
  }

  return (
    <main className="grid gap-5">
      <header className="page-header">
        <p className="text-xs font-bold uppercase tracking-wide text-blue-600">NFC Operations</p>
        <h1 className="text-xl font-bold text-slate-950 sm:text-2xl">Gate Security</h1>
      </header>

      {/* Offline mode banner */}
      {isOfflineReady && (
        <div className="flex items-center gap-3 rounded-xl border border-orange-200 bg-orange-50 p-3">
          <WifiOffRegular className="h-5 w-5 text-orange-600 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-orange-800">Offline Mode Active</p>
            <p className="text-xs text-orange-600">Scans are being stored locally. {pendingCount > 0 ? `${pendingCount} pending sync.` : "Will sync when connection returns."}</p>
          </div>
        </div>
      )}
      {connState === "DEGRADED" && (
        <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3">
          <ArrowSyncRegular className="h-4 w-4 text-amber-600 animate-spin shrink-0" />
          <p className="text-sm text-amber-800">Connection unstable — scans are still going to the server</p>
        </div>
      )}

      {loadError && !isOfflineReady && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{loadError}</div>
      )}

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex flex-col gap-4">
          <NfcScanPanel
            state={scanner.state}
            error={scanner.error}
            isOnline={scanner.isOnline}
            isWebNfcAvailable={scanner.isWebNfcAvailable}
            onStart={scanner.startScanner}
            onStop={scanner.stopScanner}
            onManualSubmit={scanner.submitManual}
            scanLabel="Start Gate Scanner"
          />

          {scanResult && (
            <div className={`rounded-2xl border p-5 ${allowed ? "border-emerald-200 bg-emerald-50" : "border-red-200 bg-red-50"}`}>
              <div className="flex items-center justify-between">
                <p className={`text-3xl font-black ${allowed ? "text-emerald-700" : "text-red-700"}`}>
                  {allowed ? "ALLOWED" : "BLOCKED"}
                </p>
                {"offline" in scanResult && scanResult.offline && (
                  <span className="text-xs font-semibold text-orange-600 bg-orange-100 rounded-full px-2 py-0.5">Offline · Queued</span>
                )}
              </div>
              <p className="mt-2 text-sm text-slate-700">{scanResult.reason ?? "Valid active student"}</p>
              {scanResult.student && (
                <div className="mt-4 text-sm">
                  <p className="text-lg font-bold text-slate-950">{scanResult.student.name}</p>
                  <p className="text-slate-700">{scanResult.student.admissionNumber}</p>
                  <p className="text-slate-600">
                    {(scanResult.student.className ?? "No class")} / {(scanResult.student.streamName ?? "No stream")}
                  </p>
                  {"credentialStatus" in scanResult && (
                    <p className="text-slate-600 mt-1 text-xs">
                      Status: {(scanResult as NfcGateScanResponse).credentialStatus} · Attendance: {(scanResult as NfcGateScanResponse).todayAttendanceStatus}
                    </p>
                  )}
                </div>
              )}
              <p className="mt-3 text-xs text-slate-400">{new Date(scanResult.scannedAt).toLocaleTimeString()}</p>
            </div>
          )}
        </div>

        {/* Recent scans sidebar */}
        <aside className="premium-card rounded-xl p-4">
          <h2 className="text-base font-bold text-slate-950">Recent gate scans</h2>
          <div className="mt-3 grid gap-2">
            {isOfflineReady ? (
              offlineQueue.length === 0 ? (
                <p className="text-sm text-slate-500">No offline scans yet.</p>
              ) : (
                offlineQueue.map((scan, i) => (
                  <div key={i} className="rounded-xl border border-slate-200 bg-white p-3 text-sm">
                    <div className="flex items-center justify-between">
                      <p className={`font-bold ${scan.result === "ALLOWED" ? "text-emerald-700" : "text-red-700"}`}>{scan.result}</p>
                      <span className="text-xs text-orange-500">offline</span>
                    </div>
                    <p className="text-slate-700">{scan.student ?? "Unknown tag"}</p>
                    <p className="text-slate-500">{new Date(scan.scannedAt).toLocaleString()}</p>
                  </div>
                ))
              )
            ) : (
              (dashboard?.recentScans ?? []).map((scan, index) => (
                <div key={`${scan.scannedAt}-${index}`} className="rounded-xl border border-slate-200 bg-white p-3 text-sm">
                  <p className={`font-bold ${scan.result === "ALLOWED" ? "text-emerald-700" : "text-red-700"}`}>{scan.result}</p>
                  <p className="text-slate-700">{scan.student?.name ?? "Unknown tag"}</p>
                  <p className="text-slate-500">{new Date(scan.scannedAt).toLocaleString()}{scan.reason ? ` · ${scan.reason}` : ""}</p>
                </div>
              ))
            )}
            {!isOfflineReady && dashboard?.recentScans.length === 0 && (
              <p className="text-sm text-slate-500">No gate scans yet.</p>
            )}
          </div>
        </aside>
      </section>
    </main>
  );
}
