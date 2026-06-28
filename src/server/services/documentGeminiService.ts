import { GoogleGenAI } from "@google/genai";
import type {
  DocumentSchema,
  ComponentNode,
  ExtractedKnowledge,
  HandwritingDifficulty,
  ExtractionRecommendation,
} from "../../shared/types/documentIntelligence";
import type { AiEditResponse } from "../../shared/documentPatch";

let _client: GoogleGenAI | null = null;

function getClient(): GoogleGenAI {
  if (!process.env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is not configured.");
  if (!_client) _client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  return _client;
}

export function resolveGeminiDocumentModel(): string {
  return (
    process.env.SMART_PAGES_GEMINI_FAST_MODEL?.trim() ||
    process.env.GEMINI_MODEL?.trim() ||
    "gemini-2.5-flash"
  );
}

export function resolveGeminiHighAccuracyDocumentModel(): { primary: string; stable: string } {
  const fast = resolveGeminiDocumentModel();
  return {
    primary: process.env.SMART_PAGES_GEMINI_HIGH_ACCURACY_MODEL?.trim() || fast,
    stable: process.env.SMART_PAGES_GEMINI_STABLE_ACCURACY_MODEL?.trim() || "gemini-2.5-flash",
  };
}

function model() {
  return resolveGeminiDocumentModel();
}

export interface DocExtractionMeta {
  requestedModel: string;
  attemptedModels: string[];
  selectedModel: string;
  retryCount: number;
  fallbackUsed: boolean;
  fallbackReason?: string;
  providerErrorCode?: string;
  tokenUsage?: Record<string, unknown> | null;
  extractionTimeMs: number;
  highAccuracy: boolean;
  mediaResolution?: string;
  attemptTimeoutMs?: number;
  retryDelaysMs?: number[];
  fallbackMs?: number;
}

const DOC_FALLBACK_RE =
  /429|quota|resource_exhausted|timed out|etimedout|unavailable|503|model overloaded|overloaded|high traffic|model not found|not_found|model_not_found|404|internal server error|500/i;
const DOC_RETRYABLE_RE =
  /fetch failed|ECONNRESET|ENOTFOUND|ETIMEDOUT|timed out|unavailable|503|model overloaded|overloaded|high traffic/i;
const FAST_DOC_RETRY_DELAYS_MS = [250, 1_000, 2_000];
const HIGH_ACCURACY_DOC_RETRY_DELAYS_MS = [1_000, 2_000, 4_000];
const FAST_GEMINI_ATTEMPT_TIMEOUT_MS = 30_000;
const HIGH_ACCURACY_GEMINI_ATTEMPT_TIMEOUT_MS = 60_000;

function isDocFallbackEligible(err: unknown): boolean {
  if (!(err instanceof Error)) return true;
  const msg = err.message + " " + String((err as NodeJS.ErrnoException).cause ?? "");
  return DOC_FALLBACK_RE.test(msg);
}

function getDocFallbackReason(err: unknown): string {
  if (!(err instanceof Error)) return "Unknown error";
  const msg = err.message;
  if (/429|quota|resource_exhausted/i.test(msg)) return "Quota exceeded (429)";
  if (/timed out|etimedout/i.test(msg)) return "Request timed out";
  if (/model overloaded|overloaded|high traffic/i.test(msg)) return "Model overloaded";
  if (/503|unavailable/i.test(msg)) return "Service unavailable (503)";
  if (/model not found|not_found|404/i.test(msg)) return "Model unavailable (404)";
  if (/500|internal/i.test(msg)) return "Provider error (500)";
  return msg.slice(0, 120);
}

function providerErrorCode(err: unknown): string | undefined {
  if (!(err instanceof Error)) return undefined;
  const anyErr = err as Error & { status?: unknown; code?: unknown; retryCount?: unknown; providerErrorCode?: unknown };
  if (typeof anyErr.providerErrorCode === "string") return anyErr.providerErrorCode;
  if (typeof anyErr.status === "number") return String(anyErr.status);
  if (typeof anyErr.code === "string") return anyErr.code;
  const msg = `${err.message} ${String((err as NodeJS.ErrnoException).cause ?? "")}`;
  if (/resource_exhausted|quota|429/i.test(msg)) return "RESOURCE_EXHAUSTED";
  if (/model overloaded|overloaded|high traffic/i.test(msg)) return "MODEL_OVERLOADED";
  if (/unavailable/i.test(msg)) return "UNAVAILABLE";
  if (/503/i.test(msg)) return "503";
  if (/timed out|etimedout/i.test(msg)) return "TIMEOUT";
  if (/not_found|model not found|404/i.test(msg)) return "404";
  if (/internal server error|500/i.test(msg)) return "500";
  return undefined;
}

function errorRetryCount(err: unknown): number {
  if (!(err instanceof Error)) return 0;
  const value = (err as Error & { retryCount?: unknown }).retryCount;
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function isDocRetryable(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = `${err.message} ${String((err as NodeJS.ErrnoException).cause ?? "")}`;
  return DOC_RETRYABLE_RE.test(msg);
}

function resolveGeminiAttemptTimeoutMs(highAccuracy: boolean): number {
  const fallback = highAccuracy ? HIGH_ACCURACY_GEMINI_ATTEMPT_TIMEOUT_MS : FAST_GEMINI_ATTEMPT_TIMEOUT_MS;
  const configured = Number(
    highAccuracy
      ? process.env.SMART_PAGES_GEMINI_HIGH_ACCURACY_TIMEOUT_MS ?? process.env.GEMINI_TIMEOUT_MS ?? fallback
      : process.env.SMART_PAGES_GEMINI_FAST_TIMEOUT_MS ?? process.env.GEMINI_TIMEOUT_MS ?? fallback,
  );
  if (!Number.isFinite(configured) || configured <= 0) return fallback;
  return configured;
}

function resolveGeminiRetryDelaysMs(highAccuracy: boolean): number[] {
  if (highAccuracy) return HIGH_ACCURACY_DOC_RETRY_DELAYS_MS;
  const configured = Number(process.env.SMART_PAGES_GEMINI_MAX_RETRIES ?? 1);
  const maxRetries = Number.isFinite(configured) && configured >= 0 ? Math.floor(configured) : 1;
  return FAST_DOC_RETRY_DELAYS_MS.slice(0, maxRetries);
}

function resolveGeminiMediaResolution(highAccuracy: boolean): string {
  return highAccuracy ? "MEDIA_RESOLUTION_HIGH" : "MEDIA_RESOLUTION_MEDIUM";
}

function jitterMs(): number {
  return Math.floor(Math.random() * 250);
}

async function delay(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function generateContentWithRetryResult(
  request: Parameters<GoogleGenAI["models"]["generateContent"]>[0],
  timeoutMs: number,
  retryDelaysMs: number[],
) {
  let lastError: unknown;
  let retryCount = 0;
  for (let attempt = 0; attempt <= retryDelaysMs.length; attempt++) {
    try {
      const response = await withTimeout(getClient().models.generateContent(request), timeoutMs);
      return {
        response,
        retryCount,
        providerErrorCode: providerErrorCode(lastError),
        tokenUsage: extractGeminiTokenUsage(response),
      };
    } catch (error) {
      lastError = error;
      if (!isDocRetryable(error) || attempt >= retryDelaysMs.length) break;
      const delayMs = retryDelaysMs[attempt] + jitterMs();
      retryCount++;
      console.warn("[document-gemini] transient error, will retry", {
        model: request.model,
        attempt: attempt + 1,
        maxRetries: retryDelaysMs.length,
        delayMs,
        providerErrorCode: providerErrorCode(error),
        message: error instanceof Error ? error.message : String(error),
      });
      await delay(delayMs);
    }
  }
  const error = lastError instanceof Error
    ? lastError
    : new Error("Gemini request failed. Please retry.");
  Object.assign(error, {
    retryCount,
    providerErrorCode: providerErrorCode(error),
  });
  throw error;
}

function extractGeminiTokenUsage(response: unknown): Record<string, unknown> | null {
  if (!response || typeof response !== "object") return null;
  const usage = (response as { usageMetadata?: unknown }).usageMetadata;
  return usage && typeof usage === "object" ? usage as Record<string, unknown> : null;
}

async function generateContentWithRetry(request: Parameters<GoogleGenAI["models"]["generateContent"]>[0]) {
  const { response } = await generateContentWithRetryResult(request, FAST_GEMINI_ATTEMPT_TIMEOUT_MS, FAST_DOC_RETRY_DELAYS_MS);
  return response;
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("Gemini request timed out. Please retry.")), timeoutMs);
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}
function stripFences(text: string): string {
  return text.trim().replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();
}

function safePreview(text: string, limit = 240): string {
  return text.replace(/\s+/g, " ").slice(0, limit);
}

function logExtractionResponseIssue(reason: string, text: string, modelName: string) {
  console.warn("[document-gemini] extraction response issue", {
    reason,
    model: modelName,
    responseLength: text.length,
    responsePreview: safePreview(text),
  });
}

function parseJsonSafe<T>(text: string, fallback: T, modelName?: string): T {
  const stripped = stripFences(text);
  if (!stripped) {
    if (modelName) logExtractionResponseIssue("empty-response", text, modelName);
    return fallback;
  }

  try {
    return JSON.parse(stripped) as T;
  } catch {
    const start = stripped.indexOf("{");
    const end = stripped.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(stripped.slice(start, end + 1)) as T;
      } catch {
        /* fall through */
      }
    }
    if (modelName) logExtractionResponseIssue("invalid-json", text, modelName);
    return fallback;
  }
}

