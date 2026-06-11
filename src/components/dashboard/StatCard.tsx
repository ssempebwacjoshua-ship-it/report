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

export function StatCard({ label, value, note, tone, icon }: Props) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center gap-5">
        <div className={`grid h-16 w-16 shrink-0 place-items-center rounded-full shadow-lg ${tones[tone]}`}>
          <Icon name={icon} className="h-8 w-8" />
        </div>
        <div>
          <p className="text-sm text-slate-500">{label}</p>
          <p className="mt-2 text-3xl font-bold text-slate-950">{value}</p>
          <p className={`mt-2 text-xs font-medium ${tone === "yellow" ? "text-amber-600" : tone === "purple" ? "text-violet-600" : "text-green-600"}`}>{note}</p>
        </div>
      </div>
    </article>
  );
}
