import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  fetchDashboardAttendanceSummary,
  fetchDashboardStats,
} from "../client/dashboardClient";
import { StatCard } from "../components/dashboard/StatCard";
import { Icon } from "../components/layout/Icon";
import { getSchoolDisplayName } from "../components/layout/branding";
import { useAppSettings } from "../components/layout/SettingsContext";
import type {
  DashboardAttendanceSummary,
  DashboardStats,
} from "../shared/types/dashboard";

const dashboardTabs = [
  { label: "Overview", href: null },
  { label: "Marks Review", href: "/imports/marks" },
  { label: "Report Approval", href: "/reports" },
  { label: "Release Center", href: "/reports/release" },
] as const;

const workflowStageHrefs = [
  "/imports/marks",
  "/imports/marks",
  "/reports",
  "/reports",
  "/reports/release",
] as const;

const workflowTone = {
  blue: "bg-[color:var(--sc-primary)] text-white shadow-[0_10px_20px_rgba(0,127,255,0.24)]",
  green: "bg-green-500 text-white shadow-green-200",
  purple: "bg-violet-500 text-white shadow-violet-200",
  yellow: "bg-amber-400 text-white shadow-amber-200",
} as const;

const attendanceCardTone = {
  green: {
    value: "text-green-700",
    badge: "bg-green-50 text-green-700 ring-green-100",
    accent: "from-green-500 to-emerald-500",
  },
  red: {
    value: "text-red-700",
    badge: "bg-red-50 text-red-700 ring-red-100",
    accent: "from-red-500 to-rose-500",
  },
  amber: {
    value: "text-amber-700",
    badge: "bg-amber-50 text-amber-700 ring-amber-100",
    accent: "from-amber-400 to-orange-400",
  },
  blue: {
    value: "text-[color:var(--sc-primary-active)]",
    badge: "bg-[color:var(--sc-primary-soft)] text-[color:var(--sc-primary-active)] ring-[color:var(--sc-primary-soft)]",
    accent: "from-[color:var(--sc-primary)] to-[color:var(--sc-primary-active)]",
  },
} as const;

type WorkflowToneKey = keyof typeof workflowTone;
type AttendanceToneKey = keyof typeof attendanceCardTone;

const workflowStageMeta: Array<{
  label: string;
  note: string;
  tone: WorkflowToneKey;
  key: keyof DashboardStats["workflow"];
}> = [
  { label: "Marks Uploaded", note: "Sheets received", tone: "blue", key: "marksUploaded" },
  { label: "Reviewed", note: "Finalized batches", tone: "green", key: "reviewed" },
  { label: "Generated", note: "Report copies", tone: "purple", key: "generated" },
  { label: "Approved", note: "Active issued", tone: "green", key: "approved" },
  { label: "Released", note: "Sent to parents", tone: "yellow", key: "released" },
];

const DASHBOARD_ATTENDANCE_REFRESH_MS = 15_000;

function fmt(n: number): string {
  return n.toLocaleString();
}

