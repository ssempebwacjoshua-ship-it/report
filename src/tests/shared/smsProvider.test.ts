import crypto from "node:crypto";
import { describe, expect, it } from "vitest";
import { DisabledYoolaSmsProvider } from "../../server/services/communicationProviders";

describe("DisabledYoolaSmsProvider", () => {
  it("fails clearly while the official contract is pending", async () => {
    const provider = new DisabledYoolaSmsProvider({
      SMS_PROVIDER: "yoola",
      SMS_PROVIDER_ENABLED: "true",
      SMS_API_BASE_URL: "https://example.test",
      SMS_API_USERNAME: "user",
      SMS_API_KEY: "secret",
      SMS_SENDER_ID: "SSAMENJ",
      SMS_WEBHOOK_SECRET: "webhook-secret",
    });

    const result = await provider.sendBatch([{
      recipientId: "recipient-1",
      toE164: "+256774549869",
      text: "Hello parent",
      idempotencyKey: "idem-1",
      segmentCount: 1,
    }], {
      schoolId: "school-1",
      sendingEnabled: true,
      providerMetadata: null,
    });

    expect(result.acceptedRecipients).toEqual([]);
    expect(result.rejectedRecipients[0]?.errorCode).toBe("PROVIDER_NOT_CONFIGURED");
  });

  it("verifies SMS webhook signatures with a timing-safe HMAC check", () => {
    const body = Buffer.from(JSON.stringify({ event: "delivery" }));
    const signature = `sha256=${crypto.createHmac("sha256", "webhook-secret").update(body).digest("hex")}`;
    const provider = new DisabledYoolaSmsProvider({ SMS_WEBHOOK_SECRET: "webhook-secret" });

    expect(provider.verifyWebhookSignature(body, signature)).toBe(true);
    expect(provider.verifyWebhookSignature(body, "sha256=bad")).toBe(false);
  });
});
