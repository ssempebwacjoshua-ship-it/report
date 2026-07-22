import crypto from "node:crypto";
import type { CommunicationChannel, CommunicationDeliveryStatus, CommunicationProgressState } from "../../shared/communications";

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

export type SmsBatchMessage = {
  recipientId: string;
  toE164: string;
  text: string;
  idempotencyKey: string;
  segmentCount: number;
};

export type SmsBatchAcceptedRecipient = {
  recipientId: string;
  providerMessageId?: string;
  requestProviderMessageId?: string;
  lifecycleState: CommunicationProgressState;
  providerStatus: string;
  billableUnits: number;
  providerStatusCode?: string;
  senderUsed?: string;
  creditsUsed?: number;
  amountChargedMinor?: number;
};

export type SmsBatchRejectedRecipient = {
  recipientId: string;
  lifecycleState: "FAILED";
  providerStatus: string;
  errorCode: string;
  safeErrorMessage: string;
};

export type SmsBatchSendResult = {
  acceptedRecipients: SmsBatchAcceptedRecipient[];
  rejectedRecipients: SmsBatchRejectedRecipient[];
};

export type SmsDeliveryWebhookEvent = {
  provider: string;
  externalEventId: string;
  providerMessageId?: string;
  lifecycleState: CommunicationProgressState;
  providerStatus: string;
  occurredAt?: Date;
  errorCode?: string;
  safeErrorMessage?: string;
};

export type SmsWebhookParseResult = {
  events: SmsDeliveryWebhookEvent[];
};

export type SmsWebhookRequest = {
  rawBody: Buffer;
  payload: unknown;
  headers: Record<string, string | undefined>;
};

export interface SmsProvider {
  readonly providerKey: string;
  readonly channel: "SMS";
  validateConfiguration(context: ProviderSchoolContext): Promise<ProviderConfigurationResult>;
  checkHealth(context: ProviderSchoolContext): Promise<ProviderConfigurationResult>;
  sendBatch(messages: SmsBatchMessage[], context: ProviderSchoolContext): Promise<SmsBatchSendResult>;
  verifyWebhookSignature(rawBody: Buffer | undefined, signatureHeader: string | undefined): boolean;
  parseDeliveryWebhook(input: SmsWebhookRequest): Promise<SmsWebhookParseResult>;
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

export class YoolaSmsProvider implements SmsProvider {
  readonly providerKey = "YOOLA_SMS";
  readonly channel = "SMS" as const;
  private readonly env: NodeJS.ProcessEnv;
  private readonly endpointUrl: string;

  constructor(env: NodeJS.ProcessEnv = process.env) {
    this.env = env;
    this.endpointUrl = resolveYoolaEndpointUrl(env);
  }

  async validateConfiguration(context: ProviderSchoolContext): Promise<ProviderConfigurationResult> {
    const issues = [];
    if (this.env.SMS_PROVIDER?.trim().toLowerCase() !== "yoola") issues.push("SMS_PROVIDER_NOT_YOOLA");
    if (this.env.SMS_PROVIDER_ENABLED !== "true") issues.push("SMS_PROVIDER_DISABLED");
    if (!this.env.SMS_API_KEY?.trim()) issues.push("SMS_API_KEY_MISSING");
    if (!isValidYoolaSender(this.env.SMS_SENDER_ID)) issues.push("SMS_SENDER_ID_TOO_LONG");
    if (context.sendingEnabled === false) issues.push("SMS_CHANNEL_DISABLED");
    if (!this.endpointUrl) issues.push("SMS_API_BASE_URL_INVALID");
    return { configured: issues.length === 0, sendingEnabled: issues.length === 0, issues };
  }

  async checkHealth(context: ProviderSchoolContext): Promise<ProviderConfigurationResult> {
    return this.validateConfiguration(context);
  }

