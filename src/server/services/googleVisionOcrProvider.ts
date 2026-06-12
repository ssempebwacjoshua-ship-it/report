import { existsSync } from "node:fs";
import type { OcrCropInput, OcrCropResult, OcrProvider } from "./ocrProvider";

/**
 * Google Cloud Vision OCR provider.
 *
 * Sends final mark-cell crop images (written / split-1 / split-2 / split-3)
 * to the Vision API and maps responses to the shared OcrCropResult shape.
 * It NEVER sees the whole marksheet page — crops only — and, like every
 * other provider, it only *suggests* marks. The operator workflow
 * (review, correction, dry-run, commit) is unchanged: OCR output cannot
 * commit marks.
 *
 * Auth: standard GOOGLE_APPLICATION_CREDENTIALS service-account JSON.
 * Feature: GOOGLE_VISION_FEATURE (default DOCUMENT_TEXT_DETECTION, which
 * handles handwriting much better than plain TEXT_DETECTION).
 */

const DEFAULT_FEATURE = "DOCUMENT_TEXT_DETECTION";
const NO_CONFIDENCE_DEFAULT = 0.75;
const MAX_IMAGES_PER_BATCH = 16; // Vision API batchAnnotateImages limit

export type GoogleVisionAnnotation = {
  text: string;
  confidence: number;
  /** "googlevision" when the API returned a usable confidence, otherwise the default was applied. */
  confidenceSource: "googlevision" | "googlevision/no-confidence";
  /** Compact raw summary, safe to surface in debug UI. */
  raw: Record<string, unknown>;
  error?: string;
};

// Minimal structural types for the parts of the Vision response we read.
type VisionWord = { confidence?: number | null; symbols?: Array<{ text?: string | null }> | null };
type VisionParagraph = { words?: VisionWord[] | null };
type VisionBlock = { paragraphs?: VisionParagraph[] | null; confidence?: number | null };
type VisionPage = { blocks?: VisionBlock[] | null; confidence?: number | null };
type VisionAnnotateResponse = {
  fullTextAnnotation?: { text?: string | null; pages?: VisionPage[] | null } | null;
  textAnnotations?: Array<{ description?: string | null }> | null;
  error?: { message?: string | null } | null;
};

export type VisionBatchFn = (
  requests: Array<{ image: { content: Buffer | string }; features: Array<{ type: string }> }>,
) => Promise<VisionAnnotateResponse[]>;

export function visionFeature(): string {
  const feature = (process.env.GOOGLE_VISION_FEATURE ?? "").trim().toUpperCase();
  return feature === "TEXT_DETECTION" || feature === "DOCUMENT_TEXT_DETECTION"
    ? feature
    : DEFAULT_FEATURE;
}

/** True when the service-account credentials file is configured and exists. */
export function hasGoogleVisionCredentials(): boolean {
  const path = (process.env.GOOGLE_APPLICATION_CREDENTIALS ?? "").trim();
  if (!path) return false;
  try {
    return existsSync(path);
  } catch {
    return false;
  }
}

let _batchFn: VisionBatchFn | null = null;

/**
 * Lazily create the real Vision client. Dynamic import so the app still
 * boots when @google-cloud/vision is not installed or creds are absent.
 */
async function getRealBatchFn(): Promise<VisionBatchFn> {
  if (_batchFn) return _batchFn;

  const { ImageAnnotatorClient } = await import("@google-cloud/vision");
  const client = new ImageAnnotatorClient();

  _batchFn = async (requests) => {
    const [batch] = await client.batchAnnotateImages({ requests });
    return (batch.responses ?? []) as VisionAnnotateResponse[];
  };
  return _batchFn;
}

