import type { NextFunction, Request, Response } from "express";
import { Router } from "express";
import multer from "multer";
import { parseRosterImagePerfect } from "../services/geminiRosterService";

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

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
router.get("/test-gemini-roster/health", requireInternalKey, (_req, res) => {
  res.json({ success: true, route: "gemini-roster-mounted" });
});

router.post("/test-gemini-roster", requireInternalKey, upload.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      res.status(400).json({ success: false, error: "No image uploaded" });
      return;
    }

    const body = req.body as Record<string, string | undefined>;
    const knownTeachers: string[] = [];
    if (body.knownTeachers) {
      try {
        const parsed: unknown = JSON.parse(body.knownTeachers);
        if (Array.isArray(parsed)) knownTeachers.push(...(parsed as string[]));
      } catch {
        // ignore malformed JSON ? proceed without known teachers
      }
    }

    const rows = await parseRosterImagePerfect(
      req.file.buffer,
      knownTeachers,
      req.file.mimetype || "image/jpeg",
    );

    res.json({ success: true, count: rows.length, rows });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Gemini roster OCR failed";
    console.error("[Gemini Roster OCR] error:", message);
    res.status(500).json({ success: false, error: message });
  }
});

export default router;

