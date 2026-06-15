import { Router } from "express";
import { prisma } from "../db/prisma";
import { getDashboardStats } from "../services/dashboardService";

export function dashboardRoutes() {
  const router = Router();

  router.get("/api/dashboard/stats", async (req, res, next) => {
    try {
      res.json(await getDashboardStats(prisma, req.school!.code));
    } catch (error) {
      next(error);
    }
  });

  return router;
}
