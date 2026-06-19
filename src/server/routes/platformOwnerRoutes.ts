import { Router } from "express";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { prisma } from "../db/prisma";
import { requirePlatformOwner } from "../middleware/requirePlatformOwner";
import { hashPassword } from "../services/authService";
import { REPORT_LAB_PLANS, getPlanByCode } from "../../shared/constants/subscriptionPlans";
import { getClassesForSections } from "../../shared/constants/classes";
import { getSmartPagesPackage } from "../services/smartPagesService";
import type { SmartPagesPackageCode, SmartPagesPaymentNetwork, SmartPagesPaymentRequest } from "../../shared/types/smartPages";

const validPlanCodes = REPORT_LAB_PLANS.map((p) => p.code) as [string, ...string[]];

function ownerAudit(actorId: string, schoolId: string, action: string, details?: Record<string, unknown>) {
  return prisma.auditLog.create({ data: { schoolId, action, details: { actorUserId: actorId, ...details } } });
}

function smartPagesPaymentToDto(row: any): SmartPagesPaymentRequest {
  return {
    id: row.id as string,
    schoolId: row.schoolId as string,
    schoolName: row.school?.name as string | undefined,
    packageCode: row.packageCode as SmartPagesPackageCode,
    packageName: row.packageName as string,
    credits: row.credits as number,
    amountUgx: row.amountUgx as number,
    network: row.network as SmartPagesPaymentNetwork,
    merchantCode: row.merchantCode as string,
    merchantName: row.merchantName as string,
    paymentReference: row.paymentReference as string,
    transactionId: row.transactionId as string | null,
    payerPhone: row.payerPhone as string | null,
    proofScreenshotUrl: row.proofScreenshotUrl as string | null,
    status: row.status as SmartPagesPaymentRequest["status"],
    adminNotes: row.adminNotes as string | null,
    createdAt: (row.createdAt as Date).toISOString(),
    updatedAt: row.updatedAt ? (row.updatedAt as Date).toISOString() : undefined,
  };
}

