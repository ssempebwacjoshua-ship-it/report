import { Router, type Request, type Response, type NextFunction } from "express";
import multer from "multer";
import {
  extractMarksWithGemini,
  resolveGeminiOcrModel,
  resolveGeminiOcrHighAccuracyModel,
} from "../services/geminiOcrService";
import {
  extractDocumentKnowledge,
  resolveGeminiDocumentModel,
  resolveGeminiHighAccuracyDocumentModel,
} from "../services/documentGeminiService";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

function requireInternalKey(req: Request, res: Response, next: NextFunction) {
  if (process.env.NODE_ENV === "production") {
    const key = req.headers["x-internal-test-key"];
    if (!process.env.INTERNAL_TEST_KEY || key !== process.env.INTERNAL_TEST_KEY) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
  }
  next();
}

export interface BenchmarkModelResult {
  model: string;
  tier: "fast" | "high_accuracy" | "stable";
  success: boolean;
  extractionTimeMs: number;
  rowCount?: number;
  reviewRowCount?: number;
  missingMarkRows?: number;
  invalidMarkRows?: number;
  error?: string;
}

export interface BenchmarkResponse {
  results: BenchmarkModelResult[];
  fastModel: string;
  highAccuracyModel: string;
  stableModel: string;
  imageSize: string;
  mode: "sequential" | "parallel";
}

const router = Router();

/**
 * POST /api/test-gemini-benchmark
 * Runs all three model tiers on the same image and returns a side-by-side comparison.
 * Protected by INTERNAL_TEST_KEY in production.
 */
router.post(
  "/test-gemini-benchmark",
  requireInternalKey,
  upload.single("image"),
  async (req: Request, res: Response) => {
    if (!req.file) {
      res.status(400).json({ error: "No image file uploaded. Send multipart/form-data with field 'image'." });
      return;
    }

    const { primary: primaryModel, stable: stableModel } = resolveGeminiOcrHighAccuracyModel();
    const fastModel = resolveGeminiOcrModel();
    const highAccuracyModel = primaryModel || stableModel;

    const imageBuffer = req.file.buffer;
    const mimeType = req.file.mimetype || "image/jpeg";
    const imageSize = `${(imageBuffer.byteLength / 1024).toFixed(1)} KB`;

    const mode = req.query.parallel === "true" ? "parallel" : "sequential";
    console.log("[gemini-benchmark] starting", { fastModel, highAccuracyModel, stableModel, imageSize, mode });

    async function runTier(
      tier: BenchmarkModelResult["tier"],
      modelName: string,
    ): Promise<BenchmarkModelResult> {
      try {
        const result = await extractMarksWithGemini(imageBuffer, mimeType, { modelOverride: modelName });
        console.log("[gemini-benchmark] result", {
          tier,
          model: result.meta.selectedModel,
          extractionTimeMs: result.meta.extractionTimeMs,
          rowCount: result.summary.totalRows,
          reviewRowCount: result.summary.reviewRows,
        });
        return {
          model: result.meta.selectedModel,
          tier,
          success: true,
          extractionTimeMs: result.meta.extractionTimeMs,
          rowCount: result.summary.totalRows,
          reviewRowCount: result.summary.reviewRows,
          missingMarkRows: result.summary.missingMarkRows,
          invalidMarkRows: result.summary.invalidMarkRows,
        };
      } catch (err) {
        const error = err instanceof Error ? err.message : String(err);
        console.warn("[gemini-benchmark] model failed", { tier, modelName, error });
        return { model: modelName, tier, success: false, extractionTimeMs: 0, error };
      }
    }

    const runners = [
      () => runTier("fast", fastModel),
      () => runTier("high_accuracy", highAccuracyModel),
      () => runTier("stable", stableModel),
    ];
    const results = mode === "parallel"
      ? await Promise.all(runners.map((runner) => runner()))
      : [];
    if (mode === "sequential") {
      for (const runner of runners) {
        results.push(await runner());
      }
    }

    const response: BenchmarkResponse = {
      results,
      fastModel,
      highAccuracyModel,
      stableModel,
      imageSize,
      mode,
    };

    res.json(response);
  },
);

export interface DocBenchmarkModelResult {
  model: string;
  requestedModel: string;
  tier: "fast" | "high_accuracy" | "stable";
  success: boolean;
  extractionTimeMs: number;
  retryCount: number;
  fallbackUsed: boolean;
  fallbackReason?: string;
  providerErrorCode?: string;
  attemptedModels: string[];
  documentType?: string;
  domain?: string;
  confidence?: number;
  handwritingDifficulty?: string;
  needsReview?: boolean;
  sectionCount?: number;
  tableCount?: number;
  unclearItemCount?: number;
  rawTextPreview?: string;
  error?: string;
}

