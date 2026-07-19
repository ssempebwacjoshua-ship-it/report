import type {
  SmartDocumentSummary,
  SmartDocumentDetail,
  SmartDocumentVertical,
  DocumentVersionSummary,
  ExtractedKnowledge,
  DocumentSchema,
  ComponentNode,
} from "../shared/types/documentIntelligence";
import type { AiEditResponse } from "../shared/documentPatch";
import { getApiBaseUrl, parseApiError } from "./apiBase";

const API_BASE = getApiBaseUrl();

function buildHeaders(token: string | null | undefined): HeadersInit {
  return token ? { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } : { "Content-Type": "application/json" };
}

// School pages must use sc_auth_token only.
function schoolAuthHeaders(): HeadersInit {
  return buildHeaders(localStorage.getItem("sc_auth_token"));
}

// Lawyer pages must use sp_creator_token only (never sc_auth_token).
function lawyerAuthHeaders(): HeadersInit {
  return buildHeaders(localStorage.getItem("sp_creator_token"));
}

// Shared operations (public or vertical-agnostic) may fall back across both.
function authHeaders(): HeadersInit {
  return buildHeaders(localStorage.getItem("sc_auth_token") ?? localStorage.getItem("sp_creator_token"));
}

type AuthMode = "school" | "creator";

// Resolve auth headers from explicit authMode, then vertical, then fallback.
// authMode always wins: "school" → sc_auth_token only; "creator" → sp_creator_token only.
function resolveAuthHeaders(options?: { authMode?: AuthMode; vertical?: SmartDocumentVertical }): HeadersInit {
  if (options?.authMode === "school") return schoolAuthHeaders();
  if (options?.authMode === "creator") return lawyerAuthHeaders();
  if (options?.vertical === "SCHOOL") return schoolAuthHeaders();
  if (options?.vertical === "LAWYER") return lawyerAuthHeaders();
  return authHeaders();
}

function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.rel = "noreferrer";
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function filenameFromDisposition(disposition: string | null, fallback: string): string {
  if (!disposition) return fallback;
  const match = /filename\*?=(?:UTF-8''|")?([^";]+)"?/i.exec(disposition);
  if (!match?.[1]) return fallback;
  try {
    return decodeURIComponent(match[1].replace(/%22/g, ""));
  } catch {
    return match[1];
  }
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

// -- Creator auth (external users) ---------------------------------------------

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

// -- Documents ------------------------------------------------------------------

export async function listDocuments(options?: { vertical?: SmartDocumentVertical; authMode?: AuthMode }): Promise<SmartDocumentSummary[]> {
  const url = new URL(`${API_BASE}/api/smart-documents`);
  if (options?.vertical) url.searchParams.set("vertical", options.vertical);
  const res = await fetch(url.toString(), { headers: resolveAuthHeaders(options) });
  const data = await json<{ ok: boolean; documents: SmartDocumentSummary[] }>(res);
  return data.documents;
}

export async function createDocument(title?: string, options?: { vertical?: SmartDocumentVertical; authMode?: AuthMode }): Promise<SmartDocumentDetail> {
  const res = await fetch(`${API_BASE}/api/smart-documents`, {
    method: "POST",
    headers: resolveAuthHeaders(options),
    body: JSON.stringify({ title: title ?? "Untitled Document", vertical: options?.vertical ?? "SCHOOL" }),
  });
  const data = await json<{ ok: boolean; document: SmartDocumentDetail }>(res);
  return data.document;
}

export async function getDocument(documentId: string, options?: { authMode?: AuthMode }): Promise<SmartDocumentDetail> {
  const res = await fetch(`${API_BASE}/api/smart-documents/${documentId}`, { headers: resolveAuthHeaders(options) });
  const data = await json<{ ok: boolean; document: SmartDocumentDetail }>(res);
  return data.document;
}

export async function uploadDocumentFile(
  documentId: string,
  file: File,
  options?: { authMode?: AuthMode },
): Promise<{ status: "PROCESSING"; sourceFileId: string }> {
  // Upload is school-only (OCR flow); default to school auth.
  const effectiveMode = options?.authMode ?? "school";
  const token = effectiveMode === "school"
    ? localStorage.getItem("sc_auth_token")
    : localStorage.getItem("sp_creator_token");
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch(`${API_BASE}/api/smart-documents/${documentId}/upload`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  });
  return json<{ ok: boolean; status: "PROCESSING"; sourceFileId: string }>(res);
}

export async function retryDocumentExtraction(
  documentId: string,
  sourceFileId?: string,
  options: { highAccuracy?: boolean; authMode?: AuthMode } = {},
): Promise<{ status: "PROCESSING"; sourceFileId: string }> {
  const res = await fetch(`${API_BASE}/api/smart-documents/${documentId}/extraction/retry`, {
    method: "POST",
    headers: resolveAuthHeaders(options),
    body: JSON.stringify({ sourceFileId, highAccuracy: options.highAccuracy ?? false }),
  });
  return json(res);
}

export async function updateExtractedKnowledge(
  documentId: string,
  knowledge: ExtractedKnowledge,
  options?: { authMode?: AuthMode },
): Promise<ExtractedKnowledge> {
  const res = await fetch(`${API_BASE}/api/smart-documents/${documentId}/extracted-knowledge`, {
    method: "PATCH",
    headers: resolveAuthHeaders(options),
    body: JSON.stringify({ knowledge }),
  });
  const data = await json<{ ok: boolean; knowledge: ExtractedKnowledge }>(res);
  return data.knowledge;
}

