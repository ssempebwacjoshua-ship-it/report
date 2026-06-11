import { useState } from "react";
import { commitMarksImport, dryRunMarksImport } from "../client/importsClient";
import { ImportPreviewTable } from "../components/imports/ImportPreviewTable";
import type { ImportPreview } from "../shared/types/imports";

const SAMPLE = `admissionNumber,studentName,class,stream,subject,term,examType,marks,comments
S1A-001,Kampala Ssempebwa,Senior 1 A,A,English Language,Term 1,BOT,81,Strong start`;

export function MarksImportPage() {
  const [csvText, setCsvText] = useState(SAMPLE);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [error, setError] = useState("");

  async function runDryRun() {
    setError("");
    try {
      setPreview(await dryRunMarksImport(csvText));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Import validation failed");
    }
  }

  async function runCommit() {
    setError("");
    try {
      setPreview(await commitMarksImport(csvText));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Import commit failed");
    }
  }

  return (
    <main className="grid gap-6">
      <header className="page-header flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-blue-600">Marks Import</p>
          <h1 className="text-3xl font-bold tracking-tight text-slate-950">Upload and verify marks</h1>
          <p className="mt-2 text-sm text-slate-600">Dry-run validation first, row-level errors always visible, then commit valid import-owned marks.</p>
        </div>
        <a className="rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white shadow-sm hover:bg-blue-700" href="/reports">
          Reports
        </a>
      </header>

      {error ? <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 shadow-sm">{error}</div> : null}

      <section className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(280px,0.6fr)]">
        <div className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <label className="grid gap-3 text-sm font-semibold text-slate-950">
            CSV rows
            <textarea
              className="min-h-72 rounded-xl border border-slate-200 bg-slate-50 p-4 font-mono text-sm font-normal text-slate-900 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
              value={csvText}
              onChange={(event) => setCsvText(event.target.value)}
            />
          </label>
          <div className="mt-4 flex flex-wrap gap-3">
            <button type="button" onClick={runDryRun} className="h-11 rounded-xl border border-blue-600 px-5 text-sm font-bold text-blue-700 hover:bg-blue-50">
              Dry run
            </button>
            <button
              type="button"
              onClick={runCommit}
              disabled={!preview || preview.invalidRows > 0}
              className="h-11 rounded-xl bg-emerald-600 px-5 text-sm font-bold text-white shadow-sm hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              Commit valid rows
            </button>
          </div>
        </div>

        <aside className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-bold text-slate-950">Import summary</p>
          <div className="mt-5 grid gap-3">
            <div className="rounded-xl bg-blue-50 p-4">
              <p className="text-xs font-semibold text-blue-700">Total Rows</p>
              <p className="text-2xl font-bold text-slate-950">{preview?.totalRows ?? 0}</p>
            </div>
            <div className="rounded-xl bg-emerald-50 p-4">
              <p className="text-xs font-semibold text-emerald-700">Valid Rows</p>
              <p className="text-2xl font-bold text-slate-950">{preview?.validRows ?? 0}</p>
            </div>
            <div className="rounded-xl bg-red-50 p-4">
              <p className="text-xs font-semibold text-red-700">Invalid Rows</p>
              <p className="text-2xl font-bold text-slate-950">{preview?.invalidRows ?? 0}</p>
            </div>
          </div>
        </aside>
      </section>

      <ImportPreviewTable preview={preview} />
    </main>
  );
}
