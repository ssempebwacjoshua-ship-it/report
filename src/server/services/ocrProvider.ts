import { isAzureOcrConfigured, readAzureOcrFromImage } from "./azureOcrService";

export type OcrProviderName = "azure";

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
  providerReachable: boolean;
  fallbackReason: string;
};

function createAzureOcrProvider(): OcrProvider {
  return {
    name: "azure",
    healthCheck: async () => isAzureOcrConfigured(),
    recognizeCrops: async (crops) => Promise.all(crops.map(async (crop) => {
      const result = await readAzureOcrFromImage({
        imageBase64: crop.buffer.toString("base64"),
        mimeType: crop.mimeType ?? "image/jpeg",
      });
      return {
        cropId: crop.cropId,
        text: result.text,
        confidence: result.text.trim() ? 0.9 : 0,
      };
    })),
  };
}

export async function resolveOcrProviderWithMeta(): Promise<OcrProviderResolution> {
  const provider = createAzureOcrProvider();
  const providerReachable = await provider.healthCheck();

  return {
    provider,
    configuredProvider: "azure",
    activeProvider: "azure",
    providerReachable,
    fallbackReason: "",
  };
}

export async function resolveOcrProvider(): Promise<OcrProvider> {
  return (await resolveOcrProviderWithMeta()).provider;
}
