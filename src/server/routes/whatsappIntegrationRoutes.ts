import { Router } from "express";
import { prisma } from "../db/prisma";
import {
  persistAndProcessWhatsAppWebhook,
  verifyMetaSignature,
  verifyMetaWebhookChallenge,
} from "../services/whatsappWebhookService";

declare global {
  namespace Express {
    interface Request {
      rawBody?: Buffer;
    }
  }
}

export function whatsappIntegrationRoutes() {
  const router = Router();

  router.get("/api/integrations/whatsapp/webhook", (req, res) => {
    const challenge = verifyMetaWebhookChallenge(req.query);
    if (!challenge) {
      res.status(403).send("Forbidden");
      return;
    }
    res.status(200).send(challenge);
  });

  router.post("/api/integrations/whatsapp/webhook", async (req, res, next) => {
    try {
      const signature = typeof req.headers["x-hub-signature-256"] === "string"
        ? req.headers["x-hub-signature-256"]
        : undefined;
      if (!verifyMetaSignature(req.rawBody, signature)) {
        res.status(401).json({ ok: false, error: true, code: "INVALID_WEBHOOK_SIGNATURE", message: "Invalid webhook signature." });
        return;
      }
      const rawBody = req.rawBody ?? Buffer.from(JSON.stringify(req.body ?? {}));
      const results = await persistAndProcessWhatsAppWebhook(prisma, rawBody, req.body);
      res.status(200).json({ ok: true, received: results.length });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
