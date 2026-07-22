import { getApiBaseUrl, makeRequestHeaders, parseApiError } from "../../../client/apiBase";

const API_BASE = getApiBaseUrl();

export type ResolvedContact = {
  guardianName: string;
  method: "WHATSAPP" | "SMS" | "EMAIL";
  contactValue: string;
} | null;

export type DeliveryStatus =
  | "NOT_FINALIZED"
  | "MISSING_CONTACT"
  | "NOT_ISSUED"
  | "LINK_GENERATED"
  | "READY_TO_SEND"
  | "SENT_MANUALLY"
  | "OPENED"
  | "DOWNLOADED"
  | "REVOKED"
  | "SUPERSEDED";

export type ReleaseRow = {
  studentId: string;
  admissionNumber: string;
  studentName: string;
  reportReadiness: string;
  primaryContact: ResolvedContact;
  isExpired?: boolean;
  parentLink?: string | null;
  issuedReport: {
    id: string;
    referenceCode: string;
    publicShortCode?: string | null;
    status: "ISSUED" | "REVOKED" | "SUPERSEDED";
    issuedAt: string;
    expiresAt: string | null;
    issuedByName: string | null;
    viewedAt: string | null;
    lastViewedAt: string | null;
    openCount: number;
    downloadedAt: string | null;
    lastDownloadedAt: string | null;
    downloadCount: number;
    sentAt: string | null;
    revokedAt: string | null;
    revokeReason: string | null;
  } | null;
  deliveryStatus: DeliveryStatus;
};

export type ReleaseSummary = {
  total: number;
  finalized: number;
  linksGenerated: number;
  missingContacts: number;
  readyToSend: number;
  sentManually: number;
  opened: number;
  downloaded: number;
  expired: number;
  needsAttention: number;
};

export type ReleaseStatusResponse = {
  rows: ReleaseRow[];
  summary: ReleaseSummary;
  meta: { academicYear: string; term: string; assessmentType: string; schoolName: string };
};

export type ReleaseFilters = {
  schoolCode?: string;
  classId: string;
  streamId?: string;
  academicYearId?: string;
  termId?: string;
  assessmentType?: string;
  search?: string;
};

export async function fetchReleaseStatus(filters: ReleaseFilters): Promise<ReleaseStatusResponse> {
  const params = new URLSearchParams();
  params.set("classId", filters.classId);
  if (filters.schoolCode) params.set("schoolCode", filters.schoolCode);
  if (filters.streamId) params.set("streamId", filters.streamId);
  if (filters.academicYearId) params.set("academicYearId", filters.academicYearId);
  if (filters.termId) params.set("termId", filters.termId);
  if (filters.assessmentType) params.set("assessmentType", filters.assessmentType);
  if (filters.search) params.set("search", filters.search);
  const res = await fetch(`${API_BASE}/api/reports/release-status?${params}`, {
    headers: makeRequestHeaders(),
  });
  if (!res.ok) throw new Error(await parseApiError(res, "Could not load release status"));
  return res.json() as Promise<ReleaseStatusResponse>;
}

export type IssuedLinkData = {
  studentId: string;
  studentName: string;
  referenceCode: string;
  publicShortCode: string;
  parentLink: string;
  parentAccessToken: string | null;
  issuedReportId: string;
};

export type BulkIssueResponse = {
  issued: IssuedLinkData[];
  skipped: Array<{ studentId: string; studentName: string; reason: string }>;
};

