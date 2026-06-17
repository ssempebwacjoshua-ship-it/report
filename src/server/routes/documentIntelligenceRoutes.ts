import { Router } from "express";
import multer from "multer";
import bcrypt from "bcryptjs";
import { requireCreator } from "../middleware/requireCreator";
import * as svc from "../services/documentIntelligenceService";
import { renderSchemaToHtml } from "../services/documentRenderService";
import type { DocumentSchema, ComponentNode } from "../../shared/types/documentIntelligence";

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
});

// Public document page — no auth required (before :id route to avoid conflict)
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

// List documents
router.get("/", requireCreator, async (req, res) => {
  try {
    const documents = await svc.listDocuments(req.creator!.id);
    res.json({ ok: true, documents });
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : "Failed to list documents." });
  }
});

// Create document
router.post("/", requireCreator, async (req, res) => {
  const { title } = req.body as { title?: string };
  try {
    const document = await svc.createDocument(req.creator!.id, title?.trim() || "Untitled Document");
    res.status(201).json({ ok: true, document });
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : "Failed to create document." });
  }
});

// Get document
router.get("/:id", requireCreator, async (req, res) => {
  try {
    const document = await svc.getDocument(req.params.id, req.creator!.id);
    if (!document) { res.status(404).json({ error: "Document not found." }); return; }
    res.json({ ok: true, document });
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : "Failed to load document." });
  }
});

// Upload file → Gemini extraction
router.post("/:id/upload", requireCreator, upload.single("file"), async (req, res) => {
  if (!req.file) { res.status(400).json({ error: "No file uploaded." }); return; }
  try {
    const result = await svc.uploadAndExtract(req.params.id, req.creator!.id, req.file);
    res.status(202).json({ ok: true, status: result.status, sourceFileId: result.sourceFileId });
  } catch (e: any) {
    res.status(e?.status ?? 500).json({ error: e instanceof Error ? e.message : "Upload failed." });
  }
});

router.post("/:id/extraction/retry", requireCreator, async (req, res) => {
  const { sourceFileId, highAccuracy } = req.body as { sourceFileId?: string; highAccuracy?: boolean };
  try {
    const result = await svc.retryDocumentExtraction(req.params.id, req.creator!.id, sourceFileId, Boolean(highAccuracy));
    res.status(202).json({ ok: true, ...result });
  } catch (e: any) {
    res.status(e?.status ?? 500).json({ error: e instanceof Error ? e.message : "Retry failed." });
  }
});

router.patch("/:id/extracted-knowledge", requireCreator, async (req, res) => {
  const { knowledge } = req.body as { knowledge?: any };
  if (!knowledge || typeof knowledge !== "object") { res.status(400).json({ error: "Extracted knowledge is required." }); return; }
  try {
    const updated = await svc.updateExtractedKnowledge(req.params.id, req.creator!.id, knowledge);
    res.json({ ok: true, knowledge: updated });
  } catch (e: any) {
    res.status(e?.status ?? 500).json({ error: e instanceof Error ? e.message : "Could not update extracted text." });
  }
});

// Generate initial schema from intent
router.post("/:id/generate", requireCreator, async (req, res) => {
  const { intent } = req.body as { intent?: string };
  if (!intent?.trim()) { res.status(400).json({ error: "Describe how you want the document to look." }); return; }
  try {
    const result = await svc.generateSchema(req.params.id, req.creator!.id, intent.trim());
    res.json({ ok: true, ...result });
  } catch (e: any) {
    res.status(e?.status ?? 500).json({ error: e instanceof Error ? e.message : "Schema generation failed." });
  }
});

// Apply conversational prompt → new version
router.post("/:id/prompt", requireCreator, async (req, res) => {
  const { instruction } = req.body as { instruction?: string };
  if (!instruction?.trim()) { res.status(400).json({ error: "Instruction is required." }); return; }
  try {
    const result = await svc.applyPrompt(req.params.id, req.creator!.id, instruction.trim());
    res.json({ ok: true, ...result });
  } catch (e: any) {
    res.status(e?.status ?? 500).json({ error: e instanceof Error ? e.message : "Edit failed." });
  }
});

// Version history
router.get("/:id/versions", requireCreator, async (req, res) => {
  try {
    const versions = await svc.getVersionHistory(req.params.id, req.creator!.id);
    res.json({ ok: true, versions });
  } catch (e: any) {
    res.status(e?.status ?? 500).json({ error: e instanceof Error ? e.message : "Failed to load versions." });
  }
});

// Restore version
router.post("/:id/versions/:versionId/restore", requireCreator, async (req, res) => {
  try {
    await svc.restoreVersion(req.params.id, req.creator!.id, req.params.versionId);
    res.json({ ok: true });
  } catch (e: any) {
    res.status(e?.status ?? 500).json({ error: e instanceof Error ? e.message : "Failed to restore version." });
  }
});

// Print export — returns full print-ready HTML page (no auth for now so owner can open in new tab)
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
router.post("/:id/publish", requireCreator, async (req, res) => {
  const { expiresInDays, password } = req.body as { expiresInDays?: number; password?: string };
  try {
    const result = await svc.publishDocument(req.params.id, req.creator!.id, { expiresInDays, password });
    res.json({ ok: true, ...result });
  } catch (e: any) {
    res.status(e?.status ?? 500).json({ error: e instanceof Error ? e.message : "Publish failed." });
  }
});

export function documentIntelligenceRoutes() {
  return router;
}
