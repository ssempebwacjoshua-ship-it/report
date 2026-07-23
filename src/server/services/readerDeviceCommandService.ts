import type { PrismaClient } from "@prisma/client";
import { findReaderGatewayOtaRelease } from "../config/readerGatewayOtaCatalog";
import { getReaderGatewayCanonicalApiBaseUrl } from "../config/readerGatewayCanonicalConfig";

const TRUSTED_READER_OTA_FALLBACK_BASE_URL = "https://report-production-b00d.up.railway.app";
const ACTIVE_FIRMWARE_COMMAND_STATUSES = ["PENDING", "ACKED", "DOWNLOADING", "INSTALLING"] as const;
const TERMINAL_FIRMWARE_COMMAND_STATUSES = ["SUCCEEDED", "FAILED"] as const;
const FIRMWARE_UPDATE_COMMAND = "FIRMWARE_UPDATE" as const;
export const WRITE_NFC_TAG_PAYLOAD_COMMAND = "WRITE_NFC_TAG_PAYLOAD" as const;
const DEVICE_DELIVERABLE_WRITE_STATUSES = ["PENDING", "SENT"] as const;

type ReaderDeviceCommandDb = Pick<PrismaClient, "readerDeviceCommand" | "nfcOfflineDevice" | "auditLog" | "$transaction">;

type CommandDevice = {
  id: string;
  schoolId: string;
  deviceKey: string;
  firmwareVersion: string | null;
  firmwareChannel?: string | null;
  otaStatus?: string | null;
  otaMessage?: string | null;
};

type ReaderDeviceCommandRow = {
  id: string;
  schoolId: string;
  deviceId: string;
  type: string;
  status: string;
  firmwareVersion: string | null;
  firmwareUrl: string | null;
  firmwareSha256: string | null;
  payloadJson: unknown;
  targetTagId: string | null;
  targetStudentId: string | null;
  expectedPayload: string | null;
  writtenPayload: string | null;
  readbackPayload: string | null;
  credentialJson: unknown;
  credentialStatus: string | null;
  credentialError: string | null;
  sentAt: Date | null;
  writeStartedAt: Date | null;
  writeCompletedAt: Date | null;
  verifyStartedAt: Date | null;
  verifiedAt: Date | null;
  failedAt: Date | null;
  credentialLinkedAt: Date | null;
  errorMessage: string | null;
  requestedByUserId: string | null;
  requestedAt: Date;
  ackedAt: Date | null;
  completedAt: Date | null;
  lastStatusAt: Date | null;
  lastStatusMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type WritePayloadJson = {
  tagId: string;
  studentId: string;
  publicCode: string;
  payload: string;
  format: "NDEF_TEXT";
  verifyAfterWrite: boolean;
  captureReaderCredential: boolean;
};

export type ReaderPendingCommandSummary =
  | {
      id: string;
      type: "FIRMWARE_UPDATE";
      firmwareVersion: string | null;
      firmwareUrl: string | null;
      firmwareSha256: string | null;
    }
  | {
      id: string;
      type: "WRITE_NFC_TAG_PAYLOAD";
      tagId: string;
      studentId: string;
      publicCode: string;
      payload: string;
      format: "NDEF_TEXT";
      verifyAfterWrite: boolean;
      captureReaderCredential: boolean;
      status: "PENDING" | "SENT";
    };

function trustedReaderOtaOrigins() {
  const origins = new Set<string>();
  for (const candidate of [getReaderGatewayCanonicalApiBaseUrl(), TRUSTED_READER_OTA_FALLBACK_BASE_URL]) {
    try {
      const parsed = new URL(candidate);
      if (parsed.protocol === "https:") {
        origins.add(parsed.origin);
      }
    } catch {
      // Ignore invalid values and keep the trusted fallback.
    }
  }
  origins.add(new URL(TRUSTED_READER_OTA_FALLBACK_BASE_URL).origin);
  return origins;
}

function trustedReaderOtaBaseUrl() {
  try {
    const parsed = new URL(getReaderGatewayCanonicalApiBaseUrl());
    if (parsed.protocol === "https:") {
      return `${parsed.origin}`;
    }
  } catch {
    // Fall back to the trusted production OTA origin below.
  }
  return TRUSTED_READER_OTA_FALLBACK_BASE_URL;
}

export function trustedReaderFirmwareUrlForRelease(releaseId: string) {
  const baseUrl = trustedReaderOtaBaseUrl();
  const firmwareUrl = `${baseUrl}/api/readers/ota/download/${encodeURIComponent(releaseId)}`;
  assertTrustedReaderFirmwareUrl(firmwareUrl);
  return firmwareUrl;
}

export function assertTrustedReaderFirmwareUrl(value: string) {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw Object.assign(new Error("Firmware URL is invalid."), { status: 400 });
  }

  if (parsed.protocol !== "https:") {
    throw Object.assign(new Error("Firmware URL must use HTTPS."), { status: 400 });
  }
  if (!trustedReaderOtaOrigins().has(parsed.origin)) {
    throw Object.assign(new Error("Firmware URL must point to the trusted OTA host."), { status: 400 });
  }
  if (!parsed.pathname.startsWith("/api/readers/ota/download/")) {
    throw Object.assign(new Error("Firmware URL must point to the trusted OTA download path."), { status: 400 });
  }
}

