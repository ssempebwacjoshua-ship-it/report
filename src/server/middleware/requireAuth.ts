import type { Request, Response, NextFunction } from "express";
import { verifyToken, type AuthPayload } from "../services/authService";
import { validateSchoolSession } from "../services/sessionValidationService";

declare global {
  namespace Express {
    interface Request {
      user?: AuthPayload;
    }
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (req.user) {
    next();
    return;
  }

  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    res.status(401).json({ error: "Authentication required." });
    return;
  }

  const payload = verifyToken(token);
  if (!payload) {
    res.status(401).json({ error: "Invalid or expired session. Please log in again." });
    return;
  }

  const session = await validateSchoolSession(payload);
  if (!session) {
    res.status(401).json({ error: "Invalid or expired session. Please log in again." });
    return;
  }

  req.user = session.auth;
  next();
}
