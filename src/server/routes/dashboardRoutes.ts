import { Router } from "express";
import { prisma } from "../db/prisma";
import { getDashboardAttendanceSummary, getDashboardStats } from "../services/dashboardService";
import { requirePlatformModule } from "../platformIntegration";

export function dashboardRoutes() {
  const router = Router();

  router.get("/api/dashboard/stats", async (req, res, next) => {
    try {
      if (!(await requirePlatformModule(req, res, "report_lab.core"))) {
        return;
      }
      res.json(await getDashboardStats(prisma, req.school!.code));
    } catch (error) {
      next(error);
    }
  });

  router.get("/api/dashboard/attendance-summary", async (req, res, next) => {
    try {
      if (!(await requirePlatformModule(req, res, "nfc.attendance"))) {
        return;
      }
      res.json(await getDashboardAttendanceSummary(prisma, {
        schoolId: req.school?.id,
        actorId: req.user?.userId,
        role: req.user?.role,
      }));
    } catch (error) {
      next(error);
    }
  });

  return router;
}
