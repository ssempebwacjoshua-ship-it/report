import type { PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "../db/prisma";
import {
  buildDeliveryIdempotencyKey,
  estimateSmsSegments,
  hashRenderedContent,
  normalizePhoneToE164,
} from "../../shared/communications";
import { DryRunMessageProvider, resolveSmsProvider } from "./communicationProviders";
import { isCommunicationDryRun } from "./communicationEngine";

type Db = Pick<
  PrismaClient,
  | "school"
  | "student"
  | "communicationConsent"
  | "communicationCampaign"
  | "communicationAudience"
  | "communicationAudienceSnapshot"
  | "communicationContent"
  | "communicationRecipient"
  | "communicationDelivery"
  | "communicationDeliveryAttempt"
  | "communicationChannelSetting"
  | "communicationUsageRecord"
  | "auditLog"
> & {
  $transaction?: <T>(fn: (tx: Db) => Promise<T>) => Promise<T>;
};

type NotificationContext = {
  schoolId: string;
  actorId?: string | null;
};

type NotificationInput = {
  studentId: string;
  passOutId: string;
  movementEventId: string;
  event: "CHECK_OUT" | "CHECK_IN";
  scannedAt: Date;
  activeUntil: Date;
  reason: string;
};

type EligibleRecipient = {
  guardianId: string;
  displayName: string;
  relationship: string;
  phoneE164: string;
  personalisationJson: Record<string, string>;
};

function runWrite<T>(db: Db, fn: (tx: Db) => Promise<T>) {
  return db.$transaction ? db.$transaction(fn) : fn(db);
}

function requireSchoolId(ctx: { schoolId?: string | null }) {
  if (!ctx.schoolId) throw Object.assign(new Error("School context required."), { status: 401 });
  return ctx.schoolId;
}

function formatTimestamp(date: Date) {
  return date.toISOString().replace("T", " ").slice(0, 16) + " UTC";
}

function buildMessage(input: {
  event: "CHECK_OUT" | "CHECK_IN";
  studentName: string;
  schoolName: string;
  scannedAt: Date;
  activeUntil: Date;
  reason: string;
}) {
  const eventTime = formatTimestamp(input.scannedAt);
  const deadline = formatTimestamp(input.activeUntil);
  if (input.event === "CHECK_OUT") {
    return {
      title: `Student checked out: ${input.studentName}`,
      body: "{{studentName}} checked out of {{schoolName}} at {{eventTime}}. Reason: {{passOutReason}}. Expected back by {{returnDeadline}}.",
      values: {
        studentName: input.studentName,
        schoolName: input.schoolName,
        eventTime,
        passOutReason: input.reason,
        returnDeadline: deadline,
      },
    };
  }
  return {
    title: `Student returned: ${input.studentName}`,
    body: "{{studentName}} returned to {{schoolName}} at {{eventTime}} after pass-out: {{passOutReason}}.",
    values: {
      studentName: input.studentName,
      schoolName: input.schoolName,
      eventTime,
      passOutReason: input.reason,
      returnDeadline: deadline,
    },
  };
}

function renderMessage(template: string, values: Record<string, string>) {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_match, key) => values[key] ?? "");
}

async function loadEligibleRecipients(db: Db, schoolId: string, studentId: string, values: Record<string, string>) {
  const student = await db.student.findFirst({
    where: { id: studentId, schoolId },
    include: {
      guardianContacts: {
        orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
      },
    },
  });
  if (!student) {
    throw Object.assign(new Error("Student not found."), { status: 404 });
  }

  const guardianIds = student.guardianContacts.map((contact) => contact.id);
  const consents = guardianIds.length > 0
    ? await db.communicationConsent.findMany({
        where: {
          schoolId,
          guardianId: { in: guardianIds },
          channel: "SMS",
        },
      })
    : [];
  const consentMap = new Map(consents.map((consent) => [consent.guardianId, consent.status]));
  const seenPhones = new Set<string>();
  const recipients: EligibleRecipient[] = [];

  for (const contact of student.guardianContacts) {
    const normalized = normalizePhoneToE164(contact.phone, "256");
    if (!contact.canReceiveReports || !normalized) continue;
    if (consentMap.get(contact.id) === "OPTED_OUT") continue;
    if (seenPhones.has(normalized)) continue;
    seenPhones.add(normalized);
    recipients.push({
      guardianId: contact.id,
      displayName: contact.guardianName,
      relationship: contact.relationship,
      phoneE164: normalized,
      personalisationJson: {
        ...values,
        guardianName: contact.guardianName,
      },
    });
  }

  return {
    studentName: `${student.firstName} ${student.lastName}`.trim(),
    recipients,
  };
}

