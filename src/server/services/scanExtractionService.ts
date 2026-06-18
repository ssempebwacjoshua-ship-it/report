import fs from "node:fs";
import path from "node:path";
import type { PrismaClient } from "@prisma/client";
import type { GeometryDebugInfo, ScanImportRow, ScanMarksheetContext } from "../../shared/types/imports";
import type { OcrSettings } from "../../shared/types/settings";
import {
  tableToPixel,
  type PixelRect,
} from "./marksheetGeometryService";
import {
  analyzeCropQuality,
  bufferToDataUrl,
  cropCellBlueIsolated,
  cropPreview,
  findInkRowBandCrop,
  preprocessScanImage,
  selectBestCrop,
  stripHorizontalBorders,
} from "./scanPreprocessService";
import {
  computeSplitFullRect,
  computeSplitZoneRects,
  computeWrittenMarkCropRect,
  detectMarksheetTable,
  effectiveRowBand,
  generateSplitZoneCropCandidates,
  generateWrittenCropCandidates,
  type CropCandidate,
  type TableDetectionResult,
} from "./marksheetTableDetection";
import {
  normalizeMark,
  parseSplitZoneTexts,
} from "./markRecognitionService";
import { isProviderUnavailableError } from "./azureOcrService";
import { resolveOcrProviderWithMeta, type OcrCropResult, type OcrProviderResolution } from "./ocrProvider";
import { validateScanRows } from "./scanImportValidator";

type RosterStudent = { admissionNumber: string; studentName: string };

// Exported so unit tests can cover the acceptance logic directly.
export function acceptedExtractedMark(
  writtenMark: string,
  splitMark: string,
  splitConfidence: number,
  writtenConfidence: number,
  minimumConfidence = 0.75,
): { mark: string; reason: string } {
  if (!writtenMark && !splitMark) {
    return { mark: "", reason: "No mark detected by OCR. Needs operator entry." };
  }

  // Full agreement with sufficient confidence on both sides
  if (writtenMark && splitMark && writtenMark === splitMark) {
    if (splitConfidence >= minimumConfidence && writtenConfidence >= minimumConfidence) {
      return { mark: writtenMark, reason: "Written and split marks agree with high confidence." };
    }
    // Agree but one side is low confidence â€” fall through to split-only check
  }

  // Suffix match: split zones captured only trailing digit(s) of the written mark.
  // Occurs when a split zone OCR fails (e.g. PaddleOCR returns a CJK character
  // for a handwritten digit), leaving only the units digit(s) readable.
  // If the split result is a pure-digit suffix of the written mark and written
  // confidence is adequate, the written mark is accepted and the partial zone
  // result is treated as confirmation of its last N digits.
  if (
    writtenMark && splitMark &&
    writtenMark !== splitMark &&
    /^\d+$/.test(writtenMark) &&
    /^\d+$/.test(splitMark) &&
    splitMark.length < writtenMark.length &&
    writtenMark.endsWith(splitMark) &&
    writtenConfidence >= Math.max(0.6, minimumConfidence - 0.15)
  ) {
    return {
      mark: writtenMark,
      reason: `Split zones confirmed last ${splitMark.length} digit(s); written mark ${writtenMark} accepted.`,
    };
  }

  // Genuine disagreement (not a partial-suffix case)
  if (writtenMark && splitMark && writtenMark !== splitMark) {
    return { mark: "", reason: "Written and split OCR disagree. Enter the operator mark." };
  }

  // Split zones valid with high confidence (no written mark or written was low-confidence)
  if (splitMark && splitConfidence >= Math.max(0.85, minimumConfidence)) {
    return { mark: splitMark, reason: "Split mark detected with high confidence; written mark is confirmation only." };
  }

  return { mark: "", reason: "Extraction was not confident enough. Needs operator entry." };
}

/**
 * Returns the appropriate human-readable reason when OCR fails for a crop.
 * Distinguishes a reachable provider that returned no usable text from an
 * unreachable provider, so operators are not misled about service availability.
 */
