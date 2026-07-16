import { describe, expect, it } from "vitest";
import {
  assertCampaignTransition,
  buildDeliveryIdempotencyKey,
  estimateSmsSegments,
  normalizeDeliveryProgressState,
  normalizePhoneToE164,
} from "../../shared/communications";

describe("communication domain helpers", () => {
  it("allows approved campaigns to queue but blocks draft direct send", () => {
    expect(() => assertCampaignTransition("APPROVED", "QUEUED")).not.toThrow();
    expect(() => assertCampaignTransition("DRAFT", "QUEUED")).toThrow(/Invalid communication campaign transition/);
  });

  it("builds stable idempotency keys from logical delivery fields", () => {
    const input = {
      schoolId: "school-a",
      campaignId: "campaign-a",
      recipientId: "recipient-a",
      channel: "WHATSAPP" as const,
      contentVersion: 1,
    };
    expect(buildDeliveryIdempotencyKey(input)).toBe(buildDeliveryIdempotencyKey(input));
    expect(buildDeliveryIdempotencyKey({ ...input, channel: "SMS" })).not.toBe(buildDeliveryIdempotencyKey(input));
  });

  it("normalizes Uganda local phone numbers to E.164 and rejects malformed values", () => {
    expect(normalizePhoneToE164("0774 549 869")).toBe("+256774549869");
    expect(normalizePhoneToE164("+256774549869")).toBe("+256774549869");
    expect(normalizePhoneToE164("256774549869")).toBe("+256774549869");
    expect(normalizePhoneToE164("774549869")).toBeNull();
    expect(normalizePhoneToE164("+254774549869")).toBeNull();
    expect(normalizePhoneToE164("abc")).toBeNull();
  });

  it("estimates GSM and UCS-2 SMS segments with extension character accounting", () => {
    expect(estimateSmsSegments("Short school notice").segments).toBe(1);
    const long = "A".repeat(170);
    expect(estimateSmsSegments(long).segments).toBe(2);
    expect(estimateSmsSegments("Curly braces {}").characterCount).toBe(17);
    const unicode = estimateSmsSegments("Report ready 😊");
    expect(unicode.encoding).toBe("UCS_2");
    expect(unicode.warnings).toContain("SMS_UCS2_ENCODING");
  });

  it("normalizes delivery progress states", () => {
    expect(normalizeDeliveryProgressState("QUEUED")).toBe("QUEUED");
    expect(normalizeDeliveryProgressState("SUBMITTING")).toBe("PROCESSING");
    expect(normalizeDeliveryProgressState("SUBMITTED")).toBe("SENT");
    expect(normalizeDeliveryProgressState("READ")).toBe("DELIVERED");
    expect(normalizeDeliveryProgressState("FAILED")).toBe("FAILED");
  });
});
