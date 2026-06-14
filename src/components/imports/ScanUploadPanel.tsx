import { useEffect, useRef, useState } from "react";
import {
  commitScanRows,
  detectScanContext,
  dryRunScanRows,
  loadScanBatch,
  lookupMarksheetContext,
  uploadScanFile,
} from "../../client/importsClient";
import { fetchSettings } from "../../client/settingsClient";
import { SCAN_ACCEPT } from "../../client/marksSheetHelpers";
import type {
  DetectedContext,
  ScanImportRow,
  ScanMarksheetContext,
  ScanUploadResponse,
} from "../../shared/types/imports";
import { defaultSettingsSections, type SettingsSections } from "../../shared/types/settings";
import { ScanReviewTable } from "./ScanReviewTable";
import { ExtractedContextCard } from "./ExtractedContextCard";

// ── Types ─────────────────────────────────────────────────────────────────────

type Phase =
  | "idle"
  | "restoring"      // loading saved batch on mount
  | "detecting"
  | "context_review"
  | "manual_id"
  | "manual_form"
  | "extracting"
  | "marks_review";

const EXAM_TYPES = ["BOT", "MOT", "EOT"] as const;
const BATCH_SESSION_KEY = "scan_batchId";
const BATCH_QUERY_KEY = "scanBatchId";

// ── Helpers ───────────────────────────────────────────────────────────────────

function emptyContext(settings: SettingsSections = defaultSettingsSections): ScanMarksheetContext {
  return {
    marksheetId: "",
    className: "",
    streamName: "",
    subjectName: "",
    termName: settings.academic.activeTerm,
    examType: settings.academic.defaultAssessmentType === "TERM_SUMMARY" ? "EOT" : settings.academic.defaultAssessmentType,
    academicYear: settings.academic.activeAcademicYear,
  };
}

function detectedToForm(d: DetectedContext): ScanMarksheetContext {
  return {
    marksheetId: d.marksheetId,
    className: d.className,
    streamName: d.streamName,
    subjectName: d.subjectName,
    termName: d.termName,
    examType: d.examType,
    academicYear: d.academicYear,
  };
}

// ── Provider status badge ──────────────────────────────────────────────────────

function ProviderBadge({ result }: { result: ScanUploadResponse }) {
  const reachable = result.providerReachable ?? false;

  return (
    <div className={`mt-2 flex flex-wrap items-start gap-x-3 gap-y-1 rounded-xl border px-3 py-2 text-xs ${
      reachable
        ? "border-emerald-100 bg-emerald-50 text-emerald-800"
        : "border-red-100 bg-red-50 text-red-700"
    }`}>
      <span>
        <span className="font-semibold">Provider:</span>{" "}
        <span className={reachable ? "font-bold" : "text-red-700"}>Azure OCR</span>
        {reachable && (
          <span className="ml-1 inline-flex h-2 w-2 rounded-full bg-emerald-400" title="Reachable" />
        )}
      </span>
      {!reachable && (
        <span>OCR temporarily unavailable. Contact platform support.</span>
      )}
    </div>
  );
}

function contextSourceLabel(source?: string): string {
  if (source === "recognized-id") return "Auto-detected from scan";
  if (source === "selected-context") return "Selected context";
  return "Manual required";
}

function matchSourceLabel(source?: string): string {
  if (source === "header") return "header";
  if (source === "footer") return "footer";
  if (source === "selected-fallback") return "selected fallback";
  return "manual required";
}

function extractionOutcome(rows: ScanImportRow[]): string {
  const accepted = rows.filter((row) => row.extractedMark || row.suggestedMark).length;
  const needsEntry = rows.filter((row) => row.status === "MISSING" || row.status === "NEEDS_REVIEW").length;
  return `Extraction completed with ${accepted} accepted suggestion${accepted === 1 ? "" : "s"}, ${needsEntry} needs entry.`;
}

