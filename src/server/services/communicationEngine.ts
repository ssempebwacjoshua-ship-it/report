import type { PrismaClient } from "@prisma/client";
import {
  assertCampaignTransition,
  buildDeliveryIdempotencyKey,
  communicationChannels,
  estimateSmsSegments,
  hashRenderedContent,
  normalizeDeliveryProgressState,
  type AudienceDefinition,
  type CommunicationChannel,
  type CommunicationCampaignStatus,
  type CommunicationProgressState,
  type ValidationIssue,
} from "../../shared/communications";
import { collectCommunicationAudienceRows, resolveCommunicationAudience } from "./communicationAudienceService";

export { resolveCommunicationAudience } from "./communicationAudienceService";
import { createProviderForChannel, DryRunMessageProvider, resolveSmsProvider, type SmsProvider } from "./communicationProviders";
import { evaluateSubscriptionEntitlement } from "./subscriptionEntitlementService";

type Db = PrismaClient;

type TemplatePolicyStatus = "DRY_RUN_ONLY" | "APPROVED_TEMPLATE_BOUND" | "TEMPLATE_REQUIRED" | "TEMPLATE_VARIABLES_INVALID";

export type CommunicationContext = {
  schoolId: string;
  schoolName: string;
  actorId?: string;
  actorName?: string;
};

export function isCommunicationDryRun() {
  return process.env.COMMUNICATION_DRY_RUN !== "false";
}

async function requireLiveCommunicationsEnabled(db: Db, ctx: CommunicationContext) {
  if (isCommunicationDryRun()) return;
  const decision = await evaluateSubscriptionEntitlement({
    db,
    schoolId: ctx.schoolId,
    entitlement: "communications.send",
  });
  if (!decision.allowed) {
    throw Object.assign(new Error("Communications are not enabled for this school. Contact platform support."), {
      status: decision.status,
      expose: true,
      code: decision.code,
      details: {
        entitlement: "communications.send",
        subscriptionStatus: decision.subscriptionStatus ?? null,
      },
    });
  }
}

type TemplateValidationResult = {
  template: {
    id: string;
    name: string;
    channel: CommunicationChannel;
    communicationType: string;
    status: string;
    providerTemplateName: string | null;
    providerTemplateId: string | null;
    variablesJson: unknown;
  };
  policyStatus: TemplatePolicyStatus;
};

function extractTemplateVariables(input: string) {
  const variables = new Set<string>();
  const pattern = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;
  for (let match = pattern.exec(input); match; match = pattern.exec(input)) {
    variables.add(match[1]);
  }
  return [...variables];
}

function normalizeTemplateVariableNames(value: unknown) {
  if (Array.isArray(value)) {
    return value.filter((entry): entry is string => typeof entry === "string").map((entry) => entry.trim()).filter(Boolean);
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const candidates = [
      record.variables,
      record.required,
      record.requiredVariables,
      record.allowed,
      record.allowedVariables,
      record.placeholders,
    ];
    for (const candidate of candidates) {
      const normalized = normalizeTemplateVariableNames(candidate);
      if (normalized.length) return normalized;
    }
  }
  return [];
}

function getMessageVariables(content: { body: string; shortBody?: string | null }) {
  return [...new Set([
    ...extractTemplateVariables(content.body),
    ...extractTemplateVariables(content.shortBody ?? ""),
  ])];
}

function hasOwnTemplateBinding(template: TemplateValidationResult["template"]) {
  return Boolean(template.providerTemplateName?.trim() || template.providerTemplateId?.trim());
}

async function requireLiveTemplatePolicy(db: Db, ctx: CommunicationContext, campaignId: string, channel: CommunicationChannel) {
  const campaign = await getCampaignOrThrow(db, ctx, campaignId);
  const content = campaign.contents.find((entry) => entry.version === campaign.contentVersion) ?? campaign.contents[0];
  if (!content?.body?.trim()) {
    throw httpError(400, "Message body is required before sending.");
  }

  const template = await db.communicationTemplate.findFirst({
    where: {
      schoolId: ctx.schoolId,
      channel: channel as never,
      communicationType: campaign.type as never,
      status: { in: ["APPROVED", "ACTIVE"] },
    },
    orderBy: { updatedAt: "desc" },
  });
  if (!template) {
    throw Object.assign(new Error("An approved communication template is required before live sending."), {
      status: 402,
      expose: true,
      code: "COMMUNICATION_TEMPLATE_REQUIRED",
      details: {
        channel,
        communicationType: campaign.type,
        templateStatus: null,
        policyStatus: "TEMPLATE_REQUIRED" as TemplatePolicyStatus,
      },
    });
  }

  if (channel === "WHATSAPP" && !hasOwnTemplateBinding(template)) {
    throw Object.assign(new Error("WhatsApp live sending requires an approved provider template binding."), {
      status: 402,
      expose: true,
      code: "WHATSAPP_TEMPLATE_BINDING_REQUIRED",
      details: {
        channel,
        communicationType: campaign.type,
        templateId: template.id,
        templateStatus: template.status,
        policyStatus: "TEMPLATE_REQUIRED" as TemplatePolicyStatus,
      },
    });
  }

  const requiredVariables = new Set([
    ...getMessageVariables(content),
    ...normalizeTemplateVariableNames(template.variablesJson),
  ]);
  const allowedVariables = new Set(normalizeTemplateVariableNames(template.variablesJson));
  const unknownVariables = [...requiredVariables].filter((variable) => allowedVariables.size === 0 || !allowedVariables.has(variable));
  if (unknownVariables.length > 0) {
    throw Object.assign(new Error("Message variables do not match the approved template."), {
      status: 400,
      expose: true,
      code: "COMMUNICATION_TEMPLATE_VARIABLES_INVALID",
      details: {
        channel,
        communicationType: campaign.type,
        templateId: template.id,
        missingVariables: [...requiredVariables].filter((variable) => !allowedVariables.has(variable)),
        unknownVariables,
        policyStatus: "TEMPLATE_VARIABLES_INVALID" as TemplatePolicyStatus,
      },
    });
  }

  return {
    template,
    policyStatus: "APPROVED_TEMPLATE_BOUND" as TemplatePolicyStatus,
  };
}

