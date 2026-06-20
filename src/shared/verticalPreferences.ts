// Shared helper for vertical-scoped preference key filtering.
// School pages must not import lawyer constants directly — use this module instead.

const NON_SCHOOL_PREFERENCE_PREFIX = "lawyer.";

export function isNonSchoolPreferenceKey(key: string): boolean {
  return key.toLowerCase().startsWith(NON_SCHOOL_PREFERENCE_PREFIX);
}
