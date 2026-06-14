import type { NextFunction, Request, Response } from "express";
import { Router } from "express";
import multer from "multer";
import { extractMarksWithGemini } from "../services/geminiOcrService";

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

router.use(requireInternalKey);

router.get("/test-gemini-marks/health", (_req, res) => {
  res.json({ success: true, route: "gemini-ocr-mounted" });
});

router.post("/test-gemini-marks", upload.single("image"), async (req, res) => {
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

export default router;
