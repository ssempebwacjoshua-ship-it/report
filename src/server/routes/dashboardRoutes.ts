import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db/prisma";
import { getDashboardStats } from "../services/dashboardService";

export function dashboardRoutes() {
  const router = Router();

  router.get("/api/dashboard/stats", async (req, res, next) => {
    try {
      const schoolCode = z.string().default("SCU-PREVIEW").parse(req.query.schoolCode);
      res.json(await getDashboardStats(prisma, schoolCode));
    } catch (error) {
      next(error);
    }
  });

  return router;
}
