import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { fetchNfcGateDashboard, scanNfcGate } from "../client/studentCredentialsClient";
import type { NfcGateDashboard, NfcGateScanResponse } from "../shared/types/studentCredentials";

const inputClass = "premium-control h-12 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 outline-none focus:border-blue-400 focus:bg-white";

export function NfcGateSecurityPage() {
  const { token = "" } = useParams();
  const [tokenOrUid, setTokenOrUid] = useState(token);
  const [scanResult, setScanResult] = useState<NfcGateScanResponse | null>(null);
  const [dashboard, setDashboard] = useState<NfcGateDashboard | null>(null);
  const [error, setError] = useState("");

  async function load() {
    setDashboard(await fetchNfcGateDashboard());
  }

  useEffect(() => {
    void load().catch((caught: Error) => setError(caught.message));
  }, []);

  async function scan() {
    setError("");
    try {
      const result = await scanNfcGate({ tokenOrUid });
      setScanResult(result);
      setTokenOrUid("");
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not verify gate scan");
    }
  }

  const allowed = scanResult?.result === "ALLOWED";

  return (
    <main className="grid gap-5">
      <header className="page-header">
        <p className="text-xs font-bold uppercase tracking-wide text-blue-600">NFC Operations</p>
        <h1 className="text-xl font-bold text-slate-950 sm:text-2xl">Gate Security</h1>
      </header>
      {error ? <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="premium-card rounded-xl p-4">
          <label className="grid gap-1 text-xs font-bold uppercase text-slate-500">
            Tap Wristband / Scan
            <input
              className={`${inputClass} h-20 text-xl font-bold tracking-wide`}
              value={tokenOrUid}
              onChange={(event) => setTokenOrUid(event.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && tokenOrUid.trim()) void scan(); }}
              placeholder="Tap wristband or paste token"
              autoFocus
            />
          </label>
          <button className="btn btn-primary mt-4 min-h-14 w-full text-base font-black" type="button" onClick={() => void scan()} disabled={!tokenOrUid.trim()}>
            Verify at gate
          </button>

          {scanResult ? (
            <div className={`mt-5 rounded-2xl border p-5 text-center ${allowed ? "border-emerald-200 bg-emerald-50" : "border-red-200 bg-red-50"}`}>
              <p className={`text-5xl font-black ${allowed ? "text-emerald-600" : "text-red-600"}`}>
                {allowed ? "✓" : "✗"}
              </p>
              <p className={`mt-1 text-2xl font-black ${allowed ? "text-emerald-700" : "text-red-700"}`}>
                {allowed ? "ALLOWED" : "BLOCKED"}
              </p>
              {scanResult.reason && <p className="mt-2 text-sm text-slate-600">{scanResult.reason}</p>}
              {scanResult.student ? (
                <div className="mt-4 rounded-xl bg-white/60 p-3 text-left text-sm">
                  <p className="text-lg font-bold text-slate-950">{scanResult.student.name}</p>
                  <p className="text-slate-600">{scanResult.student.admissionNumber} · {scanResult.student.className ?? "No class"}</p>
                  <p className="mt-1 text-xs text-slate-400">Credential: {scanResult.credentialStatus} · Attendance: {scanResult.todayAttendanceStatus}</p>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        <aside className="premium-card rounded-xl p-4">
          <h2 className="text-base font-bold text-slate-950">Recent gate scans</h2>
          <div className="mt-3 grid gap-2">
            {(dashboard?.recentScans ?? []).map((recentScan, index) => (
              <div key={`${recentScan.scannedAt}-${index}`} className="rounded-xl border border-slate-200 bg-white p-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <p className={`font-bold ${recentScan.result === "ALLOWED" ? "text-emerald-700" : "text-red-700"}`}>{recentScan.result}</p>
                  <p className="text-xs text-slate-400">{new Date(recentScan.scannedAt).toLocaleTimeString()}</p>
                </div>
                <p className="text-slate-700">{recentScan.student?.name ?? "Unknown wristband"}</p>
                {recentScan.reason ? <p className="text-xs text-slate-500">{recentScan.reason}</p> : null}
              </div>
            ))}
            {dashboard?.recentScans.length === 0 ? <p className="text-sm text-slate-500">No gate scans yet.</p> : null}
          </div>
        </aside>
      </section>
    </main>
  );
}
