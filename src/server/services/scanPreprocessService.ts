import sharp from "sharp";
import type { PixelRect } from "./marksheetGeometryService";
import type { CropCandidate, CropStrategy } from "./marksheetTableDetection";

export type PreprocessedScan = {
  buffer: Buffer;       // greyscale, normalized, sharpened JPEG — used for geometry detection and display
  colorBuffer: Buffer;  // normalized color JPEG — used for blue ink isolation and debug overlay
  width: number;
  height: number;
};

const PDF_MIME_TYPES = new Set(["application/pdf", "image/pdf"]);

/**
 * Preprocess a scanned image for OCR.
 *
 * Returns both a greyscale buffer (for table detection and display) and a
 * color buffer (for blue ink isolation and the detection overlay).
 *
 * Throws for unsupported formats (e.g. PDF without Poppler) with a clear message.
 */
export async function preprocessScanImage(
  inputBuffer: Buffer,
  mimeType: string,
): Promise<PreprocessedScan> {
  const mime = mimeType.toLowerCase().trim();

  if (PDF_MIME_TYPES.has(mime) || mime.endsWith("/pdf")) {
    try {
      const [greyBuf, colorBuf] = await Promise.all([
        sharp(inputBuffer, { page: 0 }).greyscale().normalize().sharpen({ sigma: 1.2 }).jpeg({ quality: 95 }).toBuffer(),
        sharp(inputBuffer, { page: 0 }).normalize().jpeg({ quality: 95 }).toBuffer(),
      ]);
      const meta = await sharp(greyBuf).metadata();
      return { buffer: greyBuf, colorBuffer: colorBuf, width: meta.width ?? 0, height: meta.height ?? 0 };
    } catch {
      throw new Error(
        "PDF scan rendering failed: this server does not have Poppler support. " +
          "Re-scan the marksheet and upload as PNG or JPG.",
      );
    }
  }

  const [greyBuf, colorBuf] = await Promise.all([
    sharp(inputBuffer).greyscale().normalize().sharpen({ sigma: 1.2 }).jpeg({ quality: 95 }).toBuffer(),
    sharp(inputBuffer).normalize().jpeg({ quality: 95 }).toBuffer(),
  ]);

  const meta = await sharp(greyBuf).metadata();
  if (!meta.width || !meta.height) {
    throw new Error("Could not read image dimensions after preprocessing.");
  }

  return { buffer: greyBuf, colorBuffer: colorBuf, width: meta.width, height: meta.height };
}

/**
 * Crop a rectangular region and apply greyscale + contrast preprocessing for OCR.
 */
export async function cropCell(imageBuffer: Buffer, rect: PixelRect): Promise<Buffer> {
  return sharp(imageBuffer)
    .extract({ left: rect.x, top: rect.y, width: rect.w, height: rect.h })
    .resize({
      width: Math.max(96, rect.w * 4),
      height: Math.max(48, rect.h * 4),
      fit: "fill",
    })
    .greyscale()
    .normalize()
    .linear(1.25, -12)
    .threshold(168)
    .jpeg({ quality: 90 })
    .toBuffer();
}

/**
 * Crop a region from the color buffer and isolate blue handwriting pixels.
 *
 * Per-pixel rule: a pixel is "ink" if its blue channel is dominant
 * (B > R+15 AND B > G+10 AND B > 80). All other pixels become white.
 * The result is upscaled for OCR and returned as JPEG.
 *
 * Falls back to cropCell (greyscale) when the buffer has no colour channels.
 */
export async function cropCellBlueIsolated(colorBuffer: Buffer, rect: PixelRect): Promise<Buffer> {
  let data: Buffer;
  let info: sharp.OutputInfo;
  try {
    const result = await sharp(colorBuffer)
      .extract({ left: rect.x, top: rect.y, width: rect.w, height: rect.h })
      .raw()
      .toBuffer({ resolveWithObject: true });
    data = result.data;
    info = result.info;
  } catch {
    return cropCell(colorBuffer, rect);
  }

  if (info.channels < 3) {
    return cropCell(colorBuffer, rect);
  }

  const ch = info.channels;
  const greyData = Buffer.alloc(info.width * info.height, 255);
  for (let i = 0, j = 0; i < data.length; i += ch, j++) {
    const r = data[i] ?? 255;
    const g = data[i + 1] ?? 255;
    const b = data[i + 2] ?? 255;
    if (b > r + 15 && b > g + 10 && b > 80) greyData[j] = 0;
  }

  return sharp(greyData, { raw: { width: info.width, height: info.height, channels: 1 } })
    .resize({
      width: Math.max(96, rect.w * 4),
      height: Math.max(48, rect.h * 4),
      fit: "fill",
    })
    .jpeg({ quality: 90 })
    .toBuffer();
}

