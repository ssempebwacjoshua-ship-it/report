import { AttendanceDirection } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { verifyToken } from "../services/authService";
import {
  adjustWallet,
  changeWalletPin,
  chargeCanteen,
  getAttendanceDashboard,
  getDailySummary,
  getGateDashboard,
  getWalletDashboard,
  getWalletPinStatus,
  listWalletTransactions,
  resolveNfcTokenForRole,
  resolveWalletStudent,
  reverseTransaction,
  scanAttendance,
  scanGate,
  setWalletPin,
  topUpWallet,
  type NfcOperationsContext,
} from "../services/nfcOperationsService";

const filtersSchema = z.object({
  search: z.string().optional(),
  classId: z.string().uuid().optional(),
  streamId: z.string().uuid().optional(),
});

const scanSchema = z.object({
  tokenOrUid: z.string().trim().min(1, "NFC token or UID is required."),
  deviceId: z.string().trim().optional(),
});

const attendanceScanSchema = scanSchema.extend({
  direction: z.enum(AttendanceDirection).optional(),
  idempotencyKey: z.string().trim().optional(),
});

const chargeSchema = scanSchema.extend({
  amountCents: z.coerce.number().int().positive(),
  pin: z.string().regex(/^\d{4,6}$/, "PIN must be 4 to 6 digits."),
  description: z.string().trim().optional(),
  idempotencyKey: z.string().trim().optional(),
});

const setPinSchema = z.object({
  pin: z.string().regex(/^\d{4,6}$/, "PIN must be 4 to 6 digits."),
  reason: z.string().trim().min(1, "Reason is required."),
});

const changePinSchema = z.object({
  oldPin: z.string().regex(/^\d{4,6}$/, "PIN must be 4 to 6 digits."),
  newPin: z.string().regex(/^\d{4,6}$/, "PIN must be 4 to 6 digits."),
});

const txFiltersSchema = z.object({
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  studentId: z.string().uuid().optional(),
  admissionNumber: z.string().optional(),
  classId: z.string().uuid().optional(),
  streamId: z.string().uuid().optional(),
  cashierUserId: z.string().uuid().optional(),
  type: z.string().optional(),
  search: z.string().optional(),
});

const reverseSchema = z.object({
  reason: z.string().trim().min(1, "Reversal reason is required."),
});

const adjustSchema = z
  .object({
    studentId: z.string().uuid().optional(),
    admissionNumber: z.string().min(1).optional(),
    amountUgx: z.coerce.number().refine((v) => v !== 0, { message: "Amount must be non-zero." }),
    reason: z.string().trim().min(1, "Adjustment reason is required."),
  })
  .refine((v) => v.studentId || v.admissionNumber, { message: "Provide studentId or admissionNumber." });

const dailySummarySchema = z.object({
  date: z.string().optional(),
  cashierUserId: z.string().uuid().optional(),
});

const resolveWalletStudentSchema = z
  .object({
    studentId: z.string().uuid().optional(),
    admissionNumber: z.string().min(1).optional(),
    tokenOrUid: z.string().trim().min(1).optional(),
  })
  .refine((v) => v.studentId || v.admissionNumber || v.tokenOrUid, {
    message: "Provide studentId, admissionNumber, or tokenOrUid.",
  });

const topUpSchema = z
  .object({
    studentId: z.string().uuid().optional(),
    admissionNumber: z.string().min(1).optional(),
    tokenOrUid: z.string().trim().min(1).optional(),
    amountUgx: z.coerce.number().positive("Amount must be greater than zero."),
    paymentMethod: z.enum(["CASH", "MOBILE_MONEY", "BANK", "MANUAL_ADJUSTMENT"]),
    reference: z.string().trim().optional(),
    notes: z.string().trim().optional(),
    idempotencyKey: z.string().trim().optional(),
  })
  .refine((v) => v.studentId || v.admissionNumber || v.tokenOrUid, {
    message: "Provide studentId, admissionNumber, or tokenOrUid.",
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
  try {
    return token ? verifyToken(token) : null;
  } catch {
    return null;
  }
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

  router.post("/api/nfc/wallets/resolve-student", async (req, res, next) => {
    try {
      res.json(await resolveWalletStudent(ctx(req), resolveWalletStudentSchema.parse(req.body)));
    } catch (error) {
      next(error);
    }
  });

  router.post("/api/nfc/wallets/top-up", async (req, res, next) => {
    try {
      res.status(201).json(await topUpWallet(ctx(req), topUpSchema.parse(req.body)));
    } catch (error) {
      next(error);
    }
  });

  router.get("/api/nfc/wallet-transactions", async (req, res, next) => {
    try {
      res.json(await listWalletTransactions(ctx(req), txFiltersSchema.parse(req.query)));
    } catch (error) {
      next(error);
    }
  });

  router.post("/api/nfc/wallet-transactions/:id/reverse", async (req, res, next) => {
    try {
      const { reason } = reverseSchema.parse(req.body);
      res.status(201).json(await reverseTransaction(ctx(req), req.params.id, reason));
    } catch (error) {
      next(error);
    }
  });

  router.post("/api/nfc/wallets/adjust", async (req, res, next) => {
    try {
      res.status(201).json(await adjustWallet(ctx(req), adjustSchema.parse(req.body)));
    } catch (error) {
      next(error);
    }
  });

  router.get("/api/nfc/canteen/daily-summary", async (req, res, next) => {
    try {
      res.json(await getDailySummary(ctx(req), dailySummarySchema.parse(req.query)));
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

  router.get("/api/nfc/wallets/:walletId/pin-status", async (req, res, next) => {
    try {
      res.json(await getWalletPinStatus(ctx(req), req.params.walletId));
    } catch (error) {
      next(error);
    }
  });

  router.post("/api/nfc/wallets/:walletId/pin", async (req, res, next) => {
    try {
      res.json(await setWalletPin(ctx(req), { walletId: req.params.walletId, ...setPinSchema.parse(req.body) }));
    } catch (error) {
      next(error);
    }
  });

  router.patch("/api/nfc/wallets/:walletId/pin", async (req, res, next) => {
    try {
      res.json(await changeWalletPin(ctx(req), { walletId: req.params.walletId, ...changePinSchema.parse(req.body) }));
    } catch (error) {
      next(error);
    }
  });

  return router;
}
