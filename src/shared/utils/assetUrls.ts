import { z } from "zod";

export function isSafeAssetUrl(value: string): boolean {
  const normalized = value.trim();
  if (!normalized) return true;
  if (normalized.startsWith("/uploads/")) return true;
  try {
    const parsed = new URL(normalized);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export const assetUrlSchema = z.string().trim().default("").refine(
  (value) => isSafeAssetUrl(value),
  "Enter a valid image URL or uploaded file path.",
);

