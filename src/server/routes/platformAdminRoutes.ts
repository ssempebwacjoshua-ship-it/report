import { randomUUID } from "node:crypto";
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
  reason: z.string().trim().min(5, "reason is required for subscription changes.").max(1000),
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
        const requestId = typeof req.headers["x-request-id"] === "string" && req.headers["x-request-id"].trim()
          ? req.headers["x-request-id"].trim()
          : randomUUID();

        const school = await prisma.school.findUnique({ where: { code: schoolCode } });
        if (!school) {
          res.status(404).json({ error: `School not found: ${schoolCode}` });
          return;
        }

        const { sub, invoice } = await prisma.$transaction(async (tx) => {
          const sub = await tx.reportLabSubscription.upsert({
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

          const invoice = await tx.reportLabInvoice.create({
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

          await tx.auditLog.create({
            data: {
              schoolId: school.id,
              action: "PLATFORM_ADMIN_SUBSCRIPTION_CHANGED",
              correlationId: requestId,
              details: {
                actorUserId: "platform-admin-key",
                tenant: school.id,
                target: sub.id,
                requestId,
                reason: input.reason,
                planCode: input.planCode,
                status: input.status,
                invoiceId: invoice.id,
              },
            },
          });

          return { sub, invoice };
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

  const repairSchema = z.object({
    wrongDomain: z.string().url("wrongDomain must be an absolute URL (no trailing slash)."),
    correctDomain: z.string().url("correctDomain must be an absolute URL (no trailing slash)."),
    dryRun: z.boolean().default(true),
  });

  router.post("/api/platform/nfc-tags/repair-urls", requirePlatformKey, async (req, res, next) => {
    try {
      const { wrongDomain, correctDomain, dryRun } = repairSchema.parse(req.body);

      const wrong = wrongDomain.replace(/\/+$/, "");
      const correct = correctDomain.replace(/\/+$/, "");

      const affected = await prisma.nfcTag.count({
        where: { writtenUrl: { startsWith: wrong } },
      });

      if (dryRun) {
        res.json({ dryRun: true, affected, wrong, correct });
        return;
      }

      await prisma.$executeRaw`
        UPDATE "NfcTag"
        SET "writtenUrl" = replace("writtenUrl", ${wrong}, ${correct})
        WHERE "writtenUrl" LIKE ${wrong + "%"}
      `;

      res.json({ dryRun: false, updated: affected, wrong, correct });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
