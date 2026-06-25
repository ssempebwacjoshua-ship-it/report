import type { NextFunction, Request, Response } from "express";
import { verifyToken } from "../services/authService";
import jwt from "jsonwebtoken";
import { findOrCreateSchoolOperatorCreator, findCreatorById } from "../services/documentIntelligenceService";
import { hasPermission } from "../../shared/permissions";
import { validateSchoolSession } from "../services/sessionValidationService";

export interface CreatorContext {
  id: string;
  type: "SCHOOL_OPERATOR" | "EXTERNAL";
  email: string;
  name: string;
  schoolId?: string | null;
}

declare global {
  namespace Express {
    interface Request {
      creator?: CreatorContext;
    }
  }
}

export async function requireCreator(req: Request, res: Response, next: NextFunction): Promise<void> {
  const raw = req.headers.authorization?.startsWith("Bearer ")
    ? req.headers.authorization.slice(7)
    : null;

  if (!raw) {
    res.status(401).json({ error: "Authentication required." });
    return;
  }

  const schoolPayload = verifyToken(raw);
  if (schoolPayload?.userId && schoolPayload?.schoolId) {
    try {
      const session = await validateSchoolSession(schoolPayload);
      if (!session) {
        res.status(401).json({ error: "Invalid or expired session." });
        return;
      }
      if (!hasPermission(session.user.role, "app.admin")) {
        res.status(403).json({ error: "You do not have permission for this action." });
        return;
      }

      const creatorId = await findOrCreateSchoolOperatorCreator(
        session.school.id,
        session.user.email,
        session.user.name,
      );
      req.creator = {
        id: creatorId,
        type: "SCHOOL_OPERATOR",
        email: session.user.email,
        name: session.user.name,
        schoolId: session.school.id,
      };
      next();
      return;
    } catch (err) {
      console.error("[requireCreator] findOrCreateSchoolOperatorCreator failed:", err instanceof Error ? err.message : err);
      res.status(500).json({ error: "Failed to resolve creator context.", detail: err instanceof Error ? err.message : String(err) });
      return;
    }
  }

  try {
    const secret = process.env.JWT_SECRET ?? "dev-secret-change-in-production";
    const payload = jwt.verify(raw, secret) as Record<string, unknown>;
    if (payload.creatorId) {
      const creator = await findCreatorById(payload.creatorId as string);
      if (!creator || !creator.isActive) {
        res.status(401).json({ error: "Account not found or disabled." });
        return;
      }
      req.creator = {
        id: creator.id as string,
        type: creator.type as "EXTERNAL",
        email: creator.email as string,
        name: creator.name as string,
        schoolId: null,
      };
      next();
      return;
    }
  } catch {
    // fall through
  }

  res.status(401).json({ error: "Invalid or expired session." });
}
