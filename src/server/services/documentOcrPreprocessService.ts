import sharp from "sharp";

export type OcrQualityNote = {
  code: string;
  message: string;
  severity: "info" | "warning";
};

export type DocumentOcrPreprocessResult = {
  originalBuffer: Buffer;
  processedBuffer: Buffer;
  processedMimeType: string;
  width: number;
  height: number;
  notes: OcrQualityNote[];
  warning?: string;
};

const IMAGE_MIME_RE = /^image\/(png|jpe?g|webp|tiff?|bmp|gif)$/i;
const PDF_MIME_TYPES = new Set(["application/pdf", "image/pdf"]);

export async function preprocessDocumentForOcr(
  inputBuffer: Buffer,
  mimeType: string,
): Promise<DocumentOcrPreprocessResult> {
  const mime = mimeType.toLowerCase().trim();
  const notes: OcrQualityNote[] = [];

  if (!IMAGE_MIME_RE.test(mime) && !PDF_MIME_TYPES.has(mime)) {
    notes.push({ code: "ORIGINAL_USED", message: "File type was sent to Gemini without image preprocessing.", severity: "info" });
    return {
      originalBuffer: inputBuffer,
      processedBuffer: inputBuffer,
      processedMimeType: mimeType,
      width: 0,
      height: 0,
      notes,
    };
  }

  try {
    const pipeline = PDF_MIME_TYPES.has(mime)
      ? sharp(inputBuffer, { page: 0, density: 180 })
      : sharp(inputBuffer, { failOn: "none" });

    const metadata = await pipeline.metadata();
    if (metadata.orientation && metadata.orientation !== 1) {
      notes.push({ code: "ORIENTATION_CORRECTED", message: "Image orientation metadata was corrected before OCR.", severity: "info" });
    }

    const normalized = pipeline
      .rotate()
      .trim({ background: "#ffffff", threshold: 12 })
      .resize({ width: 2200, height: 2200, fit: "inside", withoutEnlargement: true })
      .flatten({ background: "#ffffff" })
      .grayscale()
      .normalize()
      .median(1)
      .sharpen({ sigma: 1.05 })
      .jpeg({ quality: 88, mozjpeg: true });

    const processedBuffer = await normalized.toBuffer();
    const processedMeta = await sharp(processedBuffer).metadata();
    const qualityNotes = await analyzeImageQuality(processedBuffer);
    notes.push(...qualityNotes);

    if (PDF_MIME_TYPES.has(mime)) {
      notes.push({ code: "PDF_FIRST_PAGE", message: "The first PDF page was rasterized for OCR.", severity: "info" });
    }

    return {
      originalBuffer: inputBuffer,
      processedBuffer,
      processedMimeType: "image/jpeg",
      width: processedMeta.width ?? metadata.width ?? 0,
      height: processedMeta.height ?? metadata.height ?? 0,
      notes,
      warning: qualityNotes.some((note) => note.severity === "warning")
        ? "Some handwriting was unclear. Please review before publishing."
        : undefined,
    };
  } catch (error) {
    notes.push({
      code: "PREPROCESS_FAILED",
      message: error instanceof Error ? error.message : "Image preprocessing failed; original file was used.",
      severity: "warning",
    });
    return {
      originalBuffer: inputBuffer,
      processedBuffer: inputBuffer,
      processedMimeType: mimeType,
      width: 0,
      height: 0,
      notes,
      warning: "Some handwriting was unclear. Please review before publishing.",
    };
  }
}

async function analyzeImageQuality(buffer: Buffer): Promise<OcrQualityNote[]> {
  const notes: OcrQualityNote[] = [];
  try {
    const { data, info } = await sharp(buffer).grayscale().raw().toBuffer({ resolveWithObject: true });
    if (!info.width || !info.height || data.length === 0) return notes;

    let dark = 0;
    let sum = 0;
    let sumSq = 0;
    for (const value of data) {
      sum += value;
      sumSq += value * value;
      if (value < 120) dark++;
    }
    const pixels = data.length;
    const mean = sum / pixels;
    const variance = sumSq / pixels - mean * mean;
    const contrast = Math.sqrt(Math.max(0, variance));
    const inkRatio = dark / pixels;

    if (mean < 90) notes.push({ code: "LOW_LIGHT", message: "The upload appears dark; contrast was enhanced for OCR.", severity: "warning" });
    if (contrast < 28) notes.push({ code: "LOW_CONTRAST", message: "The upload has low contrast; OCR may need review.", severity: "warning" });
    if (inkRatio < 0.006) notes.push({ code: "FAINT_TEXT", message: "Very little readable ink/text was detected after preprocessing.", severity: "warning" });
    if (info.width < 900) notes.push({ code: "LOW_RESOLUTION", message: "The image is relatively small; a sharper photo may improve OCR.", severity: "warning" });
  } catch {
    notes.push({ code: "QUALITY_ANALYSIS_SKIPPED", message: "Image quality analysis could not be completed.", severity: "info" });
  }
  return notes;
}