function buildExtractionConfig(mediaResolution: string) {
  return {
    temperature: 0,
    responseMimeType: "application/json",
    mediaResolution,
  } as any;
}

const LAWYER_EDIT_RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    summary: { type: "string" },
    operations: {
      type: "array",
      items: {
        oneOf: [
          {
            type: "object",
            properties: {
              type: { const: "replace_text" },
              oldText: { type: "string" },
              newText: { type: "string" },
              reason: { type: "string" },
            },
            required: ["type", "oldText", "newText"],
            additionalProperties: false,
          },
          {
            type: "object",
            properties: {
              type: { const: "insert_after" },
              anchorText: { type: "string" },
              insertText: { type: "string" },
              reason: { type: "string" },
            },
            required: ["type", "anchorText", "insertText"],
            additionalProperties: false,
          },
          {
            type: "object",
            properties: {
              type: { const: "append_section" },
              heading: { type: "string" },
              body: { type: "string" },
              reason: { type: "string" },
            },
            required: ["type", "heading", "body"],
            additionalProperties: false,
          },
          {
            type: "object",
            properties: {
              type: { const: "replace_section" },
              heading: { type: "string" },
              newBody: { type: "string" },
              reason: { type: "string" },
            },
            required: ["type", "heading", "newBody"],
            additionalProperties: false,
          },
        ],
      },
    },
    warnings: { type: "array", items: { type: "string" } },
  },
  required: ["summary", "operations"],
  additionalProperties: false,
};

