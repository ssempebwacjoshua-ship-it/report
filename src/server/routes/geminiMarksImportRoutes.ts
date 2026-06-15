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

function importErr(code: string, message: string, extra?: Record<string, unknown>) {
  return { success: false as const, error: true as const, code, message, details: [] as string[], ...extra };
}

/**
 * Real import route protection. The Gemini test endpoints are gated by an internal
 * key; the real import route must use normal app auth. We enforce a valid bearer
 * token in production. In dev/test (pilot) the route stays open so the existing
 * import flow and automated tests work without a session.
 */
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
   */
  router.post(
    "/api/marks-import/scan/extract",
    requireImportAuth,
    upload.single("image"),
    async (req, res, next) => {
      const reqId = (req.headers["x-request-id"] as string | undefined)
        ?? `gx-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
      try {
        // 1. Image required
        const file = req.file;
        if (!file) {
          res.status(400).json(importErr("MISSING_IMAGE", "No image uploaded. Attach a PNG, JPG, JPEG, WEBP, or PDF marksheet."));
          return;
        }

        // 2. File size / type checks
        if (file.size > MAX_FILE_BYTES) {
          res.status(400).json(importErr("FILE_TOO_LARGE", "Image is too large. Maximum scan size is 10 MB."));
          return;
        }
        const ext = (file.originalname.split(".").pop() ?? "").trim().toUpperCase();
        const mimeOk = SCAN_MIME_TYPES.has((file.mimetype || "").toLowerCase());
        const extOk = SCAN_FILE_EXTENSIONS.has(ext);
        if (!mimeOk && !extOk) {
          res.status(400).json(importErr(
            "UNSUPPORTED_FILE_TYPE",
            `Unsupported file type: .${ext.toLowerCase() || "unknown"}. Accepted formats: PNG, JPG, JPEG, WEBP, PDF.`,
          ));
          return;
        }

        // 3. Required context fields (presence only — no DB needed)
        const classId = typeof req.body.classId === "string" ? req.body.classId.trim() : "";
        const streamId = typeof req.body.streamId === "string" ? req.body.streamId.trim() : "";
        const subjectId = typeof req.body.subjectId === "string" ? req.body.subjectId.trim() : "";
        const termId = typeof req.body.termId === "string" ? req.body.termId.trim() : "";
        const examType = typeof req.body.examType === "string" ? req.body.examType.trim() : "";

        const missing: string[] = [];
        if (!classId) missing.push("classId");
        if (!subjectId) missing.push("subjectId");
        if (!termId) missing.push("termId");
        if (!examType) missing.push("examType");
        if (missing.length > 0) {
          res.status(400).json(importErr(
            "MISSING_CONTEXT",
            `Missing required fields: ${missing.join(", ")}.`,
            { fields: missing },
          ));
          return;
        }

        // 3a. Early start log (before any DB work so we always see what was submitted)
        console.log("[gemini-extract]", {
          reqId, event: "start",
          file: { name: file.originalname, sizeKB: Math.round(file.size / 1024), mime: file.mimetype },
          context: { classId, streamId: streamId || null, subjectId, termId, examType },
        });

        // 3b. Validate IDs are proper UUIDs before hitting Prisma (prevents type errors on bad input)
        if (!UUID_RE.test(classId)) {
          res.status(400).json(importErr("INVALID_ID", "Invalid class selection. Please choose a class from the list."));
          return;
        }
        if (streamId && !UUID_RE.test(streamId)) {
          res.status(400).json(importErr("INVALID_ID", "Invalid stream selection. Please choose a stream from the list."));
          return;
        }
        if (!UUID_RE.test(subjectId)) {
          res.status(400).json(importErr("INVALID_ID", "Invalid subject selection. Please choose a subject from the list."));
          return;
        }
        if (!UUID_RE.test(termId)) {
          res.status(400).json(importErr("INVALID_ID", "Invalid term selection. Please choose a term from the list."));
          return;
        }
        if (!VALID_EXAM_TYPES.has(examType)) {
          res.status(400).json(importErr("INVALID_ID", "Invalid exam type. Please select BOT, MOT, or EOT."));
          return;
        }

        // 4. Resolve school server-side. Never trust a frontend-supplied schoolId.
        //    In production the school comes from the authenticated session; otherwise
        //    we resolve from schoolCode, consistent with the rest of the import flow.
        const sessionSchoolId = req.user?.schoolId;
        const schoolCode = typeof req.body.schoolCode === "string" && req.body.schoolCode.trim()
          ? req.body.schoolCode.trim()
          : "SCU-PREVIEW";
        const school = sessionSchoolId
          ? await prisma.school.findUnique({ where: { id: sessionSchoolId } })
          : await prisma.school.findUnique({ where: { code: schoolCode } });
        if (!school) {
          res.status(404).json(importErr("SCHOOL_NOT_FOUND", "School could not be resolved for this session."));
          return;
        }

        // 5. Resolve class (scoped to school) and decide if a stream is required.
        const klass = await prisma.schoolClass.findFirst({
          where: { id: classId, schoolId: school.id },
          include: { streams: { select: { id: true } } },
        });
        if (!klass) {
          res.status(404).json(importErr("CLASS_NOT_FOUND", "Selected class was not found for this school."));
          return;
        }
        // streamId required only where the class actually has streams to choose from.
        if (klass.streams.length > 0 && !streamId) {
          res.status(400).json(importErr(
            "MISSING_CONTEXT",
            "Missing required fields: streamId.",
            { fields: ["streamId"] },
          ));
          return;
        }

        // 6. Validate remaining context references exist for this school.
        const [subject, term, stream] = await Promise.all([
          prisma.subject.findFirst({ where: { id: subjectId, schoolId: school.id } }),
          prisma.term.findFirst({ where: { id: termId, academicYear: { schoolId: school.id } } }),
          streamId
            ? prisma.stream.findFirst({ where: { id: streamId, schoolId: school.id, classId } })
            : Promise.resolve(null),
        ]);
        if (!subject) {
          res.status(404).json(importErr("SUBJECT_NOT_FOUND", "Selected subject was not found for this school."));
          return;
        }
        if (!term) {
          res.status(404).json(importErr("TERM_NOT_FOUND", "Selected term was not found for this school."));
          return;
        }
        if (streamId && !stream) {
          res.status(404).json(importErr("STREAM_NOT_FOUND", "Selected stream was not found for this class."));
          return;
        }

        // 7. Fetch expected students from the DB (never hardcoded).
        const expectedStudents = await loadExpectedStudents(prisma, {
          schoolId: school.id,
          classId,
          streamId: streamId || undefined,
          termId,
        });

        // 8. Call Gemini extraction service (server-only key).
        const geminiStart = Date.now();
        const { rows: geminiRows } = await extractMarksWithGemini(file.buffer, file.mimetype || "image/jpeg");
        console.log("[gemini-extract]", { reqId, event: "gemini-done", durationMs: Date.now() - geminiStart, rawRows: geminiRows.length });

        // 9. Deterministic backend validation + matching.
        const validationStart = Date.now();
        const { rows, summary } = validateAndMatchGeminiRows(geminiRows, expectedStudents);
        console.log("[gemini-extract]", { reqId, event: "validation-done", durationMs: Date.now() - validationStart, summary });

        // 10. Record a non-committing scan job. Reuse MarkImportBatch if available;
        //     this stores only the review payload — NO marks are persisted.
        let jobId = `gemini-scan-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        try {
          const batch = await prisma.markImportBatch.create({
            data: {
              schoolId: school.id,
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
        } catch (err) {
          // If the job model is unavailable, fall back to a temporary server ID.
          console.error("[gemini-marks-import] could not persist scan job:", err instanceof Error ? err.message : err);
        }

        console.log("[gemini-extract]", { reqId, event: "ok", jobId, count: rows.length });
        res.json({ success: true, jobId, count: rows.length, summary, rows });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Gemini extraction failed";
        console.error("[gemini-extract]", { reqId, event: "error", message });

        // ── Application-level 400s ───────────────────────────────────────────
        if (message === "Uploaded document does not look like a marksheet.") {
          res.status(400).json(importErr("NOT_MARKSHEET", message));
          return;
        }
        if (
          message === "Gemini returned empty response" ||
          message === "Gemini returned invalid JSON" ||
          message === "Gemini response missing rows array"
        ) {
          res.status(400).json(importErr(
            "GEMINI_PARSE_ERROR",
            "Gemini could not read the marksheet. Try a clearer or higher-resolution image.",
          ));
          return;
        }

        // ── Gemini service-level 503s ────────────────────────────────────────
        if (message === "Missing GEMINI_API_KEY") {
          res.status(503).json(importErr(
            "GEMINI_NOT_CONFIGURED",
            "Gemini AI is not configured on this server. Please contact support.",
          ));
          return;
        }
        if (/api.?key.*(invalid|not valid|expired)|PERMISSION_DENIED|permission denied|unauthorized/i.test(message)) {
          res.status(503).json(importErr(
            "GEMINI_AUTH_ERROR",
            "Gemini AI authentication failed. Please contact support.",
          ));
          return;
        }
        if (/RESOURCE_EXHAUSTED|resource exhausted|quota|rate.?limit|too many requests/i.test(message)) {
          res.status(503).json(importErr(
            "GEMINI_RATE_LIMIT",
            "Gemini AI is temporarily unavailable (rate limit). Please wait a moment and try again.",
          ));
          return;
        }
        if (/UNAVAILABLE|unavailable|fetch.*failed|network.*error|timeout|ECONNREFUSED|ENOTFOUND/i.test(message)) {
          res.status(503).json(importErr(
            "GEMINI_UNAVAILABLE",
            "Could not reach the Gemini AI service. Please try again in a moment.",
          ));
          return;
        }

        next(error);
      }
    },
  );

  /**
   * GET /api/marks-import/scan/options
   *
   * Returns the dropdown options (classes, streams, subjects, terms, examTypes)
   * needed to populate the Smart Marksheet Import form. School-scoped; never
   * returns data across schools.
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
   * Intentionally disabled in this pilot phase. Accepts jobId + reviewed rows but
   * never persists marks — committing will be wired into the existing marks-import
   * transaction/audit workflow in the next phase.
   */
  router.post("/api/marks-import/scan/commit", requireImportAuth, (_req, res) => {
    res.status(501).json(importErr(
      "COMMIT_NOT_ENABLED",
      "Gemini scan commit is not enabled yet. Review and correct rows now; saving will be wired into the existing marks-import workflow in the next phase.",
    ));
  });

  return router;
}
