import type { PrismaClient } from "@prisma/client";
import { estimateSmsSegments, normalizePhoneToE164, type CommunicationChannel } from "../../../../shared/communications";
import { getPublicAppUrl } from "../../../../server/config/publicUrl";
import { loadReportEngineInput } from "../../../../server/repositories/reportsRepository";
import { getSettingsSections } from "../../../../server/repositories/settingsRepository";
import { buildReports } from "../../../../server/services/reportEngine";
import { buildReportLinkToken, buildReportVersionSignature, isReportLinkExpired, sha256Hex } from "./reportLinkService";

type Db = PrismaClient;

export type ReleaseCenterCommunicationContext = {
  schoolId: string;
  schoolCode?: string;
  schoolName: string;
  actorId?: string;
  actorName?: string;
};

export type ReleaseCenterCommunicationInput = {
  classId: string;
  streamId?: string;
  academicYearId?: string;
  termId?: string;
  assessmentType: "BOT" | "MOT" | "EOT" | "TERM_SUMMARY";
  studentIds?: string[];
  introduction: string;
  channel: "SMS" | "WHATSAPP";
  forceNewVersion?: boolean;
};

export type ReleaseCenterCommunicationSource = {
  type: "RELEASE_CENTRE";
  batchId: string;
  sourceKey: string;
  version: number;
  classId: string;
  streamId: string | null;
  academicYearId: string | null;
  termId: string | null;
  academicYearName: string;
  termName: string;
  assessmentType: string;
  selectedStudentIds: string[];
  selectedIssuedReportIds: string[];
  selectedCount: number;
  channel: "SMS" | "WHATSAPP";
  createdFrom: "release-centre";
};

export type PreparedCampaignRecipient = {
  guardianId: string | null;
  studentId: string | null;
  displayName: string;
  relationship: string | null;
  phoneE164: string | null;
  email: string | null;
  preferredChannel: CommunicationChannel;
  status: "READY" | "BLOCKED" | "EXCLUDED";
  blockedReasonCode: string | null;
  warningCodesJson: unknown;
  personalisationJson: Record<string, unknown>;
};

type ReleaseStudentPreview = {
  studentId: string;
  studentName: string;
  issuedReportId: string | null;
  guardianName: string | null;
  phoneE164: string | null;
  eligibilityStatus:
    | "ELIGIBLE"
    | "NOT_RELEASED"
    | "WITHDRAWN"
    | "SUPERSEDED"
    | "EXPIRED"
    | "MISSING_CONTACT"
    | "INVALID_PHONE"
    | "DUPLICATE_GUARDIAN_NUMBER";
  exclusionReason: string | null;
};

export type ReleaseCenterCommunicationPreview = {
  channel: "SMS" | "WHATSAPP";
  channelAvailable: boolean;
  unavailableReason: string | null;
  batchLabel: string;
  introduction: string;
  reportLinksPlaceholder: "{{reportLinksText}}";
  messageTemplate: string;
  selectedStudents: ReleaseStudentPreview[];
  recipients: Array<{
    phoneE164: string;
    guardianName: string;
    studentNames: string[];
    reportLinkCount: number;
    segmentCount: number;
  }>;
  counts: {
    selectedStudents: number;
    validParentNumbers: number;
    missingContacts: number;
    invalidNumbers: number;
    duplicateGuardianNumbers: number;
    excludedStudents: number;
    smsSegments: number;
    estimatedCostMinor: number | null;
    estimatedCostCurrency: string | null;
    eligibleRecipients: number;
  };
  estimatedCostNote: string;
  existingCampaign: {
    id: string;
    title: string;
    status: string;
    version: number;
  } | null;
  source: ReleaseCenterCommunicationSource;
  preparedRecipients: PreparedCampaignRecipient[];
};

type ActiveIssuedReportRow = {
  id: string;
  studentId: string;
  academicYear: string;
  term: string;
  assessmentType: string;
  status: string;
  referenceCode: string;
  expiresAt: Date | null;
  reportSnapshotJson: unknown;
};

type GuardianContactRow = {
  id: string;
  studentId: string;
  guardianName: string;
  relationship: string;
  phone: string | null;
  preferredContactMethod: string;
  isPrimary: boolean;
  canReceiveReports: boolean;
};

