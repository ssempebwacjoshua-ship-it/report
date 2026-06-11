import { ActivityCard } from "../components/dashboard/ActivityCard";
import { ReportsOverviewCard } from "../components/dashboard/ReportsOverviewCard";
import { StatCard } from "../components/dashboard/StatCard";
import { Icon } from "../components/layout/Icon";

const uploads = [
  ["S4A", "Term 2", "06 Jun 2026", "Pending Review"],
  ["S4B", "Term 2", "06 Jun 2026", "Pending Review"],
  ["S3A", "Term 2", "05 Jun 2026", "Approved"],
  ["S2A", "Term 2", "05 Jun 2026", "Pending Review"],
] as const;

export function DashboardPage() {
  return (
    <main className="grid gap-5">
      {/* Page header */}
      <section className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-blue-600">Dashboard</p>
          <h1 className="text-2xl font-bold tracking-tight text-slate-950">Welcome, School Admin</h1>
          <p className="mt-1 text-sm text-slate-500">Here's what's happening in your school today.</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <div className="flex items-center gap-3">
            <div>
              <p className="text-xs font-medium text-slate-500">Current Term</p>
              <p className="mt-0.5 text-sm font-bold text-slate-950">Term 2, 2026</p>
            </div>
            <Icon name="calendar" className="h-4 w-4 text-slate-400" />
          </div>
        </div>
      </section>

      {/* KPI cards */}
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total Students" value="1,248" note="5% from last term" tone="green" icon="students" />
        <StatCard label="Marks Uploads" value="18" note="Pending Review" tone="yellow" icon="cloud" />
        <StatCard label="Reports Ready" value="12" note="For Approval" tone="purple" icon="file" />
        <StatCard label="Reports Approved" value="8" note="This Term" tone="green" icon="check" />
      </section>

      {/* Row 1: Recent uploads + Reports overview + Quick actions */}
      <section className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
        {/* Recent marks uploads */}
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-bold text-slate-950">Recent Marks Uploads</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-xs text-slate-500">
                  <th className="px-2 pb-2 font-semibold uppercase">Class</th>
                  <th className="px-2 pb-2 font-semibold uppercase">Term</th>
                  <th className="px-2 pb-2 font-semibold uppercase">Uploaded On</th>
                  <th className="px-2 pb-2 font-semibold uppercase">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {uploads.map(([klass, term, date, status]) => (
                  <tr key={`${klass}-${date}`} className="hover:bg-slate-50">
                    <td className="px-2 py-2.5 font-medium text-slate-950">{klass}</td>
                    <td className="px-2 py-2.5 text-slate-600">{term}</td>
                    <td className="px-2 py-2.5 text-slate-600">{date}</td>
                    <td className="px-2 py-2.5">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          status === "Approved"
                            ? "bg-green-100 text-green-700"
                            : "bg-amber-100 text-amber-700"
                        }`}
                      >
                        {status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <a
            href="/imports/marks"
            className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700"
          >
            View all uploads
            <span aria-hidden="true">&rarr;</span>
          </a>
        </section>

        <div className="grid gap-4">
          <ReportsOverviewCard />

          {/* Quick actions */}
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-bold text-slate-950">Quick Actions</h2>
            <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
              <a
                href="/reports"
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-bold text-white hover:bg-blue-700"
              >
                <Icon name="file" className="h-4 w-4" />
                Generate Reports
              </a>
              <a
                href="/reports"
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-green-500 px-4 text-sm font-bold text-green-700 hover:bg-green-50"
              >
                <Icon name="check" className="h-4 w-4" />
                Approve Reports
              </a>
            </div>
          </section>
        </div>
      </section>

      {/* Row 2: Student contacts + Recent activity */}
      <section className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
        {/* Student contacts */}
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-bold text-slate-950">Student Contacts for Reports</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            {[
              ["Guardians", "1,102", "Phone numbers", "green"],
              ["Email Contacts", "856", "Email addresses", "blue"],
              ["SMS Contacts", "1,185", "For SMS", "purple"],
            ].map(([label, value, note, tone]) => (
              <div
                key={label}
                className="flex items-center gap-3 border-slate-100 md:border-r md:last:border-r-0"
              >
                <span
                  className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${
                    tone === "green"
                      ? "bg-green-100 text-green-600"
                      : tone === "blue"
                        ? "bg-blue-100 text-blue-600"
                        : "bg-violet-100 text-violet-600"
                  }`}
                >
                  <Icon name={tone === "blue" ? "bell" : "students"} className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-xs text-slate-500">{label}</p>
                  <p className="text-lg font-bold text-slate-950">{value}</p>
                  <p className="text-xs text-blue-600">{note}</p>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-4 text-xs text-slate-400">
            Keep contacts up to date to ensure reports are delivered successfully.
          </p>
        </section>

        <ActivityCard />
      </section>

      <footer className="flex flex-wrap justify-between gap-3 pb-1 text-xs text-slate-400">
        <span>&copy; 2026 School Connect. All rights reserved.</span>
        <span>Version 1.0.0</span>
      </footer>
    </main>
  );
}
