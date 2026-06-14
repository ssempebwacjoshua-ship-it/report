import { Router } from "express";
import multer from "multer";
import { extractMarksWithGemini } from "../services/geminiOcrService";

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

router.get("/test-gemini-marks/health", (_req, res) => {
  res.json({ success: true, route: "gemini-ocr-mounted" });
});

router.post("/test-gemini-marks", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      res.status(400).json({ success: false, error: "No image uploaded" });
      return;
    }

    const rows = await extractMarksWithGemini(
      req.file.buffer,
      req.file.mimetype || "image/jpeg"
    );

    res.json({
      success: true,
      count: rows.length,
      rows,
    });
  } catch (error: any) {
    console.error("Gemini OCR test failed:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Gemini OCR failed",
    });
  }
});

export default router;