function buildExtractionFallback(text: string, originalName: string, highAccuracy: boolean): ExtractedKnowledge {
  return {
    documentType: "document",
    domain: "general",
    title: originalName.replace(/\.[^.]+$/, ""),
    suggestedDocumentType: "document",
    sections: [{ content: text }],
    tables: [],
    statistics: [],
    entities: [],
    people: [],
    dates: [],
    handwrittenNotes: [],
    keyFacts: [],
    unclearItems: [],
    unclearTableCells: [],
    confidence: highAccuracy ? 0.55 : 0.35,
    handwritingDifficulty: highAccuracy ? "medium" : "high",
    needsReview: true,
    recommendedNextStep: highAccuracy ? "review" : "high_accuracy_retry",
    rawText: text,
  };
}

export async function probeSmartPagesGeminiExtraction(): Promise<{
  model: string;
  success: boolean;
  confidence: number;
  title: string;
  responseLength: number;
}> {
  const probeImage = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO5j2f8AAAAASUVORK5CYII=",
    "base64",
  );
  const result = await extractDocumentKnowledge(probeImage, "image/png", "smart-pages-diagnostic.png");
  return {
    model: resolveGeminiDocumentModel(),
    success: true,
    confidence: typeof result.confidence === "number" ? result.confidence : 0,
    title: result.title,
    responseLength: result.rawText?.length ?? 0,
  };
}

function formatPreferences(preferences?: Record<string, unknown>): string {
  if (!preferences || Object.keys(preferences).length === 0) return "No stored creator preferences.";
  return Object.entries(preferences)
    .map(([key, value]) => `- ${key}: ${typeof value === "string" ? value : JSON.stringify(value)}`)
    .join("\n");
}

