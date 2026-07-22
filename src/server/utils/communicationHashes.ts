import { createHash } from "node:crypto";
import type { CommunicationChannel } from "../../shared/communications";

export function buildDeliveryIdempotencyKey(input: {
  schoolId: string;
  campaignId: string;
  recipientId: string;
  channel: CommunicationChannel;
  contentVersion: number;
}) {
  return createHash("sha256")
    .update(`${input.schoolId}:${input.campaignId}:${input.recipientId}:${input.channel}:${input.contentVersion}`)
    .digest("hex");
}

export function hashRenderedContent(content: string) {
  return createHash("sha256").update(content).digest("hex");
}

export function hashPayload(value: string | Buffer) {
  return createHash("sha256").update(value).digest("hex");
}
