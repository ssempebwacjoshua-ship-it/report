import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { WifiOffRegular } from "@fluentui/react-icons";
import { NfcScanPanel } from "../components/nfc/NfcScanPanel";
import { getSchoolBranding } from "../components/layout/branding";
import { useAppSettings } from "../components/layout/SettingsContext";
import { useNfcScanner, type ScanResult } from "../hooks/useNfcScanner";
import { useConnectivityStatus } from "../hooks/useConnectivityStatus";
import { useNfcOfflineSnapshotRefresh } from "../hooks/useNfcOfflineSnapshotRefresh";
import { useAuth } from "../contexts/AuthContext";
import {
  approveGateAttendanceOverride,
  fetchClassroomAttendanceReport,
  fetchAttendanceClasses,
  fetchGateAttendanceReport,
  fetchNfcAttendanceRegister,
  scanNfcAttendance,
  type AttendanceClassItem,
  type AttendanceCurrentStatus,
  type AttendanceRegisterResponse,
  type AttendanceRegisterRow,
  type ClassroomAttendanceReport,
  type GateAttendanceReport,
  type NfcAttendanceScanEvent,
} from "../client/studentCredentialsClient";
import { resolveOfflineNfcScan } from "../offline/offlineResolver";
import { getNextAttendanceDirection, getSnapshotMeta, hasRecentAttendancePunch, queueAttendanceEvent } from "../offline/offlineStore";
import { hashNfcLookupValue } from "../offline/offlineHash";
import { getSnapshotValidity } from "../offline/offlineStatus";
import { canOperateAttendance } from "../shared/permissions";
import { normalizeNfcScanValue } from "../shared/utils/nfcPayload";
import type { AttendanceDirection } from "../shared/types/studentCredentials";

const inputClass =
  "premium-control h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 outline-none focus:border-blue-400 focus:bg-white";

const selectClass =
  "premium-control h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 outline-none focus:border-blue-400 focus:bg-white";

const STATUS_LABELS: Record<AttendanceCurrentStatus, string> = {
  ABSENT: "Absent",
  PRESENT: "Present",
  LATE: "Late",
  OUT: "Tapped Out",
  OUT_ONLY: "Out Only",
  BLOCKED: "Blocked",
  DUPLICATE: "Duplicate",
};

const STATUS_COLORS: Record<AttendanceCurrentStatus, string> = {
  ABSENT: "bg-slate-100 text-slate-600",
  PRESENT: "bg-green-100 text-green-700",
  LATE: "bg-amber-100 text-amber-700",
  OUT: "bg-amber-100 text-amber-700",
  OUT_ONLY: "bg-purple-100 text-purple-700",
  BLOCKED: "bg-red-100 text-red-700",
  DUPLICATE: "bg-orange-100 text-orange-700",
};

const SCAN_STATUS_COLORS: Record<string, string> = {
  VALID: "bg-green-100 text-green-800",
  LATE: "bg-amber-100 text-amber-800",
  DUPLICATE: "bg-yellow-100 text-yellow-800",
  BLOCKED: "bg-red-100 text-red-800",
};

