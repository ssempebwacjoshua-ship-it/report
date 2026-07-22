import { Router } from "express";
import { prisma } from "../db/prisma";
import { persistAndProcessSmsWebhook, verifySmsWebhookSignature } from "../services/smsWebhookService";

declare global {
  namespace Express {
    interface Request {
      rawBody?: Buffer;
    }
  }
}

export function smsIntegrationRoutes() {
  const router = Router();

  router.post("/api/integrations/sms/webhook", async (req, res, next) => {
    try {
      const signature = typeof req.headers["x-sms-signature-256"] === "string"
        ? req.headers["x-sms-signature-256"]
        : undefined;
      if (!verifySmsWebhookSignature(req.rawBody, signature)) {
        res.status(401).json({ ok: false, error: true, code: "INVALID_WEBHOOK_SIGNATURE", message: "Invalid webhook signature." });
        return;
      }
      const rawBody = req.rawBody ?? Buffer.from(JSON.stringify(req.body ?? {}));
      const results = await persistAndProcessSmsWebhook(prisma, rawBody, req.body, normalizeHeaders(req.headers));
      res.status(200).json({ ok: true, received: results.length });
    } catch (error) {
      next(error);
    }
  });

  return router;
}

function normalizeHeaders(headers: Record<string, unknown>) {
  const normalized: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(headers)) {
    normalized[key] = Array.isArray(value) ? value[0] : typeof value === "string" ? value : undefined;
  }
  return normalized;
}
