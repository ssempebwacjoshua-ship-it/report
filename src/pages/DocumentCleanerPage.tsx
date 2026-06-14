import { useRef, useState } from "react";
import { generatePdfHtml, uploadDocument } from "../client/documentCleanerClient";
import type { DocumentUploadResponse, ExtractedDocument } from "../shared/types/documentCleaner";

type State =
  | { phase: "idle" }
  | { phase: "uploading" }
  | { phase: "ready"; draft: DocumentUploadResponse }
  | { phase: "error"; message: string };

export function DocumentCleanerPage() {
  const [state, setState] = useState<State>({ phase: "idle" });
  const [doc, setDoc] = useState<ExtractedDocument | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setState({ phase: "uploading" });
    try {
      const result = await uploadDocument(file);
      setDoc(result.document);
      setState({ phase: "ready", draft: result });
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

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-8">
      <div className="mx-auto max-w-4xl">
        <h1 className="mb-2 text-2xl font-bold text-gray-900">Document Cleaner</h1>
        <p className="mb-6 text-sm text-gray-500">
          Take a photo of a handwritten list or table and get a clean, printable document.
        </p>

        {/* Upload area — always visible before upload */}
        {!ready && (
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
          </div>
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

        {/* Ready state — editable table + preview */}
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
              {/* Editable table */}
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
                              onClick={() => {
                                const input = document.getElementById(`cell-${ri}-${ci}`);
                                input?.focus();
                              }}
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

              {/* Image preview */}
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
