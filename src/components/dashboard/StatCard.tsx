import { Link } from "react-router-dom";
import { Icon } from "../layout/Icon";

type Props = {
  label: string;
  value: string;
  note: string;
  trend: string;
  tone: "green" | "yellow" | "purple" | "blue";
  icon: "students" | "cloud" | "file" | "check";
  to: string;
};

const tones = {
  green: {
    icon: "bg-green-500 text-white shadow-green-200",
    accent: "from-green-500 to-emerald-500",
    badge: "bg-green-50 text-green-700 ring-green-100",
  },
  yellow: {
    icon: "bg-amber-400 text-white shadow-amber-200",
    accent: "from-amber-400 to-orange-400",
    badge: "bg-amber-50 text-amber-700 ring-amber-100",
  },
  purple: {
    icon: "bg-violet-500 text-white shadow-violet-200",
    accent: "from-violet-500 to-indigo-500",
    badge: "bg-violet-50 text-violet-700 ring-violet-100",
  },
  blue: {
    icon: "bg-[color:var(--sc-primary)] text-white shadow-[0_10px_20px_rgba(0,127,255,0.22)]",
    accent: "from-[color:var(--sc-primary)] to-[color:var(--sc-primary-active)]",
    badge: "bg-[color:var(--sc-primary-soft)] text-[color:var(--sc-primary-active)] ring-[color:var(--sc-primary-soft)]",
  },
};

const noteColors = {
  green: "text-green-600",
  yellow: "text-amber-600",
  purple: "text-violet-600",
  blue: "text-[color:var(--sc-primary-active)]",
};

export function StatCard({ label, value, note, trend, tone, icon, to }: Props) {
  return (
    <Link to={to} className="premium-card premium-card-hover group relative overflow-hidden rounded-xl p-3">
      <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${tones[tone].accent}`} />
      <div className="flex items-start gap-3">
        <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl shadow-md shadow-slate-200 ${tones[tone].icon}`}>
          <Icon name={icon} className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold text-slate-600">{label}</p>
          <div className="mt-1 flex items-end justify-between gap-1">
            <p className="text-xl font-bold tracking-tight text-slate-950">{value}</p>
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-extrabold ring-1 ${tones[tone].badge}`}>
              {trend}
            </span>
          </div>
          <p className={`mt-1 text-xs font-semibold ${noteColors[tone]}`}>{note}</p>
          <p className="mt-1.5 text-[11px] font-bold text-slate-400 transition-colors group-hover:text-[color:var(--sc-primary)]">
            Open workflow
          </p>
        </div>
      </div>
    </Link>
  );
}