export async function cropPreview(imageBuffer: Buffer, rect: PixelRect): Promise<Buffer> {
  return sharp(imageBuffer)
    .extract({ left: rect.x, top: rect.y, width: rect.w, height: rect.h })
    .resize({ width: Math.max(120, rect.w * 3), withoutEnlargement: false })
    .jpeg({ quality: 82 })
    .toBuffer();
}

export function bufferToDataUrl(buffer: Buffer, mimeType = "image/jpeg"): string {
  return `data:${mimeType};base64,${buffer.toString("base64")}`;
}

export type CropQuality = {
  ok: boolean;
  reason: string;
  /** 0–1 quality score; higher is a better OCR target. Used to rank fallback crops. */
  score: number;
};

type CropMetrics = {
  decoded: boolean;
  darkFrac: number;
  edgeMaxFrac: number;
  vertColsFrac: number;
  horizRowsFrac: number;
};

/** Decode a greyscale crop and compute the dark-pixel / border / line metrics. */
async function cropMetrics(croppedBuffer: Buffer): Promise<CropMetrics> {
  let data: Buffer;
  let w: number;
  let h: number;
  try {
    const result = await sharp(croppedBuffer).greyscale().raw().toBuffer({ resolveWithObject: true });
    data = result.data;
    w = result.info.width;
    h = result.info.height;
  } catch {
    return { decoded: false, darkFrac: 0, edgeMaxFrac: 0, vertColsFrac: 0, horizRowsFrac: 0 };
  }

  if (w < 4 || h < 4) {
    return { decoded: true, darkFrac: 0, edgeMaxFrac: 1, vertColsFrac: 0, horizRowsFrac: 0 };
  }

  let darkCount = 0;
  for (let i = 0; i < data.length; i++) {
    if ((data[i] ?? 255) < 128) darkCount++;
  }
  const darkFrac = darkCount / (w * h);

  const edgePx = Math.max(3, Math.min(6, Math.floor(w * 0.04)));
  let leftDark = 0;
  let rightDark = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < edgePx; x++) {
      if ((data[y * w + x] ?? 255) < 128) leftDark++;
    }
    for (let x = w - edgePx; x < w; x++) {
      if ((data[y * w + x] ?? 255) < 128) rightDark++;
    }
  }
  const edgeArea = h * edgePx;
  const edgeMaxFrac = Math.max(leftDark, rightDark) / edgeArea;

  let vertLineCols = 0;
  for (let x = 0; x < w; x++) {
    let colDark = 0;
    for (let y = 0; y < h; y++) {
      if ((data[y * w + x] ?? 255) < 128) colDark++;
    }
    if (colDark / h > 0.75) vertLineCols++;
  }
  const vertColsFrac = vertLineCols / w;

  let horizLineRows = 0;
  for (let y = 0; y < h; y++) {
    let rowDark = 0;
    for (let x = 0; x < w; x++) {
      if ((data[y * w + x] ?? 255) < 128) rowDark++;
    }
    if (rowDark / w > 0.55) horizLineRows++;
  }
  const horizRowsFrac = horizLineRows / h;

  return { decoded: true, darkFrac, edgeMaxFrac, vertColsFrac, horizRowsFrac };
}

/** Foreground-stroke score: peaks for a moderate amount of ink, low when blank or solid. */
function foregroundScore(darkFrac: number): number {
  if (darkFrac < 0.002) return 0;          // blank
  if (darkFrac <= 0.2) return Math.min(1, darkFrac / 0.05); // ramps to 1 by ~5% ink
  if (darkFrac <= 0.4) return Math.max(0.1, 1 - ((darkFrac - 0.2) / 0.2) * 0.7);
  return 0.05;                              // mostly dark (border/solid)
}