function BatchDebugPanel({ result }: { result: ScanUploadResponse }) {
  const debug = result.marksheetIdDebug;
  const cropPaths = [
    ["Top-right crop", debug?.topRightCropPath],
    ["Expanded top-right crop", debug?.expandedTopRightCropPath],
    ["Full header crop", debug?.headerCropPath],
    ["Footer crop", debug?.footerCropPath],
    ["Debug JSON", debug?.debugJsonPath],
  ].filter(([, value]) => Boolean(value));

  return (
    <details className="rounded-2xl border border-violet-200 bg-violet-50/40 p-4">
      <summary className="cursor-pointer text-sm font-bold text-slate-800">
        Show scan debug
      </summary>
      <div className="mt-4 grid gap-3 text-xs text-slate-600">
        <div className="grid gap-2 rounded-xl border border-slate-100 bg-white px-3 py-2 md:grid-cols-2">
          <p><span className="font-semibold">Parse status:</span> {result.parseStatus}</p>
          <p><span className="font-semibold">Provider reachable:</span> {result.providerReachable === false ? "No" : "Yes"}</p>
          <p><span className="font-semibold">Recognized ID:</span> {result.normalizedRecognizedId || result.recognizedMarksheetId || "Not recognized"}</p>
          <p><span className="font-semibold">Matched ID:</span> {result.matchedMarksheetId || result.normalizedMarksheetId || "Not matched"}</p>
          <p><span className="font-semibold">Match source:</span> {matchSourceLabel(result.matchSource)}</p>
          <p><span className="font-semibold">Context source:</span> {contextSourceLabel(result.contextSource)}</p>
        </div>

        {debug?.rawHeaderText || debug?.rawFooterText ? (
          <div className="rounded-xl border border-slate-100 bg-white px-3 py-2">
            <p className="font-semibold text-slate-700">Raw ID OCR</p>
            {debug.rawHeaderText ? <pre className="mt-1 whitespace-pre-wrap font-mono text-[11px] text-slate-600">{debug.rawHeaderText}</pre> : null}
            {debug.rawFooterText ? <pre className="mt-2 whitespace-pre-wrap font-mono text-[11px] text-slate-500">{debug.rawFooterText}</pre> : null}
          </div>
        ) : null}

        {debug?.normalizedCandidates && debug.normalizedCandidates.length > 0 ? (
          <div className="rounded-xl border border-slate-100 bg-white px-3 py-2">
            <p className="font-semibold text-slate-700">Normalized ID candidates</p>
            <div className="mt-1 flex flex-wrap gap-1">
              {debug.normalizedCandidates.map((candidate) => (
                <code key={candidate} className="rounded bg-slate-100 px-2 py-1 font-mono text-[11px] text-slate-700">
                  {candidate}
                </code>
              ))}
            </div>
          </div>
        ) : null}

        {cropPaths.length > 0 ? (
          <div className="rounded-xl border border-slate-100 bg-white px-3 py-2">
            <p className="font-semibold text-slate-700">Debug artifacts</p>
            <div className="mt-1 grid gap-1">
              {cropPaths.map(([label, value]) => (
                <p key={label}>
                  <span className="font-semibold">{label}:</span>{" "}
                  <code className="font-mono text-[11px] text-slate-500">{value}</code>
                </p>
              ))}
            </div>
          </div>
        ) : null}

        {debug?.failureReason ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-amber-800">
            <span className="font-semibold">ID failure:</span> {debug.failureReason}
          </div>
        ) : null}
      </div>
    </details>
  );
}

// ── File preview ──────────────────────────────────────────────────────────────

