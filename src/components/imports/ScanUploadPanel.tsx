import { useEffect, useRef, useState } from "react";
import {
  commitScanRows,
  detectScanContext,
  dryRunScanRows,
  lookupMarksheetContext,
  uploadScanFile,
} from "../../client/importsClient";
import { SCAN_ACCEPT } from "../../client/marksSheetHelpers";
import type {
  DetectedContext,
  ScanImportRow,
  ScanMarksheetContext,
  ScanUploadResponse,
} from "../../shared/types/imports";
import { ScanReviewTable } from "./ScanReviewTable";
import { ExtractedContextCard } from "./ExtractedContextCard";

// ── Types ─────────────────────────────────────────────────────────────────────

type Phase =
  | "idle"             // no file selected yet
  | "detecting"        // auto-detecting context from uploaded file
  | "context_review"   // context ready; operator confirms or edits
  | "manual_id"        // OCR failed; operator enters Marksheet ID manually
  | "manual_form"      // no ID found; operator fills full form as last resort
  | "extracting"       // extracting marks with confirmed context
  | "marks_review";    // marks extracted; operator reviewing

const EXAM_TYPES = ["BOT", "MOT", "EOT"] as const;

// ── Helper: empty context form ────────────────────────────────────────────────

function emptyContext(): ScanMarksheetContext {
  return {
    marksheetId: "",
    className: "",
    streamName: "",
    subjectName: "",
    termName: "",
    examType: "BOT",
    academicYear: String(new Date().getFullYear()),
  };
}

// ── Helper: detected context → mutable form state ────────────────────────────

function detectedToForm(d: DetectedContext): ScanMarksheetContext {
  return {
    marksheetId: d.marksheetId,
    className:   d.className,
    streamName:  d.streamName,
    subjectName: d.subjectName,
    termName:    d.termName,
    examType:    d.examType,
    academicYear: d.academicYear,
  };
}

// ── File preview ──────────────────────────────────────────────────────────────

function FilePreview({ file, url }: { file: File; url: string }) {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  const isImage = ["png", "jpg", "jpeg", "webp"].includes(ext);
  const isPdf   = ext === "pdf";
  const sizeKb  = (file.size / 1024).toFixed(1);

  return (
    <div className="mt-3 rounded-xl border border-slate-100 bg-white p-3 shadow-sm">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-extrabold uppercase text-slate-700">
          {ext.toUpperCase()}
        </span>
        <span className="font-semibold text-slate-950">{file.name}</span>
        <span className="text-xs text-slate-400">{sizeKb} KB</span>
      </div>
      {isImage && (
        <img
          src={url}
          alt="Scan preview"
          className="mt-3 max-h-64 w-full rounded-lg border border-slate-200 object-contain bg-slate-50"
        />
      )}
      {isPdf && (
        <iframe
          src={url}
          title="PDF preview"
          className="mt-3 h-64 w-full rounded-lg border border-slate-200"
        />
      )}
    </div>
  );
}

// ── Manual context form ───────────────────────────────────────────────────────

