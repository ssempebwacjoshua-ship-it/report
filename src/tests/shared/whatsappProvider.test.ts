import crypto from "node:crypto";
import express from "express";
import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { whatsappIntegrationRoutes } from "../../server/routes/whatsappIntegrationRoutes";
import { MetaCloudWhatsAppProvider } from "../../server/services/communicationProviders";
import { verifyMetaSignature, verifyMetaWebhookChallenge } from "../../server/services/whatsappWebhookService";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Meta Cloud WhatsApp provider", () => {
  it("validates webhook challenge tokens without exposing secrets", () => {
    const challenge = verifyMetaWebhookChallenge({
      "hub.mode": "subscribe",
      "hub.verify_token": "verify-token",
      "hub.challenge": "challenge-123",
    }, { WHATSAPP_META_VERIFY_TOKEN: "verify-token" });

    expect(challenge).toBe("challenge-123");
    expect(verifyMetaWebhookChallenge({
      "hub.mode": "subscribe",
      "hub.verify_token": "wrong",
      "hub.challenge": "challenge-123",
    }, { WHATSAPP_META_VERIFY_TOKEN: "verify-token" })).toBeNull();
  });

  it("verifies x-hub-signature-256 with timing-safe comparison", () => {
    const body = Buffer.from(JSON.stringify({ entry: [] }));
    const signature = `sha256=${crypto.createHmac("sha256", "app-secret").update(body).digest("hex")}`;
    expect(verifyMetaSignature(body, signature, { WHATSAPP_META_APP_SECRET: "app-secret" })).toBe(true);
    expect(verifyMetaSignature(body, "sha256=bad", { WHATSAPP_META_APP_SECRET: "app-secret" })).toBe(false);
  });

  it("sends WhatsApp text and returns provider message id when configured", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ messages: [{ id: "wamid.sent" }] }),
    } as Response);
    const provider = new MetaCloudWhatsAppProvider({
      WHATSAPP_PROVIDER_ENABLED: "true",
      WHATSAPP_META_ACCESS_TOKEN: "token-secret",
      WHATSAPP_META_PHONE_NUMBER_ID: "phone-1",
      META_GRAPH_API_VERSION: "v23.0",
    });
    const rendered = await provider.render({ text: "Hello parent" });
    const result = await provider.submit({ toE164: "+256774549869", rendered, idempotencyKey: "idem-1" });

    expect(result.accepted).toBe(true);
    expect(result.providerMessageId).toBe("wamid.sent");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://graph.facebook.com/v23.0/phone-1/messages",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ Authorization: "Bearer token-secret" }),
      }),
    );
  });

  it("fails closed when WhatsApp env is missing or disabled", async () => {
    const provider = new MetaCloudWhatsAppProvider({});
    const rendered = await provider.render({ text: "Hello parent" });
    const result = await provider.submit({ toE164: "+256774549869", rendered, idempotencyKey: "idem-2" });
    expect(result.accepted).toBe(false);
    expect(result.errorCode).toBe("WHATSAPP_PROVIDER_NOT_CONFIGURED");
  });

  it("normalizes delivered, read and failed webhook statuses", async () => {
    const provider = new MetaCloudWhatsAppProvider();
    const events = await provider.normalizeWebhook({
      payload: {
        entry: [{
          changes: [{
            value: {
              statuses: [
                { id: "wamid.1", status: "delivered", timestamp: "1783910000" },
                { id: "wamid.2", status: "read", timestamp: "1783910001" },
                { id: "wamid.3", status: "failed", timestamp: "1783910002", errors: [{ code: 131026, title: "Message undeliverable" }] },
              ],
            },
          }],
        }],
      },
    });

    expect(events.map((event) => event.deliveryStatus)).toEqual(["DELIVERED", "READ", "FAILED"]);
    expect(events[2]?.safeErrorMessage).toBe("Message undeliverable");
  });

  it("rejects POST webhook calls with invalid signatures before processing", async () => {
    const app = express();
    app.use(express.json({
      verify: (req, _res, buf) => {
        (req as express.Request & { rawBody?: Buffer }).rawBody = Buffer.from(buf);
      },
    }));
    app.use(whatsappIntegrationRoutes());

    const res = await request(app)
      .post("/api/integrations/whatsapp/webhook")
      .set("x-hub-signature-256", "sha256=bad")
      .send({ entry: [] });

    expect(res.status).toBe(401);
    expect(res.body.code).toBe("INVALID_WEBHOOK_SIGNATURE");
  });
});
