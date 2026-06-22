import { useEffect, useState } from "react";
import { NfcScanPanel } from "../components/nfc/NfcScanPanel";
import { useNfcScanner, type ScanResult } from "../hooks/useNfcScanner";
import { fetchNfcGateDashboard, scanNfcGate } from "../client/studentCredentialsClient";
import type { NfcGateDashboard, NfcGateScanResponse } from "../shared/types/studentCredentials";

export function NfcGateSecurityPage() {
  const [scanResult, setScanResult] = useState<NfcGateScanResponse | null>(null);
  const [dashboard, setDashboard] = useState<NfcGateDashboard | null>(null);
  const [loadError, setLoadError] = useState("");

  async function load() {
    setDashboard(await fetchNfcGateDashboard());
  }

  useEffect(() => {
    void load().catch((e: Error) => setLoadError(e.message));
  }, []);

  const handleScan = async ({ tokenOrUid, idempotencyKey, deviceId }: ScanResult) => {
    const result = await scanNfcGate({ tokenOrUid, idempotencyKey, deviceId });
    setScanResult(result);
    void load().catch(() => null);
  };

  const scanner = useNfcScanner({ onScan: handleScan });
  const allowed = scanResult?.result === "ALLOWED";

  return (
    <main className="grid gap-5">
      <header className="page-header">
        <p className="text-xs font-bold uppercase tracking-wide text-blue-600">NFC Operations</p>
        <h1 className="text-xl font-bold text-slate-950 sm:text-2xl">Gate Security</h1>
      </header>

      {loadError && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{loadError}</div>
      )}

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex flex-col gap-4">
          {/* Scanner panel */}
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

          {/* Scan result */}
          {scanResult && (
            <div
              className={`rounded-2xl border p-5 ${
                allowed ? "border-emerald-200 bg-emerald-50" : "border-red-200 bg-red-50"
              }`}
            >
              <p className={`text-3xl font-black ${allowed ? "text-emerald-700" : "text-red-700"}`}>
                {allowed ? "ALLOWED" : "BLOCKED"}
              </p>
              <p className="mt-2 text-sm text-slate-700">{scanResult.reason ?? "Valid active student"}</p>
              {scanResult.student && (
                <div className="mt-4 text-sm">
                  <p className="text-lg font-bold text-slate-950">{scanResult.student.name}</p>
                  <p className="text-slate-700">{scanResult.student.admissionNumber}</p>
                  <p className="text-slate-600">
                    {scanResult.student.className ?? "No class"} / {scanResult.student.streamName ?? "No stream"}
                  </p>
                  <p className="text-slate-600 mt-1 text-xs">
                    Status: {scanResult.credentialStatus} · Attendance: {scanResult.todayAttendanceStatus}
                  </p>
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
            {(dashboard?.recentScans ?? []).map((scan, index) => (
              <div
                key={`${scan.scannedAt}-${index}`}
                className="rounded-xl border border-slate-200 bg-white p-3 text-sm"
              >
                <p className={`font-bold ${scan.result === "ALLOWED" ? "text-emerald-700" : "text-red-700"}`}>
                  {scan.result}
                </p>
                <p className="text-slate-700">{scan.student?.name ?? "Unknown tag"}</p>
                <p className="text-slate-500">
                  {new Date(scan.scannedAt).toLocaleString()}
                  {scan.reason ? ` · ${scan.reason}` : ""}
                </p>
              </div>
            ))}
            {dashboard?.recentScans.length === 0 && (
              <p className="text-sm text-slate-500">No gate scans yet.</p>
            )}
          </div>
        </aside>
      </section>
    </main>
  );
}
