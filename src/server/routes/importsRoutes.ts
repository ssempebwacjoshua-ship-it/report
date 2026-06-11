import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db/prisma";
import { commitMarksImport, dryRunMarksImport } from "../services/marksImportService";

const SCAN_FILE_TYPES = new Set(["PDF", "PNG", "JPG", "JPEG", "WEBP"]);

const importPayload = z.object({
  schoolCode: z.string().default("SCU-PREVIEW"),
  csvText: z.string().min(1),
});

const scanContextSchema = z.object({
  marksheetId: z.string().min(1),
  className: z.string().min(1),
  streamName: z.string().min(1),
  subjectName: z.string().min(1),
  termName: z.string().min(1),
  examType: z.string().min(1),
  academicYear: z.string().min(1),
});

const scanUploadPayload = z.object({
  schoolCode: z.string().default("SCU-PREVIEW"),
  fileName: z.string().min(1),
  fileType: z.string().min(1),
  fileSize: z.number().optional(),
  context: scanContextSchema,
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

  router.post("/api/imports/scans/upload", async (req, res, next) => {
    try {
      const payload = scanUploadPayload.parse(req.body);

      const fileTypeUpper = payload.fileType.trim().toUpperCase();
      if (!SCAN_FILE_TYPES.has(fileTypeUpper)) {
        res.status(400).json({
          error: `Unsupported scan file type: ${payload.fileType}. Accepted formats: PDF, PNG, JPG, JPEG, WEBP.`,
        });
        return;
      }

      const school = await prisma.school.findUnique({ where: { code: payload.schoolCode } });
      if (!school) {
        res.status(404).json({ error: `School ${payload.schoolCode} was not found.` });
        return;
      }

      const summary = JSON.stringify({
        scanMode: true,
        parseStatus: "EXTRACTION_NOT_CONFIGURED",
        fileName: payload.fileName,
        fileType: fileTypeUpper,
        fileSize: payload.fileSize ?? 0,
        context: payload.context,
        rows: [],
      });

      const batch = await prisma.markImportBatch.create({
        data: {
          schoolId: school.id,
          status: "DRY_RUN",
          source: "scan",
          summary,
        },
      });

      res.json({
        batchId: batch.id,
        parseStatus: "EXTRACTION_NOT_CONFIGURED",
        message: "Scan uploaded. Extraction engine not configured.",
        rows: [],
      });
    } catch (error) {
      next(error);
    }
  });

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
          message:
            parsed["parseStatus"] === "EXTRACTION_NOT_CONFIGURED"
              ? "Scan uploaded. Extraction engine not configured."
              : "",
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
