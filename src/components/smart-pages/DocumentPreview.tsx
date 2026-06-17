import type { ComponentNode, DocumentSchema } from "../../shared/types/documentIntelligence";

// ── Individual component renderers ─────────────────────────────────────────────

function HeaderRenderer({ props, primaryColor }: { props: Record<string, unknown>; primaryColor: string }) {
  return (
    <div
      className="rounded-xl px-6 py-5 text-white"
      style={{ background: `linear-gradient(135deg, ${primaryColor} 0%, ${primaryColor}cc 100%)` }}
    >
      {props.logoText ? (
        <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-white/20 text-sm font-black">
          {String(props.logoText).slice(0, 2).toUpperCase()}
        </div>
      ) : null}
      <h1 className="text-xl font-black leading-tight">{String(props.title ?? "Document")}</h1>
      {props.subtitle ? <p className="mt-1 text-sm opacity-85">{String(props.subtitle)}</p> : null}
      {props.date ? <p className="mt-2 text-xs opacity-70">{String(props.date)}</p> : null}
    </div>
  );
}

function TextBlockRenderer({ props }: { props: Record<string, unknown> }) {
  return (
    <div>
      {props.heading ? (
        <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-500">{String(props.heading)}</h2>
      ) : null}
      <p className="text-sm leading-relaxed text-slate-700">{String(props.content ?? "")}</p>
    </div>
  );
}

function TableRenderer({ props }: { props: Record<string, unknown> }) {
  const columns = (props.columns as string[]) ?? [];
  const rows = (props.rows as Record<string, string | number>[]) ?? [];
  return (
    <div>
      {props.heading ? (
        <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-500">{String(props.heading)}</h2>
      ) : null}
      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-slate-50">
              {columns.map((col) => (
                <th key={col} className="px-3 py-2 text-left font-bold text-slate-600">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-slate-50/50"}>
                {columns.map((col) => (
                  <td key={col} className="px-3 py-2 text-slate-700">
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

function StatisticsRenderer({ props }: { props: Record<string, unknown> }) {
  const items = (props.items as { label: string; value: string | number; change?: string }[]) ?? [];
  return (
    <div>
      {props.heading ? (
        <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-500">{String(props.heading)}</h2>
      ) : null}
      <div className="grid grid-cols-2 gap-3">
        {items.map((item, i) => (
          <div key={i} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3">
            <p className="text-xs text-slate-500">{item.label}</p>
            <p className="mt-0.5 text-lg font-black text-slate-900">{String(item.value)}</p>
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
          {props.heading ? String(props.heading) : "AI Summary"}
        </span>
        <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-bold text-blue-500">AI</span>
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
        <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1">
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

function FooterRenderer({ props }: { props: Record<string, unknown> }) {
  return (
    <div className="flex items-center justify-between border-t border-slate-200 pt-3 text-[10px] text-slate-400">
      <span>{String(props.left ?? "")}</span>
      <span>{String(props.center ?? "")}</span>
      <span>{String(props.right ?? "")}</span>
    </div>
  );
}

// ── Component registry ─────────────────────────────────────────────────────────

function renderComponent(node: ComponentNode, primaryColor: string): React.ReactNode {
  const key = node.id;
  switch (node.type) {
    case "header": return <HeaderRenderer key={key} props={node.props} primaryColor={primaryColor} />;
    case "textBlock": return <TextBlockRenderer key={key} props={node.props} />;
    case "table": return <TableRenderer key={key} props={node.props} />;
    case "statistics": return <StatisticsRenderer key={key} props={node.props} />;
    case "aiSummary": return <AiSummaryRenderer key={key} props={node.props} />;
    case "profileCard": return <ProfileCardRenderer key={key} props={node.props} />;
    case "signature": return <SignatureRenderer key={key} props={node.props} />;
    case "footer": return <FooterRenderer key={key} props={node.props} />;
    default: return null;
  }
}

// ── Main DocumentPreview ───────────────────────────────────────────────────────

type Props = {
  schema: DocumentSchema;
  componentTree: ComponentNode[];
  compact?: boolean;
};

export function DocumentPreview({ schema, componentTree, compact = false }: Props) {
  const primaryColor = schema.theme?.primaryColor ?? "#2563eb";

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
    <div className={`grid gap-4 ${compact ? "p-3" : "p-5"} bg-white rounded-xl`}>
      {componentTree.map((node) => renderComponent(node, primaryColor))}
    </div>
  );
}
