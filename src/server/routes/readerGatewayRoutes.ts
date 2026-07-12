import { createHash } from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import { AttendanceDirection, AttendanceScanSource, AttendanceScanStatus, CredentialStatus, CredentialType } from "@prisma/client";
import { prisma } from "../db/prisma";
import { maskCredentialValue, normalizeCredentialForLookup } from "../../shared/utils/credentialNormalization";
import {
  buildReaderCredentialDiagnostics,
  isLocationAwareReader,
  processLocationAwareReaderEvent,
  type ReaderGatewayResponse,
} from "../services/readerAttendanceService";
import { captureReaderCredentialFromReader } from "../services/readerCredentialLinkService";

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
  isActive: boolean;
  status: string;
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

type ReaderCredentialDiagnostics = {
  receivedMasked: string | null;
  normalizedMasked: string | null;
  lookupCount: number;
  format: string | null;
  rawWiegandBitCount: number | null;
  rawWiegandHexMasked: string | null;
  facilityCodeMasked: string | null;
  cardNumberMasked: string | null;
};

function buildCredentialDiagnostics(
  rawValue: string,
  normalized: ReturnType<typeof normalizeCredentialForLookup>,
  body: z.infer<typeof eventSchema>,
): ReaderCredentialDiagnostics {
  return {
    receivedMasked: maskCredentialValue(rawValue),
    normalizedMasked: maskCredentialValue(normalized.canonical),
    lookupCount: normalized.lookupValues.length,
    format: body.format ?? null,
    rawWiegandBitCount: body.rawWiegandBitCount ?? null,
    rawWiegandHexMasked: maskCredentialValue(body.rawWiegandHex),
    facilityCodeMasked: maskCredentialValue(body.facilityCode),
    cardNumberMasked: maskCredentialValue(body.cardNumber),
  };
}

async function resolveAttendanceCredential(
  schoolId: string,
  normalized: ReturnType<typeof normalizeCredentialForLookup>,
) {
  const credential = normalized.strongAliases.length > 0
    ? await prisma.studentCredential.findFirst({
        where: {
          schoolId,
          type: CredentialType.NFC_WRISTBAND,
          OR: [
            ...(normalized.tokenValues.length ? [{ scanToken: { in: normalized.tokenValues } }] : []),
            { credentialUID: { in: normalized.strongAliases } },
          ],
        },
        include: {
          student: {
            select: { id: true, firstName: true, lastName: true, isActive: true },
          },
        },
      })
    : null;

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

  const weakCredentialMatches = normalized.weakAliases.length > 0
    ? await prisma.studentCredential.findMany({
        where: {
          schoolId,
          type: CredentialType.NFC_WRISTBAND,
          credentialUID: { in: normalized.weakAliases },
        },
        include: {
          student: {
            select: { id: true, firstName: true, lastName: true, isActive: true },
          },
        },
      })
    : [];

  const uniqueWeakCredentialStudentIds = [...new Set(weakCredentialMatches.map((item) => item.studentId))];
  if (uniqueWeakCredentialStudentIds.length === 1 && weakCredentialMatches[0]) {
    const weakCredential = weakCredentialMatches[0];
    return {
      studentId: weakCredential.studentId,
      credentialId: weakCredential.id,
      studentName: `${weakCredential.student.firstName} ${weakCredential.student.lastName}`.trim(),
      blockedReason: weakCredential.status !== CredentialStatus.ACTIVE
        ? "Wristband is disabled"
        : !weakCredential.student.isActive
          ? "Student is inactive"
          : null,
    };
  }

  const strongTag = normalized.strongAliases.length > 0
    ? await prisma.nfcTag.findFirst({
        where: {
          schoolId,
          OR: [
            ...(normalized.tokenValues.length ? [{ publicCode: { in: normalized.tokenValues } }] : []),
            ...(normalized.strongAliases.map((value) => ({ physicalUid: { equals: value, mode: "insensitive" as const } }))),
          ],
        },
        include: {
          student: {
            select: { id: true, firstName: true, lastName: true, isActive: true },
          },
        },
      })
    : null;

  if (strongTag?.studentId && strongTag.student) {
    return {
      studentId: strongTag.studentId,
      credentialId: null,
      studentName: `${strongTag.student.firstName} ${strongTag.student.lastName}`.trim(),
      blockedReason: strongTag.status === "DISABLED" || strongTag.status === "LOST"
        ? "Wristband is disabled"
        : !strongTag.student.isActive
          ? "Student is inactive"
          : null,
    };
  }

  const weakTagMatches = normalized.weakAliases.length > 0
    ? await prisma.nfcTag.findMany({
        where: {
          schoolId,
          OR: normalized.weakAliases.map((value) => ({ physicalUid: { equals: value, mode: "insensitive" as const } })),
        },
        include: {
          student: {
            select: { id: true, firstName: true, lastName: true, isActive: true },
          },
        },
      })
    : [];

  const uniqueWeakTagStudentIds = [...new Set(weakTagMatches.map((item) => item.studentId).filter(Boolean))];
  if (uniqueWeakTagStudentIds.length === 1) {
    const tag = weakTagMatches.find((item) => item.studentId && item.student);
    if (tag?.studentId && tag.student) {
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
  }

  return null;
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
      const normalizedCredential = normalizeCredentialForLookup({
        value: tokenOrUid,
        cardNumber: body.cardNumber,
        facilityCode: body.facilityCode,
        rawWiegandDecimal: body.rawWiegandDecimal,
        rawWiegandHex: body.rawWiegandHex,
      });
      const legacyCredentialDiagnostics = buildCredentialDiagnostics(tokenOrUid, normalizedCredential, body);
      const credential = await resolveAttendanceCredential(device.schoolId, normalizedCredential);
      if (!credential) {
        const response: ReaderGatewayResponse = {
          success: false,
          action: "ATTENDANCE",
          status: "UNKNOWN_CREDENTIAL",
          message: "Wristband not registered",
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
                credentialDiagnostics: legacyCredentialDiagnostics,
                deviceTime: body.deviceTime ?? null,
                firmwareVersion: body.firmwareVersion ?? null,
                retryCount: body.retryCount ?? 0,
                syncStatus: body.syncStatus ?? null,
                responseStatusCode: 404,
                response,
              },
            },
          });
          await tx.nfcOfflineDevice.update({
            where: { id: device.id },
            data: {
              lastSeenAt: new Date(),
              lastScanAt: scannedAt,
              lastScanStatus: "UNKNOWN_CREDENTIAL",
              lastScanMessage: response.message,
              onlineStatus: "ONLINE",
            },
          });
        });
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
                credentialDiagnostics: legacyCredentialDiagnostics,
                deviceTime: body.deviceTime ?? null,
                firmwareVersion: body.firmwareVersion ?? null,
                retryCount: body.retryCount ?? 0,
                syncStatus: body.syncStatus ?? null,
                duplicateOf: duplicate.id,
                responseStatusCode: 200,
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
              credentialDiagnostics: legacyCredentialDiagnostics,
              deviceTime: body.deviceTime ?? null,
              firmwareVersion: body.firmwareVersion ?? null,
              retryCount: body.retryCount ?? 0,
              syncStatus: body.syncStatus ?? null,
              responseStatusCode: 200,
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
