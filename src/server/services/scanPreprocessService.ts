import sharp from "sharp";
import type { PixelRect } from "./marksheetGeometryService";

export type PreprocessedScan = {
  buffer: Buffer;
  width: number;
  height: number;
};

const PDF_MIME_TYPES = new Set(["application/pdf", "image/pdf"]);

/**
 * Preprocess a scanned image for OCR.
 *
 * Converts to greyscale, normalises contrast, and sharpens edges to improve
 * Tesseract recognition accuracy on handwritten marks.
 *
 * Throws for unsupported formats (e.g. PDF without Poppler) with a clear message.
 */
export async function preprocessScanImage(
  inputBuffer: Buffer,
  mimeType: string,
): Promise<PreprocessedScan> {
  const mime = mimeType.toLowerCase().trim();

  if (PDF_MIME_TYPES.has(mime) || mime.endsWith("/pdf")) {
    // Sharp can render PDFs only when libvips is compiled with Poppler support.
    // This is not available in the default npm sharp installation.
    // Return a clear error so the operator knows to re-scan as PNG/JPG.
    try {
      const buf = await sharp(inputBuffer, { page: 0 }).greyscale().normalize().jpeg({ quality: 95 }).toBuffer();
      const meta = await sharp(buf).metadata();
      return { buffer: buf, width: meta.width ?? 0, height: meta.height ?? 0 };
    } catch {
      throw new Error(
        "PDF scan rendering failed: this server does not have Poppler support. " +
          "Re-scan the marksheet and upload as PNG or JPG.",
      );
    }
  }

  const buf = await sharp(inputBuffer)
    .greyscale()
    .normalize()
    .sharpen({ sigma: 1.2 })
    .jpeg({ quality: 95 })
    .toBuffer();

  const meta = await sharp(buf).metadata();
  if (!meta.width || !meta.height) {
    throw new Error("Could not read image dimensions after preprocessing.");
  }

  return { buffer: buf, width: meta.width, height: meta.height };
}

/**
 * Crop a rectangular region from an already-preprocessed image buffer.
 * Applies light normalisation on the cropped cell for cleaner OCR.
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