export interface DocBenchmarkResponse {
  results: DocBenchmarkModelResult[];
  fastModel: string;
  highAccuracyModel: string;
  stableModel: string;
  imageSize: string;
  mode: "sequential" | "parallel";
}

/**
 * POST /api/test-gemini-document-benchmark
 * Runs all three model tiers on a general school document image using
 * extractDocumentKnowledge (not the marksheet extractor — any school
 * document type is accepted: programme, timetable, form, certificate, etc.).
 * Protected by INTERNAL_TEST_KEY in production.
 */
router.post(
  "/test-gemini-document-benchmark",
  requireInternalKey,
  upload.single("image"),
  async (req: Request, res: Response) => {
    if (!req.file) {
      res.status(400).json({ error: "No image file uploaded. Send multipart/form-data with field 'image'." });
      return;
    }

    const { primary: primaryModel, stable: stableModel } = resolveGeminiHighAccuracyDocumentModel();
    const fastModel = resolveGeminiDocumentModel();
    const highAccuracyModel = primaryModel;

    const imageBuffer = req.file.buffer;
    const mimeType = req.file.mimetype || "image/jpeg";
    const originalName = (req.file.originalname as string | undefined) || "benchmark-image";
    const imageSize = `${(imageBuffer.byteLength / 1024).toFixed(1)} KB`;

    const mode = req.query.parallel === "true" ? "parallel" : "sequential";
    console.log("[gemini-doc-benchmark] starting", { fastModel, highAccuracyModel, stableModel, imageSize, mode });

    async function runDocTier(
      tier: DocBenchmarkModelResult["tier"],
      modelOverride: string,
      highAccuracy: boolean,
    ): Promise<DocBenchmarkModelResult> {
      try {
        const result = await extractDocumentKnowledge(imageBuffer, mimeType, originalName, {
          highAccuracy,
          modelOverride,
        });
        const { _meta } = result;
        const rawTextPreview = result.rawText
          ? result.rawText.replace(/\s+/g, " ").slice(0, 300)
          : undefined;
        console.log("[gemini-doc-benchmark] result", {
          tier,
          requestedModel: _meta.requestedModel,
          selectedModel: _meta.selectedModel,
          fallbackUsed: _meta.fallbackUsed,
          fallbackReason: _meta.fallbackReason,
          extractionTimeMs: _meta.extractionTimeMs,
          documentType: result.documentType,
          confidence: result.confidence,
        });
        return {
          model: _meta.selectedModel,
          requestedModel: _meta.requestedModel,
          tier,
          success: true,
          extractionTimeMs: _meta.extractionTimeMs,
          retryCount: _meta.retryCount,
          fallbackUsed: _meta.fallbackUsed,
          fallbackReason: _meta.fallbackReason,
          providerErrorCode: _meta.providerErrorCode,
          attemptedModels: _meta.attemptedModels,
          documentType: result.documentType,
          domain: result.domain,
          confidence: result.confidence,
          handwritingDifficulty: result.handwritingDifficulty,
          needsReview: result.needsReview,
          sectionCount: result.sections?.length ?? 0,
          tableCount: result.tables?.length ?? 0,
          unclearItemCount: result.unclearItems?.length ?? 0,
          rawTextPreview,
        };
      } catch (err) {
        const error = err instanceof Error ? err.message : String(err);
        console.warn("[gemini-doc-benchmark] model failed", { tier, modelOverride, error });
        return {
          model: modelOverride,
          requestedModel: modelOverride,
          tier,
          success: false,
          extractionTimeMs: 0,
          retryCount: 0,
          fallbackUsed: false,
          attemptedModels: [modelOverride],
          error,
        };
      }
    }

    const runners = [
      () => runDocTier("fast", fastModel, false),
      () => runDocTier("high_accuracy", highAccuracyModel, true),
      () => runDocTier("stable", stableModel, false),
    ];
    const results = mode === "parallel"
      ? await Promise.all(runners.map((runner) => runner()))
      : [];
    if (mode === "sequential") {
      for (const runner of runners) {
        results.push(await runner());
      }
    }

    const response: DocBenchmarkResponse = {
      results,
      fastModel,
      highAccuracyModel,
      stableModel,
      imageSize,
      mode,
    };

    res.json(response);
  },
);

export default router;
