import { Router } from "express";
import { z } from "zod";
import type { PreferredContactMethod } from "@prisma/client";
import { prisma } from "../../../../server/db/prisma";
import { requireAuth } from "../../../../server/middleware/requireAuth";
import { requireSchoolPermission } from "../../../../server/middleware/requireSchoolPermission";
import { createAudienceSnapshot, createCampaign, getCampaignProgressTotals } from "../../../../server/services/communicationEngine";
import { resolveSmsProvider } from "../../../../server/services/communicationProviders";
import { sendOutreachEmail } from "../../../../server/services/emailService";
import { entitlementErrorBody, evaluateSubscriptionEntitlement } from "../../../../server/services/subscriptionEntitlementService";
import { buildDeliveryIdempotencyKey, hashRenderedContent } from "../../../../server/utils/communicationHashes";
import { loadReportEngineInput } from "../../../../server/repositories/reportsRepository";
import { getSettingsSections } from "../../../../server/repositories/settingsRepository";
import { buildReports } from "../../../../server/services/reportEngine";
import { prepareReleaseCenterCommunicationPreview } from "../services/releaseCenterCommunicationService";
import { getReportLinkExpiry, isReportLinkExpired } from "../services/reportLinkService";
import { issueOrReuseIssuedReportLink } from "../services/issuedReportLinkService";
import { buildParentReportPublicUrl } from "../../../../server/config/publicUrl";
import { estimateSmsSegments } from "../../../../shared/communications";
import { buildParentReportReleaseMessage, formatTermLabel } from "../../../../shared/reportReleaseMessage";
import { defaultSettingsSections } from "../../../../shared/types/settings";
import { sanitizeReportCardForRender, sanitizeReportPersonalizationForReport, sanitizeSchoolSettingsForReport } from "../../../../shared/utils/reportContentLimits";

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
  const eligible = contacts.filter((contact) => contact.canReceiveReports);
  const primary = eligible.find((contact) => contact.isPrimary) ?? eligible[0];
  if (!primary) return null;

  const { guardianName, preferredContactMethod: preference, phone, email } = primary;
  if (preference === "WHATSAPP" && phone) return { guardianName, method: "WHATSAPP", contactValue: phone };
  if (preference === "SMS" && phone) return { guardianName, method: "SMS", contactValue: phone };
  if (preference === "EMAIL" && email) return { guardianName, method: "EMAIL", contactValue: email };
  if (phone) return { guardianName, method: "WHATSAPP", contactValue: phone };
  if (email) return { guardianName, method: "EMAIL", contactValue: email };
  return null;
}

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
  issued: { status: string; viewedAt: Date | null; downloadedAt: Date | null; sentAt: Date | null } | null,
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
  if (issued.downloadedAt) return "DOWNLOADED";
  if (issued.viewedAt) return "OPENED";
  if (issued.sentAt) return "SENT_MANUALLY";
  if (hasContact) return "READY_TO_SEND";
  return "LINK_GENERATED";
}

function buildReleaseEmailSubject(studentName: string, termName: string, schoolName: string) {
  return `${studentName} ${formatTermLabel(termName)} school report - ${schoolName}`;
}

function buildReleaseMessage(studentName: string, termName: string, schoolName: string, reportLink: string) {
  return buildParentReportReleaseMessage({
    studentName,
    termName,
    schoolName,
    reportLink,
  });
}

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

const bulkSendSchema = z.object({
  classId: z.string().min(1),
  studentIds: z.array(z.string().uuid()).min(1),
  schoolCode: z.string().optional(),
  channel: z.enum(["SMS", "EMAIL"]),
  previewOnly: z.boolean().optional(),
  confirm: z.boolean().optional(),
});

const releaseCommunicationSchema = z.object({
  classId: z.string().min(1),
  streamId: z.string().optional(),
  academicYearId: z.string().optional(),
  termId: z.string().optional(),
  assessmentType: z.enum(["BOT", "MOT", "EOT", "TERM_SUMMARY"]).default("TERM_SUMMARY"),
  studentIds: z.array(z.string().uuid()).optional(),
  introduction: z.string().default(""),
  channel: z.enum(["SMS", "WHATSAPP"]).default("SMS"),
  forceNewVersion: z.boolean().optional(),
});

