import type { DocumentUploadResponse, ExtractedDocument } from "../shared/types/documentCleaner";
import type { ExtractionMode, SmartPageSummary } from "../shared/types/smartPages";
import { getApiBaseUrl } from "./apiBase";

const API_BASE = getApiBaseUrl();

export async function uploadDocument(
  file: File,
  options?: { schoolCode?: string; extractionMode?: ExtractionMode },
): Promise<DocumentUploadResponse & { pageEstimate?: number; extractionMode?: ExtractionMode; fromCache?: boolean }> {
  const form = new FormData();
  form.append("file", file);
  if (options?.schoolCode) form.append("schoolCode", options.schoolCode);
  if (options?.extractionMode) form.append("extractionMode", options.extractionMode);

  const res = await fetch(`${API_BASE}/api/documents/cleaner/upload`, {
    method: "POST",
    body: form,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ message: "Upload failed" }));
    throw new Error(body.message ?? "Upload failed");
  }

  return res.json();
}

export async function generatePdfHtml(
  document: ExtractedDocument,
  primaryColor?: string,
): Promise<string> {
  const res = await fetch(`${API_BASE}/api/documents/cleaner/generate-pdf`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ document, primaryColor }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ message: "PDF generation failed" }));
    throw new Error(body.message ?? "PDF generation failed");
  }

  return res.text();
}

export async function getSmartPagesSummary(schoolCode: string): Promise<SmartPageSummary> {
  const res = await fetch(`${API_BASE}/api/documents/cleaner/smart-pages?schoolCode=${encodeURIComponent(schoolCode)}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({ message: "Failed to load Smart Pages summary" }));
    throw new Error(body.message ?? "Failed to load Smart Pages summary");
  }
  return res.json() as Promise<SmartPageSummary>;
}

