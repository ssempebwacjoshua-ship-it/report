import crypto from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db/prisma";
import { requireAuth } from "../middleware/requireAuth";
import { entitlementErrorBody, evaluateSubscriptionEntitlement } from "../services/subscriptionEntitlementService";
import { loadReportEngineInput } from "../repositories/reportsRepository";
import { getSettingsSections } from "../repositories/settingsRepository";
import { buildReports } from "../services/reportEngine";
import { getReportLinkExpiry, isReportLinkExpired } from "../services/reportLinkService";
import { issueOrReuseIssuedReportLink } from "../services/issuedReportLinkService";
import { defaultSettingsSections } from "../../shared/types/settings";
import type { PreferredContactMethod } from "@prisma/client";
import { buildParentReportPublicUrl } from "../config/publicUrl";
import { sanitizeReportCardForRender, sanitizeReportPersonalizationForReport, sanitizeSchoolSettingsForReport } from "../../shared/utils/reportContentLimits";
import { buildParentReportReleaseMessage } from "../../shared/reportReleaseMessage";
import {
  buildDeliveryIdempotencyKey,
  estimateSmsSegments,
  hashRenderedContent,
  normalizePhoneToE164,
  type CommunicationChannel,
} from "../../shared/communications";
import { createProviderForChannel, DryRunMessageProvider, resolveSmsProvider } from "../services/communicationProviders";
import { isCommunicationDryRun } from "../services/communicationEngine";

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
  | "SENDING"
  | "FAILED"
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

const bulkSendSchema = bulkIssueSchema.extend({
  channel: z.enum(["SMS", "WHATSAPP"]),
  confirm: z.boolean(),
  previewOnly: z.boolean().optional(),
});

// ─────────────────────────────────────────────────────────────────────────────

async function ensureIssuedReportForCard(input: {
  user: { userId: string; schoolId: string; name: string };
  filters: Record<string, unknown> & { assessmentType: string };
  settings: Awaited<ReturnType<typeof getSettingsSections>>;
  reportResult: ReturnType<typeof buildReports>;
  engineInput: Awaited<ReturnType<typeof loadReportEngineInput>>;
  card: ReturnType<typeof buildReports>["cards"][number];
}) {
  const { user, filters, settings, reportResult, engineInput, card } = input;
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
  return {
    issuedReportId: result.issuedReportId,
    parentLink: result.parentLink,
    referenceCode: result.referenceCode,
    publicShortCode: result.publicShortCode,
    parentAccessToken: result.parentAccessToken,
    sentAt: result.sentAt,
  };
}

async function createReportReleaseRecipientAndDelivery(input: {
  user: { userId: string; schoolId: string; name: string };
  campaignId: string;
  snapshotId: string;
  channel: "SMS" | "WHATSAPP";
  provider: string;
  item: {
    card: ReturnType<typeof buildReports>["cards"][number];
    contact: NonNullable<ResolvedContact>;
    issuedReportId: string;
    parentLink: string;
    message: string;
    contentHash: string;
  };
}) {
  const recipient = await prisma.communicationRecipient.create({
    data: {
      schoolId: input.user.schoolId,
      campaignId: input.campaignId,
      audienceSnapshotId: input.snapshotId,
      studentId: input.item.card.studentId,
      displayName: input.item.contact.guardianName,
      relationship: "PARENT",
      phoneE164: normalizePhoneToE164(input.item.contact.contactValue),
      preferredChannel: input.channel,
      status: "QUEUED",
      personalisationJson: {
        studentName: input.item.card.studentName,
        guardianName: input.item.contact.guardianName,
        parentLink: input.item.parentLink,
        issuedReportId: input.item.issuedReportId,
      },
    },
  });
  const idempotencyKey = buildDeliveryIdempotencyKey({
    schoolId: input.user.schoolId,
    campaignId: input.campaignId,
    recipientId: recipient.id,
    channel: input.channel,
    contentVersion: 1,
  });
  const delivery = await prisma.communicationDelivery.create({
    data: {
      schoolId: input.user.schoolId,
      campaignId: input.campaignId,
      recipientId: recipient.id,
      channel: input.channel,
      provider: input.provider,
      status: "SUBMITTING",
      contentVersion: 1,
      idempotencyKey,
      renderedContentHash: input.item.contentHash,
      queuedAt: new Date(),
    },
  });
  const attempt = await prisma.communicationDeliveryAttempt.create({
    data: {
      deliveryId: delivery.id,
      attemptNumber: 1,
      provider: input.provider,
      status: "STARTED",
      requestId: idempotencyKey,
    },
  });
  return {
    recipientId: recipient.id,
    deliveryId: delivery.id,
    attemptId: attempt.id,
    idempotencyKey,
  };
}

