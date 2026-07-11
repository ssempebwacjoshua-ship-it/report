import { Router } from "express";
import multer from "multer";
import bcrypt from "bcryptjs";
import { requireCreator } from "../middleware/requireCreator";
import * as svc from "../services/documentIntelligenceService";
import { renderSchemaToHtml } from "../services/documentRenderService";
import type { DocumentSchema, ComponentNode, SmartDocumentVertical } from "../../shared/types/documentIntelligence";
import { getSmartPageTemplateById } from "../../shared/smartPagesTemplates";
import { attachUsageWarning, recordPlatformUsage, requirePlatformModule } from "../platformIntegration";
import { requireCreatorSchoolEntitlement } from "../services/subscriptionEntitlementService";

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
});

// Public document page ? no auth required (before :id route to avoid conflict)
router.get("/p/:token", async (req, res) => {
  try {
    const password = req.query.password as string | undefined;
    const result = await svc.getPublishedDocument(req.params.token, password);
    if (!result) { res.status(404).json({ error: "Document not found or link has expired." }); return; }
    if (result === "PASSWORD_REQUIRED") { res.status(401).json({ error: "Password required.", code: "PASSWORD_REQUIRED" }); return; }
    if (result === "WRONG_PASSWORD") { res.status(401).json({ error: "Incorrect password.", code: "WRONG_PASSWORD" }); return; }
    res.json({ ok: true, ...result });
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : "Failed to load document." });
  }
});

router.get("/p/:token/download/pdf", async (req, res) => {
  try {
    const password = req.query.password as string | undefined;
    const result = await svc.downloadPublishedDocumentPdf(req.params.token, password);
    if (!result) { res.status(404).json({ error: "Document not found or link has expired." }); return; }
    if (result === "PASSWORD_REQUIRED") { res.status(401).json({ error: "Password required.", code: "PASSWORD_REQUIRED" }); return; }
    if (result === "WRONG_PASSWORD") { res.status(401).json({ error: "Incorrect password.", code: "WRONG_PASSWORD" }); return; }
    res.setHeader("Content-Type", result.contentType);
    res.setHeader("Content-Disposition", `attachment; filename="${result.filename}"`);
    res.send(result.body);
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : "Failed to download document." });
  }
});

function parseSmartDocumentVertical(value: unknown): SmartDocumentVertical | undefined {
  if (value === "SCHOOL" || value === "LAWYER" || value === "GENERAL") return value;
  if (value === undefined || value === null || value === "") return undefined;
  throw Object.assign(new Error("Invalid Smart Pages vertical."), { status: 400 });
}

// List documents
router.get("/", requireCreator, async (req, res) => {
  try {
    if (req.creator?.schoolId && !(await requirePlatformModule(req, res, "smart_pages.core", req.creator.schoolId))) {
      return;
    }
    const vertical = parseSmartDocumentVertical(req.query.vertical);
    const documents = await svc.listDocuments(req.creator!.id, vertical);
    res.json({ ok: true, documents });
  } catch (e: any) {
    res.status(e?.status ?? 500).json({ error: e instanceof Error ? e.message : "Failed to list documents." });
  }
});

// Create document
router.post("/", requireCreator, async (req, res) => {
  try {
    const { title, vertical } = req.body;
    const parsedVertical = parseSmartDocumentVertical(vertical ?? "SCHOOL") ?? "SCHOOL";
    if (parsedVertical === "SCHOOL" && req.creator?.schoolId && !(await requirePlatformModule(req, res, "smart_pages.core", req.creator.schoolId))) {
      return;
    }
    const document = await svc.createDocument(req.creator!.id, title?.trim() || "Untitled Document", parsedVertical);
    res.status(201).json({ ok: true, document });
  } catch (e: any) {
    res.status(e?.status ?? 500).json({ error: e instanceof Error ? e.message : "Failed to create document." });
  }
});

// Get document
router.get("/:id", requireCreator, async (req, res) => {
  try {
    if (req.creator?.schoolId && !(await requirePlatformModule(req, res, "smart_pages.core", req.creator.schoolId))) {
      return;
    }
    const document = await svc.getDocument(req.params.id, req.creator!.id);
    if (!document) { res.status(404).json({ error: "Document not found." }); return; }
    res.json({ ok: true, document });
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : "Failed to load document." });
  }
});

// Upload file — school OCR flow only (LAWYER vertical is rejected in service)
router.post("/:id/upload", requireCreator, requireCreatorSchoolEntitlement("smart_pages.ai"), upload.single("file"), async (req, res) => {
  if (!req.file) { res.status(400).json({ error: "No file uploaded." }); return; }
  try {
    if (req.creator?.schoolId && !(await requirePlatformModule(req, res, "smart_pages.upload", req.creator.schoolId))) {
      return;
    }
    const result = await svc.uploadAndExtract(req.params.id, req.creator!.id, req.file);
    attachUsageWarning(res, await recordPlatformUsage(req, {
      moduleCode: "smart_pages.upload",
      quantity: 1,
      sourceType: "smart_pages_upload",
      sourceId: result.sourceFileId,
      metadataJson: { documentId: req.params.id, creatorId: req.creator!.id },
      organizationId: req.creator?.schoolId ?? null,
    }));
    res.status(202).json({ ok: true, status: result.status, sourceFileId: result.sourceFileId });
  } catch (e: any) {
    res.status(e?.status ?? 500).json({ error: e instanceof Error ? e.message : "Upload failed." });
  }
});

