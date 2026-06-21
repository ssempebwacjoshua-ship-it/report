import { AttendanceDirection } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { verifyToken } from "../services/authService";
import {
  chargeCanteen,
  getAttendanceDashboard,
  getGateDashboard,
  getWalletDashboard,
  resolveNfcTokenForRole,
  scanAttendance,
  scanGate,
  type NfcOperationsContext,
} from "../services/nfcOperationsService";

const filtersSchema = z.object({
  search: z.string().optional(),
  classId: z.string().uuid().optional(),
  streamId: z.string().uuid().optional(),
});

const scanSchema = z.object({
  tokenOrUid: z.string().trim().min(1, "NFC token or UID is required."),
});

const attendanceScanSchema = scanSchema.extend({
  direction: z.enum(AttendanceDirection).optional(),
});

const chargeSchema = scanSchema.extend({
  amountCents: z.coerce.number().int().positive(),
  description: z.string().trim().optional(),
  idempotencyKey: z.string().trim().optional(),
});

function ctx(req: Express.Request): NfcOperationsContext {
  return {
    schoolId: req.school?.id,
    actorId: req.user?.userId,
    role: req.user?.role,
  };
}

function authPayloadFromHeader(authHeader: string | undefined) {
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  return token ? verifyToken(token) : null;
}

export function nfcPublicRoutes() {
  const router = Router();

  router.get("/api/nfc/t/:token", async (req, res, next) => {
    try {
      const auth = authPayloadFromHeader(req.headers.authorization);
      const result = await resolveNfcTokenForRole(req.params.token, auth ? { schoolId: auth.schoolId, actorId: auth.userId, role: auth.role } : null);
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  return router;
}

export function nfcOperationsRoutes() {
  const router = Router();

  router.get("/api/nfc/attendance", async (req, res, next) => {
    try {
      res.json(await getAttendanceDashboard(ctx(req), filtersSchema.parse(req.query)));
    } catch (error) {
      next(error);
    }
  });

  router.post("/api/nfc/attendance/scan", async (req, res, next) => {
    try {
      res.json(await scanAttendance(ctx(req), attendanceScanSchema.parse(req.body)));
    } catch (error) {
      next(error);
    }
  });

  router.get("/api/nfc/wallets", async (req, res, next) => {
    try {
      res.json(await getWalletDashboard(ctx(req), filtersSchema.parse(req.query)));
    } catch (error) {
      next(error);
    }
  });

  router.post("/api/nfc/canteen/charge", async (req, res, next) => {
    try {
      res.json(await chargeCanteen(ctx(req), chargeSchema.parse(req.body)));
    } catch (error) {
      next(error);
    }
  });

  router.get("/api/nfc/gate", async (req, res, next) => {
    try {
      res.json(await getGateDashboard(ctx(req)));
    } catch (error) {
      next(error);
    }
  });

  router.post("/api/nfc/gate/scan", async (req, res, next) => {
    try {
      res.json(await scanGate(ctx(req), scanSchema.parse(req.body)));
    } catch (error) {
      next(error);
    }
  });

  return router;
}
