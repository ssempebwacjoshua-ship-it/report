import type { ExtractionMode } from "../../shared/types/smartPages";

export type ProviderConfig = {
  provider: string;
  model: string;
  displayName: string;
};

const PROVIDER_CONFIGS: Record<ExtractionMode, ProviderConfig> = {
  economical: {
    provider: "azure",
    model: "read-basic",
    displayName: "Economical (basic OCR)",
  },
  balanced: {
    provider: "azure",
    model: "read-layout",
    displayName: "Balanced (layout-aware)",
  },
  high_accuracy: {
    provider: "azure",
    model: "form-recognizer",
    displayName: "High Accuracy (form parser)",
  },
};

export function getProviderForMode(mode: ExtractionMode): ProviderConfig {
  return PROVIDER_CONFIGS[mode];
}

export function estimatePageCount(_mimeType: string): number {
  return 1;
}

export function getModeLabel(mode: ExtractionMode): string {
  return PROVIDER_CONFIGS[mode].displayName;
}
