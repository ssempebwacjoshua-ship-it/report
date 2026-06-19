import { GoogleGenAI, Type } from "@google/genai";

// Lazy singleton ? not constructed until first API call.
let aiInstance: GoogleGenAI | null = null;

function getGeminiClient(): GoogleGenAI {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("Missing GEMINI_API_KEY");
  }
  if (!aiInstance) {
    aiInstance = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
  return aiInstance;
}

export interface GeminiExtractedMarkRow {
  studentId: string;
  studentName: string;
  mark: string;
  confidenceScore: number;
  needsReview: boolean;
  reason?: string;
}

export interface MarksheetValidationSummary {
  totalRows: number;
  validRows: number;
  reviewRows: number;
  missingMarkRows: number;
  invalidMarkRows: number;
}

export function resolveGeminiOcrModel(): string {
  return (
    process.env.SMART_PAGES_GEMINI_FAST_MODEL?.trim() ||
    process.env.GEMINI_MODEL?.trim() ||
    "gemini-3.5-flash"
  );
}

export function resolveGeminiOcrHighAccuracyModel(): { primary: string; stable: string } {
  return {
    primary: process.env.SMART_PAGES_GEMINI_HIGH_ACCURACY_MODEL?.trim() || resolveGeminiOcrModel(),
    stable: process.env.SMART_PAGES_GEMINI_STABLE_ACCURACY_MODEL?.trim() || "gemini-2.5-flash",
  };
}

export function resolveGeminiHealthModel(): string {
  return (
    process.env.SMART_PAGES_GEMINI_FAST_MODEL?.trim() ||
    process.env.GEMINI_MODEL?.trim() ||
    "gemini-3.5-flash"
  );
}

export interface ExtractionMeta {
  requestedModel: string;
  attemptedModels: string[];
  selectedModel: string;
  fallbackUsed: boolean;
  fallbackReason?: string;
  extractionTimeMs: number;
  highAccuracy: boolean;
}

const FALLBACK_ELIGIBLE_RE =
  /429|quota|resource_exhausted|timed out|etimedout|unavailable|503|model not found|not_found|model_not_found|404|internal server error|500/i;

function isFallbackEligible(err: unknown): boolean {
  if (!(err instanceof Error)) return true;
  const msg = err.message + " " + String((err as NodeJS.ErrnoException).cause ?? "");
  return FALLBACK_ELIGIBLE_RE.test(msg);
}

function getFallbackReason(err: unknown): string {
  if (!(err instanceof Error)) return "Unknown error";
  const msg = err.message;
  if (/429|quota|resource_exhausted/i.test(msg)) return "Quota exceeded (429)";
  if (/timed out|etimedout/i.test(msg)) return "Request timed out";
  if (/503|unavailable/i.test(msg)) return "Service unavailable (503)";
  if (/model not found|not_found|404/i.test(msg)) return "Model unavailable (404)";
  if (/500|internal/i.test(msg)) return "Provider error (500)";
  return msg.slice(0, 120);
}

/**
 * Deterministic validation pass applied after Gemini returns rows.
 * Gemini's confidenceScore and needsReview are NOT trusted for mark validity ?
 * we check the mark field ourselves and override when necessary.
 *
 * Rules:
 *  - trimmed empty   ? needsReview true, reason "Missing mark",        confidenceScore 0
 *  - non-numeric     ? needsReview true, reason "Invalid mark",         confidenceScore 0
 *  - < 0 or > 100   ? needsReview true, reason "Mark outside valid range", confidenceScore 0
 *  - valid mark      ? preserve Gemini's needsReview and reason as-is
 *
 * Exported for direct unit testing.
 */
