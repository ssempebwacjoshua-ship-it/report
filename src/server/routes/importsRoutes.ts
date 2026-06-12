import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { prisma } from "../db/prisma";
import { commitMarksImport, dryRunMarksImport } from "../services/marksImportService";
import { finalizedStatus, toAssessmentType } from "../services/marksImportValidator";
import { recognizeBlockText } from "../services/markRecognitionService";
import {
  findMarksheetIdInText,
  resolveContextByMarksheetId,
  resolveScanMarksheetContext,
} from "../services/marksheetContextService";
import { cropCell } from "../services/scanPreprocessService";
import { extractMarksFromScan } from "../services/scanExtractionService";
import { parseScanMark, validateScanRows } from "../services/scanImportValidator";
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

function parseOptionalScanContext(value: unknown): Partial<z.infer<typeof scanContextSchema>> | null {
  if (!value) return null;
  try {
    const raw = typeof value === "string" ? JSON.parse(value) as unknown : value;
    const parsed = scanContextSchema.partial().safeParse(raw);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

async function tryRecognizeHeaderMarksheetId(file: Express.Multer.File): Promise<string | null> {
  try {
    const { preprocessScanImage } = await import("../services/scanPreprocessService");
    const scan = await preprocessScanImage(file.buffer, file.mimetype);

    const headerRect = {
      x: Math.max(0, Math.round(PAGE_MARGIN_LEFT_FRAC * scan.width)),
      y: Math.max(0, Math.round(LAYOUT.marginTopFrac * scan.height)),
      w: Math.max(1, Math.round(TABLE_WIDTH_FRAC * scan.width)),
      h: Math.max(1, Math.round((LAYOUT.headerHFrac + 0.01) * scan.height)),
    };

    const headerBuffer = await cropCell(scan.buffer, headerRect);
    const { text } = await recognizeBlockText(headerBuffer);
    return findMarksheetIdInText(text);
  } catch {
    return null;
  }
}

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
        let foundId = file ? await tryRecognizeHeaderMarksheetId(file) : null;

        const selectedContext = parseOptionalScanContext(req.body.context);
        const selectedMarksheetId = typeof req.body.marksheetId === "string"
          ? req.body.marksheetId.trim()
          : selectedContext?.marksheetId;
        const resolution = await resolveScanMarksheetContext(prisma, school.id, {
          recognizedMarksheetId: foundId,
          selectedMarksheetId,
          selectedContext,
        });

        if (!resolution.resolvedContext) {
          res.json({
            detected: null,
            detectionStatus: "NOT_FOUND",
            message: file
              ? "Marksheet ID not recognized. Confirm the marksheet context manually."
              : "No file uploaded and no marksheet ID provided.",
            ocrFoundId: foundId,
            recognizedMarksheetId: resolution.recognizedMarksheetId,
            normalizedMarksheetId: resolution.normalizedMarksheetId,
            selectedMarksheetId: resolution.selectedMarksheetId,
            resolvedContext: null,
            contextSource: resolution.contextSource,
            contextWarning: resolution.contextWarning,
          });
          return;
        }

        const detected = {
          ...resolution.resolvedContext,
          overallConfidence: resolution.contextSource === "recognized-id" ? 1 : 0.9,
          source: resolution.contextSource === "recognized-id" ? "HEADER_OCR" : "MANUAL",
          partial: false,
          message: resolution.contextWarning || "Context resolved.",
        };

        res.json({
          detected,
          detectionStatus: "DETECTED",
          message: resolution.contextWarning || "Context resolved.",
          ocrFoundId: foundId,
          recognizedMarksheetId: resolution.recognizedMarksheetId,
          normalizedMarksheetId: resolution.normalizedMarksheetId,
          selectedMarksheetId: resolution.selectedMarksheetId,
          resolvedContext: resolution.resolvedContext,
          contextSource: resolution.contextSource,
          contextWarning: resolution.contextWarning,
        });
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

        const schoolCode =
          typeof req.body.schoolCode === "string" ? req.body.schoolCode.trim() : "SCU-PREVIEW";

        // 3. Look up school
        const school = await prisma.school.findUnique({ where: { code: schoolCode } });
        if (!school) {
          res.status(404).json({ error: `School "${schoolCode}" was not found.` });
          return;
        }

        const selectedContext = parseOptionalScanContext(req.body.context);
        const selectedMarksheetId = typeof req.body.selectedMarksheetId === "string"
          ? req.body.selectedMarksheetId.trim()
          : selectedContext?.marksheetId;
        const bodyRecognizedId = typeof req.body.recognizedMarksheetId === "string"
          ? req.body.recognizedMarksheetId.trim()
          : "";
        const recognizedMarksheetId = bodyRecognizedId || await tryRecognizeHeaderMarksheetId(file);
        const contextResolution = await resolveScanMarksheetContext(prisma, school.id, {
          recognizedMarksheetId,
          selectedMarksheetId,
          selectedContext,
        });

        if (!contextResolution.resolvedContext) {
          res.status(400).json({
            error: "Marksheet context is required before extraction.",
            ...contextResolution,
          });
          return;
        }

        const context = scanContextSchema.parse(contextResolution.resolvedContext);

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
              recognizedMarksheetId: contextResolution.recognizedMarksheetId,
              normalizedMarksheetId: contextResolution.normalizedMarksheetId,
              selectedMarksheetId: contextResolution.selectedMarksheetId,
              resolvedContext: contextResolution.resolvedContext,
              contextSource: contextResolution.contextSource,
              contextWarning: contextResolution.contextWarning,
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
              recognizedMarksheetId: contextResolution.recognizedMarksheetId,
              normalizedMarksheetId: contextResolution.normalizedMarksheetId,
              selectedMarksheetId: contextResolution.selectedMarksheetId,
              resolvedContext: contextResolution.resolvedContext,
              contextSource: contextResolution.contextSource,
              contextWarning: contextResolution.contextWarning,
              rows: extraction.rows,
              message: extraction.message,
              configuredProvider: extraction.configuredProvider,
              activeProvider: extraction.activeProvider,
              providerUrl: extraction.providerUrl,
              providerReachable: extraction.providerReachable,
              fallbackReason: extraction.fallbackReason,
            }),
          },
        });

        res.json({
          batchId: batch.id,
          scanBatchId: batch.id,
          parseStatus: extraction.parseStatus,
          message: extraction.message,
          rows: extraction.rows,
          recognizedMarksheetId: contextResolution.recognizedMarksheetId,
          normalizedMarksheetId: contextResolution.normalizedMarksheetId,
          selectedMarksheetId: contextResolution.selectedMarksheetId,
          resolvedContext: contextResolution.resolvedContext,
          contextSource: contextResolution.contextSource,
          contextWarning: contextResolution.contextWarning,
          configuredProvider: extraction.configuredProvider,
          activeProvider: extraction.activeProvider,
          providerUrl: extraction.providerUrl,
          providerReachable: extraction.providerReachable,
          fallbackReason: extraction.fallbackReason,
        });
      } catch (error) {
        next(error);
      }
    },
  );

  router.post("/api/imports/scans/dry-run", async (req, res, next) => {
    try {
      const payload = z.object({
        schoolCode: z.string().default("SCU-PREVIEW"),
        batchId: z.string().optional(),
        context: scanContextSchema,
        rows: z.array(z.any()),
      }).parse(req.body);

      const school = await prisma.school.findUnique({ where: { code: payload.schoolCode } });
      if (!school) {
        res.status(404).json({ error: `School "${payload.schoolCode}" was not found.` });
        return;
      }

      const roster = await prisma.classEnrollment.findMany({
        where: {
          isActive: true,
          status: "ACTIVE",
          student: { schoolId: school.id },
          class: { schoolId: school.id, name: { contains: payload.context.className.trim(), mode: "insensitive" } },
          stream: { name: { contains: payload.context.streamName.trim(), mode: "insensitive" } },
        },
        include: { student: true },
        orderBy: { student: { admissionNumber: "asc" } },
      });

      const rows = validateScanRows(payload.rows, payload.context, roster.map((item) => ({
        admissionNumber: item.student.admissionNumber,
      })));

      if (payload.batchId) {
        const batch = await prisma.markImportBatch.findUnique({ where: { id: payload.batchId } });
        if (batch) {
          let parsed: Record<string, unknown> = {};
          try {
            parsed = JSON.parse(batch.summary ?? "{}") as Record<string, unknown>;
          } catch { /* keep empty */ }
          await prisma.markImportBatch.update({
            where: { id: payload.batchId },
            data: {
              summary: JSON.stringify({
                ...parsed,
                parseStatus: parsed["parseStatus"] ?? "PARSED",
                context: payload.context,
                rows,
              }),
            },
          });
        }
      }

      res.json({
        status: "DRY_RUN",
        totalRows: rows.length,
        validRows: rows.filter((row) => row.status === "VALID").length,
        missingRows: rows.filter((row) => row.status === "MISSING").length,
        reviewRows: rows.filter((row) => row.status === "NEEDS_REVIEW").length,
        invalidRows: rows.filter((row) => row.status === "INVALID").length,
        rows,
      });
    } catch (error) {
      next(error);
    }
  });

  router.post("/api/imports/scans/commit", async (req, res, next) => {
    try {
      const payload = z.object({
        schoolCode: z.string().default("SCU-PREVIEW"),
        context: scanContextSchema,
        rows: z.array(z.any()),
      }).parse(req.body);

      const school = await prisma.school.findUnique({
        where: { code: payload.schoolCode },
        include: {
          academicYears: { where: { isActive: true }, include: { terms: { where: { isActive: true } } } },
          classes: { include: { streams: true } },
          students: true,
          subjects: true,
        },
      });
      if (!school) {
        res.status(404).json({ error: `School "${payload.schoolCode}" was not found.` });
        return;
      }

      const roster = await prisma.classEnrollment.findMany({
        where: {
          isActive: true,
          status: "ACTIVE",
          student: { schoolId: school.id },
          class: { schoolId: school.id, name: { contains: payload.context.className.trim(), mode: "insensitive" } },
          stream: { name: { contains: payload.context.streamName.trim(), mode: "insensitive" } },
        },
        include: { student: true, class: true, stream: true },
        orderBy: { student: { admissionNumber: "asc" } },
      });

      const rows = validateScanRows(payload.rows, payload.context, roster.map((item) => ({
        admissionNumber: item.student.admissionNumber,
      })));
      const activeYear = school.academicYears[0];
      const activeTerm = activeYear?.terms[0];
      const klass = school.classes.find((item) => item.name.toLowerCase() === payload.context.className.toLowerCase());
      const stream = klass?.streams.find((item) => item.name.toLowerCase() === payload.context.streamName.toLowerCase());
      const subject = school.subjects.find((item) =>
        item.name.toLowerCase() === payload.context.subjectName.toLowerCase() ||
        item.code.toLowerCase() === payload.context.subjectName.toLowerCase()
      );

      if (!activeYear || !activeTerm || !klass || !stream || !subject) {
        res.status(400).json({ error: "Could not resolve active year, active term, class, stream, or subject for this scan." });
        return;
      }

      const validRows = rows.filter((row) => row.status === "VALID");
      const numericRows = validRows.filter((row) => {
        const mark = parseScanMark(row.operatorCorrection || row.extractedMark || row.suggestedMark || "");
        return mark !== "" && mark !== "AB" && mark !== "EX" && mark !== "INVALID";
      });

      if (numericRows.length === 0) {
        res.status(400).json({ error: "No numeric valid rows are ready to commit. Enter marks and run dry-run validation first." });
        return;
      }

      const batch = await prisma.markImportBatch.create({
        data: {
          schoolId: school.id,
          status: "COMMITTED",
          source: "scan",
          summary: JSON.stringify({
            scanMode: true,
            context: payload.context,
            committedRows: numericRows.length,
            skippedRows: rows.length - numericRows.length,
          }),
          rows: {
            create: rows.map((row) => ({
              rowNumber: row.rowNumber,
              raw: row,
              isValid: row.status === "VALID",
              errors: row.validationErrors,
            })),
          },
        },
      });

      for (const row of numericRows) {
        const enrollment = roster.find((item) => item.student.admissionNumber === row.admissionNumber);
        if (!enrollment) continue;
        const mark = Number(parseScanMark(row.operatorCorrection || row.extractedMark || row.suggestedMark || ""));

        await prisma.subjectMark.upsert({
          where: {
            studentId_subjectId_termId_assessmentType: {
              studentId: enrollment.student.id,
              subjectId: subject.id,
              termId: activeTerm.id,
              assessmentType: toAssessmentType(payload.context.examType),
            },
          },
          update: {
            marks: mark,
            comments: row.remarks || null,
            status: finalizedStatus(),
            importBatchId: batch.id,
          },
          create: {
            schoolId: school.id,
            studentId: enrollment.student.id,
            academicYearId: activeYear.id,
            termId: activeTerm.id,
            classId: klass.id,
            streamId: stream.id,
            subjectId: subject.id,
            assessmentType: toAssessmentType(payload.context.examType),
            marks: mark,
            comments: row.remarks || null,
            status: finalizedStatus(),
            importBatchId: batch.id,
          },
        });
      }

      res.json({
        status: "COMMITTED",
        totalRows: rows.length,
        validRows: validRows.length,
        missingRows: rows.filter((row) => row.status === "MISSING").length,
        reviewRows: rows.filter((row) => row.status === "NEEDS_REVIEW").length,
        invalidRows: rows.filter((row) => row.status === "INVALID").length,
        committedRows: numericRows.length,
        skippedRows: rows.length - numericRows.length,
        rows,
        message: `Committed ${numericRows.length} scanned mark rows. Skipped ${rows.length - numericRows.length} rows that were missing, non-numeric, or needed review.`,
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * GET /api/imports/scan-batches/:batchId
   *
   * Reload a previously extracted scan batch by ID.
   * Used by the UI to restore extraction state after a page refresh.
   */
  router.get("/api/imports/scan-batches/:batchId", async (req, res, next) => {
    try {
      const { batchId } = req.params;
      const batch = await prisma.markImportBatch.findUnique({ where: { id: batchId } });
      if (!batch) {
        res.status(404).json({ error: `Scan batch "${batchId}" not found.` });
        return;
      }

      let parsed: Record<string, unknown> = {};
      try {
        parsed = JSON.parse(batch.summary ?? "{}") as Record<string, unknown>;
      } catch {
        /* ignore invalid JSON */
      }

      res.json({
        batchId: batch.id,
        scanBatchId: batch.id,
        parseStatus: parsed["parseStatus"] ?? "UPLOADED",
        message: (parsed["message"] as string | undefined) ?? "",
        rows: (parsed["rows"] as unknown[]) ?? [],
        context: parsed["context"] ?? null,
        recognizedMarksheetId: (parsed["recognizedMarksheetId"] as string | undefined) ?? null,
        normalizedMarksheetId: (parsed["normalizedMarksheetId"] as string | undefined) ?? "",
        selectedMarksheetId: (parsed["selectedMarksheetId"] as string | undefined) ?? "",
        resolvedContext: parsed["resolvedContext"] ?? parsed["context"] ?? null,
        contextSource: (parsed["contextSource"] as string | undefined) ?? "manual-required",
        contextWarning: (parsed["contextWarning"] as string | undefined) ?? "",
        fileName: (parsed["fileName"] as string | undefined) ?? "",
        configuredProvider: (parsed["configuredProvider"] as string | undefined) ?? "",
        activeProvider: (parsed["activeProvider"] as string | undefined) ?? "",
        providerUrl: (parsed["providerUrl"] as string | undefined) ?? "",
        providerReachable: parsed["providerReachable"] ?? false,
        fallbackReason: (parsed["fallbackReason"] as string | undefined) ?? "",
        createdAt: batch.createdAt.toISOString(),
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
          message: (parsed["message"] as string | undefined) ?? "",
          context: parsed["context"] ?? null,
          recognizedMarksheetId: parsed["recognizedMarksheetId"] ?? null,
          normalizedMarksheetId: parsed["normalizedMarksheetId"] ?? "",
          selectedMarksheetId: parsed["selectedMarksheetId"] ?? "",
          resolvedContext: parsed["resolvedContext"] ?? parsed["context"] ?? null,
          contextSource: parsed["contextSource"] ?? "manual-required",
          contextWarning: parsed["contextWarning"] ?? "",
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
