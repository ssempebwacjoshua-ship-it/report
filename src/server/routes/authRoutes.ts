import { Router } from "express";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "../db/prisma";
import { isSupportedPasswordHash, normalizeLoginEmail, normalizeSchoolCode, signToken, verifyPassword, verifyToken, type SchoolUserRole } from "../services/authService";
import { classifyRuntimeEnvironment } from "../security/environmentSafety";
import { validateSchoolSession } from "../services/sessionValidationService";
import { consumeAccountSetup, requestPasswordReset, resetPasswordWithOtp } from "../services/authTokenService";

const loginSchema = z.object({
  email: z.string().email("Enter a valid email address."),
  password: z.string().min(1, "Password is required."),
  schoolCode: z.string().min(1, "School code is required."),
});

const forgotPasswordSchema = z.object({
  schoolCode: z.string().min(1, "School code is required."),
  email: z.string().email("Enter a valid email address."),
});

const tokenPasswordSchema = z.object({
  token: z.string().min(32, "Token is required."),
  password: z.string().min(10, "Password must be at least 10 characters."),
});

const otpResetSchema = z.object({
  schoolCode: z.string().min(1, "School code is required."),
  email: z.string().email("Enter a valid email address."),
  otp: z.string().regex(/^\d{6,8}$/, "Enter a valid reset code."),
  password: z.string().min(10, "Password must be at least 10 characters."),
});

type LoginFailureCategory =
  | "SCHOOL_NOT_FOUND"
  | "USER_NOT_FOUND"
  | "SCHOOL_DISABLED"
  | "USER_DISABLED"
  | "PASSWORD_MISMATCH"
  | "MALFORMED_PASSWORD_HASH"
  | "SCHOOL_CODE_NORMALIZATION_ERROR";

function requestIdFrom(req: { headers: Record<string, unknown> }) {
  const header = req.headers["x-request-id"];
  return typeof header === "string" && header.trim() ? header.trim() : undefined;
}

async function writeLoginAudit(schoolId: string, action: "LOGIN_SUCCEEDED" | "LOGIN_FAILED", details: Record<string, unknown>) {
  await prisma.auditLog.create({
    data: {
      schoolId,
      action,
      details: details as Prisma.InputJsonValue,
    },
  });
}

