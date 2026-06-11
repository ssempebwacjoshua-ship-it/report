import { Icon } from "../layout/Icon";

const rows = [
  ["Draft", "24", "blue"],
  ["Ready for Approval", "12", "yellow"],
  ["Approved", "8", "green"],
  ["Released to Parents", "152", "purple"],
] as const;

const toneClass = {
  blue: "bg-blue-100 text-blue-600",
  yellow: "bg-amber-100 text-amber-600",
  green: "bg-green-100 text-green-600",
  purple: "bg-violet-100 text-violet-600",
};

export function ReportsOverviewCard() {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-bold text-slate-950">Reports Overview</h2>
      <div className="mt-4 divide-y divide-slate-100">
        {rows.map(([label, value, tone]) => (
          <div key={label} className="flex items-center gap-4 py-4">
            <span className={`grid h-10 w-10 place-items-center rounded-full ${toneClass[tone]}`}>
              <Icon name="file" className="h-5 w-5" />
            </span>
            <span className="flex-1 text-sm font-medium text-slate-600">{label}</span>
            <span className="text-xl font-bold text-slate-950">{value}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