function FilePreview({ file, url }: { file: File; url: string }) {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  const isImage = ["png", "jpg", "jpeg", "webp"].includes(ext);
  const isPdf = ext === "pdf";
  const sizeKb = (file.size / 1024).toFixed(1);

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
          <input type="text" value={context.marksheetId} onChange={(e) => set("marksheetId", e.target.value)} placeholder="e.g. MS-2026-SEN1-A-CHEM-EOT-T1" className={inputCls} />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="grid gap-1 text-xs font-semibold uppercase text-slate-500">
            Class <span className="text-red-500">*</span>
            <input type="text" value={context.className} onChange={(e) => set("className", e.target.value)} placeholder="e.g. Senior 1 A" className={inputCls} />
          </label>
          <label className="grid gap-1 text-xs font-semibold uppercase text-slate-500">
            Stream <span className="text-red-500">*</span>
            <input type="text" value={context.streamName} onChange={(e) => set("streamName", e.target.value)} placeholder="e.g. A" className={inputCls} />
          </label>
        </div>

        <label className="grid gap-1 text-xs font-semibold uppercase text-slate-500">
          Subject <span className="text-red-500">*</span>
          <input type="text" value={context.subjectName} onChange={(e) => set("subjectName", e.target.value)} placeholder="e.g. Mathematics" className={inputCls} />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="grid gap-1 text-xs font-semibold uppercase text-slate-500">
            Term <span className="text-red-500">*</span>
            <input type="text" value={context.termName} onChange={(e) => set("termName", e.target.value)} placeholder="e.g. Term 1" className={inputCls} />
          </label>
          <label className="grid gap-1 text-xs font-semibold uppercase text-slate-500">
            Exam Type <span className="text-red-500">*</span>
            <select value={context.examType} onChange={(e) => set("examType", e.target.value)} className={inputCls}>
              {EXAM_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>
        </div>

        <label className="grid gap-1 text-xs font-semibold uppercase text-slate-500">
          Academic Year <span className="text-red-500">*</span>
          <input type="text" value={context.academicYear} onChange={(e) => set("academicYear", e.target.value)} placeholder="e.g. 2026" className={inputCls} />
        </label>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function ScanUploadPanel() {
  const [settings, setSettings] = useState<SettingsSections>(defaultSettingsSections);
  const [phase, setPhase] = useState<Phase>("idle");
  const [currentBatchId, setCurrentBatchId] = useState("");
  const [scanFile, setScanFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [detectedCtx, setDetectedCtx] = useState<DetectedContext | null>(null);
  const [recognizedMarksheetId, setRecognizedMarksheetId] = useState<string | null>(null);
  const [contextForm, setContextForm] = useState<ScanMarksheetContext>(emptyContext());
  const [manualId, setManualId] = useState("");
  const [idLookupBusy, setIdLookupBusy] = useState(false);
  const [uploadResult, setUploadResult] = useState<ScanUploadResponse | null>(null);
  const [scanRows, setScanRows] = useState<ScanImportRow[]>([]);
  const [dryRunSummary, setDryRunSummary] = useState("");
  const [canCommit, setCanCommit] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

  useEffect(() => {
    fetchSettings()
      .then((loaded) => {
        setSettings(loaded.sections);
        setContextForm((current) => {
          if (current.className || current.subjectName || current.marksheetId) return current;
          return emptyContext(loaded.sections);
        });
      })
      .catch(() => {});
  }, []);

  function rememberBatch(batchId: string) {
    setCurrentBatchId(batchId);
    sessionStorage.setItem(BATCH_SESSION_KEY, batchId);
    const url = new URL(window.location.href);
    url.searchParams.set(BATCH_QUERY_KEY, batchId);
    window.history.replaceState({}, "", url);
  }

  function forgetBatch() {
    setCurrentBatchId("");
    sessionStorage.removeItem(BATCH_SESSION_KEY);
    const url = new URL(window.location.href);
    url.searchParams.delete(BATCH_QUERY_KEY);
    window.history.replaceState({}, "", url);
  }

  // On mount: restore previous session from sessionStorage
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const savedBatchId = params.get(BATCH_QUERY_KEY) || sessionStorage.getItem(BATCH_SESSION_KEY);
    if (savedBatchId) {
      setPhase("restoring");
      loadScanBatch(savedBatchId)
        .then((batch) => {
          if (batch.rows.length > 0 || batch.context || batch.resolvedContext) {
            const result: ScanUploadResponse = {
              batchId: batch.batchId,
              scanBatchId: batch.scanBatchId ?? batch.batchId,
              parseStatus: batch.parseStatus,
              message: batch.message,
              rows: batch.rows,
              recognizedMarksheetId: batch.recognizedMarksheetId,
              normalizedMarksheetId: batch.normalizedMarksheetId,
              rawRecognizedId: batch.rawRecognizedId,
              normalizedRecognizedId: batch.normalizedRecognizedId,
              matchedMarksheetId: batch.matchedMarksheetId,
              matchConfidence: batch.matchConfidence,
              matchSource: batch.matchSource,
              marksheetIdDebug: batch.marksheetIdDebug,
              selectedMarksheetId: batch.selectedMarksheetId,
              resolvedContext: batch.resolvedContext,
              contextSource: batch.contextSource,
              contextWarning: batch.contextWarning,
              configuredProvider: batch.configuredProvider,
              activeProvider: batch.activeProvider,
              providerReachable: batch.providerReachable,
              fallbackReason: batch.fallbackReason,
            };
            rememberBatch(batch.batchId);
            setUploadResult(result);
            setScanRows(batch.rows);
            if (batch.resolvedContext || batch.context) setContextForm((batch.resolvedContext ?? batch.context)!);
            setRecognizedMarksheetId(batch.recognizedMarksheetId ?? null);
            setPhase("marks_review");
          } else {
            forgetBatch();
            setPhase("idle");
          }
        })
        .catch(() => {
          forgetBatch();
          setPhase("idle");
        });
    }
  }, []);

  // ── File selection → auto-detect ─────────────────────────────────────────────

  async function handleFileChange(file: File | null) {
    setError("");
    setDetectedCtx(null);
    setRecognizedMarksheetId(null);
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

    try {
      const result = await detectScanContext(file, "SCU-PREVIEW");
      const recognizedId = result.normalizedRecognizedId ?? result.normalizedMarksheetId ?? result.recognizedMarksheetId ?? result.ocrFoundId ?? null;
      setRecognizedMarksheetId(recognizedId);
      if (result.detected && result.detectionStatus === "DETECTED" && result.contextSource === "recognized-id") {
        const resolvedContext = result.resolvedContext ?? detectedToForm(result.detected);
        setDetectedCtx(result.detected);
        setContextForm(resolvedContext);
        await handleExtractMarks(resolvedContext, file);
      } else if (result.detected && result.detectionStatus !== "NOT_FOUND") {
        setDetectedCtx(result.detected);
        setContextForm(result.resolvedContext ?? detectedToForm(result.detected));
        setPhase("context_review");
      } else {
        setError(result.message || "Could not read the marksheet ID from the top-right corner. Please upload a clearer image or enter the sheet ID manually.");
        setPhase("manual_id");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not read the marksheet ID from the top-right corner. Please upload a clearer image or enter the sheet ID manually.");
      setPhase("manual_id");
    }
  }

  // ── Manual ID lookup ──────────────────────────────────────────────────────────

  async function handleIdLookup() {
    if (!manualId.trim()) {
      setError("Enter a Marksheet ID or Sheet Number (e.g. MS-2026-SEN1-A-CHEM-EOT-T1 or 20260613-265).");
      return;
    }
    setIdLookupBusy(true);
    setError("");
    try {
      const result = await lookupMarksheetContext(manualId.trim(), "SCU-PREVIEW");
      setRecognizedMarksheetId(result.normalizedMarksheetId ?? manualId.trim());
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

  // ── Confirm context → extract marks ──────────────────────────────────────────

  async function handleExtractMarks(confirmedContext: ScanMarksheetContext, fileOverride?: File) {
    const fileToUpload = fileOverride ?? scanFile;
    if (!fileToUpload) {
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
      const result = await uploadScanFile(fileToUpload, "SCU-PREVIEW", confirmedContext, {
        selectedMarksheetId: confirmedContext.marksheetId,
      });
      rememberBatch(result.scanBatchId ?? result.batchId);
      setContextForm(result.resolvedContext ?? confirmedContext);
      setRecognizedMarksheetId(result.normalizedRecognizedId ?? result.recognizedMarksheetId ?? recognizedMarksheetId);
      setUploadResult(result);
      setScanRows(result.rows);
      setDryRunSummary("");
      setCanCommit(false);
      setPhase("marks_review");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Mark extraction failed.");
      setPhase("context_review");
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
      const result = await dryRunScanRows(contextForm, scanRows, "SCU-PREVIEW", currentBatchId || uploadResult?.batchId);
      // Merge dry-run status back while PRESERVING operator corrections and crop images
      setScanRows((prev) =>
        result.rows.map((dryRow) => {
          const live = prev.find((r) => r.rowNumber === dryRow.rowNumber);
          return {
            ...dryRow,
            operatorCorrection: live?.operatorCorrection ?? dryRow.operatorCorrection,
            remarks: live?.remarks ?? dryRow.remarks,
            writtenCropDataUrl: live?.writtenCropDataUrl ?? dryRow.writtenCropDataUrl,
            splitCropDataUrl: live?.splitCropDataUrl ?? dryRow.splitCropDataUrl,
            splitDigitCropDataUrls: live?.splitDigitCropDataUrls ?? dryRow.splitDigitCropDataUrls,
            debugCropImages: live?.debugCropImages ?? dryRow.debugCropImages,
            debugRawOcr: live?.debugRawOcr ?? dryRow.debugRawOcr,
          };
        }),
      );
      setDryRunSummary(
        `${result.totalRows} rows checked: ${result.validRows} valid, ` +
        `${result.reviewRows} need review, ${result.missingRows} missing, ${result.invalidRows} invalid.`,
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
    forgetBatch();
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setScanFile(null);
    setPreviewUrl(null);
    setDetectedCtx(null);
    setRecognizedMarksheetId(null);
    setContextForm(emptyContext(settings));
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
        <svg className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
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

      {(recognizedMarksheetId || phase === "manual_id" || uploadResult?.contextWarning) && (
        <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-800">
          {recognizedMarksheetId ? (
            <>
              <p>
                Recognized Marksheet ID: <span className="font-mono font-bold">{recognizedMarksheetId}</span>
              </p>
              <p className="mt-1 font-semibold">Context source: Auto-detected from scan</p>
            </>
          ) : (
            <p>Marksheet ID not recognized. Confirm the marksheet context manually.</p>
          )}
          {uploadResult?.contextWarning && (
            <p className="mt-1 font-semibold">{uploadResult.contextWarning}</p>
          )}
        </div>
      )}

      {/* ── Restoring session ── */}
      {phase === "restoring" && (
        <div className="flex items-center gap-3 rounded-2xl border border-blue-100 bg-blue-50 p-4">
          <svg className="h-5 w-5 animate-spin text-blue-500" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <p className="text-sm font-medium text-blue-800">Restoring previous session…</p>
        </div>
      )}

      {/* ── Step 1: File upload ── */}
      {phase !== "restoring" && (
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
                Reset scan
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Step 2a: Auto-detecting ── */}
      {phase === "detecting" && (
        <div className="flex items-center gap-3 rounded-2xl border border-blue-100 bg-blue-50 p-4">
          <svg className="h-5 w-5 animate-spin text-blue-500" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <p className="text-sm font-medium text-blue-800">Scanning header for marksheet ID…</p>
        </div>
      )}

      {/* ── Step 2b: Detected context → confirm ── */}
      {phase === "context_review" && detectedCtx && (
        <div className="grid gap-4">
          <ExtractedContextCard
            context={detectedCtx}
            onEdit={() => { setContextForm(detectedToForm(detectedCtx)); setPhase("manual_form"); }}
          />
          <button type="button" onClick={() => handleExtractMarks(detectedToForm(detectedCtx))} className="btn btn-primary">
            Confirm context &amp; extract marks
          </button>
        </div>
      )}

      {/* ── Step 2c: Manual ID entry ── */}
      {phase === "manual_id" && (
        <div className="premium-card grid gap-4 rounded-2xl p-4">
          <div className="flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
            <p>Marksheet ID not recognized. Enter the printed Marksheet ID (e.g. MS-2026-SEN1-A-CHEM-EOT-T1) or Sheet Number (e.g. 20260613-265) to auto-fill context, or enter context manually.</p>
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase text-slate-500">Marksheet ID</label>
            <div className="mt-1.5 flex gap-2">
              <input
                type="text"
                value={manualId}
                onChange={(e) => setManualId(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleIdLookup()}
                placeholder="MS-2026-SEN1-A-CHEM-EOT-T1 or 20260613-265"
                className="premium-control flex-1 rounded-xl border border-slate-200 bg-slate-50 p-2 text-sm outline-none focus:border-blue-400 focus:bg-white"
              />
              <button type="button" onClick={handleIdLookup} disabled={idLookupBusy || !manualId.trim()} className="btn btn-primary">
                {idLookupBusy ? "Looking up…" : "Look up"}
              </button>
            </div>
          </div>
          <div className="border-t border-slate-100 pt-3">
            <button type="button" onClick={() => setPhase("manual_form")} className="text-xs text-slate-500 underline hover:text-slate-800">
              Skip — enter context manually instead
            </button>
          </div>
        </div>
      )}

      {/* ── Step 2d: Full manual form ── */}
      {phase === "manual_form" && (
        <div className="grid gap-4">
          <ContextForm
            context={contextForm}
            onChange={setContextForm}
            title="Manual marksheet context"
            subtitle="Copy the fields from the printed marksheet header."
          />
          <button
            type="button"
            onClick={() => handleExtractMarks(contextForm)}
            disabled={!contextForm.className.trim() || !contextForm.subjectName.trim() || !contextForm.termName.trim()}
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
          <div className="premium-card rounded-2xl p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-bold text-slate-950">Scan Batch Summary</h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  Batch ID: <code className="font-mono">{currentBatchId || uploadResult.batchId}</code>
                </p>
              </div>
              <span className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-bold text-blue-800">
                {contextSourceLabel(uploadResult.contextSource)}
              </span>
            </div>
            <div className="mt-3 grid gap-2 text-sm text-slate-700 md:grid-cols-2">
              <p>
                <span className="font-semibold">Recognized ID:</span>{" "}
                {uploadResult.normalizedRecognizedId || uploadResult.recognizedMarksheetId || <span className="text-slate-400">Not recognized</span>}
              </p>
              <p>
                <span className="font-semibold">Resolved ID:</span>{" "}
                {uploadResult.matchedMarksheetId || uploadResult.normalizedMarksheetId || uploadResult.resolvedContext?.marksheetId || <span className="text-slate-400">Manual context</span>}
              </p>
              <p>
                <span className="font-semibold">Match source:</span>{" "}
                {matchSourceLabel(uploadResult.matchSource)}
                {typeof uploadResult.matchConfidence === "number" && uploadResult.matchConfidence > 0
                  ? ` (${Math.round(uploadResult.matchConfidence * 100)}%)`
                  : ""}
              </p>
              <p>
                <span className="font-semibold">Class / Stream:</span>{" "}
                {contextForm.className || uploadResult.resolvedContext?.className || "-"} / {contextForm.streamName || uploadResult.resolvedContext?.streamName || "-"}
              </p>
              <p>
                <span className="font-semibold">Subject / Exam:</span>{" "}
                {contextForm.subjectName || uploadResult.resolvedContext?.subjectName || "-"} / {contextForm.examType || uploadResult.resolvedContext?.examType || "-"}
              </p>
              <p>
                <span className="font-semibold">OCR provider:</span>{" "}
                Azure
              </p>
              <p>
                <span className="font-semibold">Azure OCR:</span>{" "}
                {uploadResult.providerReachable === false
                  ? <span className="text-red-700">Unavailable — contact platform support.</span>
                  : <span className="text-emerald-700 font-semibold">Succeeded</span>}
              </p>
              <p>
                <span className="font-semibold">Table geometry:</span>{" "}
                {uploadResult.message.includes("Table geometry not detected")
                  ? <span className="text-amber-700 font-semibold">Fallback (estimated) — crop alignment may be off</span>
                  : uploadResult.message.includes("Table geometry detected")
                    ? <span className="text-emerald-700 font-semibold">Detected</span>
                    : <span className="text-slate-500">—</span>}
              </p>
            </div>
            {uploadResult.contextWarning && (
              <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800">
                {uploadResult.contextWarning}
              </div>
            )}
            <div className="mt-3 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700">
              {extractionOutcome(scanRows)}
            </div>
          </div>
          {/* Status banner */}
          {uploadResult.parseStatus === "FAILED" ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
              <p className="text-sm font-bold text-red-900">Extraction failed</p>
              <p className="mt-0.5 text-sm text-red-700">{uploadResult.message}</p>
              <p className="mt-1 text-xs text-red-400">Batch: <code className="font-mono">{uploadResult.batchId}</code></p>
            </div>
          ) : (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
              <p className="text-sm font-bold text-emerald-900">Scan processed. Enter and review marks before validation.</p>
              <p className="mt-0.5 text-sm text-emerald-700">{uploadResult.message}</p>
              <p className="mt-1 text-xs font-semibold text-emerald-700">
                OCR suggestions are optional assistance only. Operator marks are used for dry-run and commit.
              </p>
              <p className="mt-1 text-xs text-emerald-600">
                Batch: <code className="font-mono text-xs">{uploadResult.batchId}</code>
              </p>
              <ProviderBadge result={uploadResult} />
            </div>
          )}

          <BatchDebugPanel result={uploadResult} />

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
                <button type="button" disabled={scanRows.length === 0} onClick={handleScanDryRun} className="btn btn-primary">
                  Dry-run (operator review)
                </button>
                <button type="button" disabled={!canCommit || committing} onClick={handleScanCommit} className="btn btn-success">
                  {committing ? "Committing..." : "Commit valid rows"}
                </button>
                <button type="button" onClick={handleReset} className="btn btn-danger-light text-sm" title="Clear all extraction data and start over">
                  Reset scan
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
                providerInfo={uploadResult}
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
