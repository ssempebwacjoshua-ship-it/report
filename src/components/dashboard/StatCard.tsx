import { Icon } from "../layout/Icon";

type Props = {
  label: string;
  value: string;
  note: string;
  tone: "green" | "yellow" | "purple" | "blue";
  icon: "students" | "cloud" | "file" | "check";
};

const tones = {
  green: "bg-green-500 text-white shadow-green-200",
  yellow: "bg-amber-400 text-white shadow-amber-200",
  purple: "bg-violet-500 text-white shadow-violet-200",
  blue: "bg-blue-500 text-white shadow-blue-200",
};

const noteColors = {
  green: "text-green-600",
  yellow: "text-amber-600",
  purple: "text-violet-600",
  blue: "text-blue-600",
};

export function StatCard({ label, value, note, tone, icon }: Props) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-4">
        <div className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl shadow-md ${tones[tone]}`}>
          <Icon name={icon} className="h-6 w-6" />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-medium text-slate-500">{label}</p>
          <p className="mt-0.5 text-2xl font-bold text-slate-950">{value}</p>
          <p className={`mt-0.5 text-xs font-medium ${noteColors[tone]}`}>{note}</p>
        </div>
      </div>
    </article>
  );
}