function formatTime(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatDateTime(iso: string | null | undefined) {
  if (!iso) return "â€”";
  return new Date(iso).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

type PrintMode = "FULL" | "PRESENT" | "ABSENT";

type AttendancePrintDocument = {
  html: string;
};

function escapeHtml(value: string | null | undefined) {
  return (value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;");
}

function formatPrintDate(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatPrintDateTime(value: string) {
  return new Date(value).toLocaleString([], {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function summarizePrintedRows(rows: GateAttendanceReport["rows"]) {
  const late = rows.filter((row) => row.attendanceStatus === "LATE").length;
  const present = rows.filter((row) => row.attendanceStatus === "PRESENT").length + late;
  const totalStudents = rows.length;
  return {
    totalStudents,
    present,
    absent: rows.filter((row) => row.attendanceStatus === "ABSENT").length,
    late,
    attendanceRate: totalStudents > 0 ? ((present / totalStudents) * 100).toFixed(1) : "0.0",
    onCampus: rows.filter((row) => row.campusStatus === "ON_CAMPUS").length,
    offCampus: rows.filter((row) => row.campusStatus === "OFF_CAMPUS").length,
  };
}

function buildAttendancePrintDocument(input: {
  schoolName: string;
  schoolAddress: string;
  schoolPhone: string;
  schoolEmail: string;
  schoolLogoUrl: string;
  date: string;
  className: string;
  streamName: string;
  studentType: string;
  attendanceStatus: string;
  campusStatus: string;
  generatedAt: string;
  rows: GateAttendanceReport["rows"];
}): AttendancePrintDocument {
  const summary = summarizePrintedRows(input.rows);
  const contactLine = [input.schoolAddress, input.schoolPhone, input.schoolEmail]
    .filter((value) => value.trim().length > 0)
    .join(" | ");
  const rowsHtml = input.rows.map((row, index) => `
    <tr>
      <td>${index + 1}</td>
      <td>${escapeHtml(row.studentName)}</td>
      <td>${escapeHtml(row.admissionNumber)}</td>
      <td>${escapeHtml(row.className ?? "—")}</td>
      <td>${escapeHtml(row.streamName ?? "—")}</td>
      <td>${escapeHtml(row.scholarType ?? "—")}</td>
      <td>${escapeHtml(row.arrivalTime ? formatPrintDateTime(row.arrivalTime) : "Not recorded")}</td>
      <td>${escapeHtml(row.departureTime ? formatPrintDateTime(row.departureTime) : "Not recorded")}</td>
      <td>${escapeHtml(row.attendanceStatus)}</td>
      <td>${escapeHtml(row.campusStatus)}</td>
      <td>${escapeHtml(row.readerUsed ?? "—")}</td>
    </tr>
  `).join("");

  const summaryItems = [
    ["Total students", String(summary.totalStudents)],
    ["Present", String(summary.present)],
    ["Absent", String(summary.absent)],
    ["Late", String(summary.late)],
    ["Attendance rate", `${summary.attendanceRate}%`],
    ["On campus", String(summary.onCampus)],
    ["Off campus", String(summary.offCampus)],
  ].map(([label, value]) => `
    <div class="summary-card">
      <div class="summary-label">${escapeHtml(label)}</div>
      <div class="summary-value">${escapeHtml(value)}</div>
    </div>
  `).join("");

  const filtersHtml = [
    ["Selected date", formatPrintDate(input.date)],
    ["Class", input.className],
    ["Stream", input.streamName],
    ["Student type", input.studentType],
    ["Attendance status", input.attendanceStatus],
    ["Campus status", input.campusStatus],
    ["Generated", formatPrintDateTime(input.generatedAt)],
  ].map(([label, value]) => `
    <div class="filter-item">
      <span class="filter-label">${escapeHtml(label)}</span>
      <span class="filter-value">${escapeHtml(value)}</span>
    </div>
  `).join("");

  const logoHtml = input.schoolLogoUrl
    ? `<img class="school-logo" src="${escapeHtml(input.schoolLogoUrl)}" alt="${escapeHtml(input.schoolName)} logo" />`
    : "";

  return {
    html: `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Daily Attendance Register</title>
    <style>
      @page { size: A4 landscape; margin: 12mm; }
      * { box-sizing: border-box; }
      body { margin: 0; font-family: Inter, "Segoe UI", sans-serif; color: #0f172a; background: #ffffff; }
      .page { width: 100%; }
      .header { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; border-bottom: 2px solid #0f172a; padding-bottom: 12px; }
      .brand { display: flex; gap: 14px; align-items: flex-start; }
      .school-logo { width: 64px; height: 64px; object-fit: contain; }
      .school-name { font-size: 22px; font-weight: 800; line-height: 1.1; }
      .school-contact { margin-top: 4px; font-size: 12px; color: #475569; }
      .title { margin-top: 8px; font-size: 17px; font-weight: 800; letter-spacing: 0.08em; }
      .filters { margin-top: 14px; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px 16px; }
      .filter-item { border: 1px solid #cbd5e1; border-radius: 8px; padding: 8px 10px; }
      .filter-label { display: block; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #64748b; }
      .filter-value { display: block; margin-top: 3px; font-size: 13px; font-weight: 700; }
      .summary-grid { margin-top: 14px; display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 8px; }
      .summary-card { border: 1px solid #cbd5e1; border-radius: 8px; padding: 8px 10px; background: #f8fafc; }
      .summary-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #64748b; }
      .summary-value { margin-top: 4px; font-size: 18px; font-weight: 800; }
      table { width: 100%; margin-top: 14px; border-collapse: collapse; font-size: 11px; }
      thead { display: table-header-group; }
      th, td { border: 1px solid #cbd5e1; padding: 7px 8px; vertical-align: top; text-align: left; }
      th { background: #e2e8f0; font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.06em; }
      tr { break-inside: avoid; page-break-inside: avoid; }
      .signatures { margin-top: 18px; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; }
      .signature-line { border-top: 1px solid #0f172a; padding-top: 6px; font-size: 12px; font-weight: 600; }
      .footer { margin-top: 12px; font-size: 11px; color: #475569; }
    </style>
  </head>
  <body>
    <main class="page">
      <section class="header">
        <div class="brand">
          ${logoHtml}
          <div>
            <div class="school-name">${escapeHtml(input.schoolName)}</div>
            ${contactLine ? `<div class="school-contact">${escapeHtml(contactLine)}</div>` : ""}
            <div class="title">DAILY ATTENDANCE REGISTER</div>
          </div>
        </div>
      </section>
      <section class="filters">${filtersHtml}</section>
      <section class="summary-grid">${summaryItems}</section>
      <table>
        <thead>
          <tr>
            <th>Number</th>
            <th>Student name</th>
            <th>Admission number</th>
            <th>Class</th>
            <th>Stream</th>
            <th>Student type</th>
            <th>Arrival time</th>
            <th>Departure time</th>
            <th>Attendance status</th>
            <th>Campus status</th>
            <th>Reader used</th>
          </tr>
        </thead>
        <tbody>${rowsHtml}</tbody>
      </table>
      <section class="signatures">
        <div class="signature-line">Prepared by: ____________________</div>
        <div class="signature-line">Verified by: ____________________</div>
        <div class="signature-line">Headteacher: ____________________</div>
      </section>
      <div class="footer">Page generation timestamp: ${escapeHtml(formatPrintDateTime(input.generatedAt))}</div>
    </main>
  </body>
</html>`,
  };
}

function SummaryCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-1 text-2xl font-bold leading-none ${color}`}>{value}</p>
    </div>
  );
}

function ClickableSummaryCard({
  label,
  value,
  color,
  onClick,
}: {
  label: string;
  value: number;
  color: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm text-left transition hover:border-blue-300 hover:shadow-md active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-1"
    >
      <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-1 text-2xl font-bold leading-none ${color}`}>{value}</p>
      <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-blue-500">View list →</p>
    </button>
  );
}

// ── Drill-down modal ───────────────────────────────────────────────────────────

function DrillDownModal({
  title,
  status,
  rows,
  filters,
  onClose,
}: {
  title: string;
  status: "PRESENT" | "ABSENT";
  rows: AttendanceRegisterRow[];
  filters: { date: string; className: string | null; studentType: string };
  onClose: () => void;
}) {
  const [search, setSearch] = useState("");

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const statusRows = rows.filter((r) => r.currentStatus === status);

  const filtered = statusRows.filter((r) => {
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    return (
      r.student.name.toLowerCase().includes(q) ||
      r.student.admissionNumber.toLowerCase().includes(q)
    );
  });

  const activeFilters: string[] = [filters.date];
  if (filters.className) activeFilters.push(filters.className);
  if (filters.studentType !== "ALL") activeFilters.push(filters.studentType === "DAY" ? "Day Students" : "Boarding Students");

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-slate-950/50 backdrop-blur-sm pt-8 px-4 pb-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl rounded-2xl border border-slate-200 bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <h2 className="text-base font-bold text-slate-950">{title}</h2>
            <p className="mt-0.5 text-xs text-slate-500">{statusRows.length} student{statusRows.length !== 1 ? "s" : ""}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-700"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Active filters */}
        <div className="flex flex-wrap gap-2 border-b border-slate-100 px-5 py-3">
          {activeFilters.map((f) => (
            <span
              key={f}
              className="inline-flex items-center rounded-full border border-blue-100 bg-blue-50 px-2.5 py-0.5 text-[11px] font-semibold text-blue-700"
            >
              {f}
            </span>
          ))}
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold ${STATUS_COLORS[status]}`}
          >
            {STATUS_LABELS[status]}
          </span>
        </div>

        {/* Search */}
        <div className="px-5 py-3 border-b border-slate-100">
          <input
            type="search"
            placeholder="Search by name or admission number…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={inputClass + " w-full"}
            autoFocus
          />
        </div>

        {/* List */}
        <div className="max-h-[55vh] overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="px-5 py-12 text-center">
              <p className="text-sm font-semibold text-slate-500">
                {statusRows.length === 0
                  ? `No ${STATUS_LABELS[status].toLowerCase()} students for the selected filters.`
                  : "No students match your search."}
              </p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left">
                  <th className="px-5 py-2.5 font-semibold text-slate-600">Student</th>
                  <th className="px-4 py-2.5 font-semibold text-slate-600">Adm #</th>
                  <th className="px-4 py-2.5 font-semibold text-slate-600">Class</th>
                  <th className="px-4 py-2.5 font-semibold text-slate-600">Type</th>
                  {status === "PRESENT" && (
                    <th className="px-4 py-2.5 font-semibold text-slate-600">Check-in</th>
                  )}
                  {status === "ABSENT" && (
                    <th className="px-4 py-2.5 font-semibold text-slate-600">Last Tap</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((row) => (
                  <tr key={row.student.id} className="hover:bg-slate-50/60">
                    <td className="px-5 py-3 font-medium text-slate-900">{row.student.name}</td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-600">{row.student.admissionNumber}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {row.student.className ?? "—"}
                      {row.student.streamName ? ` / ${row.student.streamName}` : ""}
                    </td>
                    <td className="px-4 py-3">
                      {row.student.studentType ? (
                        <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ${row.student.studentType === "DAY" ? "bg-sky-100 text-sky-700" : "bg-violet-100 text-violet-700"}`}>
                          {row.student.studentType}
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    {status === "PRESENT" && (
                      <td className="px-4 py-3 text-slate-700 font-medium">
                        {formatTime(row.tapIn?.scannedAt)}
                      </td>
                    )}
                    {status === "ABSENT" && (
                      <td className="px-4 py-3 text-slate-500">
                        {row.lastScan ? formatTime(row.lastScan.scannedAt) : "—"}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-100 px-5 py-3 text-right">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Device ID helper ───────────────────────────────────────────────────────────

function getDeviceId(): string {
  const key = "schoolconnect_nfc_device_id";
  let id = localStorage.getItem(key);
  if (!id) { id = crypto.randomUUID(); localStorage.setItem(key, id); }
  return id;
}

function offlineReasonMessage(reason?: string) {
  switch (reason) {
    case "no_snapshot": return "Local Attendance Register is not downloaded yet. Go online to update the Attendance Register.";
    case "expired": return "Local Attendance Register needs updating.";
    case "wrong_school": return "Local Attendance Register belongs to another school.";
    case "wrong_device": return "Local Attendance Register belongs to another device.";
    case "missing_module": return "Local Attendance Register is missing attendance data.";
    case "empty_students": return "Local Attendance Register contains no students.";
    case "empty_tags": return "Local Attendance Register contains no NFC tags.";
    case "offline_disabled_by_policy": return "Offline attendance scanning is disabled by school policy.";
    default: return "Local Attendance Register is not ready on this device.";
  }
}

// ── Page ───────────────────────────────────────────────────────────────────────

export function NfcAttendancePage() {
  const [params] = useSearchParams();
  const { user } = useAuth();
  const attendanceOperator = canOperateAttendance(user?.role);
  const { settings } = useAppSettings() ?? {};
  const schoolBranding = getSchoolBranding(settings?.sections.school, "School Connect");
  const deviceId = useRef(getDeviceId()).current;
  const initialViewParam = params.get("view");
  const initialAttendanceStatusParam = params.get("attendanceStatus");
  const initialCampusStatusParam = params.get("campusStatus");

  const { isOfflineReady, pendingCount, triggerSync } = useConnectivityStatus(user?.schoolId, deviceId, "attendance");
  const snapshotRefresh = useNfcOfflineSnapshotRefresh({
    schoolId: user?.schoolId,
    deviceId,
    mode: "ATTENDANCE",
    requiredModule: "attendance",
    enabled: !!user,
  });

  const [register, setRegister] = useState<AttendanceRegisterResponse | null>(null);
  const [gateReport, setGateReport] = useState<GateAttendanceReport | null>(null);
  const [classroomReport, setClassroomReport] = useState<ClassroomAttendanceReport | null>(null);
  const [lastScan, setLastScan] = useState<NfcAttendanceScanEvent | null>(null);
  const [offlineScans, setOfflineScans] = useState<Array<{ name: string; admissionNumber?: string; className?: string | null; direction: string; status: string; scannedAt: string; syncStatus: string }>>([]);
  const [view, setView] = useState<"REGISTER" | "GATE" | "CLASSROOM">(
    initialViewParam === "GATE" || initialViewParam === "CLASSROOM" ? initialViewParam : "REGISTER",
  );

  const [direction, setDirection] = useState<AttendanceDirection>("TAP_IN");
  const directionRef = useRef<AttendanceDirection>("TAP_IN");
  directionRef.current = direction;

  const [date, setDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [classId, setClassId] = useState("");
  const [streamId, setStreamId] = useState("");
  const [studentType, setStudentType] = useState<"ALL" | "DAY" | "BOARDING">("ALL");
  const [search, setSearch] = useState("");
  const [gateStatusFilter, setGateStatusFilter] = useState<"ALL" | "PRESENT" | "LATE" | "ABSENT">(
    initialAttendanceStatusParam === "PRESENT" || initialAttendanceStatusParam === "LATE" || initialAttendanceStatusParam === "ABSENT"
      ? initialAttendanceStatusParam
      : "ALL",
  );
  const [campusStatusFilter, setCampusStatusFilter] = useState<"ALL" | "ON_CAMPUS" | "OFF_CAMPUS">(
    initialCampusStatusParam === "ON_CAMPUS" || initialCampusStatusParam === "OFF_CAMPUS"
      ? initialCampusStatusParam
      : "ALL",
  );
  const [departureMissingOnly, setDepartureMissingOnly] = useState(false);
  const [classroomSessionFilter, setClassroomSessionFilter] = useState<"ALL" | "MORNING_CLASS" | "NIGHT_PREP" | "UNCLASSIFIED">("ALL");
  const [registerPage, setRegisterPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(20);

  const [classes, setClasses] = useState<AttendanceClassItem[]>([]);
  const [drillDown, setDrillDown] = useState<"PRESENT" | "ABSENT" | null>(null);

  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [printing, setPrinting] = useState<PrintMode | null>(null);

  const todayDate = new Date().toISOString().split("T")[0]!;

  // Load class list once
  useEffect(() => {
    fetchAttendanceClasses()
      .then((data) => setClasses(data.classes))
      .catch(() => { /* silently ignore — filters still work with UUIDs */ });
  }, []);

  // When classId changes, clear streamId if it doesn't belong to the new class
  const selectedClass = classes.find((c) => c.id === classId) ?? null;
  const availableStreams = selectedClass?.streams ?? [];
  const selectedStream = availableStreams.find((stream) => stream.id === streamId) ?? null;

  function buildGateFilters(
    attendanceStatusOverride?: "ALL" | "PRESENT" | "LATE" | "ABSENT",
  ) {
    return {
      date,
      classId: classId || undefined,
      streamId: streamId || undefined,
      studentType,
      attendanceStatus: attendanceStatusOverride ?? gateStatusFilter,
      campusStatus: campusStatusFilter,
      departureMissing: departureMissingOnly || undefined,
    };
  }

  async function loadRegister() {
    setLoading(true);
    setLoadError("");
    try {
      const data = await fetchNfcAttendanceRegister({
        date,
        classId: classId || undefined,
        streamId: streamId || undefined,
        search: search || undefined,
        studentType: studentType !== "ALL" ? studentType : undefined,
      });
      setRegister(data);
    } catch (caught) {
      setLoadError(caught instanceof Error ? caught.message : "Could not load attendance register");
    } finally {
      setLoading(false);
    }
  }

  async function loadGateReport() {
    setLoading(true);
    setLoadError("");
    try {
      const data = await fetchGateAttendanceReport({
        ...buildGateFilters(),
        search: search || undefined,
      });
      setGateReport(data);
    } catch (caught) {
      setLoadError(caught instanceof Error ? caught.message : "Could not load gate attendance report");
    } finally {
      setLoading(false);
    }
  }

  async function loadClassroomReport() {
    setLoading(true);
    setLoadError("");
    try {
      const data = await fetchClassroomAttendanceReport({
        date,
        classId: classId || undefined,
        streamId: streamId || undefined,
        search: search || undefined,
        studentType,
        sessionType: classroomSessionFilter,
      });
      setClassroomReport(data);
    } catch (caught) {
      setLoadError(caught instanceof Error ? caught.message : "Could not load classroom attendance report");
    } finally {
      setLoading(false);
    }
  }

  async function loadCurrentView() {
    setRegisterPage(1);
    if (view === "GATE") {
      await loadGateReport();
      return;
    }
    if (view === "CLASSROOM") {
      await loadClassroomReport();
      return;
    }
    await loadRegister();
  }

  function handleResetFilters() {
    setDate(todayDate);
    setClassId("");
    setStreamId("");
    setStudentType("ALL");
    setSearch("");
    setGateStatusFilter("ALL");
    setCampusStatusFilter("ALL");
    setDepartureMissingOnly(false);
    setClassroomSessionFilter("ALL");
    setLoadError("");
    setRegisterPage(1);
  }

  async function handlePrint(mode: PrintMode) {
    setPrinting(mode);
    setLoadError("");
    try {
      const attendanceStatus = mode === "FULL"
        ? gateStatusFilter
        : mode === "PRESENT"
          ? "PRESENT"
          : "ABSENT";
      const freshReport = await fetchGateAttendanceReport(buildGateFilters(attendanceStatus));
      const printRows = mode === "FULL"
        ? freshReport.rows
        : mode === "PRESENT"
          ? freshReport.rows.filter((row) => row.attendanceStatus === "PRESENT" || row.attendanceStatus === "LATE")
          : freshReport.rows.filter((row) => row.attendanceStatus === "ABSENT");

      if (printRows.length === 0) {
        setLoadError("No students match these filters.");
        return;
      }

      const printWindow = window.open("", "attendance-register-print", "width=1280,height=900");
      if (!printWindow) {
        throw new Error("Print window was blocked. Please allow pop-ups and try again.");
      }

      const generatedAt = new Date().toISOString();
      const documentPayload = buildAttendancePrintDocument({
        schoolName: schoolBranding.schoolName,
        schoolAddress: schoolBranding.address,
        schoolPhone: schoolBranding.phone,
        schoolEmail: schoolBranding.email,
        schoolLogoUrl: schoolBranding.logoUrl,
        date: freshReport.date,
        className: selectedClass?.name ?? "All classes",
        streamName: selectedStream?.name ?? "All streams",
        studentType: studentType === "ALL" ? "All students" : studentType === "DAY" ? "Day students" : "Boarding students",
        attendanceStatus: attendanceStatus === "ALL" ? "All statuses" : attendanceStatus,
        campusStatus: campusStatusFilter === "ALL" ? "All campus statuses" : campusStatusFilter,
        generatedAt,
        rows: printRows,
      });

      let printed = false;
      const finalizePrint = () => {
        if (printed) return;
        printed = true;
        printWindow.print();
        printWindow.close();
      };
      printWindow.onload = finalizePrint;
      printWindow.document.open();
      printWindow.document.write(documentPayload.html);
      printWindow.document.close();
      printWindow.focus();
      window.setTimeout(finalizePrint, 250);
    } catch (caught) {
      setLoadError(caught instanceof Error ? caught.message : "Could not prepare attendance register printout");
    } finally {
      setPrinting(null);
    }
  }

  useEffect(() => {
    void loadCurrentView();
    // initial load only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void loadCurrentView();
    // reload when switching tabs
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  async function handleScan({ tokenOrUid, idempotencyKey, deviceId: scanDeviceId }: ScanResult) {
    if (!user?.schoolId) return;
    const validity = await getSnapshotValidity({ schoolId: user.schoolId, deviceId, mode: "ATTENDANCE", requiredModule: "attendance" });
    if (!validity.valid) {
      if (typeof navigator !== "undefined" && !navigator.onLine) throw new Error(offlineReasonMessage(validity.reason));
      const data = await scanNfcAttendance({
        tokenOrUid,
        direction: directionRef.current,
        idempotencyKey,
        deviceId: scanDeviceId,
      });
      setLastScan(data.scan);
      await loadRegister();
      return;
    }

    const resolve = await resolveOfflineNfcScan(user.schoolId, tokenOrUid);
    const meta = await getSnapshotMeta({ schoolId: user.schoolId, deviceId, mode: "ATTENDANCE" });
    const scannedAt = new Date().toISOString();
    const dateStr = scannedAt.split("T")[0]!;

    let status = "VALID";
    let reason: string | null = null;
    let currentDirection: AttendanceDirection = "TAP_IN";
    if (resolve.blocked) {
      status = "BLOCKED";
      reason = resolve.reason ?? "blocked";
      currentDirection = directionRef.current;
    } else if (resolve.student) {
      currentDirection = await getNextAttendanceDirection(user.schoolId, resolve.student.id, dateStr);
      const recentDuplicate = await hasRecentAttendancePunch(user.schoolId, resolve.student.id, currentDirection, scannedAt);
      if (recentDuplicate) { status = "DUPLICATE"; reason = "recent duplicate punch"; }
    }

    const studentName = resolve.student ? `${resolve.student.firstName} ${resolve.student.lastName}`.trim() : "Unknown";
    const studentSummary = {
      id: resolve.student?.id ?? "unknown",
      name: studentName,
      admissionNumber: resolve.student?.admissionNumber ?? "Unknown",
      className: resolve.student?.className ?? null,
      streamName: resolve.student?.streamName ?? null,
    };

    if (status === "DUPLICATE") {
      setLastScan({ student: studentSummary, direction: currentDirection, status: "DUPLICATE", reason, scannedAt });
      setOfflineScans((prev) => [{
        name: studentName,
        admissionNumber: resolve.student?.admissionNumber,
        className: resolve.student?.className,
        direction: currentDirection,
        status,
        scannedAt,
        syncStatus: "SKIPPED",
      }, ...prev.slice(0, 19)]);
      return;
    }

    const tokenOrUidHash = await hashNfcLookupValue(normalizeNfcScanValue(tokenOrUid));
    await queueAttendanceEvent({
      schoolId: user.schoolId,
      deviceId: scanDeviceId ?? deviceId,
      snapshotId: meta?.snapshotId ?? "unknown",
      studentId: resolve.student?.id ?? null,
      direction: currentDirection,
      payload: {
        actionType: "ATTENDANCE_SCAN",
        tokenOrUidHash,
        studentId: resolve.student?.id ?? null,
        tagId: resolve.tag?.id ?? null,
        direction: currentDirection,
        status,
        reason,
        scannedAt,
      },
    });

    setLastScan({ student: studentSummary, direction: currentDirection, status: status as NfcAttendanceScanEvent["status"], reason, scannedAt });
    setOfflineScans((prev) => [{
      name: studentName,
      admissionNumber: resolve.student?.admissionNumber,
      className: resolve.student?.className,
      direction: currentDirection,
      status,
      scannedAt,
      syncStatus: "PENDING",
    }, ...prev.slice(0, 19)]);
    if (typeof navigator !== "undefined" && navigator.onLine) void triggerSync();
  }

  async function handleApproveOverride(studentId: string) {
    const reason = window.prompt("Reason for manual gate override?");
    if (!reason?.trim()) return;
    const expiresAt = window.prompt("Override expiry (YYYY-MM-DDTHH:MM)?", `${date}T18:00`);
    if (!expiresAt?.trim()) return;
    try {
      await approveGateAttendanceOverride({ studentId, reason: reason.trim(), expiresAt });
      await loadGateReport();
    } catch (caught) {
      setLoadError(caught instanceof Error ? caught.message : "Could not approve gate override");
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
  const registerRows = register?.rows ?? [];
  const totalRegisterRows = registerRows.length;
  const totalRegisterPages = Math.max(1, Math.ceil(totalRegisterRows / rowsPerPage));
  const currentRegisterPage = Math.min(registerPage, totalRegisterPages);
  const registerPageStart = totalRegisterRows === 0 ? 0 : (currentRegisterPage - 1) * rowsPerPage;
  const paginatedRegisterRows = registerRows.slice(registerPageStart, registerPageStart + rowsPerPage);
  const registerPageEnd = totalRegisterRows === 0 ? 0 : Math.min(totalRegisterRows, registerPageStart + rowsPerPage);

  // Drill-down filter context label
  const drillDownFilters = {
    date,
    className: selectedClass?.name ?? null,
    studentType,
  };

  return (
    <main className="grid gap-4 lg:gap-5">
      <header className="page-header pb-0">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-wide text-blue-600">NFC Operations</p>
            <h1 className="text-xl font-bold text-slate-950 sm:text-2xl">Attendance Operations</h1>
            <div className="mt-3 flex flex-wrap gap-2">
              {([
                ["REGISTER", "Register"],
                ["GATE", "Gate View"],
                ["CLASSROOM", "Classroom View"],
              ] as const).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setView(key)}
                  className={`rounded-full px-4 py-2 text-xs font-black ${view === key ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-700"}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3 lg:justify-end">
            <div className="flex min-w-[180px] items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
              <input
                type="date"
                aria-label="Attendance date"
                className="w-full border-0 bg-transparent p-0 text-sm font-medium text-slate-900 outline-none"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <button
              type="button"
              className="btn btn-secondary px-4"
              onClick={() => void handlePrint("FULL")}
              disabled={loading || printing !== null}
            >
              {printing === "FULL" ? "Preparing..." : "Export"}
            </button>
          </div>
        </div>
      </header>

      {isOfflineReady && (
        <div className="flex items-center gap-3 rounded-xl border border-orange-200 bg-orange-50 p-3">
          <WifiOffRegular className="h-5 w-5 text-orange-600 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-orange-800">Local Attendance Register Active</p>
            <p className="text-xs text-orange-600">Punches are saved locally first. {pendingCount > 0 ? `${pendingCount} pending attendance sync.` : "Will sync when connection returns."}</p>
          </div>
        </div>
      )}

      {!isOfflineReady && snapshotRefresh.validity && !snapshotRefresh.validity.valid && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
          <p className="font-bold">Local Attendance Register: {offlineReasonMessage(snapshotRefresh.validity.reason)}</p>
          <p className="mt-1">
            {snapshotRefresh.isRefreshing ? "Updating Attendance Register in the background..." : "Update Attendance Register while online before local-first scanning."}
            {snapshotRefresh.refreshError ? ` Last refresh failed: ${snapshotRefresh.refreshError}` : ""}
          </p>
        </div>
      )}

      {snapshotRefresh.validity?.valid && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-800">
          <p className="font-bold">Local Attendance Register is ready.</p>
          <p className="mt-1">
            Students: {snapshotRefresh.validity.diagnostics.studentCount} · Tags: {snapshotRefresh.validity.diagnostics.tagCount} · Pending attendance sync: {pendingCount}
          </p>
        </div>
      )}

      {loadError && !isOfflineReady ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {loadError}
        </div>
      ) : null}

      {/* Summary cards — PRESENT and ABSENT are clickable */}
      {view === "REGISTER" ? (
        <section className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <SummaryCard label="Total Students" value={summary?.totalStudents ?? 0} color="text-slate-900" />
          <ClickableSummaryCard
            label="Present"
            value={summary?.present ?? 0}
            color="text-green-700"
            onClick={() => setDrillDown("PRESENT")}
          />
          <SummaryCard label="Tapped Out" value={summary?.out ?? 0} color="text-amber-700" />
          <ClickableSummaryCard
            label="Absent"
            value={summary?.absent ?? 0}
            color="text-slate-600"
            onClick={() => setDrillDown("ABSENT")}
          />
          <SummaryCard label="Blocked" value={summary?.blockedScans ?? 0} color="text-red-700" />
          <SummaryCard label="Duplicates" value={summary?.duplicateScans ?? 0} color="text-orange-700" />
        </section>
      ) : null}

      {view === "GATE" ? (
        <section className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <SummaryCard label="Total" value={gateReport?.summary.totalStudents ?? 0} color="text-slate-900" />
          <SummaryCard label="Present" value={gateReport?.summary.present ?? 0} color="text-green-700" />
          <SummaryCard label="Late" value={gateReport?.summary.late ?? 0} color="text-amber-700" />
          <SummaryCard label="On Campus" value={gateReport?.summary.onCampus ?? 0} color="text-blue-700" />
          <SummaryCard label="Missing Departure" value={gateReport?.summary.departureMissing ?? 0} color="text-red-700" />
          <SummaryCard label="Overrides" value={gateReport?.summary.manualOverrides ?? 0} color="text-slate-900" />
        </section>
      ) : null}

      {view === "CLASSROOM" ? (
        <section className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <SummaryCard label="Events" value={classroomReport?.summary.totalEvents ?? 0} color="text-slate-900" />
          <SummaryCard label="Morning Present" value={classroomReport?.summary.morningPresent ?? 0} color="text-green-700" />
          <SummaryCard label="Night Prep" value={classroomReport?.summary.nightPrepPresent ?? 0} color="text-blue-700" />
          <SummaryCard label="Missing Boarders" value={classroomReport?.summary.missingBoarders ?? 0} color="text-red-700" />
          <SummaryCard label="Wrong Class" value={classroomReport?.summary.wrongClassAttempts ?? 0} color="text-amber-700" />
          <SummaryCard label="Session Closed" value={classroomReport?.summary.sessionClosedScans ?? 0} color="text-slate-700" />
        </section>
      ) : null}

      <div
        data-testid="attendance-main-layout"
        className={attendanceOperator ? "grid gap-5 lg:grid-cols-[380px_minmax(0,1fr)]" : "grid gap-5"}
      >
        <div className="grid gap-4">
          {attendanceOperator ? (
            <>
              <section className="premium-card rounded-xl p-4">
                <p className="mb-3 text-sm font-bold text-slate-800">Punch Mode</p>
                <div className="flex overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                  {(["TAP_IN", "TAP_OUT"] as const).map((dir) => (
                    <button
                      key={dir}
                      type="button"
                      onClick={() => setDirection(dir)}
                      className={`flex-1 py-3 text-sm font-semibold transition-colors ${
                        direction === dir ? "bg-blue-600 text-white" : "text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      {dir === "TAP_IN" ? "Punch IN" : "Punch OUT"}
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  Current mode:{" "}
                  <span className="font-bold text-slate-800">
                    {direction === "TAP_IN" ? "Punch IN" : "Punch OUT"}
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
                scanLabel="Start Attendance Scanner"
              />

              {offlineScans.length > 0 && (
                <section className="rounded-xl border border-orange-200 bg-orange-50 p-4">
                  <p className="text-xs font-bold text-orange-700 mb-2">LOCAL PUNCHES</p>
                  <div className="grid gap-1.5">
                    {offlineScans.slice(0, 5).map((s, i) => (
                      <div key={i} className="flex items-center justify-between text-xs text-slate-700">
                        <span className="font-medium">{s.name}</span>
                        <span className={`rounded-full px-1.5 py-0.5 font-bold ${s.status === "VALID" ? "bg-emerald-100 text-emerald-700" : s.status === "LATE" ? "bg-amber-100 text-amber-700" : s.status === "DUPLICATE" ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-700"}`}>{s.status}</span>
                        <span className="text-slate-400">{s.direction === "TAP_IN" ? "Punch IN" : "Punch OUT"} · {s.syncStatus}</span>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {lastScan ? (
                <section
                  className={`rounded-xl border p-4 ${
                    lastScan.status === "VALID" || lastScan.status === "LATE"
                      ? "border-green-200 bg-green-50"
                      : lastScan.status === "BLOCKED"
                        ? "border-red-200 bg-red-50"
                        : "border-yellow-200 bg-yellow-50"
                  }`}
                >
                  <div className="mb-1 flex items-center justify-between gap-3">
                    <p className="text-sm font-bold text-slate-900">{lastScan.student.name}</p>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${SCAN_STATUS_COLORS[lastScan.status] ?? "bg-slate-100 text-slate-700"}`}>
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
            </>
          ) : null}

          {/* Filters */}
          <section className="premium-card rounded-xl p-4">
            <p className="mb-3 text-sm font-bold text-slate-800">Filters</p>
            <div data-testid="attendance-filter-grid" className="grid gap-3 xl:grid-cols-[160px_220px_180px_180px_minmax(0,1fr)]">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600">Date</label>
                <input
                  type="date"
                  className={inputClass + " w-full"}
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600">Student Type</label>
                <div className="flex overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                  {(["ALL", "DAY", "BOARDING"] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setStudentType(t)}
                      className={`flex-1 py-2 text-xs font-semibold transition-colors ${
                        studentType === t ? "bg-blue-600 text-white" : "text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      {t === "ALL" ? "All" : t === "DAY" ? "Day" : "Boarding"}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600">Class</label>
                {classes.length > 0 ? (
                  <select
                    className={selectClass + " w-full"}
                    value={classId}
                    onChange={(e) => {
                      setClassId(e.target.value);
                      setStreamId("");
                    }}
                  >
                    <option value="">All Classes</option>
                    {classes.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    className={inputClass + " w-full"}
                    value={classId}
                    onChange={(e) => setClassId(e.target.value)}
                    placeholder="Class ID"
                  />
                )}
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600">Stream</label>
                {availableStreams.length > 0 ? (
                  <select
                    className={selectClass + " w-full"}
                    value={streamId}
                    onChange={(e) => setStreamId(e.target.value)}
                  >
                    <option value="">All Streams</option>
                    {availableStreams.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    className={inputClass + " w-full"}
                    value={streamId}
                    onChange={(e) => setStreamId(e.target.value)}
                    placeholder={classId ? "No streams for this class" : "Stream ID"}
                    disabled={!!classId && availableStreams.length === 0}
                  />
                )}
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600">Search Student</label>
                <input
                  className={inputClass + " w-full"}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Name or admission number"
                />
              </div>

              {view === "GATE" ? (
                <>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-600">Attendance Status</label>
                    <select className={selectClass + " w-full"} value={gateStatusFilter} onChange={(e) => setGateStatusFilter(e.target.value as typeof gateStatusFilter)}>
                      <option value="ALL">All</option>
                      <option value="PRESENT">Present</option>
                      <option value="LATE">Late</option>
                      <option value="ABSENT">Absent</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-600">Campus Status</label>
                    <select className={selectClass + " w-full"} value={campusStatusFilter} onChange={(e) => setCampusStatusFilter(e.target.value as typeof campusStatusFilter)}>
                      <option value="ALL">All</option>
                      <option value="ON_CAMPUS">On Campus</option>
                      <option value="OFF_CAMPUS">Off Campus</option>
                    </select>
                  </div>
                  <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 xl:col-span-2">
                    <input type="checkbox" checked={departureMissingOnly} onChange={(e) => setDepartureMissingOnly(e.target.checked)} />
                    Departure not recorded
                  </label>
                </>
              ) : null}

              {view === "CLASSROOM" ? (
                <div className="xl:col-span-2">
                  <label className="mb-1 block text-xs font-semibold text-slate-600">Classroom Session</label>
                  <select className={selectClass + " w-full"} value={classroomSessionFilter} onChange={(e) => setClassroomSessionFilter(e.target.value as typeof classroomSessionFilter)}>
                    <option value="ALL">All</option>
                    <option value="MORNING_CLASS">Morning Class</option>
                    <option value="NIGHT_PREP">Night Prep</option>
                    <option value="UNCLASSIFIED">Unclassified</option>
                  </select>
                </div>
              ) : null}
            </div>

            <div className="mt-4 flex flex-col gap-3 border-t border-slate-100 pt-3 lg:flex-row lg:items-end lg:justify-between">
              <div data-testid="attendance-filter-actions" className="flex flex-wrap items-center gap-2">
                <button
                  className="btn btn-primary px-5"
                  type="button"
                  onClick={() => void loadCurrentView()}
                  disabled={loading}
                >
                  {loading ? "Loading…" : "Apply Filters"}
                </button>
                <button
                  className="btn btn-secondary px-4"
                  type="button"
                  onClick={() => {
                    handleResetFilters();
                    window.setTimeout(() => {
                      void loadCurrentView();
                    }, 0);
                  }}
                >
                  Reset
                </button>
              </div>

              <div className="flex flex-col gap-2 lg:items-end">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wide text-slate-600">Print Register</p>
                  <p className="mt-1 text-xs text-slate-500">One fresh fetch before printing</p>
                </div>
                <div data-testid="attendance-print-actions" className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="btn btn-secondary justify-center px-4"
                    onClick={() => void handlePrint("FULL")}
                    disabled={loading || printing !== null}
                  >
                    {printing === "FULL" ? "Preparing..." : "Full Register"}
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary justify-center px-4"
                    onClick={() => void handlePrint("PRESENT")}
                    disabled={loading || printing !== null}
                  >
                    {printing === "PRESENT" ? "Preparing..." : "Present Students"}
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary justify-center px-4"
                    onClick={() => void handlePrint("ABSENT")}
                    disabled={loading || printing !== null}
                  >
                    {printing === "ABSENT" ? "Preparing..." : "Absent Students"}
                  </button>
                </div>
              </div>
            </div>
          </section>
        </div>

	        {view === "REGISTER" ? (
	        <section data-testid="attendance-register-card" className="premium-card overflow-hidden rounded-xl">
          <div className="border-b border-slate-100 px-4 py-3">
            <h2 className="text-base font-bold text-slate-950">Class Attendance Register</h2>
            <p className="text-xs text-slate-500">
              Shows all students for the selected date and filters. Click <strong>Present</strong> or <strong>Absent</strong> cards to drill down.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left">
                  <th className="px-4 py-2.5 font-semibold text-slate-600">Student</th>
                  <th className="px-4 py-2.5 font-semibold text-slate-600">Adm #</th>
                  <th className="px-4 py-2.5 font-semibold text-slate-600">Class</th>
                  <th className="px-4 py-2.5 font-semibold text-slate-600">Type</th>
                  <th className="px-4 py-2.5 font-semibold text-slate-600">Tap In</th>
                  <th className="px-4 py-2.5 font-semibold text-slate-600">Tap Out</th>
                  <th className="px-4 py-2.5 font-semibold text-slate-600">Status</th>
                  <th className="px-4 py-2.5 font-semibold text-slate-600">Last Scan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedRegisterRows.map((row) => (
                  <tr key={row.student.id} className="hover:bg-slate-50/50">
                    <td className="px-4 py-2.5 font-medium text-slate-900">{row.student.name}</td>
                    <td className="px-4 py-2.5 font-mono text-xs text-slate-600">{row.student.admissionNumber}</td>
                    <td className="px-4 py-2.5 text-slate-600">
                      {row.student.className ?? "—"}
                      {row.student.streamName ? ` / ${row.student.streamName}` : ""}
                    </td>
                    <td className="px-4 py-2.5">
                      {row.student.studentType ? (
                        <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ${row.student.studentType === "DAY" ? "bg-sky-100 text-sky-700" : "bg-violet-100 text-violet-700"}`}>
                          {row.student.studentType}
                        </span>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-slate-700">{formatTime(row.tapIn?.scannedAt)}</td>
                    <td className="px-4 py-2.5 text-slate-700">{formatTime(row.tapOut?.scannedAt)}</td>
                    <td className="px-4 py-2.5">
                      <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-bold ${STATUS_COLORS[row.currentStatus]}`}>
                        {STATUS_LABELS[row.currentStatus]}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-slate-500">
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
                    <td colSpan={8} className="px-4 py-10 text-center text-slate-500">
                      No students found. Try adjusting the date or filters.
                    </td>
                  </tr>
                ) : null}

                {!register && !loadError ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-10 text-center text-slate-500">
                      Loading…
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          {register ? (
            <div className="flex flex-col gap-3 border-t border-slate-100 px-4 py-3 text-sm text-slate-500 lg:flex-row lg:items-center lg:justify-between">
              <p>
                Showing {totalRegisterRows === 0 ? 0 : registerPageStart + 1} to {registerPageEnd} of {totalRegisterRows} students
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-bold text-slate-600 disabled:opacity-40"
                    onClick={() => setRegisterPage((current) => Math.max(1, current - 1))}
                    disabled={currentRegisterPage === 1}
                  >
                    Previous
                  </button>
                  {Array.from({ length: totalRegisterPages }).slice(0, 5).map((_, index) => {
                    const pageNumber = index + 1;
                    return (
                      <button
                        key={pageNumber}
                        type="button"
                        className={`rounded-lg px-2.5 py-1.5 text-xs font-bold ${currentRegisterPage === pageNumber ? "bg-blue-600 text-white" : "border border-slate-200 text-slate-600"}`}
                        onClick={() => setRegisterPage(pageNumber)}
                      >
                        {pageNumber}
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-bold text-slate-600 disabled:opacity-40"
                    onClick={() => setRegisterPage((current) => Math.min(totalRegisterPages, current + 1))}
                    disabled={currentRegisterPage === totalRegisterPages}
                  >
                    Next
                  </button>
                </div>
                <label className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                  Rows per page
                  <select
                    className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700"
                    value={rowsPerPage}
                    onChange={(e) => {
                      setRowsPerPage(Number(e.target.value));
                      setRegisterPage(1);
                    }}
                  >
                    {[10, 20, 50].map((size) => (
                      <option key={size} value={size}>{size}</option>
                    ))}
                  </select>
                </label>
              </div>
            </div>
          ) : null}
	        </section>
          ) : null}

          {view === "GATE" ? (
            <section className="premium-card overflow-hidden rounded-xl">
              <div className="border-b border-slate-100 px-4 py-3">
                <h2 className="text-base font-bold text-slate-950">Gate Attendance View</h2>
                <p className="text-xs text-slate-500">Arrival, departure, campus status, fee-hold attempts, and manual overrides for the selected date.</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-left">
                      <th className="px-4 py-3 font-semibold text-slate-600">Student</th>
                      <th className="px-4 py-3 font-semibold text-slate-600">Class</th>
                      <th className="px-4 py-3 font-semibold text-slate-600">Type</th>
                      <th className="px-4 py-3 font-semibold text-slate-600">Attendance</th>
                      <th className="px-4 py-3 font-semibold text-slate-600">Arrival</th>
                      <th className="px-4 py-3 font-semibold text-slate-600">Departure</th>
                      <th className="px-4 py-3 font-semibold text-slate-600">Campus</th>
                      <th className="px-4 py-3 font-semibold text-slate-600">Reader</th>
                      <th className="px-4 py-3 font-semibold text-slate-600">Flags</th>
                      <th className="px-4 py-3 font-semibold text-slate-600">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(gateReport?.rows ?? []).map((row) => (
                      <tr key={row.studentId} className="hover:bg-slate-50/50">
                        <td className="px-4 py-3">
                          <p className="font-medium text-slate-900">{row.studentName}</p>
                          <p className="font-mono text-xs text-slate-500">{row.admissionNumber}</p>
                        </td>
                        <td className="px-4 py-3 text-slate-600">{row.className ?? "â€”"}{row.streamName ? ` / ${row.streamName}` : ""}</td>
                        <td className="px-4 py-3 text-slate-600">{row.scholarType ?? "â€”"}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-bold ${row.attendanceStatus === "PRESENT" ? "bg-green-100 text-green-700" : row.attendanceStatus === "LATE" ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-600"}`}>
                            {row.attendanceStatus}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-700">{formatTime(row.arrivalTime)}{row.lateIndicator ? " Â· Late" : ""}</td>
                        <td className="px-4 py-3 text-slate-700">{row.departureNotRecorded ? "Departure not recorded" : formatTime(row.departureTime)}</td>
                        <td className="px-4 py-3 text-slate-700">{row.campusStatus}</td>
                        <td className="px-4 py-3 text-slate-600">{row.readerUsed ?? "â€”"}</td>
                        <td className="px-4 py-3 text-xs text-slate-600">
                          <div>{row.feeHoldAttempt ? `Restricted attempt ${formatDateTime(row.lastRestrictedAttemptAt)}` : "No fee-hold attempt"}</div>
                          <div>{row.manualOverride ? "Manual override used" : row.offlineSynced ? "Offline-synced event" : "Live event"}</div>
                        </td>
                        <td className="px-4 py-3">
                          {row.feeHoldAttempt && !row.manualOverride ? (
                            <button type="button" className="rounded-xl bg-blue-600 px-3 py-2 text-xs font-bold text-white hover:bg-blue-700" onClick={() => { void handleApproveOverride(row.studentId); }}>
                              Approve override
                            </button>
                          ) : (
                            <span className="text-xs text-slate-400">â€”</span>
                          )}
                        </td>
                      </tr>
                    ))}
                    {gateReport && gateReport.rows.length === 0 ? (
                      <tr><td colSpan={10} className="px-4 py-10 text-center text-slate-500">No gate attendance rows match the selected filters.</td></tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}

          {view === "CLASSROOM" ? (
            <section className="premium-card overflow-hidden rounded-xl">
              <div className="border-b border-slate-100 px-4 py-3">
                <h2 className="text-base font-bold text-slate-950">Classroom Attendance View</h2>
                <p className="text-xs text-slate-500">Morning attendance, night prep, missing boarders, wrong-class attempts, and original device times.</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-left">
                      <th className="px-4 py-3 font-semibold text-slate-600">Student</th>
                      <th className="px-4 py-3 font-semibold text-slate-600">Class</th>
                      <th className="px-4 py-3 font-semibold text-slate-600">Morning</th>
                      <th className="px-4 py-3 font-semibold text-slate-600">Night Prep</th>
                      <th className="px-4 py-3 font-semibold text-slate-600">Flags</th>
                      <th className="px-4 py-3 font-semibold text-slate-600">Reader</th>
                      <th className="px-4 py-3 font-semibold text-slate-600">Device Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(classroomReport?.rows ?? []).map((row) => (
                      <tr key={row.id} className="hover:bg-slate-50/50">
                        <td className="px-4 py-3">
                          <p className="font-medium text-slate-900">{row.studentName}</p>
                          <p className="font-mono text-xs text-slate-500">{row.admissionNumber}</p>
                        </td>
                        <td className="px-4 py-3 text-slate-600">{row.className ?? "â€”"}{row.streamName ? ` / ${row.streamName}` : ""}</td>
                        <td className="px-4 py-3 text-slate-700">{row.morningAttendance ? "Present" : "â€”"}</td>
                        <td className="px-4 py-3 text-slate-700">{row.nightPrepAttendance ? "Present" : row.missingBoarder ? "Missing boarder" : "â€”"}</td>
                        <td className="px-4 py-3 text-xs text-slate-600">
                          {row.wrongClassAttempt ? "Wrong class attempt" : row.sessionClosedScan ? "Session closed scan" : row.eventStatus}
                        </td>
                        <td className="px-4 py-3 text-slate-600">{row.readerUsed ?? "â€”"}</td>
                        <td className="px-4 py-3 text-slate-600">{formatDateTime(row.originalDeviceTime)}</td>
                      </tr>
                    ))}
                    {classroomReport && classroomReport.rows.length === 0 ? (
                      <tr><td colSpan={7} className="px-4 py-10 text-center text-slate-500">No classroom attendance rows match the selected filters.</td></tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}
      </div>

      {/* Drill-down modal */}
      {drillDown !== null && register ? (
        <DrillDownModal
          title={drillDown === "PRESENT" ? "Present Students" : "Absent Students"}
          status={drillDown}
          rows={register.rows}
          filters={drillDownFilters}
          onClose={() => setDrillDown(null)}
        />
      ) : null}
    </main>
  );
}
