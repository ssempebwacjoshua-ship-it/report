import { afterEach, describe, expect, it, vi } from "vitest";
import { resolveOcrProvider, resolveOcrProviderWithMeta } from "../../server/services/ocrProvider";

const originalFetch = globalThis.fetch;
const savedEnv = {
  enabled: process.env.OCR_ENABLED,
  provider: process.env.OCR_PROVIDER,
  functionUrl: process.env.AZURE_OCR_FUNCTION_URL,
};

function restoreEnv() {
  if (savedEnv.enabled === undefined) delete process.env.OCR_ENABLED;
  else process.env.OCR_ENABLED = savedEnv.enabled;
  if (savedEnv.provider === undefined) delete process.env.OCR_PROVIDER;
  else process.env.OCR_PROVIDER = savedEnv.provider;
  if (savedEnv.functionUrl === undefined) delete process.env.AZURE_OCR_FUNCTION_URL;
  else process.env.AZURE_OCR_FUNCTION_URL = savedEnv.functionUrl;
}

function configureAzure() {
  process.env.OCR_ENABLED = "true";
  process.env.OCR_PROVIDER = "azure";
  process.env.AZURE_OCR_FUNCTION_URL = "https://azure-ocr.example.test/api/ocr";
}

afterEach(() => {
  globalThis.fetch = originalFetch;
  restoreEnv();
  vi.restoreAllMocks();
});

describe("Azure OCR provider", () => {
  it("resolves Azure as the sole OCR provider", async () => {
    configureAzure();

    const resolution = await resolveOcrProviderWithMeta();

    expect(resolution.configuredProvider).toBe("azure");
    expect(resolution.activeProvider).toBe("azure");
    expect(resolution.providerReachable).toBe(true);
    expect(resolution.fallbackReason).toBe("");
    const removedProviderPattern = new RegExp(["tesser" + "act", "paddle" + "ocr", "tex" + "tract", "google" + "vision", "code="].join("|"), "i");
    expect(JSON.stringify(resolution)).not.toMatch(removedProviderPattern);
  });

  it("does not fall back to another provider when Azure is unavailable", async () => {
    process.env.OCR_ENABLED = "true";
    process.env.OCR_PROVIDER = "azure";
    delete process.env.AZURE_OCR_FUNCTION_URL;

    const resolution = await resolveOcrProviderWithMeta();

    expect(resolution.configuredProvider).toBe("azure");
    expect(resolution.activeProvider).toBe("azure");
    expect(resolution.providerReachable).toBe(false);
    expect(resolution.fallbackReason).toBe("");
  });

  it("sends crop images to Azure as base64 bytes", async () => {
    configureAzure();
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ ok: true, provider: "azure", text: "82", lines: ["82"], raw: {} }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    globalThis.fetch = fetchMock as typeof fetch;

    const provider = await resolveOcrProvider();
    const [result] = await provider.recognizeCrops([
      { cropId: "S1A-001-written", buffer: Buffer.from("image-bytes"), mimeType: "image/png" },
    ]);

    expect(result).toEqual({ cropId: "S1A-001-written", text: "82", confidence: 0.9 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)) as Record<string, string>;
    expect(body).toMatchObject({
      imageBase64: Buffer.from("image-bytes").toString("base64"),
      mimeType: "image/png",
    });
    expect(body).not.toHaveProperty("url");
  });

  it("surfaces Azure crop failures without substituting providers", async () => {
    configureAzure();
    globalThis.fetch = vi.fn(async () => new Response("down", { status: 503 })) as typeof fetch;

    const provider = await resolveOcrProvider();

    await expect(provider.recognizeCrops([
      { cropId: "S1A-001-written", buffer: Buffer.from("image-bytes"), mimeType: "image/jpeg" },
    ])).rejects.toMatchObject({ name: "ProviderUnavailableError" });
  });
});
