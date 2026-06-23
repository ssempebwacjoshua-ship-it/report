import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { WifiOffRegular } from "@fluentui/react-icons";
import { NfcScanPanel } from "../components/nfc/NfcScanPanel";
import { useNfcScanner, type ScanResult } from "../hooks/useNfcScanner";
import { useConnectivityStatus } from "../hooks/useConnectivityStatus";
import { useAuth } from "../contexts/AuthContext";
import {
  fetchNfcAttendanceRegister,
  scanNfcAttendance,
} from "../client/studentCredentialsClient";
import { resolveOfflineNfcScan } from "../offline/offlineResolver";
import { queueAttendanceEvent, getSnapshotMeta, hasPendingAttendanceForDirection } from "../offline/offlineStore";
import type {
  AttendanceCurrentStatus,
  AttendanceDirection,
  AttendanceRegisterResponse,
  NfcAttendanceScanEvent,
} from "../shared/types/studentCredentials";

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

const SCAN_STATUS_COLORS: Record<string, string> = {
  VALID: "bg-green-100 text-green-800",
  DUPLICATE: "bg-yellow-100 text-yellow-800",
  BLOCKED: "bg-red-100 text-red-800",
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

function getDeviceId(): string {
  const key = "schoolconnect_nfc_device_id";
  let id = localStorage.getItem(key);
  if (!id) { id = crypto.randomUUID(); localStorage.setItem(key, id); }
  return id;
}

export function NfcAttendancePage() {
  const [params] = useSearchParams();
  const { user } = useAuth();
  const deviceId = useRef(getDeviceId()).current;

  const { isOfflineReady, pendingCount } = useConnectivityStatus(user?.schoolId, deviceId);

  const [register, setRegister] = useState<AttendanceRegisterResponse | null>(null);
  const [lastScan, setLastScan] = useState<NfcAttendanceScanEvent | null>(null);
  const [offlineScans, setOfflineScans] = useState<Array<{ name: string; direction: string; status: string; scannedAt: string }>>([]);

  const [direction, setDirection] = useState<AttendanceDirection>("TAP_IN");
  const directionRef = useRef<AttendanceDirection>("TAP_IN");
  directionRef.current = direction;

  const [date, setDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [classId, setClassId] = useState("");
  const [streamId, setStreamId] = useState("");
  const [search, setSearch] = useState("");

  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");

  async function loadRegister() {
    setLoading(true);
    setLoadError("");

    try {
      const data = await fetchNfcAttendanceRegister({
        date,
        classId: classId || undefined,
        streamId: streamId || undefined,
        search: search || undefined,
      });

      setRegister(data);
    } catch (caught) {
      setLoadError(caught instanceof Error ? caught.message : "Could not load attendance register");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadRegister();
    // initial load only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleScan({ tokenOrUid, idempotencyKey, deviceId: scanDeviceId }: ScanResult) {
    if (isOfflineReady) {
      if (!user?.schoolId) return;
      const resolve = await resolveOfflineNfcScan(user.schoolId, tokenOrUid);
      const meta = await getSnapshotMeta();
      const scannedAt = new Date().toISOString();
      const dateStr = scannedAt.split("T")[0]!;
      const currentDirection = directionRef.current;

      let status = "VALID";
      let reason: string | null = null;
      if (resolve.blocked) {
        status = "BLOCKED";
        reason = resolve.reason ?? "blocked";
      } else if (resolve.student) {
        const dup = await hasPendingAttendanceForDirection(user.schoolId, resolve.student.id, currentDirection, dateStr);
        if (dup) { status = "DUPLICATE"; reason = "already recorded today"; }
      }

      await queueAttendanceEvent({
        schoolId: user.schoolId,
        deviceId: scanDeviceId ?? deviceId,
        snapshotId: meta?.snapshotId ?? "unknown",
        studentId: resolve.student?.id ?? null,
        direction: currentDirection,
        payload: {
          actionType: "ATTENDANCE_SCAN",
          tokenOrUid,
          studentId: resolve.student?.id ?? null,
          tagId: resolve.tag?.id ?? null,
          direction: currentDirection,
          status,
          reason,
          scannedAt,
        },
      });

      const studentName = resolve.student ? `${resolve.student.firstName} ${resolve.student.lastName}`.trim() : "Unknown";
      setOfflineScans((prev) => [{ name: studentName, direction: currentDirection, status, scannedAt }, ...prev.slice(0, 19)]);
    } else {
      const data = await scanNfcAttendance({
        tokenOrUid,
        direction: directionRef.current,
        idempotencyKey,
        deviceId: scanDeviceId,
      });
      setLastScan(data.scan);
      await loadRegister();
    }
  }

  const scanner = useNfcScanner({ onScan: handleScan });

  useEffect(() => {
    const token = params.get("token");
    if (!token) return;

    void handleScan({
      tokenOrUid: token,
      idempotencyKey: `url-${Date.now()}-${token.slice(0, 20)}`,
      deviceId: "url-token",
    });
    // run once for deep-link token
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const summary = register?.summary;

  return (
    <main className="grid gap-5">
      <header className="page-header">
        <p className="text-xs font-bold uppercase tracking-wide text-blue-600">NFC Operations</p>
        <h1 className="text-xl font-bold text-slate-950 sm:text-2xl">Attendance Register</h1>
      </header>

      {isOfflineReady && (
        <div className="flex items-center gap-3 rounded-xl border border-orange-200 bg-orange-50 p-3">
          <WifiOffRegular className="h-5 w-5 text-orange-600 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-orange-800">Offline Mode Active</p>
            <p className="text-xs text-orange-600">Attendance scans are queued locally. {pendingCount > 0 ? `${pendingCount} pending sync.` : "Will sync when connection returns."}</p>
          </div>
        </div>
      )}

      {loadError && !isOfflineReady ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {loadError}
        </div>
      ) : null}

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <SummaryCard label="Total" value={summary?.totalStudents ?? 0} color="text-slate-900" />
        <SummaryCard label="Present" value={summary?.present ?? 0} color="text-green-700" />
        <SummaryCard label="Tapped Out" value={summary?.out ?? 0} color="text-amber-700" />
        <SummaryCard label="Absent" value={summary?.absent ?? 0} color="text-slate-600" />
        <SummaryCard label="Blocked" value={summary?.blockedScans ?? 0} color="text-red-700" />
        <SummaryCard label="Duplicates" value={summary?.duplicateScans ?? 0} color="text-orange-700" />
      </section>

      <div className="grid gap-5 lg:grid-cols-[380px_minmax(0,1fr)]">
        <div className="grid gap-4">
          <section className="premium-card rounded-xl p-4">
            <p className="mb-3 text-sm font-bold text-slate-800">Scan Mode</p>

            <div className="flex overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              {(["TAP_IN", "TAP_OUT"] as const).map((dir) => (
                <button
                  key={dir}
                  type="button"
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

            <p className="mt-2 text-xs text-slate-500">
              Current mode:{" "}
              <span className="font-bold text-slate-800">
                {direction === "TAP_IN" ? "Tap In" : "Tap Out"}
              </span>
            </p>
          </section>

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

          {isOfflineReady && offlineScans.length > 0 && (
            <section className="rounded-xl border border-orange-200 bg-orange-50 p-4">
              <p className="text-xs font-bold text-orange-700 mb-2">OFFLINE SCANS (queued)</p>
              <div className="grid gap-1.5">
                {offlineScans.slice(0, 5).map((s, i) => (
                  <div key={i} className="flex items-center justify-between text-xs text-slate-700">
                    <span className="font-medium">{s.name}</span>
                    <span className={`rounded-full px-1.5 py-0.5 font-bold ${s.status === "VALID" ? "bg-emerald-100 text-emerald-700" : s.status === "DUPLICATE" ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"}`}>{s.status}</span>
                    <span className="text-slate-400">{s.direction === "TAP_IN" ? "IN" : "OUT"}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {!isOfflineReady && lastScan ? (
            <section
              className={`rounded-xl border p-4 ${
                lastScan.status === "VALID"
                  ? "border-green-200 bg-green-50"
                  : lastScan.status === "BLOCKED"
                    ? "border-red-200 bg-red-50"
                    : "border-yellow-200 bg-yellow-50"
              }`}
            >
              <div className="mb-1 flex items-center justify-between gap-3">
                <p className="text-sm font-bold text-slate-900">{lastScan.student.name}</p>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                    SCAN_STATUS_COLORS[lastScan.status] ?? "bg-slate-100 text-slate-700"
                  }`}
                >
                  {lastScan.status}
                </span>
              </div>

              <p className="text-xs text-slate-600">
                {lastScan.student.admissionNumber} · {lastScan.student.className ?? "No class"}
              </p>

              <p className="mt-1 text-xs text-slate-500">
                {lastScan.direction} · {new Date(lastScan.scannedAt).toLocaleTimeString()}
                {lastScan.reason ? ` · ${lastScan.reason}` : ""}
              </p>
            </section>
          ) : null}

          <section className="premium-card rounded-xl p-4">
            <p className="mb-3 text-sm font-bold text-slate-800">Filters</p>

            <div className="grid gap-3">
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

              <button
                className="btn btn-secondary"
                type="button"
                onClick={() => void loadRegister()}
                disabled={loading}
              >
                {loading ? "Loading…" : "Apply Filters"}
              </button>
            </div>
          </section>
        </div>

        <section className="premium-card overflow-hidden rounded-xl">
          <div className="border-b border-slate-100 px-4 py-3">
            <h2 className="text-base font-bold text-slate-950">Class Attendance Register</h2>
            <p className="text-xs text-slate-500">
              Shows all students for the selected date and class filters.
            </p>
          </div>

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

                    <td className="px-4 py-3 font-mono text-xs text-slate-600">
                      {row.student.admissionNumber}
                    </td>

                    <td className="px-4 py-3 text-slate-600">
                      {row.student.className ?? "—"}
                      {row.student.streamName ? ` / ${row.student.streamName}` : ""}
                    </td>

                    <td className="px-4 py-3 text-slate-700">
                      {formatTime(row.tapIn?.scannedAt)}
                    </td>

                    <td className="px-4 py-3 text-slate-700">
                      {formatTime(row.tapOut?.scannedAt)}
                    </td>

                    <td className="px-4 py-3">
                      <span
                        className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-bold ${
                          STATUS_COLORS[row.currentStatus]
                        }`}
                      >
                        {STATUS_LABELS[row.currentStatus]}
                      </span>
                    </td>

                    <td className="px-4 py-3 text-slate-500">
                      {row.lastScan ? (
                        <span>
                          {formatTime(row.lastScan.scannedAt)}
                          {row.lastScan.reason ? ` · ${row.lastScan.reason}` : ""}
                        </span>
                      ) : (
                        "—"
                      )}
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

                {!register && !loadError ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-slate-500">
                      Loading…
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
