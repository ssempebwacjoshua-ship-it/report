import { createHash } from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db/prisma";
import { findReaderGatewayOtaRelease, getReaderGatewayOtaReleaseById } from "../config/readerGatewayOtaCatalog";
import {
  buildReaderCredentialDiagnostics,
  isLocationAwareReader,
  processLocationAwareReaderEvent,
  type ReaderGatewayResponse,
} from "../services/readerAttendanceService";
import { captureReaderCredentialFromReader } from "../services/readerCredentialLinkService";
import { getDashboardAttendanceSummaryForSchool } from "../services/dashboardService";
import { publishAttendanceRealtime } from "../services/attendanceRealtime";
import {
  authenticateReaderGatewayProvisioning,
  hashReaderGatewayToken,
  resolveReaderGatewayRegistration,
} from "../services/readerGatewayRegistrationService";

type ReaderGatewayDevice = {
  id: string;
  schoolId: string;
  deviceKey: string;
  name: string;
  location: string | null;
  locationType: string | null;
  locationName: string | null;
  mode: string;
  attendanceMode: string | null;
  studentScope: string | null;
  classId: string | null;
  streamId: string | null;
  direction: string | null;
  roleScope: string;
  firmwareVersion: string | null;
  lastHeartbeatAt: Date | null;
  uptimeMs: number | null;
  freeHeap: number | null;
  rebootReason: string | null;
  otaStatus: string | null;
  otaMessage: string | null;
  isActive: boolean;
  status: string;
};

const readerIdentitySchema = z.object({
  deviceId: z.string().trim().min(1, "Device ID is required."),
  readerId: z.string().trim().min(1, "Reader ID is required."),
  schoolId: z.string().trim().min(1, "School ID is required."),
});

const registerSchema = z.object({
  deviceId: z.string().trim().min(1, "Device ID is required."),
  readerId: z.string().trim().min(1, "Reader ID is required."),
  schoolId: z.string().trim().optional(),
  schoolCode: z.string().trim().max(50).optional(),
  location: z.string().trim().max(120).optional(),
  readerType: z.enum(["GATE", "CLASSROOM"]).optional().default("GATE"),
  deviceName: z.string().trim().max(120).optional(),
  firmwareChannel: z.string().trim().min(1).optional().default("stable"),
  firmwareVersion: z.string().trim().optional(),
  deviceTime: z.string().trim().optional(),
  transport: z.string().trim().optional(),
  schemaVersion: z.string().trim().optional(),
  hardware: z.string().trim().optional(),
});

