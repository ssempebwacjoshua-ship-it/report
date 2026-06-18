import type { ComponentNode, DocumentSchema } from "../../shared/types/documentIntelligence";

// ── Individual component renderers ─────────────────────────────────────────────

function HeaderRenderer({ props, primaryColor, compact }: { props: Record<string, unknown>; primaryColor: string; compact: boolean }) {
  return (
    <div
      className={`${compact ? "rounded-lg px-4 py-3" : "rounded-xl px-5 py-4 sm:px-6 sm:py-5"} text-white print:rounded-none`}
      style={{ background: `linear-gradient(135deg, ${primaryColor} 0%, ${primaryColor}cc 100%)` }}
    >
      {props.logoText ? (
        <div className={`${compact ? "mb-2 h-8 w-8 text-xs" : "mb-3 h-10 w-10 text-sm"} inline-flex items-center justify-center rounded-lg bg-white/20 font-black`}>
          {String(props.logoText).slice(0, 2).toUpperCase()}
        </div>
      ) : null}
      <h1 className={`${compact ? "text-lg" : "text-xl"} font-black leading-tight`}>{String(props.title ?? "Document")}</h1>
      {props.subtitle ? <p className="mt-1 text-sm opacity-85">{String(props.subtitle)}</p> : null}
      {props.date ? <p className="mt-2 text-xs opacity-70">{String(props.date)}</p> : null}
    </div>
  );
}

function TextBlockRenderer({ props, compact }: { props: Record<string, unknown>; compact: boolean }) {
  return (
    <div className="break-words print:break-normal">
      {props.heading ? (
        <h2 className={`${compact ? "mb-1 text-xs" : "mb-2 text-sm"} font-bold uppercase tracking-wide text-slate-500`}>{String(props.heading)}</h2>
      ) : null}
      <p className={`${compact ? "text-[13px] leading-snug" : "text-sm leading-relaxed"} whitespace-pre-wrap text-slate-700`}>{String(props.content ?? "")}</p>
    </div>
  );
}

export function MobileTableRenderer({ columns, rows }: { columns: string[]; rows: Record<string, string | number>[] }) {
  return (
    <div className="grid gap-3 sm:hidden print:hidden">
      {rows.map((row, i) => (
        <article key={i} className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
          <div className="grid gap-2">
            {columns.map((col) => (
              <div key={col} className="grid gap-0.5">
                <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{col}</span>
                <span className="break-words text-sm font-semibold text-slate-800">{String(row[col] ?? "")}</span>
              </div>
            ))}
          </div>
        </article>
      ))}
      {rows.length === 0 ? <p className="rounded-lg bg-slate-50 p-3 text-center text-sm text-slate-400">No data</p> : null}
    </div>
  );
}