export async function createCampaign(db: Db, ctx: CommunicationContext, input: {
  type: string;
  title: string;
  body: string;
  subject?: string;
  shortBody?: string;
  acknowledgementRequired?: boolean;
  audience?: AudienceDefinition;
}) {
  const campaign = await db.communicationCampaign.create({
    data: {
      schoolId: ctx.schoolId,
      type: input.type as never,
      title: input.title,
      acknowledgementRequired: input.acknowledgementRequired ?? false,
      createdByUserId: ctx.actorId,
      contents: {
        create: {
          version: 1,
          subject: input.subject,
          body: input.body,
          shortBody: input.shortBody,
          createdByUserId: ctx.actorId,
        },
      },
      audience: input.audience ? { create: { definitionJson: input.audience as never } } : undefined,
    },
    include: { contents: { orderBy: { version: "desc" }, take: 1 }, audience: true },
  });
  await audit(db, ctx, "communication.campaign_created", campaign.id, { type: input.type });
  return campaign;
}

export async function listCampaigns(db: Db, ctx: CommunicationContext) {
  const campaigns = await db.communicationCampaign.findMany({
    where: { schoolId: ctx.schoolId },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      contents: { orderBy: { version: "desc" }, take: 1 },
      _count: { select: { recipients: true, deliveries: true } },
    },
  });
  const summary = await db.communicationCampaign.groupBy({
    by: ["status"],
    where: { schoolId: ctx.schoolId },
    _count: { status: true },
  });
  return { campaigns, summary };
}

export async function getCampaignOrThrow(db: Db, ctx: CommunicationContext, id: string) {
  const campaign = await db.communicationCampaign.findFirst({
    where: { id, schoolId: ctx.schoolId },
    include: {
      contents: { orderBy: { version: "desc" } },
      audience: true,
      audienceSnapshots: { orderBy: { snapshotVersion: "desc" }, take: 1 },
      _count: { select: { recipients: true, deliveries: true } },
    },
  });
  if (!campaign) throw httpError(404, "Communication campaign not found.");
  return campaign;
}

export async function updateCampaignDraft(db: Db, ctx: CommunicationContext, id: string, input: {
  title?: string;
  body?: string;
  subject?: string;
  audience?: AudienceDefinition;
}) {
  const campaign = await getCampaignOrThrow(db, ctx, id);
  if (["QUEUED", "SENDING", "DELIVERED", "CANCELLED"].includes(campaign.status)) {
    throw httpError(400, "This campaign can no longer be edited.");
  }
  const nextVersion = campaign.status === "APPROVED" ? campaign.contentVersion + 1 : campaign.contentVersion;
  const updated = await db.$transaction(async (tx) => {
    if (input.body || input.subject) {
      await tx.communicationContent.create({
        data: {
          campaignId: id,
          version: nextVersion,
          subject: input.subject ?? campaign.contents[0]?.subject ?? null,
          body: input.body ?? campaign.contents[0]?.body ?? "",
          createdByUserId: ctx.actorId,
        },
      });
    }
    if (input.audience) {
      await tx.communicationAudience.upsert({
        where: { campaignId: id },
        update: { definitionJson: input.audience as never },
        create: { campaignId: id, definitionJson: input.audience as never },
      });
    }
    return tx.communicationCampaign.update({
      where: { id },
      data: {
        title: input.title,
        contentVersion: nextVersion,
        status: campaign.status === "APPROVED" ? "APPROVAL_PENDING" : campaign.status,
        approvedAt: campaign.status === "APPROVED" ? null : campaign.approvedAt,
        approvedByUserId: campaign.status === "APPROVED" ? null : campaign.approvedByUserId,
      },
    });
  });
  await audit(db, ctx, "communication.content_edited", id, { nextVersion });
  return updated;
}

