import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db/prisma";
import { requireAuth } from "../middleware/requireAuth";
import { sendSupportTelegramMessage } from "../services/telegramService";

const supportRequestSchema = z.object({
  message: z.string().trim().min(1, "Please enter a support message.").max(2000, "Support message must be 2000 characters or fewer."),
  contact: z.string().trim().max(200, "Contact details must be 200 characters or fewer.").optional().default(""),
  pageUrl: z.string().trim().min(1, "Page URL is required.").max(2000, "Page URL is too long."),
});

function formatSupportTimestamp(timestamp: Date) {
  try {
    return timestamp.toLocaleString("en-UG", { timeZone: "Africa/Kampala" });
  } catch {
    return timestamp.toISOString();
  }
}

export function supportRoutes() {
  const router = Router();

  router.post("/api/support/telegram", requireAuth, async (req, res, next) => {
    try {
      const body = supportRequestSchema.parse(req.body);
      if (!process.env.TELEGRAM_BOT_TOKEN?.trim() || !process.env.TELEGRAM_SUPPORT_CHAT_ID?.trim()) {
        res.status(503).json({ error: "Support is not configured yet." });
        return;
      }

      const user = req.user!;
      const school = await prisma.school.findUnique({
        where: { id: user.schoolId },
        select: { id: true, code: true, name: true },
      });
      const requestedAt = new Date();

      const text = [
        "=== New Support Request ===",
        "",
        `Timestamp: ${formatSupportTimestamp(requestedAt)}`,
        `Page: ${body.pageUrl}`,
        `School: ${school ? `${school.name} (${school.code})` : "Unknown school"}`,
        `User: ${user.name || "Unknown user"}`,
        `Email: ${user.email || "Not provided"}`,
        `Role: ${user.role || "Unknown role"}`,
        `Contact: ${body.contact || "Not provided"}`,
        "",
        "Issue:",
        body.message,
      ].join("\n");

      const telegramResult = await sendSupportTelegramMessage(text);
      if (!telegramResult.ok) {
        res.status(502).json({ error: "Could not send your support request right now. Please try again in a few minutes." });
        return;
      }

      void prisma.auditLog.create({
        data: {
          schoolId: user.schoolId,
          action: "support.telegram_requested",
          correlationId: user.userId,
          details: {
            pageUrl: body.pageUrl,
            hasContact: Boolean(body.contact),
            actorUserId: user.userId,
            actorEmail: user.email,
            actorRole: user.role,
          },
        },
      }).catch(() => {});

      res.status(202).json({ ok: true });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
