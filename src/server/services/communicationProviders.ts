import crypto from "node:crypto";
import type { CommunicationChannel, CommunicationDeliveryStatus } from "../../shared/communications";

export type ProviderSchoolContext = {
  schoolId: string;
  providerMetadata?: Record<string, unknown> | null;
  sendingEnabled?: boolean;
};

export type ProviderConfigurationResult = {
  configured: boolean;
  sendingEnabled: boolean;
  issues: string[];
};

export type RenderMessageInput = {
  templateName?: string;
  text: string;
  variables?: Record<string, string>;
  secureLink?: string;
};

export type RenderedMessage = {
  channel: CommunicationChannel;
  kind: "TEXT" | "TEMPLATE";
  bodyPreview: string;
  providerPayload: Record<string, unknown>;
};

export type SubmitMessageInput = {
  toE164: string;
  rendered: RenderedMessage;
  idempotencyKey: string;
};

export type SubmitMessageResult = {
  accepted: boolean;
  providerMessageId?: string;
  providerStatus?: string;
  billableUnits?: number;
  errorCode?: string;
  safeErrorMessage?: string;
};

export type ProviderWebhookInput = {
  payload: unknown;
  headers?: Record<string, string | undefined>;
};

export type NormalizedWebhookEvent = {
  provider: string;
  externalEventId: string;
  eventType: "MESSAGE_STATUS" | "INCOMING_REPLY" | "TEMPLATE_STATUS" | "UNKNOWN";
  providerMessageId?: string;
  deliveryStatus?: CommunicationDeliveryStatus;
  incomingFrom?: string;
  safeTextPreview?: string;
  occurredAt?: Date;
  errorCode?: string;
  safeErrorMessage?: string;
};

export interface OutboundMessageProvider {
  readonly providerKey: string;
  readonly channel: CommunicationChannel;
  validateConfiguration(context: ProviderSchoolContext): Promise<ProviderConfigurationResult>;
  render(input: RenderMessageInput): Promise<RenderedMessage>;
  submit(input: SubmitMessageInput): Promise<SubmitMessageResult>;
  normalizeWebhook(input: ProviderWebhookInput): Promise<NormalizedWebhookEvent[]>;
}

export class MetaCloudWhatsAppProvider implements OutboundMessageProvider {
  readonly providerKey = "META_CLOUD_WHATSAPP";
  readonly channel = "WHATSAPP" as const;
  private readonly graphApiVersion: string;

  constructor(private readonly env: NodeJS.ProcessEnv = process.env) {
    this.graphApiVersion = env.META_GRAPH_API_VERSION?.trim() || "v23.0";
  }

  async validateConfiguration(context: ProviderSchoolContext): Promise<ProviderConfigurationResult> {
    const metadata = context.providerMetadata ?? {};
    const issues = [];
    if (!this.env.META_WHATSAPP_APP_ID) issues.push("META_WHATSAPP_APP_ID_MISSING");
    if (!this.env.META_WHATSAPP_APP_SECRET) issues.push("META_WHATSAPP_APP_SECRET_MISSING");
    if (!this.env.META_WHATSAPP_WEBHOOK_VERIFY_TOKEN) issues.push("META_WHATSAPP_WEBHOOK_VERIFY_TOKEN_MISSING");
    if (typeof metadata.phoneNumberId !== "string" || !metadata.phoneNumberId) issues.push("PHONE_NUMBER_ID_MISSING");
    if (typeof metadata.whatsappBusinessAccountId !== "string" || !metadata.whatsappBusinessAccountId) issues.push("WABA_ID_MISSING");
    return { configured: issues.length === 0, sendingEnabled: context.sendingEnabled === true && issues.length === 0, issues };
  }

  async render(input: RenderMessageInput): Promise<RenderedMessage> {
    if (input.templateName) {
      const components = Object.entries(input.variables ?? {}).map(([key, value]) => ({
        type: "text",
        parameter_name: key,
        text: value,
      }));
      return {
        channel: this.channel,
        kind: "TEMPLATE",
        bodyPreview: input.text,
        providerPayload: {
          messaging_product: "whatsapp",
          type: "template",
          template: {
            name: input.templateName,
            language: { code: "en" },
            components: components.length ? [{ type: "body", parameters: components }] : undefined,
          },
        },
      };
    }
    return {
      channel: this.channel,
      kind: "TEXT",
      bodyPreview: input.text,
      providerPayload: {
        messaging_product: "whatsapp",
        type: "text",
        text: { preview_url: Boolean(input.secureLink), body: input.text },
      },
    };
  }

  async submit(_input: SubmitMessageInput): Promise<SubmitMessageResult> {
    if (process.env.COMMUNICATION_DRY_RUN !== "false") {
      return { accepted: true, providerStatus: "DRY_RUN", billableUnits: 0 };
    }
    return {
      accepted: false,
      errorCode: "LIVE_WHATSAPP_SUBMIT_NOT_ENABLED",
      safeErrorMessage: `Meta Cloud WhatsApp submission is not enabled in ${this.graphApiVersion}.`,
    };
  }

  async normalizeWebhook(input: ProviderWebhookInput): Promise<NormalizedWebhookEvent[]> {
    const payload = input.payload as MetaWebhookPayload;
    const events: NormalizedWebhookEvent[] = [];
    for (const entry of payload.entry ?? []) {
      for (const change of entry.changes ?? []) {
        const value = change.value ?? {};
        for (const status of value.statuses ?? []) {
          events.push({
            provider: this.providerKey,
            externalEventId: status.id && status.timestamp ? `${status.id}:${status.status}:${status.timestamp}` : crypto.randomUUID(),
            eventType: "MESSAGE_STATUS",
            providerMessageId: status.id,
            deliveryStatus: normalizeMetaStatus(status.status),
            occurredAt: status.timestamp ? new Date(Number(status.timestamp) * 1000) : undefined,
            errorCode: status.errors?.[0]?.code ? String(status.errors[0].code) : undefined,
            safeErrorMessage: status.errors?.[0]?.title?.slice(0, 180),
          });
        }
        for (const message of value.messages ?? []) {
          events.push({
            provider: this.providerKey,
            externalEventId: message.id ?? crypto.randomUUID(),
            eventType: "INCOMING_REPLY",
            providerMessageId: message.context?.id,
            incomingFrom: message.from,
            safeTextPreview: message.text?.body?.slice(0, 120),
            occurredAt: message.timestamp ? new Date(Number(message.timestamp) * 1000) : undefined,
          });
        }
      }
    }
    return events.length ? events : [{
      provider: this.providerKey,
      externalEventId: crypto.randomUUID(),
      eventType: "UNKNOWN",
    }];
  }
}

function normalizeMetaStatus(status: string | undefined): CommunicationDeliveryStatus {
  switch (status) {
    case "sent":
      return "ACCEPTED";
    case "delivered":
      return "DELIVERED";
    case "read":
      return "READ";
    case "failed":
      return "FAILED";
    default:
      return "SUBMITTED";
  }
}

type MetaWebhookPayload = {
  entry?: Array<{
    changes?: Array<{
      value?: {
        statuses?: Array<{
          id?: string;
          status?: string;
          timestamp?: string;
          errors?: Array<{ code?: string | number; title?: string }>;
        }>;
        messages?: Array<{
          id?: string;
          from?: string;
          timestamp?: string;
          text?: { body?: string };
          context?: { id?: string };
        }>;
      };
    }>;
  }>;
};
