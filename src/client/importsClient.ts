import type { ImportPreview } from "../shared/types/imports";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4300";

export async function dryRunMarksImport(csvText: string, schoolCode = "SCU-PREVIEW"): Promise<ImportPreview> {
  const response = await fetch(`${API_BASE}/api/imports/marks/dry-run`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ schoolCode, csvText }),
  });
  if (!response.ok) throw new Error("Could not validate import");
  return response.json();
}

export async function commitMarksImport(csvText: string, schoolCode = "SCU-PREVIEW"): Promise<ImportPreview> {
  const response = await fetch(`${API_BASE}/api/imports/marks/commit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ schoolCode, csvText }),
  });
  if (!response.ok) throw new Error("Could not commit import");
  return response.json();
}
