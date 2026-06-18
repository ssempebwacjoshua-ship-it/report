import type { Request, Response, NextFunction } from "express";
import { verifyToken } from "../services/authService";
import { prisma } from "../db/prisma";

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
 *   - If the client also sent a schoolCode that resolves to a DIFFERENT school â†’ 403.
 *   - req.user and req.school are both set.
 *
 * In production without a token â†’ 401 (no fallback, no guessing).
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
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
    const payload = token ? verifyToken(token) : null;

    if (payload) {
      req.user = payload;

      const school = await prisma.school.findUnique({
        where: { id: payload.schoolId },
        select: { id: true, code: true, name: true },
      });

      if (!school) {
        console.error("[resolveSchoolContext] school not found for token", { schoolId: payload.schoolId, userId: payload.userId });
        res.status(403).json({ error: "School not found for your account." });
        return;
      }

      // Cross-tenant check: if the client explicitly sent a schoolCode, it must match
      const clientCode = extractClientSchoolCode(req);
      if (clientCode && clientCode !== school.code) {
        console.warn("[resolveSchoolContext] cross-tenant mismatch", { clientCode, jwtSchool: school.code, route: req.path });
        res.status(403).json({ error: "You do not have access to this school." });
        return;
      }

      req.school = school;
      next();
      return;
    }

    // No token
    if (process.env.NODE_ENV === "production") {
      console.warn("[resolveSchoolContext] unauthenticated request in production", { route: req.path, method: req.method });
      res.status(401).json({ error: "Authentication required." });
      return;
    }

    // Dev/test fallback â€” resolve school from request params
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