export async function notifyParentStudentPassOut(
  ctx: NotificationContext,
  input: NotificationInput,
  db: Db = defaultPrisma,
) {
  const schoolId = requireSchoolId(ctx);
  const school = await db.school.findUnique({
    where: { id: schoolId },
    select: { id: true, name: true },
  });
  if (!school) {
    throw Object.assign(new Error("School not found."), { status: 404 });
  }

  const student = await db.student.findFirst({
    where: { id: input.studentId, schoolId },
    select: { id: true, firstName: true, lastName: true },
  });
  if (!student) {
    throw Object.assign(new Error("Student not found."), { status: 404 });
  }
  const studentName = `${student.firstName} ${student.lastName}`.trim();
  const message = buildMessage({
    event: input.event,
    studentName,
    schoolName: school.name,
    scannedAt: input.scannedAt,
    activeUntil: input.activeUntil,
    reason: input.reason,
  });
  const { recipients } = await loadEligibleRecipients(db, schoolId, input.studentId, message.values);

  if (recipients.length === 0) {
    await db.auditLog.create({
      data: {
        schoolId,
        action: "student_pass_out.notification_skipped",
        details: {
          actor: { id: ctx.actorId ?? null },
          passOutId: input.passOutId,
          studentId: input.studentId,
          movementEventId: input.movementEventId,
          reason: "NO_ELIGIBLE_SMS_RECIPIENTS",
        },
      },
    });
    return { submitted: 0, failed: 0, skipped: recipients.length, reason: "NO_ELIGIBLE_SMS_RECIPIENTS" as const };
  }

  const campaign = await runWrite(db, async (tx) => {
    const createdCampaign = await tx.communicationCampaign.create({
      data: {
        schoolId,
        type: "ATTENDANCE_ALERT",
        title: message.title,
        status: "APPROVED",
        contentVersion: 1,
        createdByUserId: ctx.actorId ?? null,
        approvedByUserId: ctx.actorId ?? null,
        approvedAt: input.scannedAt,
        metadataJson: {
          source: "NFC_PASS_OUT",
          passOutId: input.passOutId,
          movementEventId: input.movementEventId,
          notificationEvent: input.event,
          studentId: input.studentId,
        },
      },
    });
    await tx.communicationAudience.create({
      data: {
        campaignId: createdCampaign.id,
        definitionJson: {
          audienceType: "PARENTS_OF_SELECTED_STUDENTS",
          studentIds: [input.studentId],
          channel: "SMS",
          mode: "GENERAL",
        },
        estimatedRecipients: recipients.length,
      },
    });
    const snapshot = await tx.communicationAudienceSnapshot.create({
      data: {
        campaignId: createdCampaign.id,
        snapshotVersion: 1,
        recipientCount: recipients.length,
        createdByUserId: ctx.actorId ?? null,
      },
    });
    await tx.communicationContent.create({
      data: {
        campaignId: createdCampaign.id,
        version: 1,
        body: message.body,
        shortBody: message.body,
        createdByUserId: ctx.actorId ?? null,
      },
    });
    await tx.communicationRecipient.createMany({
      data: recipients.map((recipient) => ({
        schoolId,
        campaignId: createdCampaign.id,
        audienceSnapshotId: snapshot.id,
        guardianId: recipient.guardianId,
        studentId: input.studentId,
        displayName: recipient.displayName,
        relationship: recipient.relationship,
        phoneE164: recipient.phoneE164,
        preferredChannel: "SMS",
        status: "READY",
        personalisationJson: recipient.personalisationJson,
      })) as never[],
    });
    await tx.auditLog.create({
      data: {
        schoolId,
        action: "communication.campaign_created",
        correlationId: createdCampaign.id,
        details: {
          actor: { id: ctx.actorId ?? null },
          type: "ATTENDANCE_ALERT",
          source: "NFC_PASS_OUT",
          passOutId: input.passOutId,
          movementEventId: input.movementEventId,
        },
      },
    });
    return createdCampaign;
  });

  const storedRecipients = await db.communicationRecipient.findMany({
    where: { schoolId, campaignId: campaign.id },
    orderBy: { createdAt: "asc" },
  });

  if (isCommunicationDryRun()) {
    const provider = new DryRunMessageProvider("SMS");
    let submitted = 0;
    for (const recipient of storedRecipients) {
      const renderedText = renderMessage(message.body, (recipient.personalisationJson ?? {}) as Record<string, string>);
      const idempotencyKey = buildDeliveryIdempotencyKey({
        schoolId,
        campaignId: campaign.id,
        recipientId: recipient.id,
        channel: "SMS",
        contentVersion: 1,
      });
      const delivery = await db.communicationDelivery.upsert({
        where: { idempotencyKey },
        update: {
          provider: provider.providerKey,
          status: "SUBMITTED",
          renderedContentHash: hashRenderedContent(renderedText),
        },
        create: {
          schoolId,
          campaignId: campaign.id,
          recipientId: recipient.id,
          channel: "SMS",
          provider: provider.providerKey,
          status: "SUBMITTED",
          contentVersion: 1,
          idempotencyKey,
          renderedContentHash: hashRenderedContent(renderedText),
          queuedAt: input.scannedAt,
        },
      });
      const response = await provider.submit({
        toE164: recipient.phoneE164!,
        rendered: await provider.render({ text: renderedText }),
        idempotencyKey,
      });
      const attempt = await db.communicationDeliveryAttempt.create({
        data: {
          deliveryId: delivery.id,
          attemptNumber: delivery.attemptCount + 1,
          provider: provider.providerKey,
          status: "PROVIDER_ACCEPTED",
          requestId: idempotencyKey,
          providerMessageId: response.providerMessageId,
          providerResponseCode: response.providerStatus,
          completedAt: input.scannedAt,
        },
      });
      await db.communicationDelivery.update({
        where: { id: delivery.id },
        data: {
          status: "SUBMITTED",
          providerMessageId: response.providerMessageId,
          submittedAt: input.scannedAt,
          acceptedAt: input.scannedAt,
          attemptCount: attempt.attemptNumber,
        },
      });
      submitted += 1;
    }
    await db.communicationCampaign.update({
      where: { id: campaign.id },
      data: { status: "SENDING", sendingStartedAt: input.scannedAt },
    });
    await db.auditLog.create({
      data: {
        schoolId,
        action: "communication.delivery_submitted",
        correlationId: campaign.id,
        details: {
          actor: { id: ctx.actorId ?? null },
          channel: "SMS",
          provider: provider.providerKey,
          submitted,
          failed: 0,
        },
      },
    });
    return { submitted, failed: 0, skipped: 0, campaignId: campaign.id };
  }

  const provider = resolveSmsProvider();
  const channelSetting = await db.communicationChannelSetting.findFirst({
    where: { schoolId, channel: "SMS", provider: provider.providerKey },
  });
  const providerContext = {
    schoolId,
    sendingEnabled: channelSetting?.sendingEnabled ?? true,
    providerMetadata: (channelSetting?.providerMetadataJson ?? null) as Record<string, unknown> | null,
  };
  const health = await provider.checkHealth(providerContext);

  const pending = storedRecipients.map((recipient) => {
    const text = renderMessage(message.body, (recipient.personalisationJson ?? {}) as Record<string, string>);
    const segments = estimateSmsSegments(text);
    return {
      recipient,
      text,
      segmentCount: segments.segments,
      idempotencyKey: buildDeliveryIdempotencyKey({
        schoolId,
        campaignId: campaign.id,
        recipientId: recipient.id,
        channel: "SMS",
        contentVersion: 1,
      }),
    };
  });

  if (!health.sendingEnabled) {
    for (const item of pending) {
      const delivery = await db.communicationDelivery.upsert({
        where: { idempotencyKey: item.idempotencyKey },
        update: {
          provider: provider.providerKey,
          status: "FAILED",
          failedAt: input.scannedAt,
          lastErrorCode: health.issues[0] ?? "PROVIDER_NOT_CONFIGURED",
          lastErrorMessageSafe: "SMS provider is not configured yet. Contact platform owner.",
          renderedContentHash: hashRenderedContent(item.text),
        },
        create: {
          schoolId,
          campaignId: campaign.id,
          recipientId: item.recipient.id,
          channel: "SMS",
          provider: provider.providerKey,
          status: "FAILED",
          contentVersion: 1,
          idempotencyKey: item.idempotencyKey,
          queuedAt: input.scannedAt,
          failedAt: input.scannedAt,
          renderedContentHash: hashRenderedContent(item.text),
          lastErrorCode: health.issues[0] ?? "PROVIDER_NOT_CONFIGURED",
          lastErrorMessageSafe: "SMS provider is not configured yet. Contact platform owner.",
        },
      });
      await db.communicationDeliveryAttempt.create({
        data: {
          deliveryId: delivery.id,
          attemptNumber: delivery.attemptCount + 1,
          provider: provider.providerKey,
          status: "PROVIDER_REJECTED",
          requestId: item.idempotencyKey,
          errorCode: health.issues[0] ?? "PROVIDER_NOT_CONFIGURED",
          errorMessageSafe: "SMS provider is not configured yet. Contact platform owner.",
          completedAt: input.scannedAt,
        },
      });
    }
    await db.communicationCampaign.update({
      where: { id: campaign.id },
      data: { status: "FAILED", sendingStartedAt: input.scannedAt },
    });
    await db.auditLog.create({
      data: {
        schoolId,
        action: "communication.delivery_submitted",
        correlationId: campaign.id,
        details: {
          actor: { id: ctx.actorId ?? null },
          channel: "SMS",
          provider: provider.providerKey,
          submitted: 0,
          failed: pending.length,
          providerIssues: health.issues,
        },
      },
    });
    return { submitted: 0, failed: pending.length, skipped: 0, campaignId: campaign.id };
  }

  const batchResult = await provider.sendBatch(
    pending.map((item) => ({
      recipientId: item.recipient.id,
      toE164: item.recipient.phoneE164!,
      text: item.text,
      idempotencyKey: item.idempotencyKey,
      segmentCount: item.segmentCount,
    })),
    providerContext,
  );
  const acceptedMap = new Map(batchResult.acceptedRecipients.map((item) => [item.recipientId, item]));
  const rejectedMap = new Map(batchResult.rejectedRecipients.map((item) => [item.recipientId, item]));
  let submitted = 0;
  let failed = 0;

  for (const item of pending) {
    const delivery = await db.communicationDelivery.upsert({
      where: { idempotencyKey: item.idempotencyKey },
      update: {
        provider: provider.providerKey,
        renderedContentHash: hashRenderedContent(item.text),
      },
      create: {
        schoolId,
        campaignId: campaign.id,
        recipientId: item.recipient.id,
        channel: "SMS",
        provider: provider.providerKey,
        status: "SUBMITTING",
        contentVersion: 1,
        idempotencyKey: item.idempotencyKey,
        queuedAt: input.scannedAt,
        renderedContentHash: hashRenderedContent(item.text),
      },
    });
    const accepted = acceptedMap.get(item.recipient.id);
    const rejected = rejectedMap.get(item.recipient.id);
    if (accepted) {
      submitted += 1;
      await db.communicationDelivery.update({
        where: { id: delivery.id },
        data: {
          status: "SUBMITTED",
          providerMessageId: accepted.providerMessageId,
          submittedAt: input.scannedAt,
          acceptedAt: accepted.lifecycleState === "SENT" ? input.scannedAt : null,
          attemptCount: delivery.attemptCount + 1,
          lastErrorCode: null,
          lastErrorMessageSafe: null,
        },
      });
      await db.communicationDeliveryAttempt.create({
        data: {
          deliveryId: delivery.id,
          attemptNumber: delivery.attemptCount + 1,
          provider: provider.providerKey,
          status: "PROVIDER_ACCEPTED",
          requestId: item.idempotencyKey,
          providerMessageId: accepted.providerMessageId,
          providerResponseCode: accepted.providerStatusCode ?? accepted.providerStatus,
          completedAt: input.scannedAt,
        },
      });
      await db.communicationUsageRecord.create({
        data: {
          schoolId,
          campaignId: campaign.id,
          deliveryId: delivery.id,
          channel: "SMS",
          provider: provider.providerKey,
          billableUnits: accepted.billableUnits,
          unitType: "SEGMENT",
          providerCostMinor: accepted.amountChargedMinor,
          status: "ESTIMATED",
        },
      });
      continue;
    }
    failed += 1;
    await db.communicationDelivery.update({
      where: { id: delivery.id },
      data: {
        status: "FAILED",
        failedAt: input.scannedAt,
        attemptCount: delivery.attemptCount + 1,
        lastErrorCode: rejected?.errorCode ?? "SMS_SUBMISSION_FAILED",
        lastErrorMessageSafe: rejected?.safeErrorMessage ?? "SMS provider rejected the message.",
      },
    });
    await db.communicationDeliveryAttempt.create({
      data: {
        deliveryId: delivery.id,
        attemptNumber: delivery.attemptCount + 1,
        provider: provider.providerKey,
        status: "PROVIDER_REJECTED",
        requestId: item.idempotencyKey,
        providerResponseCode: rejected?.providerStatus ?? "FAILED",
        errorCode: rejected?.errorCode ?? "SMS_SUBMISSION_FAILED",
        errorMessageSafe: rejected?.safeErrorMessage ?? "SMS provider rejected the message.",
        completedAt: input.scannedAt,
      },
    });
  }

  await db.communicationCampaign.update({
    where: { id: campaign.id },
    data: {
      status: submitted > 0 ? "SENDING" : "FAILED",
      sendingStartedAt: input.scannedAt,
    },
  });
  await db.auditLog.create({
    data: {
      schoolId,
      action: "communication.delivery_submitted",
      correlationId: campaign.id,
      details: {
        actor: { id: ctx.actorId ?? null },
        channel: "SMS",
        provider: provider.providerKey,
        submitted,
        failed,
      },
    },
  });
  return { submitted, failed, skipped: 0, campaignId: campaign.id };
}
