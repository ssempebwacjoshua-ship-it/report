import type { ImportPreview } from "../../shared/types/imports";

export function ImportPreviewTable({ preview }: { preview: ImportPreview | null }) {
  if (!preview) return null;

  return (
    <div className="min-w-0 rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap gap-3 border-b border-slate-200 p-4 text-sm">
        <span className="rounded-full bg-blue-50 px-3 py-1 font-semibold text-blue-700">Total: {preview.totalRows}</span>
        <span className="rounded-full bg-emerald-50 px-3 py-1 font-semibold text-emerald-700">Valid: {preview.validRows}</span>
        <span className="rounded-full bg-red-50 px-3 py-1 font-semibold text-red-700">Invalid: {preview.invalidRows}</span>
        <span className="rounded-full bg-violet-50 px-3 py-1 font-semibold text-violet-700">Status: {preview.status}</span>
      </div>
      <div className="max-w-full overflow-x-auto">
        <table className="w-full min-w-[900px] border-collapse text-sm">
          <thead>
            <tr className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <th className="border-b border-slate-200 p-3">Row</th>
              <th className="border-b border-slate-200 p-3">Admission</th>
              <th className="border-b border-slate-200 p-3">Subject</th>
              <th className="border-b border-slate-200 p-3">Exam</th>
              <th className="border-b border-slate-200 p-3">Marks</th>
              <th className="border-b border-slate-200 p-3">Errors</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {preview.rows.map((row) => (
              <tr key={row.rowNumber} className={row.isValid ? "" : "bg-red-50"}>
                <td className="p-3">{row.rowNumber}</td>
                <td className="p-3 font-semibold text-slate-950">{row.raw.admissionNumber}</td>
                <td className="p-3">{row.raw.subject}</td>
                <td className="p-3">{row.raw.examType}</td>
                <td className="p-3">{row.raw.marks}</td>
                <td className="p-3">{row.errors.join("; ") || "OK"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
