import { Router } from "express";
import { prisma } from "../db/prisma";

export function parentRoutes() {
  const router = Router();

  // Public — URL token IS the auth. No login required.
  router.get("/api/p/:token", async (req, res, next) => {
    try {
      const { token } = req.params;

      const issued = await prisma.issuedReport.findUnique({
        where: { parentAccessToken: token },
        include: {
          school: { select: { name: true, code: true } },
          student: { select: { firstName: true, lastName: true, admissionNumber: true } },
        },
      });

      if (!issued) {
        res.status(404).json({ error: "Report not found. The link may be invalid or expired." });
        return;
      }

      // Track first view
      if (!issued.viewedAt) {
        await prisma.issuedReport.update({
          where: { id: issued.id },
          data: { viewedAt: new Date() },
        });
      }

      res.json({
        id: issued.id,
        status: issued.status,
        referenceCode: issued.referenceCode,
        issuedAt: issued.issuedAt,
        issuedByName: issued.issuedByName,
        school: { name: issued.school.name, code: issued.school.code },
        snapshot: issued.reportSnapshotJson,
      });
    } catch (error) {
      next(error);
    }
  });

  // Track download event
  router.post("/api/p/:token/downloaded", async (req, res, next) => {
    try {
      const { token } = req.params;

      const issued = await prisma.issuedReport.findUnique({
        where: { parentAccessToken: token },
      });

      if (!issued) {
        res.status(404).json({ error: "Not found." });
        return;
      }

      if (!issued.downloadedAt) {
        await prisma.issuedReport.update({
          where: { id: issued.id },
          data: { downloadedAt: new Date() },
        });
      }

      res.json({ ok: true });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
