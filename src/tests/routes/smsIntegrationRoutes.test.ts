import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "../../server/db/prisma";
import { smsIntegrationRoutes } from "../../server/routes/smsIntegrationRoutes";
import * as providers from "../../server/services/communicationProviders";

describe("smsIntegrationRoutes", () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    await prisma.communicationWebhookEvent.deleteMany({ where: { provider: "YOOLA_SMS" } });
  });

  it("deduplicates repeated delivery events", async () => {
    const school = await prisma.school.upsert({
      where: { code: "SMS-WEBHOOK-A" },
      update: { name: "SMS Webhook A" },
      create: { code: "SMS-WEBHOOK-A", name: "SMS Webhook A" },
    });
    const campaign = await prisma.communicationCampaign.create({
      data: {
        schoolId: school.id,
        type: "ANNOUNCEMENT",
        title: "Webhook campaign",
        status: "APPROVED",
        contents: { create: { version: 1, body: "Hello parent" } },
      },
    });
    const snapshot = await prisma.communicationAudienceSnapshot.create({
      data: { campaignId: campaign.id, snapshotVersion: 1, recipientCount: 1 },
    });
    const recipient = await prisma.communicationRecipient.create({
      data: {
        schoolId: school.id,
        campaignId: campaign.id,
        audienceSnapshotId: snapshot.id,
        displayName: "Webhook Parent",
        phoneE164: "+256774549869",
        status: "QUEUED",
      },
    });
    await prisma.communicationDelivery.create({
      data: {
        schoolId: school.id,
        campaignId: campaign.id,
        recipientId: recipient.id,
        channel: "SMS",
        provider: "YOOLA_SMS",
        status: "SUBMITTED",
        contentVersion: 1,
        idempotencyKey: `sms-webhook-${campaign.id}`,
        providerMessageId: "provider-message-1",
      },
    });

    vi.spyOn(providers, "resolveSmsProvider").mockReturnValue({
      providerKey: "YOOLA_SMS",
      channel: "SMS",
      validateConfiguration: vi.fn(),
      checkHealth: vi.fn(),
      sendBatch: vi.fn(),
      verifyWebhookSignature: vi.fn(() => true),
      parseDeliveryWebhook: vi.fn(async () => ({
        events: [{
          provider: "YOOLA_SMS",
          externalEventId: "event-1",
          providerMessageId: "provider-message-1",
          lifecycleState: "DELIVERED",
          providerStatus: "DELIVERED",
          occurredAt: new Date("2026-07-16T10:00:00.000Z"),
        }],
      })),
    } as never);

    const app = express();
    app.use(express.json({
      verify: (req, _res, buf) => {
        (req as express.Request & { rawBody?: Buffer }).rawBody = Buffer.from(buf);
      },
    }));
    app.use(smsIntegrationRoutes());

    const first = await request(app)
      .post("/api/integrations/sms/webhook")
      .set("x-sms-signature-256", "sha256=test")
      .send({ delivery: "first" });
    const second = await request(app)
      .post("/api/integrations/sms/webhook")
      .set("x-sms-signature-256", "sha256=test")
      .send({ delivery: "second" });

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    await expect(prisma.communicationWebhookEvent.count({ where: { provider: "YOOLA_SMS", externalEventId: "event-1" } })).resolves.toBe(1);
    const delivery = await prisma.communicationDelivery.findFirstOrThrow({
      where: { provider: "YOOLA_SMS", providerMessageId: "provider-message-1" },
    });
    expect(delivery.status).toBe("DELIVERED");
  });
});
