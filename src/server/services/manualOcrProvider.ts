import type { OcrCropInput, OcrCropResult, OcrProvider } from "./ocrProvider";

export function createManualOcrProvider(): OcrProvider {
  return {
    name: "manual",
    healthCheck: async () => true,
    recognizeCrops: async (crops: OcrCropInput[]): Promise<OcrCropResult[]> =>
      crops.map((crop) => ({
        cropId: crop.cropId,
        text: "",
        confidence: 0,
      })),
  };
}
