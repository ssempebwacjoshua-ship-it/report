const TOKEN_KEY = "sc_auth_token";
import { getApiBaseUrl } from "./apiBase";
const API_BASE = getApiBaseUrl();

function authHeaders(): HeadersInit {
  const token = localStorage.getItem(TOKEN_KEY);
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export type IssueReportRequest = {
  schoolCode: string;
  studentId: string;
  classId: string;
  streamId?: string;
  academicYearId?: string;
  termId?: string;
  assessmentType?: string;
};

export type IssueReportResult = {
  id: string;
  referenceCode: string;
  parentAccessToken: string;
  parentLink: string;
  studentName: string;
  academicYear: string;
  term: string;
  assessmentType: string;
  issuedAt: string;
};

export type BulkIssueRequest = {
  studentIds: string[];
  classId: string;
  streamId?: string;
  academicYearId?: string;
  termId?: string;
  assessmentType?: string;
};

export type BlockedStudent = {
  studentId: string;
  studentName: string;
  admissionNumber: string;
  className: string;
  streamName: string;
  contactReadiness: string;
  contactSummary: string;
};

export type BulkIssueResult = {
  issued: Array<{ studentId: string; studentName: string; referenceCode: string; parentLink: string }>;
  count: number;
};

export class BulkIssueMissingContactError extends Error {
  blockedStudents: BlockedStudent[];
  constructor(message: string, blockedStudents: BlockedStudent[]) {
    super(message);
    this.name = "BulkIssueMissingContactError";
    this.blockedStudents = blockedStudents;
  }
}

export async function bulkIssueReports(body: BulkIssueRequest): Promise<BulkIssueResult> {
  const res = await fetch(`${API_BASE}/api/reports/bulk-issue`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(body),
  });

  const raw = await res.text();
  const data = raw ? (JSON.parse(raw) as BulkIssueResult & { error?: string; code?: string; blockedStudents?: BlockedStudent[] }) : ({} as BulkIssueResult & { error?: string });

  if (!res.ok) {
    if (data.code === "MISSING_CONTACTS" && data.blockedStudents) {
      throw new BulkIssueMissingContactError(data.error ?? "Missing contacts.", data.blockedStudents);
    }
    throw new Error(data.error ?? "Failed to bulk issue reports.");
  }
  return data;
}

export async function issueReport(body: IssueReportRequest): Promise<IssueReportResult> {
  const res = await fetch(`${API_BASE}/api/reports/issue`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(body),
  });

  const raw = await res.text();
  const data = raw ? (JSON.parse(raw) as IssueReportResult & { error?: string }) : ({} as IssueReportResult & { error?: string });
  if (!res.ok) {
    throw new Error(data.error ?? "Failed to issue report.");
  }
  return data;
}