const REPORT_LINKS_PLACEHOLDER = "{{reportLinksText}}" as const;
const DEFAULT_COUNTRY_CODE = process.env.COMMUNICATION_DEFAULT_COUNTRY_CODE?.trim() || "256";

function normalizeText(value: string) {
  return value.trim().replace(/\r\n/g, "\n");
}

function buildReleaseBatchId(input: {
  schoolId: string;
  classId: string;
  streamId?: string;
  academicYearId?: string;
  termId?: string;
  assessmentType: string;
}) {
  return sha256Hex([
    input.schoolId,
    input.classId,
    input.streamId ?? "all-streams",
    input.academicYearId ?? "active-year",
    input.termId ?? "active-term",
    input.assessmentType,
  ].join("|"));
}

function buildSourceKey(input: { batchId: string; channel: string; selectedIssuedReportIds: string[] }) {
  return sha256Hex([
    input.batchId,
    input.channel,
    ...[...input.selectedIssuedReportIds].sort(),
  ].join("|"));
}

function buildDefaultIntroduction(input: {
  schoolName: string;
  termName: string;
  assessmentType: string;
}) {
  const schoolName = input.schoolName.trim() || "the school";
  const termName = input.termName.trim() || "this term";
  return `${termName} ${input.assessmentType} reports from ${schoolName} are ready.`;
}

function buildMessageTemplate(introduction: string) {
  return `Dear Parent,\n\n${normalizeText(introduction)}\n\n${REPORT_LINKS_PLACEHOLDER}`;
}

function normalizePreferredContact(contacts: GuardianContactRow[]) {
  const eligible = contacts.filter((contact) => contact.canReceiveReports);
  const ordered = [...eligible].sort((left, right) => {
    if (left.isPrimary !== right.isPrimary) return left.isPrimary ? -1 : 1;
    const leftSms = left.preferredContactMethod === "SMS" || left.preferredContactMethod === "WHATSAPP";
    const rightSms = right.preferredContactMethod === "SMS" || right.preferredContactMethod === "WHATSAPP";
    if (leftSms !== rightSms) return leftSms ? -1 : 1;
    return left.guardianName.localeCompare(right.guardianName);
  });
  return ordered[0] ?? null;
}

function buildActiveLink(ctx: ReleaseCenterCommunicationContext, issued: ActiveIssuedReportRow) {
  const snapshotSignature = buildReportVersionSignature(issued.reportSnapshotJson);
  const rawToken = buildReportLinkToken({
    reportId: issued.id,
    snapshotSignature,
    schoolId: ctx.schoolId,
    studentId: issued.studentId,
    academicYear: issued.academicYear,
    term: issued.term,
    assessmentType: issued.assessmentType,
  });
  return `${getPublicAppUrl()}/parent/r/${rawToken}`;
}

async function estimateSmsCost(db: Db, schoolId: string, estimatedBillableUnits: number) {
  if (estimatedBillableUnits <= 0) {
    return {
      amountMinor: 0,
      currency: "UGX",
      note: "No billable SMS segments are expected.",
    };
  }

  const channelSetting = await db.communicationChannelSetting.findFirst({
    where: { schoolId, channel: "SMS" as never },
    orderBy: { updatedAt: "desc" },
  });
  const metadata = (channelSetting?.providerMetadataJson ?? null) as Record<string, unknown> | null;
  const costValue = [
    metadata?.estimatedCostPerSegmentMinor,
    metadata?.segmentCostMinor,
    metadata?.costPerSegmentMinor,
  ].find((value) => typeof value === "number" || typeof value === "string");
  const parsedCost = typeof costValue === "number"
    ? Math.round(costValue)
    : typeof costValue === "string" && costValue.trim()
      ? Math.round(Number(costValue))
      : null;
  const currency = typeof metadata?.estimatedCostCurrency === "string"
    ? metadata.estimatedCostCurrency
    : typeof metadata?.currency === "string"
      ? metadata.currency
      : "UGX";

  if (!Number.isFinite(parsedCost as number)) {
    return {
      amountMinor: null,
      currency,
      note: `Estimated ${estimatedBillableUnits} SMS segment${estimatedBillableUnits === 1 ? "" : "s"}; provider pricing metadata is not configured.`,
    };
  }

  return {
    amountMinor: (parsedCost as number) * estimatedBillableUnits,
    currency,
    note: `Estimated from ${estimatedBillableUnits} SMS segment${estimatedBillableUnits === 1 ? "" : "s"} at ${parsedCost} ${currency} each.`,
  };
}

