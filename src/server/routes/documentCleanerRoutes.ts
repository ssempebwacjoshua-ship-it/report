import { createHash } from "node:crypto";
import { randomUUID } from "node:crypto";
import express from "express";
import multer from "multer";
import { z } from "zod";
import type { DocCleanerErrorCode } from "../../shared/types/documentCleaner";
import { DOC_CLEANER_FILE_TYPES } from "../../shared/types/documentCleaner";
import type { ExtractionMode } from "../../shared/types/smartPages";
import { extractDocumentFromImage, renderDocumentHtml } from "../services/documentCleanerService";
import { getProviderForMode } from "../services/documentCleanerPricingService";
import { isValidExtractionMode } from "../services/documentCleanerProviderService";
import {
  canExtract,
  deductPages,
  estimatePageCount,
  getDefaultExtractionMode,
  getSummary,
  isDuplicateJob,
  isHighAccuracyAllowed,
} from "../services/smartPagesService";

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

function fileHash(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
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

  // ── GET /api/documents/cleaner/smart-pages ─────────────────────────────────
  router.get("/api/documents/cleaner/smart-pages", async (req, res) => {
    const schoolCode = req.query["schoolCode"];
    if (typeof schoolCode !== "string" || !schoolCode.trim()) {
      res.status(400).json(
        docErr("MISSING_SCHOOL_CODE", "schoolCode query parameter is required."),
      );
      return;
    }
    const summary = await getSummary(schoolCode.trim());
    res.status(200).json(summary);
  });

  // ── POST /api/documents/cleaner/upload ─────────────────────────────────────
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

      // ── Extraction mode ─────────────────────────────────────────────────────
      const rawMode = (req.body as Record<string, string | undefined>)["extractionMode"];
      const mode: ExtractionMode = rawMode && isValidExtractionMode(rawMode)
        ? rawMode
        : getDefaultExtractionMode();

      const pageEstimate = estimatePageCount(mime);

      // ── Smart Pages checks (only when schoolCode provided) ─────────────────
      const schoolCode = (req.body as Record<string, string | undefined>)["schoolCode"];

      if (schoolCode) {
        // High accuracy plan check
        if (mode === "high_accuracy") {
          const allowed = await isHighAccuracyAllowed(schoolCode);
          if (!allowed) {
            res.status(403).json(
              docErr(
                "HIGH_ACCURACY_NOT_ALLOWED",
                "High Accuracy mode is only available on Pro and Enterprise plans. Please upgrade or select a different mode.",
              ),
            );
            return;
          }
        }

        // Allowance check
        const canExtractResult = await canExtract(schoolCode, pageEstimate);
        if (!canExtractResult.allowed) {
          res.status(402).json(
            docErr(
              "SMART_PAGES_EXHAUSTED",
              canExtractResult.message ?? "You have used all your Smart Pages. Buy top-up pages to continue.",
            ),
          );
          return;
        }

        // Idempotency / deduplication check
        const hash = fileHash(req.file.buffer);
        const isDup = await isDuplicateJob(schoolCode, hash);
        if (isDup) {
          // Return a cache-hit response — no charge, signal to client
          res.status(200).json({
            draftId: randomUUID(),
            document: {
              documentType: "table",
              title: "",
              schoolName: "",
              academicYear: "",
              term: "",
              columns: [],
              rows: [],
              uncertainCells: [],
            },
            imagePreviewUrl: "",
            fromCache: true,
            pageEstimate,
            extractionMode: mode,
          });
          return;
        }

        // Extract
        const result = await extractDocumentFromImage(req.file.buffer, mime);

        // Deduct pages only after successful extraction
        const { provider, model } = getProviderForMode(mode);
        await deductPages(schoolCode, {
          jobId: result.draftId,
          fileHash: hash,
          pagesCharged: pageEstimate,
          extractionMode: mode,
          provider,
          model,
          reason: "document extraction",
        });

        res.status(200).json({ ...result, pageEstimate, extractionMode: mode });
        return;
      }

      // No schoolCode — extract without billing
      const result = await extractDocumentFromImage(req.file.buffer, mime);
      res.status(200).json({ ...result, pageEstimate, extractionMode: mode });
    },
  );

  // ── POST /api/documents/cleaner/generate-pdf ───────────────────────────────
  // NOTE: No smart pages check — editing/reviewing/downloading is always free.
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
