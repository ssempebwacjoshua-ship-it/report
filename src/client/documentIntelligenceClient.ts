import type {
  SmartDocumentSummary,
  SmartDocumentDetail,
  DocumentVersionSummary,
  ExtractedKnowledge,
  DocumentSchema,
  ComponentNode,
} from "../shared/types/documentIntelligence";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4300";

function authHeaders(token?: string | null): HeadersInit {
  const stored = token ?? localStorage.getItem("sc_auth_token") ?? localStorage.getItem("sp_creator_token");
  return stored ? { Authorization: `Bearer ${stored}`, "Content-Type": "application/json" } : { "Content-Type": "application/json" };
}

async function json<T>(res: Response): Promise<T> {
  const text = await res.text();
  const data = text ? (JSON.parse(text) as T) : ({} as T);
  if (!res.ok) {
    const err = (data as any)?.error ?? `HTTP ${res.status}`;
    throw new Error(err);
  }
  return data;
}

// ── Creator auth (external users) ─────────────────────────────────────────────

export async function creatorSignup(email: string, name: string, password: string) {
  const res = await fetch(`${API_BASE}/api/creator/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, name, password }),
  });
  return json<{ ok: boolean; token: string; creator: { id: string; email: string; name: string; type: string } }>(res);
}

export async function creatorLogin(email: string, password: string) {
  const res = await fetch(`${API_BASE}/api/creator/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  return json<{ ok: boolean; token: string; creator: { id: string; email: string; name: string; type: string } }>(res);
}

// ── Documents ──────────────────────────────────────────────────────────────────

export async function listDocuments(): Promise<SmartDocumentSummary[]> {
  const res = await fetch(`${API_BASE}/api/smart-documents`, { headers: authHeaders() });
  const data = await json<{ ok: boolean; documents: SmartDocumentSummary[] }>(res);
  return data.documents;
}

export async function createDocument(title?: string): Promise<SmartDocumentDetail> {
  const res = await fetch(`${API_BASE}/api/smart-documents`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ title: title ?? "Untitled Document" }),
  });
  const data = await json<{ ok: boolean; document: SmartDocumentDetail }>(res);
  return data.document;
}

export async function getDocument(documentId: string): Promise<SmartDocumentDetail> {
  const res = await fetch(`${API_BASE}/api/smart-documents/${documentId}`, { headers: authHeaders() });
  const data = await json<{ ok: boolean; document: SmartDocumentDetail }>(res);
  return data.document;
}

export async function uploadDocumentFile(
  documentId: string,
  file: File,
): Promise<{ status: "PROCESSING"; sourceFileId: string }> {
  const token = localStorage.getItem("sc_auth_token") ?? localStorage.getItem("sp_creator_token");
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch(`${API_BASE}/api/smart-documents/${documentId}/upload`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  });
  return json<{ ok: boolean; status: "PROCESSING"; sourceFileId: string }>(res);
}

export async function retryDocumentExtraction(documentId: string, sourceFileId?: string): Promise<{ status: "PROCESSING"; sourceFileId: string }> {
  const res = await fetch(`${API_BASE}/api/smart-documents/${documentId}/extraction/retry`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ sourceFileId }),
  });
  return json(res);
}

export async function updateExtractedKnowledge(
  documentId: string,
  knowledge: ExtractedKnowledge,
): Promise<ExtractedKnowledge> {
  const res = await fetch(`${API_BASE}/api/smart-documents/${documentId}/extracted-knowledge`, {
    method: "PATCH",
    headers: authHeaders(),
    body: JSON.stringify({ knowledge }),
  });
  const data = await json<{ ok: boolean; knowledge: ExtractedKnowledge }>(res);
  return data.knowledge;
}

export async function generateSchema(
  documentId: string,
  intent: string,
): Promise<{ versionId: string; schema: DocumentSchema; componentTree: ComponentNode[] }> {
  const res = await fetch(`${API_BASE}/api/smart-documents/${documentId}/generate`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ intent }),
  });
  return json(res);
}

export async function applyPrompt(
  documentId: string,
  instruction: string,
): Promise<{ versionId: string; schema: DocumentSchema; componentTree: ComponentNode[] }> {
  const res = await fetch(`${API_BASE}/api/smart-documents/${documentId}/prompt`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ instruction }),
  });
  return json(res);
}

export async function getVersionHistory(documentId: string): Promise<DocumentVersionSummary[]> {
  const res = await fetch(`${API_BASE}/api/smart-documents/${documentId}/versions`, { headers: authHeaders() });
  const data = await json<{ ok: boolean; versions: DocumentVersionSummary[] }>(res);
  return data.versions;
}

export async function restoreVersion(documentId: string, versionId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/smart-documents/${documentId}/versions/${versionId}/restore`, {
    method: "POST",
    headers: authHeaders(),
  });
  await json(res);
}

export async function publishDocument(
  documentId: string,
  options: { expiresInDays?: number; password?: string } = {},
): Promise<{ token: string; url: string }> {
  const res = await fetch(`${API_BASE}/api/smart-documents/${documentId}/publish`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(options),
  });
  return json(res);
}

export async function openPrintWindow(documentId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/smart-documents/${documentId}/print`, { headers: authHeaders() });
  if (!res.ok) throw new Error(`Print failed: ${res.status}`);
  const html = await res.text();
  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const win = window.open(url, "_blank");
  if (win) {
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
  }
}

export async function getPublishedDocument(
  token: string,
  password?: string,
): Promise<{ document: SmartDocumentDetail; publishedAt: string }> {
  const url = new URL(`${API_BASE}/api/smart-documents/p/${token}`);
  if (password) url.searchParams.set("password", password);
  const res = await fetch(url.toString());
  if (!res.ok) {
    const data = await res.json() as { error?: string; code?: string };
    if (data.code === "PASSWORD_REQUIRED" || data.code === "WRONG_PASSWORD") {
      throw Object.assign(new Error(data.error ?? "Auth failed"), { code: data.code });
    }
    throw new Error(data.error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<{ document: SmartDocumentDetail; publishedAt: string }>;
}
