import type { ExtractionMode } from "../../shared/types/smartPages";

const VALID_MODES = new Set<string>(["economical", "balanced", "high_accuracy"]);

export function isValidExtractionMode(mode: string): mode is ExtractionMode {
  return VALID_MODES.has(mode);
}

export function requiresHighAccuracyConfirmation(mode: ExtractionMode): boolean {
  return mode === "high_accuracy";
}

