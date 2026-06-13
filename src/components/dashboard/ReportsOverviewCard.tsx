import type { DashboardWorkflow } from "../../shared/types/dashboard";
import { Icon } from "../layout/Icon";

type Props = {
  workflow: DashboardWorkflow;
  termLabel: string;
};

type Row = {
  label: string;
  value: number;
  tone: "blue" | "yellow" | "green" | "purple";
  href: string;
  max: number;
};

const toneClass = {
  blue: "bg-blue-100 text-blue-600",
  yellow: "bg-amber-100 text-amber-600",
  green: "bg-green-100 text-green-600",
  purple: "bg-violet-100 text-violet-600",
};

const barClass = {
  blue: "bg-blue-500",
  yellow: "bg-amber-400",
  green: "bg-green-500",
  purple: "bg-violet-500",
};

export function ReportsOverviewCard({ workflow, termLabel }: Props) {
  const maxValue = Math.max(workflow.generated, workflow.approved, workflow.released, 1);

  const rows: Row[] = [
    {
      label: "Issued (All)",
      value: workflow.generated,
      tone: "blue",
      href: "/reports",
      max: maxValue,
    },
    {
      label: "Active (Not Revoked)",
      value: workflow.approved,
      tone: "green",
      href: "/reports",
      max: maxValue,
    },
    {
      label: "Released to Parents",
      value: workflow.released,
      tone: "purple",
      href: "/reports/release",
      max: maxValue,
    },
  ];

  return (
    <section className="premium-card rounded-2xl p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-black text-slate-950">Reports Overview</h2>
          <p className="mt-0.5 text-xs text-slate-500">Live report status for this term.</p>
        </div>
        <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-extrabold text-blue-700 ring-1 ring-blue-100">
          {termLabel}
        </span>
      </div>
      <div className="mt-3 grid gap-2">
        {rows.map(({ label, value, tone, href, max }) => (
          <a
            key={label}
            href={href}
            className="block rounded-xl border border-slate-100 bg-white/80 p-3 shadow-sm transition hover:border-blue-200 hover:bg-blue-50/40"
          >
            <div className="flex items-center gap-3">
              <span
                className={`grid h-7 w-7 shrink-0 place-items-center rounded-full ${toneClass[tone]}`}
              >
                <Icon name="file" className="h-3.5 w-3.5" />
              </span>
              <span className="flex-1 text-sm font-bold text-slate-700">{label}</span>
              <span className="text-lg font-black tabular-nums text-slate-950">
                {value.toLocaleString()}
              </span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
              <div
                className={`h-full rounded-full transition-all ${barClass[tone]}`}
                style={{ width: `${max > 0 ? Math.min((value / max) * 100, 100) : 0}%` }}
              />
            </div>
          </a>
        ))}
        {workflow.generated === 0 && (
          <p className="mt-1 text-center text-xs text-slate-400">
            No reports issued yet this term.
          </p>
        )}
      </div>
    </section>
  );
}
