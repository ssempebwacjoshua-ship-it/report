import { afterEach, describe, expect, it, vi } from "vitest";
import { createPaddleOcrProvider } from "../../server/services/paddleOcrProvider";
import { resolveOcrProvider } from "../../server/services/ocrProvider";

const originalFetch = globalThis.fetch;
const originalProvider = process.env.OCR_PROVIDER;
const originalPaddleUrl = process.env.PADDLE_OCR_URL;
const originalDoctrUrl = process.env.DOCTR_OCR_URL;

function jsonResponse(body: unknown, ok = true): Response {
  return {
    ok,
    status: ok ? 200 : 503,
    json: async () => body,
  } as Response;
}

afterEach(() => {
  globalThis.fetch = originalFetch;
  process.env.OCR_PROVIDER = originalProvider;
  process.env.PADDLE_OCR_URL = originalPaddleUrl;
  process.env.DOCTR_OCR_URL = originalDoctrUrl;
  vi.restoreAllMocks();
});

describe("PaddleOCR provider", () => {
  it("checks PaddleOCR service health", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ status: "ok", provider: "paddleocr" }));
    globalThis.fetch = fetchMock as typeof fetch;
    process.env.PADDLE_OCR_URL = "http://localhost:8003";

    const provider = createPaddleOcrProvider();

    await expect(provider.healthCheck()).resolves.toBe(true);
    expect(fetchMock).toHaveBeenCalledWith("http://localhost:8003/health", expect.any(Object));
  });

  it("maps PaddleOCR crop responses to crop results", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.endsWith("/health")) return jsonResponse({ status: "ok" });
      return jsonResponse({
        provider: "paddleocr",
        results: [
          { cropId: "S1A-001-split-1", text: "7", confidence: 0.82 },
          { cropId: "S1A-001-split-2", text: "6", confidence: 0.84 },
        ],
      });
    });
    globalThis.fetch = fetchMock as typeof fetch;

    const provider = createPaddleOcrProvider();
    const results = await provider.recognizeCrops([
      { cropId: "S1A-001-split-1", buffer: Buffer.from("a") },
      { cropId: "S1A-001-split-2", buffer: Buffer.from("b") },
    ]);

    expect(results).toEqual([
      { cropId: "S1A-001-split-1", text: "7", confidence: 0.82 },
      { cropId: "S1A-001-split-2", text: "6", confidence: 0.84 },
    ]);
  });

  it("falls back when PaddleOCR and docTR services are unavailable", async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new Error("service unavailable");
    }) as typeof fetch;
    process.env.OCR_PROVIDER = "paddleocr";
    process.env.PADDLE_OCR_URL = "http://localhost:8003";
    process.env.DOCTR_OCR_URL = "http://localhost:8002";

    const provider = await resolveOcrProvider();

    expect(["tesseract", "manual"]).toContain(provider.name);
  });
});
