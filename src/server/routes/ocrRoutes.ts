import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/requireAuth";
import { readAzureOcr } from "../services/azureOcrService";

const bodySchema = z.object({
  url: z.string().trim().url("Enter a valid image or document URL."),
});

export function ocrRoutes() {
  const router = Router();

  router.post("/internal/ocr/read", requireAuth, async (req, res, next) => {
    try {
      if (req.user?.role !== "ADMIN_OPERATOR") {
        res.status(403).json({ error: "OCR access is restricted to school staff and administrators." });
        return;
      }

      const { url } = bodySchema.parse(req.body);
      const result = await readAzureOcr(url);
      res.json({
        provider: "azure",
        text: result.text,
        lines: result.lines,
      });
    } catch (error) {
      if (error instanceof Error && error.name === "ProviderUnavailableError") {
        console.error("[ocr] provider unavailable:", error.message);
        res.status(503).json({ error: "OCR is temporarily unavailable. Contact platform support." });
        return;
      }
      next(error);
    }
  });

  return router;
}
