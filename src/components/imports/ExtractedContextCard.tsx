import type { ContextSource, DetectedContext } from "../../shared/types/imports";

// â”€â”€ Source badge â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const SOURCE_LABELS: Record<ContextSource, string> = {
  BATCH_LOOKUP:  "From committed batch",
  ID_PARSED:     "Decoded from marksheet ID",
  HEADER_OCR:    "Read from scan header",
  MANUAL:        "Manual entry",
  NOT_EXTRACTED: "Not extracted",
};

const SOURCE_COLORS: Record<ContextSource, string> = {
  BATCH_LOOKUP:  "bg-emerald-100 text-emerald-800",
  ID_PARSED:     "bg-blue-100 text-blue-800",
  HEADER_OCR:    "bg-violet-100 text-violet-800",
  MANUAL:        "bg-slate-100 text-slate-700",
  NOT_EXTRACTED: "bg-red-100 text-red-700",
};

// â”€â”€ Field display â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function FieldRow({
  label,
  value,
  uncertain,
}: {
  label: string;
  value: string;
  uncertain?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-baseline gap-1.5">
      <span className="w-28 shrink-0 text-xs font-semibold uppercase text-slate-400">{label}</span>
      <span
        className={`text-sm font-medium ${
          uncertain ? "italic text-amber-700" : "text-slate-900"
        }`}
      >
        {value || <span className="text-slate-300">â€”</span>}
      </span>
      {uncertain && (
        <span className="rounded-full bg-amber-100 px-1.5 py-px text-xs font-semibold text-amber-700">
          uncertain
        </span>
      )}
    </div>
  );
}

// â”€â”€ Main component â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export function ExtractedContextCard({
  context,
  onEdit,
}: {
  context: DetectedContext;
  onEdit: () => void;
}) {
  const isLowConfidence = context.overallConfidence < 0.8;
  const sourceLabel  = SOURCE_LABELS[context.source];
  const sourceColors = SOURCE_COLORS[context.source];

  const fields: Array<{ label: string; key: keyof DetectedContext; uncertain?: boolean }> = [
    { label: "Marksheet ID",   key: "marksheetId" },
    { label: "Academic Year",  key: "academicYear" },
    { label: "Term",           key: "termName",     uncertain: !context.termName },
    { label: "Class",          key: "className",    uncertain: !context.className },
    { label: "Stream",         key: "streamName" },
    { label: "Subject",        key: "subjectName",  uncertain: !context.subjectName },
    { label: "Exam Type",      key: "examType" },
  ];

  return (
    <div className="premium-card rounded-2xl border border-slate-200 p-4">
      {/* Header row */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-slate-950">Extracted Marksheet Context</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Verify these fields before extracting marks.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${sourceColors}`}>
            {sourceLabel}
          </span>
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
              isLowConfidence
                ? "bg-amber-100 text-amber-800"
                : "bg-emerald-100 text-emerald-800"
            }`}
          >
            {Math.round(context.overallConfidence * 100)}% confidence
          </span>
        </div>
      </div>

      {/* Low-confidence warning */}
      {(isLowConfidence || context.partial) && (
        <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3">
          <svg
            className="mt-0.5 h-4 w-4 shrink-0 text-amber-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
            />
          </svg>
          <p className="text-xs text-amber-800">
            {context.message ||
              "We could not confidently read all context fields. Please review before continuing."}
          </p>
        </div>
      )}

      {/* Context fields */}
      <div className="mt-4 grid gap-2.5">
        {fields.map(({ label, key, uncertain }) => (
          <FieldRow
            key={key}
            label={label}
            value={String(context[key] ?? "")}
            uncertain={uncertain}
          />
        ))}
      </div>

      {/* Actions */}
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onEdit}
          className="btn btn-secondary text-sm"
        >
          <svg className="mr-1.5 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125" />
          </svg>
          Edit extracted context
        </button>
      </div>
    </div>
  );
}

