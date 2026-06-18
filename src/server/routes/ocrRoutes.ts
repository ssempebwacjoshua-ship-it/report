import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/requireAuth";
import { readAzureOcrFromImage, readAzureOcrFromUrl } from "../services/azureOcrService";

const bodySchema = z.union([
  z.object({
    url: z.string().trim().url("Enter a valid image or document URL."),
  }),
  z.object({
    imageBase64: z.string().min(1, "Image payload is required."),
    mimeType: z.string().min(1, "Image MIME type is required."),
  }),
]);

export function ocrRoutes() {
  const router = Router();

  router.post("/internal/ocr/read", requireAuth, async (req, res, next) => {
    try {
      if (req.user?.role !== "ADMIN_OPERATOR") {
        res.status(403).json({ error: "OCR access is restricted to school staff and administrators." });
        return;
      }

      const payload = bodySchema.parse(req.body);
      const result = "url" in payload
        ? await readAzureOcrFromUrl(payload.url)
        : await readAzureOcrFromImage(payload);
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