export async function createAudienceSnapshot(db: Db, ctx: CommunicationContext, campaignId: string, definition: AudienceDefinition) {
  const campaign = await getCampaignOrThrow(db, ctx, campaignId);
  const collection = await collectCommunicationAudienceRows(db, ctx, definition);
  const latest = campaign.audienceSnapshots[0]?.snapshotVersion ?? 0;
  const snapshot = await db.$transaction(async (tx) => {
    const row = await tx.communicationAudienceSnapshot.create({
      data: { campaignId, snapshotVersion: latest + 1, createdByUserId: ctx.actorId },
    });
    const recipients = collection.rows.map((recipient) => {
      const eligible = recipient.eligibilityStatus === "ELIGIBLE";
      const status = eligible ? "READY" : recipient.eligibilityStatus === "DUPLICATE_CONTACT" ? "EXCLUDED" : "BLOCKED";
      const guardianId = recipient.source === "guardian" ? recipient.id.replace(/^guardian:/, "") : null;
      const staffUserId = recipient.source === "staff" ? recipient.id.replace(/^staff:/, "") : null;
      return {
        schoolId: ctx.schoolId,
        campaignId,
        audienceSnapshotId: row.id,
        guardianId,
        studentId: recipient.studentId,
        staffUserId,
        displayName: recipient.contactName || recipient.studentName,
        relationship: recipient.relationship,
        phoneE164: eligible && recipient.channelAvailability.sms ? recipient.phone : null,
        email: recipient.email,
        preferredChannel: recipient.selectedChannel,
        status,
        warningCodesJson: eligible ? [] : null,
        blockedReasonCode: eligible ? null : recipient.eligibilityStatus,
        personalisationJson: {
          guardianName: recipient.contactName || recipient.studentName,
          studentName: recipient.studentName,
          className: recipient.className,
          streamName: recipient.streamName,
          schoolName: ctx.schoolName,
          communicationTitle: campaign.title,
          contactRole: recipient.contactRole,
        },
      };
    });
    if (recipients.length) await tx.communicationRecipient.createMany({ data: recipients as never[] });
    return tx.communicationAudienceSnapshot.update({ where: { id: row.id }, data: { recipientCount: recipients.length } });
  });
  const ready = collection.rows.filter((row) => row.eligibilityStatus === "ELIGIBLE").length;
  const warnings = 0;
  const blocked = collection.rows.filter((row) => row.eligibilityStatus !== "ELIGIBLE").length;
  await audit(db, ctx, "communication.audience_snapshot_created", campaignId, { snapshotId: snapshot.id, ready, warnings, blocked });
  return { snapshot, total: collection.rows.length, ready, warnings, blocked };
}

export async function previewAudience(db: Db, ctx: CommunicationContext, definition: AudienceDefinition) {
  return resolveCommunicationAudience(db, ctx, definition);
}

export async function validateCampaign(db: Db, ctx: CommunicationContext, campaignId: string) {
  const campaign = await getCampaignOrThrow(db, ctx, campaignId);
  if (campaign.status === "DRAFT" || campaign.status === "VALIDATION_FAILED") {
    await transitionCampaign(db, ctx, campaignId, "VALIDATING");
  }
  const recipients = await db.communicationRecipient.findMany({ where: { schoolId: ctx.schoolId, campaignId } });
  const issues: ValidationIssue[] = [];
  if (!campaign.contents[0]?.body?.trim()) issues.push({ code: "MISSING_CONTENT", severity: "BLOCKING", message: "Message body is required." });
  if (recipients.length === 0) issues.push({ code: "NO_RECIPIENTS", severity: "BLOCKING", message: "Create an audience snapshot before validation." });
  for (const recipient of recipients) {
    if (!recipient.phoneE164) issues.push({ code: "MISSING_PHONE", severity: "BLOCKING", recipientId: recipient.id, message: "Recipient has no valid phone number." });
    if (!recipient.preferredChannel) issues.push({ code: "NO_USABLE_CHANNEL", severity: "BLOCKING", recipientId: recipient.id, message: "Recipient has no usable delivery channel." });
  }
  const sms = estimateSmsSegments(campaign.contents[0]?.shortBody || campaign.contents[0]?.body || "");
  if (sms.segments > 3) issues.push({ code: "SMS_SEGMENT_POLICY_WARNING", severity: "WARNING", message: "SMS body is longer than three segments." });
  await transitionCampaign(db, ctx, campaignId, issues.some((i) => i.severity === "BLOCKING") ? "VALIDATION_FAILED" : "READY_FOR_APPROVAL");
  await audit(db, ctx, "communication.validation_completed", campaignId, { issueCount: issues.length });
  return { issues, sms };
}

