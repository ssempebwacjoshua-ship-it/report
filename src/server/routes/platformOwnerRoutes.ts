import { Router } from "express";
import { z } from "zod";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { prisma } from "../db/prisma";
import { requirePlatformOwner } from "../middleware/requirePlatformOwner";
import { hashPassword } from "../services/authService";
import { buildDeviceIdentityWhere, RECENT_DEVICE_ORDER_BY } from "../utils/deviceIdentity";
import { REPORT_LAB_PLANS, getPlanByCode } from "../../shared/constants/subscriptionPlans";
import { CANONICAL_STREAM_CODES, provisionSchoolOnboarding } from "../services/schoolStructureProvisioningService";
import { getSmartPagesPackage } from "../services/smartPagesService";
import type { SmartPagesPackageCode, SmartPagesPaymentNetwork, SmartPagesPaymentRequest } from "../../shared/types/smartPages";
import { generateReaderGatewayActivationCode, hashReaderGatewayActivationCode } from "../services/readerGatewayRegistrationService";

const validPlanCodes = REPORT_LAB_PLANS.map((p) => p.code) as [string, ...string[]];
const FEATURE_FLAGS = ["REPORT_LAB", "SMART_PAGES", "ATTENDANCE", "WALLET", "GATE", "NFC", "OCR", "AI"] as const;
const MAINTENANCE_ACTIONS = ["FORCE_SYNC", "REBUILD_SEARCH", "REPAIR_DOCUMENTS", "REGENERATE_QR_CODES", "RESEND_PENDING_EMAILS"] as const;
const READER_ACTIONS = ["RESTART", "SYNC", "UPDATE_FIRMWARE", "RE_REGISTER"] as const;
const READER_STALE_WINDOW_MS = 5 * 60 * 1000;
const READER_AUDIT_ACTIONS = [
  "reader_device.registered",
  "reader_device.re_registered",
  "reader_device.activated",
  "reader_device.heartbeat",
  "reader_event.attendance",
  "reader_device.ota_status",
] as const;
const READER_ACTIVATION_WINDOW_MS = 24 * 60 * 60 * 1000;

function ownerAudit(actorId: string, schoolId: string, action: string, details?: Record<string, unknown>) {
  return prisma.auditLog.create({ data: { schoolId, action, details: { actorUserId: actorId, ...details } } });
}