export function releaseCenterRoutes() {
  const router = Router();

  router.post("/api/reports/release/communications/preview", requireAuth, requireSchoolPermission("communications.validate"), async (req, res, next) => {
    try {
      const body = releaseCommunicationSchema.parse(req.body);
      const preview = await prepareReleaseCenterCommunicationPreview(prisma, {
        schoolId: req.school!.id,
        schoolCode: req.school!.code,
        schoolName: req.school!.name,
        actorId: req.user?.userId,
        actorName: req.user?.name,
      }, body);
      res.json({ preview });
    } catch (error) {
      next(error);
    }
  });

  router.post("/api/reports/release/communications", requireAuth, requireSchoolPermission("communications.create"), async (req, res, next) => {
    try {
      const body = releaseCommunicationSchema.parse(req.body);
      const user = req.user!;
      const preview = await prepareReleaseCenterCommunicationPreview(prisma, {
        schoolId: req.school!.id,
        schoolCode: req.school!.code,
        schoolName: req.school!.name,
        actorId: user.userId,
        actorName: user.name,
      }, body);

      if (!preview.channelAvailable) {
        res.status(400).json({ message: preview.unavailableReason ?? "This delivery channel is not available yet." });
        return;
      }
      if (preview.preparedRecipients.length === 0) {
        res.status(400).json({ message: "At least one released report with a valid guardian phone number is required." });
        return;
      }

      if (preview.existingCampaign && !body.forceNewVersion) {
        const progress = await getCampaignProgressTotals(prisma, {
          schoolId: req.school!.id,
          schoolName: req.school!.name,
          actorId: user.userId,
          actorName: user.name,
        }, preview.existingCampaign.id);
        res.json({
          reopened: true,
          duplicate: true,
          campaign: preview.existingCampaign,
          progress,
          preview,
        });
        return;
      }

      const title = `${preview.batchLabel} SMS`;
      const campaign = await createCampaign(prisma, {
        schoolId: req.school!.id,
        schoolName: req.school!.name,
        actorId: user.userId,
        actorName: user.name,
      }, {
        type: "REPORT_RELEASE",
        title,
        body: preview.messageTemplate,
        shortBody: preview.messageTemplate,
        metadataJson: {
          source: preview.source,
          releaseCentre: {
            introduction: preview.introduction,
            reportLinksPlaceholder: preview.reportLinksPlaceholder,
            counts: preview.counts,
            estimatedCostNote: preview.estimatedCostNote,
          },
        },
      });
      await createAudienceSnapshot(prisma, {
        schoolId: req.school!.id,
        schoolName: req.school!.name,
        actorId: user.userId,
        actorName: user.name,
      }, campaign.id, {
        audienceType: "PARENTS_OF_SELECTED_STUDENTS",
        studentIds: preview.source.selectedStudentIds,
        channel: "SMS",
        mode: "GENERAL",
      });
      const progress = await getCampaignProgressTotals(prisma, {
        schoolId: req.school!.id,
        schoolName: req.school!.name,
        actorId: user.userId,
        actorName: user.name,
      }, campaign.id);
      await prisma.auditLog.create({
        data: {
          schoolId: req.school!.id,
          action: "report.release_communication_created",
          correlationId: campaign.id,
          details: {
            campaignId: campaign.id,
            reportBatchId: preview.source.batchId,
            reportBatchVersion: preview.source.version,
            selectedStudentIds: preview.source.selectedStudentIds,
            selectedIssuedReportIds: preview.source.selectedIssuedReportIds,
            recipientTotals: preview.counts,
            actorId: user.userId,
            actorName: user.name,
          },
        },
      });

      res.status(201).json({
        reopened: false,
        duplicate: false,
        campaign: {
          id: campaign.id,
          title: campaign.title,
          status: campaign.status,
          version: preview.source.version,
        },
        progress,
        preview,
      });
    } catch (error) {
      next(error);
    }
  });

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
      const studentIds = engineInput.students.map((student) => student.id);

      const allContacts = await prisma.guardianContact.findMany({
        where: { studentId: { in: studentIds }, canReceiveReports: true },
        orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
      });
      const contactsByStudent = new Map<string, typeof allContacts>();
      for (const contact of allContacts) {
        const list = contactsByStudent.get(contact.studentId) ?? [];
        list.push(contact);
        contactsByStudent.set(contact.studentId, list);
      }

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

      const issuedByStudent = new Map<string, (typeof issuedReports)[0]>();
      for (const issued of issuedReports) {
        const existing = issuedByStudent.get(issued.studentId);
        if (!existing || (issued.status === "ISSUED" && existing.status !== "ISSUED")) {
          issuedByStudent.set(issued.studentId, issued);
        }
      }

      const search = filters.search?.toLowerCase();
      const now = new Date();
      const rows = reportResult.cards
        .filter((card) => {
          if (!search) return true;
          const student = engineInput.students.find((item) => item.id === card.studentId);
          return card.studentName.toLowerCase().includes(search) || (student?.admissionNumber ?? "").toLowerCase().includes(search);
        })
        .map((card) => {
          const student = engineInput.students.find((item) => item.id === card.studentId)!;
          const contact = resolveContact(contactsByStudent.get(card.studentId) ?? []);
          const issued = issuedByStudent.get(card.studentId) ?? null;
          const isExpired = issued ? isReportLinkExpired(issued.expiresAt, now) : false;
          const parentLink = issued?.publicShortCode ? buildParentReportPublicUrl(issued.publicShortCode) : null;

          return {
            studentId: card.studentId,
            admissionNumber: student.admissionNumber,
            studentName: card.studentName,
            reportReadiness: card.readiness,
            primaryContact: contact,
            isExpired,
            parentLink,
            issuedReport: issued
              ? {
                  id: issued.id,
                  referenceCode: issued.referenceCode,
                  publicShortCode: issued.publicShortCode,
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
            deliveryStatus: computeDeliveryStatus(card.readiness, issued, contact !== null, isExpired),
          };
        });

      res.json({
        rows,
        summary: {
          total: rows.length,
          finalized: rows.filter((row) => row.reportReadiness === "READY" || row.reportReadiness === "MISSING_MARKS").length,
          linksGenerated: rows.filter((row) => ["LINK_GENERATED", "READY_TO_SEND", "SENT_MANUALLY", "OPENED", "DOWNLOADED"].includes(row.deliveryStatus)).length,
          missingContacts: rows.filter((row) => row.primaryContact === null).length,
          readyToSend: rows.filter((row) => row.deliveryStatus === "READY_TO_SEND").length,
          sentManually: rows.filter((row) => row.deliveryStatus === "SENT_MANUALLY").length,
          opened: rows.filter((row) => row.deliveryStatus === "OPENED").length,
          downloaded: rows.filter((row) => row.deliveryStatus === "DOWNLOADED").length,
          expired: rows.filter((row) => row.isExpired).length,
          needsAttention: rows.filter((row) => ["NOT_FINALIZED", "MISSING_CONTACT", "REVOKED"].includes(row.deliveryStatus) || row.isExpired).length,
        },
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

  router.post("/api/reports/issue-bulk", requireAuth, async (req, res, next) => {
    try {
      const body = bulkIssueSchema.parse(req.body);
      const schoolCode = req.school!.code;
      const user = req.user!;
      const entitlement = await evaluateSubscriptionEntitlement({
        schoolId: req.school!.id,
        entitlement: "report.bulk_generate",
      });
      if (!entitlement.allowed) {
        res.status(entitlement.status).json(entitlementErrorBody(entitlement, "report.bulk_generate"));
        return;
      }

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
        ? reportResult.cards.filter((card) => body.studentIds!.includes(card.studentId))
        : reportResult.cards;

      const issued: Array<{
        studentId: string;
        studentName: string;
        referenceCode: string;
        publicShortCode: string;
        parentLink: string;
        parentAccessToken: string | null;
        issuedReportId: string;
      }> = [];
      const skipped: Array<{ studentId: string; studentName: string; reason: string }> = [];

      for (const card of targetCards) {
        if (card.readiness !== "READY" && card.readiness !== "MISSING_MARKS") {
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

        const result = await issueOrReuseIssuedReportLink({
          prisma,
          schoolId: user.schoolId,
          studentId: card.studentId,
          academicYear: engineInput.academicYearName,
          term: engineInput.termName,
          assessmentType: filters.assessmentType,
          snapshot,
          issuedById: user.userId,
          issuedByName: user.name,
          auditActorId: user.userId,
          auditActorName: user.name,
          expiresAt: termExpiry,
        });

        issued.push({
          studentId: card.studentId,
          studentName: card.studentName,
          referenceCode: result.referenceCode,
          publicShortCode: result.publicShortCode,
          parentLink: result.parentLink,
          parentAccessToken: result.parentAccessToken,
          issuedReportId: result.issuedReportId,
        });
      }

      res.status(201).json({ issued, skipped });
    } catch (error) {
      next(error);
    }
  });

  router.post("/api/reports/release/send-bulk", requireAuth, async (req, res, next) => {
    try {
      const body = bulkSendSchema.parse(req.body);
      const user = req.user!;
      const schoolCode = req.school!.code;
      const dryRun = process.env.COMMUNICATION_DRY_RUN === "true";
      const entitlement = await evaluateSubscriptionEntitlement({
        schoolId: req.school!.id,
        entitlement: "communications.send",
      });
      if (!entitlement.allowed) {
        res.status(entitlement.status).json(entitlementErrorBody(entitlement, "communications.send"));
        return;
      }

      if (body.channel === "SMS" && !dryRun) {
        const provider = resolveSmsProvider();
        const config = await provider.checkHealth({
          schoolId: user.schoolId,
          sendingEnabled: true,
          providerMetadata: null,
        });
        if (!config.sendingEnabled) {
          throw Object.assign(new Error(config.issues.join(", ")), { status: 500, expose: true });
        }
      }

      const settings = await getSettingsSections(prisma, schoolCode);
      const filters = {
        schoolCode,
        classId: body.classId,
        assessmentType: settings.academic.defaultAssessmentType,
      };
      const engineInput = await loadReportEngineInput(prisma, filters);
      const reportResult = buildReports(engineInput);
      const targetCards = reportResult.cards.filter((card) => body.studentIds.includes(card.studentId));
      const studentIds = targetCards.map((card) => card.studentId);

      const allContacts = await prisma.guardianContact.findMany({
        where: { studentId: { in: studentIds }, canReceiveReports: true },
        orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
      });
      const contactsByStudent = new Map<string, typeof allContacts>();
      for (const contact of allContacts) {
        const list = contactsByStudent.get(contact.studentId) ?? [];
        list.push(contact);
        contactsByStudent.set(contact.studentId, list);
      }

      const existingIssuedReports = await prisma.issuedReport.findMany({
        where: {
          schoolId: user.schoolId,
          studentId: { in: studentIds },
          academicYear: engineInput.academicYearName,
          term: engineInput.termName,
          assessmentType: filters.assessmentType,
        },
        orderBy: { issuedAt: "desc" },
      });
      const issuedByStudent = new Map<string, (typeof existingIssuedReports)[number]>();
      for (const issued of existingIssuedReports) {
        const existing = issuedByStudent.get(issued.studentId);
        if (!existing || (issued.status === "ISSUED" && existing.status !== "ISSUED")) {
          issuedByStudent.set(issued.studentId, issued);
        }
      }

      const preview = {
        totalSelected: body.studentIds.length,
        issuableLinks: 0,
        missingContacts: 0,
        alreadySent: 0,
        estimatedSmsSegments: 0,
        estimatedSmsCredits: 0,
        emailRecipients: 0,
      };
      const skipped: Array<{ studentId: string; studentName: string; reason: string }> = [];
      const candidates: Array<{
        card: (typeof targetCards)[number];
        student: (typeof engineInput.students)[number];
        contact: NonNullable<ResolvedContact>;
        issued: (typeof existingIssuedReports)[number] | null;
        message: string;
        subject: string;
        idempotencyKey: string;
      }> = [];

      for (const card of targetCards) {
        const student = engineInput.students.find((item) => item.id === card.studentId);
        if (!student) continue;
        const contact = resolveContact(contactsByStudent.get(card.studentId) ?? []);
        const matchingContact = body.channel === "SMS"
          ? contact && contact.contactValue && contact.method !== "EMAIL" ? contact : null
          : contact && contact.method === "EMAIL" ? contact : null;

        if (!matchingContact) {
          preview.missingContacts += 1;
          skipped.push({ studentId: card.studentId, studentName: card.studentName, reason: "Missing valid contact" });
          continue;
        }

        let issued = issuedByStudent.get(card.studentId) ?? null;
        const expired = issued ? isReportLinkExpired(issued.expiresAt) : false;
        if (!issued || issued.status !== "ISSUED" || expired) {
          if (card.readiness !== "READY" && card.readiness !== "MISSING_MARKS") {
            skipped.push({ studentId: card.studentId, studentName: card.studentName, reason: "Report not ready to issue" });
            continue;
          }
          preview.issuableLinks += 1;
          if (!body.previewOnly) {
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
            const result = await issueOrReuseIssuedReportLink({
              prisma,
              schoolId: user.schoolId,
              studentId: card.studentId,
              academicYear: engineInput.academicYearName,
              term: engineInput.termName,
              assessmentType: filters.assessmentType,
              snapshot,
              issuedById: user.userId,
              issuedByName: user.name,
              auditActorId: user.userId,
              auditActorName: user.name,
              expiresAt: getReportLinkExpiry(settings.academic.termEndDate),
            });
            issued = await prisma.issuedReport.findFirst({ where: { id: result.issuedReportId, schoolId: user.schoolId } });
          }
        }

        const reportLink = issued?.publicShortCode ? buildParentReportPublicUrl(issued.publicShortCode) : null;
        if (!reportLink || !issued) {
          skipped.push({ studentId: card.studentId, studentName: card.studentName, reason: "No issued link" });
          continue;
        }

        const message = buildReleaseMessage(card.studentName, engineInput.termName, settings.school.schoolName, reportLink);
        const subject = buildReleaseEmailSubject(card.studentName, engineInput.termName, settings.school.schoolName);
        const contentVersion = Math.trunc(new Date(issued.issuedAt).getTime() / 1000);
        const idempotencyKey = buildDeliveryIdempotencyKey({
          schoolId: user.schoolId,
          campaignId: issued.id,
          recipientId: `${card.studentId}:${matchingContact.contactValue}`,
          channel: body.channel,
          contentVersion,
        });
        const duplicate = await prisma.communicationDelivery.findUnique({ where: { idempotencyKey } });
        if (duplicate && ["SUBMITTED", "ACCEPTED", "DELIVERED", "READ"].includes(duplicate.status)) {
          preview.alreadySent += 1;
          skipped.push({ studentId: card.studentId, studentName: card.studentName, reason: "Already sent" });
          continue;
        }

        if (body.channel === "SMS") {
          const smsEstimate = estimateSmsSegments(message);
          preview.estimatedSmsSegments += smsEstimate.segments;
          preview.estimatedSmsCredits += smsEstimate.billableUnits;
        } else {
          preview.emailRecipients += 1;
        }

        candidates.push({ card, student, contact: matchingContact, issued, message, subject, idempotencyKey });
      }

      if (body.previewOnly) {
        res.json({
          preview,
          submitted: 0,
          failed: 0,
          skippedDuplicate: preview.alreadySent,
          missingContact: preview.missingContacts,
          alreadySent: preview.alreadySent,
          skipped,
        });
        return;
      }

      if (!body.confirm) {
        res.status(400).json({ error: "Confirmation is required before sending reports." });
        return;
      }

      let campaignId: string | null = null;
      let snapshotId: string | null = null;
      if (candidates.length > 0) {
        const campaign = await prisma.communicationCampaign.create({
          data: {
            schoolId: user.schoolId,
            type: "REPORT_RELEASE",
            title: `Release Center ${body.channel} send`,
            createdByUserId: user.userId,
            status: "SENDING",
            contents: {
              create: {
                version: 1,
                subject: body.channel === "EMAIL" ? "Report release" : null,
                body: "Release Center report delivery",
                createdByUserId: user.userId,
              },
            },
          },
        });
        const snapshot = await prisma.communicationAudienceSnapshot.create({
          data: {
            campaignId: campaign.id,
            snapshotVersion: 1,
            createdByUserId: user.userId,
            recipientCount: candidates.length,
          },
        });
        campaignId = campaign.id;
        snapshotId = snapshot.id;
      }

      let submitted = 0;
      let failed = 0;
      let skippedDuplicate = preview.alreadySent;
      for (const candidate of candidates) {
        const recipient = await prisma.communicationRecipient.create({
          data: {
            schoolId: user.schoolId,
            campaignId: campaignId!,
            audienceSnapshotId: snapshotId!,
            studentId: candidate.card.studentId,
            displayName: candidate.card.studentName,
            guardianId: null,
            relationship: candidate.contact.guardianName,
            phoneE164: body.channel === "SMS" ? candidate.contact.contactValue : null,
            email: body.channel === "EMAIL" ? candidate.contact.contactValue : null,
            preferredChannel: body.channel,
            status: "QUEUED",
            personalisationJson: {
              guardianName: candidate.contact.guardianName,
              studentName: candidate.card.studentName,
              schoolName: settings.school.schoolName,
            },
          },
        });
        const delivery = await prisma.communicationDelivery.create({
          data: {
            schoolId: user.schoolId,
            campaignId: campaignId!,
            recipientId: recipient.id,
            channel: body.channel,
            provider: body.channel === "SMS" ? (dryRun ? "DRY_RUN" : resolveSmsProvider().providerKey) : (dryRun ? "DRY_RUN" : "OUTREACH_EMAIL"),
            status: "SUBMITTING",
            contentVersion: 1,
            idempotencyKey: candidate.idempotencyKey,
            renderedContentHash: hashRenderedContent(body.channel === "EMAIL" ? `${candidate.subject}\n${candidate.message}` : candidate.message),
            queuedAt: new Date(),
          },
        });
        const attempt = await prisma.communicationDeliveryAttempt.create({
          data: {
            deliveryId: delivery.id,
            attemptNumber: 1,
            provider: delivery.provider,
            status: "STARTED",
            requestId: candidate.idempotencyKey,
          },
        });

        const now = new Date();
        if (body.channel === "SMS") {
          const provider = resolveSmsProvider();
          const estimate = estimateSmsSegments(candidate.message);
          const smsResult = dryRun
            ? {
                acceptedRecipients: [{
                  recipientId: recipient.id,
                  providerMessageId: `dry-run-${candidate.idempotencyKey.slice(0, 16)}`,
                  requestProviderMessageId: undefined,
                  lifecycleState: "SENT" as const,
                  providerStatus: "DRY_RUN_ACCEPTED",
                  billableUnits: 0,
                }],
                rejectedRecipients: [],
              }
            : await provider.sendBatch([{
                recipientId: recipient.id,
                toE164: candidate.contact.contactValue,
                text: candidate.message,
                idempotencyKey: candidate.idempotencyKey,
                segmentCount: estimate.segments,
              }], {
                schoolId: user.schoolId,
                sendingEnabled: true,
                providerMetadata: null,
              });

          const accepted = smsResult.acceptedRecipients[0];
          if (accepted) {
            submitted += 1;
            await prisma.communicationDelivery.update({
              where: { id: delivery.id },
              data: {
                status: "SUBMITTED",
                providerMessageId: accepted.providerMessageId ?? accepted.requestProviderMessageId,
                submittedAt: now,
                acceptedAt: now,
                attemptCount: 1,
              },
            });
            await prisma.communicationDeliveryAttempt.update({
              where: { id: attempt.id },
              data: {
                status: "PROVIDER_ACCEPTED",
                providerMessageId: accepted.providerMessageId ?? accepted.requestProviderMessageId,
                providerResponseCode: accepted.providerStatus,
                completedAt: now,
              },
            });
            await prisma.issuedReport.update({
              where: { id: candidate.issued.id },
              data: { sentAt: candidate.issued.sentAt ?? now },
            });
            continue;
          }

          const rejected = smsResult.rejectedRecipients[0];
          failed += 1;
          await prisma.communicationDelivery.update({
            where: { id: delivery.id },
            data: {
              status: "FAILED",
              failedAt: now,
              lastErrorCode: rejected?.errorCode ?? "SMS_SEND_FAILED",
              lastErrorMessageSafe: rejected?.safeErrorMessage ?? "SMS provider rejected the message.",
              attemptCount: 1,
            },
          });
          await prisma.communicationDeliveryAttempt.update({
            where: { id: attempt.id },
            data: {
              status: "PROVIDER_REJECTED",
              errorCode: rejected?.errorCode ?? "SMS_SEND_FAILED",
              errorMessageSafe: rejected?.safeErrorMessage ?? "SMS provider rejected the message.",
              completedAt: now,
            },
          });
          skipped.push({ studentId: candidate.card.studentId, studentName: candidate.card.studentName, reason: rejected?.safeErrorMessage ?? "Provider rejected" });
          continue;
        }

        const emailResult = dryRun
          ? { ok: true as const, provider: "RESEND" as const, messageId: `dry-run-${candidate.idempotencyKey.slice(0, 16)}` }
          : await sendOutreachEmail({
              to: candidate.contact.contactValue,
              subject: candidate.subject,
              text: candidate.message,
              html: candidate.message.replace(/\n/g, "<br />"),
            });

        if (emailResult.ok) {
          submitted += 1;
          await prisma.communicationDelivery.update({
            where: { id: delivery.id },
            data: {
              status: "SUBMITTED",
              providerMessageId: emailResult.messageId,
              submittedAt: now,
              acceptedAt: now,
              attemptCount: 1,
            },
          });
          await prisma.communicationDeliveryAttempt.update({
            where: { id: attempt.id },
            data: {
              status: "PROVIDER_ACCEPTED",
              providerMessageId: emailResult.messageId,
              providerResponseCode: emailResult.provider,
              completedAt: now,
            },
          });
          await prisma.issuedReport.update({
            where: { id: candidate.issued.id },
            data: { sentAt: candidate.issued.sentAt ?? now },
          });
          continue;
        }

        failed += 1;
        await prisma.communicationDelivery.update({
          where: { id: delivery.id },
          data: {
            status: "FAILED",
            failedAt: now,
            lastErrorCode: emailResult.safeErrorCode,
            lastErrorMessageSafe: emailResult.safeErrorMessage,
            attemptCount: 1,
          },
        });
        await prisma.communicationDeliveryAttempt.update({
          where: { id: attempt.id },
          data: {
            status: "PROVIDER_REJECTED",
            errorCode: emailResult.safeErrorCode,
            errorMessageSafe: emailResult.safeErrorMessage,
            completedAt: now,
          },
        });
        skipped.push({ studentId: candidate.card.studentId, studentName: candidate.card.studentName, reason: emailResult.safeErrorMessage ?? "Provider rejected" });
      }

      res.json({
        preview,
        submitted,
        failed,
        skippedDuplicate,
        missingContact: preview.missingContacts,
        alreadySent: preview.alreadySent,
        skipped,
      });
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
          data: { sentAt },
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
            details: { issuedReportId: id, actorId: user.userId, actorName: user.name },
          },
        });
      }

      res.json({ id, sentAt: existing.sentAt ?? new Date() });
    } catch (error) {
      next(error);
    }
  });

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
          details: { issuedReportId: id, actorId: user.userId, actorName: user.name },
        },
      });

      res.json({ id, status: "REVOKED" });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