const eventSchema = readerIdentitySchema.extend({
  eventId: z.string().trim().min(1, "Event ID is required."),
  credential: z.string().trim().optional(),
  credentialUID: z.string().trim().optional(),
  format: z.string().trim().optional(),
  rawWiegandBitCount: z.coerce.number().int().min(0).optional(),
  rawWiegandBinary: z.string().trim().optional(),
  rawWiegandDecimal: z.string().trim().optional(),
  rawWiegandHex: z.string().trim().optional(),
  facilityCode: z.string().trim().optional(),
  cardNumber: z.string().trim().optional(),
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

const otaCheckSchema = readerIdentitySchema.extend({
  firmwareVersion: z.string().trim().min(1, "Firmware version is required."),
  firmwareChannel: z.string().trim().min(1).optional().default("stable"),
  queueDepth: z.coerce.number().int().min(0).optional().default(0),
});

const otaStatusSchema = readerIdentitySchema.extend({
  releaseId: z.string().trim().min(1, "Release ID is required."),
  firmwareVersion: z.string().trim().min(1, "Firmware version is required."),
  firmwareChannel: z.string().trim().min(1).optional().default("stable"),
  fromVersion: z.string().trim().min(1, "From version is required."),
  toVersion: z.string().trim().min(1, "To version is required."),
  status: z.enum(["DOWNLOADING", "VERIFYING", "INSTALLING", "CONFIRMED", "FAILED", "DEFERRED"]),
  message: z.string().trim().min(1).max(500),
});

function bearerToken(req: Express.Request) {
  const authHeader = req.headers.authorization?.trim();
  return authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;
}

function hashToken(token: string) {
  return hashReaderGatewayToken(token);
}

function cachedResponse(details: unknown): ReaderGatewayResponse | null {
  if (!details || typeof details !== "object") return null;
  const payload = details as { response?: unknown };
  if (!payload.response || typeof payload.response !== "object") return null;
  const response = payload.response as Partial<ReaderGatewayResponse>;
  if (typeof response.success !== "boolean") return null;
  if (typeof response.action !== "string" || typeof response.message !== "string" || typeof response.beep !== "string") return null;
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

type StoredReaderEventReplay = {
  response: ReaderGatewayResponse;
  statusCode: number;
};

function inferReaderEventStatusCode(response: ReaderGatewayResponse) {
  switch (response.status) {
    case "UNKNOWN_CREDENTIAL":
      return 404;
    case "BLOCKED":
    case "FEES_HOLD":
    case "NOT_ELIGIBLE":
    case "DAY_SCHOLAR_NOT_ELIGIBLE":
    case "WRONG_CLASS":
      return 403;
    case "MISCONFIGURED":
    case "SESSION_CLOSED":
      return 409;
    default:
      return response.success ? 200 : 400;
  }
}

function cachedReplay(details: unknown): StoredReaderEventReplay | null {
  const response = cachedResponse(details);
  if (!response) return null;
  const payload = details && typeof details === "object"
    ? details as { responseStatusCode?: unknown }
    : null;
  const statusCode = typeof payload?.responseStatusCode === "number"
    ? payload.responseStatusCode
    : inferReaderEventStatusCode(response);
  return { response, statusCode };
}

function isExpectedLocationAwareReplayConflict(error: unknown) {
  const candidate = error as {
    code?: unknown;
    meta?: { target?: unknown };
    message?: unknown;
  } | null;
  if (!candidate || candidate.code !== "P2002") {
    return false;
  }

  const targets = Array.isArray(candidate.meta?.target)
    ? candidate.meta.target.map((value) => String(value))
    : candidate.meta?.target
      ? [String(candidate.meta.target)]
      : [];
  const message = typeof candidate.message === "string" ? candidate.message : "";

  const hasReaderEventCompoundKey = targets.includes("schoolId") && targets.includes("eventId");
  const hasExpectedIndexName = targets.some((target) =>
    target.includes("CampusMovementEvent_schoolId_eventId_key")
    || target.includes("ClassroomAttendanceEvent_schoolId_eventId_key")
    || target.includes("campusmovementevent_schoolid_eventid_key")
    || target.includes("classroomattendanceevent_schoolid_eventid_key"));

  return hasReaderEventCompoundKey
    || hasExpectedIndexName
    || message.includes("CampusMovementEvent_schoolId_eventId_key")
    || message.includes("ClassroomAttendanceEvent_schoolId_eventId_key");
}

function wait(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function loadStoredReaderEventReplay(
  schoolId: string,
  eventToken: string,
  attempts = 3,
): Promise<StoredReaderEventReplay | null> {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const existing = await prisma.auditLog.findFirst({
      where: {
        schoolId,
        action: "reader_event.attendance",
        correlationId: eventToken,
      },
      orderBy: { createdAt: "desc" },
    });
    const replay = cachedReplay(existing?.details);
    if (replay) {
      return replay;
    }
    if (attempt < attempts - 1) {
      await wait(15);
    }
  }
  return null;
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
      locationType: true,
      locationName: true,
      attendanceMode: true,
      studentScope: true,
      classId: true,
      streamId: true,
      direction: true,
      roleScope: true,
      location: true,
      firmwareVersion: true,
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

async function authenticateRegistration(req: Express.Request, body: z.infer<typeof registerSchema>) {
  const token = bearerToken(req);
  const provisioningAuth = authenticateReaderGatewayProvisioning(token);
  if (provisioningAuth) {
    return provisioningAuth;
  }

  if (!body.schoolId) {
    throw Object.assign(new Error("School assignment is required before reader registration."), { status: 409 });
  }

  const device = await authenticateDevice(req, {
    deviceId: body.deviceId,
    readerId: body.readerId,
    schoolId: body.schoolId,
  });
  return { kind: "device" as const, device, tokenHash: hashToken(token!) };
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

export function readerGatewayRoutes() {
  const router = Router();

  router.post("/api/readers/register", async (req, res, next) => {
    try {
      const body = registerSchema.parse(req.body);
      const auth = await authenticateRegistration(req, body);
      const registration = await resolveReaderGatewayRegistration(prisma as never, auth, body, req.ip);

      const response: ReaderGatewayResponse = {
        success: true,
        action: "REGISTER",
        status: "REGISTERED",
        message: "Reader registered",
        beep: "success",
        feedback: { beep: "success" },
      };
      res.json({
        ...response,
        schoolId: registration.schoolId,
        schoolName: registration.schoolName,
        assignmentStatus: registration.assignmentStatus,
        deviceId: registration.deviceId,
        readerId: registration.readerId,
        bearerToken: registration.bearerToken,
        firmwareChannel: registration.firmwareChannel,
      });
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
      const replay = await loadStoredReaderEventReplay(device.schoolId, eventToken, 1);
      if (replay) {
        await prisma.nfcOfflineDevice.update({
          where: { id: device.id },
          data: { lastSeenAt: new Date() },
        }).catch(() => null);
        res.status(replay.statusCode).json(replay.response);
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

      const capturedLink = await captureReaderCredentialFromReader(device, {
        credential: body.credential ?? null,
        credentialUID: body.credentialUID ?? null,
        rawWiegandDecimal: body.rawWiegandDecimal ?? null,
        rawWiegandHex: body.rawWiegandHex ?? null,
        facilityCode: body.facilityCode ?? null,
        cardNumber: body.cardNumber ?? null,
      });
      if (capturedLink) {
        await prisma.nfcOfflineDevice.update({
          where: { id: device.id },
          data: {
            lastSeenAt: new Date(),
            lastScanAt: parseDeviceTime(body.deviceTime),
            lastScanStatus: "CAPTURED",
            lastScanMessage: "Reader credential captured for linking",
            onlineStatus: "ONLINE",
          },
        }).catch(() => null);
        res.status(202).json({
          success: true,
          action: "LINK_CAPTURE",
          status: "CAPTURED",
          message: "Reader credential captured for linking",
          beep: "success",
          feedback: { beep: "success" },
        } satisfies ReaderGatewayResponse);
        return;
      }

      const scannedAt = parseDeviceTime(body.deviceTime);
      const credentialDiagnostics = buildReaderCredentialDiagnostics(body);
      if (isLocationAwareReader(device)) {
        try {
          const processed = await prisma.$transaction(async (tx) => {
            const committed = await processLocationAwareReaderEvent(device, body, tx);
            await tx.auditLog.create({
              data: {
                schoolId: device.schoolId,
                action: "reader_event.attendance",
                correlationId: eventToken,
                details: {
                  deviceId: body.deviceId,
                  readerId: body.readerId,
                  credentialDiagnostics,
                  deviceTime: body.deviceTime ?? null,
                  firmwareVersion: body.firmwareVersion ?? null,
                  retryCount: body.retryCount ?? 0,
                  syncStatus: body.syncStatus ?? null,
                  readerConfig: {
                    locationType: device.locationType,
                    locationName: device.locationName ?? device.location,
                    attendanceMode: device.attendanceMode,
                    studentScope: device.studentScope,
                    classId: device.classId,
                    streamId: device.streamId,
                  },
                  responseStatusCode: committed.statusCode,
                  response: committed.response,
                },
              },
            });
            await tx.nfcOfflineDevice.update({
              where: { id: device.id },
              data: {
                lastSeenAt: new Date(),
                lastSyncAt: new Date(),
                lastScanAt: committed.scannedAt,
                lastScanStatus: committed.response.status ?? (committed.response.success ? "SUCCESS" : "ERROR"),
                lastScanMessage: committed.response.message,
                onlineStatus: "ONLINE",
              },
            });
            return committed;
          });
          if (processed.response.success && processed.statusCode === 200) {
            void getDashboardAttendanceSummaryForSchool(prisma as never, device.schoolId)
              .then((summary) => {
                publishAttendanceRealtime(device.schoolId, summary);
              })
              .catch(() => null);
          }
          res.status(processed.statusCode).json(processed.response);
          return;
        } catch (error) {
          if (!isExpectedLocationAwareReplayConflict(error)) {
            throw error;
          }

          const conflictReplay = await loadStoredReaderEventReplay(device.schoolId, eventToken);
          if (conflictReplay) {
            res.status(conflictReplay.statusCode).json(conflictReplay.response);
            return;
          }

          res.status(409).json({
            success: false,
            action: "ATTENDANCE",
            status: "RETRY",
            message: "Reader event is still being finalized. Please retry this scan.",
            beep: "none",
            feedback: { beep: "none" },
          } satisfies ReaderGatewayResponse);
          return;
        }
      }
      const response: ReaderGatewayResponse = {
        success: false,
        action: "ATTENDANCE",
        status: "MISCONFIGURED",
        message: "Reader attendance configuration is incomplete. Configure location-aware attendance before scanning.",
        beep: "error",
        feedback: { beep: "error" },
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
              deviceTime: body.deviceTime ?? null,
              firmwareVersion: body.firmwareVersion ?? null,
              retryCount: body.retryCount ?? 0,
              syncStatus: body.syncStatus ?? null,
              responseStatusCode: 409,
              response,
            },
          },
        });
        await tx.nfcOfflineDevice.update({
          where: { id: device.id },
          data: {
            lastSeenAt: new Date(),
            lastScanAt: scannedAt,
            lastScanStatus: "MISCONFIGURED",
            lastScanMessage: response.message,
            onlineStatus: "ONLINE",
          },
        });
      });
      res.status(409).json(response);
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
          lastHeartbeatAt: now,
          lastIp: body.localIp ?? null,
          lastRssi: body.wifiRssi ?? null,
          firmwareVersion: body.firmwareVersion ?? null,
          uptimeMs: body.uptimeMs ?? null,
          freeHeap: body.freeHeap ?? null,
          queueDepth: body.queueDepth ?? 0,
          onlineStatus: "ONLINE",
          lastApiContactAt: parseOptionalDate(body.lastSuccessfulApiContactAt) ?? now,
        },
      });
      await prisma.auditLog.create({
        data: {
          schoolId: device.schoolId,
          action: "reader_device.heartbeat",
          correlationId: device.deviceKey,
          details: {
            deviceId: body.deviceId,
            readerId: body.readerId,
            firmwareVersion: body.firmwareVersion ?? null,
            wifiRssi: body.wifiRssi ?? null,
            localIp: body.localIp ?? null,
            uptimeMs: body.uptimeMs ?? null,
            freeHeap: body.freeHeap ?? null,
            queueDepth: body.queueDepth ?? 0,
            lastSuccessfulApiContactAt: body.lastSuccessfulApiContactAt ?? null,
          },
        },
      }).catch(() => null);

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

  router.post("/api/readers/ota/check", async (req, res, next) => {
    try {
      const body = otaCheckSchema.parse(req.body);
      const device = await authenticateDevice(req, body);
      const release = findReaderGatewayOtaRelease({
        deviceId: body.deviceId,
        deviceKey: device.deviceKey,
        firmwareChannel: body.firmwareChannel,
        currentVersion: body.firmwareVersion,
      });

      await prisma.nfcOfflineDevice.update({
        where: { id: device.id },
        data: {
          lastSeenAt: new Date(),
          otaStatus: release ? "UPDATE_AVAILABLE" : "NO_UPDATE",
          otaMessage: release ? "Firmware update available." : "No firmware update available.",
          queueDepth: body.queueDepth,
          onlineStatus: "ONLINE",
        },
      }).catch(() => null);

      if (!release) {
        res.json({
          success: true,
          action: "OTA",
          status: "NO_UPDATE",
          updateAvailable: false,
          message: "No firmware update available.",
        });
        return;
      }

      res.json({
        success: true,
        action: "OTA",
        status: "UPDATE_AVAILABLE",
        updateAvailable: true,
        message: "Firmware update available.",
        releaseId: release.releaseId,
        version: release.version,
        channel: release.channel,
        downloadPath: `/api/readers/ota/download/${encodeURIComponent(release.releaseId)}`,
        sha256: release.sha256,
        signature: release.signature,
        signatureAlgorithm: release.signatureAlgorithm,
        publicKeyId: release.publicKeyId ?? null,
        sizeBytes: release.sizeBytes ?? null,
      });
    } catch (error) {
      next(error);
    }
  });

  router.get("/api/readers/ota/download/:releaseId", async (req, res, next) => {
    try {
      const releaseId = z.string().trim().min(1).parse(req.params.releaseId);
      const identity = readerIdentitySchema.parse({
        deviceId: req.header("X-Device-Id"),
        readerId: req.header("X-Reader-Id"),
        schoolId: req.header("X-School-Id"),
      });
      const firmwareChannel = z.string().trim().default("stable").parse(req.header("X-Firmware-Channel") ?? "stable");
      const device = await authenticateDevice(req, identity);
      const release = getReaderGatewayOtaReleaseById(releaseId);
      if (!release) {
        res.status(404).json({ ok: false, code: "NOT_FOUND", message: "Firmware release not found." });
        return;
      }

      const assignedRelease = findReaderGatewayOtaRelease({
        deviceId: identity.deviceId,
        deviceKey: device.deviceKey,
        firmwareChannel,
        currentVersion: device.firmwareVersion ?? "0.0.0",
      });
      if (!assignedRelease || assignedRelease.releaseId !== release.releaseId) {
        res.status(403).json({ ok: false, code: "FORBIDDEN", message: "Firmware release is not assigned to this device." });
        return;
      }

      res.setHeader("Content-Type", "application/octet-stream");
      res.setHeader("Cache-Control", "no-store");
      res.setHeader("X-Firmware-Version", release.version);
      res.setHeader("X-Firmware-Channel", release.channel);
      res.setHeader("X-Firmware-Sha256", release.sha256);
      res.setHeader("X-Firmware-Signature", release.signature);
      if (release.sizeBytes) {
        res.setHeader("Content-Length", String(release.sizeBytes));
      }
      res.sendFile(release.artifactPath);
    } catch (error) {
      next(error);
    }
  });

  router.post("/api/readers/ota/status", async (req, res, next) => {
    try {
      const body = otaStatusSchema.parse(req.body);
      const device = await authenticateDevice(req, body);
      const now = new Date();

      await prisma.$transaction(async (tx) => {
        await tx.nfcOfflineDevice.update({
          where: { id: device.id },
          data: {
            lastSeenAt: now,
            onlineStatus: "ONLINE",
            otaStatus: body.status,
            otaMessage: body.message,
            ...(body.status === "CONFIRMED" ? { firmwareVersion: body.toVersion, lastSyncAt: now } : {}),
          },
        });
        await tx.auditLog.create({
          data: {
            schoolId: device.schoolId,
            action: "reader_device.ota_status",
            correlationId: `${device.deviceKey}:${body.releaseId}:${body.status}`,
            details: {
              deviceId: body.deviceId,
              readerId: body.readerId,
              releaseId: body.releaseId,
              firmwareChannel: body.firmwareChannel,
              fromVersion: body.fromVersion,
              toVersion: body.toVersion,
              status: body.status,
              message: body.message,
            },
          },
        });
      });

      res.json({
        success: true,
        action: "OTA",
        status: body.status,
        message: "OTA status recorded.",
      });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