router.post("/:id/extraction/retry", requireCreator, requireCreatorSchoolEntitlement("smart_pages.ai"), async (req, res) => {
  const { sourceFileId, highAccuracy } = req.body as { sourceFileId?: string; highAccuracy?: boolean };
  try {
    if (req.creator?.schoolId && !(await requirePlatformModule(req, res, "smart_pages.upload", req.creator.schoolId))) {
      return;
    }
    const result = await svc.retryDocumentExtraction(req.params.id, req.creator!.id, sourceFileId, Boolean(highAccuracy));
    res.status(202).json({ ok: true, ...result });
  } catch (e: any) {
    res.status(e?.status ?? 500).json({ error: e instanceof Error ? e.message : "Retry failed." });
  }
});

router.patch("/:id/extracted-knowledge", requireCreator, requireCreatorSchoolEntitlement("smart_pages.ai"), async (req, res) => {
  const { knowledge } = req.body as { knowledge?: any };
  if (!knowledge || typeof knowledge !== "object") { res.status(400).json({ error: "Extracted knowledge is required." }); return; }
  try {
    if (req.creator?.schoolId && !(await requirePlatformModule(req, res, "smart_pages.upload", req.creator.schoolId))) {
      return;
    }
    const updated = await svc.updateExtractedKnowledge(req.params.id, req.creator!.id, knowledge);
    res.json({ ok: true, knowledge: updated });
  } catch (e: any) {
    res.status(e?.status ?? 500).json({ error: e instanceof Error ? e.message : "Could not update extracted text." });
  }
});

// Generate initial schema from intent
router.post("/:id/generate", requireCreator, requireCreatorSchoolEntitlement("smart_pages.ai"), async (req, res) => {
  const { intent, templateId } = req.body as { intent?: string; templateId?: string };
  if (!intent?.trim()) { res.status(400).json({ error: "Describe how you want the document to look." }); return; }
  if (templateId && !getSmartPageTemplateById(templateId, "SCHOOL")) {
    res.status(400).json({ error: "Template is not available for School Connect Smart Pages." });
    return;
  }
  try {
    if (req.creator?.schoolId && !(await requirePlatformModule(req, res, "smart_pages.document_generation", req.creator.schoolId))) {
      return;
    }
    const result = await svc.generateSchema(req.params.id, req.creator!.id, intent.trim());
    attachUsageWarning(res, await recordPlatformUsage(req, {
      moduleCode: "smart_pages.document_generation",
      quantity: 1,
      sourceType: "smart_pages_generation",
      sourceId: result.versionId,
      metadataJson: { documentId: req.params.id, creatorId: req.creator!.id, kind: "generate" },
      organizationId: req.creator?.schoolId ?? null,
    }));
    res.json({ ok: true, ...result });
  } catch (e: any) {
    res.status(e?.status ?? 500).json({ error: e instanceof Error ? e.message : "Schema generation failed." });
  }
});

// Apply conversational prompt ? new version
router.post("/:id/prompt", requireCreator, requireCreatorSchoolEntitlement("smart_pages.ai"), async (req, res) => {
  const { instruction } = req.body as { instruction?: string };
  if (!instruction?.trim()) { res.status(400).json({ error: "Instruction is required." }); return; }
  try {
    if (req.creator?.schoolId && !(await requirePlatformModule(req, res, "smart_pages.document_generation", req.creator.schoolId))) {
      return;
    }
    const result = await svc.applyPrompt(req.params.id, req.creator!.id, instruction.trim());
    attachUsageWarning(res, await recordPlatformUsage(req, {
      moduleCode: "smart_pages.document_generation",
      quantity: 1,
      sourceType: "smart_pages_generation",
      sourceId: result.versionId,
      metadataJson: { documentId: req.params.id, creatorId: req.creator!.id, kind: "prompt" },
      organizationId: req.creator?.schoolId ?? null,
    }));
    res.json({ ok: true, ...result });
  } catch (e: any) {
    res.status(e?.status ?? 500).json({ error: e instanceof Error ? e.message : "Edit failed." });
  }
});

