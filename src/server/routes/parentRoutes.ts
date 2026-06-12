import crypto from "node:crypto";
import { Router } from "express";
import { prisma } from "../db/prisma";

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function parentRoutes() {
  const router = Router();

  // Public â€” URL token IS the auth. No login required.
  router.get("/api/p/:token", async (req, res, next) => {
    try {
      const { token } = req.params;
      const tokenHash = hashToken(token);
      console.log("parent.link.open", {
        tokenLength: token.length,
        tokenHashPrefix: `${tokenHash.slice(0, 12)}...`,
      });

      const issued = await prisma.issuedReport.findUnique({
        where: { parentAccessToken: tokenHash },
        include: {
          school: { select: { name: true, code: true } },
          student: { select: { firstName: true, lastName: true, admissionNumber: true } },
        },
      });

      if (!issued) {
        res.status(404).json({ message: "Report link not found or expired", code: "REPORT_LINK_NOT_FOUND" });
        return;
      }

      console.log("parent.link.found", { issuedReportId: issued.id, status: issued.status });

      if (issued.status === "REVOKED") {
        res.status(410).json({ message: "This report link was revoked", code: "REPORT_REVOKED" });
        return;
      }

      if (issued.status === "SUPERSEDED") {
        res.status(410).json({
          message: "This report has been replaced by a newer issued report",
          code: "REPORT_SUPERSEDED",
        });
        return;
      }

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

  router.post("/api/p/:token/downloaded", async (req, res, next) => {
    try {
      const { token } = req.params;
      const tokenHash = hashToken(token);

      const issued = await prisma.issuedReport.findUnique({
        where: { parentAccessToken: tokenHash },
      });

      if (!issued) {
        res.status(404).json({ message: "Report link not found or expired", code: "REPORT_LINK_NOT_FOUND" });
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
