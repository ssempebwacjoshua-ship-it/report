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
  sectionBuffers?: Array<{ label: string; buffer: Buffer; mimeType: string }>;
};

export type DocumentOcrPreprocessMode = "fast" | "high_accuracy";

const IMAGE_MIME_RE = /^image\/(png|jpe?g|webp|tiff?|bmp|gif)$/i;
const PDF_MIME_TYPES = new Set(["application/pdf", "image/pdf"]);

export async function preprocessDocumentForOcr(
  inputBuffer: Buffer,
  mimeType: string,
  mode: DocumentOcrPreprocessMode = "fast",
): Promise<DocumentOcrPreprocessResult> {
  const mime = mimeType.toLowerCase().trim();
  const isPdf = PDF_MIME_TYPES.has(mime);
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

  if (isPdf) {
    notes.push({ code: "PDF_FIRST_PAGE", message: "Only the first PDF page is being read for OCR right now.", severity: "warning" });
  }

  try {
    const pipeline = PDF_MIME_TYPES.has(mime)
      ? sharp(inputBuffer, { page: 0, density: 180 })
      : sharp(inputBuffer, { failOn: "none" });

    const metadata = await pipeline.metadata();
    if (metadata.orientation && metadata.orientation !== 1) {
      notes.push({ code: "ORIENTATION_CORRECTED", message: "Image orientation metadata was corrected before OCR.", severity: "info" });
    }

    const normalized = mode === "high_accuracy"
      ? pipeline
          .rotate()
          .trim({ background: "#ffffff", threshold: 12 })
          .resize({ width: 2800, height: 2800, fit: "inside", withoutEnlargement: true })
          .flatten({ background: "#ffffff" })
          .grayscale()
          .normalize()
          .median(2)
          .sharpen({ sigma: 1.4 })
          .modulate({ brightness: 1.08, saturation: 0.92, lightness: 1.03 })
          .linear(1.18, -18)
          .jpeg({ quality: 92, mozjpeg: true })
      : pipeline
          .rotate()
          .resize({ width: 1800, height: 1800, fit: "inside", withoutEnlargement: true })
          .flatten({ background: "#ffffff" })
          .grayscale()
          .normalize()
          .sharpen({ sigma: 0.9 })
          .jpeg({ quality: 84, mozjpeg: true });

    const processedBuffer = await normalized.toBuffer();
    const processedMeta = await sharp(processedBuffer).metadata();
    const qualityNotes = await analyzeImageQuality(processedBuffer);
    notes.push(...qualityNotes);

    const sectionBuffers = mode === "high_accuracy"
      ? await buildSectionBuffers(processedBuffer, notes)
      : undefined;
    if (mode === "high_accuracy") {
      notes.push({ code: "HIGH_ACCURACY_PREPROCESS", message: "Image was enhanced and split into sections for higher-accuracy OCR.", severity: "info" });
    }

    return {
      originalBuffer: inputBuffer,
      processedBuffer,
      processedMimeType: "image/jpeg",
      width: processedMeta.width ?? metadata.width ?? 0,
      height: processedMeta.height ?? metadata.height ?? 0,
      notes,
      warning: isPdf
        ? "Only the first PDF page is being read for OCR right now. Please review the result before publishing."
        : qualityNotes.some((note) => note.severity === "warning")
          ? "Some handwriting was unclear. Please review before publishing."
          : undefined,
      sectionBuffers,
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
      warning: isPdf
        ? "Only the first PDF page is being read for OCR right now. Please review the result before publishing."
        : "Some handwriting was unclear. Please review before publishing.",
    };
  }
}

async function buildSectionBuffers(buffer: Buffer, notes: OcrQualityNote[]): Promise<Array<{ label: string; buffer: Buffer; mimeType: string }> | undefined> {
  try {
    const image = sharp(buffer);
    const metadata = await image.metadata();
    const width = metadata.width ?? 0;
    const height = metadata.height ?? 0;
    if (!width || !height || height < 900) return undefined;
    const sliceHeight = Math.max(1, Math.floor(height / 3));
    const bands = [
      { label: "top", top: 0, height: Math.min(sliceHeight + 40, height) },
      { label: "middle", top: Math.max(0, Math.floor((height - sliceHeight) / 2)), height: Math.min(sliceHeight + 40, height) },
      { label: "bottom", top: Math.max(0, height - sliceHeight - 20), height: Math.min(sliceHeight + 40, height) },
    ];
    const slices = [];
    for (const band of bands) {
      const safeTop = Math.min(Math.max(0, band.top), Math.max(0, height - 1));
      const safeHeight = Math.max(1, Math.min(band.height, height - safeTop));
      const slice = await image.clone().extract({ left: 0, top: safeTop, width, height: safeHeight }).jpeg({ quality: 92, mozjpeg: true }).toBuffer();
      slices.push({ label: band.label, buffer: slice, mimeType: "image/jpeg" });
    }
    notes.push({ code: "PAGE_SPLIT", message: "Page was split into sections for a higher-accuracy OCR pass.", severity: "info" });
    return slices;
  } catch {
    return undefined;
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

