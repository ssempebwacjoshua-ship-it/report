import type { Request, Response, NextFunction } from "express";
import { verifyToken } from "../services/authService";
import { prisma } from "../db/prisma";
import { validateSchoolSession } from "../services/sessionValidationService";
import { classifyRuntimeEnvironment } from "../utils/productionSafety";

type SchoolRecord = { id: string; code: string; name: string };

declare global {
  namespace Express {
    interface Request {
      school?: SchoolRecord;
    }
  }
}

/**
 * Tenant isolation middleware.
 *
 * When a valid JWT is present:
 *   - schoolId comes from the token (token wins; client-supplied schoolCode is secondary).
 *   - If the client also sent a schoolCode that resolves to a DIFFERENT school ? 403.
 *   - req.user and req.school are both set.
 *
 * In production without a token ? 401 (no fallback, no guessing).
 *
 * In dev/test (NODE_ENV !== "production") without a token:
 *   - Falls back to schoolCode from query string or request body.
 *   - If no schoolCode is provided, defaults to "SCU-PREVIEW" for local convenience.
 *   - This path is never active in production.
 */
export async function resolveSchoolContext(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  function logDeniedAccess(requiredPermission: string) {
    console.warn("[school-context-denied]", {
      path: req.path,
      role: req.user?.role ?? null,
      requiredPermission,
      actorId: req.user?.userId ?? null,
      schoolId: req.school?.id ?? req.user?.schoolId ?? null,
    });
  }

  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
    const payload = token ? verifyToken(token) : null;

    if (payload) {
      const session = await validateSchoolSession(payload);
      if (!session) {
        res.status(401).json({ error: "Your session has expired. Please log in again." });
        return;
      }

      req.user = session.auth;
      const school = session.school;

      // Cross-tenant check: if the client explicitly sent a schoolCode, it must match
      const clientCode = extractClientSchoolCode(req);
      if (clientCode && clientCode !== school.code) {
        console.warn("[resolveSchoolContext] cross-tenant mismatch", { clientCode, jwtSchool: school.code, route: req.path });
        logDeniedAccess("schoolCode-match");
        res.status(403).json({ error: "You do not have access to this school." });
        return;
      }

      req.school = school;
      next();
      return;
    }

    // No token
    const runtime = classifyRuntimeEnvironment(process.env);
    if (runtime.isProduction || runtime.isAmbiguous) {
      console.warn("[resolveSchoolContext] unauthenticated request denied", {
        route: req.path,
        method: req.method,
        runtime: runtime.environment,
        reasons: runtime.reasons,
      });
      res.status(401).json({ error: "Authentication required." });
      return;
    }

    // Dev/test fallback ? resolve school from request params
    const schoolCode = extractClientSchoolCode(req) ?? "SCU-PREVIEW";
    const school = await prisma.school.findUnique({
      where: { code: schoolCode },
      select: { id: true, code: true, name: true },
    });

    if (!school) {
      res.status(404).json({ error: `School not found: ${schoolCode}` });
      return;
    }

    req.school = school;
    next();
  } catch (error) {
    next(error);
  }
}

function extractClientSchoolCode(req: Request): string | null {
  if (typeof req.query.schoolCode === "string" && req.query.schoolCode) {
    return req.query.schoolCode;
  }
  const body = req.body as Record<string, unknown> | undefined;
  if (typeof body?.schoolCode === "string" && body.schoolCode) {
    return body.schoolCode;
  }
  return null;
}
