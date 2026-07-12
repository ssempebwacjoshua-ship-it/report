import { Router } from "express";
import { prisma } from "../db/prisma";
import { getDashboardAttendanceSummary, getDashboardAttendanceSummaryForSchool, getDashboardStats } from "../services/dashboardService";
import { subscribeAttendanceRealtime } from "../services/attendanceRealtime";
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

  router.get("/api/dashboard/attendance-stream", async (req, res, next) => {
    try {
      if (!(await requirePlatformModule(req, res, "nfc.attendance"))) {
        return;
      }
      if (!req.school?.id) {
        res.status(401).json({ error: "School context required." });
        return;
      }

      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache, no-transform");
      res.setHeader("Connection", "keep-alive");
      res.flushHeaders?.();

      const writeSummary = (summary: Awaited<ReturnType<typeof getDashboardAttendanceSummaryForSchool>>) => {
        res.write("event: attendance-summary\n");
        res.write(`data: ${JSON.stringify(summary)}\n\n`);
      };

      writeSummary(await getDashboardAttendanceSummaryForSchool(prisma, req.school.id));
      const unsubscribe = subscribeAttendanceRealtime(req.school.id, writeSummary);
      const keepAlive = setInterval(() => {
        res.write(": keep-alive\n\n");
      }, 25000);

      req.on("close", () => {
        clearInterval(keepAlive);
        unsubscribe();
        res.end();
      });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
