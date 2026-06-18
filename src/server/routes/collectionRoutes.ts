import { Router } from "express";
import multer from "multer";
import { requireCreator } from "../middleware/requireCreator";
import * as svc from "../services/collectionService";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

// List collections
router.get("/", requireCreator, async (req, res) => {
  try {
    const collections = await svc.listCollections(req.creator!.id);
    res.json({ ok: true, collections });
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : "Failed to list collections." });
  }
});

// Create collection
router.post("/", requireCreator, async (req, res) => {
  const { name, type } = req.body as { name?: string; type?: string };
  if (!name?.trim()) { res.status(400).json({ error: "Collection name is required." }); return; }
  try {
    const collection = await svc.createCollection(req.creator!.id, name, type);
    res.status(201).json({ ok: true, collection });
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : "Failed to create collection." });
  }
});

// Get collection detail
router.get("/:id", requireCreator, async (req, res) => {
  try {
    const collection = await svc.getCollection(req.params.id, req.creator!.id);
    if (!collection) { res.status(404).json({ error: "Collection not found." }); return; }
    res.json({ ok: true, collection });
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : "Failed to load collection." });
  }
});

// Update collection
router.patch("/:id", requireCreator, async (req, res) => {
  const { name, type } = req.body as { name?: string; type?: string };
  try {
    await svc.updateCollection(req.params.id, req.creator!.id, { name, type });
    res.json({ ok: true });
  } catch (e: any) {
    res.status(e?.status ?? 500).json({ error: e instanceof Error ? e.message : "Failed to update collection." });
  }
});

// Delete collection
router.delete("/:id", requireCreator, async (req, res) => {
  try {
    await svc.deleteCollection(req.params.id, req.creator!.id);
    res.json({ ok: true });
  } catch (e: any) {
    res.status(e?.status ?? 500).json({ error: e instanceof Error ? e.message : "Failed to delete collection." });
  }
});

// Add record
router.post("/:id/records", requireCreator, async (req, res) => {
  const data = req.body?.data as Record<string, unknown> | undefined;
  if (!data || typeof data !== "object") { res.status(400).json({ error: "Record data is required." }); return; }
  try {
    const result = await svc.addRecord(req.params.id, req.creator!.id, data);
    res.status(201).json({ ok: true, id: result.id });
  } catch (e: any) {
    res.status(e?.status ?? 500).json({ error: e instanceof Error ? e.message : "Failed to add record." });
  }
});

// Delete record
router.delete("/:id/records/:recordId", requireCreator, async (req, res) => {
  try {
    await svc.deleteRecord(req.params.recordId, req.params.id, req.creator!.id);
    res.json({ ok: true });
  } catch (e: any) {
    res.status(e?.status ?? 500).json({ error: e instanceof Error ? e.message : "Failed to delete record." });
  }
});

// Import CSV
router.post("/:id/import-csv", requireCreator, upload.single("file"), async (req, res) => {
  if (!req.file) { res.status(400).json({ error: "No CSV file uploaded." }); return; }
  const content = req.file.buffer.toString("utf-8");
  try {
    const result = await svc.importCSVIntoCollection(req.params.id, req.creator!.id, content);
    res.json({ ok: true, ...result });
  } catch (e: any) {
    res.status(e?.status ?? 500).json({ error: e instanceof Error ? e.message : "CSV import failed." });
  }
});

export function collectionRoutes() {
  return router;
}