/**
 * Inspect a greyscale crop for OCR-quality problems AND return a numeric score
 * used to rank fallback recrop candidates.
 *
 * `ok: false` with a `reason` is returned for any of:
 *   - blank (too few dark pixels)
 *   - mostly dark (border or solid region)
 *   - vertical border line attached to the left or right edge
 *   - too many full-height vertical lines (grid contamination)
 *   - too many full-width horizontal lines (row border contamination)
 *
 * On decode failure the check is skipped (returns ok: true, neutral score) so a
 * decode error never blocks extraction.
 */
export async function analyzeCropQuality(croppedBuffer: Buffer): Promise<CropQuality> {
  const m = await cropMetrics(croppedBuffer);
  if (!m.decoded) return { ok: true, reason: "", score: 0.5 };

  let reason = "";
  let ok = true;
  if (m.darkFrac < 0.002) { ok = false; reason = "Blank crop — no ink detected"; }
  else if (m.darkFrac > 0.4) { ok = false; reason = "Crop mostly dark (border or solid region)"; }
  else if (m.edgeMaxFrac > 0.35) { ok = false; reason = "Vertical border line attached to crop edge"; }
  else if (m.vertColsFrac > 0.03) { ok = false; reason = "Prominent vertical lines (grid border contamination)"; }
  else if (m.horizRowsFrac > 0.1) { ok = false; reason = "Prominent horizontal lines (row border contamination)"; }

  // Score: start from foreground quality, then apply graded contamination penalties.
  let score = foregroundScore(m.darkFrac);
  if (m.edgeMaxFrac > 0.35) score *= 0.3;
  if (m.vertColsFrac > 0.03) score *= 0.4;
  if (m.horizRowsFrac > 0.1) score *= 0.15; // horizontal row borders are the core bug — penalise hard
  // Soft penalty for partial horizontal contamination below the hard threshold.
  score *= 1 - Math.min(0.5, Math.max(0, m.horizRowsFrac - 0.03) * 3);
  score = Math.max(0, Math.min(1, score));

  return { ok, reason, score };
}

/**
 * Backwards-compatible quality gate. Returns only `{ ok, reason }`.
 */
export async function checkCropQuality(croppedBuffer: Buffer): Promise<{ ok: boolean; reason: string }> {
  const { ok, reason } = await analyzeCropQuality(croppedBuffer);
  return { ok, reason };
}

/** Numeric-only quality score (0–1) for a crop. Convenience wrapper. */
export async function scoreCropQuality(croppedBuffer: Buffer): Promise<number> {
  return (await analyzeCropQuality(croppedBuffer)).score;
}

/**
 * Whiten rows that are dominated by dark pixels (printed horizontal row borders)
 * so they are ignored by OCR. Best-effort: on decode failure the original buffer
 * is returned unchanged.
 */
export async function stripHorizontalBorders(croppedBuffer: Buffer): Promise<Buffer> {
  let data: Buffer;
  let w: number;
  let h: number;
  try {
    const result = await sharp(croppedBuffer).greyscale().raw().toBuffer({ resolveWithObject: true });
    data = result.data;
    w = result.info.width;
    h = result.info.height;
  } catch {
    return croppedBuffer;
  }
  if (w < 4 || h < 4) return croppedBuffer;

  for (let y = 0; y < h; y++) {
    let rowDark = 0;
    for (let x = 0; x < w; x++) {
      if ((data[y * w + x] ?? 255) < 128) rowDark++;
    }
    if (rowDark / w > 0.55) {
      for (let x = 0; x < w; x++) data[y * w + x] = 255;
    }
  }

  return sharp(data, { raw: { width: w, height: h, channels: 1 } }).jpeg({ quality: 90 }).toBuffer();
}

/**
 * Search a mark-cell region for handwritten (blue-ink) strokes and return a crop
 * tightly bounding them, padded slightly. Unlike a blind shift, this locates the
 * actual handwriting within the full cell so a fallback crop lands on the mark.
 *
 * Uses the same blue-dominant rule as cropCellBlueIsolated. Returns null when no
 * ink is found or the buffer has no colour channels.
 */
