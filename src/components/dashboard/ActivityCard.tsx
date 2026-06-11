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
    <section className="premium-card rounded-2xl p-4">
      <h2 className="text-sm font-bold text-slate-950">Recent Activity</h2>
      <div className="mt-3 grid gap-2.5">
        {activities.map(([label, time, tone]) => (
          <div key={label} className="flex items-center gap-3 text-sm">
            <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full ${toneClass[tone]}`}>
              <Icon name="activity" className="h-3.5 w-3.5" />
            </span>
            <span className="min-w-0 flex-1 text-slate-700">{label}</span>
            <span className="hidden shrink-0 text-xs text-slate-400 sm:inline">{time}</span>
          </div>
        ))}
      </div>
      <a href="/reports" className="action-link mt-4">
        View all activity
        <span aria-hidden="true">&rarr;</span>
      </a>
    </section>
  );
}
