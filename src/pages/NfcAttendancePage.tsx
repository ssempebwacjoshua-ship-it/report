import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  fetchNfcAttendanceRegister,
  scanNfcAttendance,
  type AttendanceCurrentStatus,
  type AttendanceRegisterResponse,
} from "../client/studentCredentialsClient";
import type { AttendanceDirection } from "../shared/types/studentCredentials";

const inputClass =
  "premium-control h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 outline-none focus:border-blue-400 focus:bg-white";

const STATUS_LABELS: Record<AttendanceCurrentStatus, string> = {
  ABSENT: "Absent",
  PRESENT: "Present",
  OUT: "Tapped Out",
  OUT_ONLY: "Out Only",
  BLOCKED: "Blocked",
  DUPLICATE: "Duplicate",
};

const STATUS_COLORS: Record<AttendanceCurrentStatus, string> = {
  ABSENT: "bg-slate-100 text-slate-600",
  PRESENT: "bg-green-100 text-green-700",
  OUT: "bg-amber-100 text-amber-700",
  OUT_ONLY: "bg-purple-100 text-purple-700",
  BLOCKED: "bg-red-100 text-red-700",
  DUPLICATE: "bg-orange-100 text-orange-700",
};

function formatTime(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function SummaryCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${color}`}>{value}</p>
    </div>
  );
}

export function NfcAttendancePage() {
  const [params] = useSearchParams();
  const [register, setRegister] = useState<AttendanceRegisterResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [scanLoading, setScanLoading] = useState(false);
  const [error, setError] = useState("");
  const [scanResult, setScanResult] = useState<{ message: string; success: boolean } | null>(null);

  const [tokenOrUid, setTokenOrUid] = useState(params.get("token") ?? "");
  const [direction, setDirection] = useState<AttendanceDirection>("TAP_IN");
  const [date, setDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [classId, setClassId] = useState("");
  const [streamId, setStreamId] = useState("");
  const [search, setSearch] = useState("");

  const tokenInputRef = useRef<HTMLInputElement>(null);

  async function loadRegister() {
    setLoading(true);
    setError("");
    try {
      const data = await fetchNfcAttendanceRegister({
        date,
        classId: classId || undefined,
        streamId: streamId || undefined,
        search: search || undefined,
      });
      setRegister(data);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load attendance register");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadRegister();
  }, []);

  async function scan() {
    const token = tokenOrUid.trim();
    if (!token) return;
    setScanLoading(true);
    setScanResult(null);
    setError("");
    try {
      await scanNfcAttendance({ tokenOrUid: token, direction });
      setScanResult({ success: true, message: `${direction === "TAP_IN" ? "Tap In" : "Tap Out"} recorded successfully.` });
      setTokenOrUid("");
      tokenInputRef.current?.focus();
      await loadRegister();
    } catch (caught) {
      const msg = caught instanceof Error ? caught.message : "Could not record scan";
      setScanResult({ success: false, message: msg });
      setTokenOrUid("");
      tokenInputRef.current?.focus();
    } finally {
      setScanLoading(false);
    }
  }

  const summary = register?.summary;

  return (
    <main className="grid gap-5">
      <header className="page-header">
        <p className="text-xs font-bold uppercase tracking-wide text-blue-600">NFC Operations</p>
        <h1 className="text-xl font-bold text-slate-950 sm:text-2xl">Attendance Register</h1>
      </header>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <SummaryCard label="Total" value={summary?.totalStudents ?? 0} color="text-slate-900" />
        <SummaryCard label="Present" value={summary?.present ?? 0} color="text-green-700" />
        <SummaryCard label="Tapped Out" value={summary?.out ?? 0} color="text-amber-700" />
        <SummaryCard label="Absent" value={summary?.absent ?? 0} color="text-slate-600" />
        <SummaryCard label="Blocked" value={summary?.blockedScans ?? 0} color="text-red-700" />
        <SummaryCard label="Duplicates" value={summary?.duplicateScans ?? 0} color="text-orange-700" />
      </section>

      <section className="premium-card rounded-xl p-4">
        <p className="mb-3 text-sm font-bold text-slate-800">Record Scan</p>
        <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto]">
          <input
            ref={tokenInputRef}
            className={`${inputClass} h-12 text-base font-semibold`}
            value={tokenOrUid}
            onChange={(e) => setTokenOrUid(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") void scan(); }}
            placeholder="Tap wristband / paste token"
            autoFocus
          />
          <div className="flex h-12 overflow-hidden rounded-xl border border-slate-200">
            <button
              type="button"
              className={`px-5 text-sm font-semibold transition ${direction === "TAP_IN" ? "bg-blue-600 text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}
              onClick={() => setDirection("TAP_IN")}
            >
              Tap In
            </button>
            <button
              type="button"
              className={`px-5 text-sm font-semibold transition ${direction === "TAP_OUT" ? "bg-blue-600 text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}
              onClick={() => setDirection("TAP_OUT")}
            >
              Tap Out
            </button>
          </div>
          <button
            className="btn btn-primary h-12 px-6"
            type="button"
            onClick={() => void scan()}
            disabled={!tokenOrUid.trim() || scanLoading}
          >
            {scanLoading ? "Recording…" : "Record Scan"}
          </button>
        </div>
        {scanResult ? (
          <div className={`mt-3 rounded-xl border px-4 py-2 text-sm font-semibold ${scanResult.success ? "border-green-200 bg-green-50 text-green-700" : "border-red-200 bg-red-50 text-red-700"}`}>
            {scanResult.message}
          </div>
        ) : null}
      </section>

      <section className="premium-card rounded-xl p-4">
        <div className="grid gap-3 sm:grid-cols-5">
          <input
            type="date"
            className={inputClass}
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
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
            placeholder="Class ID"
          />
          <input
            className={inputClass}
            value={streamId}
            onChange={(e) => setStreamId(e.target.value)}
            placeholder="Stream ID"
          />
          <button className="btn btn-secondary" type="button" onClick={() => void loadRegister()} disabled={loading}>
            {loading ? "Loading…" : "Apply Filters"}
          </button>
        </div>
      </section>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
      ) : null}

      <section className="premium-card overflow-hidden rounded-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left">
                <th className="px-4 py-3 font-semibold text-slate-600">Student</th>
                <th className="px-4 py-3 font-semibold text-slate-600">Adm #</th>
                <th className="px-4 py-3 font-semibold text-slate-600">Class</th>
                <th className="px-4 py-3 font-semibold text-slate-600">Tap In</th>
                <th className="px-4 py-3 font-semibold text-slate-600">Tap Out</th>
                <th className="px-4 py-3 font-semibold text-slate-600">Status</th>
                <th className="px-4 py-3 font-semibold text-slate-600">Last Scan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(register?.rows ?? []).map((row) => (
                <tr key={row.student.id} className="hover:bg-slate-50/50">
                  <td className="px-4 py-3 font-medium text-slate-900">{row.student.name}</td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-600">{row.student.admissionNumber}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {row.student.className ?? "—"}
                    {row.student.streamName ? ` / ${row.student.streamName}` : ""}
                  </td>
                  <td className="px-4 py-3 text-slate-700">{formatTime(row.tapIn?.scannedAt)}</td>
                  <td className="px-4 py-3 text-slate-700">{formatTime(row.tapOut?.scannedAt)}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-bold ${STATUS_COLORS[row.currentStatus]}`}>
                      {STATUS_LABELS[row.currentStatus]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    {row.lastScan ? (
                      <span>
                        {formatTime(row.lastScan.scannedAt)}
                        {row.lastScan.reason ? ` · ${row.lastScan.reason}` : ""}
                      </span>
                    ) : "—"}
                  </td>
                </tr>
              ))}
              {register && register.rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-slate-500">
                    No students found. Try adjusting the date or filters.
                  </td>
                </tr>
              ) : null}
              {!register && !error ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-slate-500">Loading…</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
