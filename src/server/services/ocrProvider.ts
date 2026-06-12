import { createDoctrOcrProvider } from "./doctrOcrProvider";
import { createGoogleVisionOcrProvider, hasGoogleVisionCredentials } from "./googleVisionOcrProvider";
import { createManualOcrProvider } from "./manualOcrProvider";
import { createPaddleOcrProvider } from "./paddleOcrProvider";
import { createTesseractOcrProvider } from "./tesseractOcrProvider";
import {
  createTextractOcrProvider,
  hasTextractCredentials,
  textractRegion,
} from "./textractOcrProvider";
import type { OcrSettings } from "../../shared/types/settings";

export type OcrProviderName = "paddleocr" | "textract" | "googlevision" | "doctr" | "tesseract" | "manual";

export type OcrCropInput = {
  cropId: string;
  buffer: Buffer;
  mimeType?: string;
};

export type OcrCropResult = {
  cropId: string;
  text: string;
  confidence: number;
};

export type OcrProvider = {
  name: OcrProviderName;
  healthCheck: () => Promise<boolean>;
  recognizeCrops: (crops: OcrCropInput[]) => Promise<OcrCropResult[]>;
};

export type OcrProviderResolution = {
  provider: OcrProvider;
  configuredProvider: OcrProviderName;
  activeProvider: OcrProviderName;
  providerUrl: string;
  providerReachable: boolean;
  fallbackReason: string;
};

function providerOrder(settings?: OcrSettings): OcrProvider[] {
  const providers = {
    paddleocr: createPaddleOcrProvider(settings?.paddleOcrUrl),
    textract: createTextractOcrProvider(),
    googlevision: createGoogleVisionOcrProvider(),
    doctr: createDoctrOcrProvider(),
    tesseract: createTesseractOcrProvider(),
    manual: createManualOcrProvider(),
  } satisfies Record<OcrProviderName, OcrProvider>;

  const configured = (settings?.provider ?? process.env.OCR_PROVIDER ?? "paddleocr").trim().toLowerCase() as OcrProviderName;
  const preferred: OcrProviderName[] = ["paddleocr", "textract", "googlevision", "tesseract", "manual"];
  const orderedNames = preferred.includes(configured)
    ? [configured, ...preferred.filter((name) => name !== configured)]
    : preferred;

  return orderedNames.map((name) => providers[name]);
}

function providerUrl(name: OcrProviderName, settings?: OcrSettings): string {
  if (name === "paddleocr") return settings?.paddleOcrUrl ?? process.env.PADDLE_OCR_URL ?? "http://localhost:8003";
  if (name === "doctr") return process.env.DOCTR_OCR_URL ?? "http://localhost:8002";
  if (name === "googlevision") return "https://vision.googleapis.com";
  if (name === "textract") return `https://textract.${textractRegion()}.amazonaws.com`;
  return "";
}

/**
 * Resolve which OCR provider to use and return full resolution metadata.
 *
 * Tries providers in priority order. Tracks why each skipped provider was
 * not used so the UI can surface a clear fallback reason.
 */
export async function resolveOcrProviderWithMeta(settings?: OcrSettings): Promise<OcrProviderResolution> {
  const configured = (settings?.provider ?? process.env.OCR_PROVIDER ?? "paddleocr").trim().toLowerCase() as OcrProviderName;

  // Google Vision is explicit-opt-in: when it is the configured provider but
  // credentials are missing, go straight to manual entry with a clear reason
  // rather than silently OCR-ing with a different engine the operator did
  // not choose.
  if (configured === "googlevision" && !hasGoogleVisionCredentials()) {
    return {
      provider: createManualOcrProvider(),
      configuredProvider: configured,
      activeProvider: "manual",
      providerUrl: "",
      providerReachable: false,
      fallbackReason: "Google Vision credentials missing. Manual entry mode.",
    };
  }

  // Same explicit-opt-in rule for Amazon Textract: never substitute a
  // different OCR engine for the one the operator configured.
  if (configured === "textract" && !hasTextractCredentials()) {
    return {
      provider: createManualOcrProvider(),
      configuredProvider: configured,
      activeProvider: "manual",
      providerUrl: "",
      providerReachable: false,
      fallbackReason: "AWS Textract credentials missing. Manual entry mode.",
    };
  }

  const order = providerOrder(settings);
  const tried: string[] = [];

  for (const candidate of order) {
    if (candidate.name === "manual") {
      return {
        provider: candidate,
        configuredProvider: configured,
        activeProvider: "manual",
        providerUrl: "",
        providerReachable: false,
        fallbackReason: tried.length > 0
          ? `All OCR providers unreachable (${tried.join("; ")}). Manual entry required.`
          : "",
      };
    }

    try {
      if (await candidate.healthCheck()) {
        const isFallback = candidate.name !== configured;
        return {
          provider: candidate,
          configuredProvider: configured,
          activeProvider: candidate.name,
          providerUrl: providerUrl(candidate.name, settings),
          providerReachable: true,
          fallbackReason: isFallback
            ? `Configured provider "${configured}" unreachable (${tried.join("; ")}); using ${candidate.name}.`
            : "",
        };
      }
      tried.push(`${candidate.name}: unreachable`);
    } catch (err) {
      tried.push(`${candidate.name}: ${err instanceof Error ? err.message : "error"}`);
    }
  }

  const manual = createManualOcrProvider();
  return {
    provider: manual,
    configuredProvider: configured,
    activeProvider: "manual",
    providerUrl: "",
    providerReachable: false,
    fallbackReason: `All OCR providers failed (${tried.join("; ")}). Manual entry required.`,
  };
}

/** Backward-compatible wrapper — returns only the resolved provider. */
export async function resolveOcrProvider(): Promise<OcrProvider> {
  return (await resolveOcrProviderWithMeta()).provider;
}