export async function extractDocumentKnowledge(
  fileBuffer: Buffer,
  mimeType: string,
  originalName: string,
  options: {
    highAccuracy?: boolean;
    extractionMode?: "fast" | "high_accuracy";
    processedBuffer?: Buffer;
    processedMimeType?: string;
    sectionBuffers?: Array<{ label: string; buffer: Buffer; mimeType: string }>;
    priorExtraction?: ExtractedKnowledge | null;
    modelOverride?: string;
    onStableFallback?: (info: {
      requestedModel: string;
      stableModel: string;
      fallbackReason: string;
      providerErrorCode?: string;
      retryCount: number;
    }) => void | Promise<void>;
  } = {},
): Promise<ExtractedKnowledge & { _meta: DocExtractionMeta }> {
  const basePrompt = `You are processing a school document for School Connect Smart Pages. Analyze this document and extract all content for school administration, teaching, parent communication, or learner records.

Return ONLY valid JSON (no markdown, no code fences):
{
  "documentType": "report | form | table | letter | certificate | invoice | handwritten_note | other",
  "domain": "education | school_admin | finance | general",
  "title": "inferred title",
  "suggestedDocumentType": "best document type for polished output",
  "confidence": 0,
  "handwritingDifficulty": "low | medium | high",
  "needsReview": true,
  "recommendedNextStep": "accept | review | high_accuracy_retry",
  "people": ["person names only"],
  "dates": ["dates exactly as written"],
  "sections": [{ "heading": "string or null", "content": "string" }],
  "tables": [{ "heading": "string or null", "columns": ["col1"], "rows": [{"col1": "val"}] }],
  "statistics": [{ "label": "string", "value": "string or number" }],
  "entities": ["all named entities"],
  "handwrittenNotes": [{ "heading": "string or null", "content": "string" }],
  "keyFacts": ["fact exactly supported by visible content"],
  "unclearItems": [{ "label": "field or area", "value": "best visible fragment or empty", "reason": "why unclear", "unclear": true }],
  "unclearTableCells": [{ "row": 1, "column": "column name", "value": "best visible fragment or empty", "reason": "why unclear" }],
  "rawText": "full text content"
}

Rules:
- Return JSON only.
- Do not hallucinate missing content.
- If handwriting or a field is unclear, put it in unclearItems with "unclear": true.
- If a table cell is uncertain, add it to unclearTableCells instead of guessing.
- Confidence must be a number from 0 to 1.
- If confidence is below 0.7, set needsReview to true.
- If confidence is below 0.45, recommend high_accuracy_retry.
- Preserve original wording where possible.
- Extract tables only when table structure is visible.
- For off-frame, tilted, dark, or low-confidence content, add an unclearItems entry instead of guessing.

Document filename: ${originalName}`;

  const contents: Array<{ inlineData?: { data: string; mimeType: string }; text?: string }> = [];
  const addInline = (buffer: Buffer, inlineMime: string) => {
    contents.push({ inlineData: { data: buffer.toString("base64"), mimeType: inlineMime } });
  };
  const highAccuracy = options.highAccuracy ?? options.extractionMode === "high_accuracy";

  if (highAccuracy && options.processedBuffer) {
    addInline(fileBuffer, mimeType);
    addInline(options.processedBuffer, options.processedMimeType ?? "image/jpeg");
    for (const section of options.sectionBuffers ?? []) {
      addInline(section.buffer, section.mimeType);
    }
    const priorExtractionText = options.priorExtraction
      ? `Previous extraction to compare against:\n${JSON.stringify({
          confidence: options.priorExtraction.confidence,
          handwritingDifficulty: options.priorExtraction.handwritingDifficulty,
          needsReview: options.priorExtraction.needsReview,
          recommendedNextStep: options.priorExtraction.recommendedNextStep,
          unclearItems: options.priorExtraction.unclearItems,
          unclearTableCells: options.priorExtraction.unclearTableCells,
          sections: options.priorExtraction.sections,
          tables: options.priorExtraction.tables,
        }, null, 2)}`
      : "No prior extraction provided.";
    contents.push({
      text: `${basePrompt}

High accuracy mode:
- Compare the original image, the enhanced image, and the section crops.
- Prefer the clearer reading, but do not guess when the sources disagree.
- Mark uncertain fields instead of filling them in.
- Use the prior extraction only as a reference for comparison, never as a reason to hallucinate.

${priorExtractionText}`,
    });
  } else {
    const fastBuffer = options.processedBuffer ?? fileBuffer;
    const fastMimeType = options.processedBuffer ? (options.processedMimeType ?? "image/jpeg") : mimeType;
    contents.push(
      { inlineData: { data: fastBuffer.toString("base64"), mimeType: fastMimeType } },
      { text: basePrompt },
    );
  }

  const { primary: primaryHighAccuracy, stable: stableModel } = resolveGeminiHighAccuracyDocumentModel();
  const fastModel = model();
  const requestedModel = options.modelOverride?.trim() || (highAccuracy ? primaryHighAccuracy : fastModel);
  const retryDelaysMs = resolveGeminiRetryDelaysMs(highAccuracy);
  const timeoutMs = resolveGeminiAttemptTimeoutMs(highAccuracy);
  const mediaResolution = resolveGeminiMediaResolution(highAccuracy);
  let selectedModel = requestedModel;
  const attemptedModels: string[] = [requestedModel];
  let retryCount = 0;
  let fallbackUsed = false;
  let fallbackReason: string | undefined;
  let providerErrorCodeValue: string | undefined;
  let tokenUsage: Record<string, unknown> | null = null;
  const extractionStartMs = Date.now();

  let res: Awaited<ReturnType<GoogleGenAI["models"]["generateContent"]>>;
  try {
    const primaryResult = await generateContentWithRetryResult(
      { model: requestedModel, contents, config: buildExtractionConfig(mediaResolution) },
      timeoutMs,
      retryDelaysMs,
    );
    res = primaryResult.response;
    retryCount += primaryResult.retryCount;
    providerErrorCodeValue = primaryResult.providerErrorCode;
    tokenUsage = primaryResult.tokenUsage;
  } catch (primaryErr) {
    retryCount += errorRetryCount(primaryErr);
    providerErrorCodeValue = providerErrorCode(primaryErr);
    const fallbackEligible = highAccuracy
      ? isDocFallbackEligible(primaryErr)
      : isFastModeFallbackEligible(primaryErr);
    if (!options.modelOverride && fallbackEligible) {
      fallbackReason = getDocFallbackReason(primaryErr);
      console.warn("[document-gemini] primary model failed, falling back to stable", {
        requestedModel,
        stableModel,
        reason: fallbackReason,
        providerErrorCode: providerErrorCodeValue,
        retryCount,
        error: primaryErr instanceof Error ? primaryErr.message : String(primaryErr),
      });
      fallbackUsed = true;
      selectedModel = stableModel;
      attemptedModels.push(stableModel);
      const fallbackStartMs = Date.now();
      await options.onStableFallback?.({
        requestedModel,
        stableModel,
        fallbackReason,
        providerErrorCode: providerErrorCodeValue,
        retryCount,
      });
      try {
        const fallbackResult = await generateContentWithRetryResult(
          { model: stableModel, contents, config: buildExtractionConfig(mediaResolution) },
          timeoutMs,
          retryDelaysMs,
        );
        res = fallbackResult.response;
        retryCount += fallbackResult.retryCount;
        providerErrorCodeValue ??= fallbackResult.providerErrorCode;
        tokenUsage = fallbackResult.tokenUsage;
      } catch (fallbackErr) {
        retryCount += errorRetryCount(fallbackErr);
        providerErrorCodeValue ??= providerErrorCode(fallbackErr);
        throw fallbackErr;
      }
      const fallbackMs = Date.now() - fallbackStartMs;
      const text = res.text ?? "";
      const fallback = buildExtractionFallback(text, originalName, Boolean(highAccuracy));
      const knowledge = normalizeExtraction(
        parseJsonSafe<ExtractedKnowledge>(text, fallback, selectedModel),
        fallback,
        highAccuracy,
      );
      const _meta: DocExtractionMeta = {
        requestedModel,
        attemptedModels,
        selectedModel,
        retryCount,
        fallbackUsed,
        fallbackReason,
        providerErrorCode: providerErrorCodeValue,
        tokenUsage,
        extractionTimeMs: Date.now() - extractionStartMs,
        highAccuracy,
        mediaResolution,
        attemptTimeoutMs: timeoutMs,
        retryDelaysMs,
        fallbackMs,
      };
      return { ...knowledge, _meta };
    } else {
      throw primaryErr;
    }
  }

  const text = res.text ?? "";
  const fallback = buildExtractionFallback(text, originalName, highAccuracy);
  const knowledge = normalizeExtraction(
    parseJsonSafe<ExtractedKnowledge>(text, fallback, selectedModel),
    fallback,
    highAccuracy,
  );
  const _meta: DocExtractionMeta = {
    requestedModel,
    attemptedModels,
    selectedModel,
    retryCount,
    fallbackUsed,
    fallbackReason,
    providerErrorCode: providerErrorCodeValue,
    tokenUsage,
    extractionTimeMs: Date.now() - extractionStartMs,
    highAccuracy,
    mediaResolution,
    attemptTimeoutMs: timeoutMs,
    retryDelaysMs,
  };
  return { ...knowledge, _meta };
}

