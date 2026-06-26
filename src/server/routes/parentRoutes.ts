import crypto from "node:crypto";
import { Router } from "express";
import { prisma } from "../db/prisma";
import { sanitizeReportCardForRender, sanitizeReportComments, sanitizeSchoolSettingsForReport } from "../../shared/utils/reportContentLimits";

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function buildPublicSnapshot(snapshot: any) {
  const card = snapshot?.card ? sanitizeReportCardForRender(snapshot.card) : null;
  const schoolSettings = snapshot?.settings?.school
    ? sanitizeSchoolSettingsForReport(snapshot.settings.school)
    : null;
  const reportComments = snapshot?.reportComments
    ? sanitizeReportComments(snapshot.reportComments)
    : undefined;

  return {
    card: card
      ? {
          studentId: "",
          admissionNumber: card.admissionNumber,
          studentName: card.studentName,
          className: card.className,
          streamName: card.streamName,
          academicYear: card.academicYear,
          term: card.term,
          marksFound: card.marksFound,
          totalSubjects: card.totalSubjects,
          average: card.average,
          grade: card.grade,
          overallPosition: card.overallPosition,
          readiness: card.readiness,
          missingMarks: [],
          comments: "",
          contactReadiness: "NO_RECIPIENT",
          contactSummary: "",
          subjects: card.subjects.map((subject) => ({
            subjectId: "",
            subjectName: subject.subjectName,
            botMarks: subject.botMarks,
            motMarks: subject.motMarks,
            eotMarks: subject.eotMarks,
            total: subject.total,
            average: subject.average,
            grade: subject.grade,
            subjectPosition: null,
            missingMarks: [],
            comments: subject.comments,
          })),
          progressionText: card.progressionText,
        }
      : null,
    settings: schoolSettings && snapshot?.settings?.reports && snapshot?.settings?.grading
      ? {
          school: schoolSettings,
          reports: snapshot.settings.reports,
          grading: snapshot.settings.grading,
        }
      : null,
    filters: snapshot?.filters ? { assessmentType: snapshot.filters.assessmentType } : null,
    reportComments,
  };
}

export function parentRoutes() {
  const router = Router();

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
          school: { select: { name: true } },
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
        status: issued.status,
        referenceCode: issued.referenceCode,
        issuedAt: issued.issuedAt,
        issuedByName: issued.issuedByName,
        school: { name: issued.school.name },
        snapshot: buildPublicSnapshot(issued.reportSnapshotJson),
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

      if (issued.status === "REVOKED") {
        res.status(410).json({ message: "This report link was revoked", code: "REPORT_REVOKED" });
        return;
      }

      if (issued.status === "SUPERSEDED") {
        res.status(410).json({ message: "This report has been replaced by a newer issued report", code: "REPORT_SUPERSEDED" });
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
