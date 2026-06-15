export type ScoreValidation =
  | { valid: true; value: number; error: null }
  | { valid: false; value: null; error: string };

/**
 * Single source of truth for numeric mark validation (0–100 inclusive).
 * Accepts a raw string or number. Returns a discriminated union so callers
 * are forced to handle both cases.
 */
export function validateScore(raw: string | number | null | undefined): ScoreValidation {
  const trimmed = String(raw ?? "").trim();
  if (trimmed === "") return { valid: false, value: null, error: "Mark is required." };
  const n = Number(trimmed);
  if (!Number.isFinite(n)) return { valid: false, value: null, error: `"${trimmed}" is not a valid score.` };
  if (n < 0 || n > 100) return { valid: false, value: null, error: `Score ${n} is outside the allowed range (0–100).` };
  return { valid: true, value: n, error: null };
}
