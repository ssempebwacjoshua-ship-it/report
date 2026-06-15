import type { NextFunction, Request, Response } from "express";
import { Router } from "express";
import multer from "multer";
import { prisma } from "../db/prisma";
import { verifyToken } from "../services/authService";
import { extractMarksWithGemini } from "../services/geminiOcrService";
import {
  loadExpectedStudents,
  validateAndMatchGeminiRows,
} from "../services/geminiMarksImportService";

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
   * ?debugNoDb=true — skips all DB calls (school/class/student/batch) so Gemini
   * can be isolated from DB wiring issues during diagnosis.
   */
  router.post(
    "/api/marks-import/scan/extract",
    requireImportAuth,
    upload.single("image"),
    async (req: Request, res: Response, _next: NextFunction) => {
      const reqId = (req.headers["x-request-id"] as string | undefined)
        ?? `gx-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
      let stage = "request_received";

      try {
        // ── Stage: request_received — file validation ──────────────────────
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

        // DB context validation — skipped entirely when debugNoDb=true.
        let schoolId = "";
        if (!debugNoDb) {
          console.log("[gemini-extract]", { reqId, stage, event: "resolving_context" });

          const sessionSchoolId = req.user?.schoolId;
          const schoolCode = typeof req.body.schoolCode === "string" && req.body.schoolCode.trim()
            ? req.body.schoolCode.trim()
            : "SCU-PREVIEW";
          const school = sessionSchoolId
            ? await prisma.school.findUnique({ where: { id: sessionSchoolId } })
            : await prisma.school.findUnique({ where: { code: schoolCode } });
          if (!school) {
            res.status(404).json(stageErr(reqId, stage, "SCHOOL_NOT_FOUND", "School could not be resolved for this session."));
            return;
          }
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
            res.status(404).json(stageErr(reqId, stage, "STREAM_NOT_FOUND", "Selected stream was not found for this class."));
            return;
          }
          console.log("[gemini-extract]", { reqId, stage, event: "context_validated", schoolId });
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
        if (/UNAVAILABLE|unavailable|fetch.*failed|network.*error|timeout|ECONNREFUSED|ENOTFOUND/i.test(message)) {
          res.status(503).json(stageErr(reqId, "gemini_extract", "GEMINI_UNAVAILABLE", "Could not reach the Gemini AI service. Please try again in a moment."));
          return;
        }

        // ── Unhandled — never call next(error) so the client always gets JSON ──
        res.status(500).json(stageErr(reqId, stage, "INTERNAL_ERROR", "An unexpected error occurred. Please try again or contact support."));
      }
    },
  );

  /**
   * GET /api/marks-import/scan/options
   *
   * Returns the dropdown options (classes, streams, subjects, terms, examTypes)
   * needed to populate the Smart Marksheet Import form. School-scoped.
   */
  router.get("/api/marks-import/scan/options", requireImportAuth, async (req, res, next) => {
    try {
      const sessionSchoolId = req.user?.schoolId;
      const schoolCode = typeof req.query.schoolCode === "string" && req.query.schoolCode.trim()
        ? req.query.schoolCode.trim()
        : "SCU-PREVIEW";
      const school = sessionSchoolId
        ? await prisma.school.findUnique({ where: { id: sessionSchoolId } })
        : await prisma.school.findUnique({ where: { code: schoolCode } });
      if (!school) {
        res.status(404).json(importErr("SCHOOL_NOT_FOUND", "School could not be resolved for this session."));
        return;
      }

      const [classes, streams, subjects, terms] = await Promise.all([
        prisma.schoolClass.findMany({
          where: { schoolId: school.id },
          select: { id: true, name: true, code: true },
          orderBy: { name: "asc" },
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

      res.json({
        success: true,
        classes,
        streams,
        subjects,
        terms: terms.map((t) => ({
          id: t.id,
          name: `${t.academicYear.name} — ${t.name}`,
          isActive: t.isActive,
        })),
        examTypes: ["BOT", "MOT", "EOT"],
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * POST /api/marks-import/scan/commit
   *
   * Intentionally disabled in this pilot phase.
   */
  router.post("/api/marks-import/scan/commit", requireImportAuth, (_req, res) => {
    res.status(501).json(importErr(
      "COMMIT_NOT_ENABLED",
      "Gemini scan commit is not enabled yet. Review and correct rows now; saving will be wired into the existing marks-import workflow in the next phase.",
    ));
  });

  return router;
}