function fmtPercent(value: number): string {
  return `${Number.isFinite(value) ? value.toFixed(1) : "0.0"}%`;
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function AttendanceCard({
  label,
  value,
  note,
  tone,
  href,
}: {
  label: string;
  value: string;
  note: string;
  tone: AttendanceToneKey;
  href: string;
}) {
  return (
    <Link to={href} className="premium-card premium-card-hover group relative overflow-hidden rounded-xl p-3">
      <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${attendanceCardTone[tone].accent}`} />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold text-slate-600">{label}</p>
          <p className={`mt-1 text-xl font-bold tracking-tight ${attendanceCardTone[tone].value}`}>{value}</p>
          <p className="mt-1 text-xs font-semibold text-slate-500">{note}</p>
        </div>
        <span className={`rounded-full px-2 py-0.5 text-[11px] font-extrabold ring-1 ${attendanceCardTone[tone].badge}`}>
          Live
        </span>
      </div>
      <p className="mt-2 text-[11px] font-bold text-slate-400 transition-colors group-hover:text-[color:var(--sc-primary)]">
        Open attendance
      </p>
    </Link>
  );
}

export function DashboardPage() {
  const navigate = useNavigate();
  const { settings } = useAppSettings() ?? {};
  const schoolName = getSchoolDisplayName(settings?.sections.school, "School Connect");

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [statsError, setStatsError] = useState("");
  const [statsLoading, setStatsLoading] = useState(true);

  const [attendanceSummary, setAttendanceSummary] = useState<DashboardAttendanceSummary | null>(null);
  const [attendanceLoading, setAttendanceLoading] = useState(true);
  const [attendancePaused, setAttendancePaused] = useState(false);
  const [attendanceError, setAttendanceError] = useState("");

  const refreshTimerRef = useRef<number | null>(null);
  const attendanceAbortRef = useRef<AbortController | null>(null);
  const attendanceInFlightRef = useRef(false);
  const attendanceFailureCountRef = useRef(0);

  useEffect(() => {
    const controller = new AbortController();
    fetchDashboardStats(controller.signal)
      .then(setStats)
      .catch((err: Error) => {
        if (controller.signal.aborted) return;
        setStatsError(err.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setStatsLoading(false);
        }
      });

    return () => controller.abort();
  }, []);

  useEffect(() => {
    const clearRefreshTimer = () => {
      if (refreshTimerRef.current !== null) {
        window.clearTimeout(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }
    };

    const canRefreshAttendance = () =>
      typeof document !== "undefined"
      && document.visibilityState === "visible"
      && (typeof navigator === "undefined" || navigator.onLine !== false);

    const scheduleRefresh = () => {
      clearRefreshTimer();
      if (!canRefreshAttendance()) return;
      refreshTimerRef.current = window.setTimeout(() => {
        void refreshAttendanceSummary();
      }, DASHBOARD_ATTENDANCE_REFRESH_MS);
    };

    async function refreshAttendanceSummary() {
      if (!canRefreshAttendance() || attendanceInFlightRef.current) {
        return;
      }

      attendanceAbortRef.current?.abort();
      const controller = new AbortController();
      attendanceAbortRef.current = controller;
      attendanceInFlightRef.current = true;

      try {
        const summary = await fetchDashboardAttendanceSummary(controller.signal);
        if (controller.signal.aborted) return;
        setAttendanceSummary(summary);
        setAttendanceError("");
        setAttendancePaused(false);
        attendanceFailureCountRef.current = 0;
      } catch (err) {
        if (controller.signal.aborted) return;
        const message = err instanceof Error ? err.message : "Could not load attendance summary";
        setAttendanceError(message);
        attendanceFailureCountRef.current += 1;
        if (attendanceFailureCountRef.current >= 2) {
          setAttendancePaused(true);
        }
      } finally {
        if (!controller.signal.aborted) {
          setAttendanceLoading(false);
          attendanceInFlightRef.current = false;
          scheduleRefresh();
        }
      }
    }

    const handleVisibilityChange = () => {
      if (!canRefreshAttendance()) {
        clearRefreshTimer();
        return;
      }
      void refreshAttendanceSummary();
    };

    const handleWindowFocus = () => {
      if (!canRefreshAttendance()) return;
      void refreshAttendanceSummary();
    };

    const handleOnline = () => {
      void refreshAttendanceSummary();
    };

    const handleOffline = () => {
      clearRefreshTimer();
    };

    void refreshAttendanceSummary();
    window.addEventListener("focus", handleWindowFocus);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      clearRefreshTimer();
      attendanceAbortRef.current?.abort();
      attendanceInFlightRef.current = false;
      window.removeEventListener("focus", handleWindowFocus);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  const activeTerm = stats?.activeTerm;
  const termLabel = activeTerm
    ? `${activeTerm.name}, ${activeTerm.academicYear}`
    : "No active term";

  const pendingCount = stats?.marksUploadsPendingReview ?? 0;
  const issuedCount = stats?.reportsIssuedCount ?? 0;

  const heroDescription = statsLoading
    ? "Loading live stats..."
    : statsError
      ? "Could not load live stats. Check your connection."
      : `${fmt(issuedCount)} reports issued - ${fmt(pendingCount)} marks uploads pending review`;

  const attendanceValues = attendanceSummary
    ? {
        totalStudents: attendanceSummary.totalStudents,
        present: attendanceSummary.present,
        absent: attendanceSummary.absent,
        late: attendanceSummary.late,
        attendanceRate: attendanceSummary.attendanceRate,
        onCampus: attendanceSummary.onCampus,
      }
    : null;

  return (
    <main className="grid gap-3">
      <section
        className="overflow-hidden rounded-2xl border p-4 text-white shadow-[0_12px_32px_rgba(15,23,42,0.18)]"
        style={{
          background: "var(--sc-primary)",
          borderColor: "rgba(255,255,255,0.18)",
        }}
      >
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-3xl">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-extrabold uppercase tracking-wide text-blue-100 ring-1 ring-white/15">
                {schoolName} Command Center
              </span>
              <span className="rounded-full bg-emerald-400/15 px-3 py-1 text-xs font-extrabold text-emerald-100 ring-1 ring-emerald-300/30">
                {termLabel}
              </span>
            </div>
            <h1 className="mt-2 text-lg font-bold tracking-tight sm:text-xl">
              Welcome, School Admin
            </h1>
            <p
              className={`mt-1.5 max-w-2xl text-sm font-medium ${statsError ? "text-red-300" : "text-blue-100"}`}
            >
              {heroDescription}
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link
              to="/reports"
              className="btn w-full bg-white text-[color:var(--sc-primary)] shadow-[0_14px_26px_rgba(0,127,255,0.22)] hover:bg-[color:var(--sc-primary-soft)] sm:w-auto"
            >
              <Icon name="file" className="h-4 w-4" />
              Generate Reports
            </Link>
            <Link
              to="/imports/marks"
              className="btn w-full border border-white/25 bg-white/10 text-white shadow-[0_14px_26px_rgba(0,127,255,0.18)] hover:bg-white/15 sm:w-auto"
            >
              <Icon name="cloud" className="h-4 w-4" />
              Import Marks
            </Link>
          </div>
        </div>
      </section>

      <section className="flex overflow-x-auto pb-1">
        <div className="tab-tray">
          {dashboardTabs.map((tab, index) => (
            <button
              key={tab.label}
              type="button"
              className={`tab-button whitespace-nowrap ${index === 0 ? "tab-button-active" : ""}`}
              onClick={tab.href ? () => navigate(tab.href) : undefined}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-2 md:gap-4 xl:grid-cols-4">
        <StatCard
          label="Enrolled Students"
          value={statsLoading ? "-" : fmt(stats?.enrolledStudents ?? 0)}
          note="Active enrollment this term"
          trend={statsLoading ? "-" : activeTerm ? "Live" : "No term"}
          tone="green"
          icon="students"
          href="/students"
        />
        <StatCard
          label="Marks Pending Review"
          value={statsLoading ? "-" : fmt(pendingCount)}
          note="Uploaded but not yet finalized"
          trend={pendingCount > 0 ? "Action" : "Clear"}
          tone="yellow"
          icon="cloud"
          href="/imports/marks"
        />
        <StatCard
          label="Reports Issued"
          value={statsLoading ? "-" : fmt(issuedCount)}
          note="Active issued reports"
          trend={issuedCount > 0 ? "Live" : "None"}
          tone="purple"
          icon="file"
          href="/reports"
        />
        <StatCard
          label="Reports Released"
          value={statsLoading ? "-" : fmt(stats?.reportsReleasedCount ?? 0)}
          note="Sent to parents this term"
          trend={stats?.reportsReleasedCount ? "Sent" : "None"}
          tone="blue"
          icon="check"
          href="/reports/release"
        />
      </section>

      <section className="premium-card rounded-xl p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="text-sm font-bold text-slate-950">Today&apos;s Attendance</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Live summary from physical reader attendance records.
            </p>
          </div>
          <div className="text-right text-xs text-slate-500">
            <p>
              {attendanceSummary
                ? `Last updated ${fmtTime(attendanceSummary.lastUpdatedAt)}`
                : attendanceLoading
                  ? "Loading attendance..."
                  : "Attendance unavailable"}
            </p>
            {attendancePaused ? (
              <p className="mt-1 font-semibold text-amber-600">Attendance update paused</p>
            ) : null}
          </div>
        </div>

        {attendanceError && !attendanceSummary ? (
          <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {attendanceError}
          </div>
        ) : null}

        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-2 md:gap-4 xl:grid-cols-5">
          <AttendanceCard
            label="Present"
            value={attendanceValues ? fmt(attendanceValues.present) : "-"}
            note="Present includes late students"
            tone="green"
            href="/nfc/attendance?view=GATE&attendanceStatus=PRESENT"
          />
          <AttendanceCard
            label="Absent"
            value={attendanceValues ? fmt(attendanceValues.absent) : "-"}
            note={attendanceValues?.totalStudents === 0 ? "No active students" : "No qualifying attendance today"}
            tone="red"
            href="/nfc/attendance?view=GATE&attendanceStatus=ABSENT"
          />
          <AttendanceCard
            label="Late"
            value={attendanceValues ? fmt(attendanceValues.late) : "-"}
            note="Late students remain counted as present"
            tone="amber"
            href="/nfc/attendance?view=GATE&attendanceStatus=LATE"
          />
          <AttendanceCard
            label="Attendance Rate"
            value={attendanceValues ? fmtPercent(attendanceValues.attendanceRate) : "-"}
            note={attendanceValues?.totalStudents === 0 ? "No active students" : "Present divided by active students"}
            tone="blue"
            href="/nfc/attendance?view=GATE"
          />
          <AttendanceCard
            label="On Campus"
            value={attendanceValues ? fmt(attendanceValues.onCampus) : "-"}
            note="Latest gate movement is an entry"
            tone="blue"
            href="/nfc/attendance?view=GATE&campusStatus=ON_CAMPUS"
          />
        </div>

        {attendanceSummary?.totalStudents === 0 ? (
          <p className="mt-3 text-xs font-semibold text-slate-500">No active students.</p>
        ) : null}
      </section>

      <section className="premium-card rounded-xl p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="text-sm font-bold text-slate-950">Report Workflow</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Track the path from marks upload to parent release.
            </p>
          </div>
          <Link to="/reports" className="action-link text-sm">
            Continue reports
            <span aria-hidden="true">&rarr;</span>
          </Link>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-2 md:grid-cols-5">
          {workflowStageMeta.map((stage, index) => {
            const value = stats?.workflow[stage.key] ?? 0;
            return (
              <Link
                key={stage.label}
                to={workflowStageHrefs[index]}
                className="relative rounded-xl border border-slate-100 bg-white p-3 shadow-sm transition hover:border-blue-200 hover:bg-blue-50/40"
              >
                {index < workflowStageMeta.length - 1 ? (
                  <div className="absolute left-[calc(50%+1.5rem)] top-5 hidden h-0.5 w-[calc(100%-3rem)] bg-slate-200 md:block" />
                ) : null}
                <div
                  className={`relative z-10 grid h-7 w-7 place-items-center rounded-lg text-sm font-bold shadow-md ${workflowTone[stage.tone]}`}
                >
                  {index + 1}
                </div>
                <p className="mt-2 text-xs font-bold text-slate-950">{stage.label}</p>
                <p className="mt-0.5 text-lg font-bold tabular-nums text-slate-950">
                  {statsLoading ? "-" : fmt(value)}
                </p>
                <p className="mt-0.5 text-xs text-slate-500">{stage.note}</p>
              </Link>
            );
          })}
        </div>
      </section>

      <footer className="flex flex-wrap justify-between gap-3 pb-1 text-xs text-slate-400">
        <span>&copy; 2026 {schoolName}. All rights reserved.</span>
        <span>Version 1.0.0</span>
      </footer>
    </main>
  );
}
