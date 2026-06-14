import type { DocumentUploadResponse, ExtractedDocument } from "../shared/types/documentCleaner";

export async function uploadDocument(file: File): Promise<DocumentUploadResponse> {
  const form = new FormData();
  form.append("file", file);

  const res = await fetch("/api/documents/cleaner/upload", {
    method: "POST",
    body: form,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ message: "Upload failed" }));
    throw new Error(body.message ?? "Upload failed");
  }

  return res.json() as Promise<DocumentUploadResponse>;
}

export async function generatePdfHtml(
  document: ExtractedDocument,
  primaryColor?: string,
): Promise<string> {
  const res = await fetch("/api/documents/cleaner/generate-pdf", {
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
