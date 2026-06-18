import type { NextFunction, Request, Response } from "express";
import { Router } from "express";
import multer from "multer";
import { extractMarksWithGemini, pingGemini } from "../services/geminiOcrService";

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

const NOT_MARKSHEET_MSG = "Uploaded document does not look like a marksheet.";

// In production, require an internal test key to protect Gemini billing.
function requireInternalKey(req: Request, res: Response, next: NextFunction): void {
  if (process.env.NODE_ENV === "production") {
    const provided = req.headers["x-internal-test-key"];
    const expected = process.env.INTERNAL_TEST_KEY;
    if (!expected || provided !== expected) {
      res.status(403).json({
        success: false,
        error: "Forbidden: x-internal-test-key header required in production",
      });
      return;
    }
  }
  next();
}

// requireInternalKey is applied per-route, NOT as router.use(), so it never
// accidentally blocks real production routes mounted under the same /api prefix.
router.get("/test-gemini-marks/health", requireInternalKey, (_req, res) => {
  res.json({ success: true, route: "gemini-ocr-mounted" });
});

router.post("/test-gemini-marks", requireInternalKey, upload.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      res.status(400).json({ success: false, error: "No image uploaded" });
      return;
    }

    const { rows, summary } = await extractMarksWithGemini(
      req.file.buffer,
      req.file.mimetype || "image/jpeg",
    );

    res.json({ success: true, count: rows.length, rows, summary });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Gemini OCR failed";
    console.error("[Gemini Marks OCR] error:", message);

    if (message === NOT_MARKSHEET_MSG) {
      res.status(400).json({ success: false, error: message });
    } else {
      res.status(500).json({ success: false, error: message });
    }
  }
});

router.get("/test-gemini-health", requireInternalKey, async (_req, res) => {
  const keyConfigured = !!process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";
  const isDev = process.env.NODE_ENV !== "production";

  if (!keyConfigured) {
    res.json({
      success: false,
      keyConfigured: false,
      model,
      nodeVersion: process.version,
      message: "GEMINI_API_KEY is not configured on this server.",
    });
    return;
  }

  try {
    await pingGemini();
    res.json({
      success: true,
      keyConfigured: true,
      model,
      nodeVersion: process.version,
      message: "Gemini AI is reachable and responding.",
    });
  } catch (error: unknown) {
    const base = {
      success: false,
      keyConfigured: true,
      model,
      nodeVersion: process.version,
      message: "Could not reach Gemini AI. Check server internet, DNS, proxy, or firewall.",
    };
    if (isDev) {
      res.json({
        ...base,
        diagnostic: {
          name: error instanceof Error ? error.name : "Unknown",
          message: error instanceof Error ? error.message : String(error),
          cause: error instanceof Error ? (error as NodeJS.ErrnoException).cause : undefined,
        },
      });
    } else {
      res.json(base);
    }
  }
});

export default router;

