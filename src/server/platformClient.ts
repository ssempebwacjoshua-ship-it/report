type PlatformEntitlementCheckInput = {
  organizationId: string;
  moduleCode: string;
  quantity?: number;
};

type PlatformUsageInput = {
  organizationId: string;
  moduleCode: string;
  quantity: number;
  sourceType: string;
  sourceId: string;
  metadataJson?: unknown;
};

export class PlatformIntegrationError extends Error {
  status: number;
  code: string;

  constructor(message: string, options: { status?: number; code?: string } = {}) {
    super(message);
    this.name = "PlatformIntegrationError";
    this.status = options.status ?? 503;
    this.code = options.code ?? "PLATFORM_INTEGRATION_UNAVAILABLE";
  }
}

function isEnabled() {
  return process.env.SSAMENJ_PLATFORM_INTEGRATION_ENABLED === "true";
}

function getBaseUrl() {
  return process.env.SSAMENJ_PLATFORM_URL?.trim() ?? "";
}

function getServiceToken() {
  return process.env.SSAMENJ_PLATFORM_SERVICE_TOKEN?.trim() ?? "";
}

function getTimeoutMs() {
  const configured = Number(process.env.SSAMENJ_PLATFORM_TIMEOUT_MS ?? "5000");
  return Number.isFinite(configured) && configured > 0 ? configured : 5000;
}

export function assertPlatformIntegrationConfigured(): void {
  if (!isEnabled()) {
    return;
  }

  const missing: string[] = [];
  if (!getBaseUrl()) missing.push("SSAMENJ_PLATFORM_URL");
  if (!getServiceToken()) missing.push("SSAMENJ_PLATFORM_SERVICE_TOKEN");

  if (missing.length > 0) {
    throw new Error(`Missing required SSAMENJ platform integration env vars: ${missing.join(", ")}`);
  }
}

async function platformRequest<T>(path: string, body: unknown): Promise<T> {
  if (!isEnabled()) {
    throw new PlatformIntegrationError("Platform integration is disabled.", {
      status: 503,
      code: "PLATFORM_INTEGRATION_DISABLED",
    });
  }

  const baseUrl = getBaseUrl();
  const serviceToken = getServiceToken();
  if (!baseUrl || !serviceToken) {
    throw new PlatformIntegrationError("Platform integration is not configured.", {
      status: 503,
      code: "PLATFORM_INTEGRATION_UNAVAILABLE",
    });
  }

  const timeoutMs = getTimeoutMs();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${baseUrl}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-ssamenj-service-token": serviceToken,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    const text = await response.text();
    const payload = text ? JSON.parse(text) as Record<string, unknown> : {};

    if (!response.ok) {
      const message = typeof payload.message === "string"
        ? payload.message
        : typeof payload.error === "string"
          ? payload.error
          : "Platform integration request failed.";
      throw new PlatformIntegrationError(message, {
        status: response.status,
        code: typeof payload.code === "string" ? payload.code : "PLATFORM_INTEGRATION_ERROR",
      });
    }

    return payload as T;
  } catch (error) {
    if (error instanceof PlatformIntegrationError) {
      throw error;
    }
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new PlatformIntegrationError("Platform integration request timed out.", {
        status: 503,
        code: "PLATFORM_INTEGRATION_TIMEOUT",
      });
    }
    throw new PlatformIntegrationError("Platform integration is unavailable.", {
      status: 503,
      code: "PLATFORM_INTEGRATION_UNAVAILABLE",
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function checkEntitlement(input: PlatformEntitlementCheckInput): Promise<{ allowed: true; entitlement?: unknown } | { allowed: false; entitlement?: unknown }> {
  if (!isEnabled()) {
    return { allowed: true };
  }

  const response = await platformRequest<{ allowed: boolean; entitlement?: unknown }>(
    "/api/platform/service/entitlements/check",
    {
      organizationId: input.organizationId,
      moduleCode: input.moduleCode,
      quantity: input.quantity ?? 1,
    },
  );

  return response.allowed ? { allowed: true, entitlement: response.entitlement } : { allowed: false, entitlement: response.entitlement };
}

export async function recordUsage(input: PlatformUsageInput): Promise<void> {
  if (!isEnabled()) {
    return;
  }

  await platformRequest("/api/platform/service/usage", input);
}

export async function recordUsageWithWarning(input: PlatformUsageInput): Promise<string | null> {
  try {
    await recordUsage(input);
    return null;
  } catch (error) {
    console.warn("[platform-integration] usage recording failed", {
      organizationId: input.organizationId,
      moduleCode: input.moduleCode,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      message: error instanceof Error ? error.message : String(error),
    });
    return "Usage recording failed";
  }
}
