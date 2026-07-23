import { randomUUID } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import { hasPermission } from "../../shared/permissions";
import { isActiveAttendanceCapableReader, formatAttendanceReaderLabel } from "../../shared/utils/attendanceReaders";
import { prisma as defaultPrisma } from "../db/prisma";
import { resolveStudentByIdentifier, type NfcTagsContext } from "./nfcTagsService";
import { linkReaderCredentialToAssignedTag } from "./readerCredentialLinkService";
import { WRITE_NFC_TAG_PAYLOAD_COMMAND } from "./readerDeviceCommandService";

type NfcTagWriteCommandDb = Pick<
  PrismaClient,
  "readerDeviceCommand" | "nfcOfflineDevice" | "nfcTag" | "student" | "auditLog" | "$transaction"
>;

type CommandRow = {
  id: string;
  schoolId: string;
  deviceId: string;
  type: string;
  status: string;
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

type ControllerRow = {
  id: string;
  schoolId: string;
  name: string;
  deviceKey: string;
  mode: string;
  location: string | null;
  locationName: string | null;
  locationType: string | null;
  attendanceMode: string | null;
  isActive: boolean;
  status: string;
  onlineStatus: string | null;
  lastSeenAt: Date | null;
  lastHeartbeatAt: Date | null;
};

type TagRow = {
  id: string;
  schoolId: string;
  publicCode: string;
  physicalUid: string | null;
  tagMode: string;
  label: string | null;
  status: string;
  studentId: string | null;
  writtenUrl: string | null;
  writtenPayload: string | null;
  writtenAt: Date | null;
  verifiedAt: Date | null;
  assignedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  student?: {
    id: string;
    admissionNumber: string;
    firstName: string;
    lastName: string;
  } | null;
};

type StudentRow = {
  id: string;
  admissionNumber: string;
  firstName: string;
  lastName: string;
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

type WriteCallbackStatus = "SENT" | "WRITING" | "WRITTEN" | "VERIFYING" | "VERIFIED" | "FAILED";

type WriteCommandCallback = {
  commandId: string;
  deviceId: string;
  status: WriteCallbackStatus;
  writtenPayload?: string | null;
  readbackPayload?: string | null;
  credential?: string | null;
  credentialUID?: string | null;
  rawWiegandBitCount?: number | null;
  rawWiegandBinary?: string | null;
  rawWiegandDecimal?: string | null;
  rawWiegandHex?: string | null;
  facilityCode?: string | null;
  cardNumber?: string | null;
  errorMessage?: string | null;
};

const ACTIVE_WRITE_COMMAND_STATUSES = new Set(["PENDING", "SENT", "WRITING", "WRITTEN", "VERIFYING"]);
const TERMINAL_WRITE_COMMAND_STATUSES = new Set(["VERIFIED", "FAILED"]);

function requireSchoolId(ctx: NfcTagsContext): string {
  if (!ctx.schoolId) {
    throw Object.assign(new Error("School context required."), { status: 401 });
  }
  return ctx.schoolId;
}

function requireTagManager(ctx: NfcTagsContext) {
  if (!ctx.actorId || !ctx.role) {
    throw Object.assign(new Error("Authentication required."), { status: 401 });
  }
  if (!hasPermission(ctx.role, "nfc.tags.manage")) {
    throw Object.assign(new Error("You do not have permission for this NFC action."), { status: 403 });
  }
}

function makePublicCode() {
  return randomUUID().replace(/-/g, "").slice(0, 32);
}

function makeOperationalPayload(publicCode: string) {
  return `SCNFC:${publicCode}`;
}

function cleanUrl(value: string) {
  return value.replace(/\/+$/, "");
}

function serializeStudent(student: StudentRow) {
  return {
    id: student.id,
    name: `${student.firstName} ${student.lastName}`.trim(),
    admissionNumber: student.admissionNumber,
  };
}

function asWritePayloadJson(value: unknown): WritePayloadJson {
  const payload = value as WritePayloadJson | null;
  if (
    !payload
    || typeof payload.tagId !== "string"
    || typeof payload.studentId !== "string"
    || typeof payload.publicCode !== "string"
    || typeof payload.payload !== "string"
  ) {
    throw Object.assign(new Error("Reader command payload is invalid."), { status: 500 });
  }
  return payload;
}

async function audit(
  db: Pick<PrismaClient, "auditLog">,
  schoolId: string,
  action: string,
  correlationId: string,
  details: Record<string, unknown>,
) {
  await db.auditLog.create({
    data: {
      schoolId,
      action,
      correlationId,
      details,
    },
  });
}

async function loadController(
  db: Pick<PrismaClient, "nfcOfflineDevice">,
  schoolId: string,
  controllerId: string,
) {
  const device = await db.nfcOfflineDevice.findFirst({
    where: {
      schoolId,
      OR: [
        { id: controllerId },
        { deviceKey: controllerId },
      ],
    },
    select: {
      id: true,
      schoolId: true,
      name: true,
      deviceKey: true,
      mode: true,
      location: true,
      locationName: true,
      locationType: true,
      attendanceMode: true,
      isActive: true,
      status: true,
      onlineStatus: true,
      lastSeenAt: true,
      lastHeartbeatAt: true,
    },
  }) as ControllerRow | null;

  if (!device) {
    throw Object.assign(new Error("Selected ESP32 controller was not found."), { status: 404 });
  }
  if (!isActiveAttendanceCapableReader(device)) {
    throw Object.assign(new Error("Selected device is not an active attendance-capable ESP32 controller."), { status: 409 });
  }
  return device;
}

async function loadWritableTag(
  db: Pick<PrismaClient, "nfcTag">,
  schoolId: string,
  tagId: string,
) {
  const tag = await db.nfcTag.findFirst({
    where: { id: tagId, schoolId },
    include: {
      student: {
        select: {
          id: true,
          admissionNumber: true,
          firstName: true,
          lastName: true,
        },
      },
    },
  }) as TagRow | null;
  if (!tag) {
    throw Object.assign(new Error("NFC tag not found."), { status: 404 });
  }
  if (["DISABLED", "LOST"].includes(tag.status)) {
    throw Object.assign(new Error("Disabled or lost tags cannot be used for controller-driven writing."), { status: 409 });
  }
  return tag;
}

function mobilePayloadStatus(status: string) {
  switch (status) {
    case "WRITTEN":
      return "written" as const;
    case "VERIFIED":
      return "verified" as const;
    case "FAILED":
      return "failed" as const;
    default:
      return "pending" as const;
  }
}

function readerCredentialStatus(status: string | null, captureEnabled: boolean) {
  if (!captureEnabled) {
    return "not_requested" as const;
  }
  if (status === "LINKED") {
    return "linked" as const;
  }
  if (status === "FAILED") {
    return "failed" as const;
  }
  return "pending" as const;
}

async function loadCommandForSchool(
  db: Pick<PrismaClient, "readerDeviceCommand" | "nfcOfflineDevice" | "nfcTag">,
  schoolId: string,
  commandId: string,
) {
  const command = await db.readerDeviceCommand.findFirst({
    where: {
      id: commandId,
      schoolId,
      type: WRITE_NFC_TAG_PAYLOAD_COMMAND,
    },
  }) as CommandRow | null;
  if (!command) {
    throw Object.assign(new Error("Reader write command not found."), { status: 404 });
  }

  const device = await db.nfcOfflineDevice.findFirst({
    where: { id: command.deviceId, schoolId },
    select: {
      id: true,
      name: true,
      deviceKey: true,
      location: true,
      locationName: true,
      onlineStatus: true,
      lastSeenAt: true,
      lastHeartbeatAt: true,
    },
  });
  const tag = command.targetTagId
    ? await db.nfcTag.findFirst({
        where: { id: command.targetTagId, schoolId },
        include: {
          student: {
            select: {
              id: true,
              admissionNumber: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      }) as TagRow | null
    : null;
  return { command, device, tag };
}

function serializeWriteCommand(
  command: CommandRow,
  device: {
    id: string;
    name?: string | null;
    deviceKey?: string | null;
    location?: string | null;
    locationName?: string | null;
    onlineStatus?: string | null;
    lastSeenAt?: Date | null;
    lastHeartbeatAt?: Date | null;
  } | null,
  tag: TagRow | null,
) {
  const payload = asWritePayloadJson(command.payloadJson);
  return {
    id: command.id,
    type: "WRITE_NFC_TAG_PAYLOAD" as const,
    status: command.status,
    createdAt: command.createdAt.toISOString(),
    requestedAt: command.requestedAt.toISOString(),
    sentAt: command.sentAt?.toISOString() ?? null,
    writeStartedAt: command.writeStartedAt?.toISOString() ?? null,
    writeCompletedAt: command.writeCompletedAt?.toISOString() ?? null,
    verifyStartedAt: command.verifyStartedAt?.toISOString() ?? null,
    verifiedAt: command.verifiedAt?.toISOString() ?? null,
    failedAt: command.failedAt?.toISOString() ?? null,
    completedAt: command.completedAt?.toISOString() ?? null,
    lastStatusAt: command.lastStatusAt?.toISOString() ?? null,
    lastStatusMessage: command.lastStatusMessage,
    errorMessage: command.errorMessage,
    payload,
    device: device ? {
      id: device.id,
      name: device.name ?? null,
      deviceKey: device.deviceKey ?? null,
      label: formatAttendanceReaderLabel(device),
      onlineStatus: device.onlineStatus ?? null,
      lastSeenAt: device.lastSeenAt?.toISOString() ?? null,
      lastHeartbeatAt: device.lastHeartbeatAt?.toISOString() ?? null,
    } : null,
    tag: tag ? {
      id: tag.id,
      publicCode: tag.publicCode,
      label: tag.label,
      status: tag.status,
      physicalUid: tag.physicalUid,
      writtenPayload: tag.writtenPayload ?? payload.payload,
      student: tag.student ? serializeStudent(tag.student) : null,
    } : {
      id: payload.tagId,
      publicCode: payload.publicCode,
      label: null,
      status: null,
      physicalUid: null,
      writtenPayload: payload.payload,
      student: null,
    },
    writtenPayload: command.writtenPayload,
    readbackPayload: command.readbackPayload,
    mobilePayloadStatus: mobilePayloadStatus(command.status),
    readerCredentialStatus: readerCredentialStatus(command.credentialStatus, payload.captureReaderCredential),
    readerCredentialLinkedAt: command.credentialLinkedAt?.toISOString() ?? null,
    readerCredentialError: command.credentialError,
  };
}

export async function createNfcTagWriteCommand(
  ctx: NfcTagsContext,
  input: {
    controllerId: string;
    studentId?: string | null;
    admissionNumber?: string | null;
    tagId?: string | null;
    baseUrl: string;
  },
  db: NfcTagWriteCommandDb = defaultPrisma,
) {
  const schoolId = requireSchoolId(ctx);
  requireTagManager(ctx);

  return db.$transaction(async (tx) => {
    const controller = await loadController(tx, schoolId, input.controllerId);
    const student = await resolveStudentByIdentifier(schoolId, {
      studentId: input.studentId ?? undefined,
      admissionNumber: input.admissionNumber ?? undefined,
    }, tx as never) as StudentRow;

    const existingActive = await tx.readerDeviceCommand.findFirst({
      where: {
        schoolId,
        deviceId: controller.id,
        type: WRITE_NFC_TAG_PAYLOAD_COMMAND,
        targetStudentId: student.id,
        targetTagId: input.tagId ?? undefined,
        status: { in: Array.from(ACTIVE_WRITE_COMMAND_STATUSES) },
      },
      orderBy: [{ requestedAt: "desc" }, { createdAt: "desc" }],
    }) as CommandRow | null;
    if (existingActive) {
      const loaded = await loadCommandForSchool(tx as never, schoolId, existingActive.id);
      return serializeWriteCommand(loaded.command, loaded.device, loaded.tag);
    }

    let tag: TagRow;
    const publicBaseUrl = cleanUrl(input.baseUrl);
    if (input.tagId) {
      const existingTag = await loadWritableTag(tx, schoolId, input.tagId);
      if (existingTag.studentId && existingTag.studentId !== student.id) {
        throw Object.assign(new Error("Selected tag is already assigned to another student."), { status: 409 });
      }
      tag = await tx.nfcTag.update({
        where: { id: existingTag.id },
        data: {
          studentId: student.id,
          status: existingTag.status === "UNASSIGNED" || existingTag.status === "UNALLOCATED" || existingTag.status === "GENERATED" || existingTag.status === "REGISTERED"
            ? "ASSIGNED"
            : existingTag.status,
          assignedAt: existingTag.assignedAt ?? new Date(),
        },
        include: {
          student: {
            select: {
              id: true,
              admissionNumber: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      }) as TagRow;
    } else {
      const publicCode = makePublicCode();
      const payload = makeOperationalPayload(publicCode);
      tag = await tx.nfcTag.create({
        data: {
          schoolId,
          publicCode,
          tagMode: "TEXT",
          type: "STUDENT",
          purpose: "STUDENT",
          status: "ASSIGNED",
          studentId: student.id,
          assignedAt: new Date(),
          writtenUrl: `${publicBaseUrl}/t/${publicCode}`,
          writtenPayload: payload,
          createdById: ctx.actorId ?? null,
        },
        include: {
          student: {
            select: {
              id: true,
              admissionNumber: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      }) as TagRow;
    }

    const payload = {
      tagId: tag.id,
      studentId: student.id,
      publicCode: tag.publicCode,
      payload: makeOperationalPayload(tag.publicCode),
      format: "NDEF_TEXT" as const,
      verifyAfterWrite: true,
      captureReaderCredential: true,
    };

    const now = new Date();
    const command = await tx.readerDeviceCommand.create({
      data: {
        schoolId,
        deviceId: controller.id,
        type: WRITE_NFC_TAG_PAYLOAD_COMMAND,
        status: "PENDING",
        payloadJson: payload,
        targetTagId: tag.id,
        targetStudentId: student.id,
        expectedPayload: payload.payload,
        credentialStatus: "PENDING",
        requestedByUserId: ctx.actorId ?? null,
        requestedAt: now,
        lastStatusAt: now,
        lastStatusMessage: "NFC payload write command queued for the selected ESP32 controller.",
      },
    }) as CommandRow;

    await audit(tx, schoolId, "reader_device.command_requested", command.id, {
      actorUserId: ctx.actorId ?? null,
      actorRole: ctx.role ?? null,
      deviceId: controller.id,
      deviceKey: controller.deviceKey,
      type: WRITE_NFC_TAG_PAYLOAD_COMMAND,
      status: "PENDING",
      tagId: tag.id,
      studentId: student.id,
      publicCode: tag.publicCode,
      payload: payload.payload,
    });

    return serializeWriteCommand(command, controller, tag);
  });
}

export async function getNfcTagWriteCommand(
  ctx: NfcTagsContext,
  commandId: string,
  db: NfcTagWriteCommandDb = defaultPrisma,
) {
  const schoolId = requireSchoolId(ctx);
  requireTagManager(ctx);
  const loaded = await loadCommandForSchool(db as never, schoolId, commandId);
  return serializeWriteCommand(loaded.command, loaded.device, loaded.tag);
}

export async function processReaderTagWriteCommandCallback(
  device: { id: string; schoolId: string; deviceKey: string; name: string; location?: string | null; locationName?: string | null },
  body: WriteCommandCallback,
  db: NfcTagWriteCommandDb = defaultPrisma,
) {
  return db.$transaction(async (tx) => {
    const command = await tx.readerDeviceCommand.findFirst({
      where: {
        id: body.commandId,
        schoolId: device.schoolId,
        deviceId: device.id,
        type: WRITE_NFC_TAG_PAYLOAD_COMMAND,
      },
    }) as CommandRow | null;
    if (!command) {
      throw Object.assign(new Error("Command not found for this reader."), { status: 404 });
    }

    if (TERMINAL_WRITE_COMMAND_STATUSES.has(command.status) && command.status !== body.status) {
      throw Object.assign(new Error("Command already completed."), { status: 409 });
    }

    const payload = asWritePayloadJson(command.payloadJson);
    const tag = await tx.nfcTag.findFirst({
      where: { id: payload.tagId, schoolId: device.schoolId },
      include: {
        student: {
          select: {
            id: true,
            admissionNumber: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    }) as TagRow | null;
    if (!tag) {
      throw Object.assign(new Error("Target NFC tag no longer exists."), { status: 404 });
    }
    if (tag.studentId !== payload.studentId) {
      throw Object.assign(new Error("Target tag assignment changed before the command completed."), { status: 409 });
    }

    const now = new Date();
    const callbackCredential = body.credential || body.credentialUID || body.rawWiegandDecimal || body.rawWiegandHex || body.cardNumber || body.facilityCode;

    async function markCredentialFailure(message: string) {
      return tx.readerDeviceCommand.update({
        where: { id: command.id },
        data: {
          credentialStatus: "FAILED",
          credentialError: message,
          lastStatusAt: now,
          ...(command.lastStatusMessage ? {} : { lastStatusMessage: message }),
        },
      }) as Promise<CommandRow>;
    }

    if (body.status === "FAILED") {
      const errorMessage = body.errorMessage?.trim() || "ESP32 controller reported NFC tag write failure.";
      const updated = await tx.readerDeviceCommand.update({
        where: { id: command.id },
        data: {
          status: "FAILED",
          failedAt: command.failedAt ?? now,
          completedAt: now,
          errorMessage,
          lastStatusAt: now,
          lastStatusMessage: errorMessage,
        },
      }) as CommandRow;
      await audit(tx, device.schoolId, "reader_device.command_failed", command.id, {
        deviceId: device.id,
        deviceKey: device.deviceKey,
        tagId: payload.tagId,
        studentId: payload.studentId,
        status: "FAILED",
        errorMessage,
      });
      return serializeWriteCommand(updated, device, tag);
    }

    if (body.status === "SENT") {
      const updated = await tx.readerDeviceCommand.update({
        where: { id: command.id },
        data: {
          status: "SENT",
          sentAt: command.sentAt ?? now,
          lastStatusAt: now,
          lastStatusMessage: "ESP32 controller acknowledged receipt of the NFC payload write command.",
        },
      }) as CommandRow;
      return serializeWriteCommand(updated, device, tag);
    }

    if (body.status === "WRITING") {
      const updated = await tx.readerDeviceCommand.update({
        where: { id: command.id },
        data: {
          status: "WRITING",
          writeStartedAt: command.writeStartedAt ?? now,
          lastStatusAt: now,
          lastStatusMessage: "ESP32 controller started writing the NFC payload.",
        },
      }) as CommandRow;
      await audit(tx, device.schoolId, "reader_device.command_write_started", command.id, {
        deviceId: device.id,
        deviceKey: device.deviceKey,
        tagId: payload.tagId,
        studentId: payload.studentId,
      });
      return serializeWriteCommand(updated, device, tag);
    }

    if (body.status === "WRITTEN") {
      if ((body.writtenPayload ?? null) !== payload.payload) {
        const errorMessage = "Controller-reported written payload did not match the expected mobile NFC payload.";
        const failed = await tx.readerDeviceCommand.update({
          where: { id: command.id },
          data: {
            status: "FAILED",
            failedAt: command.failedAt ?? now,
            completedAt: now,
            writtenPayload: body.writtenPayload ?? null,
            errorMessage,
            lastStatusAt: now,
            lastStatusMessage: errorMessage,
          },
        }) as CommandRow;
        await audit(tx, device.schoolId, "reader_device.command_failed", command.id, {
          deviceId: device.id,
          deviceKey: device.deviceKey,
          tagId: payload.tagId,
          studentId: payload.studentId,
          status: "FAILED",
          errorMessage,
          writtenPayload: body.writtenPayload ?? null,
        });
        return serializeWriteCommand(failed, device, tag);
      }

      const updatedTag = await tx.nfcTag.update({
        where: { id: tag.id },
        data: {
          status: "WRITTEN",
          writtenAt: tag.writtenAt ?? now,
          writtenPayload: payload.payload,
        },
        include: {
          student: {
            select: {
              id: true,
              admissionNumber: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      }) as TagRow;

      let updated = await tx.readerDeviceCommand.update({
        where: { id: command.id },
        data: {
          status: "WRITTEN",
          writtenPayload: body.writtenPayload ?? payload.payload,
          writeCompletedAt: command.writeCompletedAt ?? now,
          lastStatusAt: now,
          lastStatusMessage: "NFC mobile payload written successfully.",
        },
      }) as CommandRow;

      await audit(tx, device.schoolId, "reader_device.command_write_succeeded", command.id, {
        deviceId: device.id,
        deviceKey: device.deviceKey,
        tagId: payload.tagId,
        studentId: payload.studentId,
        writtenPayload: body.writtenPayload ?? payload.payload,
      });

      if (payload.captureReaderCredential && callbackCredential) {
        try {
          const linkResult = await linkReaderCredentialToAssignedTag({
            schoolId: device.schoolId,
            tagId: payload.tagId,
            studentId: payload.studentId,
            commandId: command.id,
            actorId: null,
            actorRole: null,
            readerId: device.id,
            readerName: formatAttendanceReaderLabel(device),
            credential: body.credential ?? null,
            credentialUID: body.credentialUID ?? null,
            rawWiegandBitCount: body.rawWiegandBitCount ?? null,
            rawWiegandBinary: body.rawWiegandBinary ?? null,
            rawWiegandDecimal: body.rawWiegandDecimal ?? null,
            rawWiegandHex: body.rawWiegandHex ?? null,
            facilityCode: body.facilityCode ?? null,
            cardNumber: body.cardNumber ?? null,
          }, tx as never);
          updated = await tx.readerDeviceCommand.update({
            where: { id: command.id },
            data: {
              credentialJson: {
                credential: body.credential ?? null,
                credentialUID: body.credentialUID ?? null,
                rawWiegandBitCount: body.rawWiegandBitCount ?? null,
                rawWiegandBinary: body.rawWiegandBinary ?? null,
                rawWiegandDecimal: body.rawWiegandDecimal ?? null,
                rawWiegandHex: body.rawWiegandHex ?? null,
                facilityCode: body.facilityCode ?? null,
                cardNumber: body.cardNumber ?? null,
                linkedCredentialId: linkResult.credentialId,
                canonicalCredential: linkResult.canonicalCredential,
              },
              credentialStatus: "LINKED",
              credentialError: null,
              credentialLinkedAt: now,
            },
          }) as CommandRow;
        } catch (error) {
          const message = error instanceof Error ? error.message : "Failed to link reader credential.";
          updated = await markCredentialFailure(message);
        }
      }

      return serializeWriteCommand(updated, device, updatedTag);
    }

    if (body.status === "VERIFYING") {
      const updated = await tx.readerDeviceCommand.update({
        where: { id: command.id },
        data: {
          status: "VERIFYING",
          verifyStartedAt: command.verifyStartedAt ?? now,
          lastStatusAt: now,
          lastStatusMessage: "ESP32 controller is verifying the written NFC payload.",
        },
      }) as CommandRow;
      return serializeWriteCommand(updated, device, tag);
    }

    if ((body.readbackPayload ?? null) !== payload.payload) {
      const errorMessage = "Readback verification failed because the NFC payload did not match the expected public code payload.";
      const failed = await tx.readerDeviceCommand.update({
        where: { id: command.id },
        data: {
          status: "FAILED",
          failedAt: command.failedAt ?? now,
          completedAt: now,
          readbackPayload: body.readbackPayload ?? null,
          errorMessage,
          lastStatusAt: now,
          lastStatusMessage: errorMessage,
        },
      }) as CommandRow;
      await audit(tx, device.schoolId, "reader_device.command_failed", command.id, {
        deviceId: device.id,
        deviceKey: device.deviceKey,
        tagId: payload.tagId,
        studentId: payload.studentId,
        status: "FAILED",
        errorMessage,
        readbackPayload: body.readbackPayload ?? null,
      });
      return serializeWriteCommand(failed, device, tag);
    }

    const updatedTag = await tx.nfcTag.update({
      where: { id: tag.id },
      data: {
        status: "VERIFIED",
        writtenPayload: payload.payload,
        writtenAt: tag.writtenAt ?? now,
        verifiedAt: now,
      },
      include: {
        student: {
          select: {
            id: true,
            admissionNumber: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    }) as TagRow;

    let updated = await tx.readerDeviceCommand.update({
      where: { id: command.id },
      data: {
        status: "VERIFIED",
        readbackPayload: body.readbackPayload ?? payload.payload,
        verifiedAt: now,
        completedAt: now,
        lastStatusAt: now,
        lastStatusMessage: "NFC mobile payload verified successfully.",
      },
    }) as CommandRow;

    await audit(tx, device.schoolId, "reader_device.command_verify_succeeded", command.id, {
      deviceId: device.id,
      deviceKey: device.deviceKey,
      tagId: payload.tagId,
      studentId: payload.studentId,
      readbackPayload: body.readbackPayload ?? payload.payload,
    });

    if (payload.captureReaderCredential && callbackCredential && updated.credentialStatus !== "LINKED") {
      try {
        const linkResult = await linkReaderCredentialToAssignedTag({
          schoolId: device.schoolId,
          tagId: payload.tagId,
          studentId: payload.studentId,
          commandId: command.id,
          actorId: null,
          actorRole: null,
          readerId: device.id,
          readerName: formatAttendanceReaderLabel(device),
          credential: body.credential ?? null,
          credentialUID: body.credentialUID ?? null,
          rawWiegandBitCount: body.rawWiegandBitCount ?? null,
          rawWiegandBinary: body.rawWiegandBinary ?? null,
          rawWiegandDecimal: body.rawWiegandDecimal ?? null,
          rawWiegandHex: body.rawWiegandHex ?? null,
          facilityCode: body.facilityCode ?? null,
          cardNumber: body.cardNumber ?? null,
        }, tx as never);
        updated = await tx.readerDeviceCommand.update({
          where: { id: command.id },
          data: {
            credentialJson: {
              credential: body.credential ?? null,
              credentialUID: body.credentialUID ?? null,
              rawWiegandBitCount: body.rawWiegandBitCount ?? null,
              rawWiegandBinary: body.rawWiegandBinary ?? null,
              rawWiegandDecimal: body.rawWiegandDecimal ?? null,
              rawWiegandHex: body.rawWiegandHex ?? null,
              facilityCode: body.facilityCode ?? null,
              cardNumber: body.cardNumber ?? null,
              linkedCredentialId: linkResult.credentialId,
              canonicalCredential: linkResult.canonicalCredential,
            },
            credentialStatus: "LINKED",
            credentialError: null,
            credentialLinkedAt: now,
          },
        }) as CommandRow;
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to link reader credential.";
        updated = await markCredentialFailure(message);
      }
    }

    return serializeWriteCommand(updated, device, updatedTag);
  });
}
