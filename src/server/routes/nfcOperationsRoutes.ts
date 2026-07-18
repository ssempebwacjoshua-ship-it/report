import prismaPkg from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { verifyToken } from "../services/authService";
import {
  approveCanteenReconciliation,
  closeCanteenReconciliation,
  getCanteenReconciliation,
  rejectCanteenReconciliation,
} from "../services/nfcCanteenReconciliationService";
import {
  adjustWallet,
  changeWalletPin,
  chargeCanteen,
  getAttendanceDashboard,
  getAttendanceRegister,
  getDailySummary,
  getGateDashboard,
  getStudentWalletDetail,
  getStudentWalletPinStatus,
  getWalletDashboard,
  getWalletPinStatus,
  listAttendanceClasses,
  listWalletTransactions,
  resolveNfcTokenForRole,
  resolveWalletStudent,
  reverseTransaction,
  scanAttendance,
  scanGate,
  setStudentWalletPin,
  setWalletPin,
  topUpWallet,
  type NfcOperationsContext,
} from "../services/nfcOperationsService";
import {
  clearStudentFeeHold,
  createStudentFeeHold,
  getSchoolNfcPolicy,
  listStudentFeeHolds,
  searchNfcFeeHoldStudents,
  updateSchoolNfcPolicy,
} from "../services/nfcPolicyService";
import {
  cancelStudentPassOut,
  createStudentPassOut,
  listStudentPassOuts,
  searchPassOutStudents,
} from "../services/nfcPassOutService";
import {
  approveGateOverride,
  listClassroomAttendanceReport,
  listGateAttendanceReport,
} from "../services/locationAttendanceService";
import { attachUsageWarning, recordPlatformUsage, requirePlatformModule } from "../platformIntegration";

const { AttendanceDirection } = prismaPkg;

const filtersSchema = z.object({
  search: z.string().optional(),
  classId: z.string().uuid().optional(),
  streamId: z.string().uuid().optional(),
});

const scanSchema = z.object({
  tokenOrUid: z.string().trim().min(1, "NFC token or UID is required."),
  idempotencyKey: z.string().trim().optional(),
  deviceId: z.string().trim().optional(),
});

const attendanceScanSchema = scanSchema.extend({
  direction: z.nativeEnum(AttendanceDirection).optional(),
  idempotencyKey: z.string().trim().optional(),
});

const registerFiltersSchema = z.object({
  date: z.string().optional(),
  classId: z.string().uuid().optional(),
  streamId: z.string().uuid().optional(),
  search: z.string().optional(),
  studentType: z.enum(["ALL", "DAY", "BOARDING"]).optional(),
});

const gateAttendanceReportFiltersSchema = registerFiltersSchema.extend({
  attendanceStatus: z.enum(["ALL", "PRESENT", "LATE", "ABSENT"]).optional(),
  campusStatus: z.enum(["ALL", "ON_CAMPUS", "OFF_CAMPUS"]).optional(),
  departureMissing: z.coerce.boolean().optional(),
});

