import type { NextFunction, Request, Response } from "express";
import { hasPermission } from "../../shared/permissions";

export function requireSchoolPermission(permission: string) {
  return function schoolPermissionMiddleware(req: Request, res: Response, next: NextFunction): void {
    if (!req.user) {
      res.status(401).json({ error: "Authentication required." });
      return;
    }

    if (!hasPermission(req.user.role, permission)) {
      res.status(403).json({ error: "You do not have permission for this action." });
      return;
    }

    next();
  };
}
