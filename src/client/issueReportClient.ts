const TOKEN_KEY = "sc_auth_token";
const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4300";

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
