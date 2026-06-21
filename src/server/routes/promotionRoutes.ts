import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db/prisma";
import { requireAuth } from "../middleware/requireAuth";
import {
  previewPromotionCandidates,
  applyPromotions,
  reversePromotionBatch,
} from "../services/promotionService";

const previewSchema = z.object({
  academicYearId: z.string().uuid(),
  termId: z.string().uuid(),
  assessmentType: z.enum(["BOT", "MOT", "EOT", "TERM_SUMMARY"]).default("EOT"),
  classId: z.string().uuid().optional(),
  streamId: z.string().uuid().optional(),
  scoreThreshold: z.number().min(0).max(100).default(40),
});

const decisionSchema = z.object({
  studentId: z.string().uuid(),
  enrollmentId: z.string().uuid(),
  fromClassName: z.string().min(1),
  fromClassCode: z.string().min(1),
  fromStreamName: z.string().min(1),
  toClassCode: z.string().nullable(),
  decision: z.enum(["PROMOTE", "REPEAT", "GRADUATE"]),
  averageScore: z.number().nullable(),
  studentName: z.string().min(1),
});

const applySchema = z.object({
  academicYearId: z.string().uuid(),
  termId: z.string().uuid(),
  assessmentType: z.enum(["BOT", "MOT", "EOT", "TERM_SUMMARY"]).default("EOT"),
  classId: z.string().uuid().optional(),
  streamId: z.string().uuid().optional(),
  scoreThreshold: z.number().min(0).max(100).default(40),
  targetAcademicYearId: z.string().uuid(),
  targetTermId: z.string().uuid(),
  decisions: z.array(decisionSchema).min(1, "Select at least one student to promote."),
});

export function promotionRoutes() {
  const router = Router();

  // POST /api/promotions/preview — generate candidates, no DB write
  router.post("/api/promotions/preview", requireAuth, async (req, res, next) => {
    try {
      const user = req.user!;
      const body = previewSchema.parse(req.body);

      const candidates = await previewPromotionCandidates(prisma, {
        schoolId: user.schoolId,
        schoolCode: req.school!.code,
        academicYearId: body.academicYearId,
        termId: body.termId,
        assessmentType: body.assessmentType,
        classId: body.classId,
        streamId: body.streamId,
        scoreThreshold: body.scoreThreshold,
      });

      res.json({ candidates });
    } catch (error) {
      next(error);
    }
  });

  // POST /api/promotions/apply — apply confirmed promotion decisions
  router.post("/api/promotions/apply", requireAuth, async (req, res, next) => {
    try {
      const user = req.user!;
      const body = applySchema.parse(req.body);

      const result = await applyPromotions(prisma, {
        schoolId: user.schoolId,
        academicYearId: body.academicYearId,
        termId: body.termId,
        assessmentType: body.assessmentType,
        classId: body.classId,
        streamId: body.streamId,
        scoreThreshold: body.scoreThreshold,
        targetAcademicYearId: body.targetAcademicYearId,
        targetTermId: body.targetTermId,
        decisions: body.decisions,
        appliedByName: user.name,
      });

      await prisma.auditLog.create({
        data: {
          schoolId: user.schoolId,
          action: "promotion.apply",
          correlationId: result.batchId,
          details: {
            batchId: result.batchId,
            applied: result.applied,
            errorCount: result.errors.length,
            actorId: user.userId,
            actorName: user.name,
          },
        },
      });

      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  });

  // GET /api/promotions/batches — list promotion batches for school
  router.get("/api/promotions/batches", requireAuth, async (req, res, next) => {
    try {
      const user = req.user!;

      const batches = await prisma.promotionBatch.findMany({
        where: { schoolId: user.schoolId },
        include: {
          actions: {
            select: { id: true, decision: true, status: true, studentName: true, fromClassName: true, toClassName: true },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 50,
      });

      res.json(
        batches.map((b) => ({
          id: b.id,
          academicYearId: b.academicYearId,
          termId: b.termId,
          assessmentType: b.assessmentType,
          status: b.status,
          scoreThreshold: b.scoreThreshold,
          appliedAt: b.appliedAt,
          appliedByName: b.appliedByName,
          reversedAt: b.reversedAt,
          reversedByName: b.reversedByName,
          totalStudents: b.actions.length,
          promoted: b.actions.filter((a) => a.decision === "PROMOTE" && a.status === "APPLIED").length,
          repeated: b.actions.filter((a) => a.decision === "REPEAT" && a.status === "APPLIED").length,
          graduated: b.actions.filter((a) => a.decision === "GRADUATE" && a.status === "APPLIED").length,
          actions: b.actions,
        })),
      );
    } catch (error) {
      next(error);
    }
  });

  // POST /api/promotions/batches/:id/reverse — reverse a batch
  router.post("/api/promotions/batches/:id/reverse", requireAuth, async (req, res, next) => {
    try {
      const user = req.user!;
      const { id } = req.params;

      const result = await reversePromotionBatch(prisma, id, user.schoolId, user.name);

      await prisma.auditLog.create({
        data: {
          schoolId: user.schoolId,
          action: "promotion.reverse",
          correlationId: id,
          details: {
            batchId: id,
            reversed: result.reversed,
            blocked: result.blocked.length,
            actorId: user.userId,
            actorName: user.name,
          },
        },
      });

      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  return router;
}
