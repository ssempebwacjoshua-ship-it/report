import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { commitGeminiScanRows, extractMarksWithGeminiScan, fetchScanOptions } from "../../client/importsClient";
import { SCAN_ACCEPT } from "../../client/marksSheetHelpers";
import type {
  GeminiCommitResponse,
  GeminiScanContext,
  GeminiScanExtractResponse,
  GeminiScanRow,
  GeminiRowStatus,
  ScanOptions,
} from "../../shared/types/imports";

type Phase = "idle" | "compressing" | "extracting" | "review";

type OptionsState =
  | { status: "loading" }
  | { status: "ready"; data: ScanOptions }
  | { status: "error"; message: string };

async function compressImage(file: File, maxPx = 1400, quality = 0.8): Promise<File> {
  if (!file.type.startsWith("image/")) return file;
  if (!document.createElement("canvas").getContext("2d")) return file;
  try {
    return await new Promise<File>((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      const fallback = setTimeout(() => { URL.revokeObjectURL(url); resolve(file); }, 5000);
      img.onload = () => {
        clearTimeout(fallback);
        URL.revokeObjectURL(url);
        const { width, height } = img;
        if (width <= maxPx && height <= maxPx) { resolve(file); return; }
        const scale = Math.min(maxPx / width, maxPx / height);
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(width * scale);
        canvas.height = Math.round(height * scale);
        const ctx = canvas.getContext("2d");
        if (!ctx) { resolve(file); return; }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(
          (blob) => {
            if (!blob || blob.size >= file.size) { resolve(file); return; }
            resolve(new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), { type: "image/jpeg" }));
          },
          "image/jpeg",
          quality,
        );
      };
      img.onerror = () => { clearTimeout(fallback); URL.revokeObjectURL(url); reject(new Error("Image load failed")); };
      img.src = url;
    });
  } catch {
    return file;
  }
}

function emptyContext(): GeminiScanContext {
  return { classId: "", streamId: "", subjectId: "", termId: "", examType: "BOT" };
}

function rowClass(status: GeminiScanRow["status"]): string {
  if (status === "BLOCKED") return "bg-red-50 border-l-4 border-red-400";
  if (status === "REVIEW_REQUIRED") return "bg-amber-50 border-l-4 border-amber-400";
  return "bg-white";
}

function statusBadge(status: GeminiScanRow["status"]): string {
  if (status === "BLOCKED") return "bg-red-100 text-red-800";
  if (status === "REVIEW_REQUIRED") return "bg-amber-100 text-amber-800";
  return "bg-emerald-100 text-emerald-800";
}

function issueClass(issue: string): string {
  if (/missing mark/i.test(issue)) return "bg-red-100 text-red-800 font-bold";
  if (/invalid mark|outside valid range/i.test(issue)) return "bg-orange-100 text-orange-800 font-bold";
  if (/not found|duplicate/i.test(issue)) return "bg-red-100 text-red-800";
  return "bg-amber-100 text-amber-800";
}

const SUMMARY_CARDS: Array<{ key: keyof GeminiScanExtractResponse["summary"]; label: string; color: string }> = [
  { key: "totalRows", label: "Total rows", color: "bg-slate-50 text-slate-700" },
  { key: "readyRows", label: "Ready rows", color: "bg-emerald-50 text-emerald-700" },
  { key: "reviewRows", label: "Review rows", color: "bg-amber-50 text-amber-700" },
  { key: "missingMarkRows", label: "Missing marks", color: "bg-red-50 text-red-700" },
  { key: "unmatchedStudentRows", label: "Unmatched students", color: "bg-orange-50 text-orange-700" },
  { key: "duplicateStudentRows", label: "Duplicate rows", color: "bg-violet-50 text-violet-700" },
];

type CommitPhase = "idle" | "saving" | "saved" | "error";

