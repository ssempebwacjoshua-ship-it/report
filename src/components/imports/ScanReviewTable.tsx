import type { ScanImportRow, ScanRowStatus } from "../../shared/types/imports";

type Props = {
  rows: ScanImportRow[];
  onCorrectionChange: (rowNumber: number, value: string) => void;
};

function ConfidenceBadge({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const cls =
    pct >= 85
      ? "bg-emerald-100 text-emerald-800"
      : pct >= 60
        ? "bg-amber-100 text-amber-800"
        : "bg-rose-100 text-rose-800";
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${cls}`}>
      {pct}%
    </span>
  );
}

const STATUS_STYLE: Record<ScanRowStatus, string> = {
  PARSED:       "bg-slate-100 text-slate-600",
  NEEDS_REVIEW: "bg-amber-100 text-amber-800",
  MISSING:      "bg-rose-100 text-rose-700",
  VALID:        "bg-emerald-100 text-emerald-800",
  INVALID:      "bg-red-100 text-red-800",
  COMMITTED:    "bg-blue-100 text-blue-800",
  RETURNED:     "bg-orange-100 text-orange-800",
  FINALIZED:    "bg-green-100 text-green-800",
};

function StatusBadge({ status, errors }: { status: ScanRowStatus; errors: string[] }) {
  const label = status.replace("_", " ");
  return (
    <span
      title={errors.length ? errors.join("; ") : undefined}
      className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_STYLE[status] ?? "bg-slate-100 text-slate-600"}`}
    >
      {label}
    </span>
  );
}

export function ScanReviewTable({ rows, onCorrectionChange }: Props) {
  if (rows.length === 0) {
    return (
      <p className="py-8 text-center text-sm italic text-slate-400">No rows extracted yet.</p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-slate-900 text-white">
            <th className="w-10 px-3 py-2 text-center text-xs font-semibold">#</th>
            <th className="w-24 px-3 py-2 text-left text-xs font-semibold">Adm. No.</th>
            <th className="px-3 py-2 text-left text-xs font-semibold">Student Name</th>
            <th className="w-20 px-3 py-2 text-center text-xs font-semibold">OCR Mark</th>
            <th className="w-20 px-3 py-2 text-center text-xs font-semibold">Suggested</th>
            <th className="w-20 px-3 py-2 text-center text-xs font-semibold">Confidence</th>
            <th className="w-24 px-3 py-2 text-center text-xs font-semibold">Correction</th>
            <th className="w-28 px-3 py-2 text-center text-xs font-semibold">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const needsAttention =
              row.status === "NEEDS_REVIEW" || row.status === "INVALID";
            const isMissing = row.status === "MISSING";
            const base = i % 2 === 0 ? "bg-white" : "bg-slate-50";
            const rowCls = isMissing
              ? "bg-rose-50"
              : needsAttention
                ? "bg-amber-50"
                : base;

            return (
              <tr key={row.rowNumber} className={`border-t border-slate-100 ${rowCls}`}>
                <td className="px-3 py-1.5 text-center text-xs text-slate-400">
                  {row.rowNumber}
                </td>
                <td className="px-3 py-1.5 font-mono text-xs text-slate-700">
                  {row.admissionNumber}
                </td>
                <td className="px-3 py-1.5 font-semibold text-slate-900">
                  {row.studentName}
                </td>
                <td className="px-3 py-1.5 text-center font-mono text-slate-700">
                  {row.writtenMark || <span className="text-xs italic text-slate-300">—</span>}
                </td>
                <td className="px-3 py-1.5 text-center font-bold text-slate-900">
                  {row.suggestedMark || (
                    <span className="text-xs italic text-slate-300">—</span>
                  )}
                </td>
                <td className="px-3 py-1.5 text-center">
                  <ConfidenceBadge value={row.confidence} />
                </td>
                <td className="px-3 py-1.5">
                  <input
                    type="text"
                    value={row.operatorCorrection}
                    onChange={(e) => onCorrectionChange(row.rowNumber, e.target.value)}
                    placeholder={row.suggestedMark || "—"}
                    className="w-full rounded border border-slate-200 px-2 py-0.5 font-mono text-sm focus:border-blue-400 focus:outline-none"
                    maxLength={5}
                  />
                </td>
                <td className="px-3 py-1.5 text-center">
                  <StatusBadge status={row.status} errors={row.validationErrors} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
