import { useMemo, useState } from "react";
import { SUMMARY_STYLES, type SmartPageTemplateDefinition, type SmartPageTemplateScope } from "../../shared/smartPagesTemplates";

type Props = {
  templates: SmartPageTemplateDefinition[];
  scope: SmartPageTemplateScope;
  onPickTemplate: (template: SmartPageTemplateDefinition, options?: { summaryStyleId?: string }) => void;
};

const categoryStyles: Record<string, { badge: string; accent: string }> = {
  Document: { badge: "bg-blue-50 text-blue-700", accent: "bg-blue-500" },
  Summary: { badge: "bg-violet-50 text-violet-700", accent: "bg-violet-500" },
  Table: { badge: "bg-emerald-50 text-emerald-700", accent: "bg-emerald-500" },
  Form: { badge: "bg-cyan-50 text-cyan-700", accent: "bg-cyan-500" },
  Letter: { badge: "bg-fuchsia-50 text-fuchsia-700", accent: "bg-fuchsia-500" },
  Report: { badge: "bg-amber-50 text-amber-700", accent: "bg-amber-500" },
  Meetings: { badge: "bg-sky-50 text-sky-700", accent: "bg-sky-500" },
  Planning: { badge: "bg-lime-50 text-lime-700", accent: "bg-lime-500" },
  Agreement: { badge: "bg-indigo-50 text-indigo-700", accent: "bg-indigo-500" },
  Finance: { badge: "bg-orange-50 text-orange-700", accent: "bg-orange-500" },
  Delivery: { badge: "bg-slate-100 text-slate-700", accent: "bg-slate-500" },
  Bulk: { badge: "bg-slate-100 text-slate-700", accent: "bg-slate-500" },
};

export function SmartPageTemplatePicker({ templates, scope, onPickTemplate }: Props) {
  const [summaryStyleId, setSummaryStyleId] = useState(SUMMARY_STYLES[0].id);
  const visibleTemplates = useMemo(
    () => templates.filter((template) => template.scope.includes(scope)),
    [scope, templates],
  );

  if (visibleTemplates.length === 0) return null;

  return (
    <div className="grid gap-3">
      {visibleTemplates.map((template) => {
        const categoryStyle = categoryStyles[template.category] ?? categoryStyles.Document;
        const summaryStyle = template.id === "summarize-document"
          ? SUMMARY_STYLES.find((style) => style.id === summaryStyleId) ?? SUMMARY_STYLES[0]
          : null;

        return (
          <article key={template.id} className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-xl">
            <div className={`absolute inset-x-0 top-0 h-1 ${categoryStyle.accent}`} />
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.16em] ${categoryStyle.badge}`}>
                  {template.category}
                </span>
                <h3 className="mt-3 text-base font-black text-slate-950">{template.name}</h3>
                <p className="mt-1 text-sm leading-6 text-slate-600">{template.description}</p>
                {template.highlight ? (
                  <p className="mt-2 text-xs font-medium text-slate-500">{template.highlight}</p>
                ) : null}
              </div>
            </div>

            {template.id === "summarize-document" ? (
              <div className="mt-4 grid gap-2">
                <div className="flex flex-wrap gap-2">
                  {SUMMARY_STYLES.map((style) => (
                    <button
                      key={style.id}
                      type="button"
                      onClick={() => setSummaryStyleId(style.id)}
                      className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                        style.id === summaryStyleId
                          ? "bg-[color:var(--sc-primary-soft)] text-[color:var(--sc-primary)]"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      }`}
                    >
                      {style.name}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-slate-500">{summaryStyle?.description}</p>
              </div>
            ) : null}

            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">Input requirements</p>
                <ul className="mt-2 grid gap-1 text-xs text-slate-600">
                  {template.inputRequirements.map((item) => (
                    <li key={item} className="flex gap-2">
                      <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[color:var(--sc-primary)]" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">Output structure</p>
                <ul className="mt-2 grid gap-1 text-xs text-slate-600">
                  {template.outputSchema.map((item) => (
                    <li key={item} className="flex gap-2">
                      <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between gap-3">
              <div className="flex flex-wrap gap-2">
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-600">
                  {template.primaryAction}
                </span>
                <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-bold text-[color:var(--sc-primary)]">
                  Editable output
                </span>
              </div>
              <button
                type="button"
                aria-label={template.name}
                title={template.name}
                onClick={() => onPickTemplate(template, template.id === "summarize-document" ? { summaryStyleId } : undefined)}
                className="btn btn-primary rounded-full px-4 py-2 text-xs font-black shadow-sm"
              >
                {template.primaryAction}
              </button>
            </div>
          </article>
        );
      })}
    </div>
  );
}