export function GeminiScanPanel() {
  const [options, setOptions] = useState<OptionsState>({ status: "loading" });
  const [context, setContext] = useState<GeminiScanContext>(emptyContext());
  const [image, setImage] = useState<File | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [result, setResult] = useState<GeminiScanExtractResponse | null>(null);
  const [rows, setRows] = useState<GeminiScanRow[]>([]);
  const [error, setError] = useState("");
  const [reviewConfirmed, setReviewConfirmed] = useState(false);
  const [compressedSize, setCompressedSize] = useState<number | null>(null);
  const [commitPhase, setCommitPhase] = useState<CommitPhase>("idle");
  const [commitError, setCommitError] = useState("");
  const [commitResponse, setCommitResponse] = useState<GeminiCommitResponse | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchScanOptions()
      .then((data) => setOptions({ status: "ready", data }))
      .catch((err) => setOptions({
        status: "error",
        message: err instanceof Error ? err.message : "Could not load options",
      }));
  }, []);

  function set<K extends keyof GeminiScanContext>(key: K, value: GeminiScanContext[K]) {
    if (key === "classId") {
      setContext((prev) => ({ ...prev, classId: value as string, streamId: "" }));
    } else {
      setContext((prev) => ({ ...prev, [key]: value }));
    }
  }

  const classStreams = useMemo(() => {
    if (options.status !== "ready") return [];
    return options.data.streams.filter((s) => s.classId === context.classId);
  }, [options, context.classId]);

  const optionsReady = options.status === "ready";
  const requiredFilled =
    optionsReady &&
    context.classId !== "" &&
    context.subjectId !== "" &&
    context.termId !== "" &&
    context.examType !== "";

  const isExtracting = phase === "compressing" || phase === "extracting";
  const canExtract = requiredFilled && image !== null && !isExtracting;

  // Commit is blocked until every row is READY.
  const hasBlockingIssues = useMemo(
    () => rows.some((row) => row.status !== "READY"),
    [rows],
  );
  const canCommit =
    !hasBlockingIssues &&
    reviewConfirmed &&
    !!result?.jobId &&
    commitPhase === "idle";

  const reportsUrl = useMemo(() => {
    if (!commitResponse) return "/reports";
    const params = new URLSearchParams();
    if (commitResponse.schoolCode) params.set("schoolCode", commitResponse.schoolCode);
    params.set("classId", context.classId);
    if (context.streamId) params.set("streamId", context.streamId);
    params.set("termId", context.termId);
    params.set("assessmentType", context.examType);
    if (commitResponse.academicYearId) params.set("academicYearId", commitResponse.academicYearId);
    return `/reports?${params.toString()}`;
  }, [commitResponse, context]);

  async function handleCommit() {
    if (!canCommit || !result) return;
    setCommitPhase("saving");
    setCommitError("");
    try {
      const response = await commitGeminiScanRows(result.jobId, rows);
      setCommitResponse(response);
      setCommitPhase("saved");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not save marks.";
      setCommitError(msg);
      setCommitPhase("error");
    }
  }

  async function handleExtract() {
    if (!image || !requiredFilled) return;
    setPhase("compressing");
    setError("");
    setResult(null);
    setRows([]);
    setReviewConfirmed(false);
    setCommitPhase("idle");
    setCommitError("");
    setCommitResponse(null);
    setCompressedSize(null);

    const compressed = await compressImage(image);
    if (compressed !== image) setCompressedSize(compressed.size);

    setPhase("extracting");
    try {
      const response = await extractMarksWithGeminiScan(compressed, context);
      setResult(response);
      setRows(response.rows);
      setPhase("review");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Extraction failed.";
      setError(
        /failed to fetch|networkerror|network error|err_http2|fetch/i.test(msg)
          ? "Could not reach the extraction server. Please try again or contact support."
          : /timeout/i.test(msg)
            ? "The image took too long to process. Try a clearer or smaller image."
            : msg,
      );
      setPhase("idle");
    }
  }

  function updateRow(rowNumber: number, patch: Partial<GeminiScanRow>) {
    setRows((prev) => prev.map((row) => (row.rowNumber === rowNumber ? { ...row, ...patch } : row)));
  }

  // Accept the matched student's enrolled name, clearing the name mismatch issue.
  function resolveNameMismatch(rowNumber: number) {
    setRows((prev) => prev.map((row) => {
      if (row.rowNumber !== rowNumber) return row;
      const newIssues = row.issues.filter((i) => !/name mismatch/i.test(i));
      const newStatus: GeminiRowStatus = newIssues.length === 0 ? "READY" : row.status;
      return {
        ...row,
        extractedStudentName: row.matchedStudentName ?? row.extractedStudentName,
        issues: newIssues,
        status: newStatus,
      };
    }));
  }

  // Validate and apply a mark entered by the operator, clearing the missing/invalid mark issue.
  function applyMark(rowNumber: number) {
    setRows((prev) => prev.map((row) => {
      if (row.rowNumber !== rowNumber) return row;
      const numVal = parseFloat(row.mark);
      if (row.mark.trim() === "" || isNaN(numVal) || numVal < 0 || numVal > 100) return row;
      const newIssues = row.issues.filter((i) => !/missing mark|invalid mark/i.test(i));
      const newStatus: GeminiRowStatus = newIssues.length === 0 ? "READY" : row.status;
      return { ...row, issues: newIssues, status: newStatus };
    }));
  }

  const selectCls =
    "premium-control rounded-xl border border-slate-200 bg-slate-50 p-2 text-sm font-normal text-slate-900 outline-none focus:border-blue-400 focus:bg-white";

  return (
    <div className="grid gap-5">
      {/* Banner */}
      <div className="flex items-start gap-3 rounded-2xl border border-violet-200 bg-violet-50 p-4">
        <div>
          <p className="text-sm font-bold text-violet-900">Smart Marksheet Import</p>
          <p className="mt-0.5 text-sm text-violet-700">
            Upload a photo or scan of a marksheet. The system reads the marks and prepares them
            for your review before anything is saved.
          </p>
        </div>
      </div>

      {/* Options load error */}
      {options.status === "error" && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          Could not load form options: {options.message}. Please refresh the page.
        </div>
      )}

      {/* Extraction error */}
      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}

      {/* Step 1 — context + image */}
      <div className="premium-card rounded-2xl p-4">
        <h2 className="text-sm font-bold text-slate-950">Step 1 — Select context and image</h2>
        <p className="mt-0.5 text-xs text-slate-500">
          All fields are required. Stream is required where the class uses streams.
        </p>

        {options.status === "loading" && (
          <p className="mt-4 text-sm text-slate-500">Loading options…</p>
        )}

        {optionsReady && (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1 text-xs font-semibold uppercase text-slate-500">
              Class <span className="text-red-500">*</span>
              <select
                aria-label="Class"
                value={context.classId}
                onChange={(e) => set("classId", e.target.value)}
                className={selectCls}
              >
                <option value="">Select class…</option>
                {options.data.classes.map((c) => (
                  <option key={c.id} value={c.id}>{c.name} ({c.code})</option>
                ))}
              </select>
            </label>

            {classStreams.length > 0 && (
              <label className="grid gap-1 text-xs font-semibold uppercase text-slate-500">
                Stream <span className="text-red-500">*</span>
                <select
                  aria-label="Stream"
                  value={context.streamId}
                  onChange={(e) => set("streamId", e.target.value)}
                  className={selectCls}
                >
                  <option value="">Select stream…</option>
                  {classStreams.map((s) => (
                    <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
                  ))}
                </select>
              </label>
            )}

            <label className="grid gap-1 text-xs font-semibold uppercase text-slate-500">
              Subject <span className="text-red-500">*</span>
              <select
                aria-label="Subject"
                value={context.subjectId}
                onChange={(e) => set("subjectId", e.target.value)}
                className={selectCls}
              >
                <option value="">Select subject…</option>
                {options.data.subjects.map((s) => (
                  <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
                ))}
              </select>
            </label>

            <label className="grid gap-1 text-xs font-semibold uppercase text-slate-500">
              Term <span className="text-red-500">*</span>
              <select
                aria-label="Term"
                value={context.termId}
                onChange={(e) => set("termId", e.target.value)}
                className={selectCls}
              >
                <option value="">Select term…</option>
                {options.data.terms.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </label>

            <label className="grid gap-1 text-xs font-semibold uppercase text-slate-500">
              Exam Type <span className="text-red-500">*</span>
              <select
                aria-label="Exam Type"
                value={context.examType}
                onChange={(e) => set("examType", e.target.value)}
                className={selectCls}
              >
                {options.data.examTypes.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </label>
          </div>
        )}

        <div className="mt-4 rounded-2xl border border-dashed border-violet-200 bg-gradient-to-b from-violet-50/60 to-white p-4">
          <label className="grid cursor-pointer gap-2 text-center">
            <span className="text-sm font-bold text-slate-950">Choose a marksheet image</span>
            <span className="text-xs text-slate-500">PNG, JPG, JPEG, WEBP, PDF</span>
            <input
              ref={fileInputRef}
              type="file"
              className="sr-only"
              accept={SCAN_ACCEPT}
              onChange={(e) => setImage(e.target.files?.[0] ?? null)}
              aria-label="Marksheet image"
            />
            <span className="btn btn-secondary mx-auto">Browse file</span>
          </label>
          {image && (
            <p className="mt-3 text-center text-xs text-slate-600">
              Selected: <span className="font-semibold text-slate-900">{image.name}</span>{" "}
              {compressedSize !== null && compressedSize < image.size
                ? `(${(image.size / 1024).toFixed(0)} KB → ${(compressedSize / 1024).toFixed(0)} KB)`
                : `(${(image.size / 1024).toFixed(1)} KB)`}
            </p>
          )}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleExtract}
            disabled={!canExtract}
            className="btn btn-primary"
          >
            Read Marksheet
          </button>
          {!requiredFilled && optionsReady && (
            <p className="self-center text-xs text-slate-500">Select class, subject, term, exam type, and an image to enable extraction.</p>
          )}
        </div>
      </div>

      {/* Step 2 — progress */}
      {isExtracting && (
        <div className="flex items-center gap-3 rounded-2xl border border-blue-100 bg-blue-50 p-4">
          <svg className="h-5 w-5 shrink-0 animate-spin text-blue-500" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <div>
            <p className="text-sm font-medium text-blue-800">
              {phase === "compressing" ? "Preparing image..." : "Extracting marks from image..."}
            </p>
            {phase === "extracting" && (
              <p className="mt-0.5 text-xs text-blue-600">Uploading and reading marksheet — may take 15–30 s</p>
            )}
          </div>
        </div>
      )}

      {/* Step 3 — review */}
      {phase === "review" && result && (
        <div className="grid gap-4">
          {/* Summary cards — from initial server response */}
          <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
            {SUMMARY_CARDS.map((card) => (
              <div key={card.key} className={`rounded-xl px-3 py-2 ${card.color}`} data-testid={`summary-${card.key}`}>
                <p className="text-[11px] font-bold uppercase">{card.label}</p>
                <p className="mt-0.5 text-lg font-black text-slate-950">{result.summary[card.key]}</p>
              </div>
            ))}
          </div>

          <p className="text-xs text-slate-500">
            Job ID: <code className="font-mono">{result.jobId}</code> · {result.count} rows extracted
          </p>

          {/* Review table */}
          <div className="premium-card overflow-x-auto rounded-2xl p-4">
            <h2 className="text-sm font-bold text-slate-950">Review &amp; correct</h2>
            <table className="mt-3 w-full min-w-[900px] border-collapse text-sm">
              <thead>
                <tr className="text-left text-[11px] font-bold uppercase text-slate-400">
                  <th className="px-2 py-2">Row</th>
                  <th className="px-2 py-2">Extracted ID</th>
                  <th className="px-2 py-2">Matched Student</th>
                  <th className="px-2 py-2">Extracted Name</th>
                  <th className="px-2 py-2">Mark</th>
                  <th className="px-2 py-2">Status &amp; Issues</th>
                  <th className="px-2 py-2">Action</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.rowNumber}
                    className={rowClass(row.status)}
                    data-testid={`gemini-row-${row.rowNumber}`}
                    data-status={row.status}
                  >
                    <td className="px-2 py-2 font-mono text-xs text-slate-500">{row.rowNumber}</td>

                    {/* Extracted Student ID (admission number from marksheet) */}
                    <td className="px-2 py-2 font-mono text-xs">
                      {row.extractedStudentId || <span className="text-red-500">—</span>}
                    </td>

                    {/* Matched Student — name + admission number, NO internal UUID */}
                    <td className="px-2 py-2" data-testid={`matched-student-${row.rowNumber}`}>
                      {row.matchedStudentName ? (
                        <div>
                          <p className="text-xs font-medium text-slate-900">{row.matchedStudentName}</p>
                          <p className="text-[11px] text-slate-500">{row.extractedStudentId}</p>
                        </div>
                      ) : (
                        <span className="text-[11px] text-red-500">— No match</span>
                      )}
                    </td>

                    {/* Extracted Name — read-only, for comparison with Matched Student */}
                    <td className="px-2 py-2 text-xs text-slate-700">
                      {row.extractedStudentName}
                    </td>

                    {/* Mark — editable until committed */}
                    <td className="px-2 py-2">
                      <input
                        type="text"
                        value={row.mark}
                        onChange={(e) => updateRow(row.rowNumber, { mark: e.target.value })}
                        disabled={commitPhase === "saved"}
                        className={`w-16 rounded border px-1.5 py-1 text-xs disabled:bg-slate-100 ${
                          row.issues.some((i) => /mark/i.test(i)) ? "border-red-400 bg-red-50" : "border-slate-200 bg-white"
                        }`}
                        aria-label={`Mark for row ${row.rowNumber}`}
                      />
                    </td>

                    {/* Status badge + issue chips stacked */}
                    <td className="px-2 py-2">
                      <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-bold ${statusBadge(row.status)}`}>
                        {row.status}
                      </span>
                      {row.issues.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {row.issues.map((issue) => (
                            <span key={issue} className={`rounded px-1.5 py-0.5 text-[11px] ${issueClass(issue)}`}>
                              {issue}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>

                    {/* Action column — targeted resolution buttons */}
                    <td className="px-2 py-2">
                      <div className="flex flex-col gap-1">
                        {row.issues.some((i) => /name mismatch/i.test(i)) && row.matchedStudentName && (
                          <button
                            type="button"
                            onClick={() => resolveNameMismatch(row.rowNumber)}
                            className="rounded bg-blue-100 px-2 py-1 text-[11px] font-semibold text-blue-800 hover:bg-blue-200"
                            aria-label={`Use enrolled name for row ${row.rowNumber}`}
                          >
                            Use enrolled name
                          </button>
                        )}
                        {row.issues.some((i) => /missing mark|invalid mark/i.test(i)) && (
                          <button
                            type="button"
                            onClick={() => applyMark(row.rowNumber)}
                            className="rounded bg-emerald-100 px-2 py-1 text-[11px] font-semibold text-emerald-800 hover:bg-emerald-200"
                            aria-label={`Apply mark for row ${row.rowNumber}`}
                          >
                            Apply mark
                          </button>
                        )}
                        {row.issues.length === 0 && row.confidenceScore > 0 && (
                          <span className="text-[11px] text-slate-400">
                            conf {Math.round(row.confidenceScore * 100)}%
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Review confirmation checkbox */}
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={reviewConfirmed}
              onChange={(e) => setReviewConfirmed(e.target.checked)}
            />
            I have reviewed every flagged row.
          </label>
          {hasBlockingIssues && (
            <p className="text-xs text-amber-700">
              Resolve all flagged rows before saving. Use "Use enrolled name" for name mismatches and "Apply mark" for missing marks.
            </p>
          )}
        </div>
      )}

      {/* Save Reviewed Marks */}
      {commitPhase !== "saved" && (
        <div className="premium-card rounded-2xl p-4">
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleCommit}
              disabled={!canCommit}
              className="btn btn-success"
            >
              {commitPhase === "saving" ? "Saving reviewed marks..." : "Save Reviewed Marks"}
            </button>
            {commitPhase === "error" && (
              <p className="text-xs text-red-600">{commitError}</p>
            )}
          </div>
        </div>
      )}

      {/* Success state */}
      {commitPhase === "saved" && (
        <div className="premium-card rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
          <p className="text-sm font-bold text-emerald-900">
            {commitResponse?.committedRows} marks saved and ready for reports.
          </p>
          <div className="mt-3 flex gap-3">
            <button type="button" disabled className="btn btn-success opacity-60">
              Marks Saved
            </button>
            <Link
              to={reportsUrl}
              className="rounded-xl border border-emerald-300 bg-white px-4 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-50"
            >
              Go to Reports
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
