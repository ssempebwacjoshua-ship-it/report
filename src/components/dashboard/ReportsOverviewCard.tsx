import { Icon } from "../layout/Icon";

const rows = [
  ["Draft", "24", "blue", 16],
  ["Ready for Approval", "12", "yellow", 45],
  ["Approved", "8", "green", 32],
  ["Released to Parents", "152", "purple", 78],
] as const;

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

export function ReportsOverviewCard() {
  return (
    <section className="premium-card rounded-2xl p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-black text-slate-950">Reports Overview</h2>
          <p className="mt-1 text-sm text-slate-500">Demo status board for this term.</p>
        </div>
        <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-extrabold text-blue-700 ring-1 ring-blue-100">
          Term 2
        </span>
      </div>
      <div className="mt-4 grid gap-3">
        {rows.map(([label, value, tone, progress]) => (
          <div key={label} className="rounded-2xl border border-slate-100 bg-white/80 p-3 shadow-sm">
            <div className="flex items-center gap-3">
            <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${toneClass[tone]}`}>
              <Icon name="file" className="h-4 w-4" />
            </span>
              <span className="flex-1 text-sm font-bold text-slate-700">{label}</span>
              <span className="text-xl font-black tabular-nums text-slate-950">{value}</span>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
              <div className={`h-full rounded-full ${barClass[tone]}`} style={{ width: `${progress}%` }} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
