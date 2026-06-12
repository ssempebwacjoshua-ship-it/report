import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchStudentContactSummary } from "../client/studentsClient";
import { ActivityCard } from "../components/dashboard/ActivityCard";
import { ReportsOverviewCard } from "../components/dashboard/ReportsOverviewCard";
import { StatCard } from "../components/dashboard/StatCard";
import { Icon } from "../components/layout/Icon";
import { getSchoolDisplayName } from "../components/layout/branding";
import { useAppSettings } from "../components/layout/SettingsContext";

const uploads = [
  ["S4A", "Mathematics", "Term 2", "06 Jun 2026", "Pending Review"],
  ["S4B", "English Language", "Term 2", "06 Jun 2026", "Pending Review"],
  ["S3A", "Biology", "Term 2", "05 Jun 2026", "Approved"],
  ["S2A", "History", "Term 2", "05 Jun 2026", "Pending Review"],
] as const;

const workflowStages = [
  ["Marks Uploaded", "18", "Sheets received", "blue"],
  ["Reviewed", "10", "Clean batches", "green"],
  ["Generated", "24", "Draft reports", "purple"],
  ["Approved", "8", "Ready to release", "green"],
  ["Released", "152", "Parent copies", "yellow"],
] as const;

const dashboardTabs = ["Overview", "Marks Review", "Report Approval", "Release Center"] as const;

const statusClasses = {
  "Pending Review": "bg-amber-100 text-amber-700 ring-amber-200",
  Approved: "bg-green-100 text-green-700 ring-green-200",
};

const workflowTone = {
  blue: "bg-blue-600 text-white shadow-blue-200",
  green: "bg-green-500 text-white shadow-green-200",
  purple: "bg-violet-500 text-white shadow-violet-200",
  yellow: "bg-amber-400 text-white shadow-amber-200",
};