router.post("/:id/manual-version", requireCreator, requireCreatorSchoolEntitlement("smart_pages.ai"), async (req, res) => {
  const { draft, title } = req.body as { draft?: string; title?: string };
  if (!draft?.trim()) { res.status(400).json({ error: "Manual draft content is required." }); return; }
  try {
    if (req.creator?.schoolId && !(await requirePlatformModule(req, res, "smart_pages.document_generation", req.creator.schoolId))) {
      return;
    }
    const result = await svc.createManualDocumentVersion(req.params.id, req.creator!.id, {
      draft: draft.trim(),
      title,
    });
    attachUsageWarning(res, await recordPlatformUsage(req, {
      moduleCode: "smart_pages.document_generation",
      quantity: 1,
      sourceType: "smart_pages_generation",
      sourceId: result.versionId,
      metadataJson: { documentId: req.params.id, creatorId: req.creator!.id, kind: "manual-version" },
      organizationId: req.creator?.schoolId ?? null,
    }));
    res.json({ ok: true, ...result });
  } catch (e: any) {
    res.status(e?.status ?? 500).json({ error: e instanceof Error ? e.message : "Could not create manual version." });
  }
});

// Lawyer edit plan — LAWYER vertical only (service enforces)
router.post("/:id/lawyer-edit-plan", requireCreator, async (req, res) => {
  const { instruction, currentContent } = req.body as { instruction?: string; currentContent?: string };
  if (!instruction?.trim()) { res.status(400).json({ error: "Instruction is required." }); return; }
  if (!currentContent?.trim()) { res.status(400).json({ error: "Current document content is required." }); return; }
  try {
    const result = await svc.getLawyerDocumentEditPlan(req.params.id, req.creator!.id, instruction.trim(), currentContent);
    res.json({ ok: true, ...result });
  } catch (e: any) {
    res.status(e?.status ?? 500).json({ error: e instanceof Error ? e.message : "Edit planning failed." });
  }
});

// Version history
router.get("/:id/versions", requireCreator, async (req, res) => {
  try {
    if (req.creator?.schoolId && !(await requirePlatformModule(req, res, "smart_pages.core", req.creator.schoolId))) {
      return;
    }
    const versions = await svc.getVersionHistory(req.params.id, req.creator!.id);
    res.json({ ok: true, versions });
  } catch (e: any) {
    res.status(e?.status ?? 500).json({ error: e instanceof Error ? e.message : "Failed to load versions." });
  }
});

// Restore version
router.post("/:id/versions/:versionId/restore", requireCreator, requireCreatorSchoolEntitlement("smart_pages.ai"), async (req, res) => {
  try {
    if (req.creator?.schoolId && !(await requirePlatformModule(req, res, "smart_pages.document_generation", req.creator.schoolId))) {
      return;
    }
    await svc.restoreVersion(req.params.id, req.creator!.id, req.params.versionId);
    attachUsageWarning(res, await recordPlatformUsage(req, {
      moduleCode: "smart_pages.document_generation",
      quantity: 1,
      sourceType: "smart_pages_generation",
      sourceId: req.params.versionId,
      metadataJson: { documentId: req.params.id, creatorId: req.creator!.id, kind: "restore" },
      organizationId: req.creator?.schoolId ?? null,
    }));
    res.json({ ok: true });
  } catch (e: any) {
    res.status(e?.status ?? 500).json({ error: e instanceof Error ? e.message : "Failed to restore version." });
  }
});

// Print export ? returns full print-ready HTML page used by the in-app print flow
router.get("/:id/print", requireCreator, async (req, res) => {
  try {
    const doc = await svc.getDocument(req.params.id, req.creator!.id);
    if (!doc) { res.status(404).json({ error: "Document not found." }); return; }
    if (!doc.activeVersion) { res.status(400).json({ error: "Document has no content yet." }); return; }
    const html = renderSchemaToHtml(doc.activeVersion.schema, doc.activeVersion.componentTree, doc.title, doc.activeVersion.renderSettings);
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(html);
  } catch (e: any) {
    res.status(e?.status ?? 500).json({ error: e instanceof Error ? e.message : "Print export failed." });
  }
});

// Publish
router.post("/:id/publish", requireCreator, requireCreatorSchoolEntitlement("smart_pages.ai"), async (req, res) => {
  const { expiresInDays, password } = req.body as { expiresInDays?: number; password?: string };
  try {
    if (req.creator?.schoolId && !(await requirePlatformModule(req, res, "smart_pages.document_generation", req.creator.schoolId))) {
      return;
    }
    const result = await svc.publishDocument(req.params.id, req.creator!.id, { expiresInDays, password });
    attachUsageWarning(res, await recordPlatformUsage(req, {
      moduleCode: "smart_pages.document_generation",
      quantity: 1,
      sourceType: "smart_pages_generation",
      sourceId: result.token,
      metadataJson: { documentId: req.params.id, creatorId: req.creator!.id, kind: "publish" },
      organizationId: req.creator?.schoolId ?? null,
    }));
    res.json({ ok: true, ...result });
  } catch (e: any) {
    res.status(e?.status ?? 500).json({ error: e instanceof Error ? e.message : "Publish failed." });
  }
});

export function documentIntelligenceRoutes() {
  return router;
}

