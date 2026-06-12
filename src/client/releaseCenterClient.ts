const TOKEN_KEY = "sc_auth_token";
const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4300";

function authHeaders(): HeadersInit {
  const token = localStorage.getItem(TOKEN_KEY);
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function apiJson<T>(res: Response): Promise<T> {
  const raw = await res.text();
  const data = raw ? (JSON.parse(raw) as T & { error?: string }) : ({} as T & { error?: string });
  if (!res.ok) {
    throw new Error((data as { error?: string }).error ?? `Request failed (${res.status})`);
  }
  return data;
}

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
  issuedReport: {
    id: string;
    referenceCode: string;
    status: "ISSUED" | "REVOKED" | "SUPERSEDED";
    issuedAt: string;
    issuedByName: string | null;
    viewedAt: string | null;
    downloadedAt: string | null;
    sentAt: string | null;
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
    headers: authHeaders(),
  });
  return apiJson<ReleaseStatusResponse>(res);
}

export type IssuedLinkData = {
  studentId: string;
  studentName: string;
  referenceCode: string;
  parentLink: string;
  parentAccessToken: string;
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
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(body),
  });
  return apiJson<BulkIssueResponse>(res);
}

export async function markSent(issuedReportId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/reports/release/${issuedReportId}/mark-sent`, {
    method: "POST",
    headers: authHeaders(),
  });
  await apiJson<unknown>(res);
}

export async function revokeIssuedReport(issuedReportId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/reports/release/${issuedReportId}/revoke`, {
    method: "POST",
    headers: authHeaders(),
  });
  await apiJson<unknown>(res);
}
