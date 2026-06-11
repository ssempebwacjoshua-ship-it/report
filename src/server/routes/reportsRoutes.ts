import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db/prisma";
import { getReportContext } from "../repositories/schoolRepository";
import { loadReportEngineInput } from "../repositories/reportsRepository";
import { buildReports } from "../services/reportEngine";

const reportsQuery = z.object({
  schoolCode: z.string().default("SCU-PREVIEW"),
  academicYearId: z.string().optional(),
  termId: z.string().optional(),
  classId: z.string().min(1),
  streamId: z.string().optional(),
  assessmentType: z.enum(["BOT", "MOT", "EOT", "TERM_SUMMARY"]).default("TERM_SUMMARY"),
  studentId: z.string().optional(),
  search: z.string().optional(),
});

export function reportsRoutes() {
  const router = Router();

  router.get("/api/context", async (req, res, next) => {
    try {
      const schoolCode = String(req.query.schoolCode ?? "SCU-PREVIEW");
      res.json(await getReportContext(prisma, schoolCode));
    } catch (error) {
      next(error);
    }
  });

  router.get("/api/reports", async (req, res, next) => {
    try {
      const filters = reportsQuery.parse(req.query);
      const engineInput = await loadReportEngineInput(prisma, filters);
      const report = buildReports(engineInput);
      res.json(filters.studentId ? { ...report, cards: report.cards.filter((card) => card.studentId === filters.studentId) } : report);
    } catch (error) {
      next(error);
    }
  });

  return router;
}
