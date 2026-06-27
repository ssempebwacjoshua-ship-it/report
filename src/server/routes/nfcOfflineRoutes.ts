import { Router } from "express";
import { z } from "zod";
import {
  bootstrapOfflineSnapshot,
  getOfflineSyncStatus,
  registerOfflineDevice,
  syncOfflineEvents,
} from "../services/nfcOfflineService";
import type { OfflineContext } from "../services/nfcOfflineService";

function ctx(req: Express.Request): OfflineContext {
  return {
    schoolId: req.school?.id,
    actorId: req.user?.userId,
    role: req.user?.role,
  };
}

const registerDeviceSchema = z.object({
  name: z.string().min(1, "Device name is required."),
  location: z.string().trim().optional().nullable(),
  deviceKey: z.string().trim().optional(),
  deviceToken: z.string().trim().optional(),
  roleScope: z.enum(["GATE_SECURITY", "CASHIER", "CANTEEN", "ADMIN_OPERATOR"]),
  mode: z.enum(["GATE", "CANTEEN", "ATTENDANCE"]).optional(),
});

const bootstrapQuerySchema = z.object({
  modules: z.string().optional(),
  deviceId: z.string().optional(),
  mode: z.enum(["GATE", "CANTEEN", "ATTENDANCE"]).optional(),
});

const syncSchema = z.object({
  deviceId: z.string().min(1),
  snapshotId: z.string().min(1),
  events: z.array(
    z.object({
      localId: z.string().min(1),
      schoolId: z.string().min(1),
      deviceId: z.string().min(1),
      snapshotId: z.string(),
      actionType: z.enum(["GATE_SCAN", "ATTENDANCE_SCAN", "CANTEEN_CHARGE"]),
      sequenceNumber: z.number().int().min(0),
      idempotencyKey: z.string().min(1),
      payload: z.unknown(),
      payloadHash: z.string(),
      previousHash: z.string().nullable(),
      eventHash: z.string(),
      createdAt: z.string(),
    }),
  ),
});

export function nfcOfflineRoutes() {
  const router = Router();

  // Register an offline-capable device
  router.post("/api/nfc/offline/devices/register", async (req, res, next) => {
    try {
      const body = registerDeviceSchema.parse(req.body);
      res.status(201).json(await registerOfflineDevice(ctx(req), body));
    } catch (error) {
      next(error);
    }
  });
  router.post("/internal/kiosk/devices/register", async (req, res, next) => {
    try {
      const body = registerDeviceSchema.parse(req.body);
      res.status(201).json(await registerOfflineDevice(ctx(req), body));
    } catch (error) {
      next(error);
    }
  });

  // Download offline snapshot (students, tags, wallets)
  router.get("/api/nfc/offline/bootstrap", async (req, res, next) => {
    try {
      const query = bootstrapQuerySchema.parse(req.query);
      const modules = query.modules ? query.modules.split(",").map((m) => m.trim()) : undefined;
      res.json(await bootstrapOfflineSnapshot(ctx(req), { modules, deviceId: query.deviceId, mode: query.mode }));
    } catch (error) {
      next(error);
    }
  });
  router.get("/internal/kiosk/offline-snapshot", async (req, res, next) => {
    try {
      const query = bootstrapQuerySchema.parse(req.query);
      const modules = query.modules ? query.modules.split(",").map((m) => m.trim()) : undefined;
      res.json(await bootstrapOfflineSnapshot(ctx(req), { modules, deviceId: query.deviceId, mode: query.mode }));
    } catch (error) {
      next(error);
    }
  });

  // Submit queued offline events for server validation
  router.post("/api/nfc/offline/sync", async (req, res, next) => {
    try {
      const body = syncSchema.parse(req.body);
      res.json(await syncOfflineEvents(ctx(req), body));
    } catch (error) {
      next(error);
    }
  });
  router.post("/internal/kiosk/sync", async (req, res, next) => {
    try {
      const body = syncSchema.parse(req.body);
      res.json(await syncOfflineEvents(ctx(req), body));
    } catch (error) {
      next(error);
    }
  });

  // View sync history / device status
  router.get("/api/nfc/offline/sync-status", async (req, res, next) => {
    try {
      res.json(await getOfflineSyncStatus(ctx(req)));
    } catch (error) {
      next(error);
    }
  });

  return router;
}