function requestIdFrom(req: { headers: Record<string, unknown> }) {
  const header = req.headers["x-request-id"];
  return typeof header === "string" && header.trim() ? header.trim() : randomUUID();
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function generateTemporaryPassword() {
  return `Sc-${randomBytes(9).toString("base64url")}!`;
}

function generateDeviceToken() {
  return randomBytes(32).toString("base64url");
}

async function requireOwnerSchool(schoolId: string) {
  const school = await prisma.school.findUnique({ where: { id: schoolId }, select: { id: true, name: true, code: true } });
  if (!school) throw Object.assign(new Error("School not found."), { status: 404 });
  return school;
}

function mapAuditLog(row: { id: string; action: string; correlationId: string | null; details: unknown; createdAt: Date }) {
  return {
    id: row.id,
    action: row.action,
    correlationId: row.correlationId,
    details: row.details,
    createdAt: row.createdAt.toISOString(),
  };
}

function mapReader(row: any) {
  const lastHeartbeatAt = row.lastHeartbeatAt ?? row.lastSeenAt ?? null;
  const heartbeatAgeMs = lastHeartbeatAt ? Date.now() - new Date(lastHeartbeatAt).getTime() : Number.POSITIVE_INFINITY;
  const activationExpired = row.provisioningStatus === "PENDING_SETUP"
    && row.activationCodeExpiresAt
    && new Date(row.activationCodeExpiresAt).getTime() <= Date.now();
  const effectiveProvisioningStatus = activationExpired ? "ACTIVATION_EXPIRED" : (row.provisioningStatus ?? "ACTIVE");
  const isPendingSetup = effectiveProvisioningStatus === "PENDING_SETUP";
  const isOnline = row.isActive && row.status === "ACTIVE" && effectiveProvisioningStatus === "ACTIVE" && heartbeatAgeMs <= READER_STALE_WINDOW_MS;
  const isAttendanceReader = row.mode === "ATTENDANCE";
  const effectiveAttendanceMode = row.attendanceMode
    ?? (row.locationType === "GATE" ? "GATE_ATTENDANCE" : row.locationType === "CLASSROOM" ? "CLASSROOM_ATTENDANCE" : null);
  const setupStatus = isAttendanceReader && (!row.locationType || !effectiveAttendanceMode)
    ? "INCOMPLETE_SETUP"
    : "READY";
  const derivedOnlineStatus = effectiveProvisioningStatus === "PENDING_SETUP"
    ? "PENDING_SETUP"
    : effectiveProvisioningStatus === "ACTIVATION_EXPIRED"
      ? "ACTIVATION_EXPIRED"
      : effectiveProvisioningStatus === "ACTIVATION_FAILED"
        ? "ACTIVATION_FAILED"
        : row.isActive && row.status === "ACTIVE"
          ? (isOnline ? "ONLINE" : "OFFLINE")
          : "DISABLED";
  return {
    id: row.id,
    schoolId: row.schoolId,
    school: row.school ? {
      id: row.school.id as string,
      code: row.school.code as string,
      name: row.school.name as string,
    } : null,
    name: row.name,
    deviceKey: row.deviceKey,
    location: row.location,
    locationType: row.locationType ?? null,
    locationName: row.locationName ?? row.location ?? null,
    mode: row.mode,
    attendanceMode: effectiveAttendanceMode,
    setupStatus,
    studentScope: row.studentScope ?? null,
    classId: row.classId ?? null,
    streamId: row.streamId ?? null,
    status: row.status,
    provisioningStatus: effectiveProvisioningStatus,
    assignmentStatus: row.schoolId ? "ASSIGNED" : "UNASSIGNED",
    isActive: row.isActive,
    firmwareVersion: row.firmwareVersion ?? null,
    lastHeartbeatAt: lastHeartbeatAt ? new Date(lastHeartbeatAt).toISOString() : null,
    uptimeMs: row.uptimeMs ?? null,
    freeHeap: row.freeHeap ?? null,
    rebootReason: row.rebootReason ?? null,
    lastIp: row.lastIp ?? null,
    lastRssi: row.lastRssi ?? null,
    lastSeenAt: row.lastSeenAt ? row.lastSeenAt.toISOString() : null,
    lastScanAt: row.lastScanAt ? row.lastScanAt.toISOString() : null,
    lastScanStatus: row.lastScanStatus ?? null,
    lastScanMessage: row.lastScanMessage ?? null,
    queueDepth: row.queueDepth ?? 0,
    onlineStatus: derivedOnlineStatus,
    rawOnlineStatus: row.onlineStatus ?? "OFFLINE",
    otaStatus: row.otaStatus ?? null,
    otaMessage: row.otaMessage ?? null,
    heartbeatStale: row.isActive && row.status === "ACTIVE" && effectiveProvisioningStatus === "ACTIVE" && !isOnline,
    hasToken: Boolean(row.deviceTokenHash),
    tokenHashPrefix: row.deviceTokenHash ? `${String(row.deviceTokenHash).slice(0, 10)}...` : null,
    activationExpiresAt: row.activationCodeExpiresAt ? new Date(row.activationCodeExpiresAt).toISOString() : null,
    activationUsedAt: row.activationCodeUsedAt ? new Date(row.activationCodeUsedAt).toISOString() : null,
    activationFailedAttempts: row.activationFailedAttempts ?? 0,
    activationLastError: row.activationLastError ?? null,
    activationBoundHardwareId: row.activationBoundHardwareId ?? null,
    pendingSetup: isPendingSetup,
  };
}

function extractReaderIdentity(details: unknown) {
  if (!details || typeof details !== "object") return null;
  const payload = details as Record<string, unknown>;
  const identifiers = [
    payload.deviceId,
    payload.readerId,
    payload.deviceKey,
    payload.targetDeviceId,
  ].filter((value) => typeof value === "string" && value.trim());
  return identifiers.map((value) => String(value).trim());
}

function readerEventMatchesDevice(details: unknown, device: { id: string; deviceKey: string }) {
  const identifiers = extractReaderIdentity(details);
  if (!identifiers) return false;
  return identifiers.includes(device.id) || identifiers.includes(device.deviceKey);
}

function summarizeReaderAuditLog(log: { action: string; createdAt: Date; details: unknown } | null) {
  if (!log) return null;
  const details = log.details && typeof log.details === "object"
    ? log.details as Record<string, unknown>
    : {};
  return {
    action: log.action,
    createdAt: log.createdAt.toISOString(),
    deviceId: typeof details.deviceId === "string" ? details.deviceId : null,
    readerId: typeof details.readerId === "string" ? details.readerId : null,
    schoolCode: typeof details.schoolCode === "string" ? details.schoolCode : null,
    deviceName: typeof details.deviceName === "string" ? details.deviceName : null,
    location: typeof details.location === "string" ? details.location : null,
    readerType: typeof details.readerType === "string" ? details.readerType : null,
    firmwareVersion: typeof details.firmwareVersion === "string" ? details.firmwareVersion : null,
    firmwareChannel: typeof details.firmwareChannel === "string" ? details.firmwareChannel : null,
    assignmentStatus: typeof details.assignmentStatus === "string" ? details.assignmentStatus : null,
  };
}

function smartPagesPaymentToDto(row: any): SmartPagesPaymentRequest {
  return {
    id: row.id as string,
    schoolId: row.schoolId as string,
    schoolName: row.school?.name as string | undefined,
    packageCode: row.packageCode as SmartPagesPackageCode,
    packageName: row.packageName as string,
    credits: row.credits as number,
    amountUgx: row.amountUgx as number,
    network: row.network as SmartPagesPaymentNetwork,
    merchantCode: row.merchantCode as string,
    merchantName: row.merchantName as string,
    paymentReference: row.paymentReference as string,
    transactionId: row.transactionId as string | null,
    payerPhone: row.payerPhone as string | null,
    proofScreenshotUrl: row.proofScreenshotUrl as string | null,
    status: row.status as SmartPagesPaymentRequest["status"],
    adminNotes: row.adminNotes as string | null,
    createdAt: (row.createdAt as Date).toISOString(),
    updatedAt: row.updatedAt ? (row.updatedAt as Date).toISOString() : undefined,
  };
}

export function platformOwnerRoutes() {
  const router = Router();

  // ── Dashboard stats ──────────────────────────────────────────────────────────

  router.get("/api/owner/dashboard", requirePlatformOwner, async (req, res, next) => {
    try {
      const [totalSchools, subscriptions, totalUsers, recentSchools] = await Promise.all([
        prisma.school.count(),
        prisma.reportLabSubscription.findMany({ select: { status: true } }),
        prisma.user.count({ where: { isPlatformOwner: false } }),
        prisma.school.findMany({
          orderBy: { createdAt: "desc" },
          take: 5,
          select: { id: true, code: true, name: true, createdAt: true },
        }),
      ]);

      const statusCounts = subscriptions.reduce<Record<string, number>>((acc, s) => {
        acc[s.status] = (acc[s.status] ?? 0) + 1;
        return acc;
      }, {});

      res.json({
        totalSchools,
        activeSchools: statusCounts["ACTIVE"] ?? 0,
        expiredSchools: statusCounts["EXPIRED"] ?? 0,
        suspendedSchools: statusCounts["SUSPENDED"] ?? 0,
        noSubscriptionSchools: totalSchools - subscriptions.length,
        totalUsers,
        recentSchools,
      });
    } catch (error) {
      next(error);
    }
  });

  // ── Schools ──────────────────────────────────────────────────────────────────

  router.get("/api/owner/schools", requirePlatformOwner, async (_req, res, next) => {
    try {
      const schools = await prisma.school.findMany({
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          code: true,
          name: true,
          phone: true,
          email: true,
          address: true,
          logoUrl: true,
          timezone: true,
          brandingMode: true,
          isActive: true,
          createdAt: true,
          subscription: { select: { planCode: true, status: true, currentPeriodEnd: true, studentLimit: true } },
          users: { where: { role: "ADMIN_OPERATOR", isActive: true, isPlatformOwner: false }, select: { id: true, name: true, email: true }, take: 1 },
          _count: { select: { students: true } },
        },
      });

      res.json({
        schools: schools.map((s) => ({
          id: s.id,
          code: s.code,
          name: s.name,
          phone: s.phone,
          email: s.email,
          address: s.address,
          logoUrl: s.logoUrl,
          timezone: s.timezone,
          brandingMode: s.brandingMode,
          isActive: s.isActive,
          createdAt: s.createdAt.toISOString(),
          subscription: s.subscription ?? null,
          primaryAdmin: s.users[0] ?? null,
          studentCount: s._count.students,
        })),
      });
    } catch (error) {
      next(error);
    }
  });

  // ── Users ────────────────────────────────────────────────────────────────────

  router.get("/api/owner/users", requirePlatformOwner, async (req, res, next) => {
    try {
      const search = typeof req.query.search === "string" ? req.query.search.trim() : undefined;
      const schoolId = typeof req.query.schoolId === "string" ? req.query.schoolId : undefined;
      const isActive = req.query.isActive === "false" ? false : req.query.isActive === "true" ? true : undefined;

      const users = await prisma.user.findMany({
        where: {
          isPlatformOwner: false,
          ...(schoolId ? { schoolId } : {}),
          ...(isActive !== undefined ? { isActive } : {}),
          ...(search
            ? {
                OR: [
                  { name: { contains: search, mode: "insensitive" } },
                  { email: { contains: search, mode: "insensitive" } },
                ],
              }
            : {}),
        },
        orderBy: { createdAt: "desc" },
        take: 200,
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          isActive: true,
          mustChangePassword: true,
          lastLoginAt: true,
          createdAt: true,
          school: { select: { id: true, code: true, name: true } },
        },
      });

      res.json({ users });
    } catch (error) {
      next(error);
    }
  });

  const createUserSchema = z.object({
    schoolId: z.string().uuid("Invalid school ID."),
    name: z.string().min(2, "Name must be at least 2 characters."),
    email: z.string().email("Enter a valid email address."),
    role: z.enum(["ADMIN_OPERATOR"]),
    temporaryPassword: z.string().min(8, "Password must be at least 8 characters."),
  });

  router.post("/api/owner/users", requirePlatformOwner, async (req, res, next) => {
    try {
      const body = createUserSchema.parse(req.body);

      const school = await prisma.school.findUnique({ where: { id: body.schoolId }, select: { id: true } });
      if (!school) {
        res.status(404).json({ error: "School not found." });
        return;
      }

      const existing = await prisma.user.findFirst({ where: { schoolId: body.schoolId, email: body.email.toLowerCase() } });
      if (existing) {
        res.status(409).json({ error: "A user with this email already exists in the selected school." });
        return;
      }

      const passwordHash = await hashPassword(body.temporaryPassword);
      const user = await prisma.user.create({
        data: {
          schoolId: body.schoolId,
          name: body.name,
          email: body.email.toLowerCase(),
          role: body.role,
          passwordHash,
          mustChangePassword: true,
          isActive: true,
        },
        select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true },
      });

      void ownerAudit(req.user!.userId, body.schoolId, "OWNER_CREATE_USER", { targetUserId: user.id, email: user.email }).catch(() => {});

      res.status(201).json({ user, mustChangePassword: true });
    } catch (error) {
      next(error);
    }
  });

  router.patch("/api/owner/users/:userId", requirePlatformOwner, async (req, res, next) => {
    try {
      const { userId } = req.params;
      const body = z.object({ name: z.string().min(2).optional(), role: z.enum(["ADMIN_OPERATOR"]).optional() }).parse(req.body);

      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user || user.isPlatformOwner) {
        res.status(404).json({ error: "User not found." });
        return;
      }

      const updated = await prisma.user.update({
        where: { id: userId },
        data: body,
        select: { id: true, name: true, email: true, role: true, isActive: true },
      });

      void ownerAudit(req.user!.userId, user.schoolId, "OWNER_UPDATE_USER", { targetUserId: userId, changes: body }).catch(() => {});
      res.json({ user: updated });
    } catch (error) {
      next(error);
    }
  });

  router.post("/api/owner/users/:userId/reset-password", requirePlatformOwner, async (req, res, next) => {
    try {
      const { userId } = req.params;
      const body = z.object({
        temporaryPassword: z.string().min(8).optional(),
        generateTemporaryPassword: z.boolean().optional(),
        sendResetEmail: z.boolean().optional(),
      }).parse(req.body);

      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user || user.isPlatformOwner) {
        res.status(404).json({ error: "User not found." });
        return;
      }

      const temporaryPassword = body.generateTemporaryPassword ? generateTemporaryPassword() : body.temporaryPassword;
      if (!temporaryPassword) {
        res.status(400).json({ error: "Temporary password is required unless generation is requested." });
        return;
      }

      const passwordHash = await hashPassword(temporaryPassword);
      await prisma.user.update({
        where: { id: userId },
        data: { passwordHash, mustChangePassword: true, tokenVersion: { increment: 1 } },
      });

      void ownerAudit(req.user!.userId, user.schoolId, "PASSWORD_RESET_BY_OWNER", {
        targetUserId: userId,
        generatedTemporaryPassword: Boolean(body.generateTemporaryPassword),
        resetEmailRequested: Boolean(body.sendResetEmail),
        resetEmailQueued: false,
      }).catch(() => {});
      res.json({
        ok: true,
        mustChangePassword: true,
        temporaryPassword: body.generateTemporaryPassword ? temporaryPassword : undefined,
        resetEmailQueued: false,
      });
    } catch (error) {
      next(error);
    }
  });

  router.post("/api/owner/users/:userId/disable", requirePlatformOwner, async (req, res, next) => {
    try {
      const { userId } = req.params;
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user || user.isPlatformOwner) {
        res.status(404).json({ error: "User not found." });
        return;
      }

      await prisma.user.update({ where: { id: userId }, data: { isActive: false, tokenVersion: { increment: 1 } } });
      void ownerAudit(req.user!.userId, user.schoolId, "USER_SUSPENDED_BY_OWNER", { targetUserId: userId }).catch(() => {});
      res.json({ ok: true });
    } catch (error) {
      next(error);
    }
  });

  router.post("/api/owner/users/:userId/enable", requirePlatformOwner, async (req, res, next) => {
    try {
      const { userId } = req.params;
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user || user.isPlatformOwner) {
        res.status(404).json({ error: "User not found." });
        return;
      }

      await prisma.user.update({ where: { id: userId }, data: { isActive: true } });
      void ownerAudit(req.user!.userId, user.schoolId, "USER_REACTIVATED_BY_OWNER", { targetUserId: userId }).catch(() => {});
      res.json({ ok: true });
    } catch (error) {
      next(error);
    }
  });

  router.post("/api/owner/users/:userId/unlock", requirePlatformOwner, async (req, res, next) => {
    try {
      const { userId } = req.params;
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user || user.isPlatformOwner) {
        res.status(404).json({ error: "User not found." });
        return;
      }

      await prisma.user.update({
        where: { id: userId },
        data: { isActive: true, tokenVersion: { increment: 1 } },
      });
      void ownerAudit(req.user!.userId, user.schoolId, "ACCOUNT_UNLOCKED_BY_OWNER", { targetUserId: userId }).catch(() => {});
      res.json({ ok: true, sessionsInvalidated: true });
    } catch (error) {
      next(error);
    }
  });

  router.post("/api/owner/users/:userId/suspend", requirePlatformOwner, async (req, res, next) => {
    try {
      const { userId } = req.params;
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user || user.isPlatformOwner) {
        res.status(404).json({ error: "User not found." });
        return;
      }
      await prisma.user.update({ where: { id: userId }, data: { isActive: false, tokenVersion: { increment: 1 } } });
      void ownerAudit(req.user!.userId, user.schoolId, "USER_SUSPENDED_BY_OWNER", { targetUserId: userId }).catch(() => {});
      res.json({ ok: true });
    } catch (error) {
      next(error);
    }
  });

  router.post("/api/owner/users/:userId/reactivate", requirePlatformOwner, async (req, res, next) => {
    try {
      const { userId } = req.params;
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user || user.isPlatformOwner) {
        res.status(404).json({ error: "User not found." });
        return;
      }
      await prisma.user.update({ where: { id: userId }, data: { isActive: true } });
      void ownerAudit(req.user!.userId, user.schoolId, "USER_REACTIVATED_BY_OWNER", { targetUserId: userId }).catch(() => {});
      res.json({ ok: true });
    } catch (error) {
      next(error);
    }
  });

  // ── School creation ──────────────────────────────────────────────────────────

  const createSchoolSchema = z.object({
    schoolName: z.string().min(2, "School name must be at least 2 characters.").max(200),
    schoolCode: z
      .string()
      .min(2, "School code must be at least 2 characters.")
      .max(50, "School code must be at most 50 characters.")
      .regex(/^[A-Z0-9-]+$/, "School code must be uppercase letters, digits, and hyphens only. No spaces."),
    phone: z.string().max(50).optional(),
    address: z.string().max(500).optional(),
    sections: z.array(z.enum(["NURSERY", "PRIMARY", "SECONDARY", "COMBINED"])).min(1, "At least one section is required."),
    defaultStreamCodes: z.array(z.enum(CANONICAL_STREAM_CODES)).min(1).max(CANONICAL_STREAM_CODES.length).optional(),
    planCode: z.enum(validPlanCodes as [string, ...string[]]),
    trialDays: z.number().int().min(0).max(365).optional(),
    adminName: z.string().min(2, "Admin name must be at least 2 characters.").max(100),
    adminEmail: z.string().email("Enter a valid admin email."),
    adminTemporaryPassword: z.string().min(10, "Temporary password must be at least 10 characters."),
  });

  router.post("/api/owner/schools", requirePlatformOwner, async (req, res, next) => {
    try {
      const body = createSchoolSchema.parse(req.body);

      const existing = await prisma.school.findUnique({ where: { code: body.schoolCode } });
      if (existing) {
        res.status(409).json({ error: `School code ${body.schoolCode} is already in use.` });
        return;
      }

      const plan = getPlanByCode(body.planCode);

      const result = await prisma.$transaction(async (tx) => {
        return provisionSchoolOnboarding(
          tx as any,
          {
            schoolName: body.schoolName,
            schoolCode: body.schoolCode,
            phone: body.phone ?? null,
            address: body.address ?? null,
            sections: body.sections,
            defaultStreamCodes: body.defaultStreamCodes,
            planCode: body.planCode,
            trialDays: body.trialDays,
            adminName: body.adminName,
            adminEmail: body.adminEmail,
            adminTemporaryPassword: body.adminTemporaryPassword,
          },
          req.user!.userId,
          {
            studentLimit: plan?.studentLimit ?? null,
            setupFeeUgx: plan?.setupFeeUgx ?? 0,
            annualLicenseUgx: plan?.annualLicenseUgx ?? 0,
          },
        );
      });

      res.status(201).json({
        ok: true,
        school: result.school,
        subscription: {
          id: result.subscription.id,
          planCode: result.subscription.planCode,
          status: result.subscription.status,
          currentPeriodEnd: result.subscription.currentPeriodEnd.toISOString(),
          studentLimit: result.subscription.studentLimit,
        },
        invoice: {
          id: result.invoice.id,
          setupFeeUgx: result.invoice.setupFeeUgx,
          amountUgx: result.invoice.amountUgx,
          totalUgx: result.invoice.totalUgx,
          status: result.invoice.status,
        },
        admin: {
          id: result.admin.id,
          email: result.admin.email,
          name: result.admin.name,
          mustChangePassword: result.admin.mustChangePassword,
        },
        academicYear: {
          id: result.academicYear.id,
          name: result.academicYear.name,
        },
        activeTerm: {
          id: result.activeTerm.id,
          name: result.activeTerm.name,
        },
        settings: result.settings,
        classesSeeded: result.structure.classCount,
        streamsSeeded: result.structure.streamCount,
      });
    } catch (error) {
      next(error);
    }
  });

  // ── Single school ────────────────────────────────────────────────────────────

  router.get("/api/owner/schools/:schoolId", requirePlatformOwner, async (req, res, next) => {
    try {
      const { schoolId } = req.params;
      const school = await prisma.school.findUnique({
        where: { id: schoolId },
        select: {
          id: true,
          code: true,
          name: true,
          phone: true,
          email: true,
          address: true,
          logoUrl: true,
          timezone: true,
          brandingMode: true,
          isActive: true,
          createdAt: true,
          subscription: {
            select: { id: true, planCode: true, status: true, currentPeriodEnd: true, studentLimit: true },
          },
          users: {
            where: { isPlatformOwner: false },
            select: { id: true, name: true, email: true, role: true, isActive: true, lastLoginAt: true },
            orderBy: { createdAt: "asc" },
          },
          _count: { select: { students: true } },
        },
      });

      if (!school) {
        res.status(404).json({ error: "School not found." });
        return;
      }

      res.json({
        school: {
          ...school,
          createdAt: school.createdAt.toISOString(),
          studentCount: school._count.students,
          subscription: school.subscription ?? null,
          _count: undefined,
        },
      });
    } catch (error) {
      next(error);
    }
  });

  // ── Update / disable school ──────────────────────────────────────────────────

  const patchSchoolSchema = z.object({
    name: z.string().min(2).max(200).optional(),
    phone: z.string().max(50).nullable().optional(),
    email: z.string().email().nullable().optional(),
    address: z.string().max(500).nullable().optional(),
    logoUrl: z.string().url().nullable().optional(),
    timezone: z.string().min(2).max(80).optional(),
    brandingMode: z.enum(["PLATFORM_DEFAULTS", "SCHOOL_BRANDED"]).optional(),
    isActive: z.boolean().optional(),
  });

  router.patch("/api/owner/schools/:schoolId", requirePlatformOwner, async (req, res, next) => {
    try {
      const { schoolId } = req.params;
      const body = patchSchoolSchema.parse(req.body);

      const school = await prisma.school.findUnique({ where: { id: schoolId } });
      if (!school) {
        res.status(404).json({ error: "School not found." });
        return;
      }

      const updated = await prisma.school.update({
        where: { id: schoolId },
        data: {
          ...(body.name !== undefined ? { name: body.name } : {}),
          ...(body.phone !== undefined ? { phone: body.phone } : {}),
          ...(body.email !== undefined ? { email: body.email } : {}),
          ...(body.address !== undefined ? { address: body.address } : {}),
          ...(body.logoUrl !== undefined ? { logoUrl: body.logoUrl } : {}),
          ...(body.timezone !== undefined ? { timezone: body.timezone } : {}),
          ...(body.brandingMode !== undefined ? { brandingMode: body.brandingMode } : {}),
          ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
        },
        select: { id: true, code: true, name: true, phone: true, email: true, address: true, logoUrl: true, timezone: true, brandingMode: true, isActive: true },
      });

      const action = body.isActive === false ? "OWNER_DISABLE_SCHOOL" : body.isActive === true ? "OWNER_ENABLE_SCHOOL" : "OWNER_UPDATE_SCHOOL";
      void ownerAudit(req.user!.userId, schoolId, action, { changes: body }).catch(() => {});
      res.json({ ok: true, school: updated });
    } catch (error) {
      next(error);
    }
  });

  const schoolDetailsSchema = z.object({
    name: z.string().min(2).max(200).optional(),
    phone: z.string().max(50).nullable().optional(),
    email: z.string().email().nullable().optional(),
    address: z.string().max(500).nullable().optional(),
    logoUrl: z.string().url().nullable().optional(),
    timezone: z.string().min(2).max(80).optional(),
    brandingMode: z.enum(["PLATFORM_DEFAULTS", "SCHOOL_BRANDED"]).optional(),
  });

  router.get("/api/owner/schools/:schoolId/console", requirePlatformOwner, async (req, res, next) => {
    try {
      const { schoolId } = req.params;
      await requireOwnerSchool(schoolId);

      const [school, users, readers, featureFlags, auditLogs, supportSessions, smartPlan, smartLedgerCount] = await Promise.all([
        prisma.school.findUnique({
          where: { id: schoolId },
          select: {
            id: true,
            code: true,
            name: true,
            phone: true,
            email: true,
            address: true,
            logoUrl: true,
            timezone: true,
            brandingMode: true,
            isActive: true,
            createdAt: true,
            subscription: { select: { id: true, planCode: true, status: true, currentPeriodStart: true, currentPeriodEnd: true, studentLimit: true } },
            _count: { select: { students: true, users: true, issuedReports: true, imports: true } },
          },
        }),
        prisma.user.findMany({
          where: { schoolId, isPlatformOwner: false },
          orderBy: [{ role: "asc" }, { name: "asc" }],
          take: 100,
          select: { id: true, name: true, email: true, role: true, isActive: true, mustChangePassword: true, lastLoginAt: true, createdAt: true },
        }),
        prisma.nfcOfflineDevice.findMany({ where: { schoolId }, orderBy: { createdAt: "desc" } }),
        (prisma as any).schoolFeatureFlag.findMany({ where: { schoolId }, orderBy: { feature: "asc" } }),
        prisma.auditLog.findMany({ where: { schoolId }, orderBy: { createdAt: "desc" }, take: 50 }),
        (prisma as any).platformSupportSession.findMany({ where: { schoolId }, orderBy: { createdAt: "desc" }, take: 10 }),
        (prisma as any).schoolSmartPagePlan.findUnique({ where: { schoolId } }).catch(() => null),
        (prisma as any).smartPageLedger.count({ where: { schoolId } }).catch(() => 0),
      ]);

      const flagMap = new Map((featureFlags as Array<{ feature: string; enabled: boolean }>).map((flag) => [flag.feature, flag.enabled]));
      const now = Date.now();
      res.json({
        school: school ? {
          ...school,
          createdAt: school.createdAt.toISOString(),
          subscription: school.subscription ? {
            ...school.subscription,
            currentPeriodStart: school.subscription.currentPeriodStart.toISOString(),
            currentPeriodEnd: school.subscription.currentPeriodEnd.toISOString(),
          } : null,
          studentCount: school._count.students,
          userCount: school._count.users,
          reportCount: school._count.issuedReports,
          importCount: school._count.imports,
          _count: undefined,
        } : null,
        users: users.map((user) => ({
          ...user,
          lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
          createdAt: user.createdAt.toISOString(),
        })),
        admins: users.filter((user) => user.role === "ADMIN_OPERATOR"),
        readers: readers.map(mapReader),
        featureFlags: FEATURE_FLAGS.map((feature) => ({ feature, enabled: flagMap.get(feature) ?? false })),
        auditLogs: auditLogs.map(mapAuditLog),
        supportSessions: (supportSessions as any[]).map((session) => ({
          id: session.id,
          mode: session.mode,
          status: session.status,
          reason: session.reason,
          expiresAt: session.expiresAt.toISOString(),
          endedAt: session.endedAt ? session.endedAt.toISOString() : null,
          createdAt: session.createdAt.toISOString(),
        })),
        sessions: {
          active: [],
          note: "Per-device browser session storage is not configured yet. Terminate Session invalidates all tokens for the selected user.",
        },
        apiKeys: {
          readerTokens: readers.map((reader) => ({
            id: reader.id,
            name: reader.name,
            deviceKey: reader.deviceKey,
            hasToken: Boolean(reader.deviceTokenHash),
            tokenHashPrefix: reader.deviceTokenHash ? `${reader.deviceTokenHash.slice(0, 10)}...` : null,
          })),
          webhookKeys: [],
        },
        health: {
          studentCount: school?._count.students ?? 0,
          userCount: school?._count.users ?? 0,
          issuedReportCount: school?._count.issuedReports ?? 0,
          importCount: school?._count.imports ?? 0,
          storageUsage: null,
          databaseSize: null,
          lastBackup: null,
          ocrUsage: smartLedgerCount,
          gatewayStatus: readers.some((reader) => reader.lastSeenAt && now - reader.lastSeenAt.getTime() < 2 * 60 * 1000) ? "ONLINE" : "OFFLINE",
          smartPagesStatus: smartPlan?.status ?? "NOT_CONFIGURED",
        },
      });
    } catch (error) {
      next(error);
    }
  });

  router.get("/api/owner/readers", requirePlatformOwner, async (req, res, next) => {
    try {
      const search = typeof req.query.search === "string" ? req.query.search.trim().toLowerCase() : "";
      const schoolId = typeof req.query.schoolId === "string" ? req.query.schoolId.trim() : "";
      const statusFilter = typeof req.query.status === "string" ? req.query.status.trim().toUpperCase() : "";
      const otaFilter = typeof req.query.otaStatus === "string" ? req.query.otaStatus.trim().toUpperCase() : "";
      const firmwareVersion = typeof req.query.firmwareVersion === "string" ? req.query.firmwareVersion.trim().toLowerCase() : "";

      const readers = await prisma.nfcOfflineDevice.findMany({
        orderBy: { createdAt: "desc" },
        include: {
          school: { select: { id: true, code: true, name: true } },
        },
      });

      const mapped = readers
        .map(mapReader)
        .filter((reader) => {
          const matchesSchool = !schoolId || reader.schoolId === schoolId;
          const matchesSearch = !search || [
            reader.name,
            reader.deviceKey,
            reader.location,
            reader.locationName,
            reader.school?.name,
            reader.school?.code,
            reader.firmwareVersion,
          ].filter(Boolean).some((value) => String(value).toLowerCase().includes(search));
          const matchesStatus = !statusFilter
            || statusFilter === "ALL"
            || (statusFilter === "ONLINE" ? reader.onlineStatus === "ONLINE" : false)
            || (statusFilter === "OFFLINE" ? reader.onlineStatus === "OFFLINE" : false)
            || (statusFilter === "DISABLED" ? reader.onlineStatus === "DISABLED" : false)
            || (statusFilter === "PENDING_SETUP" ? reader.onlineStatus === "PENDING_SETUP" : false)
            || (statusFilter === "ACTIVATION_EXPIRED" ? reader.onlineStatus === "ACTIVATION_EXPIRED" : false)
            || (statusFilter === "ACTIVATION_FAILED" ? reader.onlineStatus === "ACTIVATION_FAILED" : false)
            || (statusFilter === "ERRORS" ? Boolean(
              (reader.lastScanStatus && reader.lastScanStatus !== "SUCCESS" && reader.lastScanStatus !== "PRESENT")
              || reader.otaStatus === "FAILED",
            ) : false)
            || (statusFilter === "OTA_PENDING" ? Boolean(reader.otaStatus && ["UPDATE_AVAILABLE", "DEFERRED", "PENDING"].includes(String(reader.otaStatus))) : false);
          const matchesOta = !otaFilter
            || otaFilter === "ALL"
            || (otaFilter === "PENDING" ? Boolean(reader.otaStatus && ["UPDATE_AVAILABLE", "DEFERRED", "PENDING"].includes(String(reader.otaStatus))) : false)
            || (otaFilter === "FAILED" ? reader.otaStatus === "FAILED" : false)
            || (otaFilter === "INSTALLED" ? reader.otaStatus === "CONFIRMED" || reader.otaStatus === "INSTALLED" : false)
            || (otaFilter === "NO_UPDATE" ? reader.otaStatus === "NO_UPDATE" : false);
          const matchesFirmware = !firmwareVersion || (reader.firmwareVersion ? reader.firmwareVersion.toLowerCase().includes(firmwareVersion) : false);
          return matchesSchool && matchesSearch && matchesStatus && matchesOta && matchesFirmware;
        });

      res.json({ readers: mapped });
    } catch (error) {
      next(error);
    }
  });

  router.post("/api/owner/readers", requirePlatformOwner, async (req, res, next) => {
    try {
      const body = z.object({
        schoolId: z.string().uuid("Invalid school ID."),
        deviceName: z.string().trim().min(2, "Device name is required.").max(120),
        location: z.string().trim().min(2, "Location is required.").max(120),
        readerType: z.enum(["GATE", "CLASSROOM"]),
      }).parse(req.body);
      const school = await requireOwnerSchool(body.schoolId);
      const activationCode = generateReaderGatewayActivationCode();
      const activationCodeHash = hashReaderGatewayActivationCode(activationCode);
      const expiresAt = new Date(Date.now() + READER_ACTIVATION_WINDOW_MS);
      const device = await prisma.nfcOfflineDevice.create({
        data: {
          schoolId: body.schoolId,
          name: body.deviceName,
          location: body.location,
          locationName: body.location,
          locationType: body.readerType,
          attendanceMode: body.readerType === "GATE" ? "GATE_ATTENDANCE" : "CLASSROOM_ATTENDANCE",
          deviceKey: `pending-${randomUUID()}`,
          mode: "ATTENDANCE",
          roleScope: "ADMIN_OPERATOR",
          status: "ACTIVE",
          isActive: true,
          provisioningStatus: "PENDING_SETUP",
          activationCodeHash,
          activationCodeExpiresAt: expiresAt,
        },
        include: {
          school: { select: { id: true, code: true, name: true } },
        },
      });
      void ownerAudit(req.user!.userId, body.schoolId, "READER_PENDING_SETUP_CREATED", {
        readerId: device.id,
        schoolCode: school.code,
        location: body.location,
        readerType: body.readerType,
        activationExpiresAt: expiresAt.toISOString(),
      }).catch(() => {});
      res.status(201).json({
        reader: mapReader(device),
        activationCode,
        activationExpiresAt: expiresAt.toISOString(),
      });
    } catch (error) {
      next(error);
    }
  });

  router.post("/api/owner/readers/:readerId/regenerate-activation", requirePlatformOwner, async (req, res, next) => {
    try {
      const readerId = z.string().trim().min(1).parse(req.params.readerId);
      const reader = await prisma.nfcOfflineDevice.findFirst({
        where: buildDeviceIdentityWhere(readerId),
        orderBy: RECENT_DEVICE_ORDER_BY,
        include: { school: { select: { id: true, code: true, name: true } } },
      });
      if (!reader) {
        res.status(404).json({ error: "Reader not found." });
        return;
      }
      if (reader.provisioningStatus === "ACTIVE" && reader.deviceTokenHash) {
        res.status(409).json({ error: "Reader is already active." });
        return;
      }
      const activationCode = generateReaderGatewayActivationCode();
      const activationCodeHash = hashReaderGatewayActivationCode(activationCode);
      const expiresAt = new Date(Date.now() + READER_ACTIVATION_WINDOW_MS);
      const updated = await prisma.nfcOfflineDevice.update({
        where: { id: reader.id },
        data: {
          provisioningStatus: "PENDING_SETUP",
          activationCodeHash,
          activationCodeExpiresAt: expiresAt,
          activationCodeUsedAt: null,
          activationBoundHardwareId: null,
          activationFailedAttempts: 0,
          activationLastFailedAt: null,
          activationLastError: null,
          deviceTokenHash: null,
          deviceKey: `pending-${reader.id}`,
          lastHeartbeatAt: null,
          lastSeenAt: null,
          onlineStatus: "OFFLINE",
        },
        include: { school: { select: { id: true, code: true, name: true } } },
      });
      void ownerAudit(req.user!.userId, reader.schoolId, "READER_PENDING_SETUP_REGENERATED", {
        readerId: reader.id,
        activationExpiresAt: expiresAt.toISOString(),
      }).catch(() => {});
      res.json({
        reader: mapReader(updated),
        activationCode,
        activationExpiresAt: expiresAt.toISOString(),
      });
    } catch (error) {
      next(error);
    }
  });

  router.post("/api/owner/readers/:readerId/cancel-setup", requirePlatformOwner, async (req, res, next) => {
    try {
      const readerId = z.string().trim().min(1).parse(req.params.readerId);
      const reader = await prisma.nfcOfflineDevice.findFirst({
        where: buildDeviceIdentityWhere(readerId),
        orderBy: RECENT_DEVICE_ORDER_BY,
      });
      if (!reader) {
        res.status(404).json({ error: "Reader not found." });
        return;
      }
      const updated = await prisma.nfcOfflineDevice.update({
        where: { id: reader.id },
        data: {
          provisioningStatus: "CANCELLED",
          activationCodeHash: null,
          activationCodeExpiresAt: null,
          activationCodeUsedAt: null,
          activationBoundHardwareId: null,
          activationLastError: "Pending setup cancelled by platform owner.",
          deviceTokenHash: null,
          onlineStatus: "OFFLINE",
        },
        include: { school: { select: { id: true, code: true, name: true } } },
      });
      void ownerAudit(req.user!.userId, reader.schoolId, "READER_PENDING_SETUP_CANCELLED", {
        readerId: reader.id,
      }).catch(() => {});
      res.json({ reader: mapReader(updated) });
    } catch (error) {
      next(error);
    }
  });

  router.get("/api/owner/readers/diagnostics/lookup", requirePlatformOwner, async (req, res, next) => {
    try {
      const identifier = z.string().trim().min(1).parse(req.query.deviceId ?? req.query.deviceKey ?? req.query.readerId);
      const reader = await prisma.nfcOfflineDevice.findFirst({
        where: buildDeviceIdentityWhere(identifier),
        orderBy: RECENT_DEVICE_ORDER_BY,
        include: {
          school: { select: { id: true, code: true, name: true, isActive: true } },
        },
      });
      if (!reader) {
        res.status(404).json({ error: "Reader not found." });
        return;
      }

      const [latestRegistration, latestHeartbeat, schoolReaders, inventoryReaders] = await Promise.all([
        prisma.auditLog.findFirst({
          where: {
            schoolId: reader.schoolId,
            action: { in: ["reader_device.registered", "reader_device.re_registered", "reader_device.activated"] },
          },
          orderBy: { createdAt: "desc" },
        }),
        prisma.auditLog.findFirst({
          where: {
            schoolId: reader.schoolId,
            action: "reader_device.heartbeat",
          },
          orderBy: { createdAt: "desc" },
        }),
        prisma.nfcOfflineDevice.findMany({
          where: { schoolId: reader.schoolId },
          orderBy: { createdAt: "desc" },
        }),
        prisma.nfcOfflineDevice.findMany({
          orderBy: { createdAt: "desc" },
          include: {
            school: { select: { id: true, code: true, name: true } },
          },
        }),
      ]);

      const inventoryMatch = inventoryReaders
        .map(mapReader)
        .find((device) => device.id === reader.id || device.deviceKey === reader.deviceKey) ?? null;

      res.json({
        lookup: {
          identifier,
          serverApiBaseUrl: process.env.PUBLIC_APP_URL ?? process.env.APP_URL ?? null,
        },
        resolvedSchool: reader.school ? {
          id: reader.school.id,
          code: reader.school.code,
          name: reader.school.name,
          isActive: reader.school.isActive,
        } : null,
        persistedDevice: {
          id: reader.id,
          deviceKey: reader.deviceKey,
          schoolId: reader.schoolId,
          name: reader.name,
          location: reader.location,
          locationType: reader.locationType,
          locationName: reader.locationName,
          status: reader.status,
          isActive: reader.isActive,
          firmwareVersion: reader.firmwareVersion,
          lastHeartbeatAt: reader.lastHeartbeatAt?.toISOString() ?? null,
          lastSeenAt: reader.lastSeenAt?.toISOString() ?? null,
          onlineStatus: reader.onlineStatus,
          assignmentStatus: reader.schoolId ? "ASSIGNED" : "UNASSIGNED",
        },
        latestRegistration: summarizeReaderAuditLog(latestRegistration),
        latestHeartbeat: summarizeReaderAuditLog(latestHeartbeat),
        uiQueryResult: inventoryMatch,
        schoolQueryResult: {
          schoolId: reader.schoolId,
          visible: schoolReaders.some((device) => device.id === reader.id),
          totalReaders: schoolReaders.length,
        },
      });
    } catch (error) {
      next(error);
    }
  });

  router.get("/api/owner/readers/:readerId", requirePlatformOwner, async (req, res, next) => {
    try {
      const readerId = z.string().trim().min(1).parse(req.params.readerId);
      const reader = await prisma.nfcOfflineDevice.findFirst({
        where: buildDeviceIdentityWhere(readerId),
        orderBy: RECENT_DEVICE_ORDER_BY,
        include: {
          school: { select: { id: true, code: true, name: true } },
        },
      });
      if (!reader) {
        res.status(404).json({ error: "Reader not found." });
        return;
      }

      const auditLogs = await prisma.auditLog.findMany({
        where: {
          schoolId: reader.schoolId,
          action: { in: [...READER_AUDIT_ACTIONS] },
        },
        orderBy: { createdAt: "desc" },
        take: 200,
      });

      const readerLogs = auditLogs.filter((log) => readerEventMatchesDevice(log.details, reader));
      const recentScans = readerLogs.filter((log) => log.action === "reader_event.attendance").slice(0, 12);
      const recentErrors = readerLogs.filter((log) => {
        if (log.action === "reader_device.ota_status") {
          const details = log.details as Record<string, unknown> | null;
          return details?.status === "FAILED";
        }
        if (log.action === "reader_event.attendance") {
          const response = (log.details as Record<string, unknown> | null)?.response as { success?: unknown } | undefined;
          return response?.success === false;
        }
        return false;
      }).slice(0, 12);
      const otaHistory = readerLogs.filter((log) => log.action === "reader_device.ota_status").slice(0, 12);
      const heartbeats = readerLogs.filter((log) => log.action === "reader_device.heartbeat").slice(0, 12);

      res.json({
        reader: mapReader(reader),
        diagnostics: {
          health: {
            status: mapReader(reader).onlineStatus,
            heartbeatAgeMinutes: reader.lastHeartbeatAt ? Math.max(0, Math.round((Date.now() - reader.lastHeartbeatAt.getTime()) / 60_000)) : null,
            queueDepth: reader.queueDepth ?? 0,
            firmwareVersion: reader.firmwareVersion ?? null,
            wifiRssi: reader.lastRssi ?? null,
            freeHeap: reader.freeHeap ?? null,
            uptimeMs: reader.uptimeMs ?? null,
            rebootReason: reader.rebootReason ?? null,
            otaStatus: reader.otaStatus ?? null,
          },
          recentScans: recentScans.map(mapAuditLog),
          recentErrors: recentErrors.map(mapAuditLog),
          otaHistory: otaHistory.map(mapAuditLog),
          heartbeats: heartbeats.map(mapAuditLog),
        },
      });
    } catch (error) {
      next(error);
    }
  });

  router.patch("/api/owner/schools/:schoolId/details", requirePlatformOwner, async (req, res, next) => {
    try {
      const { schoolId } = req.params;
      await requireOwnerSchool(schoolId);
      const body = schoolDetailsSchema.parse(req.body);
      const school = await prisma.school.update({
        where: { id: schoolId },
        data: body,
        select: { id: true, code: true, name: true, phone: true, email: true, address: true, logoUrl: true, timezone: true, brandingMode: true, isActive: true },
      });
      void ownerAudit(req.user!.userId, schoolId, "SCHOOL_DETAILS_UPDATED_BY_OWNER", { changes: body }).catch(() => {});
      res.json({ ok: true, school });
    } catch (error) {
      next(error);
    }
  });

  router.get("/api/owner/schools/:schoolId/audit-log", requirePlatformOwner, async (req, res, next) => {
    try {
      const { schoolId } = req.params;
      await requireOwnerSchool(schoolId);
      const event = typeof req.query.event === "string" ? req.query.event.trim() : "";
      const userId = typeof req.query.userId === "string" ? req.query.userId.trim() : "";
      const from = typeof req.query.from === "string" ? new Date(req.query.from) : null;
      const to = typeof req.query.to === "string" ? new Date(req.query.to) : null;
      const logs = await prisma.auditLog.findMany({
        where: {
          schoolId,
          ...(event ? { action: { contains: event, mode: "insensitive" } } : {}),
          ...(from && !Number.isNaN(from.getTime()) || to && !Number.isNaN(to.getTime()) ? {
            createdAt: {
              ...(from && !Number.isNaN(from.getTime()) ? { gte: from } : {}),
              ...(to && !Number.isNaN(to.getTime()) ? { lte: to } : {}),
            },
          } : {}),
        },
        orderBy: { createdAt: "desc" },
        take: 200,
      });
      const filtered = userId
        ? logs.filter((log) => JSON.stringify(log.details ?? {}).includes(userId))
        : logs;
      res.json({ auditLogs: filtered.map(mapAuditLog) });
    } catch (error) {
      next(error);
    }
  });

  router.patch("/api/owner/schools/:schoolId/feature-flags", requirePlatformOwner, async (req, res, next) => {
    try {
      const { schoolId } = req.params;
      await requireOwnerSchool(schoolId);
      const body = z.object({
        flags: z.array(z.object({ feature: z.enum(FEATURE_FLAGS), enabled: z.boolean() })).min(1),
      }).parse(req.body);
      await prisma.$transaction(body.flags.map((flag) => (prisma as any).schoolFeatureFlag.upsert({
        where: { schoolId_feature: { schoolId, feature: flag.feature } },
        update: { enabled: flag.enabled, updatedByUserId: req.user!.userId },
        create: { schoolId, feature: flag.feature, enabled: flag.enabled, updatedByUserId: req.user!.userId },
      })));
      void ownerAudit(req.user!.userId, schoolId, "FEATURE_FLAGS_UPDATED_BY_OWNER", { flags: body.flags }).catch(() => {});
      res.json({ ok: true, featureFlags: body.flags });
    } catch (error) {
      next(error);
    }
  });

  router.patch("/api/owner/schools/:schoolId/subscription", requirePlatformOwner, async (req, res, next) => {
    try {
      const { schoolId } = req.params;
      await requireOwnerSchool(schoolId);
      const body = z.object({
        action: z.enum(["EXTEND", "CANCEL", "PAUSE", "CHANGE_PLAN"]),
        planCode: z.enum(validPlanCodes as [string, ...string[]]).optional(),
        extendDays: z.coerce.number().int().min(1).max(730).optional(),
        studentLimit: z.coerce.number().int().min(0).nullable().optional(),
        reason: z.string().trim().min(5, "Reason is required for subscription changes.").max(1000),
      }).parse(req.body);
      const requestId = requestIdFrom(req);
      const current = await prisma.reportLabSubscription.findUnique({ where: { schoolId } });
      if (!current) {
        res.status(404).json({ error: "Subscription not found." });
        return;
      }
      const data: Record<string, unknown> = {};
      if (body.action === "EXTEND") {
        const base = current.currentPeriodEnd > new Date() ? current.currentPeriodEnd : new Date();
        data.currentPeriodEnd = new Date(base.getTime() + (body.extendDays ?? 30) * 24 * 60 * 60 * 1000);
        data.status = "ACTIVE";
      }
      if (body.action === "CANCEL" || body.action === "PAUSE") data.status = "SUSPENDED";
      if (body.action === "CHANGE_PLAN") {
        if (!body.planCode) {
          res.status(400).json({ error: "Plan code is required to change plan." });
          return;
        }
        data.planCode = body.planCode;
      }
      if (body.studentLimit !== undefined) data.studentLimit = body.studentLimit;
      const subscription = await prisma.$transaction(async (tx) => {
        const updated = await tx.reportLabSubscription.update({ where: { schoolId }, data });
        await tx.auditLog.create({
          data: {
            schoolId,
            action: "SUBSCRIPTION_CHANGED_BY_OWNER",
            correlationId: requestId,
            details: {
              actorUserId: req.user!.userId,
              tenant: schoolId,
              target: current.id,
              requestId,
              reason: body.reason,
              subscriptionAction: body.action,
              changes: data,
            },
          },
        });
        return updated;
      });
      res.json({
        ok: true,
        subscription: {
          ...subscription,
          currentPeriodStart: subscription.currentPeriodStart.toISOString(),
          currentPeriodEnd: subscription.currentPeriodEnd.toISOString(),
        },
      });
    } catch (error) {
      next(error);
    }
  });

  router.post("/api/owner/schools/:schoolId/support-sessions", requirePlatformOwner, async (req, res, next) => {
    try {
      const { schoolId } = req.params;
      await requireOwnerSchool(schoolId);
      const body = z.object({
        mode: z.enum(["READ_ONLY", "WRITE"]).default("READ_ONLY"),
        reason: z.string().min(3).max(500),
        durationMinutes: z.coerce.number().int().min(5).max(240).default(30),
        writeConfirmed: z.boolean().optional(),
      }).parse(req.body);
      if (body.mode === "WRITE" && !body.writeConfirmed) {
        res.status(400).json({ error: "Write-mode support sessions require explicit confirmation." });
        return;
      }
      const expiresAt = new Date(Date.now() + body.durationMinutes * 60 * 1000);
      const session = await (prisma as any).platformSupportSession.create({
        data: { schoolId, ownerUserId: req.user!.userId, mode: body.mode, reason: body.reason, expiresAt },
      });
      void ownerAudit(req.user!.userId, schoolId, "SUPPORT_SESSION_STARTED", {
        supportSessionId: session.id,
        mode: body.mode,
        expiresAt: expiresAt.toISOString(),
      }).catch(() => {});
      res.status(201).json({
        ok: true,
        supportSession: {
          id: session.id,
          mode: session.mode,
          status: session.status,
          reason: session.reason,
          expiresAt: session.expiresAt.toISOString(),
          banner: "Support Session - Platform Owner",
          readOnly: session.mode === "READ_ONLY",
        },
      });
    } catch (error) {
      next(error);
    }
  });

  router.post("/api/owner/support-sessions/:sessionId/end", requirePlatformOwner, async (req, res, next) => {
    try {
      const { sessionId } = req.params;
      const session = await (prisma as any).platformSupportSession.findUnique({ where: { id: sessionId } });
      if (!session) {
        res.status(404).json({ error: "Support session not found." });
        return;
      }
      const ended = await (prisma as any).platformSupportSession.update({
        where: { id: sessionId },
        data: { status: "ENDED", endedAt: new Date() },
      });
      void ownerAudit(req.user!.userId, session.schoolId, "SUPPORT_SESSION_ENDED", { supportSessionId: sessionId }).catch(() => {});
      res.json({ ok: true, supportSession: { id: ended.id, status: ended.status, endedAt: ended.endedAt.toISOString() } });
    } catch (error) {
      next(error);
    }
  });

  router.post("/api/owner/schools/:schoolId/maintenance", requirePlatformOwner, async (req, res, next) => {
    try {
      const { schoolId } = req.params;
      await requireOwnerSchool(schoolId);
      const body = z.object({ action: z.enum(MAINTENANCE_ACTIONS), reason: z.string().max(500).optional() }).parse(req.body);
      void ownerAudit(req.user!.userId, schoolId, `MAINTENANCE_${body.action}_REQUESTED_BY_OWNER`, { reason: body.reason ?? null }).catch(() => {});
      res.json({ ok: true, action: body.action, queued: false, message: "Maintenance request audited. Worker execution is not configured yet." });
    } catch (error) {
      next(error);
    }
  });

  router.post("/api/owner/schools/:schoolId/readers/:deviceId/actions", requirePlatformOwner, async (req, res, next) => {
    try {
      const { schoolId, deviceId } = req.params;
      await requireOwnerSchool(schoolId);
      const body = z.object({ action: z.enum(READER_ACTIONS), firmwareVersion: z.string().max(50).optional() }).parse(req.body);
      const reader = await prisma.nfcOfflineDevice.findFirst({ where: { schoolId, ...buildDeviceIdentityWhere(deviceId) }, orderBy: RECENT_DEVICE_ORDER_BY });
      if (!reader) {
        res.status(404).json({ error: "Reader not found." });
        return;
      }
      if (body.action === "RE_REGISTER") {
        await prisma.nfcOfflineDevice.update({ where: { id: reader.id }, data: { status: "ACTIVE", isActive: true } });
      }
      void ownerAudit(req.user!.userId, schoolId, `READER_${body.action}_REQUESTED_BY_OWNER`, {
        readerId: reader.id,
        deviceKey: reader.deviceKey,
        firmwareVersion: body.firmwareVersion ?? null,
      }).catch(() => {});
      res.json({ ok: true, action: body.action, delivered: false, message: "Reader command was audited. Live device command transport is not configured yet." });
    } catch (error) {
      next(error);
    }
  });

  router.post("/api/owner/schools/:schoolId/readers/:deviceId/rotate-token", requirePlatformOwner, async (req, res, next) => {
    try {
      const { schoolId, deviceId } = req.params;
      await requireOwnerSchool(schoolId);
      const reader = await prisma.nfcOfflineDevice.findFirst({ where: { schoolId, ...buildDeviceIdentityWhere(deviceId) }, orderBy: RECENT_DEVICE_ORDER_BY });
      if (!reader) {
        res.status(404).json({ error: "Reader not found." });
        return;
      }
      const oneTimeToken = generateDeviceToken();
      await prisma.nfcOfflineDevice.update({ where: { id: reader.id }, data: { deviceTokenHash: hashToken(oneTimeToken), status: "ACTIVE", isActive: true } });
      void ownerAudit(req.user!.userId, schoolId, "READER_TOKEN_ROTATED_BY_OWNER", { readerId: reader.id, deviceKey: reader.deviceKey }).catch(() => {});
      res.json({ ok: true, readerId: reader.id, deviceKey: reader.deviceKey, oneTimeToken });
    } catch (error) {
      next(error);
    }
  });

  router.post("/api/owner/users/:userId/terminate-sessions", requirePlatformOwner, async (req, res, next) => {
    try {
      const { userId } = req.params;
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user || user.isPlatformOwner) {
        res.status(404).json({ error: "User not found." });
        return;
      }
      await prisma.user.update({ where: { id: userId }, data: { tokenVersion: { increment: 1 } } });
      void ownerAudit(req.user!.userId, user.schoolId, "SESSION_TERMINATED_BY_OWNER", { targetUserId: userId, scope: "ALL_TOKENS" }).catch(() => {});
      res.json({ ok: true, terminated: "ALL_TOKENS" });
    } catch (error) {
      next(error);
    }
  });

  router.post("/api/owner/users/:userId/reset-mfa", requirePlatformOwner, async (req, res, next) => {
    try {
      const { userId } = req.params;
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user || user.isPlatformOwner) {
        res.status(404).json({ error: "User not found." });
        return;
      }
      void ownerAudit(req.user!.userId, user.schoolId, "MFA_RESET_BY_OWNER", { targetUserId: userId, configured: false }).catch(() => {});
      res.json({ ok: true, reset: false, message: "MFA is not configured for this account model yet." });
    } catch (error) {
      next(error);
    }
  });

  router.post("/api/owner/schools/:schoolId/admins", requirePlatformOwner, async (req, res, next) => {
    try {
      const { schoolId } = req.params;
      await requireOwnerSchool(schoolId);
      const body = z.object({
        userId: z.string().uuid().optional(),
        name: z.string().min(2).optional(),
        email: z.string().email().optional(),
        temporaryPassword: z.string().min(8).optional(),
      }).parse(req.body);
      if (body.userId) {
        const user = await prisma.user.findFirst({ where: { id: body.userId, schoolId, isPlatformOwner: false } });
        if (!user) {
          res.status(404).json({ error: "User not found in this school." });
          return;
        }
        const updated = await prisma.user.update({ where: { id: user.id }, data: { role: "ADMIN_OPERATOR", isActive: true, tokenVersion: { increment: 1 } } });
        void ownerAudit(req.user!.userId, schoolId, "SCHOOL_ADMIN_ADDED_BY_OWNER", { targetUserId: user.id, existingUser: true }).catch(() => {});
        res.json({ ok: true, user: { id: updated.id, name: updated.name, email: updated.email, role: updated.role, isActive: updated.isActive } });
        return;
      }
      if (!body.name || !body.email || !body.temporaryPassword) {
        res.status(400).json({ error: "Name, email, and temporary password are required when creating an admin." });
        return;
      }
      const existing = await prisma.user.findFirst({ where: { schoolId, email: body.email.toLowerCase() } });
      if (existing) {
        res.status(409).json({ error: "A user with this email already exists in this school." });
        return;
      }
      const created = await prisma.user.create({
        data: {
          schoolId,
          name: body.name,
          email: body.email.toLowerCase(),
          role: "ADMIN_OPERATOR",
          passwordHash: await hashPassword(body.temporaryPassword),
          mustChangePassword: true,
          isActive: true,
        },
        select: { id: true, name: true, email: true, role: true, isActive: true, mustChangePassword: true },
      });
      void ownerAudit(req.user!.userId, schoolId, "SCHOOL_ADMIN_ADDED_BY_OWNER", { targetUserId: created.id, existingUser: false }).catch(() => {});
      res.status(201).json({ ok: true, user: created });
    } catch (error) {
      next(error);
    }
  });

  router.delete("/api/owner/schools/:schoolId/admins/:userId", requirePlatformOwner, async (req, res, next) => {
    try {
      const { schoolId, userId } = req.params;
      await requireOwnerSchool(schoolId);
      const user = await prisma.user.findFirst({ where: { id: userId, schoolId, isPlatformOwner: false } });
      if (!user) {
        res.status(404).json({ error: "User not found in this school." });
        return;
      }
      const activeAdmins = await prisma.user.count({ where: { schoolId, role: "ADMIN_OPERATOR", isActive: true, isPlatformOwner: false, NOT: { id: userId } } });
      if (activeAdmins === 0) {
        res.status(409).json({ error: "Cannot remove the last active school administrator." });
        return;
      }
      await prisma.user.update({ where: { id: userId }, data: { isActive: false, tokenVersion: { increment: 1 } } });
      void ownerAudit(req.user!.userId, schoolId, "SCHOOL_ADMIN_REMOVED_BY_OWNER", { targetUserId: userId }).catch(() => {});
      res.json({ ok: true });
    } catch (error) {
      next(error);
    }
  });

  router.post("/api/owner/schools/:schoolId/admins/:userId/transfer-headteacher", requirePlatformOwner, async (req, res, next) => {
    try {
      const { schoolId, userId } = req.params;
      await requireOwnerSchool(schoolId);
      const user = await prisma.user.findFirst({ where: { id: userId, schoolId, isPlatformOwner: false } });
      if (!user) {
        res.status(404).json({ error: "User not found in this school." });
        return;
      }
      const updated = await prisma.user.update({ where: { id: userId }, data: { role: "ADMIN_OPERATOR", isActive: true, tokenVersion: { increment: 1 } } });
      void ownerAudit(req.user!.userId, schoolId, "HEADTEACHER_OWNERSHIP_TRANSFERRED_BY_OWNER", { targetUserId: userId }).catch(() => {});
      res.json({ ok: true, user: { id: updated.id, name: updated.name, email: updated.email, role: updated.role, isActive: updated.isActive } });
    } catch (error) {
      next(error);
    }
  });

  // ── Smart Pages payments ───────────────────────────────────────────────────

  router.get("/api/owner/smart-pages/payments", requirePlatformOwner, async (req, res, next) => {
    try {
      const status = typeof req.query.status === "string" ? req.query.status : "PENDING";
      const payments = await (prisma as any).smartPagePaymentRequest.findMany({
        where: status === "ALL" ? {} : { status },
        orderBy: { createdAt: "desc" },
        take: 100,
        include: { school: { select: { id: true, code: true, name: true } } },
      });
      res.json({ payments: payments.map(smartPagesPaymentToDto) });
    } catch (error) {
      next(error);
    }
  });

  router.get("/api/owner/smart-pages/usage", requirePlatformOwner, async (_req, res, next) => {
    try {
      const rows = await (prisma as any).smartPageLedger.findMany({
        orderBy: { createdAt: "desc" },
        take: 100,
      });
      const schoolIds = [...new Set(rows.map((row: any) => row.schoolId as string))];
      const schools = await prisma.school.findMany({
        where: { id: { in: schoolIds } },
        select: { id: true, name: true, code: true },
      });
      const schoolMap = new Map(schools.map((school) => [school.id, school]));
      res.json({
        ledger: rows.map((row: any) => {
          const school = schoolMap.get(row.schoolId as string);
          return {
            id: row.id,
            schoolId: row.schoolId,
            schoolName: school ? `${school.name} (${school.code})` : undefined,
            operation: row.operation ?? row.action,
            pagesProcessed: row.pagesProcessed ?? row.pagesCharged,
            creditsUsed: row.creditsCharged ?? row.pagesCharged,
            creditsRemainingAfter: null,
            priceUgx: row.priceUgx ?? 0,
            status: row.status,
            createdAt: (row.createdAt as Date).toISOString(),
            provider: row.provider ?? "",
            model: row.model ?? "",
            tokenUsage: row.tokenUsage ?? null,
            geminiCostEstimateUgx: row.geminiCostEstimateUgx ?? null,
            marginEstimateUgx: row.marginEstimateUgx ?? null,
          };
        }),
      });
    } catch (error) {
      next(error);
    }
  });

  const paymentDecisionSchema = z.object({
    reason: z.string().trim().min(5, "Reason is required for payment decisions.").max(1000),
    notes: z.string().max(1000).optional(),
  });

  router.post("/api/owner/smart-pages/payments/:paymentId/confirm", requirePlatformOwner, async (req, res, next) => {
    try {
      const { paymentId } = req.params;
      const body = paymentDecisionSchema.parse(req.body);
      const requestId = requestIdFrom(req);
      const payment = await (prisma as any).smartPagePaymentRequest.findUnique({
        where: { id: paymentId },
        include: { school: { select: { id: true, code: true, name: true } } },
      });
      if (!payment) {
        res.status(404).json({ error: "Payment request not found." });
        return;
      }
      if (payment.status === "CONFIRMED") {
        res.json({ payment: smartPagesPaymentToDto(payment), idempotent: true });
        return;
      }
      if (payment.status !== "PENDING") {
        res.status(409).json({ error: "Only pending payments can be confirmed." });
        return;
      }
      if (!payment.transactionId) {
        res.status(400).json({ error: "Transaction ID is required before confirmation." });
        return;
      }

      const pkg = getSmartPagesPackage(payment.packageCode as SmartPagesPackageCode);
      if (!pkg || pkg.priceUgx !== payment.amountUgx || pkg.credits !== payment.credits) {
        res.status(400).json({ error: "Payment package no longer matches Smart Pages pricing." });
        return;
      }

      const now = new Date();
      const cycleEnd = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate());
      const db = prisma as any;
      const result = await db.$transaction(async (tx: any) => {
        const claimed = await tx.smartPagePaymentRequest.updateMany({
          where: { id: payment.id, status: "PENDING" },
          data: {
            status: "CONFIRMED",
            adminNotes: body.notes ?? null,
            confirmedByUserId: req.user!.userId,
            confirmedAt: now,
          },
        });

        if (claimed.count === 0) {
          const existing = await tx.smartPagePaymentRequest.findUnique({
            where: { id: payment.id },
            include: { school: { select: { id: true, code: true, name: true } } },
          });
          if (existing?.status === "CONFIRMED") return { payment: existing, idempotent: true };
          throw Object.assign(new Error("Only pending payments can be confirmed."), { status: 409 });
        }

        const confirmed = await tx.smartPagePaymentRequest.findUnique({
          where: { id: payment.id },
          include: { school: { select: { id: true, code: true, name: true } } },
        });
        if (!confirmed) {
          throw Object.assign(new Error("Payment request not found."), { status: 404 });
        }

        await tx.schoolSmartPagePlan.upsert({
          where: { schoolId: payment.schoolId },
          update: {
            topUpPages: { increment: payment.credits },
            status: "ACTIVE",
          },
          create: {
            schoolId: payment.schoolId,
            planName: payment.packageCode,
            includedPages: payment.credits,
            billingCycle: "ACADEMIC_YEAR",
            cycleStart: now,
            cycleEnd,
            usedPages: 0,
            topUpPages: 0,
            rolloverPages: 0,
            status: "ACTIVE",
            allowHighAccuracy: payment.packageCode === "SCHOOL_PRO",
          },
        });

        await tx.smartPageLedger.create({
          data: {
            id: randomUUID(),
            schoolId: payment.schoolId,
            jobId: payment.id,
            fileHash: payment.paymentReference,
            pagesCharged: 0,
            creditsCharged: payment.credits,
            operation: "TOP_UP",
            pagesProcessed: 0,
            priceUgx: payment.amountUgx,
            action: "TOP_UP",
            reason: `Confirmed ${payment.packageName} payment`,
            provider: payment.network,
            model: "",
            extractionMode: "balanced",
            status: "CHARGED",
            tokenUsage: null,
            geminiCostEstimateUgx: 0,
            marginEstimateUgx: payment.amountUgx,
          },
        });

        await tx.auditLog.create({
          data: {
            schoolId: payment.schoolId,
            action: "SMART_PAGES_PAYMENT_CONFIRMED",
            correlationId: payment.id,
            details: {
              actorUserId: req.user!.userId,
              network: payment.network,
              merchantCode: payment.merchantCode,
              transactionId: payment.transactionId,
              packageCode: payment.packageCode,
              credits: payment.credits,
              amountUgx: payment.amountUgx,
              reason: body.reason,
              requestId,
              target: payment.id,
            },
          },
        });
        return { payment: confirmed, idempotent: false };
      });

      res.json({ payment: smartPagesPaymentToDto(result.payment), idempotent: result.idempotent });
    } catch (error) {
      next(error);
    }
  });

  router.post("/api/owner/smart-pages/payments/:paymentId/reject", requirePlatformOwner, async (req, res, next) => {
    try {
      const { paymentId } = req.params;
      const body = paymentDecisionSchema.parse(req.body);
      const requestId = requestIdFrom(req);
      const payment = await (prisma as any).smartPagePaymentRequest.findUnique({
        where: { id: paymentId },
        include: { school: { select: { id: true, code: true, name: true } } },
      });
      if (!payment) {
        res.status(404).json({ error: "Payment request not found." });
        return;
      }
      if (payment.status !== "PENDING") {
        res.status(409).json({ error: "Only pending payments can be rejected." });
        return;
      }
      const updated = await (prisma as any).$transaction(async (tx: any) => {
        const rejected = await tx.smartPagePaymentRequest.update({
          where: { id: payment.id },
          data: { status: "REJECTED", adminNotes: body.notes ?? null, rejectedAt: new Date(), rejectedByUserId: req.user!.userId },
          include: { school: { select: { id: true, code: true, name: true } } },
        });
        await tx.auditLog.create({
          data: {
            schoolId: payment.schoolId,
            action: "SMART_PAGES_PAYMENT_REJECTED",
            correlationId: requestId,
            details: {
              actorUserId: req.user!.userId,
              tenant: payment.schoolId,
              target: payment.id,
              requestId,
              reason: body.reason,
              network: payment.network,
              transactionId: payment.transactionId,
              notes: body.notes ?? null,
            },
          },
        });
        return rejected;
      });
      res.json({ payment: smartPagesPaymentToDto(updated) });
    } catch (error) {
      next(error);
    }
  });

  // ── Telegram connectivity test ────────────────────────────────────────────────

  router.post("/api/owner/test-telegram", requirePlatformOwner, async (req, res, next) => {
    try {
      const { sendTelegramMessage } = await import("../services/telegramService");
      const result = await sendTelegramMessage(
        `[School Connect] Telegram test from Smart Pages billing — ENV: ${process.env.NODE_ENV ?? "unknown"}`,
      );
      if (result.ok) {
        res.json({ ok: true });
      } else {
        res.json({ ok: false, error: result.error });
      }
    } catch (error) {
      next(error);
    }
  });

  return router;
}

