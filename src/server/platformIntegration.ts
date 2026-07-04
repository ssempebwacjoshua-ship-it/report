import type { Request, Response } from "express";
import { checkEntitlement, recordUsageWithWarning } from "./platformClient";

type PlatformContextRequest = Request & {
  school?: { id: string; code: string; name: string };
  creator?: { schoolId?: string | null };
  user?: { schoolId?: string | null };
};

export function isPlatformIntegrationEnabled(): boolean {
  return process.env.SSAMENJ_PLATFORM_INTEGRATION_ENABLED === "true";
}

export function resolvePlatformOrganizationId(req: PlatformContextRequest): string | null {
  return req.school?.id ?? req.creator?.schoolId ?? req.user?.schoolId ?? null;
}

export async function requirePlatformModule(
  req: PlatformContextRequest,
  res: Response,
  moduleCode: string,
  requestedOrganizationId?: string | null,
): Promise<boolean> {
  if (!isPlatformIntegrationEnabled()) {
    return true;
  }

  const organizationId = requestedOrganizationId ?? resolvePlatformOrganizationId(req);
  if (!organizationId) {
    res.status(401).json({ error: "Authentication required." });
    return false;
  }

  try {
    const entitlement = await checkEntitlement({ organizationId, moduleCode, quantity: 1 });
    if (!entitlement.allowed) {
      res.status(403).json({
        error: "MODULE_NOT_ENABLED",
        moduleCode,
        message: "This module is not enabled for this organization.",
      });
      return false;
    }
    return true;
  } catch (error) {
    console.warn("[platform-integration] entitlement check failed", {
      organizationId,
      moduleCode,
      message: error instanceof Error ? error.message : String(error),
    });
    res.status(503).json({
      error: "PLATFORM_INTEGRATION_UNAVAILABLE",
      message: "Platform integration is temporarily unavailable.",
    });
    return false;
  }
}

export async function recordPlatformUsage(
  req: PlatformContextRequest,
  input: {
    moduleCode: string;
    quantity: number;
    sourceType: string;
    sourceId: string;
    metadataJson?: unknown;
    organizationId?: string | null;
  },
): Promise<string | null> {
  if (!isPlatformIntegrationEnabled()) {
    return null;
  }

  const organizationId = input.organizationId ?? resolvePlatformOrganizationId(req);
  if (!organizationId) {
    return "Usage recording failed";
  }

  return recordUsageWithWarning({
    organizationId,
    moduleCode: input.moduleCode,
    quantity: input.quantity,
    sourceType: input.sourceType,
    sourceId: input.sourceId,
    metadataJson: input.metadataJson,
  });
}

export function attachUsageWarning(res: Response, warning: string | null): void {
  if (!warning) {
    return;
  }
  res.setHeader("X-SSAMENJ-Usage-Warning", warning);
}
