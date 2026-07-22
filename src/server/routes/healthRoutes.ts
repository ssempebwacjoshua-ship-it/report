import { Router, type Request, type Response } from "express";
import { getRuntimeDiagnostics } from "../config/deployRuntime";

const ENV_STATUS_KEYS = [
  "JWT_SECRET",
  "DATABASE_URL",
  "CLIENT_ORIGIN",
  "PLATFORM_ADMIN_KEY",
  "GEMINI_API_KEY",
  "INTERNAL_TEST_KEY",
] as const;

export function healthRoutes() {
  const router = Router();

  const handler = (_req: Request, res: Response) => {
    res.json({ ok: true, service: "school-connect-reports-lab" });
  };
  router.get("/health", handler);
  router.get("/api/health", handler);

  router.get("/api/health/ping", (_req: Request, res: Response) => {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.json({ ok: true, ts: Date.now() });
  });

  router.get("/api/health/runtime", (_req: Request, res: Response) => {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.json({ ok: true, ...getRuntimeDiagnostics() });
  });

  router.get("/api/health/env", (req: Request, res: Response) => {
    const provided = req.headers["x-internal-test-key"];
    const expected = process.env.INTERNAL_TEST_KEY;
    if (!expected || provided !== expected) {
      res.status(403).json({ error: "Forbidden: x-internal-test-key required." });
      return;
    }

    const status: Record<string, "SET" | "MISSING"> = {};
    for (const key of ENV_STATUS_KEYS) {
      status[key] = process.env[key] ? "SET" : "MISSING";
    }

    res.json({ ok: true, NODE_ENV: process.env.NODE_ENV ?? "not set", env: status });
  });

  return router;
}
