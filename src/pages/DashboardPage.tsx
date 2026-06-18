import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { fetchDashboardStats } from "../client/dashboardClient";
import { StatCard } from "../components/dashboard/StatCard";
import { Icon } from "../components/layout/Icon";
import { getSchoolDisplayName } from "../components/layout/branding";
import { useAppSettings } from "../components/layout/SettingsContext";
import type { DashboardStats } from "../shared/types/dashboard";

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
  blue: "bg-blue-600 text-white shadow-blue-200",
  green: "bg-green-500 text-white shadow-green-200",
  purple: "bg-violet-500 text-white shadow-violet-200",
  yellow: "bg-amber-400 text-white shadow-amber-200",
} as const;

type WorkflowToneKey = keyof typeof workflowTone;

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

function fmt(n: number): string {
  return n.toLocaleString();
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function DashboardPage() {
  const navigate = useNavigate();
  const { settings } = useAppSettings() ?? {};
  const schoolName = getSchoolDisplayName(settings?.sections.school, "School Connect");

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [statsError, setStatsError] = useState("");
  const [statsLoading, setStatsLoading] = useState(true);


  useEffect(() => {
    fetchDashboardStats()
      .then(setStats)
      .catch((err: Error) => setStatsError(err.message))
      .finally(() => setStatsLoading(false));

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

  return (
    <main className="grid gap-3">
      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <section className="overflow-hidden rounded-2xl border border-blue-100 bg-gradient-to-br from-slate-950 via-blue-950 to-blue-700 p-4 text-white shadow-[0_12px_32px_rgba(15,23,42,0.18)]">
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
              className="btn w-full bg-white text-blue-700 shadow-xl shadow-blue-950/20 hover:bg-blue-50 sm:w-auto"
            >
              <Icon name="file" className="h-4 w-4" />
              Generate Reports
            </Link>
            <Link
              to="/imports/marks"
              className="btn w-full border border-white/25 bg-white/10 text-white shadow-xl shadow-blue-950/20 hover:bg-white/15 sm:w-auto"
            >
              <Icon name="cloud" className="h-4 w-4" />
              Import Marks
            </Link>
          </div>
        </div>
      </section>

      {/* ── Tabs ─────────────────────────────────────────────────────────── */}
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

      {/* ── KPI cards ────────────────────────────────────────────────────── */}
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

      {/* ── Workflow pipeline ─────────────────────────────────────────────── */}
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

      {/* ── Recent uploads + Reports overview ────────────────────────────── */}
      <footer className="flex flex-wrap justify-between gap-3 pb-1 text-xs text-slate-400">
        <span>&copy; 2026 {schoolName}. All rights reserved.</span>
        <span>Version 1.0.0</span>
      </footer>
    </main>
  );
}


