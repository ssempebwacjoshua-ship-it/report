import { Prisma } from "@prisma/client";
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
  getCampaignProgressTotals,
  listCampaigns,
  queueCampaign,
  previewAudience,
  requestApproval,
  resolveCommunicationAudience,
  sendCampaign,
  updateCampaignDraft,
  validateCampaign,
} from "../services/communicationEngine";
import { communicationAudienceTypes, communicationChannels, communicationContactRoles, communicationTypes } from "../../shared/communications";

const audienceSchema = z.object({
  audienceType: z.enum(communicationAudienceTypes).optional(),
  classId: z.string().uuid().optional(),
  streamId: z.string().uuid().optional(),
  studentIds: z.array(z.string().uuid()).optional(),
  guardianContactIds: z.array(z.string().uuid()).optional(),
  staffUserIds: z.array(z.string().uuid()).optional(),
  contactRoles: z.array(z.enum(communicationContactRoles)).optional(),
  includeInactive: z.boolean().optional(),
  channel: z.enum(communicationChannels).optional(),
  search: z.string().trim().optional(),
  page: z.number().int().min(1).optional(),
  pageSize: z.number().int().min(1).max(100).optional(),
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

const sendCommunicationSchema = z.object({
  channel: z.enum(["WHATSAPP", "SMS"]),
  confirm: z.boolean(),
  message: z.string().trim().min(1).max(3000).optional(),
  audience: audienceSchema.optional(),
});

const templateStatusSchema = z.enum(["DRAFT", "APPROVED", "ACTIVE"]);

const templateSchema = z.object({
  channel: z.enum(["SMS", "WHATSAPP"]),
  communicationType: z.enum(communicationTypes),
  name: z.string().trim().min(3).max(120),
  content: z.string().trim().min(1).max(3000),
  status: templateStatusSchema,
  languageCode: z.string().trim().min(2).max(16).default("en"),
  providerTemplateName: z.string().trim().max(160).nullable().optional(),
  providerTemplateId: z.string().trim().max(160).nullable().optional(),
  variables: z.array(z.string().trim().min(1).max(80).regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/)).optional(),
});

export function communicationRoutes() {
  const router = Router();
  router.use(requireAuth);

  router.get("/api/communications/templates", requireSchoolPermission("communications.templates.manage"), async (req, res, next) => {
    try {
      const templates = await prisma.communicationTemplate.findMany({
        where: { schoolId: req.school!.id },
        orderBy: [{ channel: "asc" }, { communicationType: "asc" }, { name: "asc" }, { languageCode: "asc" }],
      });
      res.json({ templates: templates.map(safeTemplate) });
    } catch (error) {
      next(error);
    }
  });

  router.post("/api/communications/templates", requireSchoolPermission("communications.templates.manage"), async (req, res, next) => {
    try {
      const body = templateSchema.parse(req.body);
      const variables = body.variables ?? extractTemplateVariables(body.content);
      const template = await prisma.communicationTemplate.upsert({
        where: {
          schoolId_channel_name_languageCode: {
            schoolId: req.school!.id,
            channel: body.channel,
            name: body.name,
            languageCode: body.languageCode,
          },
        },
        update: {
          communicationType: body.communicationType,
          content: body.content,
          status: body.status,
          providerTemplateName: blankToNull(body.providerTemplateName),
          providerTemplateId: blankToNull(body.providerTemplateId),
          variablesJson: variables as Prisma.InputJsonValue,
        },
        create: {
          schoolId: req.school!.id,
          channel: body.channel,
          communicationType: body.communicationType,
          name: body.name,
          content: body.content,
          status: body.status,
          languageCode: body.languageCode,
          providerTemplateName: blankToNull(body.providerTemplateName),
          providerTemplateId: blankToNull(body.providerTemplateId),
          variablesJson: variables as Prisma.InputJsonValue,
        },
      });
      await prisma.auditLog.create({
        data: {
          schoolId: req.school!.id,
          action: "communication.template.upsert",
          correlationId: template.id,
          details: {
            actorId: req.user?.userId ?? "system",
            channel: template.channel,
            communicationType: template.communicationType,
            languageCode: template.languageCode,
            name: template.name,
            status: template.status,
            variableCount: variables.length,
          },
        },
      });
      res.json({ template: safeTemplate(template) });
    } catch (error) {
      next(error);
    }
  });

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
      res.json({ estimate: await resolveCommunicationAudience(prisma, ctx(req), definition) });
    } catch (error) {
      next(error);
    }
  });

  router.post("/api/communications/campaigns/:id/preview", requireSchoolPermission("communications.validate"), async (req, res, next) => {
    try {
      const definition = audienceSchema.parse(req.body);
      await getCampaignOrThrow(prisma, ctx(req), routeId(req));
      res.json({ preview: await previewAudience(prisma, ctx(req), definition) });
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
      const result = await requestApproval(prisma, ctx(req), routeId(req));
      res.json({ ok: true, ...result });
    } catch (error) {
      next(error);
    }
  });

  router.post("/api/communications/campaigns/:id/approve", requireSchoolPermission("communications.approve"), async (req, res, next) => {
    try {
      const campaign = await approveCampaign(prisma, ctx(req), routeId(req));
      res.json({ ok: true, campaign });
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

  router.post("/api/communications/campaigns/:id/send", requireSchoolPermission("communications.send"), async (req, res, next) => {
    try {
      const body = sendCommunicationSchema.parse(req.body);
      const result = await sendCampaign(prisma, ctx(req), routeId(req), body);
      res.json({ ok: true, result });
    } catch (error) {
      next(error);
    }
  });

  router.get("/api/communications/campaigns/:id/status", requireSchoolPermission("communications.view"), async (req, res, next) => {
    try {
      const id = routeId(req);
      const campaign = await getCampaignOrThrow(prisma, ctx(req), id);
      const progress = await getCampaignProgressTotals(prisma, ctx(req), id);
      res.json({ campaign: { id: campaign.id, status: campaign.status, title: campaign.title }, progress });
    } catch (error) {
      next(error);
    }
  });

  router.get("/api/communications/campaigns/:id/history", requireSchoolPermission("communications.view"), async (req, res, next) => {
    try {
      const id = routeId(req);
      await getCampaignOrThrow(prisma, ctx(req), id);
      const audit = await prisma.auditLog.findMany({
        where: { schoolId: req.school!.id, correlationId: id },
        orderBy: { createdAt: "desc" },
        take: 100,
      });
      const attempts = await prisma.communicationDeliveryAttempt.findMany({
        where: { delivery: { schoolId: req.school!.id, campaignId: id } },
        orderBy: { createdAt: "desc" },
        take: 100,
        include: { delivery: { select: { id: true, channel: true, status: true, providerMessageId: true } } },
      });
      res.json({ audit, attempts });
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

function extractTemplateVariables(content: string) {
  const variables = new Set<string>();
  for (const match of content.matchAll(/\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g)) {
    const variable = match[1];
    if (variable) variables.add(variable);
  }
  return [...variables];
}

function blankToNull(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function safeTemplate(template: {
  id: string;
  channel: string;
  communicationType: string;
  name: string;
  providerTemplateName: string | null;
  providerTemplateId: string | null;
  languageCode: string;
  status: string;
  content: string;
  variablesJson: Prisma.JsonValue | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: template.id,
    channel: template.channel,
    communicationType: template.communicationType,
    name: template.name,
    providerTemplateName: template.providerTemplateName,
    providerTemplateId: template.providerTemplateId,
    languageCode: template.languageCode,
    status: template.status,
    content: template.content,
    variables: Array.isArray(template.variablesJson) ? template.variablesJson : [],
    createdAt: template.createdAt,
    updatedAt: template.updatedAt,
  };
}