function parseReleaseSource(metadata: unknown): ReleaseCenterCommunicationSource | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const source = (metadata as Record<string, unknown>).source;
  if (!source || typeof source !== "object" || Array.isArray(source)) return null;
  const record = source as Record<string, unknown>;
  if (record.type !== "RELEASE_CENTRE") return null;
  if (typeof record.batchId !== "string" || typeof record.sourceKey !== "string") return null;
  return {
    type: "RELEASE_CENTRE",
    batchId: record.batchId,
    sourceKey: record.sourceKey,
    version: typeof record.version === "number" ? record.version : 1,
    classId: String(record.classId ?? ""),
    streamId: record.streamId == null ? null : String(record.streamId),
    academicYearId: record.academicYearId == null ? null : String(record.academicYearId),
    termId: record.termId == null ? null : String(record.termId),
    academicYearName: String(record.academicYearName ?? ""),
    termName: String(record.termName ?? ""),
    assessmentType: String(record.assessmentType ?? ""),
    selectedStudentIds: Array.isArray(record.selectedStudentIds) ? record.selectedStudentIds.map(String) : [],
    selectedIssuedReportIds: Array.isArray(record.selectedIssuedReportIds) ? record.selectedIssuedReportIds.map(String) : [],
    selectedCount: typeof record.selectedCount === "number" ? record.selectedCount : 0,
    channel: record.channel === "WHATSAPP" ? "WHATSAPP" : "SMS",
    createdFrom: "release-centre",
  };
}