export async function generateSchema(
  documentId: string,
  intent: string,
  templateId?: string,
  options?: { authMode?: AuthMode },
): Promise<{ versionId: string; schema: DocumentSchema; componentTree: ComponentNode[] }> {
  const res = await fetch(`${API_BASE}/api/smart-documents/${documentId}/generate`, {
    method: "POST",
    headers: resolveAuthHeaders(options),
    body: JSON.stringify({ intent, templateId }),
  });
  return json(res);
}

export async function applyPrompt(
  documentId: string,
  instruction: string,
  options?: { authMode?: AuthMode },
): Promise<{ versionId: string; schema: DocumentSchema; componentTree: ComponentNode[] }> {
  const res = await fetch(`${API_BASE}/api/smart-documents/${documentId}/prompt`, {
    method: "POST",
    headers: resolveAuthHeaders(options),
    body: JSON.stringify({ instruction }),
  });
  return json(res);
}

export async function createManualDocumentVersion(
  documentId: string,
  content: { draft: string; title?: string },
  options?: { authMode?: AuthMode },
): Promise<{ versionId: string; schema: DocumentSchema; componentTree: ComponentNode[] }> {
  const res = await fetch(`${API_BASE}/api/smart-documents/${documentId}/manual-version`, {
    method: "POST",
    headers: resolveAuthHeaders(options),
    body: JSON.stringify(content),
  });
  return json(res);
}

export async function requestLawyerDocumentEditPlan(
  documentId: string,
  instruction: string,
  currentContent: string,
): Promise<AiEditResponse> {
  const res = await fetch(`${API_BASE}/api/smart-documents/${documentId}/lawyer-edit-plan`, {
    method: "POST",
    headers: lawyerAuthHeaders(),
    body: JSON.stringify({ instruction, currentContent }),
  });
  const data = await json<{ ok: boolean } & AiEditResponse>(res);
  return {
    summary: data.summary,
    operations: data.operations,
    warnings: data.warnings ?? [],
  };
}

export async function getVersionHistory(documentId: string, options?: { authMode?: AuthMode }): Promise<DocumentVersionSummary[]> {
  const res = await fetch(`${API_BASE}/api/smart-documents/${documentId}/versions`, { headers: resolveAuthHeaders(options) });
  const data = await json<{ ok: boolean; versions: DocumentVersionSummary[] }>(res);
  return data.versions;
}

export async function restoreVersion(documentId: string, versionId: string, options?: { authMode?: AuthMode }): Promise<void> {
  const res = await fetch(`${API_BASE}/api/smart-documents/${documentId}/versions/${versionId}/restore`, {
    method: "POST",
    headers: resolveAuthHeaders(options),
  });
  await json(res);
}

export async function publishDocument(
  documentId: string,
  publishOptions: { expiresInDays?: number; password?: string } = {},
  options?: { authMode?: AuthMode },
): Promise<{ token: string; url: string }> {
  const res = await fetch(`${API_BASE}/api/smart-documents/${documentId}/publish`, {
    method: "POST",
    headers: resolveAuthHeaders(options),
    body: JSON.stringify(publishOptions),
  });
  return json(res);
}

export async function downloadDocumentExport(
  documentId: string,
  format: "pdf" | "docx" | "markdown" | "schema",
  options?: { authMode?: AuthMode },
): Promise<void> {
  const res = await fetch(`${API_BASE}/api/document-os/documents/${documentId}/export/${format}`, {
    headers: resolveAuthHeaders(options),
  });
  if (!res.ok) throw new Error(await parseApiError(res, `Could not download ${format.toUpperCase()}`));
  const blob = await res.blob();
  const filename = filenameFromDisposition(res.headers.get("content-disposition"), `smart-document.${format === "schema" ? "json" : format}`);
  downloadBlob(blob, filename);
}

export async function downloadPublishedDocumentPdf(token: string, password?: string): Promise<void> {
  const url = new URL(`${API_BASE}/api/smart-documents/p/${token}/download/pdf`);
  if (password) url.searchParams.set("password", password);
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(await parseApiError(res, "Could not download PDF"));
  const blob = await res.blob();
  const filename = filenameFromDisposition(res.headers.get("content-disposition"), "smart-document.pdf");
  downloadBlob(blob, filename);
}

export async function openPrintWindow(documentId: string, options?: { authMode?: AuthMode }): Promise<void> {
  const res = await fetch(`${API_BASE}/api/smart-documents/${documentId}/print`, { headers: resolveAuthHeaders(options) });
  if (!res.ok) throw new Error(await parseApiError(res, "Print failed"));
  const html = await res.text();
  await new Promise<void>((resolve, reject) => {
    const iframe = document.createElement("iframe");
    iframe.setAttribute("aria-hidden", "true");
    iframe.tabIndex = -1;
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    iframe.style.opacity = "0";
    iframe.style.pointerEvents = "none";

    const cleanup = () => {
      window.removeEventListener("afterprint", handleAfterPrint);
      iframe.remove();
    };

    const handleAfterPrint = () => {
      cleanup();
      resolve();
    };

    const fail = (message: string) => {
      cleanup();
      reject(new Error(message));
    };

    window.addEventListener("afterprint", handleAfterPrint, { once: true });
    iframe.onload = () => {
      const frameWindow = iframe.contentWindow;
      if (!frameWindow) {
        fail("Print preview could not be started.");
        return;
      }
      try {
        frameWindow.focus();
        frameWindow.print();
      } catch {
        fail("Print preview could not be started.");
      }
    };
    iframe.srcdoc = html;
    document.body.appendChild(iframe);
    window.setTimeout(() => {
      if (document.body.contains(iframe)) {
        fail("Print preview could not be started.");
      }
    }, 10_000);
  });
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
