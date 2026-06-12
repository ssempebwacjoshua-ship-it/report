import fs from "node:fs";
import path from "node:path";
import type { PrismaClient } from "@prisma/client";
import type { ScanImportRow, ScanMarksheetContext } from "../../shared/types/imports";
import {
  splitRectIntoVerticalZones,
  tableToPixel,
  type PixelRect,
} from "./marksheetGeometryService";
import {
  bufferToDataUrl,
  cropCell,
  cropCellBlueIsolated,
  cropPreview,
  preprocessScanImage,
} from "./scanPreprocessService";
import {
  detectMarksheetTable,
  detectedCellRect,
  type TableDetectionResult,
} from "./marksheetTableDetection";
import {
  normalizeMark,
  parseSplitZoneTexts,
} from "./markRecognitionService";
import { resolveOcrProvider, type OcrCropResult } from "./ocrProvider";
import { validateScanRows } from "./scanImportValidator";

type RosterStudent = { admissionNumber: string; studentName: string };

// Exported so unit tests can cover the acceptance logic directly.
export function acceptedExtractedMark(
  writtenMark: string,
  splitMark: string,
  splitConfidence: number,
  writtenConfidence: number,
): { mark: string; reason: string } {
  if (!writtenMark && !splitMark) {
    return { mark: "", reason: "No confident mark detected. Needs operator entry." };
  }

  if (writtenMark && splitMark && writtenMark !== splitMark) {
    return { mark: "", reason: "Written and split OCR disagree. Needs operator review." };
  }

  if (writtenMark && splitMark && writtenMark === splitMark && splitConfidence >= 0.75 && writtenConfidence >= 0.75) {
    return { mark: writtenMark, reason: "Written and split marks agree with high confidence." };
  }

  if (splitMark && splitConfidence >= 0.85) {
    return { mark: splitMark, reason: "Split mark detected with high confidence; written mark is confirmation only." };
  }

  return { mark: "", reason: "Extraction was not confident enough. Needs operator entry." };
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
      isActive: true,
      status: "ACTIVE",
      student: { schoolId },
      class: {
        schoolId,
        name: { contains: context.className.trim(), mode: "insensitive" },
      },
      stream: {
        name: { contains: context.streamName.trim(), mode: "insensitive" },
      },
    },
    include: { student: true },
    orderBy: { student: { admissionNumber: "asc" } },
  });

  return enrollments.map((enrollment) => ({
    admissionNumber: enrollment.student.admissionNumber,
    studentName: `${enrollment.student.firstName} ${enrollment.student.lastName}`.trim(),
  }));
}

// ── Debug crop disk saving ─────────────────────────────────────────────────────

const DEBUG_DIR = path.join(process.cwd(), "tmp", "ocr-debug", "latest");
const OCR_DEBUG_ENABLED = process.env.OCR_DEBUG === "1";

function clearDebugDir(): void {
  if (!OCR_DEBUG_ENABLED) return;
  try {
    fs.rmSync(DEBUG_DIR, { recursive: true, force: true });
    fs.mkdirSync(DEBUG_DIR, { recursive: true });
  } catch {
    // Best effort
  }
}

function saveDebugFile(name: string, buffer: Buffer): void {
  if (!OCR_DEBUG_ENABLED) return;
  try {
    fs.mkdirSync(DEBUG_DIR, { recursive: true });
    fs.writeFileSync(path.join(DEBUG_DIR, name), buffer);
  } catch {
    // Best effort — debug saving never blocks import
  }
}

function saveAlways(name: string, data: string | Buffer): void {
  try {
    fs.mkdirSync(DEBUG_DIR, { recursive: true });
    fs.writeFileSync(path.join(DEBUG_DIR, name), data);
  } catch {
    // Best effort
  }
}

// ── Detection overlay ──────────────────────────────────────────────────────────

