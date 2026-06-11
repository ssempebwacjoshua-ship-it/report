import { Icon } from "../layout/Icon";

const activities = [
  ["Marks uploaded for S4A - Mathematics", "06 Jun 2026, 10:30 AM", "green"],
  ["Reports generated for S4B - Term 2", "06 Jun 2026, 09:15 AM", "yellow"],
  ["Reports approved for S3A - Term 2", "05 Jun 2026, 04:45 PM", "purple"],
  ["Reports released to parents for S2A - Term 1", "05 Jun 2026, 03:20 PM", "blue"],
] as const;

const toneClass = {
  green: "bg-green-100 text-green-600",
  yellow: "bg-amber-100 text-amber-600",
  purple: "bg-violet-100 text-violet-600",
  blue: "bg-blue-100 text-blue-600",
};

export function ActivityCard() {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-bold text-slate-950">Recent Activity</h2>
      <div className="mt-5 grid gap-4">
        {activities.map(([label, time, tone]) => (
          <div key={label} className="flex items-center gap-3 text-sm">
            <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${toneClass[tone]}`}>
              <Icon name="activity" className="h-4 w-4" />
            </span>
            <span className="min-w-0 flex-1 font-medium text-slate-700">{label}</span>
            <span className="hidden text-xs text-slate-500 sm:inline">{time}</span>
          </div>
        ))}
      </div>
      <a href="/reports" className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-blue-600">
        View all activity
        <span aria-hidden="true">&rarr;</span>
      </a>
    </section>
  );
}
