import { useEffect, useMemo, useRef, useState } from "react";
import { extractMarksWithGeminiScan, fetchScanOptions } from "../../client/importsClient";
import { SCAN_ACCEPT } from "../../client/marksSheetHelpers";
import type {
  GeminiScanContext,
  GeminiScanExtractResponse,
  GeminiScanRow,
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

  const hasBlocking = useMemo(
    () => rows.some((row) => row.status === "BLOCKED" || row.status === "REVIEW_REQUIRED"),
    [rows],
  );
  const canCommit = false;

  async function handleExtract() {
    if (!image || !requiredFilled) return;
    setPhase("compressing");
    setError("");
    setResult(null);
    setRows([]);
    setReviewConfirmed(false);
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

          <div className="premium-card overflow-x-auto rounded-2xl p-4">
            <h2 className="text-sm font-bold text-slate-950">Review &amp; correct</h2>
            <table className="mt-3 w-full min-w-[860px] border-collapse text-sm">
              <thead>
                <tr className="text-left text-[11px] font-bold uppercase text-slate-400">
                  <th className="px-2 py-2">Row</th>
                  <th className="px-2 py-2">Extracted Student ID</th>
                  <th className="px-2 py-2">Matched Student</th>
                  <th className="px-2 py-2">Extracted Name</th>
                  <th className="px-2 py-2">Mark</th>
                  <th className="px-2 py-2">Status</th>
                  <th className="px-2 py-2">Issues</th>
                  <th className="px-2 py-2">Action</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.rowNumber} className={rowClass(row.status)} data-testid={`gemini-row-${row.rowNumber}`} data-status={row.status}>
                    <td className="px-2 py-2 font-mono text-xs text-slate-500">{row.rowNumber}</td>
                    <td className="px-2 py-2 font-mono text-xs">{row.extractedStudentId || <span className="text-red-500">—</span>}</td>
                    <td className="px-2 py-2">
                      <input
                        type="text"
                        value={row.matchedStudentId ?? ""}
                        onChange={(e) => updateRow(row.rowNumber, { matchedStudentId: e.target.value || null })}
                        className="w-40 rounded border border-slate-200 bg-white px-1.5 py-1 text-xs"
                        placeholder="match student ID"
                        aria-label={`Matched student for row ${row.rowNumber}`}
                      />
                      {row.matchedStudentName && (
                        <p className="mt-0.5 text-[11px] text-slate-500">{row.matchedStudentName}</p>
                      )}
                    </td>
                    <td className="px-2 py-2">
                      <input
                        type="text"
                        value={row.extractedStudentName}
                        onChange={(e) => updateRow(row.rowNumber, { extractedStudentName: e.target.value })}
                        className="w-40 rounded border border-slate-200 bg-white px-1.5 py-1 text-xs"
                        aria-label={`Extracted name for row ${row.rowNumber}`}
                      />
                    </td>
                    <td className="px-2 py-2">
                      <input
                        type="text"
                        value={row.mark}
                        onChange={(e) => updateRow(row.rowNumber, { mark: e.target.value })}
                        className={`w-16 rounded border px-1.5 py-1 text-xs ${
                          row.issues.some((i) => /mark/i.test(i)) ? "border-red-400 bg-red-50" : "border-slate-200 bg-white"
                        }`}
                        aria-label={`Mark for row ${row.rowNumber}`}
                      />
                    </td>
                    <td className="px-2 py-2">
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${statusBadge(row.status)}`}>
                        {row.status}
                      </span>
                    </td>
                    <td className="px-2 py-2">
                      <div className="flex flex-wrap gap-1">
                        {row.issues.length === 0
                          ? <span className="text-[11px] text-slate-400">—</span>
                          : row.issues.map((issue) => (
                              <span key={issue} className={`rounded px-1.5 py-0.5 text-[11px] ${issueClass(issue)}`}>{issue}</span>
                            ))}
                      </div>
                    </td>
                    <td className="px-2 py-2 text-[11px] text-slate-400">
                      {row.confidenceScore ? `conf ${Math.round(row.confidenceScore * 100)}%` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={reviewConfirmed}
              onChange={(e) => setReviewConfirmed(e.target.checked)}
            />
            I have reviewed every flagged row.
          </label>
          {hasBlocking && (
            <p className="text-xs text-amber-700">Resolve all blocked and review rows before committing.</p>
          )}
        </div>
      )}

      {/* Commit button */}
      <div className="premium-card rounded-2xl p-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            disabled={!canCommit || hasBlocking || !reviewConfirmed}
            className="btn btn-success"
            title="Commit is not enabled in this phase"
          >
            Commit after review coming next
          </button>
        </div>
      </div>
    </div>
  );
}
