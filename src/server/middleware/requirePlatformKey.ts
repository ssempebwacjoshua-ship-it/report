import type { Request, Response, NextFunction } from "express";

export function requirePlatformKey(req: Request, res: Response, next: NextFunction): void {
  const configuredKey = process.env.PLATFORM_ADMIN_KEY;
  if (!configuredKey) {
    res.status(503).json({ error: "Platform admin is not configured on this server." });
    return;
  }
  const header = req.headers.authorization ?? "";
  const provided = header.startsWith("PlatformKey ") ? header.slice(12) : null;
  if (!provided || provided !== configuredKey) {
    res.status(401).json({ error: "Platform admin credentials required." });
    return;
  }
  next();
}
