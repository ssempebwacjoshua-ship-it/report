import { type ReactNode } from "react";

type FeatureTone = "blue" | "emerald" | "slate";

const toneStyles: Record<
  FeatureTone,
  {
    accent: string;
    badge: string;
    icon: string;
  }
> = {
  blue: {
    accent: "bg-gradient-to-r from-blue-600 via-sky-400 to-cyan-300",
    badge: "bg-blue-50 text-blue-700",
    icon: "bg-gradient-to-br from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-600/20 ring-1 ring-blue-200/60",
  },
  emerald: {
    accent: "bg-gradient-to-r from-emerald-500 via-sky-400 to-blue-500",
    badge: "bg-emerald-50 text-emerald-700",
    icon: "bg-gradient-to-br from-emerald-500 to-blue-600 text-white shadow-lg shadow-emerald-500/20 ring-1 ring-emerald-200/60",
  },
  slate: {
    accent: "bg-gradient-to-r from-slate-500 via-blue-400 to-cyan-300",
    badge: "bg-slate-50 text-slate-700",
    icon: "bg-gradient-to-br from-slate-700 to-blue-600 text-white shadow-lg shadow-slate-500/20 ring-1 ring-slate-200/60",
  },
};

export function MarketingFeatureCard({
  step,
  title,
  body,
  icon,
  tone = "blue",
  className = "",
}: {
  step: number;
  title: string;
  body: string;
  icon: ReactNode;
  tone?: FeatureTone;
  className?: string;
}) {
  const currentTone = toneStyles[tone];
  const stepLabel = `Step ${String(step).padStart(2, "0")}`;

  return (
    <article
      className={`group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-xl ${className}`}
    >
      <div className={`absolute inset-x-0 top-0 h-1 ${currentTone.accent}`} />
      <div className="absolute -right-10 top-6 h-24 w-24 rounded-full bg-blue-50/70 blur-3xl transition duration-200 group-hover:bg-blue-100/80" />

      <div className="relative flex items-start justify-between gap-3">
        <span className={`rounded-full px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.16em] ${currentTone.badge}`}>
          {stepLabel}
        </span>
        <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${currentTone.icon}`}>
          {icon}
        </div>
      </div>

      <h3 className="relative mt-4 text-base font-black text-slate-950">{title}</h3>
      <p className="relative mt-2 text-sm leading-6 text-slate-600">{body}</p>
    </article>
  );
}
