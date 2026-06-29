export function isRenderablePassportPhotoUrl(value: string | null | undefined): boolean {
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith("/uploads/")) return true;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}
