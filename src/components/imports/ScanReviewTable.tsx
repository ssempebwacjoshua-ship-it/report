import type { ScanImportRow, ScanRowStatus } from "../../shared/types/imports";

const STATUS_STYLES: Record<ScanRowStatus, string> = {
  PARSED: "bg-slate-100 text-slate-700",
  NEEDS_REVIEW: "bg-amber-100 text-amber-800",
  MISSING: "bg-yellow-100 text-yellow-800",
  VALID: "bg-emerald-100 text-emerald-700",
  INVALID: "bg-red-100 text-red-700",
  COMMITTED: "bg-blue-100 text-blue-700",
  RETURNED: "bg-orange-100 text-orange-700",
  FINALIZED: "bg-green-100 text-green-800",
};

type Props = {
  rows: ScanImportRow[];
  onCorrectionChange?: (rowNumber: number, value: string) => void;
  readOnly?: boolean;
};

function CropImage({ src, alt, wide = false }: { src?: string; alt: string; wide?: boolean }) {
  if (!src) return <span className="text-xs text-slate-400">No crop</span>;
  return (
    <img
      src={src}
      alt={alt}
      className={`${wide ? "w-28" : "w-24"} h-10 rounded border border-slate-200 bg-white object-contain`}
    />
  );
}

function Dash({ value }: { value?: string }) {
  return <>{value?.trim() ? value : "-"}</>;
}

export function ScanReviewTable({ rows, onCorrectionChange, readOnly = false }: Props) {
  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-6 py-10 text-center">
        <p className="text-sm font-semibold text-slate-500">No rows extracted yet.</p>
        <p className="mt-1 text-xs text-slate-400">
          Upload a scan and confirm the marksheet context to create operator review rows.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200">
      <table className="w-full min-w-[1360px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-black uppercase tracking-wide text-slate-500">
            <th className="px-3 py-3">Row</th>
            <th className="px-3 py-3">Adm. No.</th>
            <th className="px-3 py-3">Student Name</th>
            <th className="px-3 py-3">Crop Previews</th>
            <th className="px-3 py-3 text-center">Written</th>
            <th className="px-3 py-3 text-center">Split</th>
            <th className="px-3 py-3">Raw OCR</th>
            <th className="px-3 py-3 text-center">Suggested</th>
            <th className="px-3 py-3 text-center">Confidence</th>
            <th className="px-3 py-3">Remarks</th>
            <th className="px-3 py-3">Status</th>
            <th className="px-3 py-3">Operator Correction</th>
            <th className="px-3 py-3">Validation</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((row) => {
            const needsAttention = row.status === "NEEDS_REVIEW" || row.status === "INVALID";
            return (
              <tr key={row.rowNumber} className={needsAttention ? "bg-amber-50" : ""}>
                <td className="px-3 py-3 text-slate-500">{row.rowNumber}</td>
                <td className="px-3 py-3 font-semibold text-slate-950">{row.admissionNumber}</td>
                <td className="px-3 py-3 text-slate-700">{row.studentName}</td>
                <td className="px-3 py-3">
                  <div className="grid gap-2">
                    <div className="flex items-center gap-2">
                      <span className="w-12 text-[10px] font-bold uppercase text-slate-400">Written</span>
                      <CropImage src={row.writtenCropDataUrl} alt={`Written mark crop for ${row.admissionNumber}`} />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-12 text-[10px] font-bold uppercase text-slate-400">Split</span>
                      <CropImage src={row.splitCropDataUrl} alt={`Split mark crop for ${row.admissionNumber}`} wide />
                    </div>
                    {row.splitDigitCropDataUrls && row.splitDigitCropDataUrls.length > 0 && (
                      <div className="flex items-center gap-1 pl-14">
                        {row.splitDigitCropDataUrls.map((url, index) => (
                          <img
                            key={`${row.rowNumber}-zone-${index}`}
                            src={url}
                            alt={`Split digit ${index + 1} crop for ${row.admissionNumber}`}
                            className="h-8 w-10 rounded border border-blue-100 bg-white object-contain"
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </td>
                <td className="px-3 py-3 text-center font-mono">
                  <Dash value={row.writtenMark} />
                </td>
                <td className="px-3 py-3 text-center font-mono">
                  <Dash value={row.splitMark} />
                </td>
                <td className="px-3 py-3 text-xs text-slate-500">
                  <div className="grid gap-1">
                    <span><b>W:</b> <code>{row.writtenMarkRaw || "-"}</code></span>
                    <span><b>S:</b> <code>{row.splitMarkRaw || "-"}</code></span>
                    {row.splitDigitRaw && row.splitDigitRaw.length > 0 && (
                      <span>
                        <b>Zones:</b> <code>{row.splitDigitRaw.map((value) => value || "-").join(" | ")}</code>
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-3 py-3 text-center font-mono font-semibold text-slate-950">
                  <Dash value={row.suggestedMark} />
                </td>
                <td className="px-3 py-3 text-center">
                  <span
                    className={`text-xs font-semibold ${
                      row.confidence >= 0.9
                        ? "text-emerald-600"
                        : row.confidence >= 0.7
                          ? "text-amber-600"
                          : "text-red-600"
                    }`}
                  >
                    {Math.round(row.confidence * 100)}%
                  </span>
                </td>
                <td className="px-3 py-3 text-xs text-slate-500">
                  <Dash value={row.remarks} />
                </td>
                <td className="px-3 py-3">
                  <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-bold ${STATUS_STYLES[row.status]}`}>
                    {row.status.replace(/_/g, " ")}
                  </span>
                </td>
                <td className="px-3 py-3">
                  {readOnly ? (
                    <span className="font-mono text-sm"><Dash value={row.operatorCorrection} /></span>
                  ) : (
                    <input
                      type="text"
                      value={row.operatorCorrection}
                      onChange={(event) => onCorrectionChange?.(row.rowNumber, event.target.value)}
                      placeholder="Correct mark"
                      className="w-28 rounded-lg border border-slate-200 bg-white px-2 py-1 font-mono text-sm text-slate-900 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-300"
                    />
                  )}
                </td>
                <td className="px-3 py-3 text-xs text-red-600">
                  {row.validationErrors.join("; ")}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
