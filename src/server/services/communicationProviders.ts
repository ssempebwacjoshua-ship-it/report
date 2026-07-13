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
  providerStatus?: "QUEUED" | "SENT" | "FAILED" | string;
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

export class DryRunMessageProvider implements OutboundMessageProvider {
  readonly providerKey = "DRY_RUN";
  readonly channel: CommunicationChannel;

  constructor(channel: CommunicationChannel) {
    this.channel = channel;
  }

  async validateConfiguration(): Promise<ProviderConfigurationResult> {
    return { configured: true, sendingEnabled: true, issues: [] };
  }

  async render(input: RenderMessageInput): Promise<RenderedMessage> {
    return {
      channel: this.channel,
      kind: input.templateName ? "TEMPLATE" : "TEXT",
      bodyPreview: input.text,
      providerPayload: { dryRun: true, text: input.text, templateName: input.templateName ?? null },
    };
  }

  async submit(input: SubmitMessageInput): Promise<SubmitMessageResult> {
    return {
      accepted: true,
      providerStatus: "DRY_RUN_ACCEPTED",
      providerMessageId: `dry-run-${input.idempotencyKey.slice(0, 16)}`,
      billableUnits: 0,
    };
  }

  async normalizeWebhook(): Promise<NormalizedWebhookEvent[]> {
    return [];
  }
}

export class MetaCloudWhatsAppProvider implements OutboundMessageProvider {
  readonly providerKey = "META_CLOUD_WHATSAPP";
  readonly channel = "WHATSAPP" as const;
  private readonly env: NodeJS.ProcessEnv;
  private readonly graphApiVersion: string;

  constructor(env: NodeJS.ProcessEnv = process.env) {
    this.env = env;
    this.graphApiVersion = this.env.META_GRAPH_API_VERSION?.trim() || "v23.0";
  }

