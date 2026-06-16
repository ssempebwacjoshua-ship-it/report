import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db/prisma";
import { requirePlatformOwner } from "../middleware/requirePlatformOwner";
import { hashPassword } from "../services/authService";

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
          createdAt: true,
          subscription: { select: { planCode: true, status: true, currentPeriodEnd: true, studentLimit: true } },
          users: { where: { role: "ADMIN_OPERATOR", isActive: true }, select: { id: true, name: true, email: true }, take: 1 },
          _count: { select: { students: true, enrollments: true } },
        },
      });

      res.json({
        schools: schools.map((s) => ({
          id: s.id,
          code: s.code,
          name: s.name,
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

  return router;
}
