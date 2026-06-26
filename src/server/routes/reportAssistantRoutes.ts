import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db/prisma";
import { buildReportAssistantContext } from "../services/reportAssistantContextService";
import { generateStudentCommentDraft } from "../services/reportCommentService";
import { COMMENT_LIMITS } from "../../shared/utils/reportComments";

const contextQuerySchema = z.object({
  classId: z.string().min(1, "classId is required."),
  streamId: z.string().optional(),
  assessmentType: z.enum(["BOT", "MOT", "EOT", "TERM_SUMMARY"]).default("TERM_SUMMARY"),
  academicYearId: z.string().optional(),
  termId: z.string().optional(),
});

const generateCommentSchema = z.object({
  classId: z.string().min(1, "classId is required."),
  streamId: z.string().optional(),
  assessmentType: z.enum(["BOT", "MOT", "EOT", "TERM_SUMMARY"]).default("TERM_SUMMARY"),
  studentIds: z.array(z.string()).optional(),
});

const acceptCommentSchema = z.object({
  studentId: z.string().min(1),
  comment: z.string().min(1).max(COMMENT_LIMITS.classTeacherComment, `Comment must be ${COMMENT_LIMITS.classTeacherComment} characters or fewer.`),
  context: z.object({ classId: z.string(), termName: z.string() }).optional(),
});

const rejectCommentSchema = z.object({
  studentId: z.string().min(1),
  reason: z.string().optional(),
});

export function reportAssistantRoutes() {
  const router = Router();

  async function findOwnedStudent(studentId: string, schoolId: string) {
    return prisma.student.findFirst({
      where: { id: studentId, schoolId },
      select: { id: true },
    });
  }

  router.get("/api/reports/assistant-context", async (req, res, next) => {
    try {
      const parsed = contextQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        res.status(400).json({ error: "classId is required.", details: parsed.error.issues.map((i) => i.message) });
        return;
      }

      const school = req.school!;
      const context = await buildReportAssistantContext(prisma, {
        schoolCode: school.code,
        classId: parsed.data.classId,
        streamId: parsed.data.streamId,
        assessmentType: parsed.data.assessmentType,
        academicYearId: parsed.data.academicYearId,
        termId: parsed.data.termId,
      });

      if (!context.classFound || (parsed.data.streamId && !context.streamFound)) {
        res.status(404).json({ error: "Class or stream not found.", readinessCode: context.readinessCode });
        return;
      }

      res.json(context);
    } catch (error) {
      next(error);
    }
  });

  /**
   * POST /api/reports/assistant-comment/generate
   *
   * Generate AI comment DRAFTS for students in a class.
   * - Returns DRAFT comments for students with all marks finalized.
   * - Returns CONTEXT_INCOMPLETE for students with missing marks (honest, no invented data).
   * - Returns UNAVAILABLE if Gemini is down or not configured (honest fallback).
   * - Comments are capped at MAX_COMMENT_LENGTH characters server-side.
   * - These are DRAFTS ? they must be explicitly accepted via the /accept endpoint.
   */
  router.post("/api/reports/assistant-comment/generate", async (req, res, next) => {
    try {
      const parsed = generateCommentSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: "classId is required.", details: parsed.error.issues.map((i) => i.message) });
        return;
      }

      const school = req.school!;
      const context = await buildReportAssistantContext(prisma, {
        schoolCode: school.code,
        classId: parsed.data.classId,
        streamId: parsed.data.streamId,
        assessmentType: parsed.data.assessmentType,
      });

      // Honest about missing data ? don't call AI when context is broken
      if (!context.schoolFound) {
        res.status(404).json({ error: "School not found.", readinessCode: context.readinessCode });
        return;
      }
      if (!context.classFound || (parsed.data.streamId && !context.streamFound)) {
        res.status(404).json({ error: "Class or stream not found.", readinessCode: context.readinessCode });
        return;
      }
      if (!context.hasActiveTerm) {
        res.status(422).json({ error: "No active term is configured. Cannot generate comments.", readinessCode: context.readinessCode });
        return;
      }
      if (!context.hasStudents) {
        res.status(422).json({ error: "No active students enrolled in this class.", readinessCode: context.readinessCode });
        return;
      }

      const targetIds = parsed.data.studentIds ? new Set(parsed.data.studentIds) : null;
      const students = targetIds
        ? context.students.filter((s) => targetIds.has(s.studentId))
        : context.students;

      const suggestions = await Promise.all(
        students.map((student) =>
          generateStudentCommentDraft(student, {
            className: context.className,
            term: context.term,
            totalSubjects: context.totalSubjects,
          }),
        ),
      );

      const draftCount = suggestions.filter((s) => s.status === "DRAFT").length;
      const unavailableCount = suggestions.filter((s) => s.status === "UNAVAILABLE").length;
      const incompleteCount = suggestions.filter((s) => s.status === "CONTEXT_INCOMPLETE").length;

      await prisma.auditLog.create({
        data: {
          schoolId: school.id,
          action: "ai.suggestion.generated",
          correlationId: parsed.data.classId,
          details: {
            classId: parsed.data.classId,
            streamId: parsed.data.streamId ?? null,
            assessmentType: parsed.data.assessmentType,
            requestedStudentIds: parsed.data.studentIds ?? null,
            totalStudents: students.length,
            draftCount,
            unavailableCount,
            incompleteCount,
            actorId: req.user?.userId ?? null,
          },
        },
      });

      res.json({
        suggestions,
        totalStudents: students.length,
        draftCount,
        unavailableCount,
        incompleteCount,
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * POST /api/reports/assistant-comment/accept
   *
   * Operator explicitly accepts an AI-generated comment draft.
   * Writes an audit.ai.suggestion.accepted row ? approval is required, not automatic.
   */
  router.post("/api/reports/assistant-comment/accept", async (req, res, next) => {
    try {
      const parsed = acceptCommentSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: "Invalid request.", details: parsed.error.issues.map((i) => i.message) });
        return;
      }

      const user = req.user!;
      const { studentId, comment, context } = parsed.data;
      const student = await findOwnedStudent(studentId, user.schoolId);
      if (!student) {
        res.status(404).json({ error: "Student not found." });
        return;
      }

      await prisma.auditLog.create({
        data: {
          schoolId: user.schoolId,
          action: "ai.suggestion.accepted",
          correlationId: studentId,
          details: {
            studentId,
            comment,
            commentLength: comment.length,
            actorId: user.userId,
            actorName: user.name,
            context: context ?? null,
          },
        },
      });

      res.json({ success: true, studentId });
    } catch (error) {
      next(error);
    }
  });

  /**
   * POST /api/reports/assistant-comment/reject
   *
   * Operator explicitly rejects an AI-generated comment draft.
   * Writes an audit.ai.suggestion.rejected row.
   */
  router.post("/api/reports/assistant-comment/reject", async (req, res, next) => {
    try {
      const parsed = rejectCommentSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: "Invalid request.", details: parsed.error.issues.map((i) => i.message) });
        return;
      }

      const user = req.user!;
      const { studentId, reason } = parsed.data;
      const student = await findOwnedStudent(studentId, user.schoolId);
      if (!student) {
        res.status(404).json({ error: "Student not found." });
        return;
      }

      await prisma.auditLog.create({
        data: {
          schoolId: user.schoolId,
          action: "ai.suggestion.rejected",
          correlationId: studentId,
          details: {
            studentId,
            reason: reason ?? null,
            actorId: user.userId,
            actorName: user.name,
          },
        },
      });

      res.json({ success: true, studentId });
    } catch (error) {
      next(error);
    }
  });

  return router;
}