export function platformOwnerRoutes() {
  const router = Router();

  // ── Dashboard stats ──────────────────────────────────────────────────────────

  router.get("/api/owner/dashboard", requirePlatformOwner, async (req, res, next) => {
    try {
      const [totalSchools, subscriptions, totalUsers, recentSchools] = await Promise.all([
        prisma.school.count(),
        prisma.reportLabSubscription.findMany({ select: { status: true } }),
        prisma.user.count({ where: { isPlatformOwner: false } }),
        prisma.school.findMany({
          orderBy: { createdAt: "desc" },
          take: 5,
          select: { id: true, code: true, name: true, createdAt: true },
        }),
      ]);

      const statusCounts = subscriptions.reduce<Record<string, number>>((acc, s) => {
        acc[s.status] = (acc[s.status] ?? 0) + 1;
        return acc;
      }, {});

      res.json({
        totalSchools,
        activeSchools: statusCounts["ACTIVE"] ?? 0,
        expiredSchools: statusCounts["EXPIRED"] ?? 0,
        suspendedSchools: statusCounts["SUSPENDED"] ?? 0,
        noSubscriptionSchools: totalSchools - subscriptions.length,
        totalUsers,
        recentSchools,
      });
    } catch (error) {
      next(error);
    }
  });

  // ── Schools ──────────────────────────────────────────────────────────────────

  router.get("/api/owner/schools", requirePlatformOwner, async (_req, res, next) => {
    try {
      const schools = await prisma.school.findMany({
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          code: true,
          name: true,
          phone: true,
          address: true,
          isActive: true,
          createdAt: true,
          subscription: { select: { planCode: true, status: true, currentPeriodEnd: true, studentLimit: true } },
          users: { where: { role: "ADMIN_OPERATOR", isActive: true, isPlatformOwner: false }, select: { id: true, name: true, email: true }, take: 1 },
          _count: { select: { students: true } },
        },
      });

      res.json({
        schools: schools.map((s) => ({
          id: s.id,
          code: s.code,
          name: s.name,
          phone: s.phone,
          address: s.address,
          isActive: s.isActive,
          createdAt: s.createdAt.toISOString(),
          subscription: s.subscription ?? null,
          primaryAdmin: s.users[0] ?? null,
          studentCount: s._count.students,
        })),
      });
    } catch (error) {
      next(error);
    }
  });

  // ── Users ────────────────────────────────────────────────────────────────────

  router.get("/api/owner/users", requirePlatformOwner, async (req, res, next) => {
    try {
      const search = typeof req.query.search === "string" ? req.query.search.trim() : undefined;
      const schoolId = typeof req.query.schoolId === "string" ? req.query.schoolId : undefined;
      const isActive = req.query.isActive === "false" ? false : req.query.isActive === "true" ? true : undefined;

      const users = await prisma.user.findMany({
        where: {
          isPlatformOwner: false,
          ...(schoolId ? { schoolId } : {}),
          ...(isActive !== undefined ? { isActive } : {}),
          ...(search
            ? {
                OR: [
                  { name: { contains: search, mode: "insensitive" } },
                  { email: { contains: search, mode: "insensitive" } },
                ],
              }
            : {}),
        },
        orderBy: { createdAt: "desc" },
        take: 200,
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          isActive: true,
          mustChangePassword: true,
          lastLoginAt: true,
          createdAt: true,
          school: { select: { id: true, code: true, name: true } },
        },
      });

      res.json({ users });
    } catch (error) {
      next(error);
    }
  });

  const createUserSchema = z.object({
    schoolId: z.string().uuid("Invalid school ID."),
    name: z.string().min(2, "Name must be at least 2 characters."),
    email: z.string().email("Enter a valid email address."),
    role: z.enum(["ADMIN_OPERATOR"]),
    temporaryPassword: z.string().min(8, "Password must be at least 8 characters."),
  });

  router.post("/api/owner/users", requirePlatformOwner, async (req, res, next) => {
    try {
      const body = createUserSchema.parse(req.body);

      const school = await prisma.school.findUnique({ where: { id: body.schoolId }, select: { id: true } });
      if (!school) {
        res.status(404).json({ error: "School not found." });
        return;
      }

      const existing = await prisma.user.findFirst({ where: { schoolId: body.schoolId, email: body.email.toLowerCase() } });
      if (existing) {
        res.status(409).json({ error: "A user with this email already exists in the selected school." });
        return;
      }

      const passwordHash = await hashPassword(body.temporaryPassword);
      const user = await prisma.user.create({
        data: {
          schoolId: body.schoolId,
          name: body.name,
          email: body.email.toLowerCase(),
          role: body.role,
          passwordHash,
          mustChangePassword: true,
          isActive: true,
        },
        select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true },
      });

      void ownerAudit(req.user!.userId, body.schoolId, "OWNER_CREATE_USER", { targetUserId: user.id, email: user.email }).catch(() => {});

      res.status(201).json({ user, mustChangePassword: true });
    } catch (error) {
      next(error);
    }
  });

  router.patch("/api/owner/users/:userId", requirePlatformOwner, async (req, res, next) => {
    try {
      const { userId } = req.params;
      const body = z.object({ name: z.string().min(2).optional(), role: z.enum(["ADMIN_OPERATOR"]).optional() }).parse(req.body);

      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user || user.isPlatformOwner) {
        res.status(404).json({ error: "User not found." });
        return;
      }

      const updated = await prisma.user.update({
        where: { id: userId },
        data: body,
        select: { id: true, name: true, email: true, role: true, isActive: true },
      });

      void ownerAudit(req.user!.userId, user.schoolId, "OWNER_UPDATE_USER", { targetUserId: userId, changes: body }).catch(() => {});
      res.json({ user: updated });
    } catch (error) {
      next(error);
    }
  });

  router.post("/api/owner/users/:userId/reset-password", requirePlatformOwner, async (req, res, next) => {
    try {
      const { userId } = req.params;
      const { temporaryPassword } = z.object({ temporaryPassword: z.string().min(8) }).parse(req.body);

      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user || user.isPlatformOwner) {
        res.status(404).json({ error: "User not found." });
        return;
      }

      const passwordHash = await hashPassword(temporaryPassword);
      await prisma.user.update({ where: { id: userId }, data: { passwordHash, mustChangePassword: true } });

      void ownerAudit(req.user!.userId, user.schoolId, "OWNER_RESET_PASSWORD", { targetUserId: userId }).catch(() => {});
      res.json({ ok: true, mustChangePassword: true });
    } catch (error) {
      next(error);
    }
  });

  router.post("/api/owner/users/:userId/disable", requirePlatformOwner, async (req, res, next) => {
    try {
      const { userId } = req.params;
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user || user.isPlatformOwner) {
        res.status(404).json({ error: "User not found." });
        return;
      }

      await prisma.user.update({ where: { id: userId }, data: { isActive: false } });
      void ownerAudit(req.user!.userId, user.schoolId, "OWNER_DISABLE_USER", { targetUserId: userId }).catch(() => {});
      res.json({ ok: true });
    } catch (error) {
      next(error);
    }
  });

  router.post("/api/owner/users/:userId/enable", requirePlatformOwner, async (req, res, next) => {
    try {
      const { userId } = req.params;
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user || user.isPlatformOwner) {
        res.status(404).json({ error: "User not found." });
        return;
      }

      await prisma.user.update({ where: { id: userId }, data: { isActive: true } });
      void ownerAudit(req.user!.userId, user.schoolId, "OWNER_ENABLE_USER", { targetUserId: userId }).catch(() => {});
      res.json({ ok: true });
    } catch (error) {
      next(error);
    }
  });

  // ── School creation ──────────────────────────────────────────────────────────

  const createSchoolSchema = z.object({
    schoolName: z.string().min(2, "School name must be at least 2 characters.").max(200),
    schoolCode: z
      .string()
      .min(2, "School code must be at least 2 characters.")
      .max(50, "School code must be at most 50 characters.")
      .regex(/^[A-Z0-9-]+$/, "School code must be uppercase letters, digits, and hyphens only. No spaces."),
    phone: z.string().max(50).optional(),
    address: z.string().max(500).optional(),
    sections: z.array(z.enum(["NURSERY", "PRIMARY", "SECONDARY"])).min(1, "At least one section is required."),
    planCode: z.enum(validPlanCodes as [string, ...string[]]),
    trialDays: z.number().int().min(0).max(365).optional(),
    adminName: z.string().min(2, "Admin name must be at least 2 characters.").max(100),
    adminEmail: z.string().email("Enter a valid admin email."),
    adminTemporaryPassword: z.string().min(8, "Password must be at least 8 characters."),
  });

  router.post("/api/owner/schools", requirePlatformOwner, async (req, res, next) => {
    try {
      const body = createSchoolSchema.parse(req.body);

      const existing = await prisma.school.findUnique({ where: { code: body.schoolCode } });
      if (existing) {
        res.status(409).json({ error: `School code ${body.schoolCode} is already in use.` });
        return;
      }

      const passwordHash = await hashPassword(body.adminTemporaryPassword);
      const plan = getPlanByCode(body.planCode);
      const classDefs = getClassesForSections(body.sections);

      const result = await prisma.$transaction(async (tx) => {
        const school = await tx.school.create({
          data: {
            code: body.schoolCode,
            name: body.schoolName,
            phone: body.phone ?? null,
            address: body.address ?? null,
            isActive: true,
          },
        });

        if (classDefs.length > 0) {
          await tx.schoolClass.createMany({
            data: classDefs.map((def) => ({
              schoolId: school.id,
              name: def.name,
              code: def.code,
              level: def.level,
            })),
          });
        }

        const now = new Date();
        const isTrialPeriod = (body.trialDays ?? 0) > 0;
        const periodEnd = isTrialPeriod
          ? new Date(now.getTime() + body.trialDays! * 24 * 60 * 60 * 1000)
          : new Date(now.getFullYear() + 1, now.getMonth(), now.getDate());

        const sub = await tx.reportLabSubscription.create({
          data: {
            schoolId: school.id,
            planCode: body.planCode,
            billingCycle: "YEAR",
            studentLimit: plan?.studentLimit ?? null,
            currentPeriodStart: now,
            currentPeriodEnd: periodEnd,
            status: isTrialPeriod ? "TRIAL" : "ACTIVE",
          },
        });

        const invoice = await tx.reportLabInvoice.create({
          data: {
            subscriptionId: sub.id,
            setupFeeUgx: plan?.setupFeeUgx ?? 0,
            amountUgx: plan?.annualLicenseUgx ?? 0,
            totalUgx: (plan?.setupFeeUgx ?? 0) + (plan?.annualLicenseUgx ?? 0),
            status: "UNPAID",
          },
        });

        const admin = await tx.user.create({
          data: {
            schoolId: school.id,
            name: body.adminName,
            email: body.adminEmail.toLowerCase(),
            passwordHash,
            role: "ADMIN_OPERATOR",
            isActive: true,
            mustChangePassword: true,
          },
        });

        await tx.auditLog.create({
          data: {
            schoolId: school.id,
            action: "OWNER_CREATE_SCHOOL",
            details: {
              actorUserId: req.user!.userId,
              schoolCode: school.code,
              schoolName: school.name,
              planCode: body.planCode,
              sections: body.sections,
              classesSeeded: classDefs.length,
              adminEmail: admin.email,
              trialDays: body.trialDays ?? null,
            },
          },
        });

        return { school, sub, invoice, admin };
      });

      res.status(201).json({
        ok: true,
        school: {
          id: result.school.id,
          code: result.school.code,
          name: result.school.name,
          phone: result.school.phone,
          address: result.school.address,
          isActive: result.school.isActive,
        },
        subscription: {
          id: result.sub.id,
          planCode: result.sub.planCode,
          status: result.sub.status,
          currentPeriodEnd: result.sub.currentPeriodEnd.toISOString(),
          studentLimit: result.sub.studentLimit,
        },
        invoice: {
          id: result.invoice.id,
          setupFeeUgx: result.invoice.setupFeeUgx,
          amountUgx: result.invoice.amountUgx,
          totalUgx: result.invoice.totalUgx,
          status: result.invoice.status,
        },
        admin: {
          id: result.admin.id,
          email: result.admin.email,
          name: result.admin.name,
          mustChangePassword: true,
        },
        classesSeeded: classDefs.length,
      });
    } catch (error) {
      next(error);
    }
  });

  // ── Single school ────────────────────────────────────────────────────────────

  router.get("/api/owner/schools/:schoolId", requirePlatformOwner, async (req, res, next) => {
    try {
      const { schoolId } = req.params;
      const school = await prisma.school.findUnique({
        where: { id: schoolId },
        select: {
          id: true,
          code: true,
          name: true,
          phone: true,
          address: true,
          isActive: true,
          createdAt: true,
          subscription: {
            select: { id: true, planCode: true, status: true, currentPeriodEnd: true, studentLimit: true },
          },
          users: {
            where: { isPlatformOwner: false },
            select: { id: true, name: true, email: true, role: true, isActive: true, lastLoginAt: true },
            orderBy: { createdAt: "asc" },
          },
          _count: { select: { students: true } },
        },
      });

      if (!school) {
        res.status(404).json({ error: "School not found." });
        return;
      }

      res.json({
        school: {
          ...school,
          createdAt: school.createdAt.toISOString(),
          studentCount: school._count.students,
          subscription: school.subscription ?? null,
          _count: undefined,
        },
      });
    } catch (error) {
      next(error);
    }
  });

  // ── Update / disable school ──────────────────────────────────────────────────

  const patchSchoolSchema = z.object({
    name: z.string().min(2).max(200).optional(),
    phone: z.string().max(50).nullable().optional(),
    address: z.string().max(500).nullable().optional(),
    isActive: z.boolean().optional(),
  });

  router.patch("/api/owner/schools/:schoolId", requirePlatformOwner, async (req, res, next) => {
    try {
      const { schoolId } = req.params;
      const body = patchSchoolSchema.parse(req.body);

      const school = await prisma.school.findUnique({ where: { id: schoolId } });
      if (!school) {
        res.status(404).json({ error: "School not found." });
        return;
      }

      const updated = await prisma.school.update({
        where: { id: schoolId },
        data: {
          ...(body.name !== undefined ? { name: body.name } : {}),
          ...(body.phone !== undefined ? { phone: body.phone } : {}),
          ...(body.address !== undefined ? { address: body.address } : {}),
          ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
        },
        select: { id: true, code: true, name: true, phone: true, address: true, isActive: true },
      });

      const action = body.isActive === false ? "OWNER_DISABLE_SCHOOL" : body.isActive === true ? "OWNER_ENABLE_SCHOOL" : "OWNER_UPDATE_SCHOOL";
      void ownerAudit(req.user!.userId, schoolId, action, { changes: body }).catch(() => {});
      res.json({ ok: true, school: updated });
    } catch (error) {
      next(error);
    }
  });

  // ── Smart Pages payments ───────────────────────────────────────────────────

  router.get("/api/owner/smart-pages/payments", requirePlatformOwner, async (req, res, next) => {
    try {
      const status = typeof req.query.status === "string" ? req.query.status : "PENDING";
      const payments = await (prisma as any).smartPagePaymentRequest.findMany({
        where: status === "ALL" ? {} : { status },
        orderBy: { createdAt: "desc" },
        take: 100,
        include: { school: { select: { id: true, code: true, name: true } } },
      });
      res.json({ payments: payments.map(smartPagesPaymentToDto) });
    } catch (error) {
      next(error);
    }
  });

  router.get("/api/owner/smart-pages/usage", requirePlatformOwner, async (_req, res, next) => {
    try {
      const rows = await (prisma as any).smartPageLedger.findMany({
        orderBy: { createdAt: "desc" },
        take: 100,
      });
      const schoolIds = [...new Set(rows.map((row: any) => row.schoolId as string))];
      const schools = await prisma.school.findMany({
        where: { id: { in: schoolIds } },
        select: { id: true, name: true, code: true },
      });
      const schoolMap = new Map(schools.map((school) => [school.id, school]));
      res.json({
        ledger: rows.map((row: any) => {
          const school = schoolMap.get(row.schoolId as string);
          return {
            id: row.id,
            schoolId: row.schoolId,
            schoolName: school ? `${school.name} (${school.code})` : undefined,
            operation: row.operation ?? row.action,
            pagesProcessed: row.pagesProcessed ?? row.pagesCharged,
            creditsUsed: row.creditsCharged ?? row.pagesCharged,
            creditsRemainingAfter: null,
            priceUgx: row.priceUgx ?? 0,
            status: row.status,
            createdAt: (row.createdAt as Date).toISOString(),
            model: row.model ?? "",
            tokenUsage: row.tokenUsage ?? null,
            geminiCostEstimateUgx: row.geminiCostEstimateUgx ?? null,
            marginEstimateUgx: row.marginEstimateUgx ?? null,
          };
        }),
      });
    } catch (error) {
      next(error);
    }
  });

  const paymentDecisionSchema = z.object({
    notes: z.string().max(1000).optional(),
  });

  router.post("/api/owner/smart-pages/payments/:paymentId/confirm", requirePlatformOwner, async (req, res, next) => {
    try {
      const { paymentId } = req.params;
      const body = paymentDecisionSchema.parse(req.body);
      const payment = await (prisma as any).smartPagePaymentRequest.findUnique({
        where: { id: paymentId },
        include: { school: { select: { id: true, code: true, name: true } } },
      });
      if (!payment) {
        res.status(404).json({ error: "Payment request not found." });
        return;
      }
      if (payment.status !== "PENDING") {
        res.status(409).json({ error: "Only pending payments can be confirmed." });
        return;
      }
      if (!payment.transactionId) {
        res.status(400).json({ error: "Transaction ID is required before confirmation." });
        return;
      }

      const pkg = getSmartPagesPackage(payment.packageCode as SmartPagesPackageCode);
      if (!pkg || pkg.priceUgx !== payment.amountUgx || pkg.credits !== payment.credits) {
        res.status(400).json({ error: "Payment package no longer matches Smart Pages pricing." });
        return;
      }

      const now = new Date();
      const cycleEnd = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate());
      const db = prisma as any;
      const updated = await db.$transaction(async (tx: any) => {
        const confirmed = await tx.smartPagePaymentRequest.update({
          where: { id: payment.id },
          data: {
            status: "CONFIRMED",
            adminNotes: body.notes ?? null,
            confirmedByUserId: req.user!.userId,
            confirmedAt: now,
          },
          include: { school: { select: { id: true, code: true, name: true } } },
        });

        await tx.schoolSmartPagePlan.upsert({
          where: { schoolId: payment.schoolId },
          update: {
            topUpPages: { increment: payment.credits },
            status: "ACTIVE",
          },
          create: {
            schoolId: payment.schoolId,
            planName: payment.packageCode,
            includedPages: payment.credits,
            billingCycle: "ACADEMIC_YEAR",
            cycleStart: now,
            cycleEnd,
            usedPages: 0,
            topUpPages: 0,
            rolloverPages: 0,
            status: "ACTIVE",
            allowHighAccuracy: payment.packageCode === "SCHOOL_PRO",
          },
        });

        await tx.smartPageLedger.create({
          data: {
            id: randomUUID(),
            schoolId: payment.schoolId,
            jobId: payment.id,
            fileHash: payment.paymentReference,
            pagesCharged: 0,
            creditsCharged: payment.credits,
            operation: "TOP_UP",
            pagesProcessed: 0,
            priceUgx: payment.amountUgx,
            action: "TOP_UP",
            reason: `Confirmed ${payment.packageName} payment`,
            provider: payment.network,
            model: "",
            extractionMode: "balanced",
            status: "CHARGED",
            tokenUsage: null,
            geminiCostEstimateUgx: 0,
            marginEstimateUgx: payment.amountUgx,
          },
        });

        await tx.auditLog.create({
          data: {
            schoolId: payment.schoolId,
            action: "SMART_PAGES_PAYMENT_CONFIRMED",
            correlationId: payment.id,
            details: {
              actorUserId: req.user!.userId,
              network: payment.network,
              merchantCode: payment.merchantCode,
              transactionId: payment.transactionId,
              packageCode: payment.packageCode,
              credits: payment.credits,
              amountUgx: payment.amountUgx,
            },
          },
        });
        return confirmed;
      });

      res.json({ payment: smartPagesPaymentToDto(updated) });
    } catch (error) {
      next(error);
    }
  });

  router.post("/api/owner/smart-pages/payments/:paymentId/reject", requirePlatformOwner, async (req, res, next) => {
    try {
      const { paymentId } = req.params;
      const body = paymentDecisionSchema.parse(req.body);
      const payment = await (prisma as any).smartPagePaymentRequest.findUnique({
        where: { id: paymentId },
        include: { school: { select: { id: true, code: true, name: true } } },
      });
      if (!payment) {
        res.status(404).json({ error: "Payment request not found." });
        return;
      }
      if (payment.status !== "PENDING") {
        res.status(409).json({ error: "Only pending payments can be rejected." });
        return;
      }
      const updated = await (prisma as any).smartPagePaymentRequest.update({
        where: { id: payment.id },
        data: { status: "REJECTED", adminNotes: body.notes ?? null, rejectedAt: new Date(), rejectedByUserId: req.user!.userId },
        include: { school: { select: { id: true, code: true, name: true } } },
      });
      void ownerAudit(req.user!.userId, payment.schoolId, "SMART_PAGES_PAYMENT_REJECTED", {
        paymentId: payment.id,
        network: payment.network,
        transactionId: payment.transactionId,
        notes: body.notes ?? null,
      }).catch(() => {});
      res.json({ payment: smartPagesPaymentToDto(updated) });
    } catch (error) {
      next(error);
    }
  });

  // ── Telegram connectivity test ────────────────────────────────────────────────

  router.post("/api/owner/test-telegram", requirePlatformOwner, async (req, res, next) => {
    try {
      const { sendTelegramMessage } = await import("../services/telegramService");
      const result = await sendTelegramMessage(
        `[School Connect] Telegram test from Smart Pages billing — ENV: ${process.env.NODE_ENV ?? "unknown"}`,
      );
      if (result.ok) {
        res.json({ ok: true });
      } else {
        res.json({ ok: false, error: result.error });
      }
    } catch (error) {
      next(error);
    }
  });

  return router;
}

