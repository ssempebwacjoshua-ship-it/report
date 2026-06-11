import { recognizeWrittenMark } from "./markRecognitionService";
import type { OcrCropInput, OcrCropResult, OcrProvider } from "./ocrProvider";

export function createTesseractOcrProvider(): OcrProvider {
  return {
    name: "tesseract",
    healthCheck: async () => true,
    recognizeCrops: async (crops: OcrCropInput[]): Promise<OcrCropResult[]> => {
      const results: OcrCropResult[] = [];
      for (const crop of crops) {
        const recognized = await recognizeWrittenMark(crop.buffer);
        results.push({
          cropId: crop.cropId,
          text: recognized.rawText,
          confidence: recognized.confidence,
        });
      }
      return results;
    },
  };
}
