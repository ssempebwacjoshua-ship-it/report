import type { NextFunction, Request, Response } from "express";
import type { PrismaClient, SubscriptionStatus } from "@prisma/client";
import { prisma } from "../db/prisma";

export type SubscriptionEntitlement =
  | "report.generate"
  | "report.bulk_generate"
  | "student.import.commit"
  | "marks.import.commit"
  | "ocr.scan"
  | "smart_pages.ai"
  | "settings.premium_branding"
  | "report.download"
  | "communications.send";

export type EntitlementDecision = {
  allowed: boolean;
  code: string;
  message: string;
  status: number;
  subscriptionStatus?: SubscriptionStatus | null;
};

const ACTIVE_STATUSES = new Set<SubscriptionStatus>(["ACTIVE", "TRIAL"]);

function deny(code: string, message: string, status = 402, subscriptionStatus?: SubscriptionStatus | null): EntitlementDecision {
  return { allowed: false, code, message, status, subscriptionStatus };
}

export async function evaluateSubscriptionEntitlement(input: {
  db?: PrismaClient;
  schoolId: string | null | undefined;
  entitlement: SubscriptionEntitlement;
  now?: Date;
}): Promise<EntitlementDecision> {
  if (!input.schoolId) {
    return deny("SUBSCRIPTION_TENANT_REQUIRED", "School context is required for this operation.", 403, null);
  }

  const db = input.db ?? prisma;
  const now = input.now ?? new Date();
  const subscription = await db.reportLabSubscription.findUnique({
    where: { schoolId: input.schoolId },
    select: { status: true, currentPeriodEnd: true },
  });

  if (!subscription) {
    return deny("SUBSCRIPTION_REQUIRED", "An active subscription is required for this operation.", 402, null);
  }

  if (!ACTIVE_STATUSES.has(subscription.status)) {
    const code = subscription.status === "SUSPENDED"
      ? "SUBSCRIPTION_SUSPENDED"
      : subscription.status === "EXPIRED"
      ? "SUBSCRIPTION_EXPIRED"
      : "SUBSCRIPTION_NOT_ACTIVE";
    return deny(code, "This paid operation is unavailable for the current subscription state.", 402, subscription.status);
  }

  if (subscription.currentPeriodEnd <= now) {
    return deny("SUBSCRIPTION_EXPIRED", "The subscription period has expired for this paid operation.", 402, subscription.status);
  }

  return {
    allowed: true,
    code: "SUBSCRIPTION_ENTITLED",
    message: "Subscription permits this operation.",
    status: 200,
    subscriptionStatus: subscription.status,
  };
}

export function entitlementErrorBody(decision: EntitlementDecision, entitlement: SubscriptionEntitlement) {
  return {
    ok: false,
    error: true,
    code: decision.code,
    message: decision.message,
    details: [{ entitlement, subscriptionStatus: decision.subscriptionStatus ?? null }],
  };
}

export function requireSubscriptionEntitlement(entitlement: SubscriptionEntitlement) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const decision = await evaluateSubscriptionEntitlement({ schoolId: req.school?.id ?? req.user?.schoolId, entitlement });
      if (!decision.allowed) {
        res.status(decision.status).json(entitlementErrorBody(decision, entitlement));
        return;
      }
      next();
    } catch (error) {
      next(error);
    }
  };
}

export function requireCreatorSchoolEntitlement(entitlement: SubscriptionEntitlement) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const creator = (req as Request & { creator?: { schoolId?: string | null } }).creator;
      if (!creator?.schoolId) {
        next();
        return;
      }
      const decision = await evaluateSubscriptionEntitlement({ schoolId: creator.schoolId, entitlement });
      if (!decision.allowed) {
        res.status(decision.status).json(entitlementErrorBody(decision, entitlement));
        return;
      }
      next();
    } catch (error) {
      next(error);
    }
  };
}