  async validateConfiguration(context: ProviderSchoolContext): Promise<ProviderConfigurationResult> {
    const metadata = context.providerMetadata ?? {};
    const issues = [];
    if (!whatsappAccessToken(this.env)) issues.push("WHATSAPP_META_ACCESS_TOKEN_MISSING");
    if (!whatsappPhoneNumberId(this.env, metadata)) issues.push("WHATSAPP_META_PHONE_NUMBER_ID_MISSING");
    if (!whatsappProviderEnabled(this.env)) issues.push("WHATSAPP_PROVIDER_DISABLED");
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

  async submit(input: SubmitMessageInput): Promise<SubmitMessageResult> {
    const accessToken = whatsappAccessToken(this.env);
    const phoneNumberId = whatsappPhoneNumberId(this.env);
    if (!whatsappProviderEnabled(this.env) || !accessToken || !phoneNumberId) {
      return {
        accepted: false,
        providerStatus: "FAILED",
        errorCode: "WHATSAPP_PROVIDER_NOT_CONFIGURED",
        safeErrorMessage: "WhatsApp is not configured yet. Contact platform owner.",
      };
    }
    const response = await fetch(`https://graph.facebook.com/${this.graphApiVersion}/${phoneNumberId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ...input.rendered.providerPayload,
        to: input.toE164.replace(/^\+/, ""),
      }),
    });
    const json = await response.json().catch(() => ({})) as MetaSendResponse;
    if (!response.ok) {
      return {
        accepted: false,
        providerStatus: "FAILED",
        errorCode: safeProviderCode(json.error?.code) ?? `HTTP_${response.status}`,
        safeErrorMessage: safeProviderMessage(json.error?.message) ?? "WhatsApp provider rejected the message.",
      };
    }
    return {
      accepted: true,
      providerStatus: "SENT",
      providerMessageId: json.messages?.[0]?.id,
      billableUnits: 1,
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

export class MockSmsProvider implements OutboundMessageProvider {
  readonly providerKey = "MOCK_SMS";
  readonly channel = "SMS" as const;
  private readonly env: NodeJS.ProcessEnv;

  constructor(env: NodeJS.ProcessEnv = process.env) {
    this.env = env;
  }

  async validateConfiguration(_context?: ProviderSchoolContext): Promise<ProviderConfigurationResult> {
    const issues = [];
    if (this.env.SMS_PROVIDER !== "mock") issues.push("SMS_PROVIDER_NOT_MOCK");
    if (this.env.SMS_PROVIDER_ENABLED !== "true") issues.push("SMS_PROVIDER_DISABLED");
    return { configured: issues.length === 0, sendingEnabled: issues.length === 0, issues };
  }

  async render(input: RenderMessageInput): Promise<RenderedMessage> {
    return {
      channel: this.channel,
      kind: "TEXT",
      bodyPreview: input.text,
      providerPayload: { text: input.text },
    };
  }

  async submit(input: SubmitMessageInput): Promise<SubmitMessageResult> {
    const config = await this.validateConfiguration();
    if (!config.sendingEnabled) {
      return {
        accepted: false,
        providerStatus: "FAILED",
        errorCode: "SMS_PROVIDER_NOT_CONFIGURED",
        safeErrorMessage: "SMS is not configured yet. Contact platform owner.",
      };
    }
    return {
      accepted: true,
      providerStatus: "SENT",
      providerMessageId: `mock-sms-${input.idempotencyKey.slice(0, 16)}`,
      billableUnits: 1,
    };
  }

  async normalizeWebhook(): Promise<NormalizedWebhookEvent[]> {
    return [];
  }
}

export class TwilioSmsProvider implements OutboundMessageProvider {
  readonly providerKey = "TWILIO_SMS";
  readonly channel = "SMS" as const;
  private readonly env: NodeJS.ProcessEnv;

  constructor(env: NodeJS.ProcessEnv = process.env) {
    this.env = env;
  }

  async validateConfiguration(_context?: ProviderSchoolContext): Promise<ProviderConfigurationResult> {
    const issues = [];
    if (this.env.SMS_PROVIDER !== "twilio") issues.push("SMS_PROVIDER_NOT_TWILIO");
    if (this.env.SMS_PROVIDER_ENABLED !== "true") issues.push("SMS_PROVIDER_DISABLED");
    if (!this.env.SMS_API_KEY) issues.push("SMS_API_KEY_MISSING");
    if (!this.env.SMS_AUTH_TOKEN) issues.push("SMS_AUTH_TOKEN_MISSING");
    if (!this.env.SMS_SENDER_ID) issues.push("SMS_SENDER_ID_MISSING");
    return { configured: issues.length === 0, sendingEnabled: issues.length === 0, issues };
  }

  async render(input: RenderMessageInput): Promise<RenderedMessage> {
    return {
      channel: this.channel,
      kind: "TEXT",
      bodyPreview: input.text,
      providerPayload: { Body: input.text },
    };
  }

  async submit(input: SubmitMessageInput): Promise<SubmitMessageResult> {
    const config = await this.validateConfiguration();
    if (!config.sendingEnabled) {
      return {
        accepted: false,
        providerStatus: "FAILED",
        errorCode: "SMS_PROVIDER_NOT_CONFIGURED",
        safeErrorMessage: "SMS is not configured yet. Contact platform owner.",
      };
    }
    const accountSid = this.env.SMS_API_KEY!;
    const token = this.env.SMS_AUTH_TOKEN!;
    const form = new URLSearchParams({
      To: input.toE164,
      From: this.env.SMS_SENDER_ID!,
      Body: String(input.rendered.providerPayload.Body ?? input.rendered.bodyPreview),
    });
    const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(accountSid)}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${accountSid}:${token}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form,
    });
    const json = await response.json().catch(() => ({})) as TwilioSendResponse;
    if (!response.ok) {
      return {
        accepted: false,
        providerStatus: "FAILED",
        errorCode: safeProviderCode(json.code) ?? `HTTP_${response.status}`,
        safeErrorMessage: safeProviderMessage(json.message) ?? "SMS provider rejected the message.",
      };
    }
    return {
      accepted: true,
      providerStatus: json.status ?? "SENT",
      providerMessageId: json.sid,
      billableUnits: 1,
    };
  }

  async normalizeWebhook(): Promise<NormalizedWebhookEvent[]> {
    return [];
  }
}

export function createProviderForChannel(channel: CommunicationChannel, env: NodeJS.ProcessEnv = process.env): OutboundMessageProvider {
  if (channel === "WHATSAPP") return new MetaCloudWhatsAppProvider(env);
  if (channel === "SMS") return env.SMS_PROVIDER === "twilio" ? new TwilioSmsProvider(env) : new MockSmsProvider(env);
  throw Object.assign(new Error("Only SMS and WhatsApp sending are supported."), { status: 400, expose: true });
}

export async function sendWhatsAppMessage(input: SubmitMessageInput, env: NodeJS.ProcessEnv = process.env) {
  const provider = new MetaCloudWhatsAppProvider(env);
  return provider.submit(input);
}

export async function sendSmsMessage(input: SubmitMessageInput, env: NodeJS.ProcessEnv = process.env) {
  const provider = createProviderForChannel("SMS", env);
  return provider.submit(input);
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

type MetaSendResponse = {
  messages?: Array<{ id?: string }>;
  error?: { code?: string | number; message?: string };
};

type TwilioSendResponse = {
  sid?: string;
  status?: string;
  code?: string | number;
  message?: string;
};

function whatsappProviderEnabled(env: NodeJS.ProcessEnv) {
  return env.WHATSAPP_PROVIDER_ENABLED === "true";
}

function whatsappAccessToken(env: NodeJS.ProcessEnv) {
  return env.WHATSAPP_META_ACCESS_TOKEN?.trim();
}

function whatsappPhoneNumberId(env: NodeJS.ProcessEnv, metadata?: Record<string, unknown> | null) {
  return env.WHATSAPP_META_PHONE_NUMBER_ID?.trim()
    || (typeof metadata?.phoneNumberId === "string" ? metadata.phoneNumberId : undefined);
}

function safeProviderCode(value: unknown) {
  if (value === undefined || value === null) return undefined;
  return String(value).replace(/[^A-Za-z0-9_.:-]/g, "").slice(0, 80);
}

function safeProviderMessage(value: unknown) {
  if (typeof value !== "string") return undefined;
  return value.replace(/Bearer\s+\S+/gi, "Bearer [redacted]").slice(0, 180);
}
