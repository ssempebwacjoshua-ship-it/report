import { Router, type Request } from "express";
import { z } from "zod";
import { prisma } from "../db/prisma";
import { requireAuth } from "../middleware/requireAuth";
import { requireSchoolPermission } from "../middleware/requireSchoolPermission";
import {
  approveCampaign,
  createAudienceSnapshot,
  createCampaign,
  getCampaignOrThrow,
  listCampaigns,
  queueCampaign,
  requestApproval,
  updateCampaignDraft,
  validateCampaign,
} from "../services/communicationEngine";
import { communicationChannels, communicationTypes } from "../../shared/communications";

const audienceSchema = z.object({
  classId: z.string().uuid().optional(),
  streamId: z.string().uuid().optional(),
  studentIds: z.array(z.string().uuid()).optional(),
  mode: z.enum(["GENERAL", "PER_STUDENT"]).optional(),
});

const createCampaignSchema = z.object({
  type: z.enum(communicationTypes),
  title: z.string().trim().min(3).max(160),
  subject: z.string().trim().max(160).optional(),
  body: z.string().trim().min(1).max(3000),
  shortBody: z.string().trim().max(480).optional(),
  acknowledgementRequired: z.boolean().optional(),
  audience: audienceSchema.optional(),
});

const updateCampaignSchema = z.object({
  title: z.string().trim().min(3).max(160).optional(),
  subject: z.string().trim().max(160).optional(),
  body: z.string().trim().min(1).max(3000).optional(),
  audience: audienceSchema.optional(),
});

const channelListSchema = z.object({
  channels: z.array(z.enum(communicationChannels)).min(1).default(["WHATSAPP"]),
});

export function communicationRoutes() {
  const router = Router();
  router.use(requireAuth);

  router.get("/api/communications/campaigns", requireSchoolPermission("communications.view"), async (req, res, next) => {
    try {
      res.json(await listCampaigns(prisma, ctx(req)));
    } catch (error) {
      next(error);
    }
  });

  router.post("/api/communications/campaigns", requireSchoolPermission("communications.create"), async (req, res, next) => {
    try {
      const body = createCampaignSchema.parse(req.body);
      const campaign = await createCampaign(prisma, ctx(req), body);
      res.status(201).json({ campaign });
    } catch (error) {
      next(error);
    }
  });

  router.get("/api/communications/campaigns/:id", requireSchoolPermission("communications.view"), async (req, res, next) => {
    try {
      res.json({ campaign: await getCampaignOrThrow(prisma, ctx(req), routeId(req)) });
    } catch (error) {
      next(error);
    }
  });

  router.patch("/api/communications/campaigns/:id", requireSchoolPermission("communications.edit"), async (req, res, next) => {
    try {
      const body = updateCampaignSchema.parse(req.body);
      res.json({ campaign: await updateCampaignDraft(prisma, ctx(req), routeId(req), body) });
    } catch (error) {
      next(error);
    }
  });

  router.post("/api/communications/campaigns/:id/audience/estimate", requireSchoolPermission("communications.validate"), async (req, res, next) => {
    try {
      const definition = audienceSchema.parse(req.body);
      const result = await createAudienceSnapshot(prisma, ctx(req), routeId(req), definition);
      res.json({ estimate: { total: result.total, ready: result.ready, warnings: result.warnings, blocked: result.blocked } });
    } catch (error) {
      next(error);
    }
  });

  router.post("/api/communications/campaigns/:id/audience/snapshot", requireSchoolPermission("communications.audiences.manage"), async (req, res, next) => {
    try {
      const definition = audienceSchema.parse(req.body);
      res.status(201).json(await createAudienceSnapshot(prisma, ctx(req), routeId(req), definition));
    } catch (error) {
      next(error);
    }
  });

  router.post("/api/communications/campaigns/:id/validate", requireSchoolPermission("communications.validate"), async (req, res, next) => {
    try {
      res.json(await validateCampaign(prisma, ctx(req), routeId(req)));
    } catch (error) {
      next(error);
    }
  });

  router.post("/api/communications/campaigns/:id/request-approval", requireSchoolPermission("communications.requestApproval"), async (req, res, next) => {
    try {
      await requestApproval(prisma, ctx(req), routeId(req));
      res.json({ ok: true });
    } catch (error) {
      next(error);
    }
  });

  router.post("/api/communications/campaigns/:id/approve", requireSchoolPermission("communications.approve"), async (req, res, next) => {
    try {
      await approveCampaign(prisma, ctx(req), routeId(req));
      res.json({ ok: true });
    } catch (error) {
      next(error);
    }
  });

  router.post("/api/communications/campaigns/:id/queue", requireSchoolPermission("communications.send"), async (req, res, next) => {
    try {
      const body = channelListSchema.parse(req.body ?? {});
      await queueCampaign(prisma, ctx(req), routeId(req), body.channels);
      res.json({ ok: true, dryRun: process.env.COMMUNICATION_DRY_RUN !== "false" });
    } catch (error) {
      next(error);
    }
  });

  router.get("/api/communications/campaigns/:id/recipients", requireSchoolPermission("communications.view"), async (req, res, next) => {
    try {
      const id = routeId(req);
      await getCampaignOrThrow(prisma, ctx(req), id);
      const recipients = await prisma.communicationRecipient.findMany({
        where: { schoolId: req.school!.id, campaignId: id },
        orderBy: { createdAt: "asc" },
        take: 500,
      });
      res.json({ recipients });
    } catch (error) {
      next(error);
    }
  });

  router.get("/api/communications/campaigns/:id/deliveries", requireSchoolPermission("communications.view"), async (req, res, next) => {
    try {
      const id = routeId(req);
      await getCampaignOrThrow(prisma, ctx(req), id);
      const deliveries = await prisma.communicationDelivery.findMany({
        where: { schoolId: req.school!.id, campaignId: id },
        include: { recipient: true },
        orderBy: { createdAt: "desc" },
        take: 500,
      });
      res.json({ deliveries });
    } catch (error) {
      next(error);
    }
  });

  return router;
}

function ctx(req: Express.Request) {
  return {
    schoolId: req.school!.id,
    schoolName: req.school!.name,
    actorId: req.user?.userId,
    actorName: req.user?.name,
  };
}

function routeId(req: Request) {
  const value = req.params.id;
  const id = Array.isArray(value) ? value[0] : value;
  if (!id) {
    const error = new Error("Route id is required.");
    Object.assign(error, { status: 400, expose: true });
    throw error;
  }
  return id;
}
