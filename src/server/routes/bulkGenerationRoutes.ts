import { Router } from "express";
import { requireCreator } from "../middleware/requireCreator";
import * as svc from "../services/bulkGenerationService";

const router = Router();

// Submit a new bulk generation job
router.post("/", requireCreator, async (req, res) => {
  const { collectionId, intent } = req.body as { collectionId?: string; intent?: string };
  if (!collectionId?.trim()) { res.status(400).json({ error: "collectionId is required." }); return; }
  if (!intent?.trim()) { res.status(400).json({ error: "Describe what you want to generate." }); return; }
  try {
    const job = await svc.createBulkJob(req.creator!.id, collectionId.trim(), intent.trim());
    res.status(201).json({ ok: true, job });
  } catch (e: any) {
    res.status(e?.status ?? 500).json({ error: e instanceof Error ? e.message : "Failed to create job." });
  }
});

// List jobs for creator
router.get("/", requireCreator, async (req, res) => {
  try {
    const jobs = await svc.listBulkJobs(req.creator!.id);
    res.json({ ok: true, jobs });
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : "Failed to list jobs." });
  }
});

// Get job status + outputs
router.get("/:id", requireCreator, async (req, res) => {
  try {
    const result = await svc.getBulkJobOutputs(req.params.id, req.creator!.id);
    res.json({ ok: true, ...result });
  } catch (e: any) {
    res.status(e?.status ?? 500).json({ error: e instanceof Error ? e.message : "Failed to load job." });
  }
});

export function bulkGenerationRoutes() {
  return router;
}

