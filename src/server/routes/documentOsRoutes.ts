import { Router } from "express";
import { z } from "zod";
import { requireCreator } from "../middleware/requireCreator";
import * as os from "../services/documentOsService";

const router = Router();

function param(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

const preferenceSchema = z.object({
  key: z.string().trim().min(1),
  value: z.unknown(),
});

const workflowSchema = z.object({
  name: z.string().trim().min(1),
  trigger: z.enum(["COLLECTION_IMPORTED", "RECORD_ADDED", "DOCUMENT_CREATED", "BULK_JOB_COMPLETED", "BULK_GENERATION_COMPLETED", "PUBLISH_COMPLETED"]),
  actions: z.array(z.object({
    type: z.enum(["GENERATE_DOCUMENT", "PUBLISH", "PUBLISH_DOCUMENT", "EXPORT_PDF", "EMAIL", "SEND_EMAIL", "NOTIFY", "NOTIFY_CREATOR"]),
    config: z.record(z.string(), z.unknown()).optional(),
  })).min(1),
  isActive: z.boolean().optional(),
  enabled: z.boolean().optional(),
});

const agentSchema = z.object({
  domain: z.enum(["school", "medical", "legal", "business", "general"]).optional(),
  instruction: z.string().trim().min(1),
  documentId: z.string().uuid().optional(),
});

const translateSchema = z.object({
  language: z.enum(["Arabic", "French", "Swahili", "Spanish"]),
});

const toneSchema = z.object({
  tone: z.string().trim().min(1).max(80),
});

router.get("/preferences", requireCreator, async (req, res, next) => {
  try {
    res.json({ ok: true, preferences: await os.listPreferences(req.creator!.id) });
  } catch (error) {
    next(error);
  }
});

router.put("/preferences", requireCreator, async (req, res, next) => {
  try {
    const input = preferenceSchema.parse(req.body);
    res.json({ ok: true, preference: await os.upsertPreference(req.creator!.id, input.key, input.value) });
  } catch (error) {
    next(error);
  }
});

router.delete("/preferences/:key", requireCreator, async (req, res, next) => {
  try {
    await os.deletePreference(req.creator!.id, param(req.params.key));
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

router.get("/workflows", requireCreator, async (req, res, next) => {
  try {
    res.json({ ok: true, workflows: await os.listWorkflows(req.creator!.id) });
  } catch (error) {
    next(error);
  }
});

router.post("/workflows", requireCreator, async (req, res, next) => {
  try {
    const input = workflowSchema.parse(req.body);
    res.status(201).json({ ok: true, workflow: await os.createWorkflow(req.creator!.id, input) });
  } catch (error) {
    next(error);
  }
});

router.patch("/workflows/:id", requireCreator, async (req, res, next) => {
  try {
    const input = workflowSchema.partial().parse(req.body);
    res.json({ ok: true, workflow: await os.updateWorkflow(req.creator!.id, param(req.params.id), input) });
  } catch (error) {
    next(error);
  }
});

router.delete("/workflows/:id", requireCreator, async (req, res, next) => {
  try {
    await os.deleteWorkflow(req.creator!.id, param(req.params.id));
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

router.post("/agent", requireCreator, async (req, res, next) => {
  try {
    const input = agentSchema.parse(req.body);
    res.json({ ok: true, result: await os.runDocumentAgent(req.creator!.id, input) });
  } catch (error) {
    next(error);
  }
});

router.get("/search", requireCreator, async (req, res, next) => {
  try {
    const query = typeof req.query.q === "string" ? req.query.q : "";
    const entityType = typeof req.query.entityType === "string" ? req.query.entityType as os.SearchEntityType : undefined;
    res.json({ ok: true, results: await os.searchCreatorContent(req.creator!.id, query, entityType) });
  } catch (error) {
    next(error);
  }
});

router.post("/search/reindex", requireCreator, async (req, res, next) => {
  try {
    res.json({ ok: true, ...(await os.reindexCreatorContent(req.creator!.id)) });
  } catch (error) {
    next(error);
  }
});

router.get("/notifications", requireCreator, async (req, res, next) => {
  try {
    res.json({ ok: true, notifications: await os.listNotifications(req.creator!.id, req.query.includeRead === "true") });
  } catch (error) {
    next(error);
  }
});

router.patch("/notifications/:id/read", requireCreator, async (req, res, next) => {
  try {
    await os.markNotificationRead(req.creator!.id, param(req.params.id));
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

router.get("/analytics", requireCreator, async (req, res, next) => {
  try {
    res.json({ ok: true, analytics: await os.analyticsSummary(req.creator!.id) });
  } catch (error) {
    next(error);
  }
});

router.post("/workflows/suggest", requireCreator, async (req, res, next) => {
  try {
    res.json({ ok: true, suggestion: await os.suggestAutomationWorkflow(req.creator!.id, req.body ?? {}) });
  } catch (error) {
    next(error);
  }
});

router.post("/documents/:id/summarize", requireCreator, async (req, res, next) => {
  try {
    res.json({ ok: true, ...(await os.summarizeDocument(req.creator!.id, param(req.params.id))) });
  } catch (error) {
    next(error);
  }
});

router.post("/documents/:id/classify", requireCreator, async (req, res, next) => {
  try {
    res.json({ ok: true, classification: await os.classifyDocument(req.creator!.id, param(req.params.id)) });
  } catch (error) {
    next(error);
  }
});

router.post("/documents/:id/rewrite-tone", requireCreator, async (req, res, next) => {
  try {
    const input = toneSchema.parse(req.body);
    res.json({ ok: true, ...(await os.rewriteDocumentToneVersion(req.creator!.id, param(req.params.id), input.tone)) });
  } catch (error) {
    next(error);
  }
});

router.post("/documents/:id/translate", requireCreator, async (req, res, next) => {
  try {
    const input = translateSchema.parse(req.body);
    res.json({ ok: true, ...(await os.translateDocument(req.creator!.id, param(req.params.id), input.language)) });
  } catch (error) {
    next(error);
  }
});

router.get("/documents/:id/export/:format", requireCreator, async (req, res, next) => {
  try {
    const format = param(req.params.format) as os.ExportFormat;
    const result = await os.exportDocument(req.creator!.id, param(req.params.id), format);
    res.setHeader("Content-Type", result.contentType);
    res.setHeader("Content-Disposition", `attachment; filename="${result.filename}"`);
    res.send(result.body);
  } catch (error) {
    next(error);
  }
});

export function documentOsRoutes() {
  return router;
}

