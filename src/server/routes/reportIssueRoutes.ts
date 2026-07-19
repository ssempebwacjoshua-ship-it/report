import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db/prisma";
import { requireAuth } from "../middleware/requireAuth";
import { loadReportEngineInput } from "../repositories/reportsRepository";
import { getSettingsSections } from "../repositories/settingsRepository";
import { buildReports } from "../services/reportEngine";
import { entitlementErrorBody, evaluateSubscriptionEntitlement } from "../services/subscriptionEntitlementService";
import { issueOrReuseIssuedReportLink } from "../services/issuedReportLinkService";
import { COMMENT_LIMITS } from "../../shared/utils/reportComments";
import { defaultSettingsSections } from "../../shared/types/settings";
import { sanitizeReportCardForRender, sanitizeReportComments, sanitizeReportPersonalizationForReport, sanitizeSchoolSettingsForReport } from "../../shared/utils/reportContentLimits";

const reportCommentsSchema = z.object({
  classTeacherComment: z.string().max(COMMENT_LIMITS.classTeacherComment, `Class teacher comment must be ${COMMENT_LIMITS.classTeacherComment} characters or fewer.`).default(""),
  headTeacherComment: z.string().max(COMMENT_LIMITS.headTeacherComment, `Head teacher comment must be ${COMMENT_LIMITS.headTeacherComment} characters or fewer.`).default(""),
  conductNote: z.string().max(COMMENT_LIMITS.conductNote, `Conduct note must be ${COMMENT_LIMITS.conductNote} characters or fewer.`).default(""),
  classTeacherName: z.string().max(COMMENT_LIMITS.classTeacherName, `Class teacher name must be ${COMMENT_LIMITS.classTeacherName} characters or fewer.`).default(""),
  headTeacherName: z.string().max(COMMENT_LIMITS.headTeacherName, `Head teacher name must be ${COMMENT_LIMITS.headTeacherName} characters or fewer.`).default(""),
  issueDate: z.string().max(10).default(""),
});

const issueSchema = z.object({
  studentId: z.string().uuid("studentId must be a valid UUID."),
  academicYearId: z.string().optional(),
  termId: z.string().optional(),
  classId: z.string().min(1, "classId is required."),
  streamId: z.string().optional(),
  assessmentType: z.enum(["BOT", "MOT", "EOT", "TERM_SUMMARY"]).default("TERM_SUMMARY"),
  reportComments: reportCommentsSchema.optional(),
});

const revokeSchema = z.object({
  reason: z.string().trim().optional(),
});

