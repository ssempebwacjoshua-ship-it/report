import { Router } from "express";
import { createHash } from "node:crypto";
import multer from "multer";
import { z } from "zod";
import { prisma } from "../db/prisma";
import { commitMarksImport, dryRunMarksImport } from "../services/marksImportService";
import { finalizedStatus, toAssessmentType } from "../services/marksImportValidator";
import {
  findMarksheetIdBySheetNumber,
  resolveContextByMarksheetId,
  resolveScanMarksheetContext,
} from "../services/marksheetContextService";
import {
  detectMarksheetIdFromScan,
  saveMarksheetIdLookupDebug,
  type MarksheetIdDetectionResult,
} from "../services/marksheetIdDetectionService";
import { extractMarksFromScan } from "../services/scanExtractionService";
import { parseScanMark, validateScanRows } from "../services/scanImportValidator";
import { getSettingsSections } from "../repositories/settingsRepository";

const SCAN_FILE_TYPES = new Set(["PDF", "PNG", "JPG", "JPEG", "WEBP"]);

function importErr(code: string, message: string, extra?: Record<string, unknown>) {
  return { error: true as const, code, message, details: [] as string[], ...extra };
}

function isCsvParseError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const code = (error as { code?: unknown }).code;
  return typeof code === "string" && (code.startsWith("CSV_") || code === "INVALID_COLUMN_DEFINITION");
}

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

async function tryDetectMarksheetId(file: Express.Multer.File): Promise<MarksheetIdDetectionResult | null> {
  try {
    return await detectMarksheetIdFromScan(file.buffer, file.mimetype);
  } catch {
    return null;
  }
}

function detectionMetadata(detection: MarksheetIdDetectionResult | null) {
  return {
    rawRecognizedId: detection?.rawRecognizedId ?? null,
    normalizedRecognizedId: detection?.normalizedRecognizedId ?? "",
    matchConfidence: detection?.confidence ?? 0,
    matchSource: detection?.matchSource ?? undefined,
    marksheetIdDebug: detection?.debug,
  };
}

function scanDryRunFingerprint(schoolCode: string, context: unknown, rows: unknown): string {
  return createHash("sha256")
    .update(`${schoolCode}\n${JSON.stringify(context)}\n${JSON.stringify(rows)}`)
    .digest("hex");
}

async function recordScanDryRun(schoolId: string, fingerprint: string) {
  await prisma.auditLog.create({
    data: {
      schoolId,
      action: "scan.dry_run",
      correlationId: fingerprint,
      details: { fingerprint },
    },
  });
}

