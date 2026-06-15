import { useState } from "react";
import { commitMarksImport, dryRunMarksImport } from "../client/importsClient";
import { DIGITAL_ACCEPT, downloadCsvTemplate, downloadExcelTemplate, parseMarksFile, validatePastedCsv } from "../client/marksSheetHelpers";
import { ScanUploadPanel } from "../components/imports/ScanUploadPanel";
import { GeminiScanPanel } from "../components/imports/GeminiScanPanel";
import { ImportPreviewTable } from "../components/imports/ImportPreviewTable";
import type { ImportPreview } from "../shared/types/imports";

// ── Sample CSV for the digital paste mode ────────────────────────────────────

const SAMPLE = `admissionNumber,studentName,class,stream,subject,term,examType,marks,comments
S1A-001,Kampala Ssempebwa,Senior 1 A,A,English Language,Term 1,BOT,81,Strong start`;

// ── Import mode selector ──────────────────────────────────────────────────────

type ImportMode = "digital" | "scan" | "gemini";

const MODES: Array<{
  id: ImportMode;
  label: string;
  badge: string;
  desc: string;
  formats: string;
  icon: React.ReactNode;
  accent: string;
  badgeColor: string;
}> = [
  {
    id: "digital",
    label: "Digital Marksheet",
    badge: "CSV / XLS / XLSX",
    desc: "Upload a CSV or Excel file generated from School Connect.",
    formats: "CSV, XLS, XLSX",
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
      </svg>
    ),
    accent: "border-blue-200 hover:border-blue-400",
    badgeColor: "bg-blue-100 text-blue-700",
  },
  {
    id: "scan",
    label: "Scanned Handwritten Marksheet",
    badge: "PDF / PNG / JPG / JPEG / WEBP",
    desc: "Upload a scanned PDF or image of a printed handwritten marksheet.",
    formats: "PDF, PNG, JPG, JPEG, WEBP",
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
      </svg>
    ),
    accent: "border-violet-200 hover:border-violet-400",
    badgeColor: "bg-violet-100 text-violet-700",
  },
  {
    id: "gemini",
    label: "Smart Marksheet Import",
    badge: "PNG / JPG / JPEG / WEBP / PDF",
    desc: "Upload a photo or scan of a marksheet. The system reads the marks and prepares them for review before saving.",
    formats: "PNG, JPG, JPEG, WEBP, PDF",
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z" />
      </svg>
    ),
    accent: "border-fuchsia-200 hover:border-fuchsia-400",
    badgeColor: "bg-fuchsia-100 text-fuchsia-700",
  },
];

// ── Digital import panel (extracted from original page) ───────────────────────

type InputMode = "upload" | "paste";

function getPreviewStats(preview: ImportPreview | null) {
  if (!preview) return { protectedRows: 0, duplicateRows: 0, commitReadyRows: 0 };

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
      .map((v) => v.trim().toLowerCase())
      .join("|");
    if (seen.has(key)) duplicates.add(row.rowNumber);
    seen.add(key);
  });

  return {
    protectedRows: preview.rows.filter((row) =>
      row.errors.some((e) => e.toLowerCase().includes("finalized non-import-owned")),
    ).length,
    duplicateRows: duplicates.size,
    commitReadyRows: preview.rows.filter((row) => row.isValid).length,
  };
}

function DigitalImportPanel() {
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
    <div className="grid gap-5">
      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 shadow-sm">
          {error}
        </div>
      ) : null}

      {/* Info banner */}
      <section className="premium-card grid gap-3 rounded-2xl px-4 py-3 lg:grid-cols-[1fr_auto]">
        <div>
          <h2 className="text-sm font-bold text-slate-950">Upload a digital marks sheet or paste CSV rows.</h2>
          <p className="mt-1 text-sm text-slate-600">
            Dry run first to check errors. Only valid rows can be committed. Existing finalized marks
            are protected unless they belong to the same import batch.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <button type="button" onClick={downloadCsvTemplate} className="btn btn-secondary">
            Download CSV template
          </button>
          <button type="button" onClick={downloadExcelTemplate} className="btn btn-success-secondary">
            Download Excel template
          </button>
        </div>
      </section>

      {/* Main layout */}
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
            <div className="tab-tray flex-nowrap overflow-x-auto">
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
                  accept={DIGITAL_ACCEPT}
                  onChange={(e) => void handleFile(e.target.files?.[0] ?? null)}
                />
                <span className="btn btn-primary mx-auto">Browse file</span>
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
                onChange={(e) => {
                  setCsvText(e.target.value);
                  setPreview(null);
                }}
                spellCheck={false}
              />
            </label>
          )}

          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <button type="button" onClick={runDryRun} disabled={!hasInput} className="btn btn-primary">
              Dry run
            </button>
            <button type="button" onClick={runCommit} disabled={!dryRunSucceeded} className="btn btn-success">
              Commit valid rows
            </button>
            <button type="button" onClick={clearInput} className="btn btn-danger-light">
              Clear
            </button>
            <button type="button" onClick={loadSampleRows} className="btn btn-secondary">
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
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function MarksImportPage() {
  const [importMode, setImportMode] = useState<ImportMode>("digital");

  return (
    <main className="grid gap-5">
      {/* Page header */}
      <header className="page-header flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-blue-600">Marks Import</p>
          <h1 className="text-2xl font-bold tracking-tight text-slate-950">Upload and verify marks</h1>
          <p className="mt-1 text-sm text-slate-500">
            Digital CSV/XLS import or scanned handwritten marksheet — choose your import mode below.
          </p>
        </div>
        <a className="btn btn-primary" href="/reports">
          Reports
        </a>
      </header>

      {/* Import mode selector */}
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {MODES.map((mode) => {
          const active = importMode === mode.id;
          return (
            <button
              key={mode.id}
              type="button"
              onClick={() => setImportMode(mode.id)}
              className={`flex items-start gap-4 rounded-2xl border-2 bg-white p-5 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                active
                  ? "border-blue-500 shadow-lg shadow-blue-100 ring-1 ring-blue-400"
                  : `${mode.accent} shadow-sm`
              }`}
            >
              <div
                className={`mt-0.5 grid h-11 w-11 shrink-0 place-items-center rounded-xl ${
                  active ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-500"
                }`}
              >
                {mode.icon}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className={`text-sm font-bold ${active ? "text-blue-700" : "text-slate-900"}`}>
                    {mode.label}
                  </p>
                  {active && (
                    <span className="rounded-full bg-blue-600 px-2 py-0.5 text-xs font-extrabold text-white">
                      Selected
                    </span>
                  )}
                </div>
                <p className="mt-1 text-xs text-slate-500">{mode.desc}</p>
                <p className="mt-1.5">
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${mode.badgeColor}`}>
                    {mode.badge}
                  </span>
                </p>
              </div>
            </button>
          );
        })}
      </section>

      {/* Tab content */}
      {importMode === "digital" && <DigitalImportPanel />}
      {importMode === "scan" && <ScanUploadPanel />}
      {importMode === "gemini" && <GeminiScanPanel />}
    </main>
  );
}