function isFastModeFallbackEligible(err: unknown): boolean {
  if (!(err instanceof Error)) return true;
  const msg = `${err.message} ${String((err as NodeJS.ErrnoException).cause ?? "")}`;
  return /429|quota|resource_exhausted|timed out|etimedout|unavailable|503|model overloaded|overloaded|high traffic|model not found|not_found|model_not_found|404/i.test(msg);
}

function normalizeExtraction(knowledge: ExtractedKnowledge, fallback: ExtractedKnowledge, highAccuracy: boolean): ExtractedKnowledge {
  const confidence = clampConfidence(typeof knowledge.confidence === "number" ? knowledge.confidence : fallback.confidence ?? 0.5);
  const handwritingDifficulty = normalizeDifficulty(
    knowledge.handwritingDifficulty ?? fallback.handwritingDifficulty ?? (confidence >= 0.8 ? "low" : confidence >= 0.55 ? "medium" : "high"),
  );
  const recommendedNextStep = normalizeRecommendation(
    knowledge.recommendedNextStep ?? fallback.recommendedNextStep ?? (confidence < 0.45 ? "high_accuracy_retry" : confidence < 0.75 ? "review" : "accept"),
  );
  const needsReview = typeof knowledge.needsReview === "boolean" ? knowledge.needsReview : confidence < 0.75 || handwritingDifficulty !== "low";
  const unclearItems = Array.isArray(knowledge.unclearItems) ? knowledge.unclearItems : fallback.unclearItems ?? [];
  const unclearTableCells = Array.isArray(knowledge.unclearTableCells) ? knowledge.unclearTableCells : fallback.unclearTableCells ?? [];
  const reviewWarning =
    knowledge.reviewWarning
    ?? (confidence < 0.45
      ? "Some handwriting was difficult to read. Review the extracted text or try high accuracy extraction."
      : confidence < 0.75
        ? "Some handwriting was difficult to read. Please review before publishing."
        : undefined);

  return {
    ...fallback,
    ...knowledge,
    confidence: highAccuracy ? confidence : (knowledge.confidence ?? confidence),
    handwritingDifficulty,
    needsReview,
    recommendedNextStep,
    unclearItems,
    unclearTableCells,
    reviewWarning,
    ocrQualityNotes: knowledge.ocrQualityNotes ?? fallback.ocrQualityNotes,
  };
}

function clampConfidence(value: number): number {
  if (!Number.isFinite(value)) return 0.5;
  return Math.max(0, Math.min(1, value));
}

function normalizeDifficulty(value: unknown): HandwritingDifficulty {
  return value === "low" || value === "medium" || value === "high" ? value : "medium";
}

function normalizeRecommendation(value: unknown): ExtractionRecommendation {
  return value === "accept" || value === "review" || value === "high_accuracy_retry" ? value : "review";
}

