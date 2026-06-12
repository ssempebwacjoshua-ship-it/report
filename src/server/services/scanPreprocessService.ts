import sharp from "sharp";
import type { PixelRect } from "./marksheetGeometryService";

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

/**
 * Inspect a greyscale crop JPEG for quality problems that would make OCR
 * unreliable. Returns `ok: false` with a `reason` for any of:
 *   - blank (too few dark pixels)
 *   - mostly dark (border or solid region)
 *   - vertical border line attached to the left or right edge
 *   - too many full-height vertical lines (grid contamination)
 *   - too many full-width horizontal lines (row border contamination)
 *
 * On decode failure the check is skipped (returns ok: true) so a decode
 * error never blocks extraction.
 */
export async function checkCropQuality(croppedBuffer: Buffer): Promise<{ ok: boolean; reason: string }> {
  let data: Buffer;
  let w: number;
  let h: number;
  try {
    const result = await sharp(croppedBuffer)
      .greyscale()
      .raw()
      .toBuffer({ resolveWithObject: true });
    data = result.data;
    w = result.info.width;
    h = result.info.height;
  } catch {
    return { ok: true, reason: "" };
  }

  if (w < 4 || h < 4) return { ok: false, reason: "Crop too small" };

  let darkCount = 0;
  for (let i = 0; i < data.length; i++) {
    if ((data[i] ?? 255) < 128) darkCount++;
  }
  const darkFrac = darkCount / (w * h);

  if (darkFrac < 0.002) return { ok: false, reason: "Blank crop — no ink detected" };
  if (darkFrac > 0.40)  return { ok: false, reason: "Crop mostly dark (border or solid region)" };

  // Edge contamination: left/right 6px columns
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
  if (leftDark / edgeArea > 0.35 || rightDark / edgeArea > 0.35) {
    return { ok: false, reason: "Vertical border line attached to crop edge" };
  }

  // Full-height vertical lines (>75% dark per column)
  let vertLineCols = 0;
  for (let x = 0; x < w; x++) {
    let colDark = 0;
    for (let y = 0; y < h; y++) {
      if ((data[y * w + x] ?? 255) < 128) colDark++;
    }
    if (colDark / h > 0.75) vertLineCols++;
  }
  if (vertLineCols / w > 0.03) {
    return { ok: false, reason: "Prominent vertical lines (grid border contamination)" };
  }

  // Full-width horizontal lines (>55% dark per row)
  let horizLineRows = 0;
  for (let y = 0; y < h; y++) {
    let rowDark = 0;
    for (let x = 0; x < w; x++) {
      if ((data[y * w + x] ?? 255) < 128) rowDark++;
    }
    if (rowDark / w > 0.55) horizLineRows++;
  }
  if (horizLineRows / h > 0.10) {
    return { ok: false, reason: "Prominent horizontal lines (row border contamination)" };
  }

  return { ok: true, reason: "" };
}
