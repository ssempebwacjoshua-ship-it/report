import { createHash } from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import { AttendanceDirection, AttendanceScanSource, AttendanceScanStatus, CredentialStatus, CredentialType } from "@prisma/client";
import { prisma } from "../db/prisma";

type ReaderGatewayDevice = {
  id: string;
  schoolId: string;
  deviceKey: string;
  name: string;
  location: string | null;
  mode: string;
  roleScope: string;
  isActive: boolean;
  status: string;
};

type ReaderGatewayResponse = {
  success: boolean;
  action: "REGISTER" | "ATTENDANCE";
  status?: "REGISTERED" | "PRESENT" | "DUPLICATE" | "UNKNOWN_CREDENTIAL" | "BLOCKED";
  message: string;
  beep: "success" | "duplicate" | "warning" | "error" | "none";
  studentName?: string;
  feedback: { beep: "success" | "duplicate" | "warning" | "error" | "none" };
};

const readerIdentitySchema = z.object({
  deviceId: z.string().trim().min(1, "Device ID is required."),
  readerId: z.string().trim().min(1, "Reader ID is required."),
  schoolId: z.string().trim().min(1, "School ID is required."),
});

const registerSchema = readerIdentitySchema.extend({
  firmwareVersion: z.string().trim().optional(),
  deviceTime: z.string().trim().optional(),
});

const eventSchema = readerIdentitySchema.extend({
  eventId: z.string().trim().min(1, "Event ID is required."),
  credential: z.string().trim().optional(),
  credentialUID: z.string().trim().optional(),
  format: z.string().trim().optional(),
  deviceTime: z.string().trim().optional(),
  firmwareVersion: z.string().trim().optional(),
  retryCount: z.coerce.number().int().min(0).optional().default(0),
  syncStatus: z.string().trim().optional(),
});

const heartbeatSchema = readerIdentitySchema.extend({
  firmwareVersion: z.string().trim().optional(),
  wifiRssi: z.coerce.number().int().optional(),
  localIp: z.string().trim().optional(),
  uptimeMs: z.coerce.number().int().min(0).optional(),
  freeHeap: z.coerce.number().int().min(0).optional(),
  queueDepth: z.coerce.number().int().min(0).optional(),
  lastSuccessfulApiContactAt: z.string().trim().optional().nullable(),
});

