import { useEffect, useState } from "react";
import { NfcScanPanel } from "../components/nfc/NfcScanPanel";
import { useNfcScanner, type ScanResult } from "../hooks/useNfcScanner";
import { fetchNfcAttendance, scanNfcAttendance } from "../client/studentCredentialsClient";
import type {
  AttendanceDirection,
  NfcAttendanceDashboard,
  NfcAttendanceScanEvent,
} from "../shared/types/studentCredentials";

const inputClass =
  "premium-control h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 outline-none focus:border-blue-400 focus:bg-white";

const STATUS_COLORS: Record<string, string> = {
  VALID:     "bg-green-100 text-green-800",
  DUPLICATE: "bg-yellow-100 text-yellow-800",
  BLOCKED:   "bg-red-100 text-red-800",
};

export function NfcAttendancePage() {
  const [dashboard, setDashboard] = useState<NfcAttendanceDashboard | null>(null);
  const [lastScan, setLastScan] = useState<NfcAttendanceScanEvent | null>(null);
  const [direction, setDirection] = useState<AttendanceDirection>("TAP_IN");
  const [search, setSearch] = useState("");
  const [classId, setClassId] = useState("");
  const [streamId, setStreamId] = useState("");
  const [loadError, setLoadError] = useState("");

  const directionRef = { current: direction };
  directionRef.current = direction;

  async function load(filters = { search, classId, streamId }) {
    const data = await fetchNfcAttendance(filters);
    setDashboard(data);
  }

  useEffect(() => {
    void load().catch((e: Error) => setLoadError(e.message));
  }, []);

  const handleScan = async ({ tokenOrUid, idempotencyKey, deviceId }: ScanResult) => {
    const data = await scanNfcAttendance({
      tokenOrUid,
      direction: directionRef.current,
      idempotencyKey,
      deviceId,
    });
    setLastScan(data.scan);
    setDashboard({ summary: data.summary, events: data.events });
  };

  const scanner = useNfcScanner({ onScan: handleScan });

  return (
    <main className="grid gap-5">
      <header className="page-header">
        <p className="text-xs font-bold uppercase tracking-wide text-blue-600">NFC Operations</p>
        <h1 className="text-xl font-bold text-slate-950 sm:text-2xl">NFC Attendance</h1>
      </header>

      {loadError && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{loadError}</div>
      )}

      {/* Summary metrics */}
      <section className="grid gap-3 sm:grid-cols-4">
        <Metric label="Tapped in" value={dashboard?.summary.totalTappedIn ?? 0} />
        <Metric label="Tapped out" value={dashboard?.summary.totalTappedOut ?? 0} />
        <Metric label="Late arrivals" value={dashboard?.summary.lateArrivals ?? 0} />
        <Metric label="Not yet tapped" value={dashboard?.summary.notYetTapped ?? 0} />
      </section>

      <div className="grid gap-5 lg:grid-cols-[380px_1fr]">
        {/* Left: scanner panel */}
        <div className="flex flex-col gap-4">
          {/* Direction selector */}
          <div className="flex rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
            {(["TAP_IN", "TAP_OUT"] as const).map((dir) => (
              <button
                key={dir}
                onClick={() => setDirection(dir)}
                className={`flex-1 py-3 text-sm font-semibold transition-colors ${
                  direction === dir
                    ? "bg-blue-600 text-white"
                    : "text-slate-600 hover:bg-slate-50"
                }`}
              >
                {dir === "TAP_IN" ? "Tap In" : "Tap Out"}
              </button>
            ))}
          </div>

          <NfcScanPanel
            state={scanner.state}
            error={scanner.error}
            isOnline={scanner.isOnline}
            isWebNfcAvailable={scanner.isWebNfcAvailable}
            onStart={scanner.startScanner}
            onStop={scanner.stopScanner}
            onManualSubmit={scanner.submitManual}
            scanLabel="Start NFC Scanner"
          />

          {/* Last scan result */}
          {lastScan && (
            <div
              className={`rounded-xl border p-4 ${
                lastScan.status === "VALID"
                  ? "border-green-200 bg-green-50"
                  : lastScan.status === "BLOCKED"
                    ? "border-red-200 bg-red-50"
                    : "border-yellow-200 bg-yellow-50"
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <p className="font-bold text-slate-900 text-sm">{lastScan.student.name}</p>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${STATUS_COLORS[lastScan.status] ?? "bg-slate-100 text-slate-700"}`}>
                  {lastScan.status}
                </span>
              </div>
              <p className="text-xs text-slate-600">{lastScan.student.admissionNumber} · {lastScan.student.className ?? "No class"}</p>
              <p className="text-xs text-slate-500 mt-1">
                {lastScan.direction} · {new Date(lastScan.scannedAt).toLocaleTimeString()}
                {lastScan.reason ? ` · ${lastScan.reason}` : ""}
              </p>
            </div>
          )}
        </div>

        {/* Right: events list */}
        <section className="premium-card rounded-xl p-4">
          <div className="mb-3 grid gap-2 sm:grid-cols-4">
            <input
              className={inputClass}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search student"
            />
            <input
              className={inputClass}
              value={classId}
              onChange={(e) => setClassId(e.target.value)}
              placeholder="Class ID filter"
            />
            <input
              className={inputClass}
              value={streamId}
              onChange={(e) => setStreamId(e.target.value)}
              placeholder="Stream ID filter"
            />
            <button
              className="btn btn-secondary"
              type="button"
              onClick={() => void load({ search, classId, streamId }).catch(() => null)}
            >
              Apply filters
            </button>
          </div>
          <div className="grid gap-2">
            {(dashboard?.events ?? []).map((event) => (
              <div key={event.id} className="rounded-xl border border-slate-200 bg-white p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-bold text-slate-950">
                    {event.student.name} · {event.student.admissionNumber}
                  </p>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${STATUS_COLORS[event.status] ?? "bg-slate-100 text-slate-700"}`}>
                    {event.status}
                  </span>
                </div>
                <p className="mt-1 text-slate-600">
                  {new Date(event.scannedAt).toLocaleTimeString()} · {event.direction} · {event.source}
                </p>
                <p className="text-slate-500">
                  {event.student.className ?? "No class"} / {event.student.streamName ?? "No stream"}
                  {event.reason ? ` · ${event.reason}` : ""}
                </p>
              </div>
            ))}
            {dashboard?.events.length === 0 && (
              <p className="py-6 text-center text-sm text-slate-500">No attendance scans yet today.</p>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-bold uppercase text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-slate-950">{value}</p>
    </div>
  );
}
