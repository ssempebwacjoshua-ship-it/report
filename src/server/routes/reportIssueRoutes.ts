import crypto from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db/prisma";
import { getPublicAppUrl } from "../config/publicUrl";
import { requireAuth } from "../middleware/requireAuth";
import { loadReportEngineInput } from "../repositories/reportsRepository";
import { getSettingsSections } from "../repositories/settingsRepository";
import { buildReports } from "../services/reportEngine";
import { COMMENT_LIMITS } from "../../shared/utils/reportComments";

function generateToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function generateReferenceCode(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const suffix = crypto.randomBytes(3).toString("hex").toUpperCase();
  return `${y}${m}${d}-${suffix}`;
}

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

const bulkIssueSchema = z.object({
  studentIds: z.array(z.string().uuid()).min(1, "At least one student is required."),
  classId: z.string().min(1, "classId is required."),
  streamId: z.string().optional(),
  academicYearId: z.string().optional(),
  termId: z.string().optional(),
  assessmentType: z.enum(["BOT", "MOT", "EOT", "TERM_SUMMARY"]).default("TERM_SUMMARY"),
  reportComments: reportCommentsSchema.optional(),
});

export function reportIssueRoutes() {
  const router = Router();

  // POST /api/reports/issue ? create or reissue a report snapshot for a student
  router.post("/api/reports/issue", requireAuth, async (req, res, next) => {
    try {
      const body = issueSchema.parse(req.body);
      const user = req.user!;
      const schoolCode = req.school!.code;

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
      const card = reportResult.cards.find((c) => c.studentId === body.studentId);

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

      if (card.contactReadiness !== "READY") {
        res.status(422).json({
          error: "Cannot issue report: student has no parent/guardian contact with phone and email. Add contact details before issuing.",
          code: "MISSING_CONTACT",
          contactReadiness: card.contactReadiness,
          contactSummary: card.contactSummary,
        });
        return;
      }

      // Supersede any existing ISSUED reports for same student+year+term+type
      const supersededResult = await prisma.issuedReport.updateMany({
        where: {
          schoolId: user.schoolId,
          studentId: body.studentId,
          academicYear: card.academicYear,
          term: card.term,
          assessmentType: filters.assessmentType,
          status: "ISSUED",
        },
        data: { status: "SUPERSEDED", updatedAt: new Date() },
      });

      if (supersededResult.count > 0) {
        await prisma.auditLog.create({
          data: {
            schoolId: user.schoolId,
            action: "report.superseded",
            details: { studentId: body.studentId, count: supersededResult.count, actorId: user.userId, actorName: user.name },
          },
        });
      }

      const snapshot = {
        card,
        settings: reportResult.settings,
        issuedAt: new Date().toISOString(),
        issuedByName: user.name,
        filters,
        reportComments: body.reportComments ?? {
          classTeacherComment: "",
          headTeacherComment: "",
          conductNote: "",
          classTeacherName: "",
          headTeacherName: "",
          issueDate: "",
        },
      };

      const rawParentToken = generateToken();
      const parentTokenHash = hashToken(rawParentToken);
      const referenceCode = generateReferenceCode();

      const issued = await prisma.issuedReport.create({
        data: {
          schoolId: user.schoolId,
          studentId: body.studentId,
          academicYear: card.academicYear,
          term: card.term,
          assessmentType: filters.assessmentType,
          reportSnapshotJson: snapshot,
          referenceCode,
          parentAccessToken: parentTokenHash,
          status: "ISSUED",
          issuedById: user.userId,
          issuedByName: user.name,
        },
      });

      await prisma.auditLog.create({
        data: {
          schoolId: user.schoolId,
          action: "report.issue",
          correlationId: issued.id,
          details: { issuedReportId: issued.id, referenceCode, studentId: body.studentId, actorId: user.userId, actorName: user.name },
        },
      });

      const parentLink = `${getPublicAppUrl()}/parent/r/${rawParentToken}`;
      console.log("report.issue", {
        issuedReportId: issued.id,
        reportRefCode: referenceCode,
        parentUrl: parentLink,
        tokenLength: rawParentToken.length,
        tokenHashPrefix: `${parentTokenHash.slice(0, 12)}...`,
      });

      res.status(201).json({
        id: issued.id,
        referenceCode,
        parentAccessToken: rawParentToken,
        parentLink,
        studentName: card.studentName,
        academicYear: card.academicYear,
        term: card.term,
        assessmentType: issued.assessmentType,
        issuedAt: issued.issuedAt,
      });
    } catch (error) {
      next(error);
    }
  });

  // POST /api/reports/bulk-issue ? preflight contact check then issue all selected students
  router.post("/api/reports/bulk-issue", requireAuth, async (req, res, next) => {
    try {
      const body = bulkIssueSchema.parse(req.body);
      const user = req.user!;
      const schoolCode = req.school!.code;

      const settings = await getSettingsSections(prisma, schoolCode);
      const assessmentType = body.assessmentType ?? settings.academic.defaultAssessmentType;
      const filters = {
        schoolCode,
        classId: body.classId,
        streamId: body.streamId,
        academicYearId: body.academicYearId,
        termId: body.termId,
        assessmentType,
      };

      // Load all cards for the class so we can check contacts for every selected student
      const engineInput = await loadReportEngineInput(prisma, filters);
      const reportResult = buildReports(engineInput);

      const requested = new Set(body.studentIds);
      const selectedCards = reportResult.cards.filter((c) => requested.has(c.studentId));

      // Preflight: block if any selected student is missing contacts
      const blocked = selectedCards.filter((c) => c.contactReadiness !== "READY");
      if (blocked.length > 0) {
        res.status(422).json({
          error: `Cannot issue reports: ${blocked.length} student${blocked.length !== 1 ? "s are" : " is"} missing parent contact details.`,
          code: "MISSING_CONTACTS",
          blockedStudents: blocked.map((c) => ({
            studentId: c.studentId,
            studentName: c.studentName,
            admissionNumber: c.admissionNumber,
            className: c.className,
            streamName: c.streamName,
            contactReadiness: c.contactReadiness,
            contactSummary: c.contactSummary,
          })),
        });
        return;
      }

      // Also block if any selected student has no marks at all
      const noMarks = selectedCards.filter((c) => c.marksFound === 0);
      if (noMarks.length > 0) {
        res.status(422).json({
          error: `Cannot issue reports: ${noMarks.length} student${noMarks.length !== 1 ? "s have" : " has"} no finalized marks.`,
          code: "NO_MARKS",
          blockedStudents: noMarks.map((c) => ({ studentId: c.studentId, studentName: c.studentName, admissionNumber: c.admissionNumber })),
        });
        return;
      }

      const issued: Array<{ studentId: string; studentName: string; referenceCode: string; parentLink: string }> = [];

      for (const card of selectedCards) {
        // Supersede prior ISSUED reports
        await prisma.issuedReport.updateMany({
          where: { schoolId: user.schoolId, studentId: card.studentId, academicYear: card.academicYear, term: card.term, assessmentType, status: "ISSUED" },
          data: { status: "SUPERSEDED", updatedAt: new Date() },
        });

        const snapshot = {
          card,
          settings: reportResult.settings,
          issuedAt: new Date().toISOString(),
          issuedByName: user.name,
          filters,
          reportComments: body.reportComments ?? { classTeacherComment: "", headTeacherComment: "", conductNote: "", classTeacherName: "", headTeacherName: "", issueDate: "" },
        };

        const rawParentToken = generateToken();
        const parentTokenHash = hashToken(rawParentToken);
        const referenceCode = generateReferenceCode();

        const issuedRecord = await prisma.issuedReport.create({
          data: {
            schoolId: user.schoolId,
            studentId: card.studentId,
            academicYear: card.academicYear,
            term: card.term,
            assessmentType,
            reportSnapshotJson: snapshot,
            referenceCode,
            parentAccessToken: parentTokenHash,
            status: "ISSUED",
            issuedById: user.userId,
            issuedByName: user.name,
          },
        });

        await prisma.auditLog.create({
          data: {
            schoolId: user.schoolId,
            action: "report.bulk_issue",
            correlationId: issuedRecord.id,
            details: { issuedReportId: issuedRecord.id, referenceCode, studentId: card.studentId, actorId: user.userId, actorName: user.name },
          },
        });

        issued.push({
          studentId: card.studentId,
          studentName: card.studentName,
          referenceCode,
          parentLink: `${getPublicAppUrl()}/parent/r/${rawParentToken}`,
        });
      }

      res.status(201).json({ issued, count: issued.length });
    } catch (error) {
      next(error);
    }
  });

  // GET /api/reports/issued ? list issued reports for a school
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
        issued.map((r) => ({
          id: r.id,
          referenceCode: r.referenceCode,
          parentAccessToken: r.parentAccessToken,
          parentLink: `${getPublicAppUrl()}/parent/r/${r.parentAccessToken}`,
          studentName: `${r.student.firstName} ${r.student.lastName}`,
          admissionNumber: r.student.admissionNumber,
          academicYear: r.academicYear,
          term: r.term,
          assessmentType: r.assessmentType,
          status: r.status,
          issuedAt: r.issuedAt,
          issuedByName: r.issuedByName,
          viewedAt: r.viewedAt,
          downloadedAt: r.downloadedAt,
        })),
      );
    } catch (error) {
      next(error);
    }
  });

  // PATCH /api/reports/issued/:id/revoke ? revoke an issued report
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

      const updated = await prisma.issuedReport.update({
        where: { id },
        data: { status: "REVOKED", updatedAt: new Date() },
      });

      await prisma.auditLog.create({
        data: {
          schoolId: user.schoolId,
          action: "report.revoke",
          correlationId: id,
          details: { issuedReportId: id, reason: reason ?? null, actorId: user.userId, actorName: user.name },
        },
      });

      res.json({ id: updated.id, status: updated.status });
    } catch (error) {
      next(error);
    }
  });

  return router;
}

