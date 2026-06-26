import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db/prisma";
import { signToken, verifyPassword, verifyToken, type SchoolUserRole } from "../services/authService";
import { validateSchoolSession } from "../services/sessionValidationService";

const loginSchema = z.object({
  email: z.string().email("Enter a valid email address."),
  password: z.string().min(1, "Password is required."),
  schoolCode: z.string().min(1, "School code is required."),
});

async function writeLoginAudit(schoolId: string, action: "auth.login_success" | "auth.login_failed", details: Record<string, unknown>) {
  await prisma.auditLog.create({
    data: {
      schoolId,
      action,
      details,
    },
  });
}

export function authRoutes() {
  const router = Router();

  router.post("/api/auth/login", async (req, res, next) => {
    try {
      const { email, password, schoolCode } = loginSchema.parse(req.body);
      const normalizedEmail = email.toLowerCase();
      let auditSchoolId: string | null = null;

      let user: { id: string; schoolId: string; name: string; email: string; role: SchoolUserRole; passwordHash: string; isActive: boolean; isPlatformOwner: boolean; tokenVersion: number } | null = null;

      if (schoolCode === "PLATFORM") {
        user = await prisma.user.findFirst({
          where: { email: normalizedEmail, isPlatformOwner: true, isActive: true },
        });
        auditSchoolId = user?.schoolId ?? null;
      } else {
        const school = await prisma.school.findUnique({ where: { code: schoolCode } });
        if (!school) {
          res.status(401).json({ error: "Invalid credentials." });
          return;
        }
        auditSchoolId = school.id;
        if (!school.isActive) {
          await writeLoginAudit(school.id, "auth.login_failed", {
            email: normalizedEmail,
            schoolCode,
            reason: "SCHOOL_SUSPENDED",
          });
          res.status(403).json({ error: "This school account has been suspended. Please contact support." });
          return;
        }
        user = await prisma.user.findFirst({
          where: { schoolId: school.id, email: normalizedEmail, isActive: true },
        });
      }

      const passwordMatch = user ? await verifyPassword(password, user.passwordHash) : false;

      if (!user || !passwordMatch) {
        if (auditSchoolId) {
          await writeLoginAudit(auditSchoolId, "auth.login_failed", {
            email: normalizedEmail,
            schoolCode,
            reason: "INVALID_CREDENTIALS",
          });
        }
        res.status(401).json({ error: "Invalid credentials." });
        return;
      }

      void prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } }).catch(() => {});
      await writeLoginAudit(user.schoolId, "auth.login_success", {
        email: user.email,
        schoolCode,
        userId: user.id,
        role: user.role,
        isPlatformOwner: user.isPlatformOwner,
      });

      const token = signToken({
        userId: user.id,
        schoolId: user.schoolId,
        name: user.name,
        email: user.email,
        role: user.role,
        tokenVersion: user.tokenVersion,
        ...(user.isPlatformOwner ? { isPlatformOwner: true } : {}),
      });

      res.json({
        token,
        user: {
          id: user.id,
          schoolId: user.schoolId,
          name: user.name,
          email: user.email,
          role: user.role,
          ...(user.isPlatformOwner ? { isPlatformOwner: true } : {}),
        },
      });
    } catch (error) {
      next(error);
    }
  });

  router.get("/api/auth/me", async (req, res, next) => {
    try {
      const authHeader = req.headers.authorization;
      const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

      if (!token) {
        res.status(401).json({ error: "Not authenticated." });
        return;
      }

      const payload = verifyToken(token);
      if (!payload) {
        res.status(401).json({ error: "Invalid or expired session." });
        return;
      }

      const session = await validateSchoolSession(payload);
      if (!session) {
        res.status(401).json({ error: "Invalid or expired session." });
        return;
      }

      res.json({
        user: {
          id: session.user.id,
          schoolId: session.user.schoolId,
          name: session.user.name,
          email: session.user.email,
          role: session.user.role,
          ...(session.user.isPlatformOwner ? { isPlatformOwner: true } : {}),
        },
      });
    } catch (error) {
      next(error);
    }
  });

  router.post("/api/auth/logout", (_req, res) => {
    res.json({ ok: true });
  });

  return router;
}