async function hasRecentScanDryRun(schoolId: string, fingerprint: string) {
  const since = new Date(Date.now() - 1000 * 60 * 60 * 4);
  const log = await prisma.auditLog.findFirst({
    where: {
      schoolId,
      action: "scan.dry_run",
      correlationId: fingerprint,
      createdAt: { gte: since },
    },
  });
  return Boolean(log);
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
      if (isCsvParseError(error)) {
        res.status(400).json(importErr(
          "TEMPLATE_ERROR",
          "The marks sheet could not be parsed. Check that columns match the required template (admissionNumber, class, stream, subject, term, examType, marks).",
          { details: [error instanceof Error ? error.message : String(error)] },
        ));
        return;
      }
      next(error);
    }
  });

  router.post("/api/imports/marks/commit", async (req, res, next) => {
    try {
      const payload = importPayload.parse(req.body);
      res.json(await commitMarksImport(prisma, payload.schoolCode, payload.csvText));
    } catch (error) {
      if (isCsvParseError(error)) {
        res.status(400).json(importErr(
          "TEMPLATE_ERROR",
          "The marks sheet could not be parsed. Check that columns match the required template (admissionNumber, class, stream, subject, term, examType, marks).",
          { details: [error instanceof Error ? error.message : String(error)] },
        ));
        return;
      }
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
          res.status(404).json(importErr("SCHOOL_NOT_FOUND", `School "${schoolCode}" was not found.`));
          return;
        }

        const file = req.file;
        const idDetection = file ? await tryDetectMarksheetId(file) : null;
        let foundId = idDetection?.rawRecognizedId || null;

        if (!foundId && idDetection?.recognizedSheetNumber) {
          foundId = await findMarksheetIdBySheetNumber(prisma, school.id, idDetection.recognizedSheetNumber) ?? null;
          console.log(
            `[id-detection] sheet-number-lookup sheetNumber=${idDetection.recognizedSheetNumber}` +
            ` resolved=${foundId ?? "none"}`,
          );
        }

        const selectedContext = parseOptionalScanContext(req.body.context);
        const selectedMarksheetId = typeof req.body.marksheetId === "string"
          ? req.body.marksheetId.trim()
          : selectedContext?.marksheetId;
        const resolution = await resolveScanMarksheetContext(prisma, school.id, {
          recognizedMarksheetId: foundId,
          recognizedMatchSource: idDetection?.matchSource,
          recognizedMatchConfidence: idDetection?.confidence,
          selectedMarksheetId,
          selectedContext,
        });
        await saveMarksheetIdLookupDebug(idDetection, {
          contextSource: resolution.contextSource,
          matchedMarksheetId: resolution.matchedMarksheetId,
          resolved: Boolean(resolution.resolvedContext),
          warning: resolution.contextWarning,
        });
        const matchMetadata = detectionMetadata(idDetection);

        if (!resolution.resolvedContext) {
          res.json({
            detected: null,
            detectionStatus: "NOT_FOUND",
            message: file
              ? "Could not read the marksheet ID from the top-right corner. Please upload a clearer image or enter the sheet ID manually."
              : "No file uploaded and no marksheet ID provided.",
            ocrFoundId: foundId,
            recognizedMarksheetId: resolution.recognizedMarksheetId,
            normalizedMarksheetId: resolution.normalizedMarksheetId,
            rawRecognizedId: resolution.rawRecognizedId,
            normalizedRecognizedId: resolution.normalizedRecognizedId,
            matchedMarksheetId: resolution.matchedMarksheetId,
            matchConfidence: resolution.matchConfidence || matchMetadata.matchConfidence,
            matchSource: resolution.matchSource,
            marksheetIdDebug: matchMetadata.marksheetIdDebug,
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
          rawRecognizedId: resolution.rawRecognizedId,
          normalizedRecognizedId: resolution.normalizedRecognizedId,
          matchedMarksheetId: resolution.matchedMarksheetId,
          matchConfidence: resolution.matchConfidence || matchMetadata.matchConfidence,
          matchSource: resolution.matchSource,
          marksheetIdDebug: matchMetadata.marksheetIdDebug,
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
      let marksheetId = String(req.query.marksheetId ?? "").trim();
      const schoolCode = String(req.query.schoolCode ?? "SCU-PREVIEW").trim();

      if (!marksheetId) {
        res.status(400).json(importErr("MISSING_MARKSHEET_ID", "marksheetId query parameter is required."));
        return;
      }

      const school = await prisma.school.findUnique({ where: { code: schoolCode } });
      if (!school) {
        res.status(404).json(importErr("SCHOOL_NOT_FOUND", `School "${schoolCode}" was not found.`));
        return;
      }

      // Accept sheet number (YYYYMMDD-NNN) in addition to full MS-... IDs
      if (/^\d{8}-\d{3}$/.test(marksheetId)) {
        const resolved = await findMarksheetIdBySheetNumber(prisma, school.id, marksheetId);
        if (resolved) marksheetId = resolved;
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
          res.status(400).json(importErr(
            "MISSING_FILE",
            "No scan file uploaded. Attach a PNG, JPG, JPEG, WEBP, or PDF scan.",
          ));
          return;
        }

        // 2. Validate file type from extension
        const ext = (file.originalname.split(".").pop() ?? "").trim().toUpperCase();
        if (!SCAN_FILE_TYPES.has(ext)) {
          res.status(400).json(importErr(
            "UNSUPPORTED_FILE_TYPE",
            `Unsupported file type: .${ext.toLowerCase()}. Accepted formats: PDF, PNG, JPG, JPEG, WEBP.`,
          ));
          return;
        }

        const schoolCode =
          typeof req.body.schoolCode === "string" ? req.body.schoolCode.trim() : "SCU-PREVIEW";
        const settings = await getSettingsSections(prisma, schoolCode);

        // 3. Look up school
        const school = await prisma.school.findUnique({ where: { code: schoolCode } });
        if (!school) {
          res.status(404).json(importErr("SCHOOL_NOT_FOUND", `School "${schoolCode}" was not found.`));
          return;
        }

        const selectedContext = parseOptionalScanContext(req.body.context);
        const selectedMarksheetId = typeof req.body.selectedMarksheetId === "string"
          ? req.body.selectedMarksheetId.trim()
          : selectedContext?.marksheetId;
        const bodyRecognizedId = typeof req.body.recognizedMarksheetId === "string"
          ? req.body.recognizedMarksheetId.trim()
          : "";
        const idDetection = bodyRecognizedId ? null : await tryDetectMarksheetId(file);
        let resolvedIdFromScan = idDetection?.rawRecognizedId ?? "";
        if (!resolvedIdFromScan && idDetection?.recognizedSheetNumber) {
          resolvedIdFromScan = await findMarksheetIdBySheetNumber(prisma, school.id, idDetection.recognizedSheetNumber) ?? "";
          console.log(
            `[id-detection] sheet-number-lookup sheetNumber=${idDetection.recognizedSheetNumber}` +
            ` resolved=${resolvedIdFromScan || "none"}`,
          );
        }
        const recognizedMarksheetId = bodyRecognizedId || resolvedIdFromScan;
        const contextResolution = await resolveScanMarksheetContext(prisma, school.id, {
          recognizedMarksheetId,
          recognizedMatchSource: idDetection?.matchSource,
          recognizedMatchConfidence: idDetection?.confidence,
          selectedMarksheetId,
          selectedContext,
        });
        await saveMarksheetIdLookupDebug(idDetection, {
          contextSource: contextResolution.contextSource,
          matchedMarksheetId: contextResolution.matchedMarksheetId,
          resolved: Boolean(contextResolution.resolvedContext),
          warning: contextResolution.contextWarning,
        });

        if (!contextResolution.resolvedContext) {
          // Distinguish: no user-provided context (OCR failed) vs. user provided context that
          // still could not be resolved (wrong class/subject/etc).
          const userProvidedContext = !!(selectedContext || selectedMarksheetId || bodyRecognizedId);
          const code = userProvidedContext ? "CONTEXT_REQUIRED" : "SHEET_ID_NOT_DETECTED";
          const message = userProvidedContext
            ? "Marksheet context is required before extraction. Provide or confirm the class, stream, subject, term, and exam type."
            : "Could not read the marksheet ID from the top-right corner. Please upload a clearer image or enter the sheet ID manually.";
          res.status(400).json(importErr(code, message, { marksheetIdDebug: idDetection?.debug, ...contextResolution }));
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
              rawRecognizedId: contextResolution.rawRecognizedId,
              normalizedRecognizedId: contextResolution.normalizedRecognizedId,
              matchedMarksheetId: contextResolution.matchedMarksheetId,
              matchConfidence: contextResolution.matchConfidence,
              matchSource: contextResolution.matchSource,
              marksheetIdDebug: idDetection?.debug,
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
          settings.ocr,
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
              rawRecognizedId: contextResolution.rawRecognizedId,
              normalizedRecognizedId: contextResolution.normalizedRecognizedId,
              matchedMarksheetId: contextResolution.matchedMarksheetId,
              matchConfidence: contextResolution.matchConfidence,
              matchSource: contextResolution.matchSource,
              marksheetIdDebug: idDetection?.debug,
              selectedMarksheetId: contextResolution.selectedMarksheetId,
              resolvedContext: contextResolution.resolvedContext,
              contextSource: contextResolution.contextSource,
              contextWarning: contextResolution.contextWarning,
              rows: extraction.rows,
              message: extraction.message,
              configuredProvider: extraction.configuredProvider,
              activeProvider: extraction.activeProvider,
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
          rawRecognizedId: contextResolution.rawRecognizedId,
          normalizedRecognizedId: contextResolution.normalizedRecognizedId,
          matchedMarksheetId: contextResolution.matchedMarksheetId,
          matchConfidence: contextResolution.matchConfidence,
          matchSource: contextResolution.matchSource,
          marksheetIdDebug: idDetection?.debug,
          selectedMarksheetId: contextResolution.selectedMarksheetId,
          resolvedContext: contextResolution.resolvedContext,
          contextSource: contextResolution.contextSource,
          contextWarning: contextResolution.contextWarning,
          configuredProvider: extraction.configuredProvider,
          activeProvider: extraction.activeProvider,
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
        res.status(404).json(importErr("SCHOOL_NOT_FOUND", `School "${payload.schoolCode}" was not found.`));
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
      })), {
        minimumConfidenceForSuggestion: (await getSettingsSections(prisma, payload.schoolCode)).ocr.minimumConfidenceForSuggestion,
      });
      const settings = await getSettingsSections(prisma, payload.schoolCode);
      if (settings.approval.keepAuditTrail) {
        await recordScanDryRun(school.id, scanDryRunFingerprint(payload.schoolCode, payload.context, rows));
      }

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
        res.status(404).json(importErr("SCHOOL_NOT_FOUND", `School "${payload.schoolCode}" was not found.`));
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
      })), {
        minimumConfidenceForSuggestion: (await getSettingsSections(prisma, payload.schoolCode)).ocr.minimumConfidenceForSuggestion,
      });
      const settings = await getSettingsSections(prisma, payload.schoolCode);
      if (settings.approval.requireDryRunBeforeCommit) {
        const fingerprint = scanDryRunFingerprint(payload.schoolCode, payload.context, rows);
        if (!(await hasRecentScanDryRun(school.id, fingerprint))) {
          res.status(400).json(importErr(
            "DRY_RUN_REQUIRED",
            "Dry-run validation is required before committing scanned marks. Run dry-run first, then commit.",
          ));
          return;
        }
      }
      const activeYear = school.academicYears[0];
      const activeTerm = activeYear?.terms[0];
      const klass = school.classes.find((item) => item.name.toLowerCase() === payload.context.className.toLowerCase());
      const stream = klass?.streams.find((item) => item.name.toLowerCase() === payload.context.streamName.toLowerCase());
      const subject = school.subjects.find((item) =>
        item.name.toLowerCase() === payload.context.subjectName.toLowerCase() ||
        item.code.toLowerCase() === payload.context.subjectName.toLowerCase()
      );

      if (!activeYear || !activeTerm || !klass || !stream || !subject) {
        res.status(400).json(importErr(
          "SCAN_SETUP_REQUIRED",
          "Could not resolve active year, active term, class, stream, or subject for this scan. " +
          "Check that the class name, stream, and subject match the school's configuration.",
        ));
        return;
      }

      const validRows = rows.filter((row) => row.status === "VALID");
      const numericRows = validRows.filter((row) => {
        const mark = parseScanMark(row.operatorCorrection || row.extractedMark || row.suggestedMark || "");
        return mark !== "" && mark !== "AB" && mark !== "EX" && mark !== "INVALID";
      });

      if (numericRows.length === 0) {
        res.status(400).json(importErr(
          "NO_VALID_ROWS",
          "No numeric valid rows are ready to commit. Enter marks and run dry-run validation first.",
        ));
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
        res.status(404).json(importErr("SERVER_ERROR", `Scan batch "${batchId}" not found.`));
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
        rawRecognizedId: (parsed["rawRecognizedId"] as string | undefined) ?? null,
        normalizedRecognizedId: (parsed["normalizedRecognizedId"] as string | undefined) ?? "",
        matchedMarksheetId: (parsed["matchedMarksheetId"] as string | undefined) ?? "",
        matchConfidence: (parsed["matchConfidence"] as number | undefined) ?? 0,
        matchSource: parsed["matchSource"] ?? "manual-required",
        marksheetIdDebug: parsed["marksheetIdDebug"] ?? undefined,
        selectedMarksheetId: (parsed["selectedMarksheetId"] as string | undefined) ?? "",
        resolvedContext: parsed["resolvedContext"] ?? parsed["context"] ?? null,
        contextSource: (parsed["contextSource"] as string | undefined) ?? "manual-required",
        contextWarning: (parsed["contextWarning"] as string | undefined) ?? "",
        fileName: (parsed["fileName"] as string | undefined) ?? "",
        configuredProvider: (parsed["configuredProvider"] as string | undefined) ?? "",
        activeProvider: (parsed["activeProvider"] as string | undefined) ?? "",
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
          rawRecognizedId: parsed["rawRecognizedId"] ?? null,
          normalizedRecognizedId: parsed["normalizedRecognizedId"] ?? "",
          matchedMarksheetId: parsed["matchedMarksheetId"] ?? "",
          matchConfidence: parsed["matchConfidence"] ?? 0,
          matchSource: parsed["matchSource"] ?? "manual-required",
          marksheetIdDebug: parsed["marksheetIdDebug"] ?? undefined,
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
