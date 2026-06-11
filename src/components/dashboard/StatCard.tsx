import { Icon } from "../layout/Icon";

type Props = {
  label: string;
  value: string;
  note: string;
  trend: string;
  tone: "green" | "yellow" | "purple" | "blue";
  icon: "students" | "cloud" | "file" | "check";
  href: string;
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
    icon: "bg-blue-500 text-white shadow-blue-200",
    accent: "from-blue-500 to-cyan-500",
    badge: "bg-blue-50 text-blue-700 ring-blue-100",
  },
};

const noteColors = {
  green: "text-green-600",
  yellow: "text-amber-600",
  purple: "text-violet-600",
  blue: "text-blue-600",
};

export function StatCard({ label, value, note, trend, tone, icon, href }: Props) {
  return (
    <a href={href} className="premium-card premium-card-hover group relative overflow-hidden rounded-2xl p-4">
      <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${tones[tone].accent}`} />
      <div className="flex items-start gap-4">
        <div className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl shadow-lg shadow-slate-200 ${tones[tone].icon}`}>
          <Icon name={icon} className="h-6 w-6" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-slate-600">{label}</p>
          <div className="mt-2 flex items-end justify-between gap-2">
            <p className="text-3xl font-black tracking-tight text-slate-950">{value}</p>
            <span className={`rounded-full px-2.5 py-1 text-xs font-extrabold ring-1 ${tones[tone].badge}`}>
              {trend}
            </span>
          </div>
          <p className={`mt-2 text-sm font-semibold ${noteColors[tone]}`}>{note}</p>
          <p className="mt-3 text-xs font-bold text-slate-400 transition-colors group-hover:text-blue-600">
            Open workflow
          </p>
        </div>
      </div>
    </a>
  );
}