  async sendBatch(messages: SmsBatchMessage[], context: ProviderSchoolContext): Promise<SmsBatchSendResult> {
    const configuration = await this.validateConfiguration(context);
    if (!configuration.sendingEnabled) {
      return {
        acceptedRecipients: [],
        rejectedRecipients: messages.map((message) => ({
          recipientId: message.recipientId,
          lifecycleState: "FAILED",
          providerStatus: "FAILED",
          errorCode: "PROVIDER_NOT_CONFIGURED",
          safeErrorMessage: "Yoola SMS is not configured yet. Contact platform owner.",
        })),
      };
    }

    const acceptedRecipients: SmsBatchAcceptedRecipient[] = [];
    const rejectedRecipients: SmsBatchRejectedRecipient[] = [];
    const sender = resolveConfiguredYoolaSender(this.env.SMS_SENDER_ID);
    for (const message of messages) {
      const phone = normalizeYoolaPhone(message.toE164);
      if (!phone) {
        rejectedRecipients.push({
          recipientId: message.recipientId,
          lifecycleState: "FAILED",
          providerStatus: "FAILED",
          errorCode: "INVALID_PHONE",
          safeErrorMessage: "Recipient phone number is not a valid Uganda mobile number.",
        });
        continue;
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15_000);
      try {
        const response = await fetch(this.endpointUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            api_key: this.env.SMS_API_KEY,
            phone,
            message: message.text,
            ...(sender ? { sender } : {}),
          }),
          signal: controller.signal,
        });
        const parsed = await parseProviderResponse(response, [this.env.SMS_API_KEY?.trim() ?? ""]);
        const successResult = normalizeYoolaAcceptedResponse({
          response,
          parsedBody: parsed.parsedBody,
          recipientId: message.recipientId,
          phone,
          fallbackBillableUnits: message.segmentCount,
        });
        if (successResult) {
          acceptedRecipients.push({
            recipientId: message.recipientId,
            providerMessageId: successResult.providerMessageId,
            requestProviderMessageId: successResult.requestProviderMessageId,
            lifecycleState: "SENT",
            providerStatus: successResult.providerStatus,
            billableUnits: successResult.billableUnits,
            providerStatusCode: successResult.providerStatusCode,
            senderUsed: successResult.senderUsed,
            creditsUsed: successResult.creditsUsed,
            amountChargedMinor: successResult.amountChargedMinor,
          });
          continue;
        }

        rejectedRecipients.push({
          recipientId: message.recipientId,
          lifecycleState: "FAILED",
          providerStatus: extractProviderStatus(parsed.parsedBody) ?? `HTTP_${response.status}`,
          errorCode: extractYoolaFailureCode(parsed.parsedBody, response.status),
          safeErrorMessage: buildYoolaFailureMessage(parsed.parsedBody, parsed.safeBody, response.status, phone),
        });
      } catch (error) {
        rejectedRecipients.push({
          recipientId: message.recipientId,
          lifecycleState: "FAILED",
          providerStatus: "FAILED",
          errorCode: error instanceof DOMException && error.name === "AbortError" ? "TIMEOUT" : "NETWORK_ERROR",
          safeErrorMessage: error instanceof DOMException && error.name === "AbortError"
            ? "Yoola SMS request timed out before the provider confirmed acceptance."
            : "Yoola SMS request failed before the provider confirmed acceptance.",
        });
      } finally {
        clearTimeout(timeout);
      }
    }

    return {
      acceptedRecipients,
      rejectedRecipients,
    };
  }

  verifyWebhookSignature(rawBody: Buffer | undefined, signatureHeader: string | undefined) {
    return verifyHmacSha256(rawBody, signatureHeader, this.env.SMS_WEBHOOK_SECRET);
  }

  async parseDeliveryWebhook(): Promise<SmsWebhookParseResult> {
    throw Object.assign(new Error("Yoola SMS delivery webhooks are pending because the provider webhook contract is not documented yet."), {
      status: 503,
      expose: true,
      code: "PROVIDER_NOT_CONFIGURED",
    });
  }
}

export function createProviderForChannel(channel: CommunicationChannel, env: NodeJS.ProcessEnv = process.env): OutboundMessageProvider {
  if (channel === "WHATSAPP") return new MetaCloudWhatsAppProvider(env);
  throw Object.assign(new Error("Only WhatsApp uses the generic outbound provider path."), { status: 400, expose: true });
}

export function resolveSmsProvider(env: NodeJS.ProcessEnv = process.env): SmsProvider {
  return new YoolaSmsProvider(env);
}