export function ocrFailureReason(providerName: string, providerReachable: boolean): string {
  if (!providerReachable) {
    return "OCR temporarily unavailable. Contact platform support.";
  }
  return `${providerName === "azure" ? "Azure OCR" : providerName} returned no text from this crop. Enter the mark manually.`;
}

/**
 * Reason shown when crop geometry could not isolate the handwritten mark for any
 * fallback recrop. This is a CROP problem, not an OCR-provider problem â€” the
 * operator should enter the mark manually rather than being told OCR is down.
 */
export function cropFailureReason(): string {
  return "Crop alignment failed. Could not isolate the handwritten mark. Please enter mark manually.";
}

function resultById(results: OcrCropResult[], cropId: string): OcrCropResult {
  return results.find((result) => result.cropId === cropId) ?? { cropId, text: "", confidence: 0 };
}

async function loadRoster(
  prisma: PrismaClient,
  schoolId: string,
  context: ScanMarksheetContext,
): Promise<RosterStudent[]> {
  const enrollments = await prisma.classEnrollment.findMany({
    where: {
      schoolId,
      isActive: true,
      status: "ACTIVE",
      class: { name: { contains: context.className.trim(), mode: "insensitive" } },
      stream: { name: { contains: context.streamName.trim(), mode: "insensitive" } },
    },
    include: { student: true },
    orderBy: { student: { admissionNumber: "asc" } },
  });

  return enrollments.map((enrollment) => ({
    admissionNumber: enrollment.student.admissionNumber,
    studentName: `${enrollment.student.firstName} ${enrollment.student.lastName}`.trim(),
  }));
}

// â”€â”€ Debug crop disk saving â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const DEBUG_DIR = path.join(process.cwd(), "tmp", "ocr-debug", "latest");
let ocrDebugEnabled = process.env.OCR_DEBUG === "1";

function clearDebugDir(): void {
  if (!ocrDebugEnabled) return;
  try {
    fs.rmSync(DEBUG_DIR, { recursive: true, force: true });
    fs.mkdirSync(DEBUG_DIR, { recursive: true });
  } catch { /* Best effort */ }
}

function saveDebugFile(name: string, buffer: Buffer): void {
  if (!ocrDebugEnabled) return;
  try {
    fs.mkdirSync(DEBUG_DIR, { recursive: true });
    fs.writeFileSync(path.join(DEBUG_DIR, name), buffer);
  } catch { /* Best effort */ }
}

function saveAlways(name: string, data: string | Buffer): void {
  try {
    fs.mkdirSync(DEBUG_DIR, { recursive: true });
    fs.writeFileSync(path.join(DEBUG_DIR, name), data);
  } catch { /* Best effort */ }
}

// â”€â”€ Detection overlay â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

