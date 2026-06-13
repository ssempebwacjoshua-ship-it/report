import fs from "node:fs/promises";
import path from "node:path";
import jsQR from "jsqr";
import sharp from "sharp";
import type {
  MarksheetIdCandidate,
  MarksheetIdDebug,
  MarksheetIdMatchSource,
} from "../../shared/types/imports";
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
import { preprocessScanImage } from "./scanPreprocessService";
import { readAzureOcrFromImage } from "./azureOcrService";

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
    .replace(/[–—−]/g, "-")
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
  await fs.mkdir(DEBUG_DIR, { recursive: true });
  const scan = await preprocessScanImage(fileBuffer, mimeType);
  const rects = marksheetIdRects(scan.width, scan.height);

  const [headerCrop, footerCrop] = await Promise.all([
    preparePrintedTextCrop(scan.buffer, rects.header),
    preparePrintedTextCrop(scan.buffer, rects.footer),
  ]);
  const headerCropPath = path.join(DEBUG_DIR, "marksheet-id-header-crop.jpg");
  const footerCropPath = path.join(DEBUG_DIR, "marksheet-id-footer-crop.jpg");
  await Promise.all([
    fs.writeFile(headerCropPath, headerCrop),
    fs.writeFile(footerCropPath, footerCrop),
  ]);

  const [headerQr, footerQr] = await Promise.all([
    decodeQrFromCrop(scan.colorBuffer, rects.header),
    decodeQrFromCrop(scan.colorBuffer, rects.footer),
  ]);

  const qrCandidates = [
    ...extractMarksheetIdCandidatesFromOcrText(headerQr, "header", 0.99, "qr"),
    ...extractMarksheetIdCandidatesFromOcrText(footerQr, "footer", 0.99, "qr"),
  ];

  const headerOcr = await recognizePrintedTextCrop("marksheet-id-header", headerCrop);
  const footerOcr = await recognizePrintedTextCrop("marksheet-id-footer", footerCrop);

  const ocrCandidates = [
    ...extractMarksheetIdCandidatesFromOcrText(headerOcr.text, "header", headerOcr.confidence, "ocr"),
    ...extractMarksheetIdCandidatesFromOcrText(footerOcr.text, "footer", footerOcr.confidence, "ocr"),
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

  // Extract sheet number (YYYYMMDD-NNN) from OCR text — header first, footer fallback
  const recognizedSheetNumber =
    findSheetNumberInText(headerOcr.text) ??
    findSheetNumberInText(footerOcr.text) ??
    null;

  const failureReason = selectedCandidate
    ? ""
    : headerOcr.error || footerOcr.error || "No Marksheet ID candidate found in header or footer crops.";

  const result: MarksheetIdDetectionResult = {
    rawHeaderText: headerOcr.text,
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
      footerCropPath,
      debugJsonPath: path.join(DEBUG_DIR, "marksheet-id-detection.json"),
      rawHeaderText: headerOcr.text,
      rawFooterText: footerOcr.text,
      normalizedCandidates: candidates.map((candidate) => candidate.normalizedRecognizedId),
      selectedCandidate,
      failureReason,
    },
  };

  await writeDebugArtifacts(result);
  return result;
}
