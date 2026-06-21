/**
 * Uganda schools use a single year label on reports (the ending year).
 * "2025/2026" → "2026", "2026" → "2026", "2026/2027" → "2027"
 */
export function formatUgandaSchoolYearLabel(name: string): string {
  const trimmed = name.trim();
  const slashIdx = trimmed.lastIndexOf("/");
  return slashIdx !== -1 ? trimmed.slice(slashIdx + 1).trim() : trimmed;
}

/** Returns the next Uganda school year number: "2025/2026" → 2027 */
export function nextUgandaSchoolYear(name: string): number {
  return parseInt(formatUgandaSchoolYearLabel(name), 10) + 1;
}