async function saveDetectionOverlay(
  colorBuffer: Buffer,
  imgW: number,
  imgH: number,
  detection: TableDetectionResult,
  studentRects: Array<{ admNo: string; writtenRect: PixelRect; splitRect: PixelRect }>,
): Promise<void> {
  const sharp = (await import("sharp")).default;
  const parts: string[] = [];

  // Table outer border (green)
  const tw = detection.tableRight - detection.tableLeft;
  const th = detection.tableBottom - detection.tableTop;
  parts.push(
    `<rect x="${detection.tableLeft}" y="${detection.tableTop}" width="${tw}" height="${th}" ` +
    `fill="none" stroke="#00ff00" stroke-width="3"/>`,
  );

  // Column header bottom (cyan)
  parts.push(
    `<line x1="${detection.tableLeft}" y1="${detection.columnHeaderBottom}" ` +
    `x2="${detection.tableRight}" y2="${detection.columnHeaderBottom}" ` +
    `stroke="#00ffff" stroke-width="2"/>`,
  );

  // Horizontal row lines (cyan, faint)
  for (const y of detection.rowLines) {
    parts.push(
      `<line x1="${detection.tableLeft}" y1="${y}" x2="${detection.tableRight}" y2="${y}" ` +
      `stroke="#00ffff" stroke-width="1" opacity="0.6"/>`,
    );
  }

  // Vertical column lines (orange)
  for (const x of detection.colLines) {
    parts.push(
      `<line x1="${x}" y1="${detection.tableTop}" x2="${x}" y2="${detection.tableBottom}" ` +
      `stroke="#ff8800" stroke-width="1" opacity="0.8"/>`,
    );
  }

  // Written and split column spans (labelled at top of table)
  const wc = detection.writtenMarkCol;
  const sc = detection.splitMarkCol;
  parts.push(
    `<rect x="${wc.x}" y="${detection.tableTop}" width="${wc.w}" height="${th}" ` +
    `fill="rgba(255,255,0,0.08)" stroke="#ffff00" stroke-width="1" stroke-dasharray="4,3"/>`,
  );
  parts.push(
    `<text x="${wc.x + 2}" y="${detection.tableTop + 12}" font-size="9" fill="#cccc00" font-family="monospace">Written</text>`,
  );
  parts.push(
    `<rect x="${sc.x}" y="${detection.tableTop}" width="${sc.w}" height="${th}" ` +
    `fill="rgba(255,0,255,0.08)" stroke="#ff00ff" stroke-width="1" stroke-dasharray="4,3"/>`,
  );
  parts.push(
    `<text x="${sc.x + 2}" y="${detection.tableTop + 12}" font-size="9" fill="#cc00cc" font-family="monospace">Split</text>`,
  );

  // Per-student crop boxes (yellow=written, magenta=split)
  for (const { admNo, writtenRect, splitRect } of studentRects) {
    parts.push(
      `<rect x="${writtenRect.x}" y="${writtenRect.y}" width="${writtenRect.w}" height="${writtenRect.h}" ` +
      `fill="rgba(255,255,0,0.25)" stroke="#ffff00" stroke-width="1"/>`,
    );
    parts.push(
      `<rect x="${splitRect.x}" y="${splitRect.y}" width="${splitRect.w}" height="${splitRect.h}" ` +
      `fill="rgba(255,0,255,0.25)" stroke="#ff00ff" stroke-width="1"/>`,
    );
    const label = admNo.slice(-5);
    parts.push(
      `<text x="${writtenRect.x + 1}" y="${writtenRect.y + writtenRect.h - 1}" ` +
      `font-size="7" fill="#ff4444" font-family="monospace">${label}</text>`,
    );
  }

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${imgW}" height="${imgH}" ` +
    `viewBox="0 0 ${imgW} ${imgH}">${parts.join("")}</svg>`;

  await sharp(colorBuffer)
    .composite([{ input: Buffer.from(svg), blend: "over" }])
    .jpeg({ quality: 85 })
    .toFile(path.join(DEBUG_DIR, "overlay-detected-grid.jpg"));
}

async function saveFinalOcrCropOverlay(
  colorBuffer: Buffer,
  imgW: number,
  imgH: number,
  cropRects: Array<{
    rowNumber: number;
    writtenRect: PixelRect;
    splitZoneRects: PixelRect[];
  }>,
): Promise<void> {
  const sharp = (await import("sharp")).default;
  const parts: string[] = [];

  for (const { rowNumber, writtenRect, splitZoneRects } of cropRects) {
    const rowLabel = String(rowNumber);
    parts.push(
      `<rect x="${writtenRect.x}" y="${writtenRect.y}" width="${writtenRect.w}" height="${writtenRect.h}" ` +
      `fill="rgba(255,220,0,0.16)" stroke="#ffd400" stroke-width="3"/>`,
    );
    parts.push(
      `<text x="${writtenRect.x + 4}" y="${writtenRect.y + 18}" font-size="18" ` +
      `fill="#b88300" font-family="monospace" font-weight="700">W${rowLabel}</text>`,
    );

    splitZoneRects.forEach((rect, zoneIndex) => {
      parts.push(
        `<rect x="${rect.x}" y="${rect.y}" width="${rect.w}" height="${rect.h}" ` +
        `fill="rgba(255,0,180,0.14)" stroke="#ff00b4" stroke-width="3"/>`,
      );
      parts.push(
        `<text x="${rect.x + 4}" y="${rect.y + 18}" font-size="18" ` +
        `fill="#b00078" font-family="monospace" font-weight="700">S${rowLabel}-${zoneIndex + 1}</text>`,
      );
    });
  }

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${imgW}" height="${imgH}" ` +
    `viewBox="0 0 ${imgW} ${imgH}">${parts.join("")}</svg>`;

  fs.mkdirSync(DEBUG_DIR, { recursive: true });
  await sharp(colorBuffer)
    .composite([{ input: Buffer.from(svg), blend: "over" }])
    .jpeg({ quality: 88 })
    .toFile(path.join(DEBUG_DIR, "overlay-final-ocr-crops.jpg"));
}