export async function issueBulk(body: {
  schoolCode?: string;
  classId: string;
  streamId?: string;
  academicYearId?: string;
  termId?: string;
  assessmentType?: string;
  studentIds?: string[];
}): Promise<BulkIssueResponse> {
  const res = await fetch(`${API_BASE}/api/reports/issue-bulk`, {
    method: "POST",
    headers: makeRequestHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await parseApiError(res, "Could not issue report links"));
  return res.json() as Promise<BulkIssueResponse>;
}

export type BulkReleaseResult = {
  updated: number;
  skipped: Array<{ studentId: string; studentName: string; reason: string }>;
};

export type ReportReleaseSendPreview = {
  totalSelected: number;
  issuableLinks: number;
  missingContacts: number;
  alreadySent: number;
  estimatedSmsSegments: number;
  estimatedSmsCredits: number;
  emailRecipients?: number;
};

export type ReportReleaseSendResult = {
  preview: ReportReleaseSendPreview;
  submitted: number;
  failed: number;
  skippedDuplicate: number;
  missingContact: number;
  alreadySent: number;
  skipped: Array<{ studentId: string; studentName: string; reason: string }>;
};

export type ReleaseCommunicationInput = {
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

export type ReleaseCommunicationPreview = {
  channel: "SMS" | "WHATSAPP";
  channelAvailable: boolean;
  unavailableReason: string | null;
  batchLabel: string;
  introduction: string;
  reportLinksPlaceholder: "{{reportLinksText}}";
  messageTemplate: string;
  selectedStudents: Array<{
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
  }>;
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
  source: {
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
};

export async function markSent(issuedReportId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/reports/release/${issuedReportId}/mark-sent`, {
    method: "POST",
    headers: makeRequestHeaders(),
  });
  if (!res.ok) throw new Error(await parseApiError(res, "Could not mark report as sent"));
}

export async function revokeIssuedReport(issuedReportId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/reports/release/${issuedReportId}/revoke`, {
    method: "POST",
    headers: makeRequestHeaders(),
  });
  if (!res.ok) throw new Error(await parseApiError(res, "Could not revoke report"));
}

export async function markSentBulk(body: { studentIds: string[]; classId: string; schoolCode?: string }): Promise<BulkReleaseResult> {
  const res = await fetch(`${API_BASE}/api/reports/release/mark-sent-bulk`, {
    method: "POST",
    headers: makeRequestHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await parseApiError(res, "Could not mark reports as sent"));
  return res.json() as Promise<BulkReleaseResult>;
}

export async function revokeBulk(body: { studentIds: string[]; classId: string; schoolCode?: string }): Promise<BulkReleaseResult> {
  const res = await fetch(`${API_BASE}/api/reports/release/revoke-bulk`, {
    method: "POST",
    headers: makeRequestHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await parseApiError(res, "Could not revoke reports"));
  return res.json() as Promise<BulkReleaseResult>;
}

export async function sendReportReleasesBulk(body: {
  studentIds: string[];
  classId: string;
  schoolCode?: string;
  channel: "SMS" | "EMAIL";
  previewOnly?: boolean;
  confirm?: boolean;
}): Promise<ReportReleaseSendResult> {
  const res = await fetch(`${API_BASE}/api/reports/release/send-bulk`, {
    method: "POST",
    headers: makeRequestHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await parseApiError(res, "Could not send report links"));
  return res.json() as Promise<ReportReleaseSendResult>;
}

export async function previewReleaseCommunication(body: ReleaseCommunicationInput): Promise<{ preview: ReleaseCommunicationPreview }> {
  const res = await fetch(`${API_BASE}/api/reports/release/communications/preview`, {
    method: "POST",
    headers: makeRequestHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await parseApiError(res, "Could not preview report communication"));
  return res.json() as Promise<{ preview: ReleaseCommunicationPreview }>;
}

export async function createOrReopenReleaseCommunication(body: ReleaseCommunicationInput): Promise<{
  reopened: boolean;
  duplicate: boolean;
  campaign: { id: string; title: string; status: string; version: number };
  progress: { QUEUED: number; PROCESSING: number; SENT: number; DELIVERED: number; FAILED: number };
  preview: ReleaseCommunicationPreview;
}> {
  const res = await fetch(`${API_BASE}/api/reports/release/communications`, {
    method: "POST",
    headers: makeRequestHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await parseApiError(res, "Could not create report communication"));
  return res.json();
}