export function DashboardPage() {
  const navigate = useNavigate();
  const { settings } = useAppSettings() ?? {};
  const schoolName = getSchoolDisplayName(settings?.sections.school, "School Connect");
  const [contactSummary, setContactSummary] = useState({
    guardians: 0,
    emailContacts: 0,
    phoneContacts: 0,
    reportRecipients: 0,
  });

  useEffect(() => {
    fetchStudentContactSummary().then(setContactSummary).catch(() => {
      setContactSummary({ guardians: 0, emailContacts: 0, phoneContacts: 0, reportRecipients: 0 });
    });
  }, []);

  const missingRecipients = useMemo(
    () => Math.max(contactSummary.guardians - contactSummary.reportRecipients, 0),
    [contactSummary.guardians, contactSummary.reportRecipients],
  );

  return (
    <main className="grid gap-5">
      <section className="overflow-hidden rounded-3xl border border-blue-100 bg-gradient-to-br from-slate-950 via-blue-950 to-blue-700 p-5 text-white shadow-[0_22px_55px_rgba(15,23,42,0.22)] lg:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-3xl">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-extrabold uppercase tracking-wide text-blue-100 ring-1 ring-white/15">
                {schoolName} Command Center
              </span>
              <span className="rounded-full bg-emerald-400/15 px-3 py-1 text-xs font-extrabold text-emerald-100 ring-1 ring-emerald-300/30">
                Term 2, 2026
              </span>
            </div>
            <h1 className="mt-3 text-2xl font-black tracking-tight sm:text-3xl">
              Welcome, School Admin
            </h1>
            <p className="mt-2 max-w-2xl text-sm font-medium text-blue-100 sm:text-base">
              12 reports ready for approval • 18 marks uploads pending review
            </p>
            <p className="mt-1 text-xs text-blue-200">
              Dashboard metrics are preview values for the reports lab.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <a href="/reports" className="btn bg-white text-blue-700 shadow-xl shadow-blue-950/20 hover:bg-blue-50">
              <Icon name="file" className="h-4 w-4" />
              Generate Reports
            </a>
            <a href="/imports/marks" className="btn border border-white/25 bg-white/10 text-white shadow-xl shadow-blue-950/20 hover:bg-white/15">
              <Icon name="cloud" className="h-4 w-4" />
              Import Marks
            </a>
          </div>
        </div>
      </section>

      <section className="flex overflow-x-auto pb-1">
        <div className="tab-tray">
          {dashboardTabs.map((tab, index) => (
            <button
              key={tab}
              type="button"
              className={`tab-button whitespace-nowrap ${index === 0 ? "tab-button-active" : ""}`}
              onClick={tab === "Release Center" ? () => navigate("/reports/release") : undefined}
            >
              {tab}
            </button>
          ))}
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 md:gap-4 xl:grid-cols-4">
        <StatCard
          label="Enrolled Students"
          value="1,248"
          note="Report-ready enrollment"
          trend="+5%"
          tone="green"
          icon="students"
          href="/students"
        />
        <StatCard
          label="Marks Pending Review"
          value="18"
          note="Needs academic office check"
          trend="Today"
          tone="yellow"
          icon="cloud"
          href="/imports/marks"
        />
        <StatCard
          label="Reports Ready"
          value="12"
          note="Waiting for approval"
          trend="Action"
          tone="purple"
          icon="file"
          href="/reports"
        />
        <StatCard
          label="Reports Approved"
          value="8"
          note="Cleared this term"
          trend="Term"
          tone="blue"
          icon="check"
          href="/reports"
        />
      </section>

      <section className="premium-card rounded-3xl p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-black text-slate-950">Report Workflow</h2>
            <p className="mt-1 text-sm text-slate-500">
              Track the path from marks upload to parent release.
            </p>
          </div>
          <a href="/reports" className="action-link text-sm">
            Continue reports
            <span aria-hidden="true">&rarr;</span>
          </a>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-5">
          {workflowStages.map(([label, value, note, tone], index) => (
            <div key={label} className="relative rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
              {index < workflowStages.length - 1 ? (
                <div className="absolute left-[calc(50%+2rem)] top-8 hidden h-0.5 w-[calc(100%-4rem)] bg-slate-200 md:block" />
              ) : null}
              <div className={`relative z-10 grid h-10 w-10 place-items-center rounded-2xl font-black shadow-lg ${workflowTone[tone]}`}>
                {index + 1}
              </div>
              <p className="mt-3 text-sm font-black text-slate-950">{label}</p>
              <p className="mt-1 text-2xl font-black tabular-nums text-slate-950">{value}</p>
              <p className="mt-1 text-sm text-slate-500">{note}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.25fr_0.95fr]">
        <section className="premium-card rounded-3xl p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-black text-slate-950">Recent Marks Uploads</h2>
              <p className="mt-1 text-sm text-slate-500">Compact review queue for uploaded sheets.</p>
            </div>
            <a href="/imports/marks" className="action-link text-sm">
              View all uploads
              <span aria-hidden="true">&rarr;</span>
            </a>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[650px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-slate-500">
                  <th className="rounded-l-xl px-3 py-3 font-black uppercase tracking-wide">Class</th>
                  <th className="px-3 py-3 font-black uppercase tracking-wide">Subject</th>
                  <th className="px-3 py-3 font-black uppercase tracking-wide">Term</th>
                  <th className="px-3 py-3 font-black uppercase tracking-wide">Uploaded</th>
                  <th className="px-3 py-3 font-black uppercase tracking-wide">Status</th>
                  <th className="rounded-r-xl px-3 py-3 text-right font-black uppercase tracking-wide">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {uploads.map(([klass, subject, term, date, status]) => (
                  <tr key={`${klass}-${subject}-${date}`} className="hover:bg-blue-50/50">
                    <td className="px-3 py-3.5 font-black text-slate-950">{klass}</td>
                    <td className="px-3 py-3.5 font-semibold text-slate-700">{subject}</td>
                    <td className="px-3 py-3.5 text-slate-600">{term}</td>
                    <td className="px-3 py-3.5 text-slate-600">{date}</td>
                    <td className="px-3 py-3.5">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-extrabold ring-1 ${statusClasses[status]}`}>
                        {status}
                      </span>
                    </td>
                    <td className="px-3 py-3.5 text-right">
                      <a href="/imports/marks" className="rounded-xl border border-blue-100 bg-white px-3 py-1.5 text-xs font-extrabold text-blue-700 shadow-sm hover:bg-blue-50">
                        Review
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <ReportsOverviewCard />
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.05fr_1.15fr]">
        <section className="premium-card rounded-3xl p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-black text-slate-950">Quick Actions</h2>
              <p className="mt-1 text-sm text-slate-500">Jump straight into the next report task.</p>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-1 2xl:grid-cols-3">
            <a href="/reports" className="btn btn-primary justify-start">
              <Icon name="file" className="h-4 w-4" />
              Generate Reports
            </a>
            <a href="/imports/marks" className="btn btn-secondary justify-start">
              <Icon name="cloud" className="h-4 w-4" />
              Import Marks
            </a>
            <a href="/imports/marks" className="btn btn-warning justify-start">
              <Icon name="activity" className="h-4 w-4" />
              Review Pending Marks
            </a>
          </div>
        </section>

        <section className="premium-card rounded-3xl p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-black text-slate-950">Student Contacts for Reports</h2>
              <p className="mt-1 text-sm text-slate-500">Recipients and channels needed before release.</p>
            </div>
            <a href="/students" className="action-link text-sm">
              Manage Students
              <span aria-hidden="true">&rarr;</span>
            </a>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 xl:grid-cols-4">
            {[
              ["Guardians", String(contactSummary.guardians), "Saved contacts", "green"],
              ["Email contacts", String(contactSummary.emailContacts), "Email addresses", "blue"],
              ["Phone/SMS", String(contactSummary.phoneContacts), `${contactSummary.reportRecipients} ready`, "purple"],
              ["Missing recipients", String(missingRecipients), "Needs follow-up", "yellow"],
            ].map(([label, value, note, tone]) => (
              <div key={label} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
                <span
                  className={`grid h-10 w-10 place-items-center rounded-2xl ${
                    tone === "green"
                      ? "bg-green-100 text-green-600"
                      : tone === "blue"
                        ? "bg-blue-100 text-blue-600"
                        : tone === "yellow"
                          ? "bg-amber-100 text-amber-600"
                          : "bg-violet-100 text-violet-600"
                  }`}
                >
                  <Icon name={tone === "yellow" ? "bell" : "students"} className="h-5 w-5" />
                </span>
                <p className="mt-3 text-sm font-bold text-slate-500">{label}</p>
                <p className="mt-1 text-2xl font-black text-slate-950">{value}</p>
                <p className={tone === "yellow" ? "mt-1 text-sm font-semibold text-amber-600" : "mt-1 text-sm text-blue-600"}>
                  {note}
                </p>
              </div>
            ))}
          </div>
        </section>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.25fr_0.95fr]">
        <ActivityCard />
        <section className="premium-card rounded-3xl p-5">
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-blue-100 text-blue-600">
              <Icon name="check" className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-base font-black text-slate-950">Today&apos;s Focus</h2>
              <p className="mt-1 text-sm text-slate-500">Clear pending marks before generating the next report batch.</p>
            </div>
          </div>
          <div className="mt-4 rounded-2xl bg-gradient-to-br from-blue-50 to-emerald-50 p-4">
            <p className="text-sm font-semibold text-slate-700">
              Start with the 18 pending uploads, then approve the 12 ready reports. Once contacts are complete, release approved reports to parents.
            </p>
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