export async function requestApproval(db: Db, ctx: CommunicationContext, campaignId: string) {
  await transitionCampaign(db, ctx, campaignId, "APPROVAL_PENDING");
  await db.communicationApproval.create({
    data: { campaignId, requiredRole: "ADMIN_OPERATOR", requestedByUserId: ctx.actorId },
  });
  await audit(db, ctx, "communication.approval_requested", campaignId, {});
}

export async function approveCampaign(db: Db, ctx: CommunicationContext, campaignId: string) {
  await transitionCampaign(db, ctx, campaignId, "APPROVED", { approvedAt: new Date(), approvedByUserId: ctx.actorId });
  await db.communicationApproval.updateMany({
    where: { campaignId, status: "PENDING" },
    data: { status: "APPROVED", reviewedByUserId: ctx.actorId, reviewedAt: new Date() },
  });
  await audit(db, ctx, "communication.campaign_approved", campaignId, {});
}

export async function queueCampaign(db: Db, ctx: CommunicationContext, campaignId: string, channels: CommunicationChannel[] = ["WHATSAPP"]) {
  await requireLiveCommunicationsEnabled(db, ctx);
  if (!isCommunicationDryRun()) {
    for (const channel of channels) {
      await requireLiveTemplatePolicy(db, ctx, campaignId, channel);
    }
  }
  const campaign = await getCampaignOrThrow(db, ctx, campaignId);
  if (campaign.status !== "APPROVED" && campaign.status !== "FAILED") throw httpError(400, "Only approved campaigns can be queued.");
  const recipients = await db.communicationRecipient.findMany({ where: { schoolId: ctx.schoolId, campaignId, status: { in: ["READY", "WARNING"] } } });
  const content = campaign.contents.find((c) => c.version === campaign.contentVersion) ?? campaign.contents[0];
  await db.$transaction(async (tx) => {
    for (const recipient of recipients) {
      const vars = (recipient.personalisationJson ?? {}) as Record<string, string>;
      const body = renderContent(content?.shortBody || content?.body || "", vars);
      for (const channel of channels) {
        const idempotencyKey = buildDeliveryIdempotencyKey({ schoolId: ctx.schoolId, campaignId, recipientId: recipient.id, channel, contentVersion: campaign.contentVersion });
        const delivery = await tx.communicationDelivery.upsert({
          where: { idempotencyKey },
          update: { status: "QUEUED", queuedAt: new Date() },
          create: {
            schoolId: ctx.schoolId,
            campaignId,
            recipientId: recipient.id,
            channel: channel as never,
            contentVersion: campaign.contentVersion,
            idempotencyKey,
            provider: "DRY_RUN",
            status: "QUEUED",
            queuedAt: new Date(),
            renderedContentHash: hashRenderedContent(body),
          },
        });
        await tx.communicationDeliveryAttempt.create({
          data: {
            deliveryId: delivery.id,
            attemptNumber: delivery.attemptCount + 1,
            provider: "DRY_RUN",
            status: isCommunicationDryRun() ? "PROVIDER_ACCEPTED" : "STARTED",
            completedAt: new Date(),
            errorCode: isCommunicationDryRun() ? "DRY_RUN_ONLY" : null,
          },
        });
        await tx.communicationDelivery.update({
          where: { id: delivery.id },
          data: { status: isCommunicationDryRun() ? "ACCEPTED" : "QUEUED", acceptedAt: isCommunicationDryRun() ? new Date() : null, attemptCount: { increment: 1 } },
        });
      }
    }
    await tx.communicationRecipient.updateMany({ where: { schoolId: ctx.schoolId, campaignId, status: { in: ["READY", "WARNING"] } }, data: { status: "QUEUED" } });
    await tx.communicationCampaign.update({ where: { id: campaignId }, data: { status: "QUEUED" } });
  });
  await audit(db, ctx, "communication.campaign_queued", campaignId, { dryRun: isCommunicationDryRun(), channels });
}

