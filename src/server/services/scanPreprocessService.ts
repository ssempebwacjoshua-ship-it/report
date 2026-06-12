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