export function reportIssueRoutes() {
  const router = Router();

  router.post("/api/reports/issue", requireAuth, async (req, res, next) => {
    try {
      const body = issueSchema.parse(req.body);
      const user = req.user!;
      const schoolCode = req.school!.code;
      const entitlement = await evaluateSubscriptionEntitlement({
        schoolId: req.school!.id,
        entitlement: "report.generate",
      });
      if (!entitlement.allowed) {
        res.status(entitlement.status).json(entitlementErrorBody(entitlement, "report.generate"));
        return;
      }

      const settings = await getSettingsSections(prisma, schoolCode);
      const filters = {
        schoolCode,
        studentId: body.studentId,
        classId: body.classId,
        streamId: body.streamId,
        academicYearId: body.academicYearId,
        termId: body.termId,
        assessmentType: body.assessmentType ?? settings.academic.defaultAssessmentType,
      };

      const engineInput = await loadReportEngineInput(prisma, filters);
      const reportResult = buildReports(engineInput);
      const card = reportResult.cards.find((candidate) => candidate.studentId === body.studentId);

      if (!card) {
        res.status(404).json({ error: "No report found for this student with current filters." });
        return;
      }

      if (card.readiness !== "READY" && card.readiness !== "MISSING_MARKS") {
        res.status(422).json({
          error: `Cannot issue report: ${card.readiness === "NO_FINALIZED_MARKS" ? "No finalized marks for this student." : card.readiness}`,
        });
        return;
      }

      const snapshot = {
        card: sanitizeReportCardForRender(card),
        settings: {
          ...reportResult.settings,
          school: sanitizeSchoolSettingsForReport(reportResult.settings.school),
          personalization: sanitizeReportPersonalizationForReport(reportResult.settings.personalization ?? defaultSettingsSections.reportPersonalization),
        },
        issuedAt: new Date().toISOString(),
        issuedByName: user.name,
        filters,
        reportComments: sanitizeReportComments(body.reportComments ?? {
          classTeacherComment: "",
          headTeacherComment: "",
          conductNote: "",
          classTeacherName: "",
          headTeacherName: "",
          issueDate: "",
        }),
      };

      const issued = await issueOrReuseIssuedReportLink({
        prisma,
        schoolId: user.schoolId,
        studentId: body.studentId,
        academicYear: card.academicYear,
        term: card.term,
        assessmentType: filters.assessmentType,
        snapshot,
        issuedById: user.userId,
        issuedByName: user.name,
        auditActorId: user.userId,
        auditActorName: user.name,
        expiresAt: null,
      });

      await prisma.auditLog.create({
        data: {
          schoolId: user.schoolId,
          action: "report.issue",
          correlationId: issued.issuedReportId,
          details: {
            issuedReportId: issued.issuedReportId,
            referenceCode: issued.referenceCode,
            studentId: body.studentId,
            actorId: user.userId,
            actorName: user.name,
          },
        },
      });

      console.log("report.issue", {
        issuedReportId: issued.issuedReportId,
        reportRefCode: issued.referenceCode,
        parentUrl: issued.parentLink,
        publicShortCode: issued.publicShortCode,
        reusedExisting: issued.reusedExisting,
        rawTokenPresent: Boolean(issued.parentAccessToken),
      });

      res.status(201).json({
        id: issued.issuedReportId,
        referenceCode: issued.referenceCode,
        parentAccessToken: issued.parentAccessToken,
        publicShortCode: issued.publicShortCode,
        parentLink: issued.parentLink,
        studentName: card.studentName,
        academicYear: card.academicYear,
        term: card.term,
        assessmentType: filters.assessmentType,
        issuedAt: issued.issuedAt,
      });
    } catch (error) {
      next(error);
    }
  });

  router.get("/api/reports/issued", requireAuth, async (req, res, next) => {
    try {
      const user = req.user!;

      const issued = await prisma.issuedReport.findMany({
        where: { schoolId: user.schoolId },
        include: { student: { select: { firstName: true, lastName: true, admissionNumber: true } } },
        orderBy: { issuedAt: "desc" },
        take: 200,
      });

      res.json(
        issued.map((row) => ({
          id: row.id,
          referenceCode: row.referenceCode,
          publicShortCode: row.publicShortCode,
          studentName: `${row.student.firstName} ${row.student.lastName}`,
          admissionNumber: row.student.admissionNumber,
          academicYear: row.academicYear,
          term: row.term,
          assessmentType: row.assessmentType,
          status: row.status,
          issuedAt: row.issuedAt,
          issuedByName: row.issuedByName,
          viewedAt: row.viewedAt,
          downloadedAt: row.downloadedAt,
        })),
      );
    } catch (error) {
      next(error);
    }
  });

  router.patch("/api/reports/issued/:id/revoke", requireAuth, async (req, res, next) => {
    try {
      const { id } = req.params;
      const user = req.user!;
      const { reason } = revokeSchema.parse(req.body);

      const existing = await prisma.issuedReport.findFirst({
        where: { id, schoolId: user.schoolId },
      });

      if (!existing) {
        res.status(404).json({ error: "Issued report not found." });
        return;
      }

      if (existing.status !== "ISSUED") {
        res.status(409).json({ error: `Report is already ${existing.status.toLowerCase()}.` });
        return;
      }

      const updated = await prisma.issuedReport.updateMany({
        where: { id, schoolId: user.schoolId },
        data: { status: "REVOKED", updatedAt: new Date() },
      });
      if (!updated.count) {
        res.status(404).json({ error: "Issued report not found." });
        return;
      }

      await prisma.auditLog.create({
        data: {
          schoolId: user.schoolId,
          action: "report.revoke",
          correlationId: id,
          details: { issuedReportId: id, reason: reason ?? null, actorId: user.userId, actorName: user.name },
        },
      });

      res.json({ id, status: "REVOKED" });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
