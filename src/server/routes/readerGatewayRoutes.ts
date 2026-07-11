import { createHash } from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db/prisma";
import { scanAttendance, type NfcOperationsContext } from "../services/nfcOperationsService";

type ReaderGatewayDevice = {
  id: string;
  schoolId: string;
  deviceKey: string;
  name: string;
  mode: string;
  roleScope: string;
};

type ReaderGatewayResponse = {
  success: boolean;
  action: "REGISTER" | "ATTENDANCE";
  message: string;
  beep: "success" | "warning" | "error" | "none";
  studentName?: string;
  feedback: { beep: "success" | "warning" | "error" | "none" };
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

function bearerToken(req: Express.Request) {
  const authHeader = req.headers.authorization?.trim();
  return authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function deviceContext(device: ReaderGatewayDevice): NfcOperationsContext {
  return {
    schoolId: device.schoolId,
    actorId: device.id,
    role: "ADMIN_OPERATOR",
  };
}

function responseFromAttendance(result: Awaited<ReturnType<typeof scanAttendance>>): ReaderGatewayResponse {
  const status = result.scan.status;
  const beep = status === "VALID"
    ? "success"
    : status === "LATE" || status === "DUPLICATE"
      ? "warning"
      : "error";
  const message = status === "VALID"
    ? "Attendance recorded"
    : status === "LATE"
      ? "Late arrival recorded"
      : status === "DUPLICATE"
        ? "Duplicate tap ignored"
        : result.scan.reason ?? "Attendance blocked";

  return {
    success: true,
    action: "ATTENDANCE",
    message,
    beep,
    studentName: result.scan.student.name,
    feedback: { beep },
  };
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
    where: { deviceTokenHash: hashToken(token), isActive: true, status: "ACTIVE" },
    select: {
      id: true,
      schoolId: true,
      deviceKey: true,
      name: true,
      mode: true,
      roleScope: true,
    },
  }) as ReaderGatewayDevice | null;

  if (!device) {
    throw Object.assign(new Error("Invalid or revoked device token."), { status: 401 });
  }

  if (body.schoolId !== device.schoolId) {
    throw Object.assign(new Error("Reader belongs to a different school."), { status: 403 });
  }

  if (![device.deviceKey, device.id].includes(body.deviceId) || ![device.deviceKey, device.id].includes(body.readerId)) {
    throw Object.assign(new Error("Reader identity does not match the configured device."), { status: 403 });
  }

  return device;
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

      const result = await prisma.$transaction(async (tx) => {
        const scan = await scanAttendance(
          deviceContext(device),
          { tokenOrUid, deviceId: device.deviceKey },
          tx,
        );
        const response = responseFromAttendance(scan);

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
          data: { lastSeenAt: new Date(), lastSyncAt: new Date() },
        });

        return response;
      });

      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  return router;
}