export async function sendCampaign(db: Db, ctx: CommunicationContext, campaignId: string, input: {
  channel: CommunicationChannel;
  confirm: boolean;
  audience?: AudienceDefinition;
}) {
  if (!communicationChannels.includes(input.channel)) throw httpError(400, "Unsupported communication channel.");
  if (input.channel !== "WHATSAPP" && input.channel !== "SMS") throw httpError(400, "Only SMS and WhatsApp sending are supported.");
  if (!input.confirm) throw httpError(400, "Sending requires explicit confirmation.");
  await requireLiveCommunicationsEnabled(db, ctx);
  const campaign = await getCampaignOrThrow(db, ctx, campaignId);
  if (["CANCELLED", "DELIVERED"].includes(campaign.status)) throw httpError(400, "This campaign cannot be sent.");
  if (!["APPROVED", "QUEUED", "SENDING"].includes(campaign.status)) {
    throw httpError(400, "Only approved campaigns can be sent.");
  }
  const templatePolicy = isCommunicationDryRun()
    ? {
        policyStatus: "DRY_RUN_ONLY" as TemplatePolicyStatus,
        liveTemplateRequired: true,
        note: "Dry-run staging is allowed; live sending will require an approved template binding.",
      }
    : await requireLiveTemplatePolicy(db, ctx, campaignId, input.channel);
  if (!campaign.audienceSnapshots[0]) {
    await createAudienceSnapshot(db, ctx, campaignId, input.audience ?? ((campaign.audience?.definitionJson ?? {}) as AudienceDefinition));
  }
  const refreshed = await getCampaignOrThrow(db, ctx, campaignId);
  const content = refreshed.contents.find((c) => c.version === refreshed.contentVersion) ?? refreshed.contents[0];
  if (!content?.body?.trim()) throw httpError(400, "Message body is required before sending.");

  const recipients = await db.communicationRecipient.findMany({
    where: { schoolId: ctx.schoolId, campaignId, status: { in: ["READY", "WARNING", "QUEUED"] }, phoneE164: { not: null } },
    orderBy: { createdAt: "asc" },
    take: Number(process.env.COMMUNICATION_BATCH_SIZE ?? 25),
  });
  if (recipients.length === 0) throw httpError(400, "No valid recipients are available for sending.");

  if (refreshed.status !== "SENDING") {
    await transitionCampaignIfAllowed(db, ctx, campaignId, "QUEUED");
  }

  if (input.channel === "SMS") {
    return sendSmsCampaign(db, ctx, refreshed, recipients, content, templatePolicy);
  }

  const provider = isCommunicationDryRun()
    ? new DryRunMessageProvider(input.channel)
    : createProviderForChannel(input.channel);
  const channelSetting = await db.communicationChannelSetting.findFirst({
    where: { schoolId: ctx.schoolId, channel: input.channel as never, provider: provider.providerKey },
  });
  const config = await provider.validateConfiguration({
    schoolId: ctx.schoolId,
    sendingEnabled: channelSetting?.sendingEnabled ?? true,
    providerMetadata: (channelSetting?.providerMetadataJson ?? null) as Record<string, unknown> | null,
  });
  if (!config.sendingEnabled) {
    throw Object.assign(new Error("WhatsApp is not configured yet. Contact platform owner."), {
      status: 503,
      expose: true,
      details: config.issues,
    });
  }

  let submitted = 0;
  let failed = 0;
  let skippedDuplicate = 0;
  const results = [];

  for (const recipient of recipients) {
    const values = (recipient.personalisationJson ?? {}) as Record<string, string>;
    const text = renderContent(content.shortBody || content.body, values);
    const rendered = await provider.render({ text });
    const idempotencyKey = buildDeliveryIdempotencyKey({
      schoolId: ctx.schoolId,
      campaignId,
      recipientId: recipient.id,
      channel: input.channel,
      contentVersion: refreshed.contentVersion,
    });
    const existing = await db.communicationDelivery.findUnique({ where: { idempotencyKey } });
    if (existing?.providerMessageId || (existing && ["SUBMITTED", "ACCEPTED", "DELIVERED", "READ"].includes(existing.status))) {
      skippedDuplicate += 1;
      results.push({ recipientId: recipient.id, status: "SKIPPED_DUPLICATE" });
      continue;
    }
    const delivery = await db.communicationDelivery.upsert({
      where: { idempotencyKey },
      update: {
        provider: provider.providerKey,
        status: "SUBMITTING",
        renderedContentHash: hashRenderedContent(text),
      },
      create: {
        schoolId: ctx.schoolId,
        campaignId,
        recipientId: recipient.id,
        channel: input.channel as never,
        provider: provider.providerKey,
        status: "SUBMITTING",
        contentVersion: refreshed.contentVersion,
        idempotencyKey,
        renderedContentHash: hashRenderedContent(text),
        queuedAt: new Date(),
      },
    });
    const attempt = await db.communicationDeliveryAttempt.create({
      data: {
        deliveryId: delivery.id,
        attemptNumber: delivery.attemptCount + 1,
        provider: provider.providerKey,
        status: "STARTED",
        requestId: idempotencyKey,
      },
    });
    const response = await provider.submit({
      toE164: recipient.phoneE164!,
      rendered,
      idempotencyKey,
    });
    const now = new Date();
    if (response.accepted) {
      submitted += 1;
      await db.communicationDelivery.update({
        where: { id: delivery.id },
        data: {
          status: "SUBMITTED",
          providerMessageId: response.providerMessageId,
          submittedAt: now,
          acceptedAt: now,
          attemptCount: { increment: 1 },
        },
      });
      await db.communicationDeliveryAttempt.update({
        where: { id: attempt.id },
        data: {
          status: "PROVIDER_ACCEPTED",
          providerMessageId: response.providerMessageId,
          providerResponseCode: response.providerStatus,
          completedAt: now,
        },
      });
      results.push({ recipientId: recipient.id, status: "SUBMITTED", providerMessageId: response.providerMessageId });
    } else {
      failed += 1;
      await db.communicationDelivery.update({
        where: { id: delivery.id },
        data: {
          status: "FAILED",
          failedAt: now,
          lastErrorCode: response.errorCode,
          lastErrorMessageSafe: response.safeErrorMessage,
          attemptCount: { increment: 1 },
        },
      });
      await db.communicationDeliveryAttempt.update({
        where: { id: attempt.id },
        data: {
          status: "PROVIDER_REJECTED",
          errorCode: response.errorCode,
          errorMessageSafe: response.safeErrorMessage,
          completedAt: now,
        },
      });
      results.push({ recipientId: recipient.id, status: "FAILED", errorCode: response.errorCode });
    }
  }
  await db.communicationCampaign.update({
    where: { id: campaignId },
    data: { status: failed > 0 && submitted > 0 ? "PARTIALLY_DELIVERED" : failed > 0 && submitted === 0 ? "FAILED" : "SENDING", sendingStartedAt: new Date() },
  });
  await audit(db, ctx, "communication.delivery_submitted", campaignId, { channel: input.channel, provider: provider.providerKey, submitted, failed, skippedDuplicate });
  return { submitted, failed, skippedDuplicate, results, templatePolicy, progress: await getCampaignProgressTotals(db, ctx, campaignId) };
}

