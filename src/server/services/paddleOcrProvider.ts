import { createRemoteCropOcrProvider } from "./remoteCropOcrProvider";
import type { OcrProvider } from "./ocrProvider";

export function createPaddleOcrProvider(): OcrProvider {
  return createRemoteCropOcrProvider(
    "paddleocr",
    process.env.PADDLE_OCR_URL ?? "http://localhost:8003",
  );
}
