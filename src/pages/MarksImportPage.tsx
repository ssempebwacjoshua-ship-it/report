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
    protectedRows: preview.rows.filter((row) =>
      row.errors.some((error) => error.toLowerCase().includes("finalized non-import-owned")),
    ).length,
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
  const dryRunSucceeded =
    preview?.status === "DRY_RUN" && preview.invalidRows === 0 && preview.validRows > 0;

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
      setSelectedFile({
        name: file.name,
        type: file.name.split(".").pop()?.toUpperCase() ?? "Unknown",
      });
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
    <main className="grid gap-5">
      {/* Page header */}
      <header className="page-header flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-blue-600">Marks Import</p>
          <h1 className="text-2xl font-bold tracking-tight text-slate-950">Upload and verify marks</h1>
          <p className="mt-1 text-sm text-slate-500">
            Dry-run validation first, row-level errors always visible, then commit valid import-owned marks.
          </p>
        </div>
        <a
          className="btn btn-primary"
          href="/reports"
        >
          Reports
        </a>
      </header>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 shadow-sm">
          {error}
        </div>
      ) : null}

      {/* Info banner */}
      <section className="premium-card grid gap-3 rounded-2xl px-4 py-3 lg:grid-cols-[1fr_auto]">
        <div>
          <h2 className="text-sm font-bold text-slate-950">
            Upload a marks sheet or paste CSV rows.
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Dry run first to check errors. Only valid rows can be committed. Existing finalized marks
            are protected unless they belong to the same import batch.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={downloadCsvTemplate}
            className="btn btn-secondary"
          >
            Download CSV template
          </button>
          <button
            type="button"
            onClick={downloadExcelTemplate}
            className="btn btn-success-secondary"
          >
            Download Excel template
          </button>
        </div>
      </section>

      {/* Main layout: input + summary */}
      <section className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(260px,0.55fr)]">
        {/* Input card */}
        <div className="premium-card min-w-0 rounded-2xl p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-slate-950">Marks sheet input</h2>
              <p className="mt-0.5 text-xs text-slate-500">
                Upload <code>.csv</code>, <code>.xlsx</code>, or <code>.xls</code>; paste CSV for
                quick testing.
              </p>
            </div>
            <div className="tab-tray">
              <button
                type="button"
                onClick={() => setInputMode("upload")}
                className={`tab-button ${inputMode === "upload" ? "tab-button-active" : ""}`}
              >
                Upload file
              </button>
              <button
                type="button"
                onClick={() => setInputMode("paste")}
                className={`tab-button ${inputMode === "paste" ? "tab-button-active" : ""}`}
              >
                Paste CSV
              </button>
            </div>
          </div>

          {inputMode === "upload" ? (
            <div className="mt-4 rounded-2xl border border-dashed border-blue-200 bg-gradient-to-b from-blue-50/70 to-white p-4 shadow-inner">
              <label className="grid cursor-pointer gap-2 text-center">
                <span className="text-sm font-bold text-slate-950">Choose a marks sheet</span>
                <span className="text-xs text-slate-500">Accepted: CSV, XLSX, XLS</span>
                <input
                  type="file"
                  className="sr-only"
                  accept=".csv,.xlsx,.xls,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  onChange={(event) => void handleFile(event.target.files?.[0] ?? null)}
                />
                <span className="btn btn-primary mx-auto">
                  Browse file
                </span>
              </label>
              {selectedFile ? (
                <div className="mt-3 rounded-xl border border-slate-100 bg-white p-3 text-sm shadow-sm">
                  <p className="font-bold text-slate-950">{selectedFile.name}</p>
                  <p className="mt-0.5 text-xs text-slate-500">File type: {selectedFile.type}</p>
                </div>
              ) : null}
            </div>
          ) : (
            <label className="mt-4 grid gap-2 text-xs font-semibold uppercase text-slate-500">
              Paste CSV rows
              <textarea
                className="premium-control min-h-64 rounded-xl border border-slate-200 bg-slate-50 p-3 font-mono text-sm font-normal text-slate-900 outline-none transition focus:border-blue-400 focus:bg-white"
                value={csvText}
                onChange={(event) => {
                  setCsvText(event.target.value);
                  setPreview(null);
                }}
                spellCheck={false}
              />
            </label>
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={runDryRun}
              disabled={!hasInput}
              className="btn btn-primary"
            >
              Dry run
            </button>
            <button
              type="button"
              onClick={runCommit}
              disabled={!dryRunSucceeded}
              className="btn btn-success"
            >
              Commit valid rows
            </button>
            <button
              type="button"
              onClick={clearInput}
              className="btn btn-danger-light"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={loadSampleRows}
              className="btn btn-secondary"
            >
              Load sample
            </button>
          </div>
        </div>

        {/* Summary sidebar */}
        <aside className="premium-card rounded-2xl p-4">
          <p className="text-sm font-bold text-slate-950">Import summary</p>
          {!preview ? (
            <p className="mt-2 text-xs text-slate-500">Run dry-run to preview totals.</p>
          ) : null}
          <div className="mt-4 grid gap-2.5">
            <div className="rounded-xl bg-blue-50 px-4 py-3">
              <p className="text-xs font-semibold text-blue-700">Total Rows</p>
              <p className="mt-0.5 text-2xl font-bold text-slate-950">{preview?.totalRows ?? 0}</p>
            </div>
            <div className="rounded-xl bg-emerald-50 px-4 py-3">
              <p className="text-xs font-semibold text-emerald-700">Valid Rows</p>
              <p className="mt-0.5 text-2xl font-bold text-slate-950">{preview?.validRows ?? 0}</p>
            </div>
            <div className="rounded-xl bg-red-50 px-4 py-3">
              <p className="text-xs font-semibold text-red-700">Invalid Rows</p>
              <p className="mt-0.5 text-2xl font-bold text-slate-950">{preview?.invalidRows ?? 0}</p>
            </div>
            <div className="rounded-xl bg-amber-50 px-4 py-3">
              <p className="text-xs font-semibold text-amber-700">Duplicate / Protected</p>
              <p className="mt-0.5 text-2xl font-bold text-slate-950">
                {stats.duplicateRows + stats.protectedRows}
              </p>
            </div>
            <div className="rounded-xl bg-violet-50 px-4 py-3">
              <p className="text-xs font-semibold text-violet-700">Commit-ready</p>
              <p className="mt-0.5 text-2xl font-bold text-slate-950">{stats.commitReadyRows}</p>
            </div>
          </div>
        </aside>
      </section>

      <ImportPreviewTable preview={preview} />
    </main>
  );
}
