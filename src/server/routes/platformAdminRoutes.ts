import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db/prisma";
import { requirePlatformKey } from "../middleware/requirePlatformKey";
import { provisionSchool } from "../services/schoolProvisioningService";
import { REPORT_LAB_PLANS, getPlanByCode } from "../../shared/constants/subscriptionPlans";

const validPlanCodes = REPORT_LAB_PLANS.map((p) => p.code) as [string, ...string[]];

const provisionSchema = z.object({
  schoolCode: z
    .string()
    .min(1)
    .max(50)
    .regex(/^[A-Z0-9-]+$/, "schoolCode must be uppercase letters, digits, and hyphens only."),
  schoolName: z.string().min(1).max(200),
  sections: z
    .array(z.enum(["NURSERY", "PRIMARY", "SECONDARY"]))
    .min(1, "At least one section is required."),
  adminEmail: z.string().email("adminEmail must be a valid email address."),
  adminName: z.string().min(1).max(100),
  adminPassword: z.string().min(8, "adminPassword must be at least 8 characters."),
});

const subscriptionSchema = z.object({
  planCode: z.enum(validPlanCodes as [string, ...string[]]),
  currentPeriodStart: z.string().datetime(),
  currentPeriodEnd: z.string().datetime(),
  status: z.enum(["ACTIVE", "EXPIRED", "SUSPENDED", "PENDING"]).default("ACTIVE"),
  invoice: z.object({
    setupFeeUgx: z.number().int().min(0),
    amountUgx: z.number().int().min(0),
    totalUgx: z.number().int().min(0),
    status: z.enum(["UNPAID", "PAID", "CANCELLED"]).default("UNPAID"),
    notes: z.string().optional(),
  }),
});

export function platformAdminRoutes() {
  const router = Router();

  router.post("/api/platform/schools", requirePlatformKey, async (req, res, next) => {
    try {
      const input = provisionSchema.parse(req.body);
      const result = await provisionSchool(prisma, input);
      res.status(201).json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  });

  router.post(
    "/api/platform/schools/:schoolCode/subscription",
    requirePlatformKey,
    async (req, res, next) => {
      try {
        const { schoolCode } = req.params as { schoolCode: string };
        const input = subscriptionSchema.parse(req.body);
        const plan = getPlanByCode(input.planCode);

        const school = await prisma.school.findUnique({ where: { code: schoolCode } });
        if (!school) {
          res.status(404).json({ error: `School not found: ${schoolCode}` });
          return;
        }

        const sub = await prisma.reportLabSubscription.upsert({
          where: { schoolId: school.id },
          update: {
            planCode: input.planCode,
            studentLimit: plan?.studentLimit ?? null,
            currentPeriodStart: new Date(input.currentPeriodStart),
            currentPeriodEnd: new Date(input.currentPeriodEnd),
            status: input.status,
          },
          create: {
            schoolId: school.id,
            planCode: input.planCode,
            billingCycle: "YEAR",
            studentLimit: plan?.studentLimit ?? null,
            currentPeriodStart: new Date(input.currentPeriodStart),
            currentPeriodEnd: new Date(input.currentPeriodEnd),
            status: input.status,
          },
        });

        const invoice = await prisma.reportLabInvoice.create({
          data: {
            subscriptionId: sub.id,
            setupFeeUgx: input.invoice.setupFeeUgx,
            amountUgx: input.invoice.amountUgx,
            totalUgx: input.invoice.totalUgx,
            status: input.invoice.status,
            paidAt: input.invoice.status === "PAID" ? new Date() : null,
            notes: input.invoice.notes ?? null,
          },
        });

        res.status(200).json({
          success: true,
          subscription: { id: sub.id, planCode: sub.planCode, status: sub.status },
          invoice: { id: invoice.id, totalUgx: invoice.totalUgx, status: invoice.status },
        });
      } catch (error) {
        next(error);
      }
    },
  );

  return router;
}
