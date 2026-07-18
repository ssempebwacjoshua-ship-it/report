import type { PrismaClient } from "@prisma/client";
import { hashPayload, type CommunicationDeliveryStatus } from "../../shared/communications";
import { resolveSmsProvider } from "./communicationProviders";
import { updateCampaignDeliveryStatus } from "./communicationEngine";

type Db = PrismaClient;

export function verifySmsWebhookSignature(rawBody: Buffer | undefined, signatureHeader: string | undefined, env: NodeJS.ProcessEnv = process.env) {
  return resolveSmsProvider(env).verifyWebhookSignature(rawBody, signatureHeader);
}

export async function persistAndProcessSmsWebhook(
  db: Db,
  rawBody: Buffer,
  payload: unknown,
  headers: Record<string, string | undefined>,
  env: NodeJS.ProcessEnv = process.env,
) {
  const provider = resolveSmsProvider(env);
  const parsed = await provider.parseDeliveryWebhook({ rawBody, payload, headers });
  const results = [];

  for (const event of parsed.events) {
    const existing = await db.communicationWebhookEvent.findUnique({
      where: { provider_externalEventId: { provider: event.provider, externalEventId: event.externalEventId } },
    });
    if (existing) {
      results.push({ eventId: existing.id, duplicate: true });
      continue;
    }

    const webhook = await db.communicationWebhookEvent.create({
      data: {
        provider: event.provider,
        externalEventId: event.externalEventId,
        eventType: "MESSAGE_STATUS",
        payloadHash: hashPayload(rawBody),
        processingStatus: "RECEIVED",
      },
    });

    await applySmsWebhookEvent(db, webhook.id, event);
    results.push({ eventId: webhook.id, duplicate: false });
  }

  return results;
}

async function applySmsWebhookEvent(
  db: Db,
  webhookId: string,
  event: {
    provider: string;
    providerMessageId?: string;
    lifecycleState: "QUEUED" | "PROCESSING" | "SENT" | "DELIVERED" | "FAILED";
    providerStatus: string;
    occurredAt?: Date;
    errorCode?: string;
    safeErrorMessage?: string;
  },
) {
  if (!event.providerMessageId) {
    await db.communicationWebhookEvent.update({
      where: { id: webhookId },
      data: { processingStatus: "PROCESSED", processedAt: new Date() },
    });
    return;
  }

  const delivery = await db.communicationDelivery.findFirst({
    where: { provider: event.provider, providerMessageId: event.providerMessageId },
    include: { campaign: { select: { schoolId: true } } },
  });
  if (!delivery) {
    await db.communicationWebhookEvent.update({
      where: { id: webhookId },
      data: { processingStatus: "PROCESSED", processedAt: new Date() },
    });
    return;
  }

  const timestamp = event.occurredAt ?? new Date();
  const deliveryStatus = mapSmsLifecycleToDeliveryStatus(event.lifecycleState);
  await db.$transaction(async (tx) => {
    await tx.communicationDelivery.update({
      where: { id: delivery.id },
      data: {
        status: deliveryStatus,
        acceptedAt: deliveryStatus === "ACCEPTED" ? timestamp : delivery.acceptedAt,
        deliveredAt: deliveryStatus === "DELIVERED" ? timestamp : delivery.deliveredAt,
        failedAt: deliveryStatus === "FAILED" ? timestamp : delivery.failedAt,
        lastErrorCode: event.errorCode ?? null,
        lastErrorMessageSafe: event.safeErrorMessage ?? null,
      },
    });
    await tx.auditLog.create({
      data: {
        schoolId: delivery.campaign.schoolId,
        action: deliveryStatus === "DELIVERED"
          ? "communication.provider_delivered"
          : deliveryStatus === "FAILED"
            ? "communication.delivery_failed"
            : "communication.provider_accepted",
        correlationId: delivery.campaignId,
        details: {
          deliveryId: delivery.id,
          channel: delivery.channel,
          provider: event.provider,
          webhookId,
          providerMessageId: event.providerMessageId,
          providerStatus: event.providerStatus,
          errorCode: event.errorCode ?? null,
        },
      },
    });
    await tx.communicationWebhookEvent.update({
      where: { id: webhookId },
      data: { processingStatus: "PROCESSED", processedAt: new Date() },
    });
  });
  await updateCampaignDeliveryStatus(db, delivery.schoolId, delivery.campaignId);
}

function mapSmsLifecycleToDeliveryStatus(state: "QUEUED" | "PROCESSING" | "SENT" | "DELIVERED" | "FAILED"): CommunicationDeliveryStatus {
  switch (state) {
    case "QUEUED":
      return "QUEUED";
    case "PROCESSING":
      return "SUBMITTING";
    case "SENT":
      return "ACCEPTED";
    case "DELIVERED":
      return "DELIVERED";
    case "FAILED":
    default:
      return "FAILED";
  }
}
