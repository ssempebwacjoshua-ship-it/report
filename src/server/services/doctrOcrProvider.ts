import { createRemoteCropOcrProvider } from "./remoteCropOcrProvider";
import type { OcrProvider } from "./ocrProvider";

export function createDoctrOcrProvider(): OcrProvider {
  return createRemoteCropOcrProvider(
    "doctr",
    process.env.DOCTR_OCR_URL ?? "http://localhost:8002",
  );
}