function bearerToken(req: Express.Request) {
  const authHeader = req.headers.authorization?.trim();
  return authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function cachedResponse(details: unknown): ReaderGatewayResponse | null {
  if (!details || typeof details !== "object") return null;
  const payload = details as { response?: unknown };
  if (!payload.response || typeof payload.response !== "object") return null;
  const response = payload.response as Partial<ReaderGatewayResponse>;
  if (typeof response.success !== "boolean") return null;
  if (response.action !== "REGISTER" && response.action !== "ATTENDANCE") return null;
  if (typeof response.message !== "string" || typeof response.beep !== "string") return null;
  return {
    success: response.success,
    action: response.action,
    status: response.status,
    message: response.message,
    beep: response.beep as ReaderGatewayResponse["beep"],
    studentName: typeof response.studentName === "string" ? response.studentName : undefined,
    feedback: {
      beep: (response.feedback?.beep as ReaderGatewayResponse["beep"]) ?? (response.beep as ReaderGatewayResponse["beep"]),
    },
  };
}

async function authenticateDevice(req: Express.Request, body: { deviceId: string; readerId: string; schoolId: string }) {
  const token = bearerToken(req);
  if (!token) {
    throw Object.assign(new Error("Device bearer token required."), { status: 401 });
  }

  const device = await prisma.nfcOfflineDevice.findFirst({
    where: { deviceTokenHash: hashToken(token) },
    select: {
      id: true,
      schoolId: true,
      deviceKey: true,
      name: true,
      mode: true,
      roleScope: true,
      location: true,
      isActive: true,
      status: true,
    },
  }) as ReaderGatewayDevice | null;

  if (!device) {
    throw Object.assign(new Error("Invalid or revoked device token."), { status: 401 });
  }

  if (!device.isActive || device.status !== "ACTIVE") {
    throw Object.assign(new Error("Reader is disabled."), { status: 403 });
  }

  if (body.schoolId !== device.schoolId) {
    throw Object.assign(new Error("Reader belongs to a different school."), { status: 403 });
  }

  if (![device.deviceKey, device.id].includes(body.deviceId) || ![device.deviceKey, device.id].includes(body.readerId)) {
    throw Object.assign(new Error("Reader identity does not match the configured device."), { status: 403 });
  }

  return device;
}

function parseDeviceTime(value: string | undefined) {
  if (!value) return new Date();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

function parseOptionalDate(value: string | null | undefined) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function dayRange(date: Date) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

async function resolveAttendanceCredential(schoolId: string, credentialValue: string) {
  const credential = await prisma.studentCredential.findFirst({
    where: {
      schoolId,
      type: CredentialType.NFC_WRISTBAND,
      OR: [{ scanToken: credentialValue }, { credentialUID: credentialValue }],
    },
    include: {
      student: {
        select: { id: true, firstName: true, lastName: true, isActive: true },
      },
    },
  });

  if (credential) {
    return {
      studentId: credential.studentId,
      credentialId: credential.id,
      studentName: `${credential.student.firstName} ${credential.student.lastName}`.trim(),
      blockedReason: credential.status !== CredentialStatus.ACTIVE
        ? "Wristband is disabled"
        : !credential.student.isActive
          ? "Student is inactive"
          : null,
    };
  }

  const tag = await prisma.nfcTag.findFirst({
    where: {
      schoolId,
      OR: [
        { publicCode: credentialValue },
        { physicalUid: { equals: credentialValue, mode: "insensitive" } },
      ],
    },
    include: {
      student: {
        select: { id: true, firstName: true, lastName: true, isActive: true },
      },
    },
  });

  if (!tag?.studentId || !tag.student) return null;

  return {
    studentId: tag.studentId,
    credentialId: null,
    studentName: `${tag.student.firstName} ${tag.student.lastName}`.trim(),
    blockedReason: tag.status === "DISABLED" || tag.status === "LOST"
      ? "Wristband is disabled"
      : !tag.student.isActive
        ? "Student is inactive"
        : null,
  };
}

async function recordLastScan(device: ReaderGatewayDevice, status: string, message: string, scannedAt: Date) {
  await prisma.nfcOfflineDevice.update({
    where: { id: device.id },
    data: {
      lastSeenAt: new Date(),
      lastScanAt: scannedAt,
      lastScanStatus: status,
      lastScanMessage: message,
      onlineStatus: "ONLINE",
    },
  }).catch(() => null);
}

export function readerGatewayRoutes() {
  const router = Router();

  router.post("/api/readers/register", async (req, res, next) => {
    try {
      const body = registerSchema.parse(req.body);
      const device = await authenticateDevice(req, body);
      const now = new Date();

      await prisma.$transaction(async (tx) => {
        await tx.nfcOfflineDevice.update({
          where: { id: device.id },
          data: { lastSeenAt: now },
        });
        await tx.auditLog.create({
          data: {
            schoolId: device.schoolId,
            action: "reader_device.registered",
            correlationId: device.deviceKey,
            details: {
              deviceId: body.deviceId,
              readerId: body.readerId,
              firmwareVersion: body.firmwareVersion ?? null,
              deviceTime: body.deviceTime ?? null,
            },
          },
        });
      });

      const response: ReaderGatewayResponse = {
        success: true,
        action: "REGISTER",
        status: "REGISTERED",
        message: "Reader registered",
        beep: "success",
        feedback: { beep: "success" },
      };
      res.json(response);
    } catch (error) {
      next(error);
    }
  });

  router.post("/api/readers/events", async (req, res, next) => {
    try {
      const body = eventSchema.parse(req.body);
      const device = await authenticateDevice(req, body);
      if (device.mode !== "ATTENDANCE") {
        res.status(409).json({
          success: false,
          action: "ATTENDANCE",
          message: "Reader is not configured for attendance events.",
          beep: "error",
          feedback: { beep: "error" },
        });
        return;
      }

      const eventToken = body.eventId;
      const existing = await prisma.auditLog.findFirst({
        where: {
          schoolId: device.schoolId,
          action: "reader_event.attendance",
          correlationId: eventToken,
        },
        orderBy: { createdAt: "desc" },
      });
      const replay = cachedResponse(existing?.details);
      if (replay) {
        await prisma.nfcOfflineDevice.update({
          where: { id: device.id },
          data: { lastSeenAt: new Date() },
        }).catch(() => null);
        res.json(replay);
        return;
      }

      const tokenOrUid = body.credentialUID ?? body.credential;
      if (!tokenOrUid) {
        res.status(400).json({
          success: false,
          action: "ATTENDANCE",
          message: "Credential UID is required.",
          beep: "error",
          feedback: { beep: "error" },
        });
        return;
      }

      const scannedAt = parseDeviceTime(body.deviceTime);
      const credential = await resolveAttendanceCredential(device.schoolId, tokenOrUid);
      if (!credential) {
        const response: ReaderGatewayResponse = {
          success: false,
          action: "ATTENDANCE",
          status: "UNKNOWN_CREDENTIAL",
          message: "Wristband not registered",
          beep: "error",
          feedback: { beep: "error" },
        };
        await recordLastScan(device, "UNKNOWN_CREDENTIAL", response.message, scannedAt);
        res.status(404).json(response);
        return;
      }

      if (credential.blockedReason) {
        const response: ReaderGatewayResponse = {
          success: false,
          action: "ATTENDANCE",
          status: "BLOCKED",
          message: credential.blockedReason,
          beep: "error",
          feedback: { beep: "error" },
        };
        await recordLastScan(device, "BLOCKED", response.message, scannedAt);
        res.status(403).json(response);
        return;
      }

      const { start, end } = dayRange(scannedAt);
      const duplicate = await prisma.studentAttendanceEvent.findFirst({
        where: {
          schoolId: device.schoolId,
          studentId: credential.studentId,
          direction: AttendanceDirection.TAP_IN,
          status: { in: [AttendanceScanStatus.VALID, AttendanceScanStatus.LATE] },
          scannedAt: { gte: start, lt: end },
        },
        orderBy: { scannedAt: "desc" },
      });

      if (duplicate) {
        const response: ReaderGatewayResponse = {
          success: true,
          action: "ATTENDANCE",
          status: "DUPLICATE",
          message: "Attendance already recorded",
          beep: "duplicate",
          studentName: credential.studentName,
          feedback: { beep: "duplicate" },
        };
        await prisma.$transaction(async (tx) => {
          await tx.auditLog.create({
            data: {
              schoolId: device.schoolId,
              action: "reader_event.attendance",
              correlationId: eventToken,
              details: {
                deviceId: body.deviceId,
                readerId: body.readerId,
                credentialUID: tokenOrUid,
                format: body.format ?? null,
                deviceTime: body.deviceTime ?? null,
                firmwareVersion: body.firmwareVersion ?? null,
                retryCount: body.retryCount ?? 0,
                syncStatus: body.syncStatus ?? null,
                duplicateOf: duplicate.id,
                response,
              },
            },
          });
          await tx.nfcOfflineDevice.update({
            where: { id: device.id },
            data: {
              lastSeenAt: new Date(),
              lastSyncAt: new Date(),
              lastScanAt: scannedAt,
              lastScanStatus: "DUPLICATE",
              lastScanMessage: response.message,
              onlineStatus: "ONLINE",
            },
          });
        });
        res.json(response);
        return;
      }

      const result = await prisma.$transaction(async (tx) => {
        await tx.studentAttendanceEvent.create({
          data: {
            schoolId: device.schoolId,
            studentId: credential.studentId,
            credentialId: credential.credentialId,
            direction: AttendanceDirection.TAP_IN,
            source: AttendanceScanSource.NFC_WRISTBAND,
            status: AttendanceScanStatus.VALID,
            reason: null,
            scannedAt,
          },
        });
        const response: ReaderGatewayResponse = {
          success: true,
          action: "ATTENDANCE",
          status: "PRESENT",
          message: "Attendance recorded",
          beep: "success",
          studentName: credential.studentName,
          feedback: { beep: "success" },
        };

        await tx.auditLog.create({
          data: {
            schoolId: device.schoolId,
            action: "reader_event.attendance",
            correlationId: eventToken,
            details: {
              deviceId: body.deviceId,
              readerId: body.readerId,
              credentialUID: tokenOrUid,
              format: body.format ?? null,
              deviceTime: body.deviceTime ?? null,
              firmwareVersion: body.firmwareVersion ?? null,
              retryCount: body.retryCount ?? 0,
              syncStatus: body.syncStatus ?? null,
              response,
            },
          },
        });

        await tx.nfcOfflineDevice.update({
          where: { id: device.id },
          data: {
            lastSeenAt: new Date(),
            lastSyncAt: new Date(),
            lastScanAt: scannedAt,
            lastScanStatus: "PRESENT",
            lastScanMessage: response.message,
            onlineStatus: "ONLINE",
          },
        });

        return response;
      });

      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  router.post("/api/readers/heartbeat", async (req, res, next) => {
    try {
      const body = heartbeatSchema.parse(req.body);
      const device = await authenticateDevice(req, body);
      const now = new Date();

      await prisma.nfcOfflineDevice.update({
        where: { id: device.id },
        data: {
          lastSeenAt: now,
          lastIp: body.localIp ?? null,
          lastRssi: body.wifiRssi ?? null,
          firmwareVersion: body.firmwareVersion ?? null,
          queueDepth: body.queueDepth ?? 0,
          onlineStatus: "ONLINE",
          lastApiContactAt: parseOptionalDate(body.lastSuccessfulApiContactAt) ?? now,
        },
      });

      res.json({
        success: true,
        action: "REGISTER",
        status: "REGISTERED",
        message: "Heartbeat received",
        beep: "none",
        feedback: { beep: "none" },
      } satisfies ReaderGatewayResponse);
    } catch (error) {
      next(error);
    }
  });

  return router;
}
