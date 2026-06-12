import { Router, type Request, type Response } from "express";

export function healthRoutes() {
  const router = Router();
  const handler = (_req: Request, res: Response) => {
    res.json({ ok: true, service: "school-connect-reports-lab" });
  };
  router.get("/health", handler);
  router.get("/api/health", handler);
  return router;
}