/** Average word-level confidence from a DOCUMENT_TEXT_DETECTION response, if present. */
function extractConfidence(response: VisionAnnotateResponse): number | null {
  const pages = response.fullTextAnnotation?.pages ?? [];
  const values: number[] = [];
  for (const page of pages) {
    for (const block of page.blocks ?? []) {
      for (const paragraph of block.paragraphs ?? []) {
        for (const word of paragraph.words ?? []) {
          if (typeof word.confidence === "number" && word.confidence > 0) {
            values.push(word.confidence);
          }
        }
      }
      if (values.length === 0 && typeof block.confidence === "number" && block.confidence > 0) {
        values.push(block.confidence);
      }
    }
    if (values.length === 0 && typeof page.confidence === "number" && page.confidence > 0) {
      values.push(page.confidence);
    }
  }
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export function normalizeVisionResponse(response: VisionAnnotateResponse): GoogleVisionAnnotation {
  if (response.error?.message) {
    return {
      text: "",
      confidence: 0,
      confidenceSource: "googlevision/no-confidence",
      raw: { error: response.error.message },
      error: response.error.message,
    };
  }

  const fullText = response.fullTextAnnotation?.text ?? "";
  const fallbackText = response.textAnnotations?.[0]?.description ?? "";
  // Crops are single marks — collapse whitespace/newlines Vision adds.
  const text = (fullText || fallbackText).replace(/\s+/g, " ").trim();

  const apiConfidence = extractConfidence(response);
  const confidence = apiConfidence ?? (text ? NO_CONFIDENCE_DEFAULT : 0);

  return {
    text,
    confidence,
    confidenceSource: apiConfidence !== null ? "googlevision" : "googlevision/no-confidence",
    raw: {
      text,
      apiConfidence,
      hasFullTextAnnotation: Boolean(response.fullTextAnnotation),
      textAnnotationCount: response.textAnnotations?.length ?? 0,
    },
  };
}

/**
 * Annotate a single crop buffer. Exposed for the direct test script
 * (scripts/test-google-vision-crop.ts) so it can print raw summaries.
 */
export async function annotateCropBuffer(
  buffer: Buffer,
  batchFn?: VisionBatchFn,
): Promise<GoogleVisionAnnotation> {
  try {
    const annotate = batchFn ?? (await getRealBatchFn());
    const responses = await annotate([
      { image: { content: buffer }, features: [{ type: visionFeature() }] },
    ]);
    const response = responses[0];
    if (!response) {
      return {
        text: "",
        confidence: 0,
        confidenceSource: "googlevision/no-confidence",
        raw: {},
        error: "Empty response from Vision API",
      };
    }
    return normalizeVisionResponse(response);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Google Vision request failed";
    return {
      text: "",
      confidence: 0,
      confidenceSource: "googlevision/no-confidence",
      raw: { error: message },
      error: message,
    };
  }
}

async function recognizeCrops(crops: OcrCropInput[], batchFn?: VisionBatchFn): Promise<OcrCropResult[]> {
  if (crops.length === 0) return [];

  let annotate: VisionBatchFn;
  try {
    annotate = batchFn ?? (await getRealBatchFn());
  } catch (err) {
    // Client init failed (missing package / bad creds): fail safe with empty
    // suggestions — the operator workflow handles entry. Never throw.
    console.error(
      "[googlevision] client initialisation failed:",
      err instanceof Error ? err.message : err,
    );
    return crops.map((crop) => ({ cropId: crop.cropId, text: "", confidence: 0 }));
  }

  const results: OcrCropResult[] = [];
  for (let start = 0; start < crops.length; start += MAX_IMAGES_PER_BATCH) {
    const chunk = crops.slice(start, start + MAX_IMAGES_PER_BATCH);
    try {
      const responses = await annotate(
        chunk.map((crop) => ({
          image: { content: crop.buffer },
          features: [{ type: visionFeature() }],
        })),
      );
      chunk.forEach((crop, index) => {
        const response = responses[index];
        const annotation = response
          ? normalizeVisionResponse(response)
          : { text: "", confidence: 0 };
        results.push({ cropId: crop.cropId, text: annotation.text, confidence: annotation.confidence });
      });
    } catch (err) {
      console.error(
        "[googlevision] batch annotate failed:",
        err instanceof Error ? err.message : err,
      );
      for (const crop of chunk) {
        results.push({ cropId: crop.cropId, text: "", confidence: 0 });
      }
    }
  }
  return results;
}

/**
 * Create the Google Vision OCR provider.
 *
 * @param deps.batchAnnotate test seam — inject a fake Vision call so unit
 *   tests never hit the network.
 */
export function createGoogleVisionOcrProvider(deps?: { batchAnnotate?: VisionBatchFn }): OcrProvider {
  return {
    name: "googlevision",
    // Healthy only when credentials are present; the resolver surfaces a
    // clear "credentials missing" reason instead of silently falling back.
    healthCheck: async () => hasGoogleVisionCredentials(),
    recognizeCrops: (crops) => recognizeCrops(crops, deps?.batchAnnotate),
  };
}