function ContextForm({
  context,
  onChange,
  title,
  subtitle,
}: {
  context: ScanMarksheetContext;
  onChange: (ctx: ScanMarksheetContext) => void;
  title: string;
  subtitle: string;
}) {
  function set<K extends keyof ScanMarksheetContext>(key: K, value: ScanMarksheetContext[K]) {
    onChange({ ...context, [key]: value });
  }

  const inputCls =
    "premium-control rounded-xl border border-slate-200 bg-slate-50 p-2 text-sm font-normal text-slate-900 outline-none focus:border-blue-400 focus:bg-white";

  return (
    <div className="premium-card rounded-2xl p-4">
      <p className="text-sm font-bold text-slate-950">{title}</p>
      <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>

      <div className="mt-4 grid gap-3">
        <label className="grid gap-1 text-xs font-semibold uppercase text-slate-500">
          Marksheet ID
          <input
            type="text"
            value={context.marksheetId}
            onChange={(e) => set("marksheetId", e.target.value)}
            placeholder="e.g. MS-2026-SEN1-A-ENGL-EOT-T1"
            className={inputCls}
          />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="grid gap-1 text-xs font-semibold uppercase text-slate-500">
            Class <span className="text-red-500">*</span>
            <input
              type="text"
              value={context.className}
              onChange={(e) => set("className", e.target.value)}
              placeholder="e.g. Senior 1 A"
              className={inputCls}
            />
          </label>
          <label className="grid gap-1 text-xs font-semibold uppercase text-slate-500">
            Stream <span className="text-red-500">*</span>
            <input
              type="text"
              value={context.streamName}
              onChange={(e) => set("streamName", e.target.value)}
              placeholder="e.g. A"
              className={inputCls}
            />
          </label>
        </div>

        <label className="grid gap-1 text-xs font-semibold uppercase text-slate-500">
          Subject <span className="text-red-500">*</span>
          <input
            type="text"
            value={context.subjectName}
            onChange={(e) => set("subjectName", e.target.value)}
            placeholder="e.g. Mathematics"
            className={inputCls}
          />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="grid gap-1 text-xs font-semibold uppercase text-slate-500">
            Term <span className="text-red-500">*</span>
            <input
              type="text"
              value={context.termName}
              onChange={(e) => set("termName", e.target.value)}
              placeholder="e.g. Term 1"
              className={inputCls}
            />
          </label>
          <label className="grid gap-1 text-xs font-semibold uppercase text-slate-500">
            Exam Type <span className="text-red-500">*</span>
            <select
              value={context.examType}
              onChange={(e) => set("examType", e.target.value)}
              className={inputCls}
            >
              {EXAM_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </label>
        </div>

        <label className="grid gap-1 text-xs font-semibold uppercase text-slate-500">
          Academic Year <span className="text-red-500">*</span>
          <input
            type="text"
            value={context.academicYear}
            onChange={(e) => set("academicYear", e.target.value)}
            placeholder="e.g. 2026"
            className={inputCls}
          />
        </label>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function ScanUploadPanel() {
  const [phase,          setPhase]          = useState<Phase>("idle");
  const [scanFile,       setScanFile]       = useState<File | null>(null);
  const [previewUrl,     setPreviewUrl]     = useState<string | null>(null);
  const [detectedCtx,    setDetectedCtx]    = useState<DetectedContext | null>(null);
  const [contextForm,    setContextForm]    = useState<ScanMarksheetContext>(emptyContext());
  const [manualId,       setManualId]       = useState("");
  const [idLookupBusy,   setIdLookupBusy]   = useState(false);
  const [uploadResult,   setUploadResult]   = useState<ScanUploadResponse | null>(null);
  const [scanRows,       setScanRows]       = useState<ScanImportRow[]>([]);
  const [dryRunSummary,  setDryRunSummary]  = useState("");
  const [canCommit,      setCanCommit]      = useState(false);
  const [committing,     setCommitting]     = useState(false);
  const [error,          setError]          = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

  // ── File selection → auto-detect ────────────────────────────────────────────

  async function handleFileChange(file: File | null) {
    setError("");
    setDetectedCtx(null);
    setUploadResult(null);
    setScanRows([]);
    setDryRunSummary("");
    setCanCommit(false);

    if (!file) return;

    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    if (!["pdf", "png", "jpg", "jpeg", "webp"].includes(ext)) {
      setError(`Unsupported file: .${ext}. Use PDF, PNG, JPG, JPEG, or WEBP.`);
      return;
    }

    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setScanFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setPhase("detecting");

    // Auto-detect context from header OCR
    try {
      const result = await detectScanContext(file, "SCU-PREVIEW");

      if (result.detected && result.detectionStatus !== "NOT_FOUND") {
        setDetectedCtx(result.detected);
        setContextForm(detectedToForm(result.detected));
        setPhase("context_review");
      } else {
        // OCR found no ID — ask operator for it
        setPhase("manual_id");
      }
    } catch {
      // Network/server error — fall back to manual ID input
      setPhase("manual_id");
    }
  }

  // ── Manual ID lookup ─────────────────────────────────────────────────────────

  async function handleIdLookup() {
    if (!manualId.trim()) {
      setError("Enter a Marksheet ID (e.g. MS-2026-SEN1-A-ENGL-EOT-T1).");
      return;
    }
    setIdLookupBusy(true);
    setError("");
    try {
      const result = await lookupMarksheetContext(manualId.trim(), "SCU-PREVIEW");
      if (result.detected) {
        setDetectedCtx(result.detected);
        setContextForm(detectedToForm(result.detected));
        setPhase("context_review");
      } else {
        setError(result.message || "Marksheet ID not found. Enter context manually.");
        setContextForm((prev) => ({ ...prev, marksheetId: manualId.trim() }));
        setPhase("manual_form");
      }
    } catch {
      setError("Lookup failed. Enter context manually.");
      setContextForm((prev) => ({ ...prev, marksheetId: manualId.trim() }));
      setPhase("manual_form");
    } finally {
      setIdLookupBusy(false);
    }
  }

  // ── Confirm context → extract marks ─────────────────────────────────────────

  async function handleExtractMarks(confirmedContext: ScanMarksheetContext) {
    if (!scanFile) {
      setError("No scan file to extract marks from.");
      return;
    }

    const required: (keyof ScanMarksheetContext)[] = [
      "className", "streamName", "subjectName", "termName", "examType", "academicYear",
    ];
    const missing = required.filter((k) => !confirmedContext[k].trim());
    if (missing.length > 0) {
      setError(`Missing required fields: ${missing.join(", ")}.`);
      return;
    }

    setPhase("extracting");
    setError("");
    try {
      const result = await uploadScanFile(scanFile, "SCU-PREVIEW", confirmedContext);
      setUploadResult(result);
      setScanRows(result.rows);
      setDryRunSummary("");
      setCanCommit(false);
      setPhase("marks_review");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Mark extraction failed.");
      setPhase("context_review"); // let operator retry
    }
  }

  function handleCorrectionChange(rowNumber: number, value: string) {
    setScanRows((prev) =>
      prev.map((row) =>
        row.rowNumber === rowNumber ? { ...row, operatorCorrection: value } : row,
      ),
    );
    setDryRunSummary("");
    setCanCommit(false);
  }

  function handleRemarksChange(rowNumber: number, value: string) {
    setScanRows((prev) =>
      prev.map((row) =>
        row.rowNumber === rowNumber ? { ...row, remarks: value } : row,
      ),
    );
    setCanCommit(false);
  }

  async function handleScanDryRun() {
    if (scanRows.length === 0) return;
    setError("");
    try {
      const result = await dryRunScanRows(contextForm, scanRows, "SCU-PREVIEW");
      setScanRows(result.rows);
      setDryRunSummary(
        `${result.totalRows} rows checked: ${result.validRows} valid, ${result.reviewRows} need review, ${result.missingRows} missing, ${result.invalidRows} invalid.`,
      );
      setCanCommit(result.validRows > 0 && result.reviewRows === 0 && result.invalidRows === 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not validate scanned marks.");
    }
  }

  async function handleScanCommit() {
    if (!canCommit || scanRows.length === 0) return;
    setCommitting(true);
    setError("");
    try {
      const result = await commitScanRows(contextForm, scanRows, "SCU-PREVIEW");
      setScanRows(result.rows);
      setDryRunSummary(result.message);
      setCanCommit(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not commit scanned marks.");
    } finally {
      setCommitting(false);
    }
  }

  function handleReset() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setScanFile(null);
    setPreviewUrl(null);
    setDetectedCtx(null);
    setContextForm(emptyContext());
    setManualId("");
    setUploadResult(null);
    setScanRows([]);
    setDryRunSummary("");
    setCanCommit(false);
    setCommitting(false);
    setError("");
    setPhase("idle");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  const rowSummary = {
    total: scanRows.length,
    entered: scanRows.filter((row) => row.operatorCorrection.trim() || row.extractedMark || row.suggestedMark).length,
    missing: scanRows.filter((row) => row.status === "MISSING").length,
    invalid: scanRows.filter((row) => row.status === "INVALID").length,
    ready: scanRows.filter((row) => row.status === "VALID").length,
  };

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="grid gap-5">
      {/* Operator reminder */}
      <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
        <svg
          className="mt-0.5 h-5 w-5 shrink-0 text-amber-600"
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
        </svg>
        <div>
          <p className="text-sm font-bold text-amber-900">Operator review required</p>
          <p className="mt-0.5 text-sm text-amber-700">
            Scanned marks must be verified by an operator before committing. Marks are never committed automatically.
          </p>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* ── Step 1: File upload ── */}
      <div className="premium-card rounded-2xl p-4">
        <h2 className="text-sm font-bold text-slate-950">Step 1 — Upload scanned marksheet</h2>
        <p className="mt-0.5 text-xs text-slate-500">Accepted: PDF, PNG, JPG, JPEG, WEBP</p>

        <div className="mt-3 rounded-2xl border border-dashed border-violet-200 bg-gradient-to-b from-violet-50/60 to-white p-4 shadow-inner">
          <label className="grid cursor-pointer gap-2 text-center">
            <span className="text-sm font-bold text-slate-950">Choose a scanned marksheet</span>
            <span className="text-xs text-slate-500">PDF, PNG, JPG, JPEG, WEBP</span>
            <input
              ref={fileInputRef}
              type="file"
              className="sr-only"
              accept={SCAN_ACCEPT}
              onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
              disabled={phase === "detecting" || phase === "extracting"}
            />
            <span className="btn btn-secondary mx-auto">Browse file</span>
          </label>

          {scanFile && previewUrl && <FilePreview file={scanFile} url={previewUrl} />}
        </div>

        {(phase !== "idle") && (
          <div className="mt-3 flex gap-2">
            <button type="button" onClick={handleReset} className="btn btn-danger-light text-sm">
              Clear & start over
            </button>
          </div>
        )}
      </div>

      {/* ── Step 2a: Auto-detecting ── */}
      {phase === "detecting" && (
        <div className="flex items-center gap-3 rounded-2xl border border-blue-100 bg-blue-50 p-4">
          <svg className="h-5 w-5 animate-spin text-blue-500" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <p className="text-sm font-medium text-blue-800">
            Scanning header for marksheet ID…
          </p>
        </div>
      )}

      {/* ── Step 2b: Detected context → confirm ── */}
      {phase === "context_review" && detectedCtx && (
        <div className="grid gap-4">
          <div className="flex items-center gap-2 rounded-2xl border border-slate-100 bg-white px-4 py-2.5">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">2</span>
            <span className="text-sm font-semibold text-slate-800">Review detected context</span>
          </div>

          <ExtractedContextCard
            context={detectedCtx}
            onEdit={() => {
              setContextForm(detectedToForm(detectedCtx));
              setPhase("manual_form");
            }}
          />

          <button
            type="button"
            onClick={() => handleExtractMarks(detectedToForm(detectedCtx))}
            className="btn btn-primary"
          >
            Confirm context &amp; extract marks
          </button>
        </div>
      )}

      {/* ── Step 2c: Manual ID entry (OCR found nothing) ── */}
      {phase === "manual_id" && (
        <div className="premium-card grid gap-4 rounded-2xl p-4">
          <div className="flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
            <svg className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
            </svg>
            <p>
              No marksheet ID found in the scan header. Enter the ID from the printed marksheet to
              auto-fill the context.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-slate-500">
              Marksheet ID
            </label>
            <div className="mt-1.5 flex gap-2">
              <input
                type="text"
                value={manualId}
                onChange={(e) => setManualId(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleIdLookup()}
                placeholder="MS-2026-SEN1-A-ENGL-EOT-T1"
                className="premium-control flex-1 rounded-xl border border-slate-200 bg-slate-50 p-2 text-sm outline-none focus:border-blue-400 focus:bg-white"
              />
              <button
                type="button"
                onClick={handleIdLookup}
                disabled={idLookupBusy || !manualId.trim()}
                className="btn btn-primary"
              >
                {idLookupBusy ? "Looking up…" : "Look up"}
              </button>
            </div>
            <p className="mt-1.5 text-xs text-slate-400">
              Found on the printed marksheet in the header. Format: MS-YYYY-CLASS-STREAM-SUBJECT-EXAMTYPE-TERM
            </p>
          </div>

          <div className="border-t border-slate-100 pt-3">
            <button
              type="button"
              onClick={() => setPhase("manual_form")}
              className="text-xs text-slate-500 underline hover:text-slate-800"
            >
              Skip — enter context manually instead
            </button>
          </div>
        </div>
      )}

      {/* ── Step 2d: Full manual form (last resort) ── */}
      {phase === "manual_form" && (
        <div className="grid gap-4">
          <div className="flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-3">
            <svg className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
            </svg>
            <p className="text-xs text-amber-800">
              Manual entry active. Fill in the context fields from the printed marksheet header.
            </p>
          </div>

          <ContextForm
            context={contextForm}
            onChange={setContextForm}
            title="Manual marksheet context"
            subtitle="Copy the fields from the printed marksheet header."
          />

          <button
            type="button"
            onClick={() => handleExtractMarks(contextForm)}
            disabled={
              !contextForm.className.trim() ||
              !contextForm.subjectName.trim() ||
              !contextForm.termName.trim()
            }
            className="btn btn-primary"
          >
            Extract marks with this context
          </button>
        </div>
      )}

      {/* ── Step 3: Extracting marks ── */}
      {phase === "extracting" && (
        <div className="flex items-center gap-3 rounded-2xl border border-blue-100 bg-blue-50 p-4">
          <svg className="h-5 w-5 animate-spin text-blue-500" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <p className="text-sm font-medium text-blue-800">Extracting marks from scan…</p>
        </div>
      )}

      {/* ── Step 4: Mark extraction result + review table ── */}
      {phase === "marks_review" && uploadResult && (
        <div className="grid gap-4">
          {/* Status banner */}
          {uploadResult.parseStatus === "FAILED" ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
              <div className="flex items-start gap-3">
                <svg className="mt-0.5 h-5 w-5 shrink-0 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                </svg>
                <div>
                  <p className="text-sm font-bold text-red-900">Extraction failed</p>
                  <p className="mt-0.5 text-sm text-red-700">{uploadResult.message}</p>
                  <p className="mt-1 text-xs text-red-400">
                    Batch: <code className="font-mono">{uploadResult.batchId}</code>
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
              <div className="flex items-start gap-3">
                <svg className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" />
                </svg>
                <div>
                  <p className="text-sm font-bold text-emerald-900">Scan processed. Enter and review marks before validation.</p>
                  <p className="mt-0.5 text-sm text-emerald-700">{uploadResult.message}</p>
                  <p className="mt-1 text-xs font-semibold text-emerald-700">
                    OCR suggestions are optional assistance only. Operator marks are used for dry-run and commit.
                  </p>
                  <p className="mt-1 text-xs text-emerald-600">
                    Batch: <code className="font-mono text-xs">{uploadResult.batchId}</code>
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Operator review table */}
          <div className="premium-card rounded-2xl p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-bold text-slate-950">Operator Entry &amp; Review</h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  Enter marks from the scan, dry-run validation, then commit only valid rows.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={scanRows.length === 0}
                  onClick={handleScanDryRun}
                  className="btn btn-primary"
                  title="Dry-run available once marks are extracted"
                >
                  Dry-run (operator review)
                </button>
                <button
                  type="button"
                  disabled={!canCommit || committing}
                  onClick={handleScanCommit}
                  className="btn btn-success"
                  title="Commit is enabled after dry-run finds valid rows with no invalid/review rows"
                >
                  {committing ? "Committing..." : "Commit valid rows"}
                </button>
              </div>
            </div>

            <div className="mt-4 grid gap-2 sm:grid-cols-5">
              {[
                ["Total students", rowSummary.total],
                ["Entered", rowSummary.entered],
                ["Missing", rowSummary.missing],
                ["Invalid", rowSummary.invalid],
                ["Ready to dry-run", rowSummary.ready],
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
                  <p className="text-[11px] font-bold uppercase text-slate-400">{label}</p>
                  <p className="mt-0.5 text-lg font-black text-slate-950">{value}</p>
                </div>
              ))}
            </div>

            {dryRunSummary && (
              <div className="mt-3 rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-800">
                {dryRunSummary}
              </div>
            )}

            <div className="mt-4">
              <ScanReviewTable
                rows={scanRows}
                onCorrectionChange={handleCorrectionChange}
                onRemarksChange={handleRemarksChange}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
