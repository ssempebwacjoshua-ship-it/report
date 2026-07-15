import { describe, expect, it, vi } from "vitest";
import { evaluateSubscriptionEntitlement } from "../../server/services/subscriptionEntitlementService";

function dbWithSubscription(subscription: { status: string; currentPeriodEnd: Date } | null) {
  return {
    reportLabSubscription: {
      findUnique: vi.fn().mockResolvedValue(subscription),
    },
  } as any;
}

describe("subscriptionEntitlementService", () => {
  it("permits active subscriptions for paid operations", async () => {
    const decision = await evaluateSubscriptionEntitlement({
      db: dbWithSubscription({ status: "ACTIVE", currentPeriodEnd: new Date("2030-01-01") }),
      schoolId: "school-1",
      entitlement: "report.generate",
      now: new Date("2026-01-01"),
    });

    expect(decision.allowed).toBe(true);
  });

  it("rejects direct paid-operation bypass when subscription is missing", async () => {
    const decision = await evaluateSubscriptionEntitlement({
      db: dbWithSubscription(null),
      schoolId: "school-1",
      entitlement: "ocr.scan",
    });

    expect(decision.allowed).toBe(false);
    expect(decision.code).toBe("SUBSCRIPTION_REQUIRED");
  });

  it("treats communications sending as a paid entitlement and fails closed without a subscription", async () => {
    const decision = await evaluateSubscriptionEntitlement({
      db: dbWithSubscription(null),
      schoolId: "school-1",
      entitlement: "communications.send",
    });

    expect(decision.allowed).toBe(false);
    expect(decision.code).toBe("SUBSCRIPTION_REQUIRED");
  });

  it("rejects expired or suspended subscriptions without mutating historical data", async () => {
    for (const status of ["EXPIRED", "SUSPENDED"] as const) {
      const db = dbWithSubscription({ status, currentPeriodEnd: new Date("2030-01-01") });
      const decision = await evaluateSubscriptionEntitlement({
        db,
        schoolId: "school-1",
        entitlement: "student.import.commit",
      });

      expect(decision.allowed).toBe(false);
      expect(db.reportLabSubscription.findUnique).toHaveBeenCalledTimes(1);
    }
  });
});