export function validateMarksheetRows(rows: GeminiExtractedMarkRow[]): {
  rows: GeminiExtractedMarkRow[];
  summary: MarksheetValidationSummary;
} {
  let missingMarkRows = 0;
  let invalidMarkRows = 0;

  const validated = rows.map((row): GeminiExtractedMarkRow => {
    const mark = row.mark.trim();

    if (mark === "") {
      missingMarkRows++;
      return { ...row, mark, needsReview: true, reason: "Missing mark", confidenceScore: 0 };
    }

    const num = Number(mark);
    if (isNaN(num)) {
      invalidMarkRows++;
      return { ...row, mark, needsReview: true, reason: "Invalid mark", confidenceScore: 0 };
    }

    if (num < 0 || num > 100) {
      invalidMarkRows++;
      return {
        ...row, mark, needsReview: true, reason: "Mark outside valid range", confidenceScore: 0,
      };
    }

    // Mark is valid ? preserve Gemini's judgment (including any existing needsReview: true)
    return { ...row, mark };
  });

  const reviewRows = validated.filter((r) => r.needsReview).length;

  return {
    rows: validated,
    summary: {
      totalRows: validated.length,
      validRows: validated.length - reviewRows,
      reviewRows,
      missingMarkRows,
      invalidMarkRows,
    },
  };
}

// ── Retry logic for transient network errors ─────────────────────────────────

const RETRYABLE_RE = /fetch failed|ECONNRESET|ENOTFOUND|ETIMEDOUT|UNAVAILABLE|503/i;

function isRetryable(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const cause = String((err as NodeJS.ErrnoException).cause ?? "");
  return RETRYABLE_RE.test(err.message) || RETRYABLE_RE.test(cause);
}

const RETRY_DELAYS_MS = [0, 800, 1600];

async function withGeminiRetry<T>(fn: () => Promise<T>): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < RETRY_DELAYS_MS.length; i++) {
    if (i > 0) await new Promise((r) => setTimeout(r, RETRY_DELAYS_MS[i]));
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (!isRetryable(err)) throw err;
      console.warn("[gemini-ocr] transient error, will retry", {
        attempt: i + 1,
        max: RETRY_DELAYS_MS.length,
        message: err instanceof Error ? err.message : String(err),
        cause: err instanceof Error ? (err as NodeJS.ErrnoException).cause : undefined,
      });
    }
  }
  throw lastErr;
}

// ── Public API ────────────────────────────────────────────────────────────────

async function callGeminiMarksExtract(
  model: string,
  imageBuffer: Buffer,
  mimeType: string,
): Promise<Awaited<ReturnType<GoogleGenAI["models"]["generateContent"]>>> {
  return withGeminiRetry(() =>
    getGeminiClient().models.generateContent({
      model,
      contents: [
        { inlineData: { data: imageBuffer.toString("base64"), mimeType } },
        {
          text: `
You are reading a school document image.

First, determine if this is a student marksheet: a table containing student IDs (admission numbers),
student names, and numeric scores or marks.

- If this document is a teacher roster, timetable, attendance sheet, or anything other than a
  student marksheet, return documentType "not_marksheet" and an empty rows array.

- If it IS a student marksheet, return documentType "marksheet" and extract each row:
  - studentId: student admission number or ID exactly as written
  - studentName: full name exactly as written
  - mark: numeric score from the marks/score column ONLY — use empty string if the cell is blank
  - confidenceScore: 0 to 1
  - needsReview: true if name, ID, or mark is unclear or missing
  - reason: short explanation when needsReview is true

IMPORTANT: "A' Level" and "O' Level" are education levels, not marks. Do not put them in mark.
If a mark cell is blank or unreadable, set mark to "" and needsReview to true.
          `,
        },
      ],
      config: {
        temperature: 0,
        responseMimeType: "application/json",
        mediaResolution: "MEDIA_RESOLUTION_HIGH",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            documentType: {
              type: Type.STRING,
              description: "Either 'marksheet' or 'not_marksheet'",
            },
            rows: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  studentId: { type: Type.STRING },
                  studentName: { type: Type.STRING },
                  mark: { type: Type.STRING },
                  confidenceScore: { type: Type.NUMBER },
                  needsReview: { type: Type.BOOLEAN },
                  reason: { type: Type.STRING },
                },
                required: ["studentId", "studentName", "mark", "confidenceScore", "needsReview"],
              },
            },
          },
          required: ["documentType", "rows"],
        },
      } as any,
    }),
  );
}

