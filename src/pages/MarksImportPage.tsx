import { useState } from "react";
import { commitMarksImport, dryRunMarksImport } from "../client/importsClient";
import { downloadCsvTemplate, downloadExcelTemplate, parseMarksFile, validatePastedCsv } from "../client/marksSheetHelpers";
import { ImportPreviewTable } from "../components/imports/ImportPreviewTable";
import type { ImportPreview } from "../shared/types/imports";

const SAMPLE = `admissionNumber,studentName,class,stream,subject,term,examType,marks,comments
S1A-001,Kampala Ssempebwa,Senior 1 A,A,English Language,Term 1,BOT,81,Strong start`;

type InputMode = "upload" | "paste";

function getPreviewStats(preview: ImportPreview | null) {
  if (!preview) {
    return { protectedRows: 0, duplicateRows: 0, commitReadyRows: 0 };
  }
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

  return {
    protectedRows: preview.rows.filter((row) => row.errors.some((error) => error.toLowerCase().includes("finalized non-import-owned"))).length,
    duplicateRows: duplicates.size,
    commitReadyRows: preview.rows.filter((row) => row.isValid).length,
  };
}

export function MarksImportPage() {
  const [csvText, setCsvText] = useState(SAMPLE);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [error, setError] = useState("");
  const [inputMode, setInputMode] = useState<InputMode>("upload");
  const [selectedFile, setSelectedFile] = useState<{ name: string; type: string } | null>(null);
  const stats = getPreviewStats(preview);
  const hasInput = csvText.trim().length > 0;
  const dryRunSucceeded = preview?.status === "DRY_RUN" && preview.invalidRows === 0 && preview.validRows > 0;

  async function runDryRun() {
    setError("");
    try {
      validatePastedCsv(csvText);
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

  async function handleFile(file: File | null) {
    setError("");
    setPreview(null);
    if (!file) return;
    try {
      const parsed = await parseMarksFile(file);
      setCsvText(parsed.csvText);
      setSelectedFile({ name: parsed.fileName, type: parsed.fileType });
      setInputMode("upload");
    } catch (caught) {
      setSelectedFile({ name: file.name, type: file.name.split(".").pop()?.toUpperCase() ?? "Unknown" });
      setCsvText("");
      setError(caught instanceof Error ? caught.message : "Could not parse marks sheet");
    }
  }

  function clearInput() {
    setCsvText("");
    setPreview(null);
    setError("");
    setSelectedFile(null);
  }

  function loadSampleRows() {
    setCsvText(SAMPLE);
    setPreview(null);
    setError("");
    setSelectedFile(null);
    setInputMode("paste");
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

      <section className="grid gap-4 rounded-2xl border border-blue-100 bg-blue-50 p-5 text-sm text-slate-700 shadow-sm lg:grid-cols-[1fr_auto]">
        <div>
          <h2 className="text-base font-bold text-slate-950">Upload a marks sheet or paste CSV rows.</h2>
          <p className="mt-2">Dry run first to check errors. Only valid rows can be committed. Existing finalized marks are protected unless they belong to the same import batch.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button type="button" onClick={downloadCsvTemplate} className="h-11 rounded-xl border border-blue-200 bg-white px-4 text-sm font-bold text-blue-700 hover:bg-blue-50">
            Download CSV template
          </button>
          <button type="button" onClick={downloadExcelTemplate} className="h-11 rounded-xl border border-emerald-200 bg-white px-4 text-sm font-bold text-emerald-700 hover:bg-emerald-50">
            Download Excel template
          </button>
        </div>
      </section>

      <section className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(280px,0.6fr)]">
        <div className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-slate-950">Marks sheet input</h2>
              <p className="text-sm text-slate-500">Upload `.csv`, `.xlsx`, or `.xls`; paste CSV remains available for quick testing.</p>
            </div>
            <div className="rounded-xl bg-slate-100 p-1 text-sm font-bold">
              <button
                type="button"
                onClick={() => setInputMode("upload")}
                className={`rounded-lg px-3 py-2 ${inputMode === "upload" ? "bg-white text-blue-700 shadow-sm" : "text-slate-500"}`}
              >
                Upload file
              </button>
              <button
                type="button"
                onClick={() => setInputMode("paste")}
                className={`rounded-lg px-3 py-2 ${inputMode === "paste" ? "bg-white text-blue-700 shadow-sm" : "text-slate-500"}`}
              >
                Paste CSV
              </button>
            </div>
          </div>

          {inputMode === "upload" ? (
            <div className="mt-5 rounded-2xl border border-dashed border-blue-200 bg-blue-50/60 p-5">
              <label className="grid cursor-pointer gap-3 text-center">
                <span className="text-sm font-bold text-slate-950">Choose a marks sheet</span>
                <span className="text-xs text-slate-500">Accepted formats: CSV, XLSX, XLS</span>
                <input
                  type="file"
                  className="sr-only"
                  accept=".csv,.xlsx,.xls,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  onChange={(event) => void handleFile(event.target.files?.[0] ?? null)}
                />
                <span className="mx-auto inline-flex h-11 items-center rounded-xl bg-blue-600 px-5 text-sm font-bold text-white shadow-sm hover:bg-blue-700">Browse file</span>
              </label>
              {selectedFile ? (
                <div className="mt-4 rounded-xl bg-white p-4 text-sm">
                  <p className="font-bold text-slate-950">{selectedFile.name}</p>
                  <p className="mt-1 text-slate-500">File type: {selectedFile.type}</p>
                </div>
              ) : null}
            </div>
          ) : (
            <label className="mt-5 grid gap-3 text-sm font-semibold text-slate-950">
              Paste CSV rows
              <textarea
                className="min-h-72 rounded-xl border border-slate-200 bg-slate-50 p-4 font-mono text-sm font-normal text-slate-900 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
                value={csvText}
                onChange={(event) => {
                  setCsvText(event.target.value);
                  setPreview(null);
                }}
                spellCheck={false}
              />
            </label>
          )}

          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={runDryRun}
              disabled={!hasInput}
              className="h-11 rounded-xl bg-blue-600 px-5 text-sm font-bold text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              Dry run
            </button>
            <button
              type="button"
              onClick={runCommit}
              disabled={!dryRunSucceeded}
              className="h-11 rounded-xl bg-emerald-600 px-5 text-sm font-bold text-white shadow-sm hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              Commit valid rows
            </button>
            <button type="button" onClick={clearInput} className="h-11 rounded-xl border border-slate-200 px-5 text-sm font-bold text-slate-700 hover:bg-slate-50">
              Clear input
            </button>
            <button type="button" onClick={loadSampleRows} className="h-11 rounded-xl border border-amber-200 px-5 text-sm font-bold text-amber-700 hover:bg-amber-50">
              Load sample rows
            </button>
          </div>
        </div>

        <aside className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-bold text-slate-950">Import summary</p>
          {!preview ? <p className="mt-2 text-sm text-slate-500">Run dry-run validation to preview totals.</p> : null}
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
            <div className="rounded-xl bg-amber-50 p-4">
              <p className="text-xs font-semibold text-amber-700">Duplicate / Protected Rows</p>
              <p className="text-2xl font-bold text-slate-950">{stats.duplicateRows + stats.protectedRows}</p>
            </div>
            <div className="rounded-xl bg-violet-50 p-4">
              <p className="text-xs font-semibold text-violet-700">Commit-ready Rows</p>
              <p className="text-2xl font-bold text-slate-950">{stats.commitReadyRows}</p>
            </div>
          </div>
        </aside>
      </section>

      <ImportPreviewTable preview={preview} />
    </main>
  );
}