function TableRenderer({ props, compact }: { props: Record<string, unknown>; compact: boolean }) {
  const columns = (props.columns as string[]) ?? [];
  const rows = (props.rows as Record<string, string | number>[]) ?? [];
  return (
    <div className="document-block avoid-break">
      {props.heading ? (
        <h2 className={`${compact ? "mb-1 text-xs" : "mb-2 text-sm"} font-bold uppercase tracking-wide text-slate-500`}>{String(props.heading)}</h2>
      ) : null}
      <MobileTableRenderer columns={columns} rows={rows} />
      <div className="hidden overflow-x-auto rounded-lg border border-slate-200 sm:block print:block print:overflow-visible">
        <table className={`${compact ? "text-[11px]" : "text-xs"} w-full table-fixed border-collapse`}>
          <thead>
            <tr className="bg-slate-50">
              {columns.map((col) => (
                <th key={col} className={`${compact ? "px-2 py-1.5" : "px-3 py-2"} break-words text-left font-bold text-slate-600`}>
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-slate-50/50"}>
                {columns.map((col) => (
                  <td key={col} className={`${compact ? "px-2 py-1.5" : "px-3 py-2"} break-words text-slate-700`}>
                    {String(row[col] ?? "")}
                  </td>
                ))}
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-3 py-4 text-center text-slate-400">
                  No data
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatisticsRenderer({ props, compact }: { props: Record<string, unknown>; compact: boolean }) {
  const items = (props.items as { label: string; value: string | number; change?: string }[]) ?? [];
  return (
    <div>
      {props.heading ? (
        <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-500">{String(props.heading)}</h2>
      ) : null}
      <div className={`${compact ? "gap-2" : "gap-3"} grid grid-cols-1 sm:grid-cols-2`}>
        {items.map((item, i) => (
          <div key={i} className={`${compact ? "px-2 py-2" : "px-3 py-3"} rounded-lg border border-slate-200 bg-slate-50`}>
            <p className="text-xs text-slate-500">{item.label}</p>
            <p className={`${compact ? "text-base" : "text-lg"} mt-0.5 font-black text-slate-900`}>{String(item.value)}</p>
            {item.change ? <p className="text-xs text-emerald-600">{item.change}</p> : null}
          </div>
        ))}
      </div>
    </div>
  );
}

function AiSummaryRenderer({ props }: { props: Record<string, unknown> }) {
  return (
    <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3">
      <div className="mb-2 flex items-center gap-2">
        <span className="text-xs font-bold text-blue-600">
          {props.heading ? String(props.heading) : "Summary"}
        </span>
      </div>
      <p className="text-sm leading-relaxed text-blue-900">{String(props.content ?? "")}</p>
    </div>
  );
}

function ProfileCardRenderer({ props }: { props: Record<string, unknown> }) {
  const fields = (props.fields as { label: string; value: string }[]) ?? [];
  const initials = String(props.avatarText ?? String(props.name ?? "?"))
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-3">
      <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-blue-100 text-sm font-black text-blue-700">
        {initials}
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-bold text-slate-900">{String(props.name ?? "")}</p>
        {props.subtitle ? <p className="text-xs text-slate-500">{String(props.subtitle)}</p> : null}
        <div className="mt-2 grid grid-cols-1 gap-x-4 gap-y-1 sm:grid-cols-2">
          {fields.map((f, i) => (
            <div key={i}>
              <span className="text-[10px] font-medium uppercase text-slate-400">{f.label}</span>
              <p className="text-xs text-slate-700">{f.value}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function SignatureRenderer({ props }: { props: Record<string, unknown> }) {
  return (
    <div className="flex flex-col items-start gap-1">
      <div className="h-12 w-40 rounded border-b border-slate-300 bg-slate-50" />
      <p className="text-xs font-medium text-slate-600">{String(props.label ?? "Signature")}</p>
      {props.name ? <p className="text-xs text-slate-500">{String(props.name)}</p> : null}
      {props.date ? <p className="text-xs text-slate-400">{String(props.date)}</p> : null}
    </div>
  );
}

function ChartRenderer({ props, primaryColor }: { props: Record<string, unknown>; primaryColor: string }) {
  const labels = (props.labels as string[]) ?? [];
  const data = (props.data as number[]) ?? [];
  const max = Math.max(...data, 1);
  const barW = 36;
  const chartH = 100;
  const gap = 10;
  const svgW = Math.max(labels.length * (barW + gap) + 20, 200);
  return (
    <div>
      {props.heading ? (
        <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-500">{String(props.heading)}</h2>
      ) : null}
      <svg width={svgW} height={chartH + 36} overflow="visible" className="block">
        {labels.map((label, i) => {
          const barH = Math.max(Math.round((data[i] ?? 0) / max * chartH), 2);
          const x = 10 + i * (barW + gap);
          const y = chartH - barH + 4;
          return (
            <g key={i}>
              <rect x={x} y={y} width={barW} height={barH} fill={primaryColor} opacity={0.8} rx={3} />
              <text x={x + barW / 2} y={chartH + 20} textAnchor="middle" fontSize={9} fill="#64748b">{label}</text>
              <text x={x + barW / 2} y={y - 3} textAnchor="middle" fontSize={9} fill="#334155">{data[i]}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function TimelineRenderer({ props, primaryColor }: { props: Record<string, unknown>; primaryColor: string }) {
  const items = (props.items as { date: string; title: string; description?: string }[]) ?? [];
  return (
    <div>
      {props.heading ? (
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500">{String(props.heading)}</h2>
      ) : null}
      <div className="relative">
        <div className="absolute left-[9px] top-0 bottom-0 w-px bg-slate-200" />
        <div className="grid gap-4">
          {items.map((item, i) => (
            <div key={i} className="flex gap-3 pl-6 relative">
              <div
                className="absolute left-0 top-1 h-4 w-4 rounded-full border-2 border-white shadow-sm"
                style={{ background: primaryColor }}
              />
              <div>
                <p className="text-[10px] text-slate-400 font-medium">{item.date}</p>
                <p className="text-sm font-bold text-slate-900">{item.title}</p>
                {item.description ? <p className="text-xs text-slate-500 mt-0.5">{item.description}</p> : null}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function FooterRenderer({ props }: { props: Record<string, unknown> }) {
  return (
    <div className="flex flex-col gap-1 border-t border-slate-200 pt-3 text-[10px] text-slate-400 sm:flex-row sm:items-center sm:justify-between">
      <span>{String(props.left ?? "")}</span>
      <span>{String(props.center ?? "")}</span>
      <span>{String(props.right ?? "")}</span>
    </div>
  );
}

// ── Component registry ─────────────────────────────────────────────────────────

function renderComponent(node: ComponentNode, primaryColor: string, compact: boolean): React.ReactNode {
  const key = node.id;
  switch (node.type) {
    case "header": return <HeaderRenderer key={key} props={node.props} primaryColor={primaryColor} compact={compact} />;
    case "textBlock": return <TextBlockRenderer key={key} props={node.props} compact={compact} />;
    case "table": return <TableRenderer key={key} props={node.props} compact={compact} />;
    case "statistics": return <StatisticsRenderer key={key} props={node.props} compact={compact} />;
    case "aiSummary": return <AiSummaryRenderer key={key} props={node.props} />;
    case "profileCard": return <ProfileCardRenderer key={key} props={node.props} />;
    case "signature": return <SignatureRenderer key={key} props={node.props} />;
    case "chart": return <ChartRenderer key={key} props={node.props} primaryColor={primaryColor} />;
    case "timeline": return <TimelineRenderer key={key} props={node.props} primaryColor={primaryColor} />;
    case "footer": return <FooterRenderer key={key} props={node.props} />;
    default: return null;
  }
}

// ── Main DocumentPreview ───────────────────────────────────────────────────────

type Props = {
  schema: DocumentSchema;
  componentTree: ComponentNode[];
  compact?: boolean;
  renderSettings?: {
    fitToOnePage?: boolean;
    compact?: boolean;
    fontScale?: number;
    spacing?: "normal" | "compact";
  };
};

export function DocumentPreview({ schema, componentTree, compact = false, renderSettings }: Props) {
  const primaryColor = schema.theme?.primaryColor ?? "#2563eb";
  const isCompact = compact || renderSettings?.compact || renderSettings?.fitToOnePage || renderSettings?.spacing === "compact";

  if (componentTree.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
        <div className="h-16 w-16 rounded-full bg-slate-100 grid place-items-center">
          <svg viewBox="0 0 24 24" className="h-8 w-8 text-slate-400" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M9 12h6m-3-3v6M3 12a9 9 0 1 1 18 0 9 9 0 0 1-18 0Z" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <p className="text-sm text-slate-500">Document preview will appear here</p>
      </div>
    );
  }

  return (
    <div
      className={`document-paper mx-auto grid w-full max-w-full overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-slate-200 print:rounded-none print:shadow-none print:ring-0 ${isCompact ? "gap-3 p-3 sm:p-4" : "gap-5 p-4 sm:p-6"}`}
      style={{ fontSize: renderSettings?.fontScale ? `${renderSettings.fontScale}rem` : undefined }}
    >
      {componentTree.map((node) => renderComponent(node, primaryColor, Boolean(isCompact)))}
    </div>
  );
}