function asWritePayloadJson(value: unknown): WritePayloadJson | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const payload = value as Partial<WritePayloadJson>;
  if (
    typeof payload.tagId !== "string"
    || typeof payload.studentId !== "string"
    || typeof payload.publicCode !== "string"
    || typeof payload.payload !== "string"
    || payload.format !== "NDEF_TEXT"
    || typeof payload.verifyAfterWrite !== "boolean"
    || typeof payload.captureReaderCredential !== "boolean"
  ) {
    return null;
  }
  return payload as WritePayloadJson;
}

function toPendingCommandSummary(command: ReaderDeviceCommandRow | null): ReaderPendingCommandSummary | null {
  if (!command) {
    return null;
  }
  if (command.type === FIRMWARE_UPDATE_COMMAND) {
    return {
      id: command.id,
      type: "FIRMWARE_UPDATE",
      firmwareVersion: command.firmwareVersion,
      firmwareUrl: command.firmwareUrl,
      firmwareSha256: command.firmwareSha256,
    };
  }
  if (command.type === WRITE_NFC_TAG_PAYLOAD_COMMAND) {
    const payload = asWritePayloadJson(command.payloadJson);
    if (!payload) {
      return null;
    }
    return {
      id: command.id,
      type: "WRITE_NFC_TAG_PAYLOAD",
      tagId: payload.tagId,
      studentId: payload.studentId,
      publicCode: payload.publicCode,
      payload: payload.payload,
      format: payload.format,
      verifyAfterWrite: payload.verifyAfterWrite,
      captureReaderCredential: payload.captureReaderCredential,
      status: command.status === "SENT" ? "SENT" : "PENDING",
    };
  }
  return null;
}

