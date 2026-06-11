import { useEffect, useRef, useState } from "react";
import { uploadScanFile } from "../../client/importsClient";
import { SCAN_ACCEPT } from "../../client/marksSheetHelpers";
import type { ScanImportRow, ScanMarksheetContext, ScanUploadResponse } from "../../shared/types/imports";
import { ScanReviewTable } from "./ScanReviewTable";

const EXAM_TYPES = ["BOT", "MOT", "EOT"] as const;

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
          className="mt-3 max-h-72 w-full rounded-lg border border-slate-200 object-contain bg-slate-50"
        />
      )}
      {isPdf && (
        <iframe
          src={url}
          title="PDF preview"
          className="mt-3 h-72 w-full rounded-lg border border-slate-200"
        />
      )}
    </div>
  );
}

export function ScanUploadPanel() {
  const [scanFile, setScanFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [context, setContext] = useState<ScanMarksheetContext>(emptyContext());
  const [uploadResult, setUploadResult] = useState<ScanUploadResponse | null>(null);
  const [scanRows, setScanRows] = useState<ScanImportRow[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  function handleScanFileChange(file: File | null) {
    setError("");
    setUploadResult(null);
    setScanRows([]);

    if (!file) return;

    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    if (!["pdf", "png", "jpg", "jpeg", "webp"].includes(ext)) {
      setError(
        `Unsupported file type: .${ext}. Use PDF, PNG, JPG, JPEG, or WEBP for scanned marksheets.`,
      );
      return;
    }

    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setScanFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  }

  function setField<K extends keyof ScanMarksheetContext>(key: K, value: ScanMarksheetContext[K]) {
    setContext((prev) => ({ ...prev, [key]: value }));
  }

  async function handleUpload() {
    if (!scanFile) {
      setError("Please select a scanned marksheet file first.");
      return;
    }
    const required: (keyof ScanMarksheetContext)[] = [
      "className",
      "streamName",
      "subjectName",
      "termName",
      "examType",
      "academicYear",
    ];
    const missing = required.filter((k) => !context[k].trim());
    if (missing.length > 0) {
      setError(`Please fill in: ${missing.join(", ")}`);
      return;
    }

    setUploading(true);
    setError("");
    try {
      const result = await uploadScanFile(scanFile, "SCU-PREVIEW", context);
      setUploadResult(result);
      setScanRows(result.rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  }

  function handleCorrectionChange(rowNumber: number, value: string) {
    setScanRows((prev) =>
      prev.map((row) =>
        row.rowNumber === rowNumber ? { ...row, operatorCorrection: value } : row,
      ),
    );
  }

  function handleClear() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setScanFile(null);
    setPreviewUrl(null);
    setContext(emptyContext());
    setUploadResult(null);
    setScanRows([]);
    setError("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  const canUpload =
    !!scanFile &&
    context.className.trim().length > 0 &&
    context.subjectName.trim().length > 0 &&
    !uploading;

  return (
    <div className="grid gap-5">
      {/* ── Operator warning ── */}
      <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
        <svg
          className="mt-0.5 h-5 w-5 shrink-0 text-amber-600"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
          />
        </svg>
        <div>
          <p className="text-sm font-bold text-amber-900">Operator review required</p>
          <p className="mt-0.5 text-sm text-amber-700">
            Scanned handwriting must be reviewed by an operator before committing. Extracted marks
            are never committed automatically.
          </p>
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {/* ── Main layout: file + context ── */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(260px,0.55fr)]">
        {/* File upload */}
        <div className="premium-card rounded-2xl p-4">
          <h2 className="text-sm font-bold text-slate-950">Scanned marksheet file</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Upload a scanned PDF or image of a completed handwritten marksheet.
          </p>
          <p className="mt-0.5 text-xs text-slate-400">
            Accepted: PDF, PNG, JPG, JPEG, WEBP
          </p>

          <div className="mt-3 rounded-2xl border border-dashed border-violet-200 bg-gradient-to-b from-violet-50/60 to-white p-4 shadow-inner">
            <label className="grid cursor-pointer gap-2 text-center">
              <span className="text-sm font-bold text-slate-950">Choose a scanned marksheet</span>
              <span className="text-xs text-slate-500">PDF, PNG, JPG, JPEG, WEBP</span>
              <input
                ref={fileInputRef}
                type="file"
                className="sr-only"
                accept={SCAN_ACCEPT}
                onChange={(e) => handleScanFileChange(e.target.files?.[0] ?? null)}
              />
              <span className="btn btn-secondary mx-auto">Browse file</span>
            </label>

            {scanFile && previewUrl ? (
              <FilePreview file={scanFile} url={previewUrl} />
            ) : null}
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleUpload}
              disabled={!canUpload}
              className="btn btn-primary"
            >
              {uploading ? "Extracting marks…" : "Upload & Extract Marks"}
            </button>
            <button
              type="button"
              onClick={handleClear}
              className="btn btn-danger-light"
            >
              Clear
            </button>
          </div>
        </div>

        {/* Marksheet context form */}
        <aside className="premium-card rounded-2xl p-4">
          <p className="text-sm font-bold text-slate-950">Marksheet context</p>
          <p className="mt-0.5 text-xs text-slate-500">
            Fill in the marksheet identity fields from the printed header.
          </p>

          <div className="mt-4 grid gap-3">
            <label className="grid gap-1 text-xs font-semibold uppercase text-slate-500">
              Marksheet ID
              <input
                type="text"
                value={context.marksheetId}
                onChange={(e) => setField("marksheetId", e.target.value)}
                placeholder="e.g. MS-2026-S1A-A-MATH-BOT-T1"
                className="premium-control rounded-xl border border-slate-200 bg-slate-50 p-2 text-sm font-normal text-slate-900 outline-none focus:border-blue-400 focus:bg-white"
              />
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="grid gap-1 text-xs font-semibold uppercase text-slate-500">
                Class <span className="text-red-500">*</span>
                <input
                  type="text"
                  value={context.className}
                  onChange={(e) => setField("className", e.target.value)}
                  placeholder="e.g. Senior 1 A"
                  className="premium-control rounded-xl border border-slate-200 bg-slate-50 p-2 text-sm font-normal text-slate-900 outline-none focus:border-blue-400 focus:bg-white"
                />
              </label>
              <label className="grid gap-1 text-xs font-semibold uppercase text-slate-500">
                Stream <span className="text-red-500">*</span>
                <input
                  type="text"
                  value={context.streamName}
                  onChange={(e) => setField("streamName", e.target.value)}
                  placeholder="e.g. A"
                  className="premium-control rounded-xl border border-slate-200 bg-slate-50 p-2 text-sm font-normal text-slate-900 outline-none focus:border-blue-400 focus:bg-white"
                />
              </label>
            </div>

            <label className="grid gap-1 text-xs font-semibold uppercase text-slate-500">
              Subject <span className="text-red-500">*</span>
              <input
                type="text"
                value={context.subjectName}
                onChange={(e) => setField("subjectName", e.target.value)}
                placeholder="e.g. Mathematics"
                className="premium-control rounded-xl border border-slate-200 bg-slate-50 p-2 text-sm font-normal text-slate-900 outline-none focus:border-blue-400 focus:bg-white"
              />
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="grid gap-1 text-xs font-semibold uppercase text-slate-500">
                Term <span className="text-red-500">*</span>
                <input
                  type="text"
                  value={context.termName}
                  onChange={(e) => setField("termName", e.target.value)}
                  placeholder="e.g. Term 1"
                  className="premium-control rounded-xl border border-slate-200 bg-slate-50 p-2 text-sm font-normal text-slate-900 outline-none focus:border-blue-400 focus:bg-white"
                />
              </label>
              <label className="grid gap-1 text-xs font-semibold uppercase text-slate-500">
                Exam Type <span className="text-red-500">*</span>
                <select
                  value={context.examType}
                  onChange={(e) => setField("examType", e.target.value)}
                  className="premium-control rounded-xl border border-slate-200 bg-slate-50 p-2 text-sm font-normal text-slate-900 outline-none focus:border-blue-400 focus:bg-white"
                >
                  {EXAM_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className="grid gap-1 text-xs font-semibold uppercase text-slate-500">
              Academic Year <span className="text-red-500">*</span>
              <input
                type="text"
                value={context.academicYear}
                onChange={(e) => setField("academicYear", e.target.value)}
                placeholder="e.g. 2026"
                className="premium-control rounded-xl border border-slate-200 bg-slate-50 p-2 text-sm font-normal text-slate-900 outline-none focus:border-blue-400 focus:bg-white"
              />
            </label>
          </div>
        </aside>
      </div>

      {/* ── Upload result / review section ── */}
      {uploadResult ? (
        <div className="grid gap-4">
          {/* Status banner */}
          {uploadResult.parseStatus === "FAILED" ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
              <div className="flex items-start gap-3">
                <svg
                  className="mt-0.5 h-5 w-5 shrink-0 text-red-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
                  />
                </svg>
                <div>
                  <p className="text-sm font-bold text-red-900">Extraction failed</p>
                  <p className="mt-0.5 text-sm text-red-700">{uploadResult.message}</p>
                  <p className="mt-1 text-xs text-red-500">
                    Batch registered:{" "}
                    <code className="font-mono">{uploadResult.batchId}</code>
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
              <div className="flex items-start gap-3">
                <svg
                  className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z"
                  />
                </svg>
                <div>
                  <p className="text-sm font-bold text-emerald-900">
                    Marks extracted — operator review required
                  </p>
                  <p className="mt-0.5 text-sm text-emerald-700">{uploadResult.message}</p>
                  <p className="mt-1 text-xs text-emerald-600">
                    Batch ID:{" "}
                    <code className="font-mono text-xs">{uploadResult.batchId}</code>
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Operator review table */}
          <div className="premium-card rounded-2xl p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-bold text-slate-950">Operator Review Table</h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  Review extracted marks, enter corrections, then dry-run before committing.
                  Scanned rows are never committed without operator approval.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={scanRows.length === 0}
                  className="btn btn-primary"
                  title="Dry-run is available once marks are extracted"
                >
                  Dry-run (operator review)
                </button>
                <button
                  type="button"
                  disabled
                  className="btn btn-success"
                  title="Commit is locked until dry-run passes"
                >
                  Commit valid rows
                </button>
              </div>
            </div>

            <div className="mt-4">
              <ScanReviewTable
                rows={scanRows}
                onCorrectionChange={handleCorrectionChange}
              />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
