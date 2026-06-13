import { z } from "zod";

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const FRIENDLY_OCR_ERROR = "OCR is temporarily unavailable. Contact platform support.";

const ocrResponseSchema = z.object({
  ok: z.boolean().optional(),
  provider: z.literal("azure").optional(),
  text: z.string().default(""),
  lines: z.array(z.string()).default([]),
  raw: z.unknown().optional(),
});

export type AzureOcrResult = {
  text: string;
  lines: string[];
};

export type AzureOcrImageInput = {
  imageBase64: string;
  mimeType: string;
};

type AzureOcrRequest =
  | { url: string }
  | AzureOcrImageInput;

function envEnabled(value: string | undefined) {
  return value === "1" || value?.toLowerCase() === "true";
}

export function providerUnavailable(message = FRIENDLY_OCR_ERROR) {
  const error = new Error(message);
  error.name = "ProviderUnavailableError";
  return error;
}

export function isProviderUnavailableError(error: unknown): boolean {
  return error instanceof Error && error.name === "ProviderUnavailableError";
}

export function isAzureOcrConfigured(): boolean {
  const provider = (process.env.OCR_PROVIDER ?? "").trim().toLowerCase();
  const functionUrl = process.env.AZURE_OCR_FUNCTION_URL?.trim();
  if (!envEnabled(process.env.OCR_ENABLED) || provider !== "azure" || !functionUrl) return false;
  try {
    new URL(functionUrl);
    return true;
  } catch {
    return false;
  }
}

function azureFunctionUrl(): URL {
  if (!envEnabled(process.env.OCR_ENABLED)) throw providerUnavailable("OCR is disabled for this environment.");

  const provider = (process.env.OCR_PROVIDER ?? "").trim().toLowerCase();
  if (provider !== "azure") throw providerUnavailable("Azure OCR provider is not enabled.");

  const functionUrl = process.env.AZURE_OCR_FUNCTION_URL?.trim() ?? "";
  if (!functionUrl) throw providerUnavailable("Azure OCR function URL is missing.");

  try {
    return new URL(functionUrl);
  } catch {
    throw providerUnavailable("Azure OCR function URL is invalid.");
  }
}

function validateImageInput(input: AzureOcrImageInput): void {
  if (!/^image\/(png|jpe?g|webp)$/i.test(input.mimeType)) {
    throw providerUnavailable("Unsupported OCR image type.");
  }

  let decodedLength = 0;
  try {
    decodedLength = Buffer.byteLength(Buffer.from(input.imageBase64, "base64"));
  } catch {
    throw providerUnavailable("Invalid OCR image payload.");
  }

  if (decodedLength === 0) throw providerUnavailable("Empty OCR image payload.");
  if (decodedLength > MAX_IMAGE_BYTES) throw providerUnavailable("OCR image payload is too large.");
}

async function readAzureOcr(request: AzureOcrRequest): Promise<AzureOcrResult> {
  const functionUrl = azureFunctionUrl();

  if ("imageBase64" in request) validateImageInput(request);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

  try {
    const response = await fetch(functionUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
      signal: controller.signal,
    });

    if (!response.ok) throw providerUnavailable();

    const parsed = ocrResponseSchema.safeParse(await response.json());
    if (!parsed.success) throw providerUnavailable("Azure OCR returned an unexpected payload.");
    if (parsed.data.ok === false) throw providerUnavailable();

    return {
      text: parsed.data.text ?? "",
      lines: parsed.data.lines ?? [],
    };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw providerUnavailable("Azure OCR timed out.");
    }
    if (isProviderUnavailableError(error)) throw error;
    throw providerUnavailable();
  } finally {
    clearTimeout(timeout);
  }
}

export async function readAzureOcrFromUrl(url: string): Promise<AzureOcrResult> {
  return readAzureOcr({ url });
}

export async function readAzureOcrFromImage(input: AzureOcrImageInput): Promise<AzureOcrResult> {
  return readAzureOcr(input);
}
