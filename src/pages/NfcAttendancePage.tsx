import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { fetchNfcAttendance, scanNfcAttendance } from "../client/studentCredentialsClient";
import type { AttendanceDirection, NfcAttendanceDashboard } from "../shared/types/studentCredentials";

const inputClass = "premium-control h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 outline-none focus:border-blue-400 focus:bg-white";

export function NfcAttendancePage() {
  const [params] = useSearchParams();
  const [dashboard, setDashboard] = useState<NfcAttendanceDashboard | null>(null);
  const [tokenOrUid, setTokenOrUid] = useState(params.get("token") ?? "");
  const [direction, setDirection] = useState<AttendanceDirection>("TAP_IN");
  const [search, setSearch] = useState("");
  const [classId, setClassId] = useState("");
  const [streamId, setStreamId] = useState("");
  const [error, setError] = useState("");

  async function load() {
    const data = await fetchNfcAttendance({ search, classId, streamId });
    setDashboard(data);
  }

  useEffect(() => {
    void load().catch((caught: Error) => setError(caught.message));
  }, []);

  async function scan() {
    setError("");
    try {
      const data = await scanNfcAttendance({ tokenOrUid, direction });
      setDashboard(data);
      setTokenOrUid("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not scan wristband");
    }
  }

  return (
    <main className="grid gap-5">
      <header className="page-header">
        <p className="text-xs font-bold uppercase tracking-wide text-blue-600">NFC Operations</p>
        <h1 className="text-xl font-bold text-slate-950 sm:text-2xl">NFC Attendance</h1>
      </header>
      {error ? <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}
      <section className="grid gap-3 sm:grid-cols-4">
        <Metric label="Tapped in" value={dashboard?.summary.totalTappedIn ?? 0} />
        <Metric label="Tapped out" value={dashboard?.summary.totalTappedOut ?? 0} />
        <Metric label="Late arrivals" value={dashboard?.summary.lateArrivals ?? 0} />
        <Metric label="Not yet tapped" value={dashboard?.summary.notYetTapped ?? 0} />
      </section>
      <section className="premium-card rounded-xl p-4">
        <div className="grid gap-3 md:grid-cols-[1fr_140px_auto]">
          <input className={`${inputClass} h-16 text-lg font-bold`} value={tokenOrUid} onChange={(event) => setTokenOrUid(event.target.value)} placeholder="Tap Wristband / Scan token" />
          <select className={inputClass} value={direction} onChange={(event) => setDirection(event.target.value as AttendanceDirection)}>
            <option value="TAP_IN">Tap in</option>
            <option value="TAP_OUT">Tap out</option>
          </select>
          <button className="btn btn-primary min-h-11" type="button" onClick={() => void scan()} disabled={!tokenOrUid.trim()}>
            Scan Wristband
          </button>
        </div>
      </section>
      <section className="premium-card rounded-xl p-4">
        <div className="mb-3 grid gap-2 md:grid-cols-4">
          <input className={inputClass} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search student" />
          <input className={inputClass} value={classId} onChange={(event) => setClassId(event.target.value)} placeholder="Class ID filter" />
          <input className={inputClass} value={streamId} onChange={(event) => setStreamId(event.target.value)} placeholder="Stream ID filter" />
          <button className="btn btn-secondary" type="button" onClick={() => void load()}>Apply filters</button>
        </div>
        <div className="grid gap-2">
          {(dashboard?.events ?? []).map((event) => (
            <div key={event.id} className="rounded-xl border border-slate-200 bg-white p-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-bold text-slate-950">{event.student.name} · {event.student.admissionNumber}</p>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-700">{event.status}</span>
              </div>
              <p className="mt-1 text-slate-600">{new Date(event.scannedAt).toLocaleTimeString()} · {event.direction} · {event.source}</p>
              <p className="text-slate-500">{event.student.className ?? "No class"} / {event.student.streamName ?? "No stream"} {event.reason ? `· ${event.reason}` : ""}</p>
            </div>
          ))}
          {dashboard?.events.length === 0 ? <p className="py-6 text-center text-sm text-slate-500">No attendance scans yet today.</p> : null}
        </div>
      </section>
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
