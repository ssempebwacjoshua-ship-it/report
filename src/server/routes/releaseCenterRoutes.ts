import crypto from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db/prisma";
import { requireAuth } from "../middleware/requireAuth";
import { loadReportEngineInput } from "../repositories/reportsRepository";
import { getSettingsSections } from "../repositories/settingsRepository";
import { buildReports } from "../services/reportEngine";
import { buildReportLinkToken, buildReportVersionSignature, getReportLinkExpiry, isReportLinkExpired, sha256Hex } from "../services/reportLinkService";
import { defaultSettingsSections } from "../../shared/types/settings";
import type { PreferredContactMethod } from "@prisma/client";
import { getPublicAppUrl } from "../config/publicUrl";
import { sanitizeReportCardForRender, sanitizeReportPersonalizationForReport, sanitizeSchoolSettingsForReport } from "../../shared/utils/reportContentLimits";

function generateReferenceCode(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const suffix = crypto.randomBytes(3).toString("hex").toUpperCase();
  return `${y}${m}${d}-${suffix}`;
}

// ── Contact method resolution ─────────────────────────────────────────────────

export type ResolvedContact = {
  guardianName: string;
  method: "WHATSAPP" | "SMS" | "EMAIL";
  contactValue: string;
} | null;

function resolveContact(
  contacts: Array<{
    guardianName: string;
    preferredContactMethod: PreferredContactMethod;
    phone: string | null;
    email: string | null;
    isPrimary: boolean;
    canReceiveReports: boolean;
  }>,
): ResolvedContact {
  const eligible = contacts.filter((c) => c.canReceiveReports);
  const primary = eligible.find((c) => c.isPrimary) ?? eligible[0];
  if (!primary) return null;

  const { guardianName, preferredContactMethod: pref, phone, email } = primary;

  if (pref === "WHATSAPP" && phone) return { guardianName, method: "WHATSAPP", contactValue: phone };
  if (pref === "SMS" && phone) return { guardianName, method: "SMS", contactValue: phone };
  if (pref === "EMAIL" && email) return { guardianName, method: "EMAIL", contactValue: email };
  // PHONE or fallback ? prefer WhatsApp over SMS
  if (phone) return { guardianName, method: "WHATSAPP", contactValue: phone };
  if (email) return { guardianName, method: "EMAIL", contactValue: email };
  return null;
}

// ── Delivery status ───────────────────────────────────────────────────────────

export type DeliveryStatus =
  | "NOT_FINALIZED"
  | "MISSING_CONTACT"
  | "NOT_ISSUED"
  | "LINK_GENERATED"
  | "READY_TO_SEND"
  | "SENT_MANUALLY"
  | "OPENED"
  | "DOWNLOADED"
  | "REVOKED"
  | "SUPERSEDED";

function computeDeliveryStatus(
  readiness: string,
  issued: { status: string; viewedAt: Date | null; downloadedAt: Date | null; sentAt: Date | null; expiresAt: Date | null } | null,
  hasContact: boolean,
  isExpired: boolean,
): DeliveryStatus {
  if (readiness === "NO_FINALIZED_MARKS" || readiness === "NO_STUDENTS" || readiness === "NO_SUBJECTS" || readiness === "NO_ACTIVE_TERM") {
    return "NOT_FINALIZED";
  }
  if (!issued) return hasContact ? "NOT_ISSUED" : "MISSING_CONTACT";
  if (issued.status === "REVOKED") return "REVOKED";
  if (issued.status === "SUPERSEDED") return "SUPERSEDED";
  if (isExpired) return hasContact ? "NOT_ISSUED" : "MISSING_CONTACT";
  // issued.status === "ISSUED"
  if (issued.downloadedAt) return "DOWNLOADED";
  if (issued.viewedAt) return "OPENED";
  if (issued.sentAt) return "SENT_MANUALLY";
  if (hasContact) return "READY_TO_SEND";
  return "LINK_GENERATED";
}

// ── Filters ───────────────────────────────────────────────────────────────────

const releaseFiltersSchema = z.object({
  classId: z.string().min(1, "classId is required."),
  streamId: z.string().optional(),
  academicYearId: z.string().optional(),
  termId: z.string().optional(),
  assessmentType: z.enum(["BOT", "MOT", "EOT", "TERM_SUMMARY"]).default("TERM_SUMMARY"),
  search: z.string().optional(),
});