export async function getPendingReaderCommand(
  db: Pick<PrismaClient, "readerDeviceCommand" | "auditLog" | "$transaction">,
  schoolId: string,
  deviceId: string,
) {
  const command = await db.readerDeviceCommand.findFirst({
    where: {
      schoolId,
      deviceId,
      OR: [
        { type: FIRMWARE_UPDATE_COMMAND, status: "PENDING" },
        { type: WRITE_NFC_TAG_PAYLOAD_COMMAND, status: { in: [...DEVICE_DELIVERABLE_WRITE_STATUSES] } },
      ],
    },
    orderBy: [{ requestedAt: "asc" }, { createdAt: "asc" }],
  }) as ReaderDeviceCommandRow | null;

  if (!command) {
    return null;
  }

  if (command.type === WRITE_NFC_TAG_PAYLOAD_COMMAND && command.status === "PENDING" && db.$transaction) {
    const now = new Date();
    const delivered = await db.$transaction(async (tx) => {
      const refreshed = await tx.readerDeviceCommand.findFirst({
        where: { id: command.id, schoolId, deviceId },
      }) as ReaderDeviceCommandRow | null;
      if (!refreshed) {
        return null;
      }
      if (refreshed.status === "PENDING") {
        const updated = await tx.readerDeviceCommand.update({
          where: { id: refreshed.id },
          data: {
            status: "SENT",
            sentAt: refreshed.sentAt ?? now,
            lastStatusAt: now,
            lastStatusMessage: "Reader command delivered to the selected controller.",
          },
        }) as ReaderDeviceCommandRow;
        await tx.auditLog.create({
          data: {
            schoolId,
            action: "reader_device.command_sent",
            correlationId: refreshed.id,
            details: {
              deviceId,
              commandId: refreshed.id,
              type: refreshed.type,
              status: "SENT",
            },
          },
        });
        return updated;
      }
      return refreshed;
    });
    return toPendingCommandSummary(delivered);
  }

  return toPendingCommandSummary(command);
}

export async function createFirmwareUpdateCommand(
  db: ReaderDeviceCommandDb,
  requestedByUserId: string,
  device: CommandDevice,
) {
  const release = findReaderGatewayOtaRelease({
    deviceId: device.id,
    deviceKey: device.deviceKey,
    firmwareChannel: device.firmwareChannel ?? "stable",
    currentVersion: device.firmwareVersion ?? "0.0.0",
  });

  if (!release) {
    throw Object.assign(new Error("No newer trusted firmware release is currently staged for this reader."), { status: 409 });
  }

  const firmwareUrl = trustedReaderFirmwareUrlForRelease(release.releaseId);
  const existing = await db.readerDeviceCommand.findFirst({
    where: {
      schoolId: device.schoolId,
      deviceId: device.id,
      type: FIRMWARE_UPDATE_COMMAND,
      firmwareVersion: release.version,
      status: { in: [...ACTIVE_FIRMWARE_COMMAND_STATUSES] },
    },
    orderBy: [{ requestedAt: "desc" }, { createdAt: "desc" }],
  }) as ReaderDeviceCommandRow | null;

  if (existing) {
    return {
      command: existing,
      idempotent: true,
      warning: "Firmware update is already pending for this reader and version.",
    };
  }

  const now = new Date();
  const command = await db.$transaction(async (tx) => {
    const created = await tx.readerDeviceCommand.create({
      data: {
        schoolId: device.schoolId,
        deviceId: device.id,
        type: FIRMWARE_UPDATE_COMMAND,
        status: "PENDING",
        firmwareVersion: release.version,
        firmwareUrl,
        firmwareSha256: release.sha256,
        requestedByUserId,
        requestedAt: now,
        lastStatusAt: now,
        lastStatusMessage: "Firmware update requested. Keep the reader powered during installation.",
      },
    });

    await tx.nfcOfflineDevice.update({
      where: { id: device.id },
      data: {
        otaStatus: "PENDING",
        otaMessage: "Firmware update requested. Keep the reader powered during installation.",
      },
    });

    await tx.auditLog.create({
      data: {
        schoolId: device.schoolId,
        action: "reader_device.command_requested",
        correlationId: created.id,
        details: {
          actorUserId: requestedByUserId,
          deviceId: device.id,
          deviceKey: device.deviceKey,
          type: FIRMWARE_UPDATE_COMMAND,
          status: "PENDING",
          firmwareVersion: release.version,
          firmwareUrl,
          firmwareSha256: release.sha256,
        },
      },
    });

    return created;
  });

  return {
    command: command as ReaderDeviceCommandRow,
    idempotent: false,
    warning: "Keep the reader powered and connected to Wi-Fi while the update installs.",
  };
}

async function loadDeviceCommandForDevice(
  db: Pick<PrismaClient, "readerDeviceCommand">,
  schoolId: string,
  deviceId: string,
  commandId: string,
) {
  return db.readerDeviceCommand.findFirst({
    where: {
      id: commandId,
      schoolId,
      deviceId,
    },
  }) as Promise<ReaderDeviceCommandRow | null>;
}

