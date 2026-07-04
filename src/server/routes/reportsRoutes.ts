import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db/prisma";
import { getReportContext } from "../repositories/schoolRepository";
import { loadReportEngineInput } from "../repositories/reportsRepository";
import { getSettingsSections } from "../repositories/settingsRepository";
import { buildReports } from "../services/reportEngine";
import { attachUsageWarning, recordPlatformUsage, requirePlatformModule } from "../platformIntegration";

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
      if (!(await requirePlatformModule(req, res, "report_lab.core"))) {
        return;
      }
      const school = req.school;
      if (!school) {
        res.status(401).json({ error: "Authentication required." });
        return;
      }
      res.json(await getReportContext(prisma, school.code));
    } catch (error) {
      next(error);
    }
  });

  router.get("/api/reports", async (req, res, next) => {
    try {
      if (!(await requirePlatformModule(req, res, "report_lab.report_generation"))) {
        return;
      }
      const school = req.school;
      if (!school) {
        res.status(401).json({ error: "Authentication required." });
        return;
      }
      const schoolCode = school.code;
      const rawFilters = { ...reportsQuery.parse(req.query), schoolCode };
      const settings = await getSettingsSections(prisma, schoolCode);
      const filters = {
        ...rawFilters,
        assessmentType: rawFilters.assessmentType ?? settings.academic.defaultAssessmentType,
      };
      const engineInput = await loadReportEngineInput(prisma, filters);
      const report = buildReports(engineInput);
      attachUsageWarning(res, await recordPlatformUsage(req, {
        moduleCode: "report_lab.report_generation",
        quantity: 1,
        sourceType: "report_generation",
        sourceId: `${school.code}:${filters.classId}:${filters.termId ?? "all"}:${filters.assessmentType ?? "default"}`,
        metadataJson: {
          schoolCode,
          classId: filters.classId,
          termId: filters.termId ?? null,
          assessmentType: filters.assessmentType ?? null,
        },
      }));
      res.json(filters.studentId ? { ...report, cards: report.cards.filter((card) => card.studentId === filters.studentId) } : report);
    } catch (error) {
      next(error);
    }
  });

  return router;
}
