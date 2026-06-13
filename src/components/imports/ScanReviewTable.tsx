import type { KeyboardEvent } from "react";
import type { GeometryDebugInfo, ScanImportRow, ScanRowStatus, ScanUploadResponse } from "../../shared/types/imports";

const STATUS_STYLES: Record<ScanRowStatus, string> = {
  PARSED: "bg-slate-100 text-slate-700",
  NEEDS_REVIEW: "bg-amber-100 text-amber-800",
  MISSING: "bg-yellow-100 text-yellow-800",
  VALID: "bg-emerald-100 text-emerald-700",
  INVALID: "bg-red-100 text-red-700",
  COMMITTED: "bg-blue-100 text-blue-700",
  RETURNED: "bg-orange-100 text-orange-700",
  FINALIZED: "bg-green-100 text-green-800",
};

type Props = {
  rows: ScanImportRow[];
  providerInfo?: Pick<ScanUploadResponse, "providerReachable">;
  onCorrectionChange?: (rowNumber: number, value: string) => void;
  onRemarksChange?: (rowNumber: number, value: string) => void;
  readOnly?: boolean;
};

function displayStatus(row: ScanImportRow): string {
  if (row.status === "MISSING") return "Needs entry";
  if (row.status === "NEEDS_REVIEW") return "Needs review";
  if (row.status === "VALID") return "Valid";
  if (row.status === "INVALID") return "Invalid";
  return row.status.replace(/_/g, " ");
}

function extractedMark(row: ScanImportRow): string {
  return row.extractedMark || row.suggestedMark || "";
}

function handleMarkKeyDown(event: KeyboardEvent<HTMLInputElement>) {
  if (event.key !== "Enter") return;
  event.preventDefault();
  const inputs = Array.from(document.querySelectorAll<HTMLInputElement>("[data-scan-mark-input='true']"));
  const index = inputs.indexOf(event.currentTarget);
  inputs[index + 1]?.focus();
}

/** Confidence label used only in the debug panel. */
function confidenceLabel(confidence: number, rawText: string): { label: string; tone: string } {
  if (!rawText) return { label: "0% — no text", tone: "text-slate-400" };
  const pct = Math.round(confidence * 100);
  if (confidence >= 0.85) return { label: `${pct}% — high`, tone: "text-emerald-600 font-semibold" };
  if (confidence >= 0.60) return { label: `${pct}% — medium`, tone: "text-amber-600" };
  return { label: `${pct}% — low`, tone: "text-red-500" };
}

/** Decision label shown next to the parsed mark in debug. */
function parsedDecision(row: ScanImportRow): { text: string; tone: string } {
  const accepted = row.extractedMark || row.suggestedMark;
  if (accepted) return { text: `Accepted: ${accepted}`, tone: "text-emerald-700 font-semibold" };

  // Has a parsed mark but it wasn't accepted
  const parsed = row.writtenMark || row.splitMark;
  if (parsed) return { text: `Parsed: ${parsed} — not accepted`, tone: "text-amber-700" };

  // Raw text present but couldn't parse a valid mark
  const rawText = row.debugRawOcr?.written || row.writtenMarkRaw;
  if (rawText) return { text: `Raw: "${rawText}" — not parseable`, tone: "text-red-500" };

  return { text: "No text detected", tone: "text-slate-400" };
}

// ── Geometry Debug Panel ──────────────────────────────────────────────────────

function GeometryDebugSummary({ info }: { info: GeometryDebugInfo }) {
  return (
    <div className="grid gap-1 rounded-xl border border-slate-100 bg-white px-3 py-2 text-xs text-slate-600">
      <div className="flex flex-wrap gap-x-4 gap-y-0.5">
        <span><span className="font-semibold">Image:</span> {info.imageWidth}×{info.imageHeight}px</span>
        <span>
          <span className="font-semibold">Geometry:</span>{" "}
          <span className={info.detectionMethod === "detected" ? "text-emerald-700 font-semibold" : "text-amber-700 font-semibold"}>
            {info.detectionMethod === "detected" ? `Detected (${Math.round(info.geometryConfidence * 100)}%)` : "Fallback (estimated)"}
          </span>
        </span>
        <span><span className="font-semibold">Data rows:</span> {info.dataRowCount}</span>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-0.5">
        <span>
          <span className="font-semibold">Table:</span>{" "}
          L{info.tableRect.left} R{info.tableRect.right} T{info.tableRect.top} B{info.tableRect.bottom}
        </span>
        <span>
          <span className="font-semibold">Written col:</span> x={info.writtenMarkCol.x} w={info.writtenMarkCol.w}
        </span>
        <span>
          <span className="font-semibold">Split col:</span> x={info.splitMarkCol.x} w={info.splitMarkCol.w}
        </span>
      </div>
      {info.warnings.length > 0 && (
        <div className="mt-1 rounded bg-amber-50 px-2 py-1 text-amber-700">
          {info.warnings.map((w, i) => <div key={i}>{w}</div>)}
        </div>
      )}
    </div>
  );
}

