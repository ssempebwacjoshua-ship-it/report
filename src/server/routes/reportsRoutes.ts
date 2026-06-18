import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db/prisma";
import { getReportContext } from "../repositories/schoolRepository";
import { loadReportEngineInput } from "../repositories/reportsRepository";
import { getSettingsSections } from "../repositories/settingsRepository";
import { buildReports } from "../services/reportEngine";

const reportsQuery = z.object({
  academicYearId: z.string().optional(),
  termId: z.string().optional(),
  classId: z.string().min(1),
  streamId: z.string().optional(),
  assessmentType: z.enum(["BOT", "MOT", "EOT", "TERM_SUMMARY"]).optional(),
  studentId: z.string().optional(),
  search: z.string().optional(),
});

export function reportsRoutes() {
  const router = Router();

  router.get("/api/context", async (req, res, next) => {
    try {
      res.json(await getReportContext(prisma, req.school!.code));
    } catch (error) {
      next(error);
    }
  });

  router.get("/api/reports", async (req, res, next) => {
    try {
      const schoolCode = req.school!.code;
      const rawFilters = { ...reportsQuery.parse(req.query), schoolCode };
      const settings = await getSettingsSections(prisma, schoolCode);
      const filters = {
        ...rawFilters,
        assessmentType: rawFilters.assessmentType ?? settings.academic.defaultAssessmentType,
      };
      const engineInput = await loadReportEngineInput(prisma, filters);
      const report = buildReports(engineInput);
      res.json(filters.studentId ? { ...report, cards: report.cards.filter((card) => card.studentId === filters.studentId) } : report);
    } catch (error) {
      next(error);
    }
  });

  return router;
}