export async function sendWhatsAppMessage(input: SubmitMessageInput, env: NodeJS.ProcessEnv = process.env) {
  const provider = new MetaCloudWhatsAppProvider(env);
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

function normalizeYoolaPhone(toE164: string) {
  const trimmed = toE164.trim();
  if (!/^\+256\d{9}$/.test(trimmed)) return null;
  return trimmed.slice(1);
}

function resolveConfiguredYoolaSender(value: string | undefined) {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  if (!isValidYoolaSender(trimmed)) return undefined;
  return trimmed;
}

function isValidYoolaSender(value: string | undefined) {
  const trimmed = value?.trim();
  if (!trimmed) return true;
  return trimmed.length <= 11;
}

function resolveYoolaEndpointUrl(env: NodeJS.ProcessEnv) {
  const configured = env.SMS_API_BASE_URL?.trim();
  if (!configured) return "https://yoolasms.com/api/v1/send_sms";
  try {
    const url = new URL(configured);
    const normalizedPath = url.pathname.replace(/\/+$/, "");
    if (normalizedPath === "" || normalizedPath === "/") {
      url.pathname = "/api/v1/send_sms";
    } else if (normalizedPath.endsWith("/send_sms")) {
      url.pathname = normalizedPath;
    } else {
      url.pathname = `${normalizedPath}/send_sms`;
    }
    return url.toString();
  } catch {
    return "";
  }
}

async function parseProviderResponse(response: Response, secrets: string[]) {
  const text = await response.text();
  const contentType = response.headers.get("content-type") ?? "";
  const parsedBody = contentType.includes("application/json") ? tryParseJson(text) : tryParseJson(text) ?? text;
  return {
    parsedBody,
    safeBody: redactSensitiveText(text, secrets),
  };
}

function tryParseJson(text: string) {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

function extractProviderMessageId(value: unknown) {
  return findFirstString(value, ["message_id", "messageId", "id", "sms_id", "smsId", "reference", "request_id", "requestId"]);
}

function extractProviderStatus(value: unknown) {
  return findFirstString(value, ["status", "message_status", "messageStatus", "state", "result"]);
}

function extractProviderErrorCode(value: unknown) {
  return findFirstString(value, ["error_code", "errorCode", "code", "status_code", "statusCode"]);
}

function findFirstString(value: unknown, candidates: string[]) {
  if (!value || typeof value !== "object") return undefined;
  const record = value as Record<string, unknown>;
  for (const candidate of candidates) {
    const found = record[candidate];
    if (typeof found === "string" && found.trim()) return redactSensitiveText(found);
    if (typeof found === "number") return String(found);
  }
  return undefined;
}

function buildSafeProviderErrorMessage(value: unknown, statusCode: number) {
  if (typeof value === "string" && value.trim()) {
    return redactSensitiveText(value).slice(0, 180);
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const candidates = [
      record.error_message,
      record.errorMessage,
      record.error,
      record.message,
      record.detail,
    ];
    for (const candidate of candidates) {
      if (typeof candidate === "string" && candidate.trim()) return redactSensitiveText(candidate).slice(0, 180);
    }
  }
  return `Yoola SMS rejected the request with HTTP ${statusCode}.`;
}

function normalizeYoolaAcceptedResponse(input: {
  response: Response;
  parsedBody: unknown;
  recipientId: string;
  phone: string;
  fallbackBillableUnits: number;
}) {
  if (!input.response.ok || !input.parsedBody || typeof input.parsedBody !== "object") return null;
  const body = input.parsedBody as YoolaSendResponse;
  if (body.status !== "success" || body.code !== 200) return null;
  if (typeof body.successful === "number" && body.successful <= 0) return null;
  if (typeof body.failed === "number" && body.failed > 0) return null;

  const matchedRecipient = Array.isArray(body.per_recipient)
    ? body.per_recipient.find((entry) => entry?.number === input.phone)
    : undefined;
  if (!matchedRecipient) return null;
  if (!isYoolaRecipientAccepted(matchedRecipient.status, matchedRecipient.statusCode)) return null;

  return {
    recipientId: input.recipientId,
    providerMessageId: matchedRecipient.reference ? redactSensitiveText(String(matchedRecipient.reference)) : undefined,
    requestProviderMessageId: body.message_id === undefined || body.message_id === null
      ? undefined
      : redactSensitiveText(String(body.message_id)),
    providerStatus: `${body.status}:${matchedRecipient.status}`,
    providerStatusCode: String(matchedRecipient.statusCode),
    billableUnits: asPositiveInteger(body.message_parts) ?? input.fallbackBillableUnits,
    senderUsed: sanitizeSenderValue(body.sender_used),
    creditsUsed: asPositiveInteger(body.credits_used) ?? undefined,
    amountChargedMinor: parseYoolaAmountMinor(body.amount_charged),
  };
}

function isYoolaRecipientAccepted(status: unknown, statusCode: unknown) {
  const normalizedStatus = typeof status === "string" ? status.trim().toLowerCase() : "";
  const normalizedStatusCode = typeof statusCode === "number"
    ? statusCode
    : typeof statusCode === "string" && /^\d+$/.test(statusCode.trim())
      ? Number.parseInt(statusCode.trim(), 10)
      : null;
  return normalizedStatus === "success" && normalizedStatusCode === 100;
}

function extractYoolaFailureCode(value: unknown, statusCode: number) {
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const matchedRecipient = Array.isArray(record.per_recipient) ? record.per_recipient[0] as Record<string, unknown> | undefined : undefined;
    return safeProviderCode(
      matchedRecipient?.statusCode
      ?? record.code
      ?? record.error_code
      ?? record.errorCode,
    ) ?? `HTTP_${statusCode}`;
  }
  return `HTTP_${statusCode}`;
}

function buildYoolaFailureMessage(parsedBody: unknown, safeBody: string, statusCode: number, phone: string) {
  const normalizedSafeBody = redactSensitiveText(safeBody, [phone]);
  if (parsedBody && typeof parsedBody === "object") {
    const record = parsedBody as Record<string, unknown>;
    const matchedRecipient = Array.isArray(record.per_recipient)
      ? (record.per_recipient[0] as Record<string, unknown> | undefined)
      : undefined;
    if (record.code === 200 && record.status === "success") {
      return "Yoola SMS returned a response that did not confirm recipient acceptance.";
    }
    const candidates = [
      matchedRecipient?.status,
      matchedRecipient?.message,
      record.message,
      record.error,
      record.detail,
      record.status,
    ];
    for (const candidate of candidates) {
      if (typeof candidate === "string" && candidate.trim()) {
        return redactSensitiveText(candidate, [phone]).slice(0, 180);
      }
    }
  }
  return buildSafeProviderErrorMessage(normalizedSafeBody, statusCode);
}

function asPositiveInteger(value: unknown) {
  if (typeof value === "number" && Number.isInteger(value) && value >= 0) return value;
  if (typeof value === "string" && /^\d+$/.test(value.trim())) return Number.parseInt(value.trim(), 10);
  return null;
}

function parseYoolaAmountMinor(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) return Math.round(value);
  if (typeof value === "string" && value.trim()) {
    const normalized = Number(value.trim());
    if (Number.isFinite(normalized) && normalized >= 0) return Math.round(normalized);
  }
  return undefined;
}

