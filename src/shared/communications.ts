import { createHash } from "node:crypto";

export const communicationTypes = [
  "REPORT_RELEASE",
  "CIRCULAR",
  "ANNOUNCEMENT",
  "EVENT",
  "VIDEO_MESSAGE",
  "EMERGENCY_ALERT",
  "FEE_NOTICE",
  "ATTENDANCE_ALERT",
  "RECEIPT",
  "CUSTOM",
] as const;

export const communicationChannels = ["WHATSAPP", "SMS", "PARENT_PORTAL", "EMAIL", "PRINT"] as const;
export const communicationAudienceTypes = [
  "ALL_PARENTS_GUARDIANS",
  "PARENTS_BY_CLASS",
  "PARENTS_BY_STREAM",
  "PARENTS_OF_SELECTED_STUDENTS",
  "PARENTS_WITH_UNPAID_BALANCES",
  "PARENTS_OF_ABSENT_STUDENTS",
  "STAFF_TEACHERS",
  "CUSTOM_SELECTED_CONTACTS",
] as const;
export const communicationContactRoles = ["MOTHER", "FATHER", "GUARDIAN", "PARENT", "EMERGENCY_CONTACT"] as const;

export type CommunicationType = typeof communicationTypes[number];
export type CommunicationChannel = typeof communicationChannels[number];
export type CommunicationAudienceType = typeof communicationAudienceTypes[number];
export type CommunicationContactRole = typeof communicationContactRoles[number];
export type CommunicationDeliveryStatus =
  | "PENDING"
  | "QUEUED"
  | "SUBMITTING"
  | "SUBMITTED"
  | "ACCEPTED"
  | "DELIVERED"
  | "READ"
  | "FAILED"
  | "RETRY_SCHEDULED"
  | "CANCELLED"
  | "SKIPPED";
export type CommunicationCampaignStatus =
  | "DRAFT"
  | "VALIDATING"
  | "VALIDATION_FAILED"
  | "READY_FOR_APPROVAL"
  | "APPROVAL_PENDING"
  | "APPROVED"
  | "SCHEDULED"
  | "QUEUED"
  | "SENDING"
  | "PARTIALLY_DELIVERED"
  | "DELIVERED"
  | "FAILED"
  | "PAUSED"
  | "CANCELLED";

export type ValidationIssue = {
  code: string;
  severity: "WARNING" | "BLOCKING";
  recipientId?: string;
  message: string;
  suggestedAction?: string;
};

export type AudienceDefinition = {
  audienceType?: CommunicationAudienceType;
  classId?: string;
  streamId?: string;
  studentIds?: string[];
  guardianContactIds?: string[];
  staffUserIds?: string[];
  contactRoles?: CommunicationContactRole[];
  includeInactive?: boolean;
  channel?: CommunicationChannel;
  search?: string;
  page?: number;
  pageSize?: number;
  mode?: "GENERAL" | "PER_STUDENT";
};

export type AudienceEligibilityStatus =
  | "ELIGIBLE"
  | "MISSING_PHONE"
  | "MISSING_EMAIL"
  | "INVALID_PHONE"
  | "INVALID_EMAIL"
  | "OPTED_OUT"
  | "BOUNCED"
  | "DUPLICATE_CONTACT"
  | "INACTIVE_STUDENT"
  | "NO_CONTACT"
  | "NOT_IN_SCOPE";

export type AudienceRecipientPreview = {
  id: string;
  source: "guardian" | "staff";
  studentId: string | null;
  studentName: string;
  className: string | null;
  streamName: string | null;
  contactName: string;
  relationship: string | null;
  phone: string | null;
  email: string | null;
  channelAvailability: {
    whatsapp: boolean;
    sms: boolean;
    email: boolean;
  };
  selectedChannel: CommunicationChannel;
  eligibilityStatus: AudienceEligibilityStatus;
  exclusionReason: string | null;
  dedupeKey: string;
  contactRole: CommunicationContactRole | null;
};

export type AudienceResolutionSummary = {
  audienceType: CommunicationAudienceType;
  matchedStudentsCount: number;
  rawContactsCount: number;
  eligibleRecipientsCount: number;
  missingContactsCount: number;
  duplicateContactsRemovedCount: number;
  excludedRecipientsCount: number;
  optedOutRecipientsCount: number;
  bouncedRecipientsCount: number;
  invalidRecipientsCount: number;
  channel: CommunicationChannel;
  page: number;
  pageSize: number;
  totalPages: number;
  totalRecipients: number;
};

export type AudienceResolution = AudienceResolutionSummary & {
  recipients: AudienceRecipientPreview[];
};

export const validCampaignTransitions: Record<CommunicationCampaignStatus, CommunicationCampaignStatus[]> = {
  DRAFT: ["VALIDATING", "CANCELLED"],
  VALIDATING: ["READY_FOR_APPROVAL", "VALIDATION_FAILED", "DRAFT"],
  VALIDATION_FAILED: ["DRAFT", "VALIDATING", "CANCELLED"],
  READY_FOR_APPROVAL: ["APPROVAL_PENDING", "DRAFT", "CANCELLED"],
  APPROVAL_PENDING: ["APPROVED", "READY_FOR_APPROVAL", "CANCELLED"],
  APPROVED: ["QUEUED", "SCHEDULED", "DRAFT", "CANCELLED"],
  SCHEDULED: ["QUEUED", "PAUSED", "CANCELLED"],
  QUEUED: ["SENDING", "PAUSED", "CANCELLED"],
  SENDING: ["PARTIALLY_DELIVERED", "DELIVERED", "FAILED", "PAUSED", "CANCELLED"],
  PARTIALLY_DELIVERED: ["SENDING", "DELIVERED", "FAILED"],
  DELIVERED: [],
  FAILED: ["QUEUED", "CANCELLED"],
  PAUSED: ["QUEUED", "SENDING", "CANCELLED"],
  CANCELLED: [],
};

export function assertCampaignTransition(from: CommunicationCampaignStatus, to: CommunicationCampaignStatus) {
  if (!validCampaignTransitions[from]?.includes(to)) {
    const error = new Error(`Invalid communication campaign transition: ${from} to ${to}`);
    Object.assign(error, { status: 400, expose: true });
    throw error;
  }
}

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

export function normalizePhoneToE164(value: string | null | undefined, defaultCountryCode = "256") {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const digits = trimmed.replace(/[^\d+]/g, "");
  if (/^\+\d{8,15}$/.test(digits)) return digits;
  const local = digits.replace(/\D/g, "");
  if (/^0\d{8,12}$/.test(local)) return `+${defaultCountryCode}${local.slice(1)}`;
  if (/^\d{8,12}$/.test(local)) return `+${defaultCountryCode}${local}`;
  return null;
}

export function estimateSmsSegments(message: string) {
  const gsmBasic = /^[\n\r A-Za-z0-9@£$¥èéùìòÇØøÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ!"#%&'()*+,\-./:;<=>?¡ÄÖÑÜ§¿äöñüà^{}\\[~\]|€]*$/;
  const encoding = gsmBasic.test(message) ? "GSM_7" : "UCS_2";
  const length = message.length;
  const singleLimit = encoding === "GSM_7" ? 160 : 70;
  const multipartLimit = encoding === "GSM_7" ? 153 : 67;
  const segments = length <= singleLimit ? 1 : Math.ceil(length / multipartLimit);
  const warnings = encoding === "UCS_2" ? ["SMS_UCS2_ENCODING"] : [];
  return { encoding, characterCount: length, segments, billableUnits: segments, warnings };
}
