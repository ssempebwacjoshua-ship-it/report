import type { OcrCropInput, OcrCropResult, OcrProvider } from "./ocrProvider";

/**
 * Amazon Textract OCR provider.
 *
 * Uses the synchronous DetectDocumentText API on raw crop image bytes —
 * no S3 bucket, no async jobs, no AnalyzeDocument. Only final mark-cell
 * crops (written / split-full / split zones 1-3) are sent, never the whole
 * marksheet page. Like every other provider it only *suggests* marks; the
 * operator review / correction / dry-run / commit workflow is unchanged
 * and OCR output can never auto-commit.
 *
 * Auth: standard AWS env credentials.
 *   AWS_REGION (default eu-west-1 — closest well-supported Textract region)
 *   AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY
 */

const DEFAULT_REGION = "eu-west-1";

export type TextractAnnotation = {
  text: string;
  confidence: number;
  /** "textract" when API confidence present, otherwise default applied. */
  confidenceSource: "textract" | "textract/no-confidence";
  /** Compact raw summary, safe to surface in debug UI. */
  raw: Record<string, unknown>;
  error?: string;
};

// Minimal structural types for the parts of the Textract response we read.
type TextractBlock = {
  BlockType?: string;
  Text?: string;
  Confidence?: number;
};
export type TextractResponse = { Blocks?: TextractBlock[] };

/** Test seam: a function that runs DetectDocumentText on one image buffer. */
export type TextractDetectFn = (imageBytes: Buffer) => Promise<TextractResponse>;

export function textractRegion(): string {
  return (process.env.AWS_REGION ?? "").trim() || DEFAULT_REGION;
}

/** True when AWS credentials are configured via environment variables. */
export function hasTextractCredentials(): boolean {
  return Boolean(
    (process.env.AWS_ACCESS_KEY_ID ?? "").trim() &&
      (process.env.AWS_SECRET_ACCESS_KEY ?? "").trim(),
  );
}

let _detectFn: TextractDetectFn | null = null;

/**
 * Lazily create the real Textract client. Dynamic import so the app still
 * boots when @aws-sdk/client-textract is not installed or creds are absent.
 */
async function getRealDetectFn(): Promise<TextractDetectFn> {
  if (_detectFn) return _detectFn;

  const { TextractClient, DetectDocumentTextCommand } = await import("@aws-sdk/client-textract");
  const client = new TextractClient({ region: textractRegion() });

  _detectFn = async (imageBytes: Buffer) => {
    const output = await client.send(
      new DetectDocumentTextCommand({ Document: { Bytes: imageBytes } }),
    );
    return { Blocks: (output.Blocks ?? []) as TextractBlock[] };
  };
  return _detectFn;
}

export function normalizeTextractResponse(response: TextractResponse): TextractAnnotation {
  const lines = (response.Blocks ?? []).filter(
    (block) => block.BlockType === "LINE" && typeof block.Text === "string" && block.Text.trim(),
  );

  // Crops contain a single mark — join lines and collapse whitespace.
  const text = lines
    .map((line) => line.Text as string)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

  const confidences = lines
    .map((line) => line.Confidence)
    .filter((value): value is number => typeof value === "number" && value > 0);

  // Textract confidences are 0-100; normalize to 0-1 like other providers.
  const apiConfidence =
    confidences.length > 0
      ? Math.round((confidences.reduce((a, b) => a + b, 0) / confidences.length / 100) * 10000) / 10000
      : null;

  return {
    text,
    confidence: apiConfidence ?? (text ? 0.75 : 0),
    confidenceSource: apiConfidence !== null ? "textract" : "textract/no-confidence",
    raw: {
      text,
      apiConfidence,
      lineCount: lines.length,
      blockCount: response.Blocks?.length ?? 0,
    },
  };
}

/**
 * Annotate a single crop buffer. Exposed for the direct test script
 * (scripts/test-textract-crop.ts) so it can print raw summaries.
 */
export async function detectCropText(
  buffer: Buffer,
  detectFn?: TextractDetectFn,
): Promise<TextractAnnotation> {
  try {
    const detect = detectFn ?? (await getRealDetectFn());
    const response = await detect(buffer);
    return normalizeTextractResponse(response);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Textract request failed";
    return {
      text: "",
      confidence: 0,
      confidenceSource: "textract/no-confidence",
      raw: { error: message, region: textractRegion() },
      error: message,
    };
  }
}

async function recognizeCrops(
  crops: OcrCropInput[],
  detectFn?: TextractDetectFn,
): Promise<OcrCropResult[]> {
  if (crops.length === 0) return [];

  let detect: TextractDetectFn;
  try {
    detect = detectFn ?? (await getRealDetectFn());
  } catch (err) {
    // Client init failed (missing package / bad creds / bad region):
    // fail safe with empty suggestions — operator entry still works.
    console.error(
      "[textract] client initialisation failed:",
      err instanceof Error ? err.message : err,
    );
    return crops.map((crop) => ({ cropId: crop.cropId, text: "", confidence: 0 }));
  }

  // DetectDocumentText is a single-image API — call per crop, sequentially,
  // so a handful of mark crops stays well inside the default rate limits.
  const results: OcrCropResult[] = [];
  for (const crop of crops) {
    try {
      const response = await detect(crop.buffer);
      const annotation = normalizeTextractResponse(response);
      results.push({ cropId: crop.cropId, text: annotation.text, confidence: annotation.confidence });
    } catch (err) {
      console.error(
        "[textract] DetectDocumentText failed:",
        err instanceof Error ? err.message : err,
      );
      results.push({ cropId: crop.cropId, text: "", confidence: 0 });
    }
  }
  return results;
}

/**
 * Create the Amazon Textract OCR provider.
 *
 * @param deps.detectText test seam — inject a fake DetectDocumentText call
 *   so unit tests never hit the network.
 */
export function createTextractOcrProvider(deps?: { detectText?: TextractDetectFn }): OcrProvider {
  return {
    name: "textract",
    // Healthy only when credentials are present; the resolver surfaces a
    // clear "credentials missing" reason instead of silently falling back.
    healthCheck: async () => hasTextractCredentials(),
    recognizeCrops: (crops) => recognizeCrops(crops, deps?.detectText),
  };
}
