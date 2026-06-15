import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db/prisma";
import { buildReportAssistantContext } from "../services/reportAssistantContextService";

const contextQuerySchema = z.object({
  classId: z.string().min(1, "classId is required."),
  streamId: z.string().optional(),
  assessmentType: z.enum(["BOT", "MOT", "EOT", "TERM_SUMMARY"]).default("TERM_SUMMARY"),
  academicYearId: z.string().optional(),
  termId: z.string().optional(),
});

export function reportAssistantRoutes() {
  const router = Router();

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

      res.json(context);
    } catch (error) {
      next(error);
    }
  });

  return router;
}
