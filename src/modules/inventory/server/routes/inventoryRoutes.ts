import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../../../server/db/prisma";
import { requireAuth } from "../../../../server/middleware/requireAuth";
import { requireSchoolPermission } from "../../../../server/middleware/requireSchoolPermission";
import {
  archiveInventoryItem,
  createInventoryItem,
  getInventoryItemsResponse,
  getInventoryOverview,
  getInventoryReconciliation,
  getInventoryReportingContext,
  recordInventoryMovement,
  saveReportingRequirement,
  saveStudentReportingRecord,
  updateInventoryItem,
} from "../services/inventoryService";

const itemSchema = z.object({
  name: z.string().trim().min(1, "Item name is required."),
  category: z.string().trim().min(1, "Category is required."),
  unit: z.string().trim().min(1, "Unit is required."),
  minimumStock: z.number().int().min(0),
  active: z.boolean().optional(),
});

const movementSchema = z.object({
  itemId: z.string().uuid(),
  quantity: z.number().int().positive(),
  source: z.string().trim().min(1),
  recipientName: z.string().trim().optional().or(z.literal("")),
  recipientType: z.string().trim().optional().or(z.literal("")),
  notes: z.string().trim().optional().or(z.literal("")),
  studentId: z.string().uuid().optional(),
});

const requirementSchema = z.object({
  itemId: z.string().uuid(),
  classId: z.string().uuid().optional().or(z.literal("")),
  termId: z.string().uuid().optional().or(z.literal("")),
  requiredQuantity: z.number().int().min(0),
});

const reportingRecordSchema = z.object({
  studentId: z.string().uuid(),
  termId: z.string().uuid().optional().or(z.literal("")),
  items: z.array(z.object({
    itemId: z.string().uuid(),
    quantity: z.number().int().min(0),
  })).min(1),
});

export function inventoryRoutes() {
  const router = Router();

  router.get("/api/inventory/overview", requireAuth, requireSchoolPermission("inventory.view"), async (req, res, next) => {
    try {
      res.json(await getInventoryOverview(prisma, req.school!.id));
    } catch (error) {
      next(error);
    }
  });

  router.get("/api/inventory/items", requireAuth, requireSchoolPermission("inventory.view"), async (req, res, next) => {
    try {
      res.json(await getInventoryItemsResponse(prisma, req.school!.id));
    } catch (error) {
      next(error);
    }
  });

  router.post("/api/inventory/items", requireAuth, requireSchoolPermission("inventory.items.manage"), async (req, res, next) => {
    try {
      const body = itemSchema.parse(req.body);
      const item = await createInventoryItem(prisma, {
        schoolId: req.school!.id,
        actorId: req.user!.userId,
        name: body.name,
        category: body.category,
        unit: body.unit,
        minimumStock: body.minimumStock,
      });
      res.status(201).json({ item });
    } catch (error) {
      next(error);
    }
  });

  router.patch("/api/inventory/items/:id", requireAuth, requireSchoolPermission("inventory.items.manage"), async (req, res, next) => {
    try {
      const body = itemSchema.parse(req.body);
      await updateInventoryItem(prisma, {
        schoolId: req.school!.id,
        actorId: req.user!.userId,
        itemId: req.params.id,
        name: body.name,
        category: body.category,
        unit: body.unit,
        minimumStock: body.minimumStock,
        active: body.active ?? true,
      });
      res.json({ ok: true });
    } catch (error) {
      next(error);
    }
  });

  router.post("/api/inventory/items/:id/archive", requireAuth, requireSchoolPermission("inventory.items.manage"), async (req, res, next) => {
    try {
      await archiveInventoryItem(prisma, req.school!.id, req.user!.userId, req.params.id);
      res.json({ ok: true });
    } catch (error) {
      next(error);
    }
  });

  router.get("/api/inventory/reporting/context", requireAuth, requireSchoolPermission("inventory.reporting.register"), async (req, res, next) => {
    try {
      const query = z.object({ search: z.string().optional() }).parse(req.query);
      res.json(await getInventoryReportingContext(prisma, req.school!.id, query.search ?? ""));
    } catch (error) {
      next(error);
    }
  });

  router.post("/api/inventory/reporting/requirements", requireAuth, requireSchoolPermission("inventory.items.manage"), async (req, res, next) => {
    try {
      const body = requirementSchema.parse(req.body);
      await saveReportingRequirement(prisma, {
        schoolId: req.school!.id,
        actorId: req.user!.userId,
        itemId: body.itemId,
        classId: body.classId || null,
        termId: body.termId || null,
        requiredQuantity: body.requiredQuantity,
      });
      res.status(201).json({ ok: true });
    } catch (error) {
      next(error);
    }
  });

  router.post("/api/inventory/reporting/records", requireAuth, requireSchoolPermission("inventory.reporting.register"), async (req, res, next) => {
    try {
      const body = reportingRecordSchema.parse(req.body);
      const record = await saveStudentReportingRecord(prisma, {
        schoolId: req.school!.id,
        actorId: req.user!.userId,
        studentId: body.studentId,
        termId: body.termId || null,
        items: body.items,
      });
      res.status(201).json({ record });
    } catch (error) {
      next(error);
    }
  });

  router.get("/api/inventory/reconciliation", requireAuth, requireSchoolPermission("inventory.reconcile"), async (req, res, next) => {
    try {
      res.json(await getInventoryReconciliation(prisma, req.school!.id));
    } catch (error) {
      next(error);
    }
  });

  router.post("/api/inventory/movements/receive", requireAuth, requireSchoolPermission("inventory.stock.receive"), async (req, res, next) => {
    try {
      const body = movementSchema.parse(req.body);
      const movement = await recordInventoryMovement(prisma, {
        schoolId: req.school!.id,
        actorId: req.user!.userId,
        itemId: body.itemId,
        type: "RECEIVED",
        quantity: body.quantity,
        source: body.source,
        recipientName: body.recipientName || null,
        recipientType: body.recipientType || null,
        notes: body.notes || null,
      });
      res.status(201).json({ movement });
    } catch (error) {
      next(error);
    }
  });

  router.post("/api/inventory/movements/issue", requireAuth, requireSchoolPermission("inventory.stock.issue"), async (req, res, next) => {
    try {
      const body = movementSchema.parse(req.body);
      const movement = await recordInventoryMovement(prisma, {
        schoolId: req.school!.id,
        actorId: req.user!.userId,
        itemId: body.itemId,
        type: "ISSUED",
        quantity: body.quantity,
        source: body.source,
        recipientName: body.recipientName || null,
        recipientType: body.recipientType || null,
        notes: body.notes || null,
        studentId: body.studentId,
      });
      res.status(201).json({ movement });
    } catch (error) {
      next(error);
    }
  });

  router.post("/api/inventory/movements/adjust", requireAuth, requireSchoolPermission("inventory.reconcile"), async (req, res, next) => {
    try {
      const body = movementSchema.parse(req.body);
      const movement = await recordInventoryMovement(prisma, {
        schoolId: req.school!.id,
        actorId: req.user!.userId,
        itemId: body.itemId,
        type: "ADJUSTED",
        quantity: body.quantity,
        source: body.source,
        recipientName: body.recipientName || null,
        recipientType: body.recipientType || null,
        notes: body.notes || null,
      });
      res.status(201).json({ movement });
    } catch (error) {
      next(error);
    }
  });

  router.get("/api/inventory/movements", requireAuth, requireSchoolPermission("inventory.view"), async (req, res, next) => {
    try {
      const overview = await getInventoryOverview(prisma, req.school!.id);
      res.json({ movements: overview.recentMovements });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