async function saveDetectionOverlay(
  colorBuffer: Buffer,
  imgW: number,
  imgH: number,
  detection: TableDetectionResult,
  studentRects: Array<{ admNo: string; writtenRect: PixelRect; splitRect: PixelRect }>,
): Promise<void> {
  // Import sharp lazily so test environments that don't use overlay don't need it.
  const sharp = (await import("sharp")).default;

  const parts: string[] = [];

  // Table outer border
  const tw = detection.tableRight - detection.tableLeft;
  const th = detection.tableBottom - detection.tableTop;
  parts.push(
    `<rect x="${detection.tableLeft}" y="${detection.tableTop}" width="${tw}" height="${th}" ` +
    `fill="none" stroke="#00ff00" stroke-width="3"/>`,
  );

  // Column header bottom
  parts.push(
    `<line x1="${detection.tableLeft}" y1="${detection.columnHeaderBottom}" ` +
    `x2="${detection.tableRight}" y2="${detection.columnHeaderBottom}" ` +
    `stroke="#00ffff" stroke-width="2"/>`,
  );

  // Horizontal line events
  for (const y of detection.rowLines) {
    parts.push(
      `<line x1="${detection.tableLeft}" y1="${y}" x2="${detection.tableRight}" y2="${y}" ` +
      `stroke="#00ffff" stroke-width="1" opacity="0.7"/>`,
    );
  }

  // Per-student written (yellow) and split (magenta) crop boxes
  for (const { admNo, writtenRect, splitRect } of studentRects) {
    parts.push(
      `<rect x="${writtenRect.x}" y="${writtenRect.y}" width="${writtenRect.w}" height="${writtenRect.h}" ` +
      `fill="rgba(255,255,0,0.2)" stroke="#ffff00" stroke-width="1"/>`,
    );
    parts.push(
      `<rect x="${splitRect.x}" y="${splitRect.y}" width="${splitRect.w}" height="${splitRect.h}" ` +
      `fill="rgba(255,0,255,0.2)" stroke="#ff00ff" stroke-width="1"/>`,
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

// ── Extraction ─────────────────────────────────────────────────────────────────

export type ExtractionResult = {
  parseStatus: "PARSED" | "FAILED";
  message: string;
  rows: ScanImportRow[];
  studentCount: number;
};

export async function extractMarksFromScan(
  prisma: PrismaClient,
  fileBuffer: Buffer,
  mimeType: string,
  schoolId: string,
  context: ScanMarksheetContext,
): Promise<ExtractionResult> {
  let scan: { buffer: Buffer; colorBuffer: Buffer; width: number; height: number };
  try {
    scan = await preprocessScanImage(fileBuffer, mimeType);
  } catch (err) {
    return {
      parseStatus: "FAILED",
      message: err instanceof Error ? err.message : "Image preprocessing failed.",
      rows: [],
      studentCount: 0,
    };
  }

  if (scan.width === 0 || scan.height === 0) {
    return {
      parseStatus: "FAILED",
      message: "Scan image has zero dimensions. Upload a valid PNG, JPG, WEBP, or PDF scan.",
      rows: [],
      studentCount: 0,
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
    };
  }

  // Clear previous debug run; save original scan.
  clearDebugDir();
  saveDebugFile("original.jpg", scan.buffer);

  // Detect table geometry from the actual scan.
  const detection = await detectMarksheetTable(scan.buffer, scan.width, scan.height);

  // Save geometry metadata always (operators need this for alignment diagnostics).
  saveAlways(
    "geometry.json",
    JSON.stringify(
      {
        method: detection.method,
        confidence: detection.confidence,
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
        imageSize: { width: scan.width, height: scan.height },
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
  const ocrProvider = await resolveOcrProvider();

  for (let index = 0; index < roster.length; index++) {
    const student = roster[index]!;
    const rowTag = `row-${String(index + 1).padStart(2, "0")}-${student.admissionNumber}`;

    const writtenRect = detectedCellRect(detection, "writtenMark", index, scan.width, scan.height);
    const splitRect = detectedCellRect(detection, "splitMark", index, scan.width, scan.height);
    const splitZoneRects = splitRectIntoVerticalZones(splitRect, 3);
    overlayRects.push({ admNo: student.admissionNumber, writtenRect, splitRect });

    let writtenResult = { rawText: "", normalizedMark: "", confidence: 0 };
    let splitResult = { rawText: "", normalizedMark: "", confidence: 0, zoneRawText: ["", "", ""], zoneConfidences: [0, 0, 0] };
    let writtenCropDataUrl = "";
    let splitCropDataUrl = "";
    let splitDigitCropDataUrls: string[] = [];
    let extractionNote = "";

    try {
      // Use blue-isolated crop for OCR; raw greyscale crop for preview/debug display.
      const writtenCell = await cropCellBlueIsolated(scan.colorBuffer, writtenRect);
      const writtenPreview = await cropPreview(scan.buffer, writtenRect);
      writtenCropDataUrl = bufferToDataUrl(writtenPreview);

      saveDebugFile(`${rowTag}.jpg`, await cropPreview(scan.buffer, {
        x: writtenRect.x,
        y: writtenRect.y,
        w: splitRect.x + splitRect.w - writtenRect.x,
        h: writtenRect.h,
      }));
      saveDebugFile(`${rowTag}-written-raw.jpg`, writtenPreview);
      saveDebugFile(`${rowTag}-written-processed.jpg`, writtenCell);

      const splitZoneCells = await Promise.all(
        splitZoneRects.map((rect) => cropCellBlueIsolated(scan.colorBuffer, rect)),
      );
      const splitPreview = await cropPreview(scan.buffer, splitRect);
      splitCropDataUrl = bufferToDataUrl(splitPreview);

      saveDebugFile(`${rowTag}-split-full-raw.jpg`, splitPreview);

      splitDigitCropDataUrls = await Promise.all(
        splitZoneRects.map(async (rect, zoneIndex) => {
          const preview = await cropPreview(scan.buffer, rect);
          const processed = splitZoneCells[zoneIndex]!;
          saveDebugFile(`${rowTag}-split-${zoneIndex + 1}-raw.jpg`, preview);
          saveDebugFile(`${rowTag}-split-${zoneIndex + 1}-processed.jpg`, processed);
          return bufferToDataUrl(preview);
        }),
      );

      const cropIds = {
        written: `${student.admissionNumber}-written`,
        zones: splitZoneRects.map((_, zoneIndex) => `${student.admissionNumber}-split-${zoneIndex + 1}`),
      };
      const ocrResults = await ocrProvider.recognizeCrops([
        { cropId: cropIds.written, buffer: writtenCell, mimeType: "image/jpeg" },
        ...splitZoneCells.map((buffer, zoneIndex) => ({
          cropId: cropIds.zones[zoneIndex]!,
          buffer,
          mimeType: "image/jpeg",
        })),
      ]);

      const writtenOcr = resultById(ocrResults, cropIds.written);
      const zoneResults = cropIds.zones.map((cropId) => resultById(ocrResults, cropId));
      const zoneRawText = zoneResults.map((result) => result.text);
      const splitConfidenceValues = zoneResults
        .filter((result) => result.text.trim())
        .map((result) => result.confidence);

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
        zoneConfidences: zoneResults.map((result) => result.confidence),
      };
    } catch {
      extractionNote = "OCR provider unavailable. Enter marks manually from the scan.";
      writtenResult = { rawText: "", normalizedMark: "", confidence: 0 };
      splitResult = { rawText: "", normalizedMark: "", confidence: 0, zoneRawText: ["", "", ""], zoneConfidences: [0, 0, 0] };
    }

    const extracted = acceptedExtractedMark(
      writtenResult.normalizedMark,
      splitResult.normalizedMark,
      splitResult.confidence,
      writtenResult.confidence,
    );
    const confidence = splitResult.normalizedMark
      ? splitResult.confidence
      : writtenResult.confidence;

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
      splitCropDataUrl,
      splitDigitCropDataUrls,
      tableCropDataUrl: index === 0 ? tableCropDataUrl : undefined,
      ocrProvider: ocrProvider.name,
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
      statusReason: extractionNote || extracted.reason,
      status: "PARSED",
      validationErrors: [],
      operatorCorrection: "",
    });
  }

  // Save detection overlay always so operators can verify geometry.
  try {
    await saveDetectionOverlay(scan.colorBuffer, scan.width, scan.height, detection, overlayRects);
  } catch {
    // Best effort — overlay never blocks import
  }

  const validatedRows = validateScanRows(rawRows, context, roster);
  const countByStatus = validatedRows.reduce<Record<string, number>>((acc, row) => {
    acc[row.status] = (acc[row.status] ?? 0) + 1;
    return acc;
  }, {});

  const parts: string[] = [];
  if (countByStatus["VALID"]) parts.push(`${countByStatus["VALID"]} valid`);
  if (countByStatus["NEEDS_REVIEW"]) parts.push(`${countByStatus["NEEDS_REVIEW"]} need review`);
  if (countByStatus["MISSING"]) parts.push(`${countByStatus["MISSING"]} missing`);
  if (countByStatus["INVALID"]) parts.push(`${countByStatus["INVALID"]} invalid`);

  const detectionNote = detection.method === "detected"
    ? `Table detected (confidence ${Math.round(detection.confidence * 100)}%).`
    : `Table not detected — using estimated geometry.`;

  return {
    parseStatus: "PARSED",
    message:
      `Scan processed. ${detectionNote} Review suggested marks before validation. ` +
      `OCR provider: ${ocrProvider.name}. ` +
      `Extracted ${roster.length} roster rows: ${parts.join(", ") || "all blank (no marks visible)"}.`,
    rows: validatedRows,
    studentCount: roster.length,
  };
}