export async function extractMarksWithGemini(
  imageBuffer: Buffer,
  mimeType = "image/jpeg",
  options: { highAccuracy?: boolean; modelOverride?: string } = {},
): Promise<{ rows: GeminiExtractedMarkRow[]; summary: MarksheetValidationSummary; meta: ExtractionMeta }> {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("Missing GEMINI_API_KEY");
  }

  const { primary: primaryModel, stable: stableModel } = resolveGeminiOcrHighAccuracyModel();
  const fastModel = resolveGeminiOcrModel();

  const requestedModel = options.modelOverride?.trim()
    || (options.highAccuracy ? primaryModel : fastModel);
  let selectedModel = requestedModel;
  const attemptedModels: string[] = [];
  let fallbackUsed = false;
  let fallbackReason: string | undefined;
  const startMs = Date.now();

  let response: Awaited<ReturnType<GoogleGenAI["models"]["generateContent"]>>;
  try {
    attemptedModels.push(requestedModel);
    try {
      response = await callGeminiMarksExtract(requestedModel, imageBuffer, mimeType);
    } catch (primaryErr) {
      const eligible = !options.modelOverride && isFallbackEligible(primaryErr) && requestedModel !== stableModel;
      if (eligible) {
        fallbackReason = getFallbackReason(primaryErr);
        console.warn("[gemini-ocr] primary model failed, falling back to stable", {
          requestedModel,
          stableModel,
          reason: fallbackReason,
          error: primaryErr instanceof Error ? primaryErr.message : String(primaryErr),
        });
        fallbackUsed = true;
        selectedModel = stableModel;
        attemptedModels.push(stableModel);
        response = await callGeminiMarksExtract(stableModel, imageBuffer, mimeType);
      } else {
        throw primaryErr;
      }
    }
  } catch (error: unknown) {
    console.error("[gemini-ocr] Gemini call failed", {
      requestedModel,
      selectedModel,
      attemptedModels,
      mimeType,
      imageSizeKb: Math.round(imageBuffer.byteLength / 1024),
      durationMs: Date.now() - startMs,
      errorName: error instanceof Error ? error.name : "Unknown",
      errorMessage: error instanceof Error ? error.message : String(error),
      errorCause: error instanceof Error ? (error as NodeJS.ErrnoException).cause : undefined,
    });
    throw error;
  }

  const text = response.text;
  if (!text) throw new Error("Gemini returned empty response");

  let parsed: { documentType?: string; rows?: GeminiExtractedMarkRow[] };
  try {
    parsed = JSON.parse(text) as typeof parsed;
  } catch {
    throw new Error("Gemini returned invalid JSON");
  }

  if (parsed.documentType !== "marksheet") {
    throw new Error("Uploaded document does not look like a marksheet.");
  }

  if (!Array.isArray(parsed.rows)) {
    throw new Error("Gemini response missing rows array");
  }

  const { rows, summary } = validateMarksheetRows(parsed.rows);
  return {
    rows,
    summary,
    meta: {
      requestedModel,
      attemptedModels,
      selectedModel,
      fallbackUsed,
      fallbackReason,
      extractionTimeMs: Date.now() - startMs,
      highAccuracy: Boolean(options.highAccuracy),
    } satisfies ExtractionMeta,
  };
}

/** Sends a tiny text-only ping to Gemini. Throws on network or auth failure. */
export async function pingGemini(): Promise<{ model: string }> {
  const model = resolveGeminiHealthModel();
  await withGeminiRetry(() =>
    getGeminiClient().models.generateContent({
      model,
      contents: [{ text: "Reply with one word: ok" }],
      config: { temperature: 0 },
    }),
  );
  return { model };
}

