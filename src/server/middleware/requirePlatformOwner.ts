import type { Request, Response, NextFunction } from "express";
import { verifyToken } from "../services/authService";

export function requirePlatformOwner(req: Request, res: Response, next: NextFunction): void {
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

  if (!payload.isPlatformOwner) {
    res.status(403).json({ error: "Owner access is required." });
    return;
  }

  req.user = payload;
  next();
}