async function sendSmsCampaign(
  db: Db,
  ctx: CommunicationContext,
  campaign: Awaited<ReturnType<typeof getCampaignOrThrow>>,
  recipients: Awaited<ReturnType<Db["communicationRecipient"]["findMany"]>>,
  content: NonNullable<Awaited<ReturnType<typeof getCampaignOrThrow>>["contents"][number]>,
  templatePolicy: Record<string, unknown>,
) {
  if (isCommunicationDryRun()) {
    return sendDryRunSmsCampaign(db, ctx, campaign, recipients, content, templatePolicy);
  }

  const provider = resolveSmsProvider();
  const channelSetting = await db.communicationChannelSetting.findFirst({
    where: { schoolId: ctx.schoolId, channel: "SMS", provider: provider.providerKey },
  });
  const providerContext = {
    schoolId: ctx.schoolId,
    sendingEnabled: channelSetting?.sendingEnabled ?? true,
    providerMetadata: (channelSetting?.providerMetadataJson ?? null) as Record<string, unknown> | null,
  };
  const config = await provider.checkHealth(providerContext);
  if (!config.sendingEnabled) {
    throw Object.assign(new Error("SMS provider is not configured yet. Contact platform owner."), {
      status: 503,
      expose: true,
      code: "PROVIDER_NOT_CONFIGURED",
      details: config.issues,
    });
  }

  let submitted = 0;
  let failed = 0;
  let skippedDuplicate = 0;
  const results: Array<Record<string, unknown>> = [];
  const pendingMessages: Array<{
    recipientId: string;
    deliveryId: string;
    attemptId: string;
    idempotencyKey: string;
    text: string;
    segmentCount: number;
  }> = [];

  for (const recipient of recipients) {
    const values = (recipient.personalisationJson ?? {}) as Record<string, string>;
    const text = renderContent(content.shortBody || content.body, values);
    const segmentEstimate = estimateSmsSegments(text);
    const idempotencyKey = buildDeliveryIdempotencyKey({
      schoolId: ctx.schoolId,
      campaignId: campaign.id,
      recipientId: recipient.id,
      channel: "SMS",
      contentVersion: campaign.contentVersion,
    });
    const existing = await db.communicationDelivery.findUnique({ where: { idempotencyKey } });
    if (existing?.providerMessageId || (existing && ["SUBMITTED", "ACCEPTED", "DELIVERED", "READ"].includes(existing.status))) {
      skippedDuplicate += 1;
      results.push({ recipientId: recipient.id, status: "SKIPPED_DUPLICATE" });
      continue;
    }

    const delivery = await db.communicationDelivery.upsert({
      where: { idempotencyKey },
      update: {
        provider: provider.providerKey,
        status: "SUBMITTING",
        renderedContentHash: hashRenderedContent(text),
        queuedAt: existing?.queuedAt ?? new Date(),
      },
      create: {
        schoolId: ctx.schoolId,
        campaignId: campaign.id,
        recipientId: recipient.id,
        channel: "SMS" as never,
        provider: provider.providerKey,
        status: "SUBMITTING",
        contentVersion: campaign.contentVersion,
        idempotencyKey,
        renderedContentHash: hashRenderedContent(text),
        queuedAt: new Date(),
      },
    });
    const attempt = await db.communicationDeliveryAttempt.create({
      data: {
        deliveryId: delivery.id,
        attemptNumber: delivery.attemptCount + 1,
        provider: provider.providerKey,
        status: "STARTED",
        requestId: idempotencyKey,
      },
    });
    pendingMessages.push({
      recipientId: recipient.id,
      deliveryId: delivery.id,
      attemptId: attempt.id,
      idempotencyKey,
      text,
      segmentCount: segmentEstimate.segments,
    });
  }

  const recipientMap = new Map(recipients.map((recipient) => [recipient.id, recipient]));
  const batchResult = await provider.sendBatch(
    pendingMessages.map((message) => ({
      recipientId: message.recipientId,
      toE164: recipientMap.get(message.recipientId)?.phoneE164 ?? "",
      text: message.text,
      idempotencyKey: message.idempotencyKey,
      segmentCount: message.segmentCount,
    })),
    providerContext,
  );
  const acceptedMap = new Map(batchResult.acceptedRecipients.map((item) => [item.recipientId, item]));
  const rejectedMap = new Map(batchResult.rejectedRecipients.map((item) => [item.recipientId, item]));

  for (const pending of pendingMessages) {
    const now = new Date();
    const accepted = acceptedMap.get(pending.recipientId);
    const rejected = rejectedMap.get(pending.recipientId);
    if (accepted) {
      submitted += 1;
      await db.communicationDelivery.update({
        where: { id: pending.deliveryId },
        data: {
          status: "SUBMITTED",
          providerMessageId: accepted.providerMessageId,
          submittedAt: now,
          acceptedAt: accepted.lifecycleState === "SENT" ? now : null,
          attemptCount: { increment: 1 },
          lastErrorCode: null,
          lastErrorMessageSafe: null,
        },
      });
      await db.communicationDeliveryAttempt.update({
        where: { id: pending.attemptId },
        data: {
          status: "PROVIDER_ACCEPTED",
          providerMessageId: accepted.providerMessageId,
          providerResponseCode: accepted.providerStatus,
          completedAt: now,
        },
      });
      await db.communicationUsageRecord.create({
        data: {
          schoolId: ctx.schoolId,
          campaignId: campaign.id,
          deliveryId: pending.deliveryId,
          channel: "SMS" as never,
          provider: provider.providerKey,
          billableUnits: accepted.billableUnits,
          status: "ESTIMATED",
        },
      });
      results.push({ recipientId: pending.recipientId, status: "SUBMITTED", providerMessageId: accepted.providerMessageId });
      continue;
    }

    failed += 1;
    const failure = rejected ?? {
      lifecycleState: "FAILED" as const,
      providerStatus: "FAILED",
      errorCode: "PROVIDER_NOT_CONFIGURED",
      safeErrorMessage: "SMS provider rejected the message.",
    };
    await db.communicationDelivery.update({
      where: { id: pending.deliveryId },
      data: {
        status: "FAILED",
        failedAt: now,
        lastErrorCode: failure.errorCode,
        lastErrorMessageSafe: failure.safeErrorMessage,
        attemptCount: { increment: 1 },
      },
    });
    await db.communicationDeliveryAttempt.update({
      where: { id: pending.attemptId },
      data: {
        status: "PROVIDER_REJECTED",
        providerResponseCode: failure.providerStatus,
        errorCode: failure.errorCode,
        errorMessageSafe: failure.safeErrorMessage,
        completedAt: now,
      },
    });
    results.push({ recipientId: pending.recipientId, status: "FAILED", errorCode: failure.errorCode });
  }

  await db.communicationCampaign.update({
    where: { id: campaign.id },
    data: { status: failed > 0 && submitted > 0 ? "PARTIALLY_DELIVERED" : failed > 0 && submitted === 0 ? "FAILED" : "SENDING", sendingStartedAt: new Date() },
  });
  await audit(db, ctx, "communication.delivery_submitted", campaign.id, { channel: "SMS", provider: provider.providerKey, submitted, failed, skippedDuplicate });
  return { submitted, failed, skippedDuplicate, results, templatePolicy, progress: await getCampaignProgressTotals(db, ctx, campaign.id) };
}