export async function acknowledgeReaderCommand(
  db: ReaderDeviceCommandDb,
  device: CommandDevice,
  commandId: string,
) {
  const command = await loadDeviceCommandForDevice(db, device.schoolId, device.id, commandId);
  if (!command) {
    throw Object.assign(new Error("Command not found for this reader."), { status: 404 });
  }
  if (command.type !== FIRMWARE_UPDATE_COMMAND) {
    throw Object.assign(new Error("Unsupported reader command type."), { status: 409 });
  }
  if (TERMINAL_FIRMWARE_COMMAND_STATUSES.includes(command.status as (typeof TERMINAL_FIRMWARE_COMMAND_STATUSES)[number])) {
    return command;
  }
  if (command.status !== "PENDING") {
    return command;
  }

  const now = new Date();
  return db.$transaction(async (tx) => {
    const updated = await tx.readerDeviceCommand.update({
      where: { id: command.id },
      data: {
        status: "ACKED",
        ackedAt: now,
        lastStatusAt: now,
        lastStatusMessage: "Reader acknowledged firmware update command.",
      },
    });

    await tx.nfcOfflineDevice.update({
      where: { id: device.id },
      data: {
        otaStatus: "ACKED",
        otaMessage: "Reader acknowledged firmware update command.",
      },
    });

    await tx.auditLog.create({
      data: {
        schoolId: device.schoolId,
        action: "reader_device.command_acked",
        correlationId: command.id,
        details: {
          deviceId: device.id,
          deviceKey: device.deviceKey,
          commandId: command.id,
          type: command.type,
          status: "ACKED",
        },
      },
    });

    return updated;
  }) as Promise<ReaderDeviceCommandRow>;
}

export async function updateReaderCommandStatus(
  db: ReaderDeviceCommandDb,
  device: CommandDevice,
  commandId: string,
  status: "ACKED" | "DOWNLOADING" | "INSTALLING" | "SUCCEEDED" | "FAILED",
  message: string,
  firmwareVersion?: string | null,
) {
  const command = await loadDeviceCommandForDevice(db, device.schoolId, device.id, commandId);
  if (!command) {
    throw Object.assign(new Error("Command not found for this reader."), { status: 404 });
  }
  if (command.type !== FIRMWARE_UPDATE_COMMAND) {
    throw Object.assign(new Error("Unsupported reader command type."), { status: 409 });
  }
  if (TERMINAL_FIRMWARE_COMMAND_STATUSES.includes(command.status as (typeof TERMINAL_FIRMWARE_COMMAND_STATUSES)[number]) && command.status !== status) {
    throw Object.assign(new Error("Command already completed."), { status: 409 });
  }

  const now = new Date();
  const isTerminal = status === "SUCCEEDED" || status === "FAILED";
  return db.$transaction(async (tx) => {
    const updated = await tx.readerDeviceCommand.update({
      where: { id: command.id },
      data: {
        status,
        completedAt: isTerminal ? now : command.completedAt,
        ackedAt: command.ackedAt ?? (status === "ACKED" ? now : null),
        lastStatusAt: now,
        lastStatusMessage: message,
        ...(firmwareVersion ? { firmwareVersion } : {}),
      },
    });

    await tx.nfcOfflineDevice.update({
      where: { id: device.id },
      data: {
        otaStatus: status,
        otaMessage: message,
        ...(status === "SUCCEEDED" && firmwareVersion ? { firmwareVersion } : {}),
      },
    });

    await tx.auditLog.create({
      data: {
        schoolId: device.schoolId,
        action: "reader_device.command_status",
        correlationId: command.id,
        details: {
          deviceId: device.id,
          deviceKey: device.deviceKey,
          commandId: command.id,
          type: command.type,
          status,
          message,
          firmwareVersion: firmwareVersion ?? command.firmwareVersion ?? null,
        },
      },
    });

    return updated;
  }) as Promise<ReaderDeviceCommandRow>;
}