function GeometryDebugPanel({ rows }: { rows: ScanImportRow[] }) {
  const rowsWithDebug = rows.filter((r) => r.geometryDebug).slice(0, 10);
  const firstInfo = rowsWithDebug[0]?.geometryDebug;
  if (!firstInfo) return null;

  return (
    <details className="rounded-2xl border border-violet-200 bg-violet-50/40 p-4">
      <summary className="cursor-pointer text-sm font-bold text-slate-800">
        Geometry debug — crop alignment
      </summary>
      <div className="mt-4 grid gap-3">
        <p className="text-xs text-slate-500">
          Shows detected/estimated geometry and first 10 mark-cell crop thumbnails. Use this to diagnose crop alignment issues.
          Geometry is in original image pixels.
        </p>

        <GeometryDebugSummary info={firstInfo} />

        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full min-w-[700px] text-xs">
            <thead>
              <tr className="bg-slate-100 text-left font-bold uppercase tracking-wide text-slate-500">
                <th className="px-3 py-2">Row</th>
                <th className="px-3 py-2">Adm. No.</th>
                <th className="px-3 py-2">Crop rect (px)</th>
                <th className="px-3 py-2">Written crop</th>
                <th className="px-3 py-2">Status / rejection</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rowsWithDebug.map((row) => {
                const g = row.geometryDebug!;
                const rect = g.writtenCropRect;
                const tooSmall = rect.w < 40 || rect.h < 18;
                return (
                  <tr key={`geom-${row.rowNumber}`}>
                    <td className="px-3 py-2 font-semibold">{row.rowNumber}</td>
                    <td className="px-3 py-2 font-mono text-slate-500">{row.admissionNumber}</td>
                    <td className="px-3 py-2">
                      <span className={`font-mono ${tooSmall ? "text-red-600 font-semibold" : "text-slate-600"}`}>
                        x={rect.x} y={rect.y} {rect.w}×{rect.h}px
                      </span>
                      {tooSmall && (
                        <span className="ml-1 rounded bg-red-100 px-1 text-red-700">too small</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {row.writtenCropDataUrl ? (
                        <img
                          src={row.writtenCropDataUrl}
                          alt={`Written crop row ${row.rowNumber}`}
                          className="h-8 w-20 rounded border object-contain"
                        />
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {g.cropRejectionReason ? (
                        <span className="text-red-600">{g.cropRejectionReason}</span>
                      ) : (
                        <span className="text-emerald-600">{row.statusReason || "ok"}</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </details>
  );
}

export function ScanReviewTable({
  rows,
  providerInfo,
  onCorrectionChange,
  onRemarksChange,
  readOnly = false,
}: Props) {
  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-6 py-10 text-center">
        <p className="text-sm font-semibold text-slate-500">No rows loaded yet.</p>
        <p className="mt-1 text-xs text-slate-400">
          Upload a scan and confirm the marksheet context to load the roster.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="w-full min-w-[860px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-black uppercase tracking-wide text-slate-500">
              <th className="px-3 py-3">No.</th>
              <th className="px-3 py-3">Adm. No.</th>
              <th className="px-3 py-3">Student Name</th>
              <th className="px-3 py-3 text-center">Extracted Mark</th>
              <th className="px-3 py-3">Operator Mark</th>
              <th className="px-3 py-3">Remarks</th>
              <th className="px-3 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row, index) => {
              const statusTone = row.status === "INVALID" || row.status === "NEEDS_REVIEW"
                ? "bg-amber-50"
                : row.status === "MISSING"
                  ? "bg-yellow-50/60"
                  : "";

              return (
                <tr key={row.rowNumber} className={statusTone}>
                  <td className="px-3 py-3 text-slate-500">{row.rowNumber}</td>
                  <td className="px-3 py-3 font-semibold text-slate-950">{row.admissionNumber}</td>
                  <td className="px-3 py-3 text-slate-700">{row.studentName}</td>
                  <td className="px-3 py-3 text-center font-mono font-semibold text-slate-900">
                    {extractedMark(row) || <span className="text-slate-300">-</span>}
                  </td>
                  <td className="px-3 py-3">
                    {readOnly ? (
                      <span className="font-mono text-sm">{row.operatorCorrection || "-"}</span>
                    ) : (
                      <input
                        data-scan-mark-input="true"
                        aria-label={`Operator mark for ${row.studentName}`}
                        type="text"
                        value={row.operatorCorrection}
                        onChange={(event) => onCorrectionChange?.(row.rowNumber, event.target.value.toUpperCase())}
                        onKeyDown={handleMarkKeyDown}
                        placeholder={extractedMark(row) || "Enter mark"}
                        className="w-32 rounded-xl border border-slate-200 bg-white px-3 py-2 font-mono text-base font-semibold text-slate-950 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                        maxLength={5}
                      />
                    )}
                    <p className="mt-1 text-[11px] text-slate-400">Tab/Enter for next row</p>
                  </td>
                  <td className="px-3 py-3">
                    <input
                      type="text"
                      value={row.remarks}
                      onChange={(event) => onRemarksChange?.(row.rowNumber, event.target.value)}
                      placeholder="Optional"
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                    />
                  </td>
                  <td className="px-3 py-3">
                    <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-bold ${STATUS_STYLES[row.status]}`}>
                      {displayStatus(row)}
                    </span>
                    {row.statusReason && (
                      <p className="mt-1 max-w-52 text-xs text-slate-500">{row.statusReason}</p>
                    )}
                    {row.validationErrors.length > 0 && (
                      <p className="mt-1 max-w-52 text-xs text-red-600">{row.validationErrors.join("; ")}</p>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <GeometryDebugPanel rows={rows} />

      <details className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <summary className="cursor-pointer text-sm font-bold text-slate-800">
          Show extraction debug
        </summary>
        <div className="mt-4 grid gap-3">
          <p className="text-sm text-slate-500">
            Debug is for troubleshooting crop alignment and OCR only. Operator marks remain the source used for validation.
          </p>
          {providerInfo && (
            <div className="flex flex-wrap gap-x-4 gap-y-1 rounded-xl border border-slate-100 bg-white px-3 py-2 text-xs text-slate-600">
              <span><span className="font-semibold">Provider:</span> Azure OCR</span>
              {providerInfo.providerReachable === false && (
                <span className="text-red-700">OCR temporarily unavailable. Contact platform support.</span>
              )}
            </div>
          )}
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full min-w-[1100px] text-xs">
              <thead>
                <tr className="bg-slate-100 text-left font-bold uppercase tracking-wide text-slate-500">
                  <th className="px-3 py-2">Row</th>
                  <th className="px-3 py-2">Provider</th>
                  <th className="px-3 py-2">Written Crop</th>
                  <th className="px-3 py-2">Split Crop</th>
                  <th className="px-3 py-2">Zones</th>
                  <th className="px-3 py-2">Raw OCR</th>
                  <th className="px-3 py-2">Confidence</th>
                  <th className="px-3 py-2">Parsed / Decision</th>
                  <th className="px-3 py-2">Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((row) => {
                  const writtenRaw = row.debugRawOcr?.written ?? row.writtenMarkRaw ?? "";
                  const splitRaw = row.debugRawOcr?.split ?? row.splitMarkRaw ?? "";
                  const zoneTexts = row.debugRawOcr?.splitZones ?? row.splitDigitRaw ?? [];
                  const conf = confidenceLabel(row.confidence, writtenRaw || splitRaw);
                  const decision = parsedDecision(row);

                  return (
                    <tr key={`debug-${row.rowNumber}`}>
                      <td className="px-3 py-2 align-top">
                        <div className="font-semibold">{row.rowNumber}</div>
                        <div className="mt-0.5 font-mono text-[10px] text-slate-400">{row.admissionNumber}</div>
                      </td>
                      <td className="px-3 py-2 align-top font-semibold">{row.ocrProvider ?? "manual"}</td>
                      <td className="px-3 py-2 align-top">
                        {row.debugCropImages?.written || row.writtenCropDataUrl ? (
                          <img
                            src={row.debugCropImages?.written ?? row.writtenCropDataUrl}
                            alt={`Written crop for row ${row.rowNumber}`}
                            className="h-10 w-24 rounded border object-contain"
                          />
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </td>
                      <td className="px-3 py-2 align-top">
                        {row.debugCropImages?.split || row.splitCropDataUrl ? (
                          <img
                            src={row.debugCropImages?.split ?? row.splitCropDataUrl}
                            alt={`Split crop for row ${row.rowNumber}`}
                            className="h-10 w-28 rounded border object-contain"
                          />
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </td>
                      <td className="px-3 py-2 align-top">
                        <div className="flex gap-1">
                          {(row.debugCropImages?.splitZones ?? row.splitDigitCropDataUrls ?? []).map((src, zoneIndex) => (
                            <img
                              key={zoneIndex}
                              src={src}
                              alt={`Zone ${zoneIndex + 1}`}
                              className="h-8 w-10 rounded border object-contain"
                            />
                          ))}
                        </div>
                      </td>
                      <td className="px-3 py-2 align-top font-mono text-slate-600">
                        <div>W: {writtenRaw || <span className="text-slate-300">-</span>}</div>
                        <div>S: {splitRaw || <span className="text-slate-300">-</span>}</div>
                        <div>
                          Zones:{" "}
                          {zoneTexts.length > 0
                            ? zoneTexts.map((value) => value || "-").join(" | ")
                            : <span className="text-slate-300">-</span>}
                        </div>
                      </td>
                      <td className="px-3 py-2 align-top">
                        <span className={conf.tone}>{conf.label}</span>
                      </td>
                      <td className="px-3 py-2 align-top">
                        <div className={decision.tone}>{decision.text}</div>
                        {(row.writtenMark || row.splitMark) && (
                          <div className="mt-1 text-slate-400">
                            W norm: {row.writtenMark || "—"} / S norm: {row.splitMark || "—"}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2 align-top text-slate-600">{row.statusReason || "-"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </details>
    </div>
  );
}
