import express from "express";
import multer from "multer";
import { z } from "zod";
import type { DocCleanerErrorCode } from "../../shared/types/documentCleaner";
import { DOC_CLEANER_FILE_TYPES } from "../../shared/types/documentCleaner";
import { extractDocumentFromImage, renderDocumentHtml } from "../services/documentCleanerService";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
});

const ACCEPTED_MIME_TYPES = new Set([
  "image/png",
  "image/jpg",
  "image/jpeg",
  "image/webp",
  "application/pdf",
]);

function docErr(
  code: DocCleanerErrorCode,
  message: string,
  details: string[] = [],
) {
  return { error: true as const, code, message, details };
}

function extensionFromFilename(name: string): string {
  return (name.split(".").pop() ?? "").toUpperCase();
}

const documentRowSchema = z.object({
  cells: z.array(z.string()),
  confidence: z.number(),
});

const uncertainCellSchema = z.object({
  rowIndex: z.number(),
  columnIndex: z.number(),
  reason: z.string(),
});

const extractedDocumentSchema = z.object({
  documentType: z.enum(["table", "list", "free-text"]),
  title: z.string(),
  schoolName: z.string(),
  academicYear: z.string(),
  term: z.string(),
  columns: z.array(z.string()),
  rows: z.array(documentRowSchema),
  uncertainCells: z.array(uncertainCellSchema),
});

const generatePdfSchema = z.object({
  document: extractedDocumentSchema,
  primaryColor: z.string().optional(),
});

export function documentCleanerRoutes() {
  const router = express.Router();

  router.post(
    "/api/documents/cleaner/upload",
    upload.single("file"),
    async (req, res) => {
      if (!req.file) {
        res.status(400).json(docErr("MISSING_FILE", "No file was attached. Please upload a PNG, JPG, WEBP, or PDF."));
        return;
      }

      const ext = extensionFromFilename(req.file.originalname);
      const mime = req.file.mimetype;

      if (!ACCEPTED_MIME_TYPES.has(mime) && !DOC_CLEANER_FILE_TYPES.has(ext)) {
        res.status(400).json(
          docErr(
            "UNSUPPORTED_FILE_TYPE",
            `File type "${ext || mime}" is not supported. Please upload a PNG, JPG, WEBP, or PDF.`,
            [ext || mime],
          ),
        );
        return;
      }

      const result = await extractDocumentFromImage(req.file.buffer, mime);
      res.status(200).json(result);
    },
  );

  router.post("/api/documents/cleaner/generate-pdf", async (req, res) => {
    const parsed = generatePdfSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json(
        docErr(
          "INVALID_DOCUMENT",
          "Invalid document payload.",
          parsed.error.issues.map((i) => i.message),
        ),
      );
      return;
    }

    const html = renderDocumentHtml(parsed.data.document, parsed.data.primaryColor);
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.status(200).send(html);
  });

  return router;
}
