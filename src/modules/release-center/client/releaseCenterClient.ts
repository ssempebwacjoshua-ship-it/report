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