async function sendDryRunSmsCampaign(
  db: Db,
  ctx: CommunicationContext,
  campaign: Awaited<ReturnType<typeof getCampaignOrThrow>>,
  recipients: Awaited<ReturnType<Db["communicationRecipient"]["findMany"]>>,
  content: NonNullable<Awaited<ReturnType<typeof getCampaignOrThrow>>["contents"][number]>,
  templatePolicy: Record<string, unknown>,
) {
  const provider = new DryRunMessageProvider("SMS");
  let submitted = 0;
  let skippedDuplicate = 0;
  const results: Array<Record<string, unknown>> = [];

  for (const recipient of recipients) {
    const values = (recipient.personalisationJson ?? {}) as Record<string, string>;
    const text = renderContent(content.shortBody || content.body, values);
    const idempotencyKey = buildDeliveryIdempotencyKey({
      schoolId: ctx.schoolId,
      campaignId: campaign.id,
      recipientId: recipient.id,
      channel: "SMS",
      contentVersion: campaign.contentVersion,
    });
    const existing = await db.communicationDelivery.findUnique({ where: { idempotencyKey } });
    if (existing?.providerMessageId || (existing && ["SUBMITTED", "ACCEPTED", "DELIVERED", "READ"].includes(existing.status))) {
      skippedDuplicate += 1;
      results.push({ recipientId: recipient.id, status: "SKIPPED_DUPLICATE" });
      continue;
    }

    const delivery = await db.communicationDelivery.upsert({
      where: { idempotencyKey },
      update: {
        provider: provider.providerKey,
        status: "SUBMITTED",
        renderedContentHash: hashRenderedContent(text),
      },
      create: {
        schoolId: ctx.schoolId,
        campaignId: campaign.id,
        recipientId: recipient.id,
        channel: "SMS" as never,
        provider: provider.providerKey,
        status: "SUBMITTED",
        contentVersion: campaign.contentVersion,
        idempotencyKey,
        renderedContentHash: hashRenderedContent(text),
        queuedAt: new Date(),
      },
    });
    const attempt = await db.communicationDeliveryAttempt.create({
      data: {
        deliveryId: delivery.id,
        attemptNumber: delivery.attemptCount + 1,
        provider: provider.providerKey,
        status: "STARTED",
        requestId: idempotencyKey,
      },
    });
    const response = await provider.submit({
      toE164: recipient.phoneE164!,
      rendered: await provider.render({ text }),
      idempotencyKey,
    });
    const now = new Date();
    submitted += 1;
    await db.communicationDelivery.update({
      where: { id: delivery.id },
      data: {
        status: "SUBMITTED",
        providerMessageId: response.providerMessageId,
        submittedAt: now,
        acceptedAt: now,
        attemptCount: { increment: 1 },
      },
    });
    await db.communicationDeliveryAttempt.update({
      where: { id: attempt.id },
      data: {
        status: "PROVIDER_ACCEPTED",
        providerMessageId: response.providerMessageId,
        providerResponseCode: response.providerStatus,
        completedAt: now,
      },
    });
    results.push({ recipientId: recipient.id, status: "SUBMITTED", providerMessageId: response.providerMessageId });
  }

  await db.communicationCampaign.update({
    where: { id: campaign.id },
    data: { status: "SENDING", sendingStartedAt: new Date() },
  });
  await audit(db, ctx, "communication.delivery_submitted", campaign.id, { channel: "SMS", provider: provider.providerKey, submitted, failed: 0, skippedDuplicate });
  return { submitted, failed: 0, skippedDuplicate, results, templatePolicy, progress: await getCampaignProgressTotals(db, ctx, campaign.id) };
}

