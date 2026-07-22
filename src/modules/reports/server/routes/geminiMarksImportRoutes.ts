import type { NextFunction, Request, Response } from "express";
import { Router } from "express";
import multer from "multer";
import { prisma } from "../../../../server/db/prisma";
import {
  getClassesForSections,
  isCanonicalClassCode,
  type SchoolSection,
} from "../../../../shared/constants/classes";
import { verifyToken } from "../../../../server/services/authService";
import { extractMarksWithGemini } from "../../../../server/services/geminiOcrService";
import {
  loadExpectedStudents,
  validateAndMatchGeminiRows,
} from "../services/geminiMarksImportService";
import { validateScore } from "../../../../shared/utils/validateScore";
import { createHash } from "node:crypto";
import { canUseCredits, deductPages, isDuplicateJob } from "../../../../server/services/smartPagesService";
import { requireSubscriptionEntitlement } from "../../../../server/services/subscriptionEntitlementService";

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const SCAN_MIME_TYPES = new Set([
  "image/png",
  "image/jpg",
  "image/jpeg",
  "image/webp",
  "application/pdf",
]);
const SCAN_FILE_EXTENSIONS = new Set(["PNG", "JPG", "JPEG", "WEBP", "PDF"]);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const VALID_EXAM_TYPES = new Set(["BOT", "MOT", "EOT"]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_BYTES },
});

function stageErr(
  reqId: string,
  stage: string,
  code: string,
  error: string,
  extra?: Record<string, unknown>,
) {
  return {
    success: false as const,
    requestId: reqId,
    stage,
    code,
    error,
    message: error,
    ...extra,
  };
}

// Kept for auth middleware responses (no stage concept there).
function importErr(code: string, message: string) {
  return { success: false as const, code, message };
}

function estimatePdfPageCount(buffer: Buffer, mimeType: string): number {
  if (!mimeType.toLowerCase().includes("pdf")) return 1;
  const str = buffer.toString("binary");
  const matches = str.match(/\/Type\s*\/Page[^s]/g);
  return Math.max(1, matches?.length ?? 1);
}

function requireImportAuth(req: Request, res: Response, next: NextFunction): void {
  if (process.env.NODE_ENV !== "production") {
    next();
    return;
  }
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  const payload = token ? verifyToken(token) : null;
  if (!payload) {
    res.status(401).json(importErr("AUTH_REQUIRED", "Authentication required for marks import."));
    return;
  }
  req.user = payload;
  next();
}

