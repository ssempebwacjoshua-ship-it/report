import type { ImportPreview } from "../../shared/types/imports";

function duplicateRows(preview: ImportPreview) {
  const seen = new Set<string>();
  const duplicates = new Set<number>();
  preview.rows.forEach((row) => {
    const key = [
      row.raw.admissionNumber,
      row.raw.class,
      row.raw.stream,
      row.raw.subject,
      row.raw.term,
      row.raw.examType,
    ]
      .map((value) => value.trim().toLowerCase())
      .join("|");
    if (seen.has(key)) duplicates.add(row.rowNumber);
    seen.add(key);
  });
  return duplicates;
}

export function ImportPreviewTable({ preview }: { preview: ImportPreview | null }) {
  if (!preview) return null;
  const duplicates = duplicateRows(preview);

  return (
    <div className="premium-card min-w-0 rounded-2xl">
      <div className="flex flex-wrap gap-3 border-b border-slate-200 p-4 text-sm">
        <span className="rounded-full bg-blue-50 px-3 py-1 font-semibold text-blue-700">Total: {preview.totalRows}</span>
        <span className="rounded-full bg-emerald-50 px-3 py-1 font-semibold text-emerald-700">Valid: {preview.validRows}</span>
        <span className="rounded-full bg-red-50 px-3 py-1 font-semibold text-red-700">Invalid: {preview.invalidRows}</span>
        <span className="rounded-full bg-violet-50 px-3 py-1 font-semibold text-violet-700">Status: {preview.status}</span>
      </div>
      <div className="max-w-full overflow-x-auto">
        <table className="w-full min-w-[1120px] border-collapse text-sm">
          <thead>
            <tr className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <th className="border-b border-slate-200 p-3">Row</th>
              <th className="border-b border-slate-200 p-3">Admission</th>
              <th className="border-b border-slate-200 p-3">Student</th>
              <th className="border-b border-slate-200 p-3">Class</th>
              <th className="border-b border-slate-200 p-3">Stream</th>
              <th className="border-b border-slate-200 p-3">Subject</th>
              <th className="border-b border-slate-200 p-3">Term</th>
              <th className="border-b border-slate-200 p-3">Exam</th>
              <th className="border-b border-slate-200 p-3">Marks</th>
              <th className="border-b border-slate-200 p-3">Status</th>
              <th className="border-b border-slate-200 p-3">Error message</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {preview.rows.map((row) => {
              const isDuplicate = duplicates.has(row.rowNumber);
              const isProtected = row.errors.some((error) => error.toLowerCase().includes("finalized non-import-owned"));
              const status = row.isValid ? (isDuplicate ? "Duplicate" : "Valid") : isProtected ? "Protected" : "Invalid";
              const statusClass = row.isValid
                ? isDuplicate
                  ? "bg-amber-100 text-amber-700"
                  : "bg-emerald-100 text-emerald-700"
                : isProtected
                  ? "bg-amber-100 text-amber-700"
                  : "bg-red-100 text-red-700";

              return (
                <tr key={row.rowNumber} className={row.isValid ? "" : "bg-red-50"}>
                  <td className="p-3">{row.rowNumber}</td>
                  <td className="p-3 font-semibold text-slate-950">{row.raw.admissionNumber}</td>
                  <td className="p-3">{row.raw.studentName}</td>
                  <td className="p-3">{row.raw.class}</td>
                  <td className="p-3">{row.raw.stream}</td>
                  <td className="p-3">{row.raw.subject}</td>
                  <td className="p-3">{row.raw.term}</td>
                  <td className="p-3">{row.raw.examType}</td>
                  <td className="p-3">{row.raw.marks}</td>
                  <td className="p-3">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${statusClass}`}>{status}</span>
                  </td>
                  <td className="p-3">{row.errors.join("; ") || (isDuplicate ? "Duplicate row in this sheet." : "OK")}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
