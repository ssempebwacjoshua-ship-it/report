import type { NextFunction, Request, Response } from "express";
import { hasPermission } from "../../shared/permissions";

const APP_ADMIN_PATHS = [
  /^\/api\/students(?:\/|$)/,
  /^\/internal\/students(?:\/|$)/,
  /^\/api\/imports(?:\/|$)/,
  /^\/api\/reports\/(?:issue(?:-bulk)?|issued(?:\/|$)|release(?:\/|$)|release-status(?:\/|$))/,
  /^\/api\/settings(?:\/|$)/,
];

const STAFF_MANAGE_PATHS = [
  /^\/api\/staff-users(?:\/|$)/,
];

function matchesAny(path: string, patterns: RegExp[]) {
  return patterns.some((pattern) => pattern.test(path));
}

function logDeniedAccess(req: Request, requiredPermission: string) {
  console.warn("[school-role-access-denied]", {
    path: req.path,
    role: req.user?.role ?? null,
    requiredPermission,
    actorId: req.user?.userId ?? null,
    schoolId: req.school?.id ?? req.user?.schoolId ?? null,
  });
}

export function enforceSchoolRoleAccess(req: Request, res: Response, next: NextFunction): void {
  const user = req.user;
  if (!user) {
    next();
    return;
  }

  if (matchesAny(req.path, STAFF_MANAGE_PATHS) && !hasPermission(user.role, "staff.manage")) {
    logDeniedAccess(req, "staff.manage");
    res.status(403).json({ error: "You do not have permission for this action." });
    return;
  }

  if (matchesAny(req.path, APP_ADMIN_PATHS) && !hasPermission(user.role, "app.admin")) {
    logDeniedAccess(req, "app.admin");
    res.status(403).json({ error: "You do not have permission for this action." });
    return;
  }

  next();
}
