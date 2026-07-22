import crypto from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import { hashPayload } from "../utils/communicationHashes";
import { MetaCloudWhatsAppProvider, type NormalizedWebhookEvent } from "./communicationProviders";

type Db = PrismaClient;

export function verifyMetaWebhookChallenge(query: Record<string, unknown>, env: NodeJS.ProcessEnv = process.env) {
  const mode = query["hub.mode"];
  const token = query["hub.verify_token"];
  const challenge = query["hub.challenge"];
  const expected = env.WHATSAPP_META_VERIFY_TOKEN || env.META_WHATSAPP_WEBHOOK_VERIFY_TOKEN;
  if (mode !== "subscribe" || typeof token !== "string" || typeof challenge !== "string" || !expected || token !== expected) {
    return null;
  }
  return challenge;
}

export function verifyMetaSignature(rawBody: Buffer | undefined, signatureHeader: string | undefined, env: NodeJS.ProcessEnv = process.env) {
  const secret = env.WHATSAPP_META_APP_SECRET || env.META_WHATSAPP_APP_SECRET;
  if (!rawBody || !signatureHeader || !secret) return false;
  const expected = `sha256=${crypto.createHmac("sha256", secret).update(rawBody).digest("hex")}`;
  const actual = signatureHeader.trim();
  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(actual);
  return expectedBuffer.length === actualBuffer.length && crypto.timingSafeEqual(expectedBuffer, actualBuffer);
}

export async function persistAndProcessWhatsAppWebhook(db: Db, rawBody: Buffer, payload: unknown) {
  const provider = new MetaCloudWhatsAppProvider();
  const normalized = await provider.normalizeWebhook({ payload });
  const results = [];
  for (const event of normalized) {
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
        eventType: event.eventType,
        payloadHash: hashPayload(rawBody),
        processingStatus: "RECEIVED",
      },
    });
    await applyNormalizedWebhookEvent(db, event, webhook.id);
    results.push({ eventId: webhook.id, duplicate: false });
  }
  return results;
}

async function applyNormalizedWebhookEvent(db: Db, event: NormalizedWebhookEvent, webhookId: string) {
  if (!event.providerMessageId || !event.deliveryStatus) {
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
  await db.$transaction(async (tx) => {
    await tx.communicationDelivery.update({
      where: { id: delivery.id },
      data: {
        status: event.deliveryStatus,
        acceptedAt: event.deliveryStatus === "ACCEPTED" ? timestamp : delivery.acceptedAt,
        deliveredAt: event.deliveryStatus === "DELIVERED" ? timestamp : delivery.deliveredAt,
        readAt: event.deliveryStatus === "READ" ? timestamp : delivery.readAt,
        failedAt: event.deliveryStatus === "FAILED" ? timestamp : delivery.failedAt,
        lastErrorCode: event.errorCode,
        lastErrorMessageSafe: event.safeErrorMessage,
      },
    });
    await tx.auditLog.create({
      data: {
        schoolId: delivery.campaign.schoolId,
        action: event.deliveryStatus === "READ"
          ? "communication.provider_read"
          : event.deliveryStatus === "DELIVERED"
            ? "communication.provider_delivered"
            : event.deliveryStatus === "FAILED"
              ? "communication.delivery_failed"
              : "communication.provider_accepted",
        correlationId: delivery.campaignId,
        details: {
          deliveryId: delivery.id,
          channel: delivery.channel,
          provider: event.provider,
          webhookId,
          providerMessageId: event.providerMessageId,
          errorCode: event.errorCode ?? null,
        },
      },
    });
    await tx.communicationWebhookEvent.update({
      where: { id: webhookId },
      data: { processingStatus: "PROCESSED", processedAt: new Date() },
    });
  });
}
