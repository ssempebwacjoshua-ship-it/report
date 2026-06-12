import { createDoctrOcrProvider } from "./doctrOcrProvider";
import { createManualOcrProvider } from "./manualOcrProvider";
import { createPaddleOcrProvider } from "./paddleOcrProvider";
import { createTesseractOcrProvider } from "./tesseractOcrProvider";

export type OcrProviderName = "paddleocr" | "doctr" | "tesseract" | "manual";

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

function providerOrder(): OcrProvider[] {
  const providers = {
    paddleocr: createPaddleOcrProvider(),
    doctr: createDoctrOcrProvider(),
    tesseract: createTesseractOcrProvider(),
    manual: createManualOcrProvider(),
  } satisfies Record<OcrProviderName, OcrProvider>;

  const configured = (process.env.OCR_PROVIDER ?? "paddleocr").trim().toLowerCase() as OcrProviderName;
  const preferred: OcrProviderName[] = ["paddleocr", "doctr", "tesseract", "manual"];
  const orderedNames = preferred.includes(configured)
    ? [configured, ...preferred.filter((name) => name !== configured)]
    : preferred;

  return orderedNames.map((name) => providers[name]);
}

function providerUrl(name: OcrProviderName): string {
  if (name === "paddleocr") return process.env.PADDLE_OCR_URL ?? "http://localhost:8003";
  if (name === "doctr") return process.env.DOCTR_OCR_URL ?? "http://localhost:8002";
  return "";
}

/**
 * Resolve which OCR provider to use and return full resolution metadata.
 *
 * Tries providers in priority order. Tracks why each skipped provider was
 * not used so the UI can surface a clear fallback reason.
 */
export async function resolveOcrProviderWithMeta(): Promise<OcrProviderResolution> {
  const configured = (process.env.OCR_PROVIDER ?? "paddleocr").trim().toLowerCase() as OcrProviderName;
  const order = providerOrder();
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
          providerUrl: providerUrl(candidate.name),
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