export function authRoutes() {
  const router = Router();

  router.post("/api/auth/login", async (req, res, next) => {
    try {
      const { email, password, schoolCode } = loginSchema.parse(req.body);
      const requestId = requestIdFrom(req);
      const normalizedEmail = normalizeLoginEmail(email);
      const normalizedSchoolCode = normalizeSchoolCode(schoolCode);
      const runtime = classifyRuntimeEnvironment(process.env);
      let auditSchoolId: string | null = null;
      let failureCategory: LoginFailureCategory | null = null;
      let schoolFound = false;
      let schoolActive = false;
      let userFound = false;
      let userActive = false;
      let passwordHashPresent = false;
      let passwordHashFormatValid = false;
      let passwordMatched = false;

      let user: { id: string; schoolId: string; name: string; email: string; role: SchoolUserRole; passwordHash: string; isActive: boolean; isPlatformOwner: boolean; tokenVersion: number } | null = null;

      if (!normalizedSchoolCode) {
        failureCategory = "SCHOOL_CODE_NORMALIZATION_ERROR";
      } else if (normalizedSchoolCode === "PLATFORM") {
        user = await prisma.user.findFirst({
          where: { email: normalizedEmail, isPlatformOwner: true },
        });
        auditSchoolId = user?.schoolId ?? null;
      } else {
        const school = await prisma.school.findUnique({ where: { code: normalizedSchoolCode } });
        if (!school) {
          failureCategory = "SCHOOL_NOT_FOUND";
        } else {
          schoolFound = true;
          schoolActive = school.isActive;
          auditSchoolId = school.id;
          if (!school.isActive) {
            failureCategory = "SCHOOL_DISABLED";
          } else {
            user = await prisma.user.findFirst({
              where: { schoolId: school.id, email: normalizedEmail },
            });
          }
        }
      }

      if (user) {
        userFound = true;
        userActive = user.isActive;
        passwordHashPresent = Boolean(user.passwordHash);
        passwordHashFormatValid = passwordHashPresent && isSupportedPasswordHash(user.passwordHash);
      }

      if (!failureCategory) {
        if (!user) {
          failureCategory = "USER_NOT_FOUND";
        } else if (!user.isActive) {
          failureCategory = "USER_DISABLED";
        } else if (!passwordHashFormatValid) {
          failureCategory = "MALFORMED_PASSWORD_HASH";
        } else {
          passwordMatched = await verifyPassword(password, user.passwordHash);
          if (!passwordMatched) failureCategory = "PASSWORD_MISMATCH";
        }
      }

      if (failureCategory) {
        console.warn("[auth-login-failed]", {
          requestId,
          environment: runtime.environment,
          normalizedSchoolCode,
          schoolFound,
          userFound,
          schoolActive,
          userActive,
          passwordHashPresent,
          passwordHashFormatValid,
          passwordMatched,
          finalFailureCategory: failureCategory,
        });
        if (auditSchoolId) {
          await writeLoginAudit(auditSchoolId, "LOGIN_FAILED", {
            requestId,
            environment: runtime.environment,
            normalizedSchoolCode,
            email: normalizedEmail,
            userId: user?.id ?? null,
            result: "DENIED",
            safeReasonCategory: failureCategory,
          });
        }
        res.status(401).json({ error: "Invalid credentials." });
        return;
      }
      const authenticatedUser = user!;

      console.warn("[auth-login-succeeded]", {
        requestId,
        environment: runtime.environment,
        normalizedSchoolCode,
        schoolFound: schoolFound || normalizedSchoolCode === "PLATFORM",
        userFound,
        schoolActive: schoolActive || normalizedSchoolCode === "PLATFORM",
        userActive,
      });
      await writeLoginAudit(authenticatedUser.schoolId, "LOGIN_SUCCEEDED", {
        requestId,
        environment: runtime.environment,
        normalizedSchoolCode,
        email: authenticatedUser.email,
        userId: authenticatedUser.id,
        action: "LOGIN_SUCCEEDED",
        result: "ALLOWED",
      });

      const token = signToken({
        userId: authenticatedUser.id,
        schoolId: authenticatedUser.schoolId,
        name: authenticatedUser.name,
        email: authenticatedUser.email,
        role: authenticatedUser.role,
        tokenVersion: authenticatedUser.tokenVersion,
        ...(authenticatedUser.isPlatformOwner ? { isPlatformOwner: true } : {}),
      });

      res.json({
        token,
        user: {
          id: authenticatedUser.id,
          schoolId: authenticatedUser.schoolId,
          name: authenticatedUser.name,
          email: authenticatedUser.email,
          role: authenticatedUser.role,
          ...(authenticatedUser.isPlatformOwner ? { isPlatformOwner: true } : {}),
        },
      });
    } catch (error) {
      next(error);
    }
  });

  router.post("/api/auth/forgot-password", async (req, res, next) => {
    try {
      const { schoolCode, email } = forgotPasswordSchema.parse(req.body);
      await requestPasswordReset({
        schoolCode,
        email,
        requestedIp: req.ip,
        requestedUserAgent: req.headers["user-agent"],
      });
      res.json({ ok: true, message: "If an account exists, we sent a reset code." });
    } catch (error) {
      next(error);
    }
  });

  router.post("/api/auth/reset-password", async (req, res, next) => {
    try {
      const payload = otpResetSchema.parse(req.body);
      await resetPasswordWithOtp(payload);
      res.json({ ok: true });
    } catch (error) {
      next(error);
    }
  });

  router.post("/api/auth/account-setup", async (req, res, next) => {
    try {
      const { token, password } = tokenPasswordSchema.parse(req.body);
      await consumeAccountSetup(token, password);
      res.json({ ok: true });
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
