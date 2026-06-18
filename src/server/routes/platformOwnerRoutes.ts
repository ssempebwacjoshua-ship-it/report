import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db/prisma";
import { requirePlatformOwner } from "../middleware/requirePlatformOwner";
import { hashPassword } from "../services/authService";
import { REPORT_LAB_PLANS, getPlanByCode } from "../../shared/constants/subscriptionPlans";
import { getClassesForSections } from "../../shared/constants/classes";

const validPlanCodes = REPORT_LAB_PLANS.map((p) => p.code) as [string, ...string[]];

function ownerAudit(actorId: string, schoolId: string, action: string, details?: Record<string, unknown>) {
  return prisma.auditLog.create({ data: { schoolId, action, details: { actorUserId: actorId, ...details } } });
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

  return router;
}

