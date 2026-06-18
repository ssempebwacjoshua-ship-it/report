import { Router } from "express";
import { prisma } from "../db/prisma";
import type { SubscriptionResponse } from "../../shared/types/subscription";

export function subscriptionRoutes() {
  const router = Router();

  router.get("/api/subscription", async (req, res, next) => {
    try {
      const schoolId = req.school!.id;

      const sub = await prisma.reportLabSubscription.findUnique({
        where: { schoolId },
        include: {
          invoices: {
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
      });

      if (!sub) {
        const body: SubscriptionResponse = { subscription: null };
        res.json(body);
        return;
      }

      const latestInvoice = sub.invoices[0] ?? null;

      const body: SubscriptionResponse = {
        subscription: {
          id: sub.id,
          planCode: sub.planCode,
          billingCycle: sub.billingCycle as "YEAR",
          studentLimit: sub.studentLimit,
          currentPeriodStart: sub.currentPeriodStart.toISOString(),
          currentPeriodEnd: sub.currentPeriodEnd.toISOString(),
          status: sub.status as "ACTIVE" | "EXPIRED" | "SUSPENDED" | "PENDING",
          latestInvoice: latestInvoice
            ? {
                id: latestInvoice.id,
                setupFeeUgx: latestInvoice.setupFeeUgx,
                amountUgx: latestInvoice.amountUgx,
                totalUgx: latestInvoice.totalUgx,
                status: latestInvoice.status as "UNPAID" | "PAID" | "CANCELLED",
                paidAt: latestInvoice.paidAt?.toISOString() ?? null,
                notes: latestInvoice.notes,
                createdAt: latestInvoice.createdAt.toISOString(),
              }
            : null,
        },
      };

      res.json(body);
    } catch (error) {
      next(error);
    }
  });

  return router;
}