function sanitizeSenderValue(value: unknown) {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return trimmed.slice(0, 32);
}

function redactSensitiveText(value: string, secrets: string[] = []) {
  let redacted = value;
  for (const secret of secrets) {
    if (secret) redacted = redacted.replaceAll(secret, "[redacted]");
  }
  return redacted
    .replace(/[A-Fa-f0-9]{32,}/g, "[redacted]")
    .replace(/\+?256\d{9}/g, "[redacted-phone]")
    .replace(/\b0\d{9}\b/g, "[redacted-phone]");
}

function verifyHmacSha256(rawBody: Buffer | undefined, signatureHeader: string | undefined, secret: string | undefined) {
  if (!rawBody || !signatureHeader || !secret) return false;
  const expected = `sha256=${crypto.createHmac("sha256", secret).update(rawBody).digest("hex")}`;
  const actual = signatureHeader.trim();
  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(actual);
  return expectedBuffer.length === actualBuffer.length && crypto.timingSafeEqual(expectedBuffer, actualBuffer);
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

type YoolaSendResponse = {
  status?: string;
  code?: number;
  message_id?: string | number;
  sender_used?: string;
  successful?: number;
  failed?: number;
  credits_used?: number | string;
  credits_refunded?: number | string;
  amount_charged?: number | string;
  message_parts?: number | string;
  per_recipient?: Array<{
    number?: string;
    status?: string;
    statusCode?: number;
    reference?: string | number;
    message?: string;
  }>;
};
