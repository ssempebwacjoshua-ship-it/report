import crypto from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { YoolaSmsProvider } from "../../server/services/communicationProviders";

afterEach(() => {
  vi.restoreAllMocks();
});

function createProvider(env: NodeJS.ProcessEnv = {}) {
  return new YoolaSmsProvider({
    SMS_PROVIDER: "yoola",
    SMS_PROVIDER_ENABLED: "true",
    SMS_API_KEY: "super-secret-api-key-value-1234567890abcdef",
    ...env,
  });
}

describe("YoolaSmsProvider", () => {
  it("accepts a successful 2xx JSON response with a provider message id", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({
      status: "SUCCESS",
      message_id: "msg-123",
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }));
    const provider = createProvider();

    const result = await provider.sendBatch([{
      recipientId: "recipient-1",
      toE164: "+256774549869",
      text: "Hello parent",
      idempotencyKey: "idem-1",
      segmentCount: 2,
    }], {
      schoolId: "school-1",
      sendingEnabled: true,
      providerMetadata: null,
    });

    expect(result.acceptedRecipients).toEqual([{
      recipientId: "recipient-1",
      providerMessageId: "msg-123",
      lifecycleState: "SENT",
      providerStatus: "SUCCESS",
      billableUnits: 2,
    }]);
    expect(result.rejectedRecipients).toEqual([]);
  });

  it("accepts a successful 2xx response without a message id", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({
      status: "queued",
    }), {
      status: 202,
      headers: { "Content-Type": "application/json" },
    }));
    const provider = createProvider();

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

    expect(result.acceptedRecipients[0]?.providerMessageId).toBeUndefined();
    expect(result.acceptedRecipients[0]?.providerStatus).toBe("queued");
  });

  it("handles non-JSON success defensively", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("OK", {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    }));
    const provider = createProvider();

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

    expect(result.acceptedRecipients).toHaveLength(1);
    expect(result.acceptedRecipients[0]?.providerStatus).toBe("HTTP_200");
  });

  it("maps provider 4xx and 5xx responses to FAILED with redaction", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({
      error: "Bad request for 256774549869 using super-secret-api-key-value-1234567890abcdef",
      code: "BAD_REQUEST",
    }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    }));
    const provider = createProvider();

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
    expect(result.rejectedRecipients[0]?.errorCode).toBe("BAD_REQUEST");
    expect(result.rejectedRecipients[0]?.safeErrorMessage).not.toContain("super-secret-api-key");
    expect(result.rejectedRecipients[0]?.safeErrorMessage).not.toContain("256774549869");
  });

  it("maps timeout and network failures without retries", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockRejectedValueOnce(new DOMException("timeout", "AbortError"))
      .mockRejectedValueOnce(new Error("network down"));
    const provider = createProvider();

    const result = await provider.sendBatch([
      {
        recipientId: "recipient-1",
        toE164: "+256774549869",
        text: "Hello parent",
        idempotencyKey: "idem-1",
        segmentCount: 1,
      },
      {
        recipientId: "recipient-2",
        toE164: "+256774549868",
        text: "Hello parent",
        idempotencyKey: "idem-2",
        segmentCount: 1,
      },
    ], {
      schoolId: "school-1",
      sendingEnabled: true,
      providerMetadata: null,
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.rejectedRecipients[0]?.errorCode).toBe("TIMEOUT");
    expect(result.rejectedRecipients[1]?.errorCode).toBe("NETWORK_ERROR");
  });

  it("converts +256 to 256 format only inside the adapter", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({
      status: "ok",
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }));
    const provider = createProvider();

    await provider.sendBatch([{
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

    const [, requestInit] = fetchMock.mock.calls[0]!;
    const parsedBody = JSON.parse(String(requestInit?.body));
    expect(parsedBody.phone).toBe("256774549869");
  });

  it("redacts secrets and phone numbers from provider error text", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(
      `Failure for 256774549869 and super-secret-api-key-value-1234567890abcdef`,
      {
        status: 500,
        headers: { "Content-Type": "text/plain" },
      },
    ));
    const provider = createProvider();

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

    expect(result.rejectedRecipients[0]?.safeErrorMessage).toContain("[redacted]");
    expect(result.rejectedRecipients[0]?.safeErrorMessage).not.toContain("256774549869");
  });

  it("rejects malformed numbers before sending", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    const provider = createProvider();

    const result = await provider.sendBatch([{
      recipientId: "recipient-1",
      toE164: "+254774549869",
      text: "Hello parent",
      idempotencyKey: "idem-1",
      segmentCount: 1,
    }], {
      schoolId: "school-1",
      sendingEnabled: true,
      providerMetadata: null,
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.rejectedRecipients[0]?.errorCode).toBe("INVALID_PHONE");
  });

  it("keeps webhook signature verification available while webhook parsing stays pending", () => {
    const body = Buffer.from(JSON.stringify({ event: "delivery" }));
    const signature = `sha256=${crypto.createHmac("sha256", "webhook-secret").update(body).digest("hex")}`;
    const provider = createProvider({ SMS_WEBHOOK_SECRET: "webhook-secret" });

    expect(provider.verifyWebhookSignature(body, signature)).toBe(true);
    expect(provider.verifyWebhookSignature(body, "sha256=bad")).toBe(false);
  });
});
