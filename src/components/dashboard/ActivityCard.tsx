import type { DashboardActivity } from "../../shared/types/dashboard";
import { Icon } from "../layout/Icon";

type Props = {
  activities: DashboardActivity[];
};

type ToneKey = "green" | "yellow" | "purple" | "blue";

const toneClass: Record<ToneKey, string> = {
  green: "bg-green-100 text-green-600",
  yellow: "bg-amber-100 text-amber-600",
  purple: "bg-violet-100 text-violet-600",
  blue: "bg-[color:var(--sc-primary-soft)] text-[color:var(--sc-primary-active)]",
};

const actionTone: Record<string, ToneKey> = {
  "marks.committed": "green",
  "marks.dry_run": "blue",
  "student.import.commit": "blue",
  "reports.issued": "purple",
  "reports.released": "yellow",
};

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function ActivityCard({ activities }: Props) {
  return (
    <section className="premium-card rounded-2xl p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-black text-slate-950">Recent Activity</h2>
          <p className="mt-0.5 text-xs text-slate-500">Latest report workflow events.</p>
        </div>
      </div>
      <div className="mt-3 grid gap-2">
        {activities.length === 0 ? (
          <p className="py-4 text-center text-xs text-slate-400">No recent activity.</p>
        ) : (
          activities.map((activity) => {
            const tone: ToneKey = actionTone[activity.action] ?? "blue";
            return (
              <div
                key={`${activity.action}-${activity.occurredAt}`}
                className="flex items-center gap-3 rounded-xl border border-slate-100 bg-white/80 p-3 text-sm shadow-sm"
              >
                <span
                  className={`grid h-7 w-7 shrink-0 place-items-center rounded-full ${toneClass[tone]}`}
                >
                  <Icon name="activity" className="h-3.5 w-3.5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-slate-700">{activity.label}</p>
                  <p className="mt-0.5 text-xs text-slate-400">
                    {formatRelativeTime(activity.occurredAt)}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>
      <a href="/imports/marks" className="action-link mt-3">
        View all uploads
        <span aria-hidden="true">&rarr;</span>
      </a>
    </section>
  );
}

