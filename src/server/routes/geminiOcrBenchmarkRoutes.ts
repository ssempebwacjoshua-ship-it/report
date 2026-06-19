import { Router, type Request, type Response, type NextFunction } from "express";
import multer from "multer";
import {
  extractMarksWithGemini,
  resolveGeminiOcrModel,
  resolveGeminiOcrHighAccuracyModel,
} from "../services/geminiOcrService";

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

    console.log("[gemini-benchmark] starting", { fastModel, highAccuracyModel, stableModel, imageSize });

    async function runTier(
      tier: BenchmarkModelResult["tier"],
      modelName: string,
    ): Promise<BenchmarkModelResult> {
      try {
        const result = await extractMarksWithGemini(imageBuffer, mimeType, { modelOverride: modelName });
        console.log("[gemini-benchmark] result", {
          tier,
          model: result.meta.model,
          extractionTimeMs: result.meta.extractionTimeMs,
          rowCount: result.summary.totalRows,
          reviewRowCount: result.summary.reviewRows,
        });
        return {
          model: result.meta.model,
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

    const [fastResult, highAccuracyResult, stableResult] = await Promise.all([
      runTier("fast", fastModel),
      runTier("high_accuracy", highAccuracyModel),
      runTier("stable", stableModel),
    ]);

    const response: BenchmarkResponse = {
      results: [fastResult, highAccuracyResult, stableResult],
      fastModel,
      highAccuracyModel,
      stableModel,
      imageSize,
    };

    res.json(response);
  },
);

export default router;
