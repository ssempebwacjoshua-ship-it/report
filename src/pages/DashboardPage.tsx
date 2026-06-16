import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { fetchDashboardStats } from "../client/dashboardClient";
import { fetchStudentContactSummary } from "../client/studentsClient";
import { ActivityCard } from "../components/dashboard/ActivityCard";
import { ReportsOverviewCard } from "../components/dashboard/ReportsOverviewCard";
import { StatCard } from "../components/dashboard/StatCard";
import { Icon } from "../components/layout/Icon";
import { getSchoolDisplayName } from "../components/layout/branding";
import { useAppSettings } from "../components/layout/SettingsContext";
import type { DashboardStats } from "../shared/types/dashboard";
import type { ContactSummary } from "../shared/types/students";

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

  const [contacts, setContacts] = useState<ContactSummary>({
    guardians: 0,
    emailContacts: 0,
    phoneContacts: 0,
    reportRecipients: 0,
  });

  useEffect(() => {
    fetchDashboardStats()
      .then(setStats)
      .catch((err: Error) => setStatsError(err.message))
      .finally(() => setStatsLoading(false));

    fetchStudentContactSummary()
      .then(setContacts)
      .catch(() => {});
  }, []);

  const missingRecipients = Math.max(contacts.guardians - contacts.reportRecipients, 0);
  const activeTerm = stats?.activeTerm;
  const termLabel = activeTerm
    ? `${activeTerm.name}, ${activeTerm.academicYear}`
    : "No active term";

  const pendingCount = stats?.marksUploadsPendingReview ?? 0;
  const issuedCount = stats?.reportsIssuedCount ?? 0;

  const heroDescription = statsLoading
    ? "Loading live stats…"
    : statsError
      ? "Could not load live stats. Check your connection."
      : `${fmt(issuedCount)} reports issued • ${fmt(pendingCount)} marks uploads pending review`;

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
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:gap-4 xl:grid-cols-4">
        <StatCard
          label="Enrolled Students"
          value={statsLoading ? "—" : fmt(stats?.enrolledStudents ?? 0)}
          note="Active enrollment this term"
          trend={statsLoading ? "…" : activeTerm ? "Live" : "No term"}
          tone="green"
          icon="students"
          href="/students"
        />
        <StatCard
          label="Marks Pending Review"
          value={statsLoading ? "—" : fmt(pendingCount)}
          note="Uploaded but not yet finalized"
          trend={pendingCount > 0 ? "Action" : "Clear"}
          tone="yellow"
          icon="cloud"
          href="/imports/marks"
        />
        <StatCard
          label="Reports Issued"
          value={statsLoading ? "—" : fmt(issuedCount)}
          note="Active issued reports"
          trend={issuedCount > 0 ? "Live" : "None"}
          tone="purple"
          icon="file"
          href="/reports"
        />
        <StatCard
          label="Reports Released"
          value={statsLoading ? "—" : fmt(stats?.reportsReleasedCount ?? 0)}
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
                  {statsLoading ? "—" : fmt(value)}
                </p>
                <p className="mt-0.5 text-xs text-slate-500">{stage.note}</p>
              </Link>
            );
          })}
        </div>
      </section>

      {/* ── Recent uploads + Reports overview ────────────────────────────── */}
      <section className="grid gap-3 xl:grid-cols-[1.25fr_0.95fr]">
        <section className="premium-card rounded-xl p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h2 className="text-sm font-bold text-slate-950">Recent Marks Uploads</h2>
              <p className="mt-0.5 text-xs text-slate-500">Latest committed import batches.</p>
            </div>
            <Link to="/imports/marks" className="action-link text-sm">
              View all uploads
              <span aria-hidden="true">&rarr;</span>
            </Link>
          </div>
          <div className="mt-3 overflow-x-auto">
            {statsLoading ? (
              <p className="py-6 text-center text-xs text-slate-400">Loading…</p>
            ) : stats?.recentBatches.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 py-8 text-center">
                <p className="text-sm font-semibold text-slate-500">No uploads yet</p>
                <Link
                  to="/imports/marks"
                  className="mt-2 inline-block text-xs font-bold text-blue-600 hover:underline"
                >
                  Import marks now →
                </Link>
              </div>
            ) : (
              <table className="w-full min-w-[480px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50 text-slate-500">
                    <th className="rounded-l-lg px-2.5 py-2 text-[11px] font-black uppercase tracking-wide">
                      Batch
                    </th>
                    <th className="px-2.5 py-2 text-[11px] font-black uppercase tracking-wide">
                      Rows
                    </th>
                    <th className="px-2.5 py-2 text-[11px] font-black uppercase tracking-wide">
                      Uploaded
                    </th>
                    <th className="px-2.5 py-2 text-[11px] font-black uppercase tracking-wide">
                      Status
                    </th>
                    <th className="rounded-r-lg px-2.5 py-2 text-right text-[11px] font-black uppercase tracking-wide">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {stats?.recentBatches.map((batch) => (
                    <tr key={batch.id} className="hover:bg-blue-50/50">
                      <td className="px-2.5 py-2 font-mono text-xs font-bold text-slate-700">
                        {batch.id.slice(0, 8)}…
                      </td>
                      <td className="px-2.5 py-2 text-sm text-slate-700">
                        {batch.rowCount > 0 ? batch.rowCount : "—"}
                      </td>
                      <td className="px-2.5 py-2 text-sm text-slate-600">
                        {fmtDate(batch.uploadedAt)}
                      </td>
                      <td className="px-2.5 py-2">
                        <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-extrabold text-amber-700 ring-1 ring-amber-200">
                          Pending Review
                        </span>
                      </td>
                      <td className="px-2.5 py-2 text-right">
                        <Link
                          to="/imports/marks"
                          className="rounded-xl border border-blue-100 bg-white px-3 py-1.5 text-xs font-extrabold text-blue-700 shadow-sm hover:bg-blue-50"
                        >
                          Review
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>

        <ReportsOverviewCard
          workflow={
            stats?.workflow ?? {
              marksUploaded: 0,
              reviewed: 0,
              generated: 0,
              approved: 0,
              released: 0,
            }
          }
          termLabel={termLabel}
        />
      </section>

      {/* ── Quick actions + Contact summary ──────────────────────────────── */}
      <section className="grid gap-3 xl:grid-cols-[1.05fr_1.15fr]">
        <section className="premium-card rounded-xl p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h2 className="text-sm font-bold text-slate-950">Quick Actions</h2>
              <p className="mt-0.5 text-xs text-slate-500">Jump straight into the next task.</p>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-1 2xl:grid-cols-3">
            <Link to="/reports" className="btn btn-primary justify-start">
              <Icon name="file" className="h-4 w-4" />
              Generate Reports
            </Link>
            <Link to="/imports/marks" className="btn btn-secondary justify-start">
              <Icon name="cloud" className="h-4 w-4" />
              Import Marks
            </Link>
            <Link to="/imports/marks" className="btn btn-warning justify-start">
              <Icon name="activity" className="h-4 w-4" />
              Review Pending
            </Link>
          </div>
        </section>

        <section className="premium-card rounded-xl p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h2 className="text-sm font-bold text-slate-950">Student Contacts for Reports</h2>
              <p className="mt-0.5 text-xs text-slate-500">
                Recipients and channels needed before release.
              </p>
            </div>
            <Link to="/students" className="action-link text-sm">
              Manage Students
              <span aria-hidden="true">&rarr;</span>
            </Link>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {(
              [
                ["Guardians", contacts.guardians, "Saved contacts", "green"],
                ["Email", contacts.emailContacts, "Email addresses", "blue"],
                ["Phone/SMS", contacts.phoneContacts, `${contacts.reportRecipients} ready`, "purple"],
                ["Missing", missingRecipients, "Needs follow-up", "yellow"],
              ] as const
            ).map(([label, value, note, tone]) => (
              <div
                key={label}
                className="rounded-xl border border-slate-100 bg-white p-3 shadow-sm"
              >
                <span
                  className={`grid h-8 w-8 place-items-center rounded-lg ${
                    tone === "green"
                      ? "bg-green-100 text-green-600"
                      : tone === "blue"
                        ? "bg-blue-100 text-blue-600"
                        : tone === "yellow"
                          ? "bg-amber-100 text-amber-600"
                          : "bg-violet-100 text-violet-600"
                  }`}
                >
                  <Icon name={tone === "yellow" ? "bell" : "students"} className="h-4 w-4" />
                </span>
                <p className="mt-2 text-xs font-bold text-slate-500">{label}</p>
                <p className="mt-0.5 text-lg font-bold text-slate-950">
                  {fmt(value)}
                </p>
                <p
                  className={
                    tone === "yellow"
                      ? "mt-0.5 text-xs font-semibold text-amber-600"
                      : "mt-0.5 text-xs text-blue-600"
                  }
                >
                  {note}
                </p>
              </div>
            ))}
          </div>
        </section>
      </section>

      {/* ── Activity + Focus ──────────────────────────────────────────────── */}
      <section className="grid gap-3 xl:grid-cols-[1.25fr_0.95fr]">
        <ActivityCard activities={stats?.recentActivity ?? []} />
        <section className="premium-card rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-blue-100 text-blue-600">
              <Icon name="check" className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-950">Today&apos;s Focus</h2>
              <p className="mt-0.5 text-xs text-slate-500">
                Clear pending marks before generating the next report batch.
              </p>
            </div>
          </div>
          <div className="mt-3 rounded-xl bg-gradient-to-br from-blue-50 to-emerald-50 p-3">
            {statsLoading ? (
              <p className="text-xs text-slate-400">Loading…</p>
            ) : (
              <p className="text-xs font-semibold text-slate-700">
                {pendingCount > 0
                  ? `Start with the ${fmt(pendingCount)} pending upload${pendingCount !== 1 ? "s" : ""}.`
                  : "No pending marks uploads."}
                {issuedCount > 0
                  ? ` ${fmt(issuedCount)} report${issuedCount !== 1 ? "s" : ""} issued.`
                  : " No reports issued yet."}
                {" "}Once contacts are complete, release approved reports to parents.
              </p>
            )}
          </div>
          <div className="mt-3 flex flex-col gap-2">
            {pendingCount > 0 && (
              <Link to="/imports/marks" className="btn btn-warning w-full justify-start text-xs">
                <Icon name="activity" className="h-3.5 w-3.5" />
                Review {fmt(pendingCount)} pending upload{pendingCount !== 1 ? "s" : ""}
              </Link>
            )}
            {issuedCount > 0 && (
              <Link to="/reports/release" className="btn btn-secondary w-full justify-start text-xs">
                <Icon name="send" className="h-3.5 w-3.5" />
                Release {fmt(issuedCount)} report{issuedCount !== 1 ? "s" : ""} to parents
              </Link>
            )}
            {pendingCount === 0 && issuedCount === 0 && !statsLoading && (
              <Link to="/imports/marks" className="btn btn-primary w-full justify-start text-xs">
                <Icon name="cloud" className="h-3.5 w-3.5" />
                Import marks to get started
              </Link>
            )}
          </div>
        </section>
      </section>

      <footer className="flex flex-wrap justify-between gap-3 pb-1 text-xs text-slate-400">
        <span>&copy; 2026 {schoolName}. All rights reserved.</span>
        <span>Version 1.0.0</span>
      </footer>
    </main>
  );
}
