import { z } from "zod";

const ocrResponseSchema = z.object({
  text: z.string().default(""),
  lines: z.array(z.string()).default([]),
});

export type AzureOcrResult = {
  text: string;
  lines: string[];
};

function envEnabled(value: string | undefined) {
  return value === "1" || value?.toLowerCase() === "true";
}

function providerUnavailable(message: string) {
  const error = new Error(message);
  error.name = "ProviderUnavailableError";
  return error;
}

export async function readAzureOcr(url: string): Promise<AzureOcrResult> {
  const enabled = envEnabled(process.env.OCR_ENABLED);
  const provider = (process.env.OCR_PROVIDER ?? "").trim().toLowerCase();
  const functionUrl = process.env.AZURE_OCR_FUNCTION_URL?.trim() ?? "";

  if (!enabled) throw providerUnavailable("OCR is disabled for this environment.");
  if (provider !== "azure") throw providerUnavailable("Azure OCR provider is not enabled.");
  if (!functionUrl) throw providerUnavailable("Azure OCR function URL is missing.");

  let parsedFunctionUrl: URL;
  try {
    parsedFunctionUrl = new URL(functionUrl);
  } catch {
    throw providerUnavailable("Azure OCR function URL is invalid.");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    console.log("[ocr.azure] request", { urlLength: url.length, functionUrlHost: parsedFunctionUrl.host });
    const response = await fetch(parsedFunctionUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
      signal: controller.signal,
    });
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`Azure OCR failed with status ${response.status}${body ? `: ${body.slice(0, 200)}` : ""}`);
    }
    const parsed = ocrResponseSchema.safeParse(await response.json());
    if (!parsed.success) {
      throw new Error("Azure OCR returned an unexpected payload.");
    }
    return {
      text: parsed.data.text ?? "",
      lines: parsed.data.lines ?? [],
    };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("Azure OCR timed out after 15 seconds.");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
