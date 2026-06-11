import type { OcrCropInput, OcrCropResult, OcrProvider, OcrProviderName } from "./ocrProvider";

type RemoteResponse = {
  provider?: string;
  results?: Array<{
    cropId?: string;
    text?: string;
    confidence?: number;
  }>;
};

async function healthCheck(baseUrl: string): Promise<boolean> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 1500);
  try {
    const response = await fetch(`${baseUrl}/health`, { signal: controller.signal });
    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

async function recognizeCrops(baseUrl: string, crops: OcrCropInput[]): Promise<OcrCropResult[]> {
  if (crops.length === 0) return [];

  const form = new FormData();
  form.append("crop_ids", JSON.stringify(crops.map((crop) => crop.cropId)));
  for (const crop of crops) {
    const blob = new Blob([crop.buffer], { type: crop.mimeType ?? "image/jpeg" });
    form.append("files", blob, `${crop.cropId}.jpg`);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(`${baseUrl}/ocr/crops`, {
      method: "POST",
      body: form,
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`OCR service returned ${response.status}`);
    const body = (await response.json()) as RemoteResponse;
    const byId = new Map((body.results ?? []).map((result) => [result.cropId ?? "", result]));
    return crops.map((crop) => {
      const result = byId.get(crop.cropId);
      return {
        cropId: crop.cropId,
        text: result?.text ?? "",
        confidence: typeof result?.confidence === "number" ? result.confidence : 0,
      };
    });
  } finally {
    clearTimeout(timeout);
  }
}

export function createRemoteCropOcrProvider(name: OcrProviderName, baseUrl: string): OcrProvider {
  const normalizedUrl = baseUrl.replace(/\/+$/, "");
  return {
    name,
    healthCheck: () => healthCheck(normalizedUrl),
    recognizeCrops: (crops) => recognizeCrops(normalizedUrl, crops),
  };
}
