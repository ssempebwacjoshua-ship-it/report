import { useEffect, useRef, useState } from "react";
import { generatePdfHtml, getSmartPagesSummary, uploadDocument } from "../client/documentCleanerClient";
import { useAppSettings } from "../components/layout/SettingsContext";
import type { DocumentUploadResponse, ExtractedDocument } from "../shared/types/documentCleaner";
import type { ExtractionMode, SmartPageSummary } from "../shared/types/smartPages";

type State =
  | { phase: "idle" }
  | { phase: "uploading" }
  | { phase: "ready"; draft: DocumentUploadResponse }
  | { phase: "error"; message: string };

type SmartPagesStatus = "loading" | "ok" | "error" | "no-settings";

const MODES: Array<{ value: ExtractionMode; label: string; description: string }> = [
  { value: "economical", label: "Economical", description: "Basic OCR — best for simple lists" },
  { value: "balanced", label: "Balanced", description: "Layout-aware — best for tables and grids" },
  { value: "high_accuracy", label: "High Accuracy", description: "Form parser — higher cost, PRO/Enterprise only" },
];

export function DocumentCleanerPage() {
  const appSettings = useAppSettings();
  const settingsReady = appSettings !== null && appSettings.settings !== null;
  const schoolCode = appSettings?.settings?.schoolCode || undefined;

  const [state, setState] = useState<State>({ phase: "idle" });
  const [doc, setDoc] = useState<ExtractedDocument | null>(null);
  const [mode, setMode] = useState<ExtractionMode>("balanced");
  const [showHighAccuracyWarning, setShowHighAccuracyWarning] = useState(false);
  const [pendingMode, setPendingMode] = useState<ExtractionMode | null>(null);
  const [spStatus, setSpStatus] = useState<SmartPagesStatus>("loading");
  const [smartPages, setSmartPages] = useState<SmartPageSummary | null>(null);
  const [spError, setSpError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!settingsReady) return;
    if (!schoolCode) {
      setSpStatus("no-settings");
      return;
    }
    setSpStatus("loading");
    getSmartPagesSummary(schoolCode)
      .then((summary) => { setSmartPages(summary); setSpStatus("ok"); })
      .catch((err) => {
        setSpError(err instanceof Error ? err.message : "Failed to load Smart Pages summary.");
        setSpStatus("error");
      });
  }, [settingsReady, schoolCode]);

  function handleModeChange(selected: ExtractionMode) {
    if (selected === "high_accuracy") {
      setPendingMode(selected);
      setShowHighAccuracyWarning(true);
    } else {
      setMode(selected);
    }
  }

  function confirmHighAccuracy() {
    if (pendingMode) setMode(pendingMode);
    setPendingMode(null);
    setShowHighAccuracyWarning(false);
  }

  function cancelHighAccuracy() {
    setPendingMode(null);
    setShowHighAccuracyWarning(false);
  }

  async function handleFile(file: File) {
    setState({ phase: "uploading" });
    try {
      const result = await uploadDocument(file, { schoolCode, extractionMode: mode });
      setDoc(result.document);
      setState({ phase: "ready", draft: result });
      if (schoolCode) {
        getSmartPagesSummary(schoolCode)
          .then((summary) => { setSmartPages(summary); setSpStatus("ok"); })
          .catch(() => {});
      }
    } catch (err) {
      setState({
        phase: "error",
        message: err instanceof Error ? err.message : "Upload failed.",
      });
    }
  }

  function handleFileInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) void handleFile(file);
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) void handleFile(file);
  }

  async function handleGeneratePdf() {
    if (!doc) return;
    try {
      const html = await generatePdfHtml(doc);
      const win = window.open("", "_blank");
      if (win) {
        win.document.write(html);
        win.document.close();
        win.print();
      }
    } catch (err) {
      setState({
        phase: "error",
        message: err instanceof Error ? err.message : "PDF generation failed.",
      });
    }
  }

  function updateTitle(value: string) {
    if (!doc) return;
    setDoc({ ...doc, title: value });
  }

  function updateCell(rowIndex: number, colIndex: number, value: string) {
    if (!doc) return;
    const rows = doc.rows.map((row, ri) => {
      if (ri !== rowIndex) return row;
      const cells = row.cells.map((c, ci) => (ci === colIndex ? value : c));
      return { ...row, cells };
    });
    setDoc({ ...doc, rows });
  }

  const uncertainSet = new Set(
    (doc?.uncertainCells ?? []).map((u) => `${u.rowIndex}:${u.columnIndex}`),
  );

  const ready = state.phase === "ready";
  const uploading = state.phase === "uploading";

  const remainingPages = smartPages?.remainingPages ?? null;
  const includedPages = smartPages?.includedPages ?? 0;
  const billingCycle = smartPages?.billingCycle === "ACADEMIC_YEAR" ? "Academic Year" : smartPages?.billingCycle ?? "";

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Document Cleaner</h1>
            <p className="mt-1 text-sm text-gray-500">
              Take a photo of a handwritten list or table and get a clean, printable document.
            </p>
          </div>

          {/* Smart Pages card — always visible */}
          <div className={`shrink-0 rounded-lg border px-4 py-3 text-sm ${
            spStatus === "error" ? "border-red-200 bg-red-50" :
            spStatus === "ok" ? "border-blue-200 bg-blue-50" :
            "border-gray-200 bg-gray-50"
          }`}>
            {spStatus === "loading" && (
              <>
                <p className="font-semibold text-gray-600">Smart Pages</p>
                <p className="mt-0.5 text-gray-400">Loading Smart Pages…</p>
              </>
            )}
            {spStatus === "no-settings" && (
              <>
                <p className="font-semibold text-gray-600">Smart Pages</p>
                <p className="mt-0.5 text-gray-400">Smart Pages not configured for this school.</p>
              </>
            )}
            {spStatus === "error" && (
              <>
                <p className="font-semibold text-red-700">Smart Pages</p>
                <p className="mt-0.5 text-red-600">{spError ?? "Failed to load Smart Pages summary."}</p>
              </>
            )}
            {spStatus === "ok" && smartPages && (
              <>
                <p className="font-semibold text-blue-800">Smart Pages</p>
                <p className="mt-0.5 text-blue-700">
                  <span className="font-bold">{remainingPages === Infinity ? "Unlimited" : remainingPages?.toLocaleString()}</span>
                  {" / "}{(includedPages + (smartPages.topUpPages ?? 0)).toLocaleString()} remaining
                </p>
                <p className="mt-0.5 text-xs text-blue-500">{billingCycle} {smartPages.planName ?? ""}</p>
                {remainingPages === 0 && (
                  <p className="mt-1 text-xs font-medium text-red-600">
                    You have used all Smart Pages. Buy top-up pages to continue.
                  </p>
                )}
              </>
            )}
          </div>
        </div>

        {/* High Accuracy warning dialog */}
        {showHighAccuracyWarning && (
          <div className="mb-4 rounded-lg border border-yellow-300 bg-yellow-50 p-4">
            <p className="font-semibold text-yellow-800">High Accuracy mode may cost more</p>
            <p className="mt-1 text-sm text-yellow-700">
              High Accuracy uses an advanced form parser and consumes more Smart Pages per document. Continue?
            </p>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={confirmHighAccuracy}
                className="rounded bg-yellow-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-yellow-700"
              >
                Yes, use High Accuracy
              </button>
              <button
                type="button"
                onClick={cancelHighAccuracy}
                className="rounded border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Upload area — before upload */}
        {!ready && (
          <>
            {/* Mode selector */}
            <div className="mb-4 rounded-lg border border-gray-200 bg-white p-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                Extraction Mode
              </p>
              <div className="flex flex-col gap-2 sm:flex-row">
                {MODES.map((m) => (
                  <label
                    key={m.value}
                    className={`flex cursor-pointer items-start gap-2 rounded-lg border p-3 transition-colors ${
                      mode === m.value
                        ? "border-blue-500 bg-blue-50"
                        : "border-gray-200 hover:border-blue-300"
                    }`}
                  >
                    <input
                      type="radio"
                      name="extractionMode"
                      value={m.value}
                      checked={mode === m.value}
                      onChange={() => handleModeChange(m.value)}
                      className="mt-0.5 shrink-0"
                      aria-label={m.label}
                    />
                    <div>
                      <p className="text-sm font-medium text-gray-900">{m.label}</p>
                      <p className="text-xs text-gray-500">{m.description}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div
              className={`rounded-lg border-2 border-dashed p-10 text-center transition-colors ${
                uploading
                  ? "border-blue-300 bg-blue-50"
                  : "border-gray-300 bg-white hover:border-blue-400"
              }`}
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,application/pdf"
                className="sr-only"
                onChange={handleFileInputChange}
              />
              <p className="mb-3 text-sm font-medium text-gray-700">
                {uploading ? "Extracting text from your document…" : "Drag & drop a file here"}
              </p>
              {!uploading && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                >
                  Browse files
                </button>
              )}
              <p className="mt-3 text-xs text-gray-400">PNG, JPG, WEBP, or PDF — max 20 MB</p>
              {schoolCode && remainingPages !== null && remainingPages !== Infinity && (
                <p className="mt-2 text-xs text-gray-500">
                  This will use <span className="font-medium">1 Smart Page</span>
                  {" "}({remainingPages.toLocaleString()} remaining).
                </p>
              )}
            </div>
          </>
        )}

        {/* Error */}
        {state.phase === "error" && (
          <div className="mt-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {state.message}
            <button
              type="button"
              className="ml-3 underline"
              onClick={() => setState({ phase: "idle" })}
            >
              Try again
            </button>
          </div>
        )}

        {/* Ready state */}
        {ready && doc && (
          <>
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex-1">
                <label className="mb-1 block text-xs font-medium text-gray-500">
                  Document Title
                </label>
                <input
                  type="text"
                  value={doc.title}
                  onChange={(e) => updateTitle(e.target.value)}
                  className="w-full rounded border border-gray-300 px-3 py-1.5 text-sm font-semibold text-gray-900 focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div className="flex shrink-0 gap-2 pt-5">
                <button
                  type="button"
                  onClick={() => {
                    setState({ phase: "idle" });
                    setDoc(null);
                    if (fileInputRef.current) fileInputRef.current.value = "";
                  }}
                  className="rounded border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100"
                >
                  New document
                </button>
                <button
                  type="button"
                  onClick={() => void handleGeneratePdf()}
                  className="rounded bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
                >
                  Generate Clean PDF
                </button>
              </div>
            </div>

            <div className="mb-4 flex gap-4 text-sm">
              {doc.schoolName && (
                <span className="font-medium text-gray-700">{doc.schoolName}</span>
              )}
              {doc.academicYear && <span className="text-gray-500">{doc.academicYear}</span>}
              {doc.term && <span className="text-gray-500">{doc.term}</span>}
            </div>

            <div className="grid gap-4 sm:grid-cols-[1fr_220px]">
              <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
                <table className="min-w-full text-sm">
                  {doc.columns.length > 0 && (
                    <thead className="bg-gray-50">
                      <tr>
                        {doc.columns.map((col, ci) => (
                          <th
                            key={ci}
                            className="px-3 py-2 text-left text-xs font-semibold uppercase text-gray-600"
                          >
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                  )}
                  <tbody className="divide-y divide-gray-100">
                    {doc.rows.map((row, ri) => (
                      <tr key={ri} className={ri % 2 === 1 ? "bg-gray-50" : ""}>
                        {row.cells.map((cell, ci) => {
                          const isUncertain = uncertainSet.has(`${ri}:${ci}`);
                          const uncertainReason = isUncertain
                            ? (doc.uncertainCells.find(
                                (u) => u.rowIndex === ri && u.columnIndex === ci,
                              )?.reason ?? "Review this cell")
                            : undefined;
                          return (
                            <td
                              key={ci}
                              data-uncertain={isUncertain ? "true" : undefined}
                              title={uncertainReason}
                              className={`px-2 py-1 ${
                                isUncertain
                                  ? "uncertain bg-yellow-50 ring-1 ring-yellow-300 ring-inset"
                                  : ""
                              }`}
                            >
                              {cell}
                              <input
                                id={`cell-${ri}-${ci}`}
                                type="text"
                                defaultValue={cell}
                                onChange={(e) => updateCell(ri, ci, e.target.value)}
                                className="sr-only"
                                aria-label={`Row ${ri + 1}, column ${ci + 1}`}
                              />
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {state.draft.imagePreviewUrl && (
                <div className="flex flex-col gap-2">
                  <p className="text-xs font-medium text-gray-500">Original scan</p>
                  <img
                    src={state.draft.imagePreviewUrl}
                    alt="Document scan preview"
                    className="rounded border border-gray-200 object-contain"
                  />
                </div>
              )}
            </div>

            {uncertainSet.size > 0 && (
              <p className="mt-3 text-xs text-yellow-700">
                <span className="font-semibold">{uncertainSet.size}</span> cell
                {uncertainSet.size !== 1 ? "s" : ""} highlighted in yellow may need review.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
