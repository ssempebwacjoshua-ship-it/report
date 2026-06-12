import { createRemoteCropOcrProvider } from "./remoteCropOcrProvider";
import type { OcrProvider } from "./ocrProvider";

export function createPaddleOcrProvider(url = process.env.PADDLE_OCR_URL ?? "http://localhost:8003"): OcrProvider {
  return createRemoteCropOcrProvider(
    "paddleocr",
    url,
  );
}
