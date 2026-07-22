import fs from "node:fs/promises";
import path from "node:path";
import jsQR from "jsqr";
import sharp from "sharp";
import type {
  MarksheetIdCandidate,
  MarksheetIdDebug,
  MarksheetIdMatchSource,
} from "../../../../shared/types/imports";
import {
  findMarksheetIdCandidatesInText,
  findSheetNumberInText,
  normalizeMarksheetId,
  parseMarksheetIdComponents,
} from "./marksheetContextService";
import {
  LAYOUT,
  PAGE_MARGIN_LEFT_FRAC,
  TABLE_WIDTH_FRAC,
  type PixelRect,
} from "./marksheetGeometryService";
import { preprocessScanImage } from "../../../../server/services/scanPreprocessService";
import { readAzureOcrFromImage } from "../../../../server/services/azureOcrService";

const DEBUG_DIR = path.join(process.cwd(), "tmp", "ocr-debug", "latest");

export type MarksheetIdDetectionResult = {
  rawHeaderText: string;
  rawFooterText: string;
  candidates: MarksheetIdCandidate[];
  selectedCandidate: MarksheetIdCandidate | null;
  rawRecognizedId: string | null;
  normalizedRecognizedId: string;
  recognizedSheetNumber: string | null;
  confidence: number;
  matchSource: Extract<MarksheetIdMatchSource, "header" | "footer"> | null;
  debug: MarksheetIdDebug;
  failureReason: string;
};

type DebugLookupResult = {
  contextSource?: string;
  matchedMarksheetId?: string;
  resolved?: boolean;
  warning?: string;
};

type PrintedTextResult = { text: string; confidence: number; error: string };

