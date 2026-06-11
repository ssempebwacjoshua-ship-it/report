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

export async function resolveOcrProvider(): Promise<OcrProvider> {
  for (const provider of providerOrder()) {
    if (provider.name === "manual") return provider;
    try {
      if (await provider.healthCheck()) return provider;
    } catch {
      // Try the next provider. OCR must never block manual operator entry.
    }
  }
  return createManualOcrProvider();
}