export async function generateDocumentSchema(
  knowledge: ExtractedKnowledge,
  intent: string,
  primaryColor = "#2563eb",
  preferences?: Record<string, unknown>,
): Promise<{ schema: DocumentSchema; componentTree: ComponentNode[] }> {
  const res = await generateContentWithRetry({
    model: model(),
    contents: [
      {
        text: `You are a Document Intelligence Engine. Generate a document schema.

Available component types:
- header: { title, subtitle?, logoText?, date?, primaryColor? }
- textBlock: { heading?, content }
- table: { heading?, columns: string[], rows: Record<string,string|number>[] }
- statistics: { heading?, items: [{ label, value, change? }] }
- aiSummary: { heading?, content }
- profileCard: { name, subtitle?, fields: [{ label, value }], avatarText? }
- signature: { label?, name?, date? }
- footer: { left?, center?, right? }

User intent: "${intent}"
Domain: ${knowledge.domain}
Document type: ${knowledge.documentType}

Stored creator preferences:
${formatPreferences(preferences)}

Extracted knowledge:
${JSON.stringify(knowledge, null, 2)}

Return ONLY valid JSON (no markdown):
{
  "theme": {
    "primaryColor": "${primaryColor}",
    "fontFamily": "system-ui",
    "pageSize": "A4",
    "orientation": "PORTRAIT"
  },
  "components": [
    { "id": "h1", "type": "header", "props": { ... } }
  ]
}

Rules:
- First component MUST be header, last MUST be footer
- Use real data from the extracted knowledge ? no placeholder text
- Apply stored creator preferences automatically when relevant
- Generate short unique IDs (h1, tb1, t1, s1, ai1, f1, etc.)
- Include all tables from extracted knowledge as table components`,
      },
    ],
    config: { temperature: 0.3 },
  });

  const text = res.text ?? "";
  const fallbackComponents: ComponentNode[] = [
    { id: "h1", type: "header", props: { title: knowledge.title, date: new Date().toLocaleDateString() } },
    ...knowledge.sections.slice(0, 3).map((s, i) => ({
      id: `tb${i + 1}`,
      type: "textBlock" as const,
      props: { heading: s.heading ?? undefined, content: s.content },
    })),
    { id: "f1", type: "footer", props: { center: knowledge.domain } },
  ];

  const parsed = parseJsonSafe<{ theme: DocumentSchema["theme"]; components: ComponentNode[] }>(text, {
    theme: { primaryColor, fontFamily: "system-ui", pageSize: "A4", orientation: "PORTRAIT" },
    components: fallbackComponents,
  });

  return { schema: { theme: parsed.theme, components: parsed.components }, componentTree: parsed.components };
}

export async function generateBulkTemplate(
  sampleRecords: Record<string, unknown>[],
  intent: string,
  collectionType: string,
  preferences?: Record<string, unknown>,
): Promise<{ theme: DocumentSchema["theme"]; components: ComponentNode[] }> {
  const res = await generateContentWithRetry({
    model: model(),
    contents: [
      {
        text: `You are a Document Intelligence Engine. Create a TEMPLATE document schema for bulk generation.

Collection type: ${collectionType}
User intent: "${intent}"

Stored creator preferences:
${formatPreferences(preferences)}

Sample records (${sampleRecords.length} of many):
${JSON.stringify(sampleRecords, null, 2)}

Return a template schema where dynamic values use {{fieldName}} placeholders.
For example: "title": "Report for {{name}}" or "content": "Score: {{math}}"

Available component types:
- header: { title, subtitle?, logoText?, date?, primaryColor? }
- textBlock: { heading?, content }
- table: { heading?, columns: string[], rows: [{"col": "{{field}}"}] }
- statistics: { heading?, items: [{ label, value: "{{field}}", change? }] }
- aiSummary: { heading?, content }
- profileCard: { name: "{{name}}", subtitle?, fields: [{ label, value: "{{field}}" }], avatarText?: "{{initials}}" }
- signature: { label?, name?, date? }
- footer: { left?, center?, right? }

Return ONLY valid JSON (no markdown):
{
  "theme": { "primaryColor": "#2563eb", "fontFamily": "system-ui", "pageSize": "A4", "orientation": "PORTRAIT" },
  "components": [ { "id": "h1", "type": "header", "props": { "title": "Report for {{name}}" } } ]
}

Rules:
- Use {{fieldName}} placeholders for all record-specific data
- First component MUST be header, last MUST be footer
- Apply stored creator preferences automatically when relevant
- Use every significant field from the sample records
- Generate unique short IDs for each component`,
      },
    ],
    config: { temperature: 0.2 },
  });

  const text = res.text ?? "";
  const fallbackComponents: ComponentNode[] = [
    {
      id: "h1",
      type: "header",
      props: { title: `${collectionType} Document ? {{name}}`, date: new Date().toLocaleDateString() },
    },
    { id: "f1", type: "footer", props: { center: collectionType } },
  ];

  return parseJsonSafe<{ theme: DocumentSchema["theme"]; components: ComponentNode[] }>(text, {
    theme: { primaryColor: "#2563eb", fontFamily: "system-ui", pageSize: "A4", orientation: "PORTRAIT" },
    components: fallbackComponents,
  });
}

export async function applyPromptToSchema(
  currentSchema: DocumentSchema,
  instruction: string,
  preferences?: Record<string, unknown>,
): Promise<{ schema: DocumentSchema; componentTree: ComponentNode[] }> {
  const res = await generateContentWithRetry({
    model: model(),
    contents: [
      {
        text: `You are a Document Intelligence Engine. Apply an editing instruction to this document schema.

Current schema:
${JSON.stringify(currentSchema, null, 2)}

Stored creator preferences:
${formatPreferences(preferences)}

Instruction: "${instruction}"

Return ONLY the COMPLETE updated schema as valid JSON (no markdown, no explanation):
{
  "theme": { "primaryColor": "...", "fontFamily": "...", "pageSize": "...", "orientation": "..." },
  "components": [ { "id": "...", "type": "...", "props": { ... } } ]
}

Apply the instruction exactly. Preserve all content unless explicitly told to change or remove it.
Apply stored creator preferences automatically when relevant.
Available component types: header, textBlock, table, statistics, aiSummary, profileCard, signature, footer`,
      },
    ],
    config: { temperature: 0.3 },
  });

  const text = res.text ?? "";
  const parsed = parseJsonSafe<{ theme: DocumentSchema["theme"]; components: ComponentNode[] }>(text, {
    theme: currentSchema.theme,
    components: currentSchema.components,
  });

  return { schema: { theme: parsed.theme, components: parsed.components }, componentTree: parsed.components };
}