async function withTimeout<T>(task: Promise<T>, ms: number, fallback: T): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  try {
    return await Promise.race([
      task,
      new Promise<T>((resolve) => {
        timeout = setTimeout(() => resolve(fallback), ms);
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

function clampRect(rect: PixelRect, width: number, height: number): PixelRect {
  const x = Math.max(0, Math.min(width - 1, rect.x));
  const y = Math.max(0, Math.min(height - 1, rect.y));
  const w = Math.max(1, Math.min(width - x, rect.w));
  const h = Math.max(1, Math.min(height - y, rect.h));
  return { x, y, w, h };
}

function marksheetIdRects(width: number, height: number): Record<"header" | "footer", PixelRect> {
  const contentX = Math.max(0, Math.round(PAGE_MARGIN_LEFT_FRAC * width));
  const contentW = Math.max(1, Math.round(TABLE_WIDTH_FRAC * width));
  return {
    header: clampRect({
      x: contentX,
      y: Math.max(0, Math.round(LAYOUT.marginTopFrac * height)),
      w: contentW,
      h: Math.max(1, Math.round((LAYOUT.headerHFrac + 0.015) * height)),
    }, width, height),
    footer: clampRect({
      x: contentX,
      y: Math.max(0, Math.round(0.885 * height)),
      w: contentW,
      h: Math.max(1, Math.round(0.105 * height)),
    }, width, height),
  };
}

/**
 * Specific top-right corner crop where the marksheet ID is printed.
 * Uses a generous left boundary (50 % of page width) to tolerate shifted or
 * slightly skewed photos.  Starts from y=0 (above the print margin) so the ID
 * is still captured even when the page is slightly low in the frame.
 */
function topRightIdRect(width: number, height: number): PixelRect {
  const x = Math.max(0, Math.round(0.50 * width));
  const h = Math.min(
    Math.round((LAYOUT.marginTopFrac + LAYOUT.headerHFrac + 0.04) * height),
    Math.round(0.33 * height),
  );
  return clampRect({ x, y: 0, w: width - x, h }, width, height);
}

/**
 * Expanded top-right crop ? wider horizontal margin for skewed / shifted scans.
 * Starts at 34 % to catch prints shifted to the left.
 */
function expandedTopRightIdRect(width: number, height: number): PixelRect {
  const x = Math.max(0, Math.round(0.34 * width));
  const h = Math.min(
    Math.round((LAYOUT.marginTopFrac + LAYOUT.headerHFrac + 0.06) * height),
    Math.round(0.38 * height),
  );
  return clampRect({ x, y: 0, w: width - x, h }, width, height);
}

async function preparePrintedTextCrop(imageBuffer: Buffer, rect: PixelRect): Promise<Buffer> {
  const targetWidth = Math.min(2200, Math.max(480, rect.w * 3));
  const targetHeight = Math.min(520, Math.max(140, rect.h * 3));
  return sharp(imageBuffer)
    .extract({ left: rect.x, top: rect.y, width: rect.w, height: rect.h })
    .resize({
      width: targetWidth,
      height: targetHeight,
      fit: "fill",
    })
    .greyscale()
    .normalize()
    .linear(1.35, -18)
    .sharpen({ sigma: 0.8 })
    .jpeg({ quality: 94 })
    .toBuffer();
}

/**
 * Higher-quality preprocessing for the specific marksheet ID zone.
 * Applies a 4× upscale, aggressive contrast, and binarization so that printed
 * text at the top-right corner reads cleanly even from phone/flatbed photos.
 */
async function prepareIdCropForOcr(imageBuffer: Buffer, rect: PixelRect): Promise<Buffer> {
  const targetWidth = Math.min(2400, Math.max(640, rect.w * 4));
  const targetHeight = Math.min(640, Math.max(180, rect.h * 4));
  return sharp(imageBuffer)
    .extract({ left: rect.x, top: rect.y, width: rect.w, height: rect.h })
    .resize({ width: targetWidth, height: targetHeight, fit: "fill" })
    .greyscale()
    .normalize()
    .linear(1.6, -30)
    .sharpen({ sigma: 0.6 })
    .threshold(145)
    .jpeg({ quality: 97 })
    .toBuffer();
}

/** Collapse newlines and multiple spaces in raw OCR output before candidate extraction. */
function normalizeOcrWhitespace(text: string): string {
  return text.replace(/[\r\n]+/g, " ").replace(/\s{2,}/g, " ").trim();
}

async function decodeQrFromCrop(imageBuffer: Buffer, rect: PixelRect): Promise<string> {
  try {
    const { data, info } = await sharp(imageBuffer)
      .extract({ left: rect.x, top: rect.y, width: rect.w, height: rect.h })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const code = jsQR(new Uint8ClampedArray(data), info.width, info.height, {
      inversionAttempts: "attemptBoth",
    });
    return code?.data?.trim() ?? "";
  } catch {
    return "";
  }
}

async function recognizePrintedTextCrop(cropId: string, buffer: Buffer): Promise<PrintedTextResult> {
  try {
    const result = await withTimeout(
      readAzureOcrFromImage({
        imageBase64: buffer.toString("base64"),
        mimeType: "image/jpeg",
      }),
      35000,
      null as Awaited<ReturnType<typeof readAzureOcrFromImage>> | null,
    );
    if (!result) return { text: "", confidence: 0, error: "Azure OCR Marksheet ID crop request timed out." };
    return {
      text: result.lines.length > 0 ? result.lines.join("\n") : result.text,
      confidence: result.text.trim() || result.lines.length > 0 ? 0.9 : 0,
      error: "",
    };
  } catch (error) {
    return {
      text: "",
      confidence: 0,
      error: error instanceof Error
        ? `Azure OCR Marksheet ID crop request failed: ${error.message}`
        : "Azure OCR Marksheet ID crop request failed.",
    };
  }
}

export function extractMarksheetIdCandidatesFromOcrText(
  text: string,
  source: Extract<MarksheetIdMatchSource, "header" | "footer">,
  confidence: number,
  method: "qr" | "ocr" = "ocr",
): MarksheetIdCandidate[] {
  const rawCandidates: string[] = [];
  const pushRaw = (raw: string) => {
    const normalized = normalizeMarksheetId(raw);
    if (parseMarksheetIdComponents(normalized).valid && !rawCandidates.includes(raw)) {
      rawCandidates.push(raw);
    }
  };

  const tokens = text
    .toUpperCase()
    .replace(/[–?−]/g, "-")
    .replace(/\|/g, "I")
    .match(/[A-Z0-9]+/g) ?? [];
  for (let index = 0; index <= tokens.length - 7; index += 1) {
    if (tokens[index] !== "MS" && tokens[index] !== "M5") continue;
    pushRaw(tokens.slice(index, index + 7).join("-"));
  }

  if (rawCandidates.length === 0) {
    for (const normalized of findMarksheetIdCandidatesInText(text)) pushRaw(normalized);
  }

  return rawCandidates.map((raw) => ({
    source,
    rawRecognizedId: raw,
    normalizedRecognizedId: normalizeMarksheetId(raw),
    confidence,
    method,
  }));
}

async function writeDebugArtifacts(
  result: MarksheetIdDetectionResult,
  lookupResult?: DebugLookupResult,
): Promise<void> {
  await fs.mkdir(DEBUG_DIR, { recursive: true });
  const debugJson = {
    rawOcrHeaderText: result.rawHeaderText,
    rawOcrFooterText: result.rawFooterText,
    recognizedSheetNumber: result.recognizedSheetNumber ?? null,
    recognizedInternalMarksheetId: result.normalizedRecognizedId || null,
    normalizedCandidates: result.candidates.map((candidate) => candidate.normalizedRecognizedId),
    candidates: result.candidates,
    selectedCandidate: result.selectedCandidate,
    matchedMarksheet: lookupResult?.matchedMarksheetId ?? null,
    contextSource: lookupResult?.contextSource ?? null,
    lookupResult: lookupResult ?? null,
    failureReason: result.failureReason,
    debugCrops: {
      headerIdCrop: path.join(DEBUG_DIR, "marksheet-id-header-crop.jpg"),
      topRightIdCrop: path.join(DEBUG_DIR, "marksheet-id-topright-crop.jpg"),
      expandedTopRightIdCrop: path.join(DEBUG_DIR, "marksheet-id-topright-expanded-crop.jpg"),
      footerIdCrop: path.join(DEBUG_DIR, "marksheet-id-footer-crop.jpg"),
    },
  };
  await fs.writeFile(
    path.join(DEBUG_DIR, "marksheet-id-detection.json"),
    JSON.stringify(debugJson, null, 2),
    "utf8",
  );
}

export async function saveMarksheetIdLookupDebug(
  result: MarksheetIdDetectionResult | null,
  lookupResult: DebugLookupResult,
): Promise<void> {
  if (!result) return;
  await writeDebugArtifacts(result, lookupResult);
}

export async function detectMarksheetIdFromScan(
  fileBuffer: Buffer,
  mimeType: string,
): Promise<MarksheetIdDetectionResult> {
  try { await fs.mkdir(DEBUG_DIR, { recursive: true }); } catch { /* best effort */ }

  const scan = await preprocessScanImage(fileBuffer, mimeType);
  const rects = marksheetIdRects(scan.width, scan.height);
  const topRightRect = topRightIdRect(scan.width, scan.height);
  const expandedRect = expandedTopRightIdRect(scan.width, scan.height);

  // Prepare all crop zones in parallel
  const [headerCrop, footerCrop, topRightCrop, expandedTopRightCrop] = await Promise.all([
    preparePrintedTextCrop(scan.buffer, rects.header),
    preparePrintedTextCrop(scan.buffer, rects.footer),
    prepareIdCropForOcr(scan.buffer, topRightRect),
    prepareIdCropForOcr(scan.buffer, expandedRect),
  ]);

  // Save debug crops (best effort ? filesystem may not be writable on all platforms)
  const headerCropPath = path.join(DEBUG_DIR, "marksheet-id-header-crop.jpg");
  const topRightCropPath = path.join(DEBUG_DIR, "marksheet-id-topright-crop.jpg");
  const expandedTopRightCropPath = path.join(DEBUG_DIR, "marksheet-id-topright-expanded-crop.jpg");
  const footerCropPath = path.join(DEBUG_DIR, "marksheet-id-footer-crop.jpg");
  try {
    await Promise.all([
      fs.writeFile(headerCropPath, headerCrop),
      fs.writeFile(topRightCropPath, topRightCrop),
      fs.writeFile(expandedTopRightCropPath, expandedTopRightCrop),
      fs.writeFile(footerCropPath, footerCrop),
    ]);
  } catch { /* best effort */ }

  // QR decode on all header-region crops (fast, no Azure call)
  const [headerQr, footerQr, topRightQr] = await Promise.all([
    decodeQrFromCrop(scan.colorBuffer, rects.header),
    decodeQrFromCrop(scan.colorBuffer, rects.footer),
    decodeQrFromCrop(scan.colorBuffer, topRightRect),
  ]);

  const qrCandidates = [
    ...extractMarksheetIdCandidatesFromOcrText(topRightQr, "header", 0.99, "qr"),
    ...extractMarksheetIdCandidatesFromOcrText(headerQr, "header", 0.99, "qr"),
    ...extractMarksheetIdCandidatesFromOcrText(footerQr, "footer", 0.99, "qr"),
  ];

  // OCR all zones: top-right crop first (highest signal), then expanded, full header, footer
  const [topRightOcr, expandedOcr, headerOcr, footerOcr] = await Promise.all([
    recognizePrintedTextCrop("marksheet-id-topright", topRightCrop),
    recognizePrintedTextCrop("marksheet-id-topright-expanded", expandedTopRightCrop),
    recognizePrintedTextCrop("marksheet-id-header", headerCrop),
    recognizePrintedTextCrop("marksheet-id-footer", footerCrop),
  ]);

  // Priority: top-right > expanded top-right > full header band > footer
  const ocrCandidates = [
    ...extractMarksheetIdCandidatesFromOcrText(normalizeOcrWhitespace(topRightOcr.text), "header", topRightOcr.confidence, "ocr"),
    ...extractMarksheetIdCandidatesFromOcrText(normalizeOcrWhitespace(expandedOcr.text), "header", expandedOcr.confidence * 0.95, "ocr"),
    ...extractMarksheetIdCandidatesFromOcrText(normalizeOcrWhitespace(headerOcr.text), "header", headerOcr.confidence * 0.85, "ocr"),
    ...extractMarksheetIdCandidatesFromOcrText(normalizeOcrWhitespace(footerOcr.text), "footer", footerOcr.confidence, "ocr"),
  ];

  const candidates = [...qrCandidates, ...ocrCandidates].filter((candidate, index, all) =>
    all.findIndex((item) =>
      item.source === candidate.source &&
      item.normalizedRecognizedId === candidate.normalizedRecognizedId &&
      item.method === candidate.method
    ) === index
  );
  const selectedCandidate =
    candidates.find((candidate) => candidate.source === "header") ??
    candidates.find((candidate) => candidate.source === "footer") ??
    null;

  // Sheet number: check top-right text first, then full header, then footer
  const recognizedSheetNumber =
    findSheetNumberInText(topRightOcr.text) ??
    findSheetNumberInText(headerOcr.text) ??
    findSheetNumberInText(footerOcr.text) ??
    null;

  // Best OCR text for display ? prefer top-right zone which targets the ID specifically
  const primaryHeaderText = topRightOcr.text || expandedOcr.text || headerOcr.text;

  const firstError = topRightOcr.error || headerOcr.error || footerOcr.error || expandedOcr.error;
  const failureReason = selectedCandidate
    ? ""
    : firstError || "No Marksheet ID candidate found in top-right corner, header, or footer.";

  const result: MarksheetIdDetectionResult = {
    rawHeaderText: primaryHeaderText,
    rawFooterText: footerOcr.text,
    candidates,
    selectedCandidate,
    rawRecognizedId: selectedCandidate?.rawRecognizedId ?? null,
    normalizedRecognizedId: selectedCandidate?.normalizedRecognizedId ?? "",
    recognizedSheetNumber,
    confidence: selectedCandidate?.confidence ?? 0,
    matchSource: selectedCandidate?.source ?? null,
    failureReason,
    debug: {
      headerCropPath,
      topRightCropPath,
      expandedTopRightCropPath,
      footerCropPath,
      debugJsonPath: path.join(DEBUG_DIR, "marksheet-id-detection.json"),
      rawHeaderText: primaryHeaderText,
      rawFooterText: footerOcr.text,
      normalizedCandidates: candidates.map((candidate) => candidate.normalizedRecognizedId),
      selectedCandidate,
      failureReason,
    },
  };

  try { await writeDebugArtifacts(result); } catch { /* best effort */ }
  return result;
}

