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

function yoolaSuccessFixture(overrides: Record<string, unknown> = {}) {
  return {
    status: "success",
    code: 200,
    message_id: 987654321,
    sender_used: "YOOLA",
    successful: 1,
    failed: 0,
    credits_used: 1,
    credits_refunded: 0,
    amount_charged: 35,
    message_parts: 1,
    balance: 1200,
    per_recipient: [
      {
        number: "256700000001",
        status: "Success",
        statusCode: 100,
        reference: "yoola-ref-123",
      },
    ],
    ...overrides,
  };
}

describe("YoolaSmsProvider", () => {
  it("accepts only the confirmed Yoola success contract and preserves recipient correlation metadata", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify(yoolaSuccessFixture({
      message_parts: 2,
      credits_used: 2,
      sender_used: "YOOLA",
    })), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }));
    const provider = createProvider();

    const result = await provider.sendBatch([{
      recipientId: "recipient-1",
      toE164: "+256700000001",
      text: "Hello parent",
      idempotencyKey: "idem-1",
      segmentCount: 3,
    }], {
      schoolId: "school-1",
      sendingEnabled: true,
      providerMetadata: null,
    });

    expect(result.acceptedRecipients).toEqual([{
      recipientId: "recipient-1",
      providerMessageId: "yoola-ref-123",
      requestProviderMessageId: "987654321",
      lifecycleState: "SENT",
      providerStatus: "success:Success",
      billableUnits: 2,
      providerStatusCode: "100",
      senderUsed: "YOOLA",
      creditsUsed: 2,
      amountChargedMinor: 35,
    }]);
    expect(result.rejectedRecipients).toEqual([]);
  });

  it("accepts a valid Yoola success response even when message_id is absent", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify(yoolaSuccessFixture({
      message_id: undefined,
    })), {
      status: 202,
      headers: { "Content-Type": "application/json" },
    }));
    const provider = createProvider();

    const result = await provider.sendBatch([{
      recipientId: "recipient-1",
      toE164: "+256700000001",
      text: "Hello parent",
      idempotencyKey: "idem-1",
      segmentCount: 1,
    }], {
      schoolId: "school-1",
      sendingEnabled: true,
      providerMetadata: null,
    });

    expect(result.acceptedRecipients[0]?.providerMessageId).toBe("yoola-ref-123");
    expect(result.acceptedRecipients[0]?.requestProviderMessageId).toBeUndefined();
  });

  it("accepts recipient success when Yoola returns lowercase status or string statusCode", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify(yoolaSuccessFixture({
      per_recipient: [
        {
          number: "256700000001",
          status: "success",
          statusCode: "100",
          reference: "yoola-ref-123",
        },
      ],
    })), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }));
    const provider = createProvider();

    const result = await provider.sendBatch([{
      recipientId: "recipient-1",
      toE164: "+256700000001",
      text: "Hello parent",
      idempotencyKey: "idem-1",
      segmentCount: 1,
    }], {
      schoolId: "school-1",
      sendingEnabled: true,
      providerMetadata: null,
    });

    expect(result.acceptedRecipients).toHaveLength(1);
    expect(result.acceptedRecipients[0]?.providerMessageId).toBe("yoola-ref-123");
    expect(result.rejectedRecipients).toEqual([]);
  });

  it("treats non-JSON 2xx responses as failed because recipient acceptance was not confirmed", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("OK", {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    }));
    const provider = createProvider();

    const result = await provider.sendBatch([{
      recipientId: "recipient-1",
      toE164: "+256700000001",
      text: "Hello parent",
      idempotencyKey: "idem-1",
      segmentCount: 1,
    }], {
      schoolId: "school-1",
      sendingEnabled: true,
      providerMetadata: null,
    });

    expect(result.acceptedRecipients).toEqual([]);
    expect(result.rejectedRecipients[0]?.errorCode).toBe("HTTP_200");
  });

  it("fails when the provider returns a 2xx body without recipient acceptance", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify(yoolaSuccessFixture({
      successful: 0,
      per_recipient: [],
    })), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }));
    const provider = createProvider();

    const result = await provider.sendBatch([{
      recipientId: "recipient-1",
      toE164: "+256700000001",
      text: "Hello parent",
      idempotencyKey: "idem-1",
      segmentCount: 1,
    }], {
      schoolId: "school-1",
      sendingEnabled: true,
      providerMetadata: null,
    });

    expect(result.acceptedRecipients).toEqual([]);
    expect(result.rejectedRecipients[0]?.errorCode).toBe("200");
    expect(result.rejectedRecipients[0]?.safeErrorMessage).toMatch(/did not confirm recipient acceptance/i);
  });

  it("maps provider 4xx and 5xx responses to FAILED with redaction", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({
      error: "Bad request for 256700000001 using super-secret-api-key-value-1234567890abcdef",
      code: "BAD_REQUEST",
      per_recipient: [
        {
          number: "256700000001",
          status: "Rejected",
          statusCode: 422,
        },
      ],
    }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    }));
    const provider = createProvider();

    const result = await provider.sendBatch([{
      recipientId: "recipient-1",
      toE164: "+256700000001",
      text: "Hello parent",
      idempotencyKey: "idem-1",
      segmentCount: 1,
    }], {
      schoolId: "school-1",
      sendingEnabled: true,
      providerMetadata: null,
    });

    expect(result.acceptedRecipients).toEqual([]);
    expect(result.rejectedRecipients[0]?.errorCode).toBe("422");
    expect(result.rejectedRecipients[0]?.safeErrorMessage).not.toContain("super-secret-api-key");
    expect(result.rejectedRecipients[0]?.safeErrorMessage).not.toContain("256700000001");
  });

  it("maps timeout and network failures without retries", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockRejectedValueOnce(new DOMException("timeout", "AbortError"))
      .mockRejectedValueOnce(new Error("network down"));
    const provider = createProvider();

    const result = await provider.sendBatch([
      {
        recipientId: "recipient-1",
        toE164: "+256700000001",
        text: "Hello parent",
        idempotencyKey: "idem-1",
        segmentCount: 1,
      },
      {
        recipientId: "recipient-2",
        toE164: "+256700000002",
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
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify(yoolaSuccessFixture()), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }));
    const provider = createProvider();

    await provider.sendBatch([{
      recipientId: "recipient-1",
      toE164: "+256700000001",
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
    expect(parsedBody.phone).toBe("256700000001");
  });

  it("redacts secrets and recipient numbers from provider error text", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(
      "Failure for 256700000001 and super-secret-api-key-value-1234567890abcdef",
      {
        status: 500,
        headers: { "Content-Type": "text/plain" },
      },
    ));
    const provider = createProvider();

    const result = await provider.sendBatch([{
      recipientId: "recipient-1",
      toE164: "+256700000001",
      text: "Hello parent",
      idempotencyKey: "idem-1",
      segmentCount: 1,
    }], {
      schoolId: "school-1",
      sendingEnabled: true,
      providerMetadata: null,
    });

    expect(result.rejectedRecipients[0]?.safeErrorMessage).toContain("[redacted]");
    expect(result.rejectedRecipients[0]?.safeErrorMessage).not.toContain("256700000001");
  });

  it("omits sender when SMS_SENDER_ID is not configured", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify(yoolaSuccessFixture()), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }));
    const provider = createProvider();

    await provider.sendBatch([{
      recipientId: "recipient-1",
      toE164: "+256700000001",
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
    expect(parsedBody.sender).toBeUndefined();
  });

  it("includes configured sender when SMS_SENDER_ID is present", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify(yoolaSuccessFixture({
      sender_used: "SSAMENJ",
    })), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }));
    const provider = createProvider({ SMS_SENDER_ID: "SSAMENJ" });

    const result = await provider.sendBatch([{
      recipientId: "recipient-1",
      toE164: "+256700000001",
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
    expect(parsedBody.sender).toBe("SSAMENJ");
    expect(result.acceptedRecipients[0]?.senderUsed).toBe("SSAMENJ");
  });

  it("preserves provider sender substitution from sender_used instead of assuming the configured sender was used", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify(yoolaSuccessFixture({
      sender_used: "YOOLA",
    })), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }));
    const provider = createProvider({ SMS_SENDER_ID: "SSAMENJ" });

    const result = await provider.sendBatch([{
      recipientId: "recipient-1",
      toE164: "+256700000001",
      text: "Hello parent",
      idempotencyKey: "idem-1",
      segmentCount: 1,
    }], {
      schoolId: "school-1",
      sendingEnabled: true,
      providerMetadata: null,
    });

    expect(result.acceptedRecipients[0]?.senderUsed).toBe("YOOLA");
  });

  it("rejects malformed numbers before sending", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    const provider = createProvider();

    const result = await provider.sendBatch([{
      recipientId: "recipient-1",
      toE164: "+254700000001",
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

  it("fails configuration when the configured sender exceeds 11 characters", async () => {
    const provider = createProvider({ SMS_SENDER_ID: "TOO-LONG-1234" });

    const result = await provider.validateConfiguration({
      schoolId: "school-1",
      sendingEnabled: true,
      providerMetadata: null,
    });

    expect(result.configured).toBe(false);
    expect(result.issues).toContain("SMS_SENDER_ID_TOO_LONG");
  });

  it("keeps webhook signature verification available while webhook parsing stays pending", () => {
    const body = Buffer.from(JSON.stringify({ event: "delivery" }));
    const signature = `sha256=${crypto.createHmac("sha256", "webhook-secret").update(body).digest("hex")}`;
    const provider = createProvider({ SMS_WEBHOOK_SECRET: "webhook-secret" });

    expect(provider.verifyWebhookSignature(body, signature)).toBe(true);
    expect(provider.verifyWebhookSignature(body, "sha256=bad")).toBe(false);
  });
});