const classroomAttendanceReportFiltersSchema = registerFiltersSchema.extend({
  sessionType: z.enum(["ALL", "MORNING_CLASS", "NIGHT_PREP", "UNCLASSIFIED"]).optional(),
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

const reconciliationFiltersSchema = z.object({
  date: z.string().optional(),
  cashierUserId: z.string().uuid().optional(),
  shiftName: z.string().trim().optional(),
});

const reconciliationCloseSchema = z.object({
  date: z.string().trim().min(1, "Reconciliation date is required."),
  cashierUserId: z.string().uuid().optional().nullable(),
  shiftName: z.string().trim().optional().nullable(),
  canteenOperatorUserId: z.string().uuid().optional().nullable(),
  declaredCashUgx: z.coerce.number().int().min(0, "Declared cash cannot be negative."),
  declaredMobileMoneyUgx: z.coerce.number().int().min(0, "Declared mobile money cannot be negative."),
  notes: z.string().trim().optional().nullable(),
});

const reconciliationRejectSchema = z.object({
  notes: z.string().trim().min(1, "Rejection notes are required."),
});

const nfcPolicySchema = z.object({
  feeDefaulterBlockingEnabled: z.boolean(),
  feeDefaulterBlockScope: z.enum(["DAY_SCHOLARS_ONLY", "ALL_STUDENTS"]),
  attendanceTapInCutoffEnabled: z.boolean(),
  tapInCutoffTime: z.string().trim().nullable().optional(),
  cutoffLateAction: z.enum(["BLOCK_AND_MARK_ABSENT", "ALLOW_BUT_MARK_LATE"]),
  timezone: z.string().trim().min(1).default("Africa/Kampala"),
  duplicateWindowSeconds: z.coerce.number().int().min(15).max(600).default(60),
  gateArrivalStart: z.string().trim().default("05:30"),
  gateArrivalLateAfter: z.string().trim().default("08:00"),
  gateArrivalEnd: z.string().trim().default("10:00"),
  morningClassroomStart: z.string().trim().default("06:30"),
  morningClassroomEnd: z.string().trim().default("10:00"),
  gateDepartureStart: z.string().trim().default("14:00"),
  gateDepartureEnd: z.string().trim().default("19:00"),
  nightPrepStart: z.string().trim().default("18:30"),
  nightPrepEnd: z.string().trim().default("22:30"),
  nightPrepBoardingOnly: z.boolean().default(true),
  allowAutomaticCheckout: z.boolean().default(false),
  recordUnclassifiedScans: z.boolean().default(true),
  feeGatePolicyEnabled: z.boolean().default(false),
  gateOfflineEnabled: z.boolean(),
  canteenOfflineEnabled: z.boolean(),
  gateSnapshotValidHours: z.coerce.number().int().min(1).default(24),
  canteenSnapshotValidHours: z.coerce.number().int().min(1).default(12),
  maxOfflineSpendPerStudentPerDay: z.coerce.number().int().min(0).default(5000),
  maxOfflineSpendPerTransaction: z.coerce.number().int().min(0).default(2000),
  maxOfflineSpendPerDeviceSession: z.coerce.number().int().min(0).default(100000),
  unknownCardOfflinePolicy: z.literal("DENY"),
  frozenCardOfflinePolicy: z.literal("DENY"),
  deactivatedCardOfflinePolicy: z.literal("DENY"),
  offlineConflictPolicy: z.enum(["ALLOW_AND_FLAG", "HOLD_FOR_BURSAR_REVIEW"]),
});

const feeHoldFiltersSchema = z.object({
  search: z.string().optional(),
  classId: z.string().uuid().optional(),
  streamId: z.string().uuid().optional(),
  studentType: z.enum(["ALL", "DAY", "BOARDING"]).optional(),
  status: z.enum(["ALL", "ACTIVE", "CLEARED", "CANCELLED"]).optional(),
});

const createFeeHoldSchema = z.object({
  studentId: z.string().uuid(),
  reason: z.string().trim().optional().nullable(),
  balanceDueCents: z.coerce.number().int().min(0).optional().nullable(),
  effectiveFrom: z.string().trim().optional().nullable(),
});

const clearFeeHoldSchema = z.object({
  reason: z.string().trim().optional().nullable(),
});

const passOutFiltersSchema = z.object({
  search: z.string().optional(),
  classId: z.string().uuid().optional(),
  streamId: z.string().uuid().optional(),
  status: z.enum(["ALL", "APPROVED", "CHECKED_OUT", "RETURNED", "CANCELLED", "EXPIRED"]).optional(),
  activeOnly: z.coerce.boolean().optional(),
});

const createPassOutSchema = z.object({
  studentId: z.string().uuid(),
  reason: z.string().trim().min(1, "Pass-out reason is required."),
  activeFrom: z.string().trim().min(1, "Pass-out start time is required."),
  activeUntil: z.string().trim().min(1, "Pass-out end time is required."),
});

const cancelPassOutSchema = z.object({
  reason: z.string().trim().min(1, "Cancellation reason is required."),
});

const gateOverrideSchema = z.object({
  studentId: z.string().uuid(),
  reason: z.string().trim().min(1, "Override reason is required."),
  expiresAt: z.string().trim().min(1, "Override expiry is required."),
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
    paymentMethod: z.enum(["CASH", "MOBILE_MONEY", "PARENT_DEPOSIT", "ADJUSTMENT"]),
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

function validationError(message: string) {
  return Object.assign(new Error(message), { status: 400 });
}

function parseOrThrow<T>(result: { success: true; data: T } | { success: false; error: { issues?: Array<{ message?: string }> } }) {
  if (result.success) return result.data;
  throw validationError(result.error.issues?.[0]?.message || "Invalid request.");
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
      if (!(await requirePlatformModule(req, res, "nfc.core"))) {
        return;
      }
      res.json(await getAttendanceDashboard(ctx(req), filtersSchema.parse(req.query)));
    } catch (error) {
      next(error);
    }
  });

  router.get("/api/nfc/attendance/register", async (req, res, next) => {
    try {
      if (!(await requirePlatformModule(req, res, "nfc.core"))) {
        return;
      }
      res.json(await getAttendanceRegister(ctx(req), registerFiltersSchema.parse(req.query)));
    } catch (error) {
      next(error);
    }
  });

  router.get("/api/nfc/attendance/gate-report", async (req, res, next) => {
    try {
      if (!(await requirePlatformModule(req, res, "nfc.attendance"))) {
        return;
      }
      res.json(await listGateAttendanceReport(ctx(req), gateAttendanceReportFiltersSchema.parse(req.query)));
    } catch (error) {
      next(error);
    }
  });

  router.get("/api/nfc/attendance/classroom-report", async (req, res, next) => {
    try {
      if (!(await requirePlatformModule(req, res, "nfc.attendance"))) {
        return;
      }
      res.json(await listClassroomAttendanceReport(ctx(req), classroomAttendanceReportFiltersSchema.parse(req.query)));
    } catch (error) {
      next(error);
    }
  });

  router.post("/api/nfc/attendance/gate-overrides", async (req, res, next) => {
    try {
      if (!(await requirePlatformModule(req, res, "nfc.attendance"))) {
        return;
      }
      res.status(201).json(await approveGateOverride(ctx(req), gateOverrideSchema.parse(req.body)));
    } catch (error) {
      next(error);
    }
  });

  router.get("/api/nfc/classes", async (req, res, next) => {
    try {
      if (!(await requirePlatformModule(req, res, "nfc.core"))) {
        return;
      }
      res.json(await listAttendanceClasses(ctx(req)));
    } catch (error) {
      next(error);
    }
  });

  router.get("/api/nfc/policy", async (req, res, next) => {
    try {
      if (!(await requirePlatformModule(req, res, "nfc.core"))) {
        return;
      }
      res.json(await getSchoolNfcPolicy(ctx(req)));
    } catch (error) {
      next(error);
    }
  });

  router.put("/api/nfc/policy", async (req, res, next) => {
    try {
      if (!(await requirePlatformModule(req, res, "nfc.core"))) {
        return;
      }
      res.json(await updateSchoolNfcPolicy(ctx(req), nfcPolicySchema.parse(req.body)));
    } catch (error) {
      next(error);
    }
  });

  router.get("/api/nfc/fee-holds", async (req, res, next) => {
    try {
      if (!(await requirePlatformModule(req, res, "nfc.core"))) {
        return;
      }
      res.json(await listStudentFeeHolds(ctx(req), feeHoldFiltersSchema.parse(req.query)));
    } catch (error) {
      next(error);
    }
  });

  router.get("/api/nfc/fee-holds/students", async (req, res, next) => {
    try {
      if (!(await requirePlatformModule(req, res, "nfc.core"))) {
        return;
      }
      res.json(await searchNfcFeeHoldStudents(ctx(req), feeHoldFiltersSchema.parse(req.query)));
    } catch (error) {
      next(error);
    }
  });

  router.post("/api/nfc/fee-holds", async (req, res, next) => {
    try {
      if (!(await requirePlatformModule(req, res, "nfc.core"))) {
        return;
      }
      res.status(201).json(await createStudentFeeHold(ctx(req), createFeeHoldSchema.parse(req.body)));
    } catch (error) {
      next(error);
    }
  });

  router.patch("/api/nfc/fee-holds/:id/clear", async (req, res, next) => {
    try {
      if (!(await requirePlatformModule(req, res, "nfc.core"))) {
        return;
      }
      res.json(await clearStudentFeeHold(ctx(req), req.params.id, clearFeeHoldSchema.parse(req.body).reason));
    } catch (error) {
      next(error);
    }
  });

  router.get("/api/nfc/pass-outs", async (req, res, next) => {
    try {
      if (!(await requirePlatformModule(req, res, "nfc.core"))) {
        return;
      }
      res.json(await listStudentPassOuts(ctx(req), parseOrThrow(passOutFiltersSchema.safeParse(req.query))));
    } catch (error) {
      next(error);
    }
  });

  router.get("/api/nfc/pass-outs/students", async (req, res, next) => {
    try {
      if (!(await requirePlatformModule(req, res, "nfc.core"))) {
        return;
      }
      res.json(await searchPassOutStudents(ctx(req), parseOrThrow(filtersSchema.safeParse(req.query))));
    } catch (error) {
      next(error);
    }
  });

  router.post("/api/nfc/pass-outs", async (req, res, next) => {
    try {
      if (!(await requirePlatformModule(req, res, "nfc.core"))) {
        return;
      }
      res.status(201).json(await createStudentPassOut(ctx(req), parseOrThrow(createPassOutSchema.safeParse(req.body))));
    } catch (error) {
      next(error);
    }
  });

  router.patch("/api/nfc/pass-outs/:id/cancel", async (req, res, next) => {
    try {
      if (!(await requirePlatformModule(req, res, "nfc.core"))) {
        return;
      }
      res.json(await cancelStudentPassOut(ctx(req), req.params.id, parseOrThrow(cancelPassOutSchema.safeParse(req.body)).reason));
    } catch (error) {
      next(error);
    }
  });

  router.post("/api/nfc/attendance/scan", async (req, res, next) => {
    try {
      if (!(await requirePlatformModule(req, res, "nfc.attendance"))) {
        return;
      }
      const result = await scanAttendance(ctx(req), attendanceScanSchema.parse(req.body));
      attachUsageWarning(res, await recordPlatformUsage(req, {
        moduleCode: "nfc.attendance",
        quantity: 1,
        sourceType: "nfc_attendance_tap",
        sourceId: result.scan.scannedAt,
        metadataJson: { route: "/api/nfc/attendance/scan" },
      }));
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  router.get("/api/nfc/wallets", async (req, res, next) => {
    try {
      if (!(await requirePlatformModule(req, res, "nfc.wallet"))) {
        return;
      }
      res.json(await getWalletDashboard(ctx(req), filtersSchema.parse(req.query)));
    } catch (error) {
      next(error);
    }
  });

  router.post("/api/nfc/wallets/resolve-student", async (req, res, next) => {
    try {
      if (!(await requirePlatformModule(req, res, "nfc.wallet"))) {
        return;
      }
      res.json(await resolveWalletStudent(ctx(req), resolveWalletStudentSchema.parse(req.body)));
    } catch (error) {
      next(error);
    }
  });

  router.post("/api/nfc/wallets/top-up", async (req, res, next) => {
    try {
      if (!(await requirePlatformModule(req, res, "nfc.wallet"))) {
        return;
      }
      const result = await topUpWallet(ctx(req), topUpSchema.parse(req.body));
      if (result.ok && result.transaction?.id) {
        attachUsageWarning(res, await recordPlatformUsage(req, {
          moduleCode: "nfc.wallet",
          quantity: 1,
          sourceType: "nfc_wallet_transaction",
          sourceId: result.transaction.id,
          metadataJson: { route: "/api/nfc/wallets/top-up", kind: "top-up" },
        }));
      }
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  });

  router.post("/api/wallet/top-up", async (req, res, next) => {
    try {
      if (!(await requirePlatformModule(req, res, "nfc.wallet"))) {
        return;
      }
      const result = await topUpWallet(ctx(req), topUpSchema.parse(req.body));
      if (result.ok && result.transaction?.id) {
        attachUsageWarning(res, await recordPlatformUsage(req, {
          moduleCode: "nfc.wallet",
          quantity: 1,
          sourceType: "nfc_wallet_transaction",
          sourceId: result.transaction.id,
          metadataJson: { route: "/api/wallet/top-up", kind: "top-up" },
        }));
      }
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  });

  router.post("/api/nfc/wallet/top-up", async (req, res, next) => {
    try {
      if (!(await requirePlatformModule(req, res, "nfc.wallet"))) {
        return;
      }
      const result = await topUpWallet(ctx(req), topUpSchema.parse(req.body));
      if (result.ok && result.transaction?.id) {
        attachUsageWarning(res, await recordPlatformUsage(req, {
          moduleCode: "nfc.wallet",
          quantity: 1,
          sourceType: "nfc_wallet_transaction",
          sourceId: result.transaction.id,
          metadataJson: { route: "/api/nfc/wallet/top-up", kind: "top-up" },
        }));
      }
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  });

  router.get("/api/nfc/students/:studentId/wallet", async (req, res, next) => {
    try {
      if (!(await requirePlatformModule(req, res, "nfc.wallet"))) {
        return;
      }
      res.json(await getStudentWalletDetail(ctx(req), req.params.studentId));
    } catch (error) {
      next(error);
    }
  });

  router.get("/api/nfc/wallet-transactions", async (req, res, next) => {
    try {
      if (!(await requirePlatformModule(req, res, "nfc.wallet"))) {
        return;
      }
      res.json(await listWalletTransactions(ctx(req), txFiltersSchema.parse(req.query)));
    } catch (error) {
      next(error);
    }
  });

  router.post("/api/nfc/wallet-transactions/:id/reverse", async (req, res, next) => {
    try {
      if (!(await requirePlatformModule(req, res, "nfc.wallet"))) {
        return;
      }
      const { reason } = reverseSchema.parse(req.body);
      const result = await reverseTransaction(ctx(req), req.params.id, reason);
      if (result.reversal?.id) {
        attachUsageWarning(res, await recordPlatformUsage(req, {
          moduleCode: "nfc.wallet",
          quantity: 1,
          sourceType: "nfc_wallet_transaction",
          sourceId: result.reversal.id,
          metadataJson: { route: "/api/nfc/wallet-transactions/:id/reverse", kind: "reverse" },
        }));
      }
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  });

  router.post("/api/nfc/wallets/adjust", async (req, res, next) => {
    try {
      if (!(await requirePlatformModule(req, res, "nfc.wallet"))) {
        return;
      }
      const result = await adjustWallet(ctx(req), adjustSchema.parse(req.body));
      if (result.transaction?.id) {
        attachUsageWarning(res, await recordPlatformUsage(req, {
          moduleCode: "nfc.wallet",
          quantity: 1,
          sourceType: "nfc_wallet_transaction",
          sourceId: result.transaction.id,
          metadataJson: { route: "/api/nfc/wallets/adjust", kind: "adjust" },
        }));
      }
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  });

  router.get("/api/nfc/canteen/daily-summary", async (req, res, next) => {
    try {
      if (!(await requirePlatformModule(req, res, "nfc.core"))) {
        return;
      }
      res.json(await getDailySummary(ctx(req), dailySummarySchema.parse(req.query)));
    } catch (error) {
      next(error);
    }
  });

  router.get("/api/nfc/canteen/reconciliation", async (req, res, next) => {
    try {
      if (!(await requirePlatformModule(req, res, "nfc.canteen"))) {
        return;
      }
      res.json(await getCanteenReconciliation(ctx(req), reconciliationFiltersSchema.parse(req.query)));
    } catch (error) {
      next(error);
    }
  });

  router.post("/api/nfc/canteen/reconciliation/close", async (req, res, next) => {
    try {
      if (!(await requirePlatformModule(req, res, "nfc.canteen"))) {
        return;
      }
      res.status(201).json(await closeCanteenReconciliation(ctx(req), reconciliationCloseSchema.parse(req.body)));
    } catch (error) {
      next(error);
    }
  });

  router.post("/api/nfc/canteen/reconciliation/:id/approve", async (req, res, next) => {
    try {
      if (!(await requirePlatformModule(req, res, "nfc.canteen"))) {
        return;
      }
      res.json(await approveCanteenReconciliation(ctx(req), req.params.id));
    } catch (error) {
      next(error);
    }
  });

  router.post("/api/nfc/canteen/reconciliation/:id/reject", async (req, res, next) => {
    try {
      if (!(await requirePlatformModule(req, res, "nfc.canteen"))) {
        return;
      }
      res.json(await rejectCanteenReconciliation(ctx(req), req.params.id, reconciliationRejectSchema.parse(req.body).notes));
    } catch (error) {
      next(error);
    }
  });

  router.post("/api/nfc/canteen/charge", async (req, res, next) => {
    try {
      if (!(await requirePlatformModule(req, res, "nfc.canteen"))) {
        return;
      }
      const result = await chargeCanteen(ctx(req), chargeSchema.parse(req.body));
      if (result.ok && result.transaction?.id) {
        attachUsageWarning(res, await recordPlatformUsage(req, {
          moduleCode: "nfc.canteen",
          quantity: 1,
          sourceType: "nfc_canteen_payment",
          sourceId: result.transaction.id,
          metadataJson: { route: "/api/nfc/canteen/charge" },
        }));
      }
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  router.get("/api/nfc/gate", async (req, res, next) => {
    try {
      if (!(await requirePlatformModule(req, res, "nfc.core"))) {
        return;
      }
      res.json(await getGateDashboard(ctx(req)));
    } catch (error) {
      next(error);
    }
  });

  router.post("/api/nfc/gate/scan", async (req, res, next) => {
    try {
      if (!(await requirePlatformModule(req, res, "nfc.attendance"))) {
        return;
      }
      const result = await scanGate(ctx(req), scanSchema.parse(req.body));
      attachUsageWarning(res, await recordPlatformUsage(req, {
        moduleCode: "nfc.attendance",
        quantity: 1,
        sourceType: "nfc_attendance_tap",
        sourceId: result.scannedAt,
        metadataJson: { route: "/api/nfc/gate/scan" },
      }));
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  router.get("/api/nfc/wallets/student/:studentId/pin-status", async (req, res, next) => {
    try {
      if (!(await requirePlatformModule(req, res, "nfc.wallet"))) {
        return;
      }
      res.json(await getStudentWalletPinStatus(ctx(req), req.params.studentId));
    } catch (error) {
      next(error);
    }
  });

  router.post("/api/nfc/wallets/student/:studentId/pin", async (req, res, next) => {
    try {
      if (!(await requirePlatformModule(req, res, "nfc.wallet"))) {
        return;
      }
      res.json(await setStudentWalletPin(ctx(req), { studentId: req.params.studentId, ...setPinSchema.parse(req.body) }));
    } catch (error) {
      next(error);
    }
  });

  router.get("/api/nfc/wallets/:walletId/pin-status", async (req, res, next) => {
    try {
      if (!(await requirePlatformModule(req, res, "nfc.wallet"))) {
        return;
      }
      res.json(await getWalletPinStatus(ctx(req), req.params.walletId));
    } catch (error) {
      next(error);
    }
  });

  router.post("/api/nfc/wallets/:walletId/pin", async (req, res, next) => {
    try {
      if (!(await requirePlatformModule(req, res, "nfc.wallet"))) {
        return;
      }
      res.json(await setWalletPin(ctx(req), { walletId: req.params.walletId, ...setPinSchema.parse(req.body) }));
    } catch (error) {
      next(error);
    }
  });

  router.patch("/api/nfc/wallets/:walletId/pin", async (req, res, next) => {
    try {
      if (!(await requirePlatformModule(req, res, "nfc.wallet"))) {
        return;
      }
      res.json(await changeWalletPin(ctx(req), { walletId: req.params.walletId, ...changePinSchema.parse(req.body) }));
    } catch (error) {
      next(error);
    }
  });

  return router;
}