export async function findInkRowBandCrop(
  colorBuffer: Buffer,
  cellRect: PixelRect,
): Promise<PixelRect | null> {
  let data: Buffer;
  let info: sharp.OutputInfo;
  try {
    const result = await sharp(colorBuffer)
      .extract({ left: cellRect.x, top: cellRect.y, width: cellRect.w, height: cellRect.h })
      .raw()
      .toBuffer({ resolveWithObject: true });
    data = result.data;
    info = result.info;
  } catch {
    return null;
  }
  if (info.channels < 3) return null;

  const ch = info.channels;
  const w = info.width;
  const h = info.height;
  const isInk = (i: number): boolean => {
    const r = data[i] ?? 255;
    const g = data[i + 1] ?? 255;
    const b = data[i + 2] ?? 255;
    return b > r + 15 && b > g + 10 && b > 80;
  };

  // Vertical extent of ink rows.
  const rowThreshold = Math.max(1, Math.round(w * 0.02));
  let top = -1;
  let bottom = -1;
  for (let y = 0; y < h; y++) {
    let ink = 0;
    for (let x = 0; x < w; x++) if (isInk((y * w + x) * ch)) ink++;
    if (ink >= rowThreshold) {
      if (top < 0) top = y;
      bottom = y;
    }
  }
  if (top < 0) return null;

  const marginY = Math.round((bottom - top + 1) * 0.3) + 4;
  const y0 = Math.max(0, top - marginY);
  const y1 = Math.min(h - 1, bottom + marginY);

  // Horizontal extent of ink within the vertical band.
  const colThreshold = Math.max(1, Math.round((y1 - y0 + 1) * 0.05));
  let left = -1;
  let right = -1;
  for (let x = 0; x < w; x++) {
    let ink = 0;
    for (let y = y0; y <= y1; y++) if (isInk((y * w + x) * ch)) ink++;
    if (ink >= colThreshold) {
      if (left < 0) left = x;
      right = x;
    }
  }
  if (left < 0) { left = 0; right = w - 1; }
  const marginX = Math.round((right - left + 1) * 0.3) + 4;
  const x0 = Math.max(0, left - marginX);
  const x1 = Math.min(w - 1, right + marginX);

  return {
    x: cellRect.x + x0,
    y: cellRect.y + y0,
    w: Math.max(1, x1 - x0 + 1),
    h: Math.max(1, y1 - y0 + 1),
  };
}

export type CropSelection = {
  rect: PixelRect;
  strategy: CropStrategy;
  quality: CropQuality;
  /** Greyscale preview JPEG of the selected crop (for debug display). */
  preview: Buffer;
};

/**
 * Crop every candidate region from `grayBuffer`, score it, and return the best.
 *
 * Selection prefers candidates that pass the quality gate (`ok`), then highest
 * score. Ties keep the earlier candidate, so "original" wins when nothing beats
 * it. When no candidate passes, the highest-scoring (least-bad) crop is returned
 * with `quality.ok === false` so the caller can fall back to manual entry.
 */
export async function selectBestCrop(
  grayBuffer: Buffer,
  candidates: CropCandidate[],
): Promise<CropSelection> {
  let best: CropSelection | null = null;

  for (const candidate of candidates) {
    let preview: Buffer;
    try {
      preview = await cropPreview(grayBuffer, candidate.rect);
    } catch {
      continue;
    }
    const quality = await analyzeCropQuality(preview);
    const current: CropSelection = { rect: candidate.rect, strategy: candidate.strategy, quality, preview };

    if (!best) { best = current; continue; }
    const betterOk = quality.ok && !best.quality.ok;
    const sameOk = quality.ok === best.quality.ok;
    if (betterOk || (sameOk && quality.score > best.quality.score)) {
      best = current;
    }
  }

  if (best) return best;

  // No candidate could even be cropped — synthesise a failing selection.
  const fallback = candidates[0]?.rect ?? { x: 0, y: 0, w: 1, h: 1 };
  return {
    rect: fallback,
    strategy: candidates[0]?.strategy ?? "original",
    quality: { ok: false, reason: "Crop could not be decoded", score: 0 },
    preview: grayBuffer,
  };
}
// crop fallback geometry: candidate scoring + best-crop selection