export async function generateLawyerDocumentEditPlan(input: {
  title: string;
  currentContent: string;
  instruction: string;
  extractedKnowledge?: ExtractedKnowledge | null;
  preferences?: Record<string, unknown>;
}): Promise<AiEditResponse> {
  const safeContent = input.currentContent.trim() || input.title;
  const safeKnowledge = input.extractedKnowledge
    ? JSON.stringify({
        title: input.extractedKnowledge.title,
        documentType: input.extractedKnowledge.documentType,
        domain: input.extractedKnowledge.domain,
        sections: input.extractedKnowledge.sections,
        keyFacts: input.extractedKnowledge.keyFacts,
        unclearItems: input.extractedKnowledge.unclearItems,
        confidence: input.extractedKnowledge.confidence,
        handwritingDifficulty: input.extractedKnowledge.handwritingDifficulty,
        needsReview: input.extractedKnowledge.needsReview,
      }, null, 2)
    : "No extracted knowledge provided.";

  const res = await generateContentWithRetry({
    model: model(),
    contents: [
      {
        text: `You are editing a lawyer draft inside a document editor.

Return ONLY valid JSON with this exact shape:
{
  "summary": "short description of the proposed edits",
  "operations": [
    { "type": "replace_text", "oldText": "...exact substring...", "newText": "...new text...", "reason": "optional" },
    { "type": "insert_after", "anchorText": "...exact substring...", "insertText": "...text...", "reason": "optional" },
    { "type": "append_section", "heading": "Section heading", "body": "section body", "reason": "optional" },
    { "type": "replace_section", "heading": "Section heading", "newBody": "new body", "reason": "optional" }
  ],
  "warnings": ["optional warning"]
}

Rules:
- Return JSON only. No markdown. No commentary. No claim that the document was changed.
- Use only exact substrings that already exist in the current document content for replace_text and insert_after.
- Do not invent names, dates, amounts, parties, deadlines, laws, or facts.
- Missing legal facts must be marked [NEEDS REVIEW].
- Prefer the smallest possible set of changes.
- If no safe edit exists, return an empty operations array and explain why in summary or warnings.
- Keep the output suitable for Ugandan legal practice and lawyer review.

Document title: ${input.title}

Current document content:
${safeContent}

Current extracted knowledge or review context:
${safeKnowledge}

User instruction:
${input.instruction}

Stored preferences:
${formatPreferences(input.preferences)}`,
      },
    ],
    config: {
      temperature: 0,
      responseMimeType: "application/json",
      responseSchema: LAWYER_EDIT_RESPONSE_SCHEMA as any,
    } as any,
  });

  const parsed = parseJsonSafe<AiEditResponse>(res.text ?? "", {
    summary: "No changes applied.",
    operations: [],
    warnings: [],
  }, model());

  return {
    summary: typeof parsed.summary === "string" ? parsed.summary : "No changes applied.",
    operations: Array.isArray(parsed.operations) ? parsed.operations : [],
    warnings: Array.isArray(parsed.warnings) ? parsed.warnings.filter((warning) => typeof warning === "string") : [],
  };
}

export async function runGeminiAgent(input: {
  systemPrompt: string;
  instruction: string;
  context: unknown;
}): Promise<{ response: string; suggestedActions: string[] }> {
  const res = await generateContentWithRetry({
    model: model(),
    contents: [
      {
        text: `${input.systemPrompt}

Instruction:
${input.instruction}

Context:
${JSON.stringify(input.context, null, 2)}

Return ONLY valid JSON:
{
  "response": "concise answer",
  "suggestedActions": ["action 1", "action 2"]
}`,
      },
    ],
    config: { temperature: 0.2 },
  });

  return parseJsonSafe<{ response: string; suggestedActions: string[] }>(res.text ?? "", {
    response: res.text ?? "",
    suggestedActions: [],
  });
}

export async function translateDocumentSchema(
  currentSchema: DocumentSchema,
  language: "Arabic" | "French" | "Swahili" | "Spanish",
): Promise<{ schema: DocumentSchema; componentTree: ComponentNode[] }> {
  const res = await generateContentWithRetry({
    model: model(),
    contents: [
      {
        text: `Translate all user-facing text in this document schema to ${language}.

Do not change component IDs, component types, data structure, colors, page size, or orientation.
Never overwrite the existing version; the caller will save this as a new version.

Schema:
${JSON.stringify(currentSchema, null, 2)}

Return ONLY the translated complete schema as valid JSON:
{
  "theme": { ... },
  "components": [ ... ]
}`,
      },
    ],
    config: { temperature: 0 },
  });

  const parsed = parseJsonSafe<{ theme: DocumentSchema["theme"]; components: ComponentNode[] }>(res.text ?? "", {
    theme: currentSchema.theme,
    components: currentSchema.components,
  });
  return { schema: { theme: parsed.theme, components: parsed.components }, componentTree: parsed.components };
}