export async function getCampaignProgressTotals(db: Db, ctx: CommunicationContext, campaignId: string) {
  await getCampaignOrThrow(db, ctx, campaignId);
  const deliveries = await db.communicationDelivery.groupBy({
    by: ["status"],
    where: { schoolId: ctx.schoolId, campaignId },
    _count: { status: true },
  });
  const totals: Record<CommunicationProgressState, number> = {
    QUEUED: 0,
    PROCESSING: 0,
    SENT: 0,
    DELIVERED: 0,
    FAILED: 0,
  };
  for (const delivery of deliveries) {
    totals[normalizeDeliveryProgressState(delivery.status as never)] += delivery._count.status;
  }
  return totals;
}

export async function transitionCampaign(db: Db, ctx: CommunicationContext, campaignId: string, to: CommunicationCampaignStatus, extra: Record<string, unknown> = {}) {
  const campaign = await getCampaignOrThrow(db, ctx, campaignId);
  if (campaign.status !== to) assertCampaignTransition(campaign.status as CommunicationCampaignStatus, to);
  return db.communicationCampaign.update({ where: { id: campaignId }, data: { status: to as never, ...extra } });
}

export function renderContent(template: string, values: Record<string, unknown>) {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_match, key) => String(values[key] ?? ""));
}

async function audit(db: Db, ctx: CommunicationContext, action: string, correlationId: string, details: Record<string, unknown>) {
  await db.auditLog.create({
    data: {
      schoolId: ctx.schoolId,
      action,
      correlationId,
      details: { ...details, actorId: ctx.actorId ?? "system", actorName: ctx.actorName ?? null },
    },
  });
}

function httpError(status: number, message: string) {
  const error = new Error(message);
  Object.assign(error, { status, expose: true });
  return error;
}

async function transitionCampaignIfAllowed(db: Db, ctx: CommunicationContext, campaignId: string, to: CommunicationCampaignStatus) {
  const campaign = await getCampaignOrThrow(db, ctx, campaignId);
  if (campaign.status === to) return campaign;
  return transitionCampaign(db, ctx, campaignId, to);
}