async function findExistingCampaign(db: Db, ctx: ReleaseCenterCommunicationContext, sourceKey: string) {
  const campaigns = await db.communicationCampaign.findMany({
    where: {
      schoolId: ctx.schoolId,
      type: "REPORT_RELEASE" as never,
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return campaigns.find((campaign) => parseReleaseSource(campaign.metadataJson)?.sourceKey === sourceKey) ?? null;
}

async function ensureSchoolContext(db: Db, ctx: ReleaseCenterCommunicationContext) {
  if (ctx.schoolCode?.trim()) {
    return {
      schoolCode: ctx.schoolCode.trim(),
      schoolName: ctx.schoolName,
    };
  }
  const school = await db.school.findUnique({
    where: { id: ctx.schoolId },
    select: { code: true, name: true },
  });
  if (!school) {
    throw Object.assign(new Error("School not found."), { status: 404, expose: true });
  }
  return {
    schoolCode: school.code,
    schoolName: ctx.schoolName || school.name,
  };
}

export function isReleaseCenterCampaignMetadata(metadata: unknown) {
  return parseReleaseSource(metadata) !== null;
}

export async function prepareReleaseCenterCommunicationPreview(
  db: Db,
  ctx: ReleaseCenterCommunicationContext,
  input: ReleaseCenterCommunicationInput,
): Promise<ReleaseCenterCommunicationPreview> {
  const school = await ensureSchoolContext(db, ctx);
  const introduction = normalizeText(input.introduction || buildDefaultIntroduction({
    schoolName: school.schoolName,
    termName: "Current",
    assessmentType: input.assessmentType,
  }));

  const settings = await getSettingsSections(db, school.schoolCode);
  const filters = {
    schoolCode: school.schoolCode,
    classId: input.classId,
    streamId: input.streamId,
    academicYearId: input.academicYearId,
    termId: input.termId,
    assessmentType: input.assessmentType ?? settings.academic.defaultAssessmentType,
  };
  const engineInput = await loadReportEngineInput(db, filters);
  const reportResult = buildReports(engineInput);

  const allCards = input.studentIds?.length
    ? reportResult.cards.filter((card) => input.studentIds!.includes(card.studentId))
    : reportResult.cards;
  const selectedStudents = engineInput.students.filter((student) => allCards.some((card) => card.studentId === student.id));
  const studentIds = selectedStudents.map((student) => student.id);

  const allContacts = await db.guardianContact.findMany({
    where: { studentId: { in: studentIds }, canReceiveReports: true },
    orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
  });
  const contactsByStudent = new Map<string, GuardianContactRow[]>();
  for (const contact of allContacts) {
    const list = contactsByStudent.get(contact.studentId) ?? [];
    list.push(contact as GuardianContactRow);
    contactsByStudent.set(contact.studentId, list);
  }

  const issuedReports = await db.issuedReport.findMany({
    where: {
      schoolId: ctx.schoolId,
      studentId: { in: studentIds },
      academicYear: engineInput.academicYearName,
      term: engineInput.termName,
      assessmentType: filters.assessmentType,
    },
    orderBy: { issuedAt: "desc" },
  });
  const issuedByStudent = new Map<string, ActiveIssuedReportRow>();
  for (const issued of issuedReports) {
    const existing = issuedByStudent.get(issued.studentId);
    if (!existing || (issued.status === "ISSUED" && existing.status !== "ISSUED")) {
      issuedByStudent.set(issued.studentId, issued as ActiveIssuedReportRow);
    }
  }

  const selectedPreview: ReleaseStudentPreview[] = [];
  const recipientBuckets = new Map<string, {
    phoneE164: string;
    guardianName: string;
    studentNames: string[];
    reportLinksText: string[];
    reportLinkCount: number;
    segmentCount: number;
    guardianId: string | null;
    preferredChannel: CommunicationChannel;
  }>();
  const selectedIssuedReportIds: string[] = [];

  let missingContacts = 0;
  let invalidNumbers = 0;
  let duplicateGuardianNumbers = 0;
  let excludedStudents = 0;

  for (const card of allCards) {
    const student = selectedStudents.find((item) => item.id === card.studentId);
    if (!student) continue;
    const issued = issuedByStudent.get(card.studentId) ?? null;
    const preferredContact = normalizePreferredContact(contactsByStudent.get(card.studentId) ?? []);

    let eligibilityStatus: ReleaseStudentPreview["eligibilityStatus"] = "ELIGIBLE";
    let exclusionReason: string | null = null;
    if (!issued) {
      eligibilityStatus = "NOT_RELEASED";
      exclusionReason = "A released report link has not been generated yet.";
    } else if (issued.status === "SUPERSEDED") {
      eligibilityStatus = "SUPERSEDED";
      exclusionReason = "The current report link has been superseded.";
    } else if (issued.status !== "ISSUED") {
      eligibilityStatus = "WITHDRAWN";
      exclusionReason = "The current report link is no longer active.";
    } else if (isReportLinkExpired(issued.expiresAt)) {
      eligibilityStatus = "EXPIRED";
      exclusionReason = "The current report link has expired.";
    } else if (!preferredContact?.phone) {
      eligibilityStatus = "MISSING_CONTACT";
      exclusionReason = "No SMS-capable guardian contact is available.";
    }

    const normalizedPhone = preferredContact?.phone
      ? normalizePhoneToE164(preferredContact.phone, DEFAULT_COUNTRY_CODE)
      : null;

    if (eligibilityStatus === "ELIGIBLE" && !normalizedPhone) {
      eligibilityStatus = "INVALID_PHONE";
      exclusionReason = "The guardian phone number is invalid.";
    }

    selectedPreview.push({
      studentId: student.id,
      studentName: student.studentName,
      issuedReportId: issued?.id ?? null,
      guardianName: preferredContact?.guardianName ?? null,
      phoneE164: normalizedPhone,
      eligibilityStatus,
      exclusionReason,
    });

    if (eligibilityStatus !== "ELIGIBLE" || !issued || !normalizedPhone) {
      if (eligibilityStatus === "MISSING_CONTACT") missingContacts += 1;
      if (eligibilityStatus === "INVALID_PHONE") invalidNumbers += 1;
      excludedStudents += 1;
      continue;
    }

    const reportLink = buildActiveLink(ctx, issued);
    const reportLinkLine = `${student.studentName}: ${reportLink}`;
    const existingBucket = recipientBuckets.get(normalizedPhone);
    if (existingBucket) {
      existingBucket.studentNames.push(student.studentName);
      existingBucket.reportLinksText.push(reportLinkLine);
      existingBucket.reportLinkCount += 1;
      duplicateGuardianNumbers += 1;
      selectedIssuedReportIds.push(issued.id);
      continue;
    }

    recipientBuckets.set(normalizedPhone, {
      phoneE164: normalizedPhone,
      guardianName: preferredContact?.guardianName ?? student.studentName,
      studentNames: [student.studentName],
      reportLinksText: [reportLinkLine],
      reportLinkCount: 1,
      segmentCount: 0,
      guardianId: preferredContact?.id ?? null,
      preferredChannel: "SMS",
    });
    selectedIssuedReportIds.push(issued.id);
  }

  const messageTemplate = buildMessageTemplate(introduction);
  let smsSegments = 0;
  const recipients = [...recipientBuckets.values()].map((recipient) => {
    const reportLinksText = recipient.reportLinksText.join("\n");
    const renderedMessage = messageTemplate.replace(REPORT_LINKS_PLACEHOLDER, reportLinksText);
    const segmentCount = estimateSmsSegments(renderedMessage).billableUnits;
    recipient.segmentCount = segmentCount;
    smsSegments += segmentCount;
    return {
      phoneE164: recipient.phoneE164,
      guardianName: recipient.guardianName,
      studentNames: recipient.studentNames,
      reportLinkCount: recipient.reportLinkCount,
      segmentCount,
    };
  });

  const source: ReleaseCenterCommunicationSource = {
    type: "RELEASE_CENTRE",
    batchId: buildReleaseBatchId({
      schoolId: ctx.schoolId,
      classId: filters.classId,
      streamId: filters.streamId,
      academicYearId: filters.academicYearId,
      termId: filters.termId,
      assessmentType: filters.assessmentType,
    }),
    sourceKey: "",
    version: 1,
    classId: filters.classId,
    streamId: filters.streamId ?? null,
    academicYearId: filters.academicYearId ?? null,
    termId: filters.termId ?? null,
    academicYearName: engineInput.academicYearName,
    termName: engineInput.termName,
    assessmentType: filters.assessmentType,
    selectedStudentIds: selectedPreview.map((student) => student.studentId),
    selectedIssuedReportIds: [...new Set(selectedIssuedReportIds)],
    selectedCount: selectedPreview.length,
    channel: input.channel,
    createdFrom: "release-centre",
  };
  source.sourceKey = buildSourceKey({
    batchId: source.batchId,
    channel: source.channel,
    selectedIssuedReportIds: source.selectedIssuedReportIds,
  });

  const existingCampaign = await findExistingCampaign(db, ctx, source.sourceKey);
  const estimatedCost = await estimateSmsCost(db, ctx.schoolId, smsSegments);

  return {
    channel: input.channel,
    channelAvailable: input.channel === "SMS",
    unavailableReason: input.channel === "SMS" ? null : "WhatsApp sending is not enabled in the school-facing UI.",
    batchLabel: `${engineInput.termName} ${filters.assessmentType} reports`,
    introduction,
    reportLinksPlaceholder: REPORT_LINKS_PLACEHOLDER,
    messageTemplate,
    selectedStudents: selectedPreview,
    recipients,
    counts: {
      selectedStudents: selectedPreview.length,
      validParentNumbers: recipients.length,
      missingContacts,
      invalidNumbers,
      duplicateGuardianNumbers,
      excludedStudents,
      smsSegments,
      estimatedCostMinor: estimatedCost.amountMinor,
      estimatedCostCurrency: estimatedCost.currency,
      eligibleRecipients: recipients.length,
    },
    estimatedCostNote: estimatedCost.note,
    existingCampaign: existingCampaign
      ? {
          id: existingCampaign.id,
          title: existingCampaign.title,
          status: existingCampaign.status,
          version: parseReleaseSource(existingCampaign.metadataJson)?.version ?? 1,
        }
      : null,
    source,
    preparedRecipients: [...recipientBuckets.values()].map((recipient) => ({
      guardianId: recipient.guardianId,
      studentId: null,
      displayName: recipient.guardianName,
      relationship: "Parent",
      phoneE164: recipient.phoneE164,
      email: null,
      preferredChannel: recipient.preferredChannel,
      status: "READY",
      blockedReasonCode: null,
      warningCodesJson: [],
      personalisationJson: {
        guardianName: recipient.guardianName,
        studentName: recipient.studentNames.join(", "),
        className: null,
        streamName: null,
        contactRole: "PARENT",
        reportLinksText: recipient.reportLinksText.join("\n"),
      },
    })),
  };
}
