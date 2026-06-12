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
    // Ensure googlevision is not picked up from ambient machine credentials
    const savedCreds = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
    try {
      const provider = await resolveOcrProvider();
      expect(["tesseract", "manual"]).toContain(provider.name);
    } finally {
      if (savedCreds !== undefined) process.env.GOOGLE_APPLICATION_CREDENTIALS = savedCreds;
    }
  });

  it("returns cropId with empty text and zero confidence when service returns no match", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.endsWith("/health")) return jsonResponse({ status: "ok" });
      // Service only returns result for one of the two crops
      return jsonResponse({
        provider: "paddleocr",
        results: [{ cropId: "S1A-001-written", text: "82", confidence: 0.91 }],
      });
    });
    globalThis.fetch = fetchMock as typeof fetch;

    const provider = createPaddleOcrProvider();
    const results = await provider.recognizeCrops([
      { cropId: "S1A-001-written", buffer: Buffer.from("a") },
      { cropId: "S1A-001-split-1", buffer: Buffer.from("b") }, // not in service response
    ]);

    // crop IDs that had no match still appear — text is not silently dropped
    expect(results).toHaveLength(2);
    expect(results[0]).toMatchObject({ cropId: "S1A-001-written", text: "82" });
    expect(results[1]).toMatchObject({ cropId: "S1A-001-split-1", text: "", confidence: 0 });
  });

  it("preserves low-confidence text in the response without discarding it", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.endsWith("/health")) return jsonResponse({ status: "ok" });
      return jsonResponse({
        provider: "paddleocr",
        results: [{ cropId: "S1A-002-written", text: "7", confidence: 0.31 }],
      });
    });
    globalThis.fetch = fetchMock as typeof fetch;

    const provider = createPaddleOcrProvider();
    const [result] = await provider.recognizeCrops([
      { cropId: "S1A-002-written", buffer: Buffer.from("a") },
    ]);

    // The provider must NOT filter or discard low-confidence results —
    // that decision belongs to the acceptance logic in scanExtractionService.
    expect(result).toMatchObject({ cropId: "S1A-002-written", text: "7", confidence: 0.31 });
  });

  it("handles a completely empty results array from the service", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.endsWith("/health")) return jsonResponse({ status: "ok" });
      return jsonResponse({ provider: "paddleocr", results: [] });
    });
    globalThis.fetch = fetchMock as typeof fetch;

    const provider = createPaddleOcrProvider();
    const results = await provider.recognizeCrops([
      { cropId: "S1A-003-split-1", buffer: Buffer.from("a") },
      { cropId: "S1A-003-split-2", buffer: Buffer.from("b") },
    ]);

    // All input crops must appear in output — none silently dropped
    expect(results).toHaveLength(2);
    for (const result of results) {
      expect(result.text).toBe("");
      expect(result.confidence).toBe(0);
    }
  });
});
