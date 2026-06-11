import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { prisma } from "../db/prisma";
import { commitMarksImport, dryRunMarksImport } from "../services/marksImportService";
import { extractMarksFromScan } from "../services/scanExtractionService";

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

        const schoolCode = typeof req.body.schoolCode === "string"
          ? req.body.schoolCode.trim()
          : "SCU-PREVIEW";

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