export async function summarizeDocumentSchema(
  currentSchema: DocumentSchema,
): Promise<{ summary: string; keyPoints: string[] }> {
  const res = await generateContentWithRetry({
    model: model(),
    contents: [
      {
        text: `Summarize this document schema for the creator.

Schema:
${JSON.stringify(currentSchema, null, 2)}

Return ONLY valid JSON:
{
  "summary": "short plain-language summary",
  "keyPoints": ["point 1", "point 2"]
}`,
      },
    ],
    config: { temperature: 0.1 },
  });

  return parseJsonSafe<{ summary: string; keyPoints: string[] }>(res.text ?? "", {
    summary: "Summary unavailable.",
    keyPoints: [],
  });
}

export async function rewriteDocumentTone(
  currentSchema: DocumentSchema,
  tone: string,
): Promise<{ schema: DocumentSchema; componentTree: ComponentNode[] }> {
  const res = await generateContentWithRetry({
    model: model(),
    contents: [
      {
        text: `Rewrite all user-facing text in this document schema using this tone: ${tone}.

Do not change component IDs, component types, data structure, colors, page size, or orientation.

Schema:
${JSON.stringify(currentSchema, null, 2)}

Return ONLY the rewritten complete schema as valid JSON:
{
  "theme": { ... },
  "components": [ ... ]
}`,
      },
    ],
    config: { temperature: 0.25 },
  });

  const parsed = parseJsonSafe<{ theme: DocumentSchema["theme"]; components: ComponentNode[] }>(res.text ?? "", {
    theme: currentSchema.theme,
    components: currentSchema.components,
  });
  return { schema: { theme: parsed.theme, components: parsed.components }, componentTree: parsed.components };
}

export async function classifyDocumentSchema(
  currentSchema: DocumentSchema,
): Promise<{ documentType: string; domain: string; confidence: number; tags: string[] }> {
  const res = await generateContentWithRetry({
    model: model(),
    contents: [
      {
        text: `Classify this document schema.

Schema:
${JSON.stringify(currentSchema, null, 2)}

Return ONLY valid JSON:
{
  "documentType": "report | form | table | letter | certificate | invoice | other",
  "domain": "education | school_admin | finance | general",
  "confidence": 0.0,
  "tags": ["tag"]
}`,
      },
    ],
    config: { temperature: 0 },
  });

  return parseJsonSafe<{ documentType: string; domain: string; confidence: number; tags: string[] }>(res.text ?? "", {
    documentType: "other",
    domain: "general",
    confidence: 0,
    tags: [],
  });
}

export async function assistSearchRanking(input: {
  query: string;
  results: Array<{ id: string; entityType: string; title: string | null; snippet: string; score: number }>;
}): Promise<{ rankedIds: string[]; explanation: string }> {
  if (input.results.length === 0) return { rankedIds: [], explanation: "No results to rank." };
  const res = await generateContentWithRetry({
    model: model(),
    contents: [
      {
        text: `Rank these search results for the user query using semantic relevance.

Query: ${input.query}
Results:
${JSON.stringify(input.results, null, 2)}

Return ONLY valid JSON:
{
  "rankedIds": ["result id in best order"],
  "explanation": "brief reason"
}`,
      },
    ],
    config: { temperature: 0 },
  });

  return parseJsonSafe<{ rankedIds: string[]; explanation: string }>(res.text ?? "", {
    rankedIds: input.results.map((result) => result.id),
    explanation: "Ranked by lexical score.",
  });
}

export async function suggestWorkflow(input: {
  creatorPreferences: Record<string, unknown>;
  context: unknown;
}): Promise<{ name: string; trigger: string; actions: Array<{ type: string; config?: Record<string, unknown> }>; rationale: string }> {
  const res = await generateContentWithRetry({
    model: model(),
    contents: [
      {
        text: `Suggest one useful document automation workflow for this creator.

Creator preferences:
${formatPreferences(input.creatorPreferences)}

Context:
${JSON.stringify(input.context, null, 2)}

Supported triggers: COLLECTION_IMPORTED, RECORD_ADDED, DOCUMENT_CREATED, BULK_GENERATION_COMPLETED, PUBLISH_COMPLETED
Supported actions: GENERATE_DOCUMENT, PUBLISH_DOCUMENT, EXPORT_PDF, NOTIFY_CREATOR, SEND_EMAIL

Return ONLY valid JSON:
{
  "name": "workflow name",
  "trigger": "SUPPORTED_TRIGGER",
  "actions": [{ "type": "SUPPORTED_ACTION", "config": {} }],
  "rationale": "brief reason"
}`,
      },
    ],
    config: { temperature: 0.2 },
  });

  return parseJsonSafe(res.text ?? "", {
    name: "Notify when bulk generation completes",
    trigger: "BULK_GENERATION_COMPLETED",
    actions: [{ type: "NOTIFY_CREATOR" }],
    rationale: "Keeps the creator informed when automated generation has finished.",
  });
}

