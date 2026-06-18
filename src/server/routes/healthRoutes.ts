import { Router, type Request, type Response } from "express";

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

  /**
   * GET /api/health/env
   *
   * Returns SET / MISSING for each required env var â€” never the actual values.
   * Protected by INTERNAL_TEST_KEY so it is not publicly accessible.
   */
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