async function markReportReleaseDeliveryAccepted(input: {
  user: { schoolId: string };
  pending: { deliveryId: string; attemptId: string };
  providerMessageId?: string;
  providerStatus?: string;
  issuedReportId: string;
}) {
  const now = new Date();
  await prisma.communicationDelivery.update({
    where: { id: input.pending.deliveryId },
    data: {
      status: "SUBMITTED",
      providerMessageId: input.providerMessageId,
      submittedAt: now,
      acceptedAt: now,
      attemptCount: { increment: 1 },
      lastErrorCode: null,
      lastErrorMessageSafe: null,
    },
  });
  await prisma.communicationDeliveryAttempt.update({
    where: { id: input.pending.attemptId },
    data: {
      status: "PROVIDER_ACCEPTED",
      providerMessageId: input.providerMessageId,
      providerResponseCode: input.providerStatus,
      completedAt: now,
    },
  });
  await prisma.issuedReport.updateMany({
    where: { id: input.issuedReportId, schoolId: input.user.schoolId, sentAt: null },
    data: { sentAt: now },
  });
}

async function markReportReleaseDeliveryFailed(input: {
  pending: { deliveryId: string; attemptId: string };
  errorCode: string;
  safeErrorMessage: string;
}) {
  const now = new Date();
  await prisma.communicationDelivery.update({
    where: { id: input.pending.deliveryId },
    data: {
      status: "FAILED",
      failedAt: now,
      lastErrorCode: input.errorCode,
      lastErrorMessageSafe: input.safeErrorMessage,
      attemptCount: { increment: 1 },
    },
  });
  await prisma.communicationDeliveryAttempt.update({
    where: { id: input.pending.attemptId },
    data: {
      status: "PROVIDER_REJECTED",
      providerResponseCode: "FAILED",
      errorCode: input.errorCode,
      errorMessageSafe: input.safeErrorMessage,
      completedAt: now,
    },
  });
}

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

      const reportReleaseRecipients = await prisma.communicationRecipient.findMany({
        where: {
          schoolId: user.schoolId,
          studentId: { in: studentIds },
          campaign: { type: "REPORT_RELEASE" },
        },
        include: {
          deliveries: { orderBy: { createdAt: "desc" }, take: 1 },
        },
        orderBy: { createdAt: "desc" },
      });
      const releaseDeliveryByIssuedReport = new Map<string, (typeof reportReleaseRecipients)[number]["deliveries"][number]>();
      for (const recipient of reportReleaseRecipients) {
        const details = (recipient.personalisationJson ?? {}) as Record<string, unknown>;
        const issuedReportId = typeof details.issuedReportId === "string" ? details.issuedReportId : null;
        const delivery = recipient.deliveries[0];
        if (issuedReportId && delivery && !releaseDeliveryByIssuedReport.has(issuedReportId)) {
          releaseDeliveryByIssuedReport.set(issuedReportId, delivery);
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
          const parentLink = issued?.publicShortCode ? buildParentReportPublicUrl(issued.publicShortCode) : null;
          const communicationDelivery = issued ? releaseDeliveryByIssuedReport.get(issued.id) ?? null : null;
          const deliveryStatus = communicationDelivery
            ? communicationDelivery.status === "FAILED" || communicationDelivery.status === "CANCELLED" || communicationDelivery.status === "SKIPPED"
              ? "FAILED"
              : communicationDelivery.status === "SUBMITTED" || communicationDelivery.status === "ACCEPTED" || communicationDelivery.status === "DELIVERED" || communicationDelivery.status === "READ"
                ? "SENT_MANUALLY"
                : "SENDING"
            : computeDeliveryStatus(card.readiness, issued, contact !== null, isExpired);

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
        sending: rows.filter((r) => r.deliveryStatus === "SENDING").length,
        failed: rows.filter((r) => r.deliveryStatus === "FAILED").length,
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
        ? reportResult.cards.filter((c) => body.studentIds!.includes(c.studentId))
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

  router.post("/api/reports/release/send-bulk", requireAuth, async (req, res, next) => {
    try {
      const body = bulkSendSchema.parse(req.body);
      if (!body.confirm && !body.previewOnly) {
        res.status(400).json({ error: "Sending requires explicit confirmation." });
        return;
      }
      const user = req.user!;
      const schoolCode = req.school!.code;
      const settings = await getSettingsSections(prisma, schoolCode);
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
      const targetStudentIds = targetCards.map((card) => card.studentId);
      const contacts = await prisma.guardianContact.findMany({
        where: { schoolId: user.schoolId, studentId: { in: targetStudentIds }, canReceiveReports: true },
        orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
      });
      const contactsByStudent = new Map<string, typeof contacts>();
      for (const contact of contacts) {
        const list = contactsByStudent.get(contact.studentId) ?? [];
        list.push(contact);
        contactsByStudent.set(contact.studentId, list);
      }

      const preview = {
        totalSelected: targetCards.length,
        issuableLinks: 0,
        missingContacts: 0,
        alreadySent: 0,
        estimatedSmsSegments: 0,
        estimatedSmsCredits: 0,
      };
      const skipped: Array<{ studentId: string; studentName: string; reason: string }> = [];
      const sendItems: Array<{
        card: (typeof targetCards)[number];
        contact: NonNullable<ResolvedContact>;
        issuedReportId: string;
        parentLink: string;
        message: string;
        contentHash: string;
      }> = [];

      for (const card of targetCards) {
        const isFinalized = card.readiness === "READY" || card.readiness === "MISSING_MARKS";
        if (!isFinalized) {
          skipped.push({ studentId: card.studentId, studentName: card.studentName, reason: "No finalized marks" });
          continue;
        }
        const contact = resolveContact(contactsByStudent.get(card.studentId) ?? []);
        if (!contact) {
          preview.missingContacts += 1;
          skipped.push({ studentId: card.studentId, studentName: card.studentName, reason: "Missing contact" });
          continue;
        }
        if ((body.channel === "SMS" || body.channel === "WHATSAPP") && !normalizePhoneToE164(contact.contactValue)) {
          preview.missingContacts += 1;
          skipped.push({ studentId: card.studentId, studentName: card.studentName, reason: "Invalid phone" });
          continue;
        }

        const issued = await ensureIssuedReportForCard({
          user,
          filters,
          settings,
          reportResult,
          engineInput,
          card,
        });
        preview.issuableLinks += 1;
        const message = buildParentReportReleaseMessage({
          studentName: card.studentName,
          termName: engineInput.termName,
          schoolName: settings.school.schoolName,
          reportLink: issued.parentLink,
        });
        const contentHash = hashRenderedContent(message);
        const duplicate = await prisma.communicationDelivery.findFirst({
          where: {
            schoolId: user.schoolId,
            channel: body.channel,
            renderedContentHash: contentHash,
            status: { in: ["SUBMITTED", "ACCEPTED", "DELIVERED", "READ"] },
            recipient: {
              schoolId: user.schoolId,
              studentId: card.studentId,
              personalisationJson: { path: ["issuedReportId"], equals: issued.issuedReportId },
            },
          },
        });
        if (duplicate || issued.sentAt) {
          preview.alreadySent += 1;
          skipped.push({ studentId: card.studentId, studentName: card.studentName, reason: "Already sent" });
          continue;
        }
        const smsEstimate = body.channel === "SMS" ? estimateSmsSegments(message) : null;
        preview.estimatedSmsSegments += smsEstimate?.segments ?? 0;
        preview.estimatedSmsCredits += smsEstimate?.billableUnits ?? 0;
        sendItems.push({
          card,
          contact,
          issuedReportId: issued.issuedReportId,
          parentLink: issued.parentLink,
          message,
          contentHash,
        });
      }

      if (body.previewOnly) {
        const message = preview.missingContacts > 0
          ? `${preview.missingContacts} missing parent contact${preview.missingContacts === 1 ? "" : "s"}.`
          : "Report release send preview is ready.";
        res.json({ message, preview, submitted: 0, failed: 0, skippedDuplicate: preview.alreadySent, missingContact: preview.missingContacts, alreadySent: preview.alreadySent, skipped });
        return;
      }

      if (sendItems.length === 0) {
        const message = preview.missingContacts > 0
          ? `${preview.missingContacts} missing parent contact${preview.missingContacts === 1 ? "" : "s"}. No report links were sent.`
          : preview.alreadySent > 0
            ? `${preview.alreadySent} report link${preview.alreadySent === 1 ? " was" : "s were"} already sent. No duplicates were sent.`
            : "No ready report links were available to send.";
        res.json({
          message,
          preview,
          submitted: 0,
          failed: 0,
          skippedDuplicate: preview.alreadySent,
          missingContact: preview.missingContacts,
          alreadySent: preview.alreadySent,
          skipped,
          results: [],
        });
        return;
      }

      if (body.channel === "SMS" && !isCommunicationDryRun()) {
        const provider = resolveSmsProvider();
        const channelSetting = await prisma.communicationChannelSetting.findFirst({
          where: { schoolId: user.schoolId, channel: "SMS", provider: provider.providerKey },
        });
        const providerContext = {
          schoolId: user.schoolId,
          sendingEnabled: channelSetting?.sendingEnabled ?? true,
          providerMetadata: (channelSetting?.providerMetadataJson ?? null) as Record<string, unknown> | null,
        };
        const config = await provider.checkHealth(providerContext);
        if (!config.sendingEnabled) {
          const message = config.issues?.join(", ") || "SMS provider is not configured yet. Contact platform owner.";
          res.status(503).json({
            message,
            preview,
            submitted: 0,
            failed: sendItems.length,
            skippedDuplicate: preview.alreadySent,
            missingContact: preview.missingContacts,
            alreadySent: preview.alreadySent,
            skipped,
            results: sendItems.map((item) => ({ studentId: item.card.studentId, status: "FAILED", errorCode: "PROVIDER_NOT_CONFIGURED" })),
          });
          return;
        }
      }

      const campaign = await prisma.communicationCampaign.create({
        data: {
          schoolId: user.schoolId,
          type: "REPORT_RELEASE",
          title: `${engineInput.termName} report release`,
          status: "SENDING",
          createdByUserId: user.userId,
          approvedByUserId: user.userId,
          approvedAt: new Date(),
          metadataJson: {
            classId: body.classId,
            streamId: body.streamId ?? null,
            academicYear: engineInput.academicYearName,
            term: engineInput.termName,
            assessmentType: filters.assessmentType,
            channel: body.channel,
          },
          contents: {
            create: {
              version: 1,
              body: "Personalized report release message",
              shortBody: null,
              createdByUserId: user.userId,
            },
          },
          audience: {
            create: {
              definitionJson: {
                audienceType: "PARENTS_OF_SELECTED_STUDENTS",
                studentIds: sendItems.map((item) => item.card.studentId),
                channel: body.channel,
                mode: "PER_STUDENT",
              },
              estimatedRecipients: sendItems.length,
            },
          },
        },
      });
      const snapshot = await prisma.communicationAudienceSnapshot.create({
        data: {
          campaignId: campaign.id,
          snapshotVersion: 1,
          recipientCount: sendItems.length,
          createdByUserId: user.userId,
        },
      });

      let submitted = 0;
      let failed = 0;
      const results: Array<Record<string, unknown>> = [];
      if (body.channel === "SMS") {
        const provider = isCommunicationDryRun() ? null : resolveSmsProvider();
        const providerKey = provider?.providerKey ?? "DRY_RUN";
        const channelSetting = provider ? await prisma.communicationChannelSetting.findFirst({
          where: { schoolId: user.schoolId, channel: "SMS", provider: provider.providerKey },
        }) : null;
        const providerContext = {
          schoolId: user.schoolId,
          sendingEnabled: channelSetting?.sendingEnabled ?? true,
          providerMetadata: (channelSetting?.providerMetadataJson ?? null) as Record<string, unknown> | null,
        };
        const pendingMessages = [];
        for (const item of sendItems) {
          const recipient = await createReportReleaseRecipientAndDelivery({
            user,
            campaignId: campaign.id,
            snapshotId: snapshot.id,
            channel: body.channel,
            provider: providerKey,
            item,
          });
          pendingMessages.push({
            ...recipient,
            item,
            toE164: normalizePhoneToE164(item.contact.contactValue)!,
            segmentCount: estimateSmsSegments(item.message).segments,
          });
        }
        const batchResult = provider
          ? await provider.sendBatch(pendingMessages.map((message) => ({
              recipientId: message.recipientId,
              toE164: message.toE164,
              text: message.item.message,
              idempotencyKey: message.idempotencyKey,
              segmentCount: message.segmentCount,
            })), providerContext)
          : {
              acceptedRecipients: pendingMessages.map((message) => ({
                recipientId: message.recipientId,
                providerMessageId: `dry-run-${message.idempotencyKey.slice(0, 16)}`,
                lifecycleState: "SENT" as const,
                providerStatus: "DRY_RUN_ACCEPTED",
                billableUnits: 0,
              })),
              rejectedRecipients: [],
            };
        const acceptedMap = new Map(batchResult.acceptedRecipients.map((entry) => [entry.recipientId, entry]));
        const rejectedMap = new Map(batchResult.rejectedRecipients.map((entry) => [entry.recipientId, entry]));
        for (const pending of pendingMessages) {
          const accepted = acceptedMap.get(pending.recipientId);
          const rejected = rejectedMap.get(pending.recipientId);
          if (accepted) {
            submitted += 1;
            await markReportReleaseDeliveryAccepted({ user, pending, providerMessageId: accepted.providerMessageId, providerStatus: accepted.providerStatus, issuedReportId: pending.item.issuedReportId });
            results.push({ studentId: pending.item.card.studentId, status: "SUBMITTED", providerMessageId: accepted.providerMessageId });
          } else {
            failed += 1;
            await markReportReleaseDeliveryFailed({ pending, errorCode: rejected?.errorCode ?? "PROVIDER_REJECTED", safeErrorMessage: rejected?.safeErrorMessage ?? "Provider rejected the message." });
            results.push({ studentId: pending.item.card.studentId, status: "FAILED", errorCode: rejected?.errorCode ?? "PROVIDER_REJECTED" });
          }
        }
      } else {
        const provider = isCommunicationDryRun() ? new DryRunMessageProvider("WHATSAPP") : createProviderForChannel("WHATSAPP");
        const channelSetting = await prisma.communicationChannelSetting.findFirst({
          where: { schoolId: user.schoolId, channel: "WHATSAPP", provider: provider.providerKey },
        });
        const config = await provider.validateConfiguration({
          schoolId: user.schoolId,
          sendingEnabled: channelSetting?.sendingEnabled ?? true,
          providerMetadata: (channelSetting?.providerMetadataJson ?? null) as Record<string, unknown> | null,
        });
        if (!config.sendingEnabled) {
          throw Object.assign(new Error(config.issues.join(", ") || "WhatsApp is not configured yet. Contact platform owner."), { status: 500, expose: true });
        }
        for (const item of sendItems) {
          const pending = await createReportReleaseRecipientAndDelivery({
            user,
            campaignId: campaign.id,
            snapshotId: snapshot.id,
            channel: body.channel,
            provider: provider.providerKey,
            item,
          });
          const rendered = await provider.render({ text: item.message, secureLink: item.parentLink });
          const response = await provider.submit({
            toE164: normalizePhoneToE164(item.contact.contactValue)!,
            rendered,
            idempotencyKey: pending.idempotencyKey,
          });
          if (response.accepted) {
            submitted += 1;
            await markReportReleaseDeliveryAccepted({ user, pending: { ...pending, item }, providerMessageId: response.providerMessageId, providerStatus: response.providerStatus ?? "ACCEPTED", issuedReportId: item.issuedReportId });
            results.push({ studentId: item.card.studentId, status: "SUBMITTED", providerMessageId: response.providerMessageId });
          } else {
            failed += 1;
            await markReportReleaseDeliveryFailed({ pending, errorCode: response.errorCode ?? "PROVIDER_REJECTED", safeErrorMessage: response.safeErrorMessage ?? "Provider rejected the message." });
            results.push({ studentId: item.card.studentId, status: "FAILED", errorCode: response.errorCode ?? "PROVIDER_REJECTED" });
          }
        }
      }

      await prisma.communicationCampaign.update({
        where: { id: campaign.id },
        data: { status: submitted > 0 && failed > 0 ? "PARTIALLY_DELIVERED" : failed > 0 ? "FAILED" : submitted > 0 ? "SENDING" : "FAILED" },
      });
      await prisma.auditLog.create({
        data: {
          schoolId: user.schoolId,
          action: "report.release_bulk_sent",
          correlationId: campaign.id,
          details: {
            campaignId: campaign.id,
            channel: body.channel,
            submitted,
            failed,
            skipped: skipped.length,
            actorId: user.userId,
            actorName: user.name,
          },
        },
      });
      res.json({
        campaignId: campaign.id,
        message: submitted > 0
          ? `Submitted ${submitted} report link${submitted === 1 ? "" : "s"} for ${body.channel}.`
          : `Failed to submit ${failed} report link${failed === 1 ? "" : "s"} for ${body.channel}.`,
        preview,
        submitted,
        failed,
        skippedDuplicate: preview.alreadySent,
        missingContact: preview.missingContacts,
        alreadySent: preview.alreadySent,
        skipped,
        results,
      });
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