const bulkIssueSchema = z.object({
  classId: z.string().min(1),
  streamId: z.string().optional(),
  academicYearId: z.string().optional(),
  termId: z.string().optional(),
  assessmentType: z.enum(["BOT", "MOT", "EOT", "TERM_SUMMARY"]).default("TERM_SUMMARY"),
  studentIds: z.array(z.string().uuid()).optional(),
});

const bulkActionSchema = z.object({
  classId: z.string().min(1),
  studentIds: z.array(z.string().uuid()).min(1),
});

// ─────────────────────────────────────────────────────────────────────────────

export function releaseCenterRoutes() {
  const router = Router();

  // GET /api/reports/release-status
  router.get("/api/reports/release-status", requireAuth, async (req, res, next) => {
    try {
      const filters = releaseFiltersSchema.parse(req.query);
      const schoolCode = req.school!.code;
      const user = req.user!;
      const settings = await getSettingsSections(prisma, schoolCode);

      const engineInput = await loadReportEngineInput(prisma, {
        ...filters,
        schoolCode,
        assessmentType: filters.assessmentType ?? settings.academic.defaultAssessmentType,
      });
      const reportResult = buildReports(engineInput);

      const studentIds = engineInput.students.map((s) => s.id);

      // Load guardian contacts for all students in one query
      const allContacts = await prisma.guardianContact.findMany({
        where: { studentId: { in: studentIds }, canReceiveReports: true },
        orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
      });
      const contactsByStudent = new Map<string, typeof allContacts>();
      for (const c of allContacts) {
        const list = contactsByStudent.get(c.studentId) ?? [];
        list.push(c);
        contactsByStudent.set(c.studentId, list);
      }

      // Load most-recent issued report per student for this academic year+term+assessment
      const issuedReports = await prisma.issuedReport.findMany({
        where: {
          schoolId: user.schoolId,
          studentId: { in: studentIds },
          academicYear: engineInput.academicYearName,
          term: engineInput.termName,
          assessmentType: filters.assessmentType,
        },
        orderBy: { issuedAt: "desc" },
      });

      // Keep only the most-relevant issued report per student (ISSUED > SUPERSEDED > REVOKED)
      const issuedByStudent = new Map<string, (typeof issuedReports)[0]>();
      for (const r of issuedReports) {
        const existing = issuedByStudent.get(r.studentId);
        if (!existing || (r.status === "ISSUED" && existing.status !== "ISSUED")) {
          issuedByStudent.set(r.studentId, r);
        }
      }

      const search = filters.search?.toLowerCase();

      const now = new Date();
      const rows = reportResult.cards
        .filter((card) => {
          if (!search) return true;
          const student = engineInput.students.find((s) => s.id === card.studentId);
          return (
            card.studentName.toLowerCase().includes(search) ||
            (student?.admissionNumber ?? "").toLowerCase().includes(search)
          );
        })
        .map((card) => {
          const student = engineInput.students.find((s) => s.id === card.studentId)!;
          const contacts = contactsByStudent.get(card.studentId) ?? [];
          const contact = resolveContact(contacts);
          const issued = issuedByStudent.get(card.studentId) ?? null;
          const isExpired = issued ? isReportLinkExpired(issued.expiresAt, now) : false;
          const deliveryStatus = computeDeliveryStatus(card.readiness, issued, contact !== null, isExpired);

          return {
            studentId: card.studentId,
            admissionNumber: student.admissionNumber,
            studentName: card.studentName,
            reportReadiness: card.readiness,
            primaryContact: contact,
            isExpired,
            issuedReport: issued
              ? {
                  id: issued.id,
                  referenceCode: issued.referenceCode,
                  status: issued.status,
                  issuedAt: issued.issuedAt.toISOString(),
                  expiresAt: issued.expiresAt?.toISOString() ?? null,
                  issuedByName: issued.issuedByName,
                  viewedAt: issued.viewedAt?.toISOString() ?? null,
                  lastViewedAt: issued.lastViewedAt?.toISOString() ?? null,
                  openCount: issued.openCount,
                  downloadedAt: issued.downloadedAt?.toISOString() ?? null,
                  lastDownloadedAt: issued.lastDownloadedAt?.toISOString() ?? null,
                  downloadCount: issued.downloadCount,
                  sentAt: issued.sentAt?.toISOString() ?? null,
                  revokedAt: issued.revokedAt?.toISOString() ?? null,
                  revokeReason: issued.revokeReason ?? null,
                }
              : null,
            deliveryStatus,
          };
        });

      // Summary counts
      const summary = {
        total: rows.length,
        finalized: rows.filter((r) => r.reportReadiness === "READY" || r.reportReadiness === "MISSING_MARKS").length,
        linksGenerated: rows.filter((r) =>
          ["LINK_GENERATED", "READY_TO_SEND", "SENT_MANUALLY", "OPENED", "DOWNLOADED"].includes(r.deliveryStatus),
        ).length,
        missingContacts: rows.filter((r) => r.primaryContact === null).length,
        readyToSend: rows.filter((r) => r.deliveryStatus === "READY_TO_SEND").length,
        sentManually: rows.filter((r) => r.deliveryStatus === "SENT_MANUALLY").length,
        opened: rows.filter((r) => r.deliveryStatus === "OPENED").length,
        downloaded: rows.filter((r) => r.deliveryStatus === "DOWNLOADED").length,
        expired: rows.filter((r) => r.isExpired).length,
        needsAttention: rows.filter((r) => ["NOT_FINALIZED", "MISSING_CONTACT", "REVOKED"].includes(r.deliveryStatus) || r.isExpired).length,
      };

      res.json({
        rows,
        summary,
        meta: {
          academicYear: engineInput.academicYearName,
          term: engineInput.termName,
          assessmentType: filters.assessmentType,
          schoolName: settings.school.schoolName,
        },
      });
    } catch (error) {
      next(error);
    }
  });

  // POST /api/reports/issue-bulk
  router.post("/api/reports/issue-bulk", requireAuth, async (req, res, next) => {
    try {
      const body = bulkIssueSchema.parse(req.body);
      const schoolCode = req.school!.code;
      const user = req.user!;
      const settings = await getSettingsSections(prisma, schoolCode);
      const termExpiry = getReportLinkExpiry(settings.academic.termEndDate);

      const filters = {
        ...body,
        schoolCode,
        assessmentType: body.assessmentType ?? settings.academic.defaultAssessmentType,
      };

      const engineInput = await loadReportEngineInput(prisma, filters);
      const reportResult = buildReports(engineInput);

      const targetCards = body.studentIds?.length
        ? reportResult.cards.filter((c) => body.studentIds!.includes(c.studentId))
        : reportResult.cards;

      const issued: Array<{
        studentId: string;
        studentName: string;
        referenceCode: string;
        parentLink: string;
        parentAccessToken: string;
        issuedReportId: string;
      }> = [];
      const skipped: Array<{ studentId: string; studentName: string; reason: string }> = [];

      for (const card of targetCards) {
        const isFinalized = card.readiness === "READY" || card.readiness === "MISSING_MARKS";
        if (!isFinalized) {
          skipped.push({ studentId: card.studentId, studentName: card.studentName, reason: "No finalized marks" });
          continue;
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
        };
        const snapshotSignature = buildReportVersionSignature(snapshot);
        const existingReports = await prisma.issuedReport.findMany({
          where: {
            schoolId: user.schoolId,
            studentId: card.studentId,
            academicYear: engineInput.academicYearName,
            term: engineInput.termName,
            assessmentType: filters.assessmentType,
          },
          orderBy: { issuedAt: "desc" },
        });
        const activeExisting = existingReports.find((report) => report.status === "ISSUED" && !isReportLinkExpired(report.expiresAt));
        const activeExistingSignature = activeExisting ? buildReportVersionSignature(activeExisting.reportSnapshotJson) : null;

        if (activeExisting && activeExistingSignature === snapshotSignature) {
          const rawToken = buildReportLinkToken({
            reportId: activeExisting.id,
            snapshotSignature,
            schoolId: user.schoolId,
            studentId: card.studentId,
            academicYear: engineInput.academicYearName,
            term: engineInput.termName,
            assessmentType: filters.assessmentType,
          });

          issued.push({
            studentId: card.studentId,
            studentName: card.studentName,
            referenceCode: activeExisting.referenceCode,
            parentLink: `${getPublicAppUrl()}/parent/r/${rawToken}`,
            parentAccessToken: rawToken,
            issuedReportId: activeExisting.id,
          });

          await prisma.auditLog.create({
            data: {
              schoolId: user.schoolId,
              action: "report.link_reused",
              correlationId: activeExisting.id,
              details: {
                issuedReportId: activeExisting.id,
                referenceCode: activeExisting.referenceCode,
                studentId: card.studentId,
                academicYear: engineInput.academicYearName,
                term: engineInput.termName,
                assessmentType: filters.assessmentType,
                actorId: user.userId,
                actorName: user.name,
              },
            },
          });
          continue;
        }

        if (activeExisting) {
          await prisma.issuedReport.updateMany({
            where: {
              schoolId: user.schoolId,
              studentId: card.studentId,
              academicYear: engineInput.academicYearName,
              term: engineInput.termName,
              assessmentType: filters.assessmentType,
              status: "ISSUED",
            },
            data: { status: "SUPERSEDED", updatedAt: new Date() },
          });

          await prisma.auditLog.create({
            data: {
              schoolId: user.schoolId,
              action: "report.link_replaced",
              correlationId: activeExisting.id,
              details: {
                previousIssuedReportId: activeExisting.id,
                previousReferenceCode: activeExisting.referenceCode,
                studentId: card.studentId,
                academicYear: engineInput.academicYearName,
                term: engineInput.termName,
                assessmentType: filters.assessmentType,
                actorId: user.userId,
                actorName: user.name,
              },
            },
          });
        }

        const recordId = crypto.randomUUID();
        const rawToken = buildReportLinkToken({
          reportId: recordId,
          snapshotSignature,
          schoolId: user.schoolId,
          studentId: card.studentId,
          academicYear: engineInput.academicYearName,
          term: engineInput.termName,
          assessmentType: filters.assessmentType,
        });
        const tokenHash = sha256Hex(rawToken);
        const referenceCode = generateReferenceCode();

        const record = await prisma.issuedReport.create({
          data: {
            id: recordId,
            schoolId: user.schoolId,
            studentId: card.studentId,
            academicYear: engineInput.academicYearName,
            term: engineInput.termName,
            assessmentType: filters.assessmentType,
            reportSnapshotJson: snapshot,
            referenceCode,
            parentAccessToken: tokenHash,
            status: "ISSUED",
            expiresAt: termExpiry,
            issuedById: user.userId,
            issuedByName: user.name,
          },
        });

        await prisma.auditLog.create({
          data: {
            schoolId: user.schoolId,
            action: "report.link_issued",
            correlationId: record.id,
            details: {
              issuedReportId: record.id,
              referenceCode,
              studentId: card.studentId,
              academicYear: engineInput.academicYearName,
              term: engineInput.termName,
              assessmentType: filters.assessmentType,
              actorId: user.userId,
              actorName: user.name,
            },
          },
        });

        issued.push({
          studentId: card.studentId,
          studentName: card.studentName,
          referenceCode,
          parentLink: `${getPublicAppUrl()}/parent/r/${rawToken}`,
          parentAccessToken: rawToken,
          issuedReportId: record.id,
        });
      }

      res.status(201).json({ issued, skipped });
    } catch (error) {
      next(error);
    }
  });

  router.post("/api/reports/release/mark-sent-bulk", requireAuth, async (req, res, next) => {
    try {
      const body = bulkActionSchema.parse(req.body);
      const user = req.user!;
      const rows = await prisma.issuedReport.findMany({
        where: { schoolId: user.schoolId, studentId: { in: body.studentIds } },
        include: { student: { select: { firstName: true, lastName: true } } },
      });
      const skipped: Array<{ studentId: string; studentName: string; reason: string }> = [];
      let updated = 0;
      for (const studentId of body.studentIds) {
        const record = rows.find((row) => row.studentId === studentId);
        if (!record) {
          skipped.push({ studentId, studentName: "", reason: "No issued link" });
          continue;
        }
        if (record.status !== "ISSUED") {
          skipped.push({ studentId, studentName: `${record.student.firstName} ${record.student.lastName}`, reason: `Already ${record.status.toLowerCase()}` });
          continue;
        }
        if (isReportLinkExpired(record.expiresAt)) {
          skipped.push({ studentId, studentName: `${record.student.firstName} ${record.student.lastName}`, reason: "Expired" });
          continue;
        }
        const sentAt = record.sentAt ?? new Date();
        await prisma.issuedReport.updateMany({
          where: { id: record.id, schoolId: user.schoolId },
          data: {
            sentAt,
          },
        });
        if (!record.sentAt) {
          await prisma.auditLog.create({
            data: {
              schoolId: user.schoolId,
              action: "report.link_marked_sent",
              correlationId: record.id,
              details: {
                issuedReportId: record.id,
                studentId: record.studentId,
                sentAt: sentAt.toISOString(),
                actorId: user.userId,
                actorName: user.name,
              },
            },
          });
        }
        updated += 1;
      }
      res.json({ updated, skipped });
    } catch (error) {
      next(error);
    }
  });

  router.post("/api/reports/release/revoke-bulk", requireAuth, async (req, res, next) => {
    try {
      const body = bulkActionSchema.parse(req.body);
      const user = req.user!;
      const rows = await prisma.issuedReport.findMany({
        where: { schoolId: user.schoolId, studentId: { in: body.studentIds } },
        include: { student: { select: { firstName: true, lastName: true } } },
      });
      const skipped: Array<{ studentId: string; studentName: string; reason: string }> = [];
      let updated = 0;
      for (const studentId of body.studentIds) {
        const record = rows.find((row) => row.studentId === studentId);
        if (!record) {
          skipped.push({ studentId, studentName: "", reason: "No issued link" });
          continue;
        }
        if (record.status === "REVOKED") {
          skipped.push({ studentId, studentName: `${record.student.firstName} ${record.student.lastName}`, reason: "Already revoked" });
          continue;
        }
        if (record.status !== "ISSUED") {
          skipped.push({ studentId, studentName: `${record.student.firstName} ${record.student.lastName}`, reason: `Already ${record.status.toLowerCase()}` });
          continue;
        }
        if (isReportLinkExpired(record.expiresAt)) {
          skipped.push({ studentId, studentName: `${record.student.firstName} ${record.student.lastName}`, reason: "Expired" });
          continue;
        }
        const revokedAt = new Date();
        await prisma.issuedReport.updateMany({
          where: { id: record.id, schoolId: user.schoolId },
          data: { status: "REVOKED", revokedAt, revokeReason: null, updatedAt: revokedAt },
        });
        await prisma.auditLog.create({
          data: {
            schoolId: user.schoolId,
            action: "report.link_revoked",
            correlationId: record.id,
            details: {
              issuedReportId: record.id,
              studentId: record.studentId,
              actorId: user.userId,
              actorName: user.name,
            },
          },
        });
        updated += 1;
      }
      res.json({ updated, skipped });
    } catch (error) {
      next(error);
    }
  });

  // POST /api/reports/release/:id/mark-sent
  router.post("/api/reports/release/:id/mark-sent", requireAuth, async (req, res, next) => {
    try {
      const { id } = req.params as { id: string };
      const user = req.user!;

      const existing = await prisma.issuedReport.findFirst({
        where: { id, schoolId: user.schoolId },
      });

      if (!existing) {
        res.status(404).json({ error: "Issued report not found." });
        return;
      }

      if (existing.status !== "ISSUED") {
        res.status(409).json({ error: `Cannot mark as sent: report is ${existing.status.toLowerCase()}.` });
        return;
      }

      if (isReportLinkExpired(existing.expiresAt)) {
        res.status(410).json({ error: "Cannot mark as sent: report link has expired." });
        return;
      }

      const updated = await prisma.issuedReport.updateMany({
        where: { id, schoolId: user.schoolId },
        data: { sentAt: existing.sentAt ?? new Date() },
      });
      if (!updated.count) {
        res.status(404).json({ error: "Issued report not found." });
        return;
      }

      if (!existing.sentAt) {
        await prisma.auditLog.create({
          data: {
            schoolId: user.schoolId,
            action: "report.link_marked_sent",
            correlationId: id,
            details: {
              issuedReportId: id,
              actorId: user.userId,
              actorName: user.name,
            },
          },
        });
      }

      res.json({ id, sentAt: existing.sentAt ?? new Date() });
    } catch (error) {
      next(error);
    }
  });

  // POST /api/reports/release/:id/revoke
  router.post("/api/reports/release/:id/revoke", requireAuth, async (req, res, next) => {
    try {
      const { id } = req.params as { id: string };
      const user = req.user!;

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

      if (isReportLinkExpired(existing.expiresAt)) {
        res.status(410).json({ error: "Report link has expired." });
        return;
      }

      const revokedAt = new Date();
      const updated = await prisma.issuedReport.updateMany({
        where: { id, schoolId: user.schoolId },
        data: { status: "REVOKED", revokedAt, revokeReason: null, updatedAt: revokedAt },
      });
      if (!updated.count) {
        res.status(404).json({ error: "Issued report not found." });
        return;
      }

      await prisma.auditLog.create({
        data: {
          schoolId: user.schoolId,
          action: "report.link_revoked",
          correlationId: id,
          details: {
            issuedReportId: id,
            actorId: user.userId,
            actorName: user.name,
          },
        },
      });

      res.json({ id, status: "REVOKED" });
    } catch (error) {
      next(error);
    }
  });

  return router;
}