// â”€â”€ Extraction â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export type ExtractionResult = {
  parseStatus: "PARSED" | "FAILED";
  message: string;
  rows: ScanImportRow[];
  studentCount: number;
  configuredProvider: string;
  activeProvider: string;
  providerReachable: boolean;
  fallbackReason: string;
};

export async function extractMarksFromScan(
  prisma: PrismaClient,
  fileBuffer: Buffer,
  mimeType: string,
  schoolId: string,
  context: ScanMarksheetContext,
  ocrSettings?: OcrSettings,
): Promise<ExtractionResult> {
  ocrDebugEnabled = Boolean(ocrSettings?.debugMode) || process.env.OCR_DEBUG === "1";
  // Resolve OCR provider first so we can report it even if preprocessing fails
  let resolution: OcrProviderResolution;
  try {
    resolution = await resolveOcrProviderWithMeta(ocrSettings);
  } catch {
    resolution = {
      provider: { name: "azure", healthCheck: async () => false, recognizeCrops: async (c) => c.map((x) => ({ cropId: x.cropId, text: "", confidence: 0 })) },
      configuredProvider: "azure",
      activeProvider: "azure",
      providerReachable: false,
      fallbackReason: "",
    };
  }

  const providerSummary = {
    configuredProvider: resolution.configuredProvider,
    activeProvider: resolution.activeProvider,
    providerReachable: resolution.providerReachable,
    fallbackReason: resolution.fallbackReason,
  };

  if (!resolution.providerReachable) {
    return {
      parseStatus: "FAILED",
      message: "OCR temporarily unavailable. Contact platform support.",
      rows: [],
      studentCount: 0,
      ...providerSummary,
    };
  }

  let scan: { buffer: Buffer; colorBuffer: Buffer; width: number; height: number };
  try {
    scan = await preprocessScanImage(fileBuffer, mimeType);
  } catch (err) {
    return {
      parseStatus: "FAILED",
      message: err instanceof Error ? err.message : "Image preprocessing failed.",
      rows: [],
      studentCount: 0,
      ...providerSummary,
    };
  }

  if (scan.width === 0 || scan.height === 0) {
    return {
      parseStatus: "FAILED",
      message: "Scan image has zero dimensions. Upload a valid PNG, JPG, WEBP, or PDF scan.",
      rows: [],
      studentCount: 0,
      ...providerSummary,
    };
  }

  let roster: RosterStudent[] = [];
  try {
    roster = await loadRoster(prisma, schoolId, context);
  } catch (err) {
    return {
      parseStatus: "FAILED",
      message: `Roster lookup failed: ${err instanceof Error ? err.message : String(err)}`,
      rows: [],
      studentCount: 0,
      ...providerSummary,
    };
  }

  if (roster.length === 0) {
    return {
      parseStatus: "FAILED",
      message:
        `No active students found for class "${context.className}" stream "${context.streamName}". ` +
        "Check the class and stream names match the school's enrollment records.",
      rows: [],
      studentCount: 0,
      ...providerSummary,
    };
  }

  clearDebugDir();
  saveDebugFile("original.jpg", scan.buffer);

  // Detect table geometry, passing roster count so fallback creates enough rows.
  const detection = await detectMarksheetTable(scan.buffer, scan.width, scan.height, roster.length);

  // Save geometry metadata (always â€” operators need this for alignment diagnostics)
  saveAlways(
    "geometry.json",
    JSON.stringify(
      {
        method: detection.method,
        geometryConfidence: detection.geometryConfidence,
        colDetectionMethod: detection.colDetectionMethod,
        tableLeft: detection.tableLeft,
        tableRight: detection.tableRight,
        tableTop: detection.tableTop,
        tableBottom: detection.tableBottom,
        columnHeaderBottom: detection.columnHeaderBottom,
        rowLines: detection.rowLines,
        colLines: detection.colLines,
        warnings: detection.warnings,
        detectedDataRowCount: detection.rowLines.length > 1 ? detection.rowLines.length - 2 : 0,
        writtenMarkCol: detection.writtenMarkCol,
        splitMarkCol: detection.splitMarkCol,
        splitZoneDividers: detection.splitZoneDividers,
        imageSize: { width: scan.width, height: scan.height },
        ocrProvider: {
          configured: resolution.configuredProvider,
          active: resolution.activeProvider,
          reachable: resolution.providerReachable,
          fallbackReason: resolution.fallbackReason,
        },
      },
      null,
      2,
    ),
  );

  let tableCropDataUrl = "";
  try {
    const tablePreviewBuf = await cropPreview(scan.buffer, tableToPixel(scan.width, scan.height));
    tableCropDataUrl = bufferToDataUrl(tablePreviewBuf);
    saveDebugFile("table.jpg", tablePreviewBuf);
  } catch {
    tableCropDataUrl = "";
  }

  const rawRows: ScanImportRow[] = [];
  const overlayRects: Array<{ admNo: string; writtenRect: PixelRect; splitRect: PixelRect }> = [];
  const finalCropRects = roster.map((student, index) => {
    const writtenRect = computeWrittenMarkCropRect(detection, index, scan.width, scan.height);
    const splitRect = computeSplitFullRect(detection, index);
    const splitZoneRects = computeSplitZoneRects(detection, index, scan.width, scan.height);
    overlayRects.push({ admNo: student.admissionNumber, writtenRect, splitRect });
    return {
      rowNumber: index + 1,
      admissionNumber: student.admissionNumber,
      writtenRect,
      splitRect,
      splitZoneRects,
    };
  });
  const ocrProvider = resolution.provider;

  try {
    await saveFinalOcrCropOverlay(scan.colorBuffer, scan.width, scan.height, finalCropRects);
  } catch { /* Best effort */ }

  for (let index = 0; index < roster.length; index++) {
    const student = roster[index]!;
    const rowTag = `row-${String(index + 1).padStart(2, "0")}-${student.admissionNumber}`;
    const cropPlan = finalCropRects[index]!;
    const { writtenRect, splitRect, splitZoneRects } = cropPlan;

    let writtenResult = { rawText: "", normalizedMark: "", confidence: 0 };
    let splitResult = {
      rawText: "", normalizedMark: "", confidence: 0,
      zoneRawText: ["", "", ""] as string[],
      zoneConfidences: [0, 0, 0] as number[],
    };
    let writtenCropDataUrl = "";
    let originalWrittenCropDataUrl = "";
    let splitCropDataUrl = "";
    let splitDigitCropDataUrls: string[] = [];
    let extractionNote = "";
    let cropRejectionReason: string | undefined;
    let writtenFinalRect: PixelRect = writtenRect;
    let fallbackCropUsed = false;
    let fallbackStrategy = "original";
    let cropQualityReason: string | undefined;

    try {
      // Original (computed) written crop â€” kept for debug comparison.
      const originalWrittenPreview = await cropPreview(scan.buffer, writtenRect);
      originalWrittenCropDataUrl = bufferToDataUrl(originalWrittenPreview);

      // The computed crop often lands on a row border or blank cell. Generate
      // fallback recrop candidates and pick the best-scoring (border/blank-free)
      // crop BEFORE sending anything to OCR.
      const writtenCandidates = generateWrittenCropCandidates(writtenRect, scan.width, scan.height);

      // Prepend an ink-band candidate: search the full mark cell for handwriting
      // strokes and crop tightly around them (rather than shifting blindly).
      const wc = detection.writtenMarkCol;
      const band = effectiveRowBand(detection, index, scan.height);
      const fullCell = { x: wc.x, y: band.top, w: wc.w, h: Math.max(1, band.height) };
      const inkRect = await findInkRowBandCrop(scan.colorBuffer, fullCell);
      const candidatesWithInk: CropCandidate[] = inkRect
        ? [{ strategy: "ink-band", rect: inkRect }, ...writtenCandidates]
        : writtenCandidates;

      const writtenPick = await selectBestCrop(scan.buffer, candidatesWithInk);
      writtenFinalRect = writtenPick.rect;
      fallbackStrategy = writtenPick.strategy;
      let writtenQuality = writtenPick.quality;
      let writtenPreview = writtenPick.preview;
      let writtenBorderStripped = false;

      // Last resort: ignore printed horizontal border pixels, then re-check.
      if (!writtenQuality.ok && /horizontal/i.test(writtenQuality.reason)) {
        const stripped = await stripHorizontalBorders(writtenPick.preview);
        const restripQuality = await analyzeCropQuality(stripped);
        if (restripQuality.ok) {
          writtenQuality = restripQuality;
          writtenPreview = stripped;
          writtenBorderStripped = true;
        }
      }

      const writtenFallbackUsed = writtenPick.strategy !== "original" || writtenBorderStripped;
      writtenCropDataUrl = bufferToDataUrl(writtenPreview);
      if (!writtenQuality.ok) cropQualityReason = writtenQuality.reason;

      saveDebugFile(`${rowTag}.jpg`, await cropPreview(scan.buffer, {
        x: writtenRect.x,
        y: writtenRect.y,
        w: splitRect.x + splitRect.w - writtenRect.x,
        h: writtenRect.h,
      }));
      saveAlways(`${rowTag}-written-final.jpg`, writtenPreview);

      const splitPreview = await cropPreview(scan.buffer, splitRect);
      splitCropDataUrl = bufferToDataUrl(splitPreview);
      saveDebugFile(`${rowTag}-split-full-final.jpg`, splitPreview);

      const cropIds = {
        written: `${student.admissionNumber}-written`,
        zones: splitZoneRects.map((_, z) => `${student.admissionNumber}-split-${z + 1}`),
      };

      const qualityFailures: Array<{ label: string; reason: string; blocking: boolean }> = [];
      const ocrInputs: Array<{ cropId: string; buffer: Buffer; mimeType: "image/jpeg" }> = [];

      if (writtenQuality.ok) {
        // Blue-ink isolation re-crops from colour and drops black border pixels,
        // so the selected fallback rect is safe to send to OCR.
        const writtenCell = await cropCellBlueIsolated(scan.colorBuffer, writtenFinalRect);
        saveDebugFile(`${rowTag}-written-processed.jpg`, writtenCell);
        ocrInputs.push({ cropId: cropIds.written, buffer: writtenCell, mimeType: "image/jpeg" });
      } else {
        qualityFailures.push({ label: "written", reason: writtenQuality.reason, blocking: true });
      }

      let anyZoneFallback = false;
      const splitZonePreviews: Buffer[] = [];
      for (let zoneIndex = 0; zoneIndex < splitZoneRects.length; zoneIndex++) {
        const baseZoneRect = splitZoneRects[zoneIndex]!;
        const zoneCandidates = generateSplitZoneCropCandidates(baseZoneRect, scan.width, scan.height);
        const zonePick = await selectBestCrop(scan.buffer, zoneCandidates);
        let zoneQuality = zonePick.quality;
        let zonePreview = zonePick.preview;

        if (!zoneQuality.ok && /horizontal/i.test(zoneQuality.reason)) {
          const stripped = await stripHorizontalBorders(zonePick.preview);
          const restripQuality = await analyzeCropQuality(stripped);
          if (restripQuality.ok) {
            zoneQuality = restripQuality;
            zonePreview = stripped;
          }
        }

        if (zonePick.strategy !== "original") anyZoneFallback = true;
        splitZonePreviews.push(zonePreview);
        saveAlways(`${rowTag}-split-${zoneIndex + 1}-final.jpg`, zonePreview);

        if (zoneQuality.ok) {
          const processed = await cropCellBlueIsolated(scan.colorBuffer, zonePick.rect);
          saveDebugFile(`${rowTag}-split-${zoneIndex + 1}-processed.jpg`, processed);
          ocrInputs.push({
            cropId: cropIds.zones[zoneIndex]!,
            buffer: processed,
            mimeType: "image/jpeg",
          });
        } else {
          qualityFailures.push({
            label: `split-${zoneIndex + 1}`,
            reason: zoneQuality.reason,
            blocking: !/blank crop/i.test(zoneQuality.reason),
          });
        }
      }
      splitDigitCropDataUrls = splitZonePreviews.map((preview) => bufferToDataUrl(preview));
      fallbackCropUsed = writtenFallbackUsed || anyZoneFallback;

      const blockingQualityFailures = qualityFailures.filter((failure) => failure.blocking);
      if (ocrInputs.length === 0) {
        const failure = qualityFailures[0];
        cropRejectionReason = failure ? `${failure.label}: ${failure.reason}` : "no usable OCR crops";
        // Bad crop geometry â€” ask for manual entry, NOT "OCR unavailable".
        extractionNote = cropFailureReason();
      }

      if (ocrInputs.length > 0) {
        console.log(
          `[ocr.azure.marks] request started row=${index + 1} adm=${student.admissionNumber}` +
          ` cropKind=marksGrid crops=${ocrInputs.length}` +
          ` mimeType=${ocrInputs[0]?.mimeType ?? "image/jpeg"}`,
        );
      }
      const ocrResults = ocrInputs.length > 0
        ? await ocrProvider.recognizeCrops(ocrInputs)
        : [];
      if (ocrResults.length > 0) {
        const linesWithText = ocrResults.filter((r) => r.text.trim()).length;
        console.log(
          `[ocr.azure.marks] success row=${index + 1} adm=${student.admissionNumber}` +
          ` lines=${linesWithText}/${ocrResults.length}`,
        );
      }

      const writtenOcr = resultById(ocrResults, cropIds.written);
      const zoneResults = cropIds.zones.map((cropId) => resultById(ocrResults, cropId));
      const zoneRawText = zoneResults.map((r) => r.text);
      const splitConfidenceValues = zoneResults
        .filter((r) => r.text.trim())
        .map((r) => r.confidence);

      writtenResult = {
        rawText: writtenOcr.text,
        normalizedMark: normalizeMark(writtenOcr.text),
        confidence: writtenOcr.confidence,
      };
      splitResult = {
        rawText: zoneRawText.join(" | "),
        normalizedMark: parseSplitZoneTexts(zoneRawText),
        confidence: splitConfidenceValues.length > 0 ? Math.min(...splitConfidenceValues) : 0,
        zoneRawText,
        zoneConfidences: zoneResults.map((r) => r.confidence),
      };
      if (!writtenResult.normalizedMark && !splitResult.normalizedMark && blockingQualityFailures.length > 0) {
        const failure = blockingQualityFailures[0]!;
        cropRejectionReason = cropRejectionReason ?? `${failure.label}: ${failure.reason}`;
        cropQualityReason = cropQualityReason ?? failure.reason;
        extractionNote = cropFailureReason();
      }
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      console.error(
        `[ocr.azure.marks] failed row=${index + 1} adm=${student.admissionNumber}` +
        ` cropKind=marksGrid reason=${reason}`,
      );
      if (isProviderUnavailableError(error) && /too large/i.test(reason)) {
        extractionNote = "Scan image is too large. Please use a smaller/clearer crop.";
      } else {
        extractionNote = isProviderUnavailableError(error)
          ? "OCR temporarily unavailable. Contact platform support."
          : ocrFailureReason(resolution.activeProvider, resolution.providerReachable);
      cropRejectionReason = reason;
      }
    }

    const extracted = acceptedExtractedMark(
      writtenResult.normalizedMark,
      splitResult.normalizedMark,
      splitResult.confidence,
      writtenResult.confidence,
      ocrSettings?.minimumConfidenceForSuggestion,
    );
    const confidence = splitResult.normalizedMark
      ? splitResult.confidence
      : writtenResult.confidence;

    const geomDebug: GeometryDebugInfo = {
      imageWidth: scan.width,
      imageHeight: scan.height,
      detectionMethod: detection.method,
      geometryConfidence: detection.geometryConfidence,
      tableRect: {
        left: detection.tableLeft,
        right: detection.tableRight,
        top: detection.tableTop,
        bottom: detection.tableBottom,
      },
      writtenMarkCol: detection.writtenMarkCol,
      splitMarkCol: detection.splitMarkCol,
      dataRowCount: detection.dataRows.length,
      writtenCropRect: { x: writtenFinalRect.x, y: writtenFinalRect.y, w: writtenFinalRect.w, h: writtenFinalRect.h },
      originalWrittenCropRect: { x: writtenRect.x, y: writtenRect.y, w: writtenRect.w, h: writtenRect.h },
      fallbackCropUsed,
      fallbackStrategy,
      cropQualityReason,
      cropRejectionReason,
      warnings: detection.warnings,
    };

    rawRows.push({
      rowNumber: index + 1,
      admissionNumber: student.admissionNumber,
      studentName: student.studentName,
      writtenMark: writtenResult.normalizedMark,
      splitMark: splitResult.normalizedMark,
      extractedMark: extracted.mark,
      suggestedMark: extracted.mark,
      confidence,
      remarks: "",
      writtenMarkRaw: writtenResult.rawText,
      splitMarkRaw: splitResult.rawText,
      splitDigitRaw: splitResult.zoneRawText,
      writtenCropDataUrl,
      originalWrittenCropDataUrl,
      splitCropDataUrl,
      splitDigitCropDataUrls,
      tableCropDataUrl: index === 0 ? tableCropDataUrl : undefined,
      ocrProvider: "Azure OCR",
      debugRawOcr: {
        written: writtenResult.rawText,
        split: splitResult.rawText,
        splitZones: splitResult.zoneRawText,
      },
      debugCropImages: {
        written: writtenCropDataUrl,
        split: splitCropDataUrl,
        splitZones: splitDigitCropDataUrls,
      },
      geometryDebug: geomDebug,
      statusReason: extractionNote || extracted.reason,
      status: "PARSED",
      validationErrors: [],
      operatorCorrection: "",
    });
  }

  // Save overlay (always)
  try {
    await saveDetectionOverlay(scan.colorBuffer, scan.width, scan.height, detection, overlayRects);
  } catch { /* Best effort */ }

  const validatedRows = validateScanRows(rawRows, context, roster, {
    minimumConfidenceForSuggestion: ocrSettings?.minimumConfidenceForSuggestion,
  });
  const countByStatus = validatedRows.reduce<Record<string, number>>((acc, row) => {
    acc[row.status] = (acc[row.status] ?? 0) + 1;
    return acc;
  }, {});

  const statusParts: string[] = [];
  if (countByStatus["VALID"]) statusParts.push(`${countByStatus["VALID"]} valid`);
  if (countByStatus["NEEDS_REVIEW"]) statusParts.push(`${countByStatus["NEEDS_REVIEW"]} need review`);
  if (countByStatus["MISSING"]) statusParts.push(`${countByStatus["MISSING"]} missing`);
  if (countByStatus["INVALID"]) statusParts.push(`${countByStatus["INVALID"]} invalid`);

  const azureStatus = "Azure OCR succeeded.";
  const detectionNote = detection.method === "detected"
    ? `Table geometry detected (confidence ${Math.round(detection.geometryConfidence * 100)}%, col: ${detection.colDetectionMethod}).`
    : "Table geometry not detected â€” using estimated geometry. Crop quality may be reduced.";

  const allMissing = countByStatus["MISSING"] === roster.length && roster.length > 0;
  const geometryNote = allMissing && detection.method === "fallback"
    ? " Geometry is estimated â€” verify crop alignment in debug view."
    : "";

  return {
    parseStatus: "PARSED",
    message:
      `Scan processed. ${azureStatus} ${detectionNote}${geometryNote} ` +
      `${roster.length} roster rows: ${statusParts.join(", ") || "all blank (no marks visible)"}.`,
    rows: validatedRows,
    studentCount: roster.length,
    ...providerSummary,
  };
}

