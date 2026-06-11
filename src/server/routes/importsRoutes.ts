import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { prisma } from "../db/prisma";
import { commitMarksImport, dryRunMarksImport } from "../services/marksImportService";
import { recognizeBlockText } from "../services/markRecognitionService";
import {
  findMarksheetIdInText,
  resolveContextByMarksheetId,
} from "../services/marksheetContextService";
import { cropCell } from "../services/scanPreprocessService";
import { extractMarksFromScan } from "../services/scanExtractionService";
import {
  LAYOUT,
  PAGE_MARGIN_LEFT_FRAC,
  TABLE_WIDTH_FRAC,
} from "../services/marksheetGeometryService";

const SCAN_FILE_TYPES = new Set(["PDF", "PNG", "JPG", "JPEG", "WEBP"]);

const importPayload = z.object({
  schoolCode: z.string().default("SCU-PREVIEW"),
  csvText: z.string().min(1),
});

const scanContextSchema = z.object({
  marksheetId: z.string().default(""),
  className: z.string().min(1),
  streamName: z.string().min(1),
  subjectName: z.string().min(1),
  termName: z.string().min(1),
  examType: z.string().min(1),
  academicYear: z.string().min(1),
});

// Accept scan files up to 20 MB in memory
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
});

export function importsRoutes() {
  const router = Router();

  // ── Digital import (CSV / XLS / XLSX) ─────────────────────────────────────

  router.post("/api/imports/marks/dry-run", async (req, res, next) => {
    try {
      const payload = importPayload.parse(req.body);
      res.json(await dryRunMarksImport(prisma, payload.schoolCode, payload.csvText));
    } catch (error) {
      next(error);
    }
  });

  router.post("/api/imports/marks/commit", async (req, res, next) => {
    try {
      const payload = importPayload.parse(req.body);
      res.json(await commitMarksImport(prisma, payload.schoolCode, payload.csvText));
    } catch (error) {
      next(error);
    }
  });

  // ── Scanned handwritten marksheet import ───────────────────────────────────

  /**
   * POST /api/imports/scans/detect-context
   *
   * Upload a scanned image → OCR the header region to find the Marksheet ID
   * → resolve full context from committed batches or school data.
   *
   * This is a lightweight, non-committing call meant to be the first step in
   * the scan upload flow.  It does NOT extract marks or persist anything.
   */
  router.post(
    "/api/imports/scans/detect-context",
    upload.single("file"),
    async (req, res, next) => {
      try {
        const schoolCode =
          typeof req.body.schoolCode === "string" ? req.body.schoolCode.trim() : "SCU-PREVIEW";

        const school = await prisma.school.findUnique({ where: { code: schoolCode } });
        if (!school) {
          res.status(404).json({ error: `School "${schoolCode}" was not found.` });
          return;
        }

        const file = req.file;
        let foundId: string | null = null;

        // If a file was provided, try to OCR the header region for the marksheet ID
        if (file) {
          try {
            const { preprocessScanImage } = await import("../services/scanPreprocessService");
            const scan = await preprocessScanImage(file.buffer, file.mimetype);

            // Crop header region (top ~22% of page, full usable width)
            const headerRect = {
              x: Math.max(0, Math.round(PAGE_MARGIN_LEFT_FRAC * scan.width)),
              y: Math.max(0, Math.round(LAYOUT.marginTopFrac * scan.height)),
              w: Math.max(1, Math.round(TABLE_WIDTH_FRAC * scan.width)),
              h: Math.max(1, Math.round((LAYOUT.headerHFrac + 0.01) * scan.height)),
            };

            const headerBuffer = await cropCell(scan.buffer, headerRect);
            const { text } = await recognizeBlockText(headerBuffer);
            foundId = findMarksheetIdInText(text);
          } catch {
            // Header OCR failed — fall through to ID lookup or manual entry
          }
        }

        // If the request also includes an explicit marksheetId field, prefer it
        const explicitId = typeof req.body.marksheetId === "string"
          ? req.body.marksheetId.trim()
          : "";
        const lookupId = explicitId || foundId;

        if (!lookupId) {
          res.json({
            detected: null,
            detectionStatus: "NOT_FOUND",
            message: file
              ? "No marksheet ID found in the scanned header. Enter the Marksheet ID manually."
              : "No file uploaded and no marksheet ID provided.",
            ocrFoundId: null,
          });
          return;
        }

        const result = await resolveContextByMarksheetId(prisma, school.id, lookupId);
        res.json({ ...result, ocrFoundId: foundId });
      } catch (error) {
        next(error);
      }
    },
  );

  /**
   * GET /api/imports/scans/context?marksheetId=MS-...&schoolCode=...
   *
   * Resolve a marksheet ID to its full context without uploading a file.
   * Used when the operator types or pastes a marksheet ID directly.
   */
  router.get("/api/imports/scans/context", async (req, res, next) => {
    try {
      const marksheetId = String(req.query.marksheetId ?? "").trim();
      const schoolCode  = String(req.query.schoolCode  ?? "SCU-PREVIEW").trim();

      if (!marksheetId) {
        res.status(400).json({ error: "marksheetId query parameter is required." });
        return;
      }

      const school = await prisma.school.findUnique({ where: { code: schoolCode } });
      if (!school) {
        res.status(404).json({ error: `School "${schoolCode}" was not found.` });
        return;
      }

      const result = await resolveContextByMarksheetId(prisma, school.id, marksheetId);
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  /**
   * POST /api/imports/scans/upload
   *
   * Upload a scanned image + confirmed context → extract marks → return rows.
   * Context must already be confirmed by the operator (from detect-context or manual entry).
   */
  router.post(
    "/api/imports/scans/upload",
    upload.single("file"),
    async (req, res, next) => {
      try {
        // 1. Require actual file bytes
        const file = req.file;
        if (!file) {
          res
            .status(400)
            .json({ error: "No scan file uploaded. Attach a PNG, JPG, JPEG, WEBP, or PDF scan." });
          return;
        }

        // 2. Validate file type from extension
        const ext = (file.originalname.split(".").pop() ?? "").trim().toUpperCase();
        if (!SCAN_FILE_TYPES.has(ext)) {
          res.status(400).json({
            error: `Unsupported scan file type: .${ext.toLowerCase()}. Accepted formats: PDF, PNG, JPG, JPEG, WEBP.`,
          });
          return;
        }

        // 3. Parse and validate marksheet context (sent as JSON string in form field)
        let context: z.infer<typeof scanContextSchema>;
        try {
          const raw =
            typeof req.body.context === "string"
              ? (JSON.parse(req.body.context) as unknown)
              : req.body.context;
          context = scanContextSchema.parse(raw);
        } catch {
          res.status(400).json({
            error:
              'Invalid or missing marksheet context. Send context as a JSON string in the "context" field.',
          });
          return;
        }

        const schoolCode =
          typeof req.body.schoolCode === "string" ? req.body.schoolCode.trim() : "SCU-PREVIEW";

        // 4. Look up school
        const school = await prisma.school.findUnique({ where: { code: schoolCode } });
        if (!school) {
          res.status(404).json({ error: `School "${schoolCode}" was not found.` });
          return;
        }

        // 5. Create batch record immediately (before extraction, so it exists even on failure)
        const batch = await prisma.markImportBatch.create({
          data: {
            schoolId: school.id,
            status: "DRY_RUN",
            source: "scan",
            summary: JSON.stringify({
              scanMode: true,
              parseStatus: "PARSING",
              fileName: file.originalname,
              fileType: ext,
              fileSize: file.size,
              context,
              rows: [],
            }),
          },
        });

        // 6. Run extraction engine
        const extraction = await extractMarksFromScan(
          prisma,
          file.buffer,
          file.mimetype,
          school.id,
          context,
        );

        // 7. Update batch with final extraction result
        await prisma.markImportBatch.update({
          where: { id: batch.id },
          data: {
            summary: JSON.stringify({
              scanMode: true,
              parseStatus: extraction.parseStatus,
              fileName: file.originalname,
              fileType: ext,
              fileSize: file.size,
              context,
              rows: extraction.rows,
              message: extraction.message,
            }),
          },
        });

        res.json({
          batchId: batch.id,
          parseStatus: extraction.parseStatus,
          message: extraction.message,
          rows: extraction.rows,
        });
      } catch (error) {
        next(error);
      }
    },
  );

  router.get("/api/imports/scans/batches", async (req, res, next) => {
    try {
      const schoolCode = String(req.query.schoolCode ?? "SCU-PREVIEW");
      const school = await prisma.school.findUnique({ where: { code: schoolCode } });
      if (!school) {
        res.json({ batches: [] });
        return;
      }

      const batches = await prisma.markImportBatch.findMany({
        where: { schoolId: school.id, source: "scan" },
        orderBy: { createdAt: "desc" },
        take: 20,
      });

      const result = batches.map((b) => {
        let parsed: Record<string, unknown> = {};
        try {
          parsed = JSON.parse(b.summary ?? "{}") as Record<string, unknown>;
        } catch {
          // summary is not valid JSON — leave parsed empty
        }
        return {
          id: b.id,
          fileName: parsed["fileName"] ?? "",
          fileType: parsed["fileType"] ?? "",
          parseStatus: parsed["parseStatus"] ?? "UPLOADED",
          message: (parsed["message"] as string | undefined) ?? "",
          context: parsed["context"] ?? null,
          rows: parsed["rows"] ?? [],
          createdAt: b.createdAt.toISOString(),
        };
      });

      res.json({ batches: result });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
