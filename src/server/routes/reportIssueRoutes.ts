import crypto from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db/prisma";
import { requireAuth } from "../middleware/requireAuth";
import { loadReportEngineInput } from "../repositories/reportsRepository";
import { getSettingsSections } from "../repositories/settingsRepository";
import { buildReports } from "../services/reportEngine";

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

const issueSchema = z.object({
  schoolCode: z.string().default("SCU-PREVIEW"),
  studentId: z.string().uuid("studentId must be a valid UUID."),
  academicYearId: z.string().optional(),
  termId: z.string().optional(),
  classId: z.string().min(1, "classId is required."),
  streamId: z.string().optional(),
  assessmentType: z.enum(["BOT", "MOT", "EOT", "TERM_SUMMARY"]).default("TERM_SUMMARY"),
});

const revokeSchema = z.object({
  reason: z.string().trim().optional(),
});

export function reportIssueRoutes() {
  const router = Router();

  // POST /api/reports/issue — create or reissue a report snapshot for a student
  router.post("/api/reports/issue", requireAuth, async (req, res, next) => {
    try {
      const body = issueSchema.parse(req.body);
      const user = req.user!;

      const settings = await getSettingsSections(prisma, body.schoolCode);
      const filters = {
        schoolCode: body.schoolCode,
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

      // Supersede any existing ISSUED reports for same student+year+term+type
      await prisma.issuedReport.updateMany({
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

      const snapshot = {
        card,
        settings: reportResult.settings,
        issuedAt: new Date().toISOString(),
        issuedByName: user.name,
        filters,
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

      const parentLink = `${process.env.CLIENT_ORIGIN ?? "http://localhost:5173"}/parent/r/${rawParentToken}`;
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

  // GET /api/reports/issued — list issued reports for a school
  router.get("/api/reports/issued", requireAuth, async (req, res, next) => {
    try {
      const schoolCode = String(req.query.schoolCode ?? "SCU-PREVIEW");
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
          parentLink: `${process.env.CLIENT_ORIGIN ?? "http://localhost:5173"}/parent/r/${r.parentAccessToken}`,
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

  // PATCH /api/reports/issued/:id/revoke — revoke an issued report
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

      res.json({ id: updated.id, status: updated.status });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