export default function geminiMarksImportRoutes() {
  const router = Router();

  /**
   * POST /api/marks-import/scan/extract
   *
   * Multipart: image, classId, streamId, subjectId, termId, examType.
   * Extracts marks with Gemini, runs deterministic backend validation + DB student
   * matching, records a (non-committing) scan job, and returns a review payload.
   * NEVER persists marks.
   *
   * ?debugNoDb=true ? skips all DB calls (school/class/student/batch) so Gemini
   * can be isolated from DB wiring issues during diagnosis.
   */
  router.post(
    "/api/marks-import/scan/extract",
    requireImportAuth,
    requireSubscriptionEntitlement("ocr.scan"),
    upload.single("image"),
    async (req: Request, res: Response, _next: NextFunction) => {
      const reqId = (req.headers["x-request-id"] as string | undefined)
        ?? `gx-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
      let stage = "request_received";

      try {
        // ── Stage: request_received ? file validation ──────────────────────
        const file = req.file;
        if (!file) {
          res.status(400).json(stageErr(reqId, stage, "MISSING_IMAGE", "No image uploaded. Attach a PNG, JPG, JPEG, WEBP, or PDF marksheet."));
          return;
        }
        if (file.size > MAX_FILE_BYTES) {
          res.status(400).json(stageErr(reqId, stage, "FILE_TOO_LARGE", "Image is too large. Maximum scan size is 10 MB."));
          return;
        }
        const ext = (file.originalname.split(".").pop() ?? "").trim().toUpperCase();
        const mimeOk = SCAN_MIME_TYPES.has((file.mimetype || "").toLowerCase());
        const extOk = SCAN_FILE_EXTENSIONS.has(ext);
        if (!mimeOk && !extOk) {
          res.status(400).json(stageErr(
            reqId, stage, "UNSUPPORTED_FILE_TYPE",
            `Unsupported file type: .${ext.toLowerCase() || "unknown"}. Accepted formats: PNG, JPG, JPEG, WEBP, PDF.`,
          ));
          return;
        }

        // ── Stage: validate_context ────────────────────────────────────────
        stage = "validate_context";

        const classId = typeof req.body.classId === "string" ? req.body.classId.trim() : "";
        const streamId = typeof req.body.streamId === "string" ? req.body.streamId.trim() : "";
        const subjectId = typeof req.body.subjectId === "string" ? req.body.subjectId.trim() : "";
        const termId = typeof req.body.termId === "string" ? req.body.termId.trim() : "";
        const examType = typeof req.body.examType === "string" ? req.body.examType.trim() : "";
        const debugNoDb = req.query.debugNoDb === "true";

        const missing: string[] = [];
        if (!classId) missing.push("classId");
        if (!subjectId) missing.push("subjectId");
        if (!termId) missing.push("termId");
        if (!examType) missing.push("examType");
        if (missing.length > 0) {
          res.status(400).json(stageErr(reqId, stage, "MISSING_CONTEXT", `Missing required fields: ${missing.join(", ")}.`, { fields: missing }));
          return;
        }

        // Log the full request as early as possible so Railway always shows it.
        console.log("[gemini-extract]", {
          reqId, stage: "request_received",
          file: { name: file.originalname, sizeKB: Math.round(file.size / 1024), mime: file.mimetype },
          context: { classId, streamId: streamId || null, subjectId, termId, examType },
          debugNoDb,
        });

        // Validate IDs are proper UUIDs before sending to Prisma.
        const invalidId =
          !UUID_RE.test(classId) ||
          (streamId.length > 0 && !UUID_RE.test(streamId)) ||
          !UUID_RE.test(subjectId) ||
          !UUID_RE.test(termId);
        if (invalidId) {
          res.status(400).json(stageErr(reqId, stage, "INVALID_ID", "Please select class, subject, term and exam type from the list."));
          return;
        }
        if (!VALID_EXAM_TYPES.has(examType)) {
          res.status(400).json(stageErr(reqId, stage, "INVALID_ID", "Please select class, subject, term and exam type from the list."));
          return;
        }

        // DB context validation ? skipped entirely when debugNoDb=true.
        let schoolId = "";
        if (!debugNoDb) {
          console.log("[gemini-extract]", { reqId, stage, event: "resolving_context" });

          const school = req.school!;
          schoolId = school.id;

          const klass = await prisma.schoolClass.findFirst({
            where: { id: classId, schoolId: school.id },
            include: { streams: { select: { id: true } } },
          });
          if (!klass) {
            res.status(404).json(stageErr(reqId, stage, "CLASS_NOT_FOUND", "Selected class was not found for this school."));
            return;
          }
          if (klass.streams.length > 0 && !streamId) {
            res.status(400).json(stageErr(reqId, stage, "MISSING_CONTEXT", "Missing required fields: streamId.", { fields: ["streamId"] }));
            return;
          }

          const [subject, term, stream] = await Promise.all([
            prisma.subject.findFirst({ where: { id: subjectId, schoolId: school.id } }),
            prisma.term.findFirst({ where: { id: termId, academicYear: { schoolId: school.id } } }),
            streamId
              ? prisma.stream.findFirst({ where: { id: streamId, schoolId: school.id, classId } })
              : Promise.resolve(null),
          ]);
          if (!subject) {
            res.status(404).json(stageErr(reqId, stage, "SUBJECT_NOT_FOUND", "Selected subject was not found for this school."));
            return;
          }
          if (!term) {
            res.status(404).json(stageErr(reqId, stage, "TERM_NOT_FOUND", "Selected term was not found for this school."));
            return;
          }
          if (streamId && !stream) {
            res.status(404).json(stageErr(reqId, stage, "STREAM_NOT_FOUND", "Selected stream does not belong to the selected class."));
            return;
          }
          console.log("[gemini-extract]", { reqId, stage, event: "context_validated", schoolId });
        }

        // ── Stage: check_billing ───────────────────────────────────────────
        stage = "check_billing";
        let compoundHash = "";
        let estimatedPages = 1;

        if (!debugNoDb) {
          const contextStr = `${classId}|${streamId}|${subjectId}|${termId}|${examType}`;
          const fileContentHash = createHash("sha256").update(file.buffer).digest("hex");
          compoundHash = createHash("sha256")
            .update(`${fileContentHash}:${contextStr}`)
            .digest("hex");
          estimatedPages = estimatePdfPageCount(file.buffer, file.mimetype);

          if (req.user?.role === "TEACHER") {
            res.status(403).json(stageErr(reqId, stage, "TEACHER_NOT_PERMITTED",
              "Teachers are not allowed to use Smart Marksheet Import. Contact your school administrator."));
            return;
          }

          const isDuplicate = await isDuplicateJob(schoolId, compoundHash);
          if (isDuplicate) {
            res.status(409).json(stageErr(reqId, stage, "DUPLICATE_JOB",
              "This marksheet has already been processed for the same class and subject. Resubmit with a new image to run another extraction."));
            return;
          }

          const balanceCheck = await canUseCredits(schoolId, estimatedPages);
          if (!balanceCheck.allowed) {
            res.status(402).json(stageErr(reqId, stage, balanceCheck.code ?? "SMART_PAGES_EXHAUSTED",
              balanceCheck.message ?? "You have no Smart Pages remaining. Go to Billing to buy more pages."));
            return;
          }

          console.log("[gemini-extract]", { reqId, stage, event: "billing_ok", estimatedPages });
        }

        // ── Stage: load_expected_students ──────────────────────────────────
        stage = "load_expected_students";
        let expectedStudents: Awaited<ReturnType<typeof loadExpectedStudents>> = [];

        if (!debugNoDb) {
          console.log("[gemini-extract]", { reqId, stage, event: "start" });
          expectedStudents = await loadExpectedStudents(prisma, {
            schoolId,
            classId,
            streamId: streamId || undefined,
            termId,
          });
          if (expectedStudents.length === 0) {
            console.warn("[gemini-extract]", { reqId, stage, event: "no_students" });
            res.status(400).json(stageErr(reqId, stage, "NO_STUDENTS", "No active students found for the selected class and stream."));
            return;
          }
          console.log("[gemini-extract]", { reqId, stage, event: "done", count: expectedStudents.length });
        } else {
          console.log("[gemini-extract]", { reqId, stage, event: "skipped_debug" });
        }

        // ── Stage: gemini_extract ──────────────────────────────────────────
        stage = "gemini_extract";
        console.log("[gemini-extract]", { reqId, stage, event: "start" });
        const geminiStart = Date.now();
        const { rows: geminiRows } = await extractMarksWithGemini(file.buffer, file.mimetype || "image/jpeg");
        console.log("[gemini-extract]", { reqId, stage, event: "done", durationMs: Date.now() - geminiStart, rawRows: geminiRows.length });

        // ── Stage: validate_and_match_rows ────────────────────────────────
        stage = "validate_and_match_rows";
        console.log("[gemini-extract]", { reqId, stage, event: "start" });
        const validationStart = Date.now();
        const { rows, summary } = validateAndMatchGeminiRows(geminiRows, expectedStudents);
        console.log("[gemini-extract]", { reqId, stage, event: "done", durationMs: Date.now() - validationStart, summary });

        // ── Stage: create_import_batch ─────────────────────────────────────
        stage = "create_import_batch";
        let jobId = `gemini-scan-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

        if (!debugNoDb) {
          console.log("[gemini-extract]", { reqId, stage, event: "start" });
          try {
            const batch = await prisma.markImportBatch.create({
              data: {
                schoolId,
                status: "DRY_RUN",
                source: "scan-gemini",
                summary: JSON.stringify({
                  scanMode: true,
                  provider: "gemini",
                  parseStatus: "PARSED",
                  committed: false,
                  fileName: file.originalname,
                  fileType: ext,
                  fileSize: file.size,
                  context: { classId, streamId: streamId || null, subjectId, termId, examType },
                  summary,
                  rows,
                }),
              },
            });
            jobId = batch.id;
            console.log("[gemini-extract]", { reqId, stage, event: "created", jobId });
          } catch (batchErr) {
            const batchMsg = batchErr instanceof Error ? batchErr.message : String(batchErr);
            const batchStack = batchErr instanceof Error ? batchErr.stack : undefined;
            console.error("[gemini-extract]", { reqId, stage, event: "error", message: batchMsg, stack: batchStack });
            res.status(400).json(stageErr(reqId, stage, "BATCH_CREATE_FAILED", "Could not create import review batch."));
            return;
          }

          // Deduct Smart Pages for the marksheet extraction.
          if (compoundHash) {
            stage = "bill_pages";
            try {
              await deductPages(schoolId, {
                jobId,
                fileHash: compoundHash,
                pagesCharged: estimatedPages,
                extractionMode: "balanced",
                provider: "gemini",
                model: "gemini-2.0-flash",
                reason: `marksheet-import:${file.originalname.slice(0, 80)}`,
              });
              console.log("[gemini-extract]", { reqId, stage, event: "billed", pages: estimatedPages, jobId });
            } catch (billErr: unknown) {
              const billMsg = billErr instanceof Error ? billErr.message : String(billErr);
              const billCode = (billErr as { code?: string }).code;
              console.error("[gemini-extract]", { reqId, stage, event: "billing_failed", message: billMsg });
              res.status(402).json(stageErr(reqId, stage, billCode ?? "BILLING_ERROR",
                billMsg || "Could not record page usage. Please contact support."));
              return;
            }
          }
        }

        // ── Stage: response_sent ───────────────────────────────────────────
        stage = "response_sent";
        console.log("[gemini-extract]", { reqId, stage, event: "ok", jobId, count: rows.length });
        res.json({ success: true, requestId: reqId, jobId, count: rows.length, summary, rows });

      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unexpected error";
        const stack = error instanceof Error ? error.stack : undefined;
        console.error("[gemini-extract]", { reqId, stage, event: "uncaught_error", message, stack });

        // ── Application-level 400s ─────────────────────────────────────────
        if (message === "Uploaded document does not look like a marksheet.") {
          res.status(400).json(stageErr(reqId, "gemini_extract", "NOT_MARKSHEET", message));
          return;
        }
        if (
          message === "Gemini returned empty response" ||
          message === "Gemini returned invalid JSON" ||
          message === "Gemini response missing rows array"
        ) {
          res.status(400).json(stageErr(reqId, "gemini_extract", "GEMINI_PARSE_ERROR", "Could not read this marksheet. Please try a clearer image."));
          return;
        }

        // ── Gemini service-level 503s ──────────────────────────────────────
        if (message === "Missing GEMINI_API_KEY") {
          res.status(503).json(stageErr(reqId, "gemini_extract", "GEMINI_NOT_CONFIGURED", "Gemini AI is not configured on this server. Please contact support."));
          return;
        }
        if (/api.?key.*(invalid|not valid|expired)|PERMISSION_DENIED|permission denied|unauthorized/i.test(message)) {
          res.status(503).json(stageErr(reqId, "gemini_extract", "GEMINI_AUTH_ERROR", "Gemini AI authentication failed. Please contact support."));
          return;
        }
        if (/RESOURCE_EXHAUSTED|resource exhausted|quota|rate.?limit|too many requests/i.test(message)) {
          res.status(503).json(stageErr(reqId, "gemini_extract", "GEMINI_RATE_LIMIT", "Gemini AI is temporarily unavailable (rate limit). Please wait a moment and try again."));
          return;
        }
        const cause = error instanceof Error ? String((error as NodeJS.ErrnoException).cause ?? "") : "";
        if (/fetch failed|ECONNRESET|ENOTFOUND|ETIMEDOUT/i.test(message) || /fetch failed|ECONNRESET|ENOTFOUND|ETIMEDOUT/i.test(cause)) {
          res.status(503).json(stageErr(reqId, "gemini_extract", "GEMINI_NETWORK_ERROR", "Could not reach the Gemini AI service from this server. Check internet, DNS, proxy, or firewall."));
          return;
        }
        if (/UNAVAILABLE|unavailable|network.*error|timeout|ECONNREFUSED/i.test(message)) {
          res.status(503).json(stageErr(reqId, "gemini_extract", "GEMINI_UNAVAILABLE", "Could not reach the Gemini AI service. Please try again in a moment."));
          return;
        }

        // ── Unhandled ? never call next(error) so the client always gets JSON ──
        res.status(500).json(stageErr(reqId, stage, "INTERNAL_ERROR", "An unexpected error occurred. Please try again or contact support."));
      }
    },
  );

  /**
   * GET /api/marks-import/scan/options
   *
   * Returns the dropdown options (classes, streams, subjects, terms, examTypes)
   * needed to populate the Smart Marksheet Import form. School-scoped.
   * Never returns 500 — DB failures produce empty arrays with a server-side log.
   */
  router.get("/api/marks-import/scan/options", requireImportAuth, async (req, res) => {
    const school = req.school;
    if (!school) {
      res.status(401).json(importErr("AUTH_REQUIRED", "Authentication required."));
      return;
    }

    const reqId = (req.headers["x-request-id"] as string | undefined) ?? `so-${Date.now().toString(36)}`;
    const logCtx = { reqId, route: "GET /api/marks-import/scan/options", schoolId: school.id, userId: req.user?.userId };

    // 1. Determine school sections (best-effort; default to SECONDARY on any error)
    let schoolSections: SchoolSection[] = ["SECONDARY"];
    try {
      const savedSetting = await prisma.appSetting.findUnique({
        where: { schoolCode: school.code },
        select: { sections: true },
      });
      if (savedSetting?.sections) {
        const raw = savedSetting.sections as { school?: { schoolSections?: unknown } };
        if (Array.isArray(raw?.school?.schoolSections) && raw.school.schoolSections.length > 0) {
          schoolSections = raw.school.schoolSections as SchoolSection[];
        }
      }
    } catch (err) {
      console.error("[scan-options] appSetting lookup failed; defaulting to SECONDARY", {
        ...logCtx,
        error: err instanceof Error ? err.message : String(err),
      });
    }

    // 2. Provision canonical classes (idempotent, best-effort; never blocks the response)
    try {
      const sectionClassDefs = getClassesForSections(schoolSections);
      for (const def of sectionClassDefs) {
        await prisma.schoolClass.upsert({
          where: { schoolId_code: { schoolId: school.id, code: def.code } },
          create: { schoolId: school.id, name: def.name, code: def.code, level: def.level },
          update: {},
        });
      }
    } catch (err) {
      console.error("[scan-options] class provisioning failed; continuing with existing classes", {
        ...logCtx,
        prismaCode: (err as { code?: string }).code,
        error: err instanceof Error ? err.message : String(err),
        stack: process.env.NODE_ENV !== "production" ? (err instanceof Error ? err.stack : undefined) : undefined,
      });
    }

    // 3. Load dropdown options (fail-safe: empty arrays on any DB error)
    let classes: Array<{ id: string; name: string; code: string }> = [];
    let streams: Array<{ id: string; classId: string; name: string; code: string }> = [];
    let subjects: Array<{ id: string; name: string; code: string }> = [];
    let terms: Array<{ id: string; name: string; isActive: boolean }> = [];

    try {
      const [rawClasses, rawStreams, rawSubjects, rawTerms] = await Promise.all([
        prisma.schoolClass.findMany({
          where: { schoolId: school.id },
          select: { id: true, name: true, code: true },
          orderBy: { level: "asc" },
        }),
        prisma.stream.findMany({
          where: { schoolId: school.id },
          select: { id: true, classId: true, name: true, code: true },
          orderBy: { name: "asc" },
        }),
        prisma.subject.findMany({
          where: { schoolId: school.id, isActive: true },
          select: { id: true, name: true, code: true },
          orderBy: { sortOrder: "asc" },
        }),
        prisma.term.findMany({
          where: { academicYear: { schoolId: school.id } },
          include: { academicYear: { select: { name: true } } },
          orderBy: [{ academicYear: { startsOn: "desc" } }, { startsOn: "asc" }],
          take: 12,
        }),
      ]);

      const canonicalClasses = rawClasses.filter((c) => isCanonicalClassCode(c.code));
      const canonicalClassIds = new Set(canonicalClasses.map((c) => c.id));
      classes = canonicalClasses;
      streams = rawStreams.filter((s) => canonicalClassIds.has(s.classId));
      subjects = rawSubjects;
      terms = rawTerms.map((t) => ({
        id: t.id,
        name: `${t.academicYear.name} · ${t.name}`,
        isActive: t.isActive,
      }));
    } catch (err) {
      console.error("[scan-options] dropdown query failed; returning empty options", {
        ...logCtx,
        prismaCode: (err as { code?: string }).code,
        error: err instanceof Error ? err.message : String(err),
        stack: process.env.NODE_ENV !== "production" ? (err instanceof Error ? err.stack : undefined) : undefined,
      });
    }

    res.json({ success: true, classes, streams, subjects, terms, examTypes: ["BOT", "MOT", "EOT"] });
  });

  /**
   * POST /api/marks-import/scan/commit
   *
   * Saves reviewed Gemini-extracted marks to SubjectMark as DRAFT inside a
   * Prisma transaction.  The batch status moves from DRY_RUN ? COMMITTED.
   * An AuditLog entry is created for every successful commit.
   *
   * The server re-validates every row before writing ? the client is never
   * trusted to gate the write.
   */
  router.post("/api/marks-import/scan/commit", requireImportAuth, requireSubscriptionEntitlement("marks.import.commit"), async (req: Request, res: Response) => {
    const reqId = (req.headers["x-request-id"] as string | undefined)
      ?? `gc-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

    try {
      // ── 1. Parse body ──────────────────────────────────────────────────────
      const body = req.body as Record<string, unknown>;
      const { jobId, reviewedRows } = body;

      if (typeof jobId !== "string" || !UUID_RE.test(jobId)) {
        res.status(400).json(importErr("INVALID_JOB_ID", "jobId is required and must be a valid UUID."));
        return;
      }
      if (!Array.isArray(reviewedRows) || reviewedRows.length === 0) {
        res.status(400).json(importErr("MISSING_ROWS", "reviewedRows must be a non-empty array."));
        return;
      }

      // ── 2. Load and tenant-check the batch ────────────────────────────────
      const batch = await prisma.markImportBatch.findUnique({ where: { id: jobId } });
      if (!batch) {
        res.status(404).json(importErr("BATCH_NOT_FOUND", "No import batch found for this job ID. Please re-extract the marksheet."));
        return;
      }

      const school = req.school!;
      if (batch.schoolId !== school.id) {
        res.status(403).json(importErr("ACCESS_DENIED", "This import batch does not belong to your school."));
        return;
      }
      const schoolId = school.id;
      const schoolCode = school.code;

      // ── 3. Check batch status ──────────────────────────────────────────────
      if (batch.status === "COMMITTED") {
        res.status(409).json(importErr("ALREADY_COMMITTED", "These marks have already been saved and cannot be submitted again."));
        return;
      }
      if (batch.status !== "DRY_RUN") {
        res.status(400).json(importErr("INVALID_BATCH_STATUS", `Batch is in status '${batch.status}' and cannot be committed.`));
        return;
      }

      // ── 4. Parse batch context (classId, streamId, subjectId, termId, examType) ──
      type BatchContext = {
        classId: string;
        streamId: string | null;
        subjectId: string;
        termId: string;
        examType: string;
      };
      let batchContext: BatchContext | null = null;
      try {
        const parsed = JSON.parse(batch.summary ?? "{}") as { context?: BatchContext };
        batchContext = parsed.context ?? null;
      } catch {
        // malformed
      }

      if (
        !batchContext ||
        !batchContext.classId || !UUID_RE.test(batchContext.classId) ||
        !batchContext.subjectId || !UUID_RE.test(batchContext.subjectId) ||
        !batchContext.termId || !UUID_RE.test(batchContext.termId) ||
        !VALID_EXAM_TYPES.has(batchContext.examType ?? "")
      ) {
        res.status(400).json(importErr("INVALID_BATCH", "Import batch is missing context. Please re-extract the marksheet."));
        return;
      }

      const streamId = typeof batchContext.streamId === "string" && UUID_RE.test(batchContext.streamId)
        ? batchContext.streamId
        : null;

      if (!streamId) {
        res.status(400).json(importErr("MISSING_STREAM", "This import batch is missing a stream. All classes must have a stream to save marks."));
        return;
      }

      // ── 5. Load term for academicYearId ───────────────────────────────────
      const term = await prisma.term.findFirst({
        where: { id: batchContext.termId, academicYear: { schoolId } },
        select: { academicYearId: true },
      });
      if (!term) {
        res.status(404).json(importErr("TERM_NOT_FOUND", "The term for this batch could not be found."));
        return;
      }

      // ── 6. Server-side row validation ─────────────────────────────────────
      type RowInput = Record<string, unknown>;
      const seenStudentIds = new Set<string>();
      const rowIssues: Array<{ rowNumber: number; issues: string[] }> = [];

      for (const rawRow of reviewedRows as RowInput[]) {
        const issues: string[] = [];
        const rowNumber = typeof rawRow.rowNumber === "number" ? rawRow.rowNumber : 0;

        if (rawRow.status !== "READY") {
          issues.push(`Row has unresolved status: ${String(rawRow.status)}.`);
        }

        const matchedStudentId = typeof rawRow.matchedStudentId === "string" ? rawRow.matchedStudentId.trim() : "";
        if (!matchedStudentId || !UUID_RE.test(matchedStudentId)) {
          issues.push("matchedStudentId is missing or invalid.");
        } else if (seenStudentIds.has(matchedStudentId)) {
          issues.push("Duplicate student: this student appears more than once.");
        } else {
          seenStudentIds.add(matchedStudentId);
        }

        const extractedStudentId = typeof rawRow.extractedStudentId === "string" ? rawRow.extractedStudentId.trim() : "";
        if (!extractedStudentId) {
          issues.push("extractedStudentId (admission number) is required.");
        }

        const markStr = typeof rawRow.mark === "string" ? rawRow.mark.trim() : "";
        const scoreCheck = validateScore(markStr);
        if (!scoreCheck.valid) {
          issues.push(scoreCheck.error);
        }

        if (issues.length > 0) rowIssues.push({ rowNumber, issues });
      }

      if (rowIssues.length > 0) {
        res.status(400).json({
          success: false,
          code: "ROW_VALIDATION_FAILED",
          message: `${rowIssues.length} row(s) failed server-side validation.`,
          rowIssues,
        });
        return;
      }

      // ── 7. Commit in a Prisma transaction ─────────────────────────────────
      const assessmentType = batchContext.examType as "BOT" | "MOT" | "EOT";
      const validRows = reviewedRows as Array<{
        rowNumber: number;
        matchedStudentId: string;
        extractedStudentId: string;
        mark: string;
      }>;

      await prisma.$transaction(async (tx) => {
        for (const row of validRows) {
          await tx.subjectMark.upsert({
            where: {
              studentId_subjectId_componentKey_termId_assessmentType: {
                studentId: row.matchedStudentId,
                subjectId: batchContext!.subjectId,
                componentKey: "",
                termId: batchContext!.termId,
                assessmentType,
              },
            },
            create: {
              schoolId,
              studentId: row.matchedStudentId,
              academicYearId: term.academicYearId,
              termId: batchContext!.termId,
              classId: batchContext!.classId,
              streamId,
              subjectId: batchContext!.subjectId,
              componentKey: "",
              assessmentType,
              marks: parseFloat(row.mark),
              status: "FINALIZED",
              importBatchId: batch.id,
            },
            update: {
              marks: parseFloat(row.mark),
              status: "FINALIZED",
              importBatchId: batch.id,
            },
          });
        }

        await tx.markImportBatch.update({
          where: { id: batch.id },
          data: {
            status: "COMMITTED",
            summary: JSON.stringify({
              ...(JSON.parse(batch.summary ?? "{}") as Record<string, unknown>),
              committed: true,
              committedAt: new Date().toISOString(),
              committedRows: validRows.length,
            }),
          },
        });

        await tx.auditLog.create({
          data: {
            schoolId,
            action: "GEMINI_SCAN_COMMITTED",
            correlationId: batch.id,
            details: {
              batchId: batch.id,
              committedRows: validRows.length,
              subjectId: batchContext!.subjectId,
              termId: batchContext!.termId,
              assessmentType,
              classId: batchContext!.classId,
              streamId,
            },
          },
        });
      });

      const finalizedRows = await prisma.subjectMark.count({
        where: { importBatchId: batch.id, status: "FINALIZED" },
      });

      console.log("[gemini-commit]", {
        reqId,
        event: "committed",
        jobId: batch.id,
        committedRows: validRows.length,
        finalizedRows,
      });

      res.json({
        success: true,
        committedRows: validRows.length,
        finalizedRows,
        reportsReady: finalizedRows === validRows.length,
        skippedRows: 0,
        batchId: batch.id,
        message: `${validRows.length} marks saved and ready for reports.`,
        schoolCode,
        academicYearId: term.academicYearId,
        classId: batchContext.classId,
        streamId,
        termId: batchContext.termId,
        subjectId: batchContext.subjectId,
        assessmentType: batchContext.examType,
      });

    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unexpected error";
      const stack = error instanceof Error ? error.stack : undefined;
      console.error("[gemini-commit]", { reqId, event: "error", message, stack });
      res.status(500).json(importErr("INTERNAL_ERROR", "An unexpected error occurred while saving marks. Please try again."));
    }
  });

  return router;
}

