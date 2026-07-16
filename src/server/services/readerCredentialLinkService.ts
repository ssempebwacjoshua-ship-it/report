import type { PrismaClient } from "@prisma/client";
import { CredentialStatus, CredentialType } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { prisma as defaultPrisma } from "../db/prisma";
import { buildDeviceIdentityWhere, RECENT_DEVICE_ORDER_BY } from "../utils/deviceIdentity";
import { hasPermission } from "../../shared/permissions";
import {
  buildReaderCredentialAliases,
  maskCredentialValue,
  type ReaderCredentialAliasSource,
  type CredentialNormalizationInput,
} from "../../shared/utils/credentialNormalization";
import {
  formatAttendanceReaderLabel,
  isActiveAttendanceCapableReader,
  isReaderAvailableForCredentialCapture,
} from "../../shared/utils/attendanceReaders";
import { generateCredentialScanToken } from "./studentCredentialService";

type ReaderCredentialLinkContext = {
  schoolId?: string | null;
  actorId?: string | null;
  role?: string | null;
};

type ReaderCredentialLinkDb = Pick<
  PrismaClient,
  "nfcTag" | "studentCredential" | "nfcOfflineDevice" | "readerCredentialCaptureSession" | "auditLog"
> & {
  $transaction?: <T>(fn: (tx: ReaderCredentialLinkDb) => Promise<T>) => Promise<T>;
};

type CaptureReaderDevice = {
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

type CapturedReaderCredential = {
  canonical: string;
  aliases: string[];
  strongAliases: string[];
  weakAliases: string[];
  aliasSource: Record<string, ReaderCredentialAliasSource>;
  credential: string | null;
  rawWiegandDecimal: string | null;
  rawWiegandHex: string | null;
  facilityCode: string | null;
  cardNumber: string | null;
  capturedAt: string;
  readerId: string;
  readerName: string;
};

export type ReaderCredentialConflictPayload = {
  code: "READER_CREDENTIAL_CONFLICT";
  message: string;
  previousStudent: {
    name: string;
    admissionNumber: string;
  };
  previousCredential: {
    status: string;
    maskedCredential: string | null;
  };
  previousTag: {
    label: string | null;
    publicCodePrefix: string | null;
    physicalUidMatched: boolean;
  } | null;
  matchedAliasMasked: string | null;
  matchedAliasSource: ReaderCredentialAliasSource | null;
  matchedAliasStrength: "STRONG" | "WEAK";
  canTransfer: boolean;
};

const DEFAULT_CAPTURE_EXPIRY_SECONDS = 90;
const MAX_CAPTURE_EXPIRY_SECONDS = 180;
const MIN_CAPTURE_EXPIRY_SECONDS = 15;

function requireSchoolId(ctx: ReaderCredentialLinkContext): string {
  if (!ctx.schoolId) throw Object.assign(new Error("School context required."), { status: 401 });
  return ctx.schoolId;
}

function requireTagManager(ctx: ReaderCredentialLinkContext) {
  if (!ctx.actorId || !ctx.role) {
    throw Object.assign(new Error("Authentication required."), { status: 401 });
  }
  if (!hasPermission(ctx.role, "nfc.tags.manage")) {
    throw Object.assign(new Error("You do not have permission for this NFC action."), { status: 403 });
  }
}

function runWrite<T>(db: ReaderCredentialLinkDb, fn: (tx: ReaderCredentialLinkDb) => Promise<T>) {
  return db.$transaction ? db.$transaction(fn) : fn(db);
}

type ReaderCredentialCaptureSessionRow = {
  id: string;
  schoolId: string;
  tagId: string;
  studentId: string;
  deviceId: string | null;
  deviceLabel: string | null;
  status: string;
  activeSchoolId: string | null;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
  capturedAt: Date | null;
  confirmedAt: Date | null;
  cancelledAt: Date | null;
  expiredAt: Date | null;
  capturedReaderId: string | null;
  capturedReaderName: string | null;
  capturedCredentialJson: CapturedReaderCredential | null;
};

function sessionStatus(session: Pick<ReaderCredentialCaptureSessionRow, "status" | "expiresAt" | "confirmedAt" | "cancelledAt" | "expiredAt" | "capturedCredentialJson">, now = Date.now()) {
  if (session.status === "CONFIRMED" || session.confirmedAt) return "CONFIRMED" as const;
  if (session.status === "CANCELLED" || session.cancelledAt) return "CANCELLED" as const;
  if (session.status === "EXPIRED" || session.expiredAt) return "EXPIRED" as const;
  if (new Date(session.expiresAt).getTime() <= now) return "EXPIRED" as const;
  return session.capturedCredentialJson ? "CAPTURED" as const : "PENDING" as const;
}

function serializeCaptureSession(session: ReaderCredentialCaptureSessionRow) {
  return {
    captureId: session.id,
    tagId: session.tagId,
    studentId: session.studentId,
    deviceId: session.deviceId,
    deviceLabel: session.deviceLabel,
    createdAt: session.createdAt.toISOString(),
    expiresAt: session.expiresAt.toISOString(),
    confirmedAt: session.confirmedAt ? session.confirmedAt.toISOString() : null,
    status: sessionStatus(session),
    preview: session.capturedCredentialJson
      ? {
          maskedCanonicalCredential: maskCredentialValue(session.capturedCredentialJson.canonical),
          maskedAliases: session.capturedCredentialJson.aliases.map((value) => maskCredentialValue(value)).filter(Boolean),
          credential: maskCredentialValue(session.capturedCredentialJson.credential),
          rawWiegandDecimal: maskCredentialValue(session.capturedCredentialJson.rawWiegandDecimal),
          rawWiegandHex: maskCredentialValue(session.capturedCredentialJson.rawWiegandHex),
          facilityCode: maskCredentialValue(session.capturedCredentialJson.facilityCode),
          cardNumber: maskCredentialValue(session.capturedCredentialJson.cardNumber),
          capturedAt: session.capturedCredentialJson.capturedAt,
          readerId: session.capturedCredentialJson.readerId,
          readerName: session.capturedCredentialJson.readerName,
        }
      : null,
  };
}

async function cleanExpiredSessions(db: ReaderCredentialLinkDb, schoolId?: string) {
  const now = new Date();
  const expiredSessions = await db.readerCredentialCaptureSession.findMany({
    where: {
      ...(schoolId ? { schoolId } : {}),
      activeSchoolId: { not: null },
      expiresAt: { lte: now },
      status: { in: ["PENDING", "CAPTURED"] },
    },
  }) as ReaderCredentialCaptureSessionRow[];

  for (const session of expiredSessions) {
    await db.readerCredentialCaptureSession.update({
      where: { id: session.id },
      data: {
        status: "EXPIRED",
        activeSchoolId: null,
        expiredAt: now,
      },
    });
  }
}

async function loadCaptureSession(db: ReaderCredentialLinkDb, schoolId: string, captureId: string) {
  const session = await db.readerCredentialCaptureSession.findFirst({
    where: { id: captureId, schoolId },
  }) as ReaderCredentialCaptureSessionRow | null;
  if (!session) throw Object.assign(new Error("Capture session not found."), { status: 404 });
  return session;
}

async function loadActiveCaptureSession(db: ReaderCredentialLinkDb, schoolId: string) {
  return db.readerCredentialCaptureSession.findFirst({
    where: {
      schoolId,
      activeSchoolId: schoolId,
      status: { in: ["PENDING", "CAPTURED"] },
    },
    orderBy: { createdAt: "desc" },
  }) as Promise<ReaderCredentialCaptureSessionRow | null>;
}

function buildCaptureInput(body: {
  credential?: string | null;
  credentialUID?: string | null;
  rawWiegandDecimal?: string | null;
  rawWiegandHex?: string | null;
  facilityCode?: string | null;
  cardNumber?: string | null;
}): CredentialNormalizationInput {
  return {
    value: body.credentialUID ?? body.credential ?? null,
    cardNumber: body.cardNumber ?? null,
    facilityCode: body.facilityCode ?? null,
    rawWiegandDecimal: body.rawWiegandDecimal ?? null,
    rawWiegandHex: body.rawWiegandHex ?? null,
  };
}

function namedStudent(student: { firstName: string; lastName: string; admissionNumber: string; id: string }) {
  return {
    name: `${student.firstName} ${student.lastName}`.trim(),
    admissionNumber: student.admissionNumber,
  };
}

function readerCredentialConflict(payload: ReaderCredentialConflictPayload) {
  return Object.assign(new Error(payload.message), {
    status: 409,
    code: payload.code,
    expose: true,
    conflict: payload,
  });
}

async function loadAssignedTag(
  db: ReaderCredentialLinkDb,
  schoolId: string,
  tagId: string,
) {
  const tag = await db.nfcTag.findFirst({
    where: { id: tagId, schoolId },
    include: {
      student: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          admissionNumber: true,
        },
      },
    },
  });

  if (!tag) throw Object.assign(new Error("NFC tag not found."), { status: 404 });
  if (tag.status !== "ASSIGNED" || !tag.studentId || !tag.student) {
    throw Object.assign(new Error("Only assigned wristbands can link a reader credential."), { status: 409 });
  }
  return tag;
}

async function loadCaptureReader(
  db: ReaderCredentialLinkDb,
  schoolId: string,
  deviceId: string,
) {
  const device = await db.nfcOfflineDevice.findFirst({
    where: {
      schoolId,
      ...buildDeviceIdentityWhere(deviceId),
    },
    orderBy: RECENT_DEVICE_ORDER_BY,
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
  }) as CaptureReaderDevice | null;

  if (!device) throw Object.assign(new Error("Attendance reader not found."), { status: 404 });
  if (!isActiveAttendanceCapableReader(device)) {
    throw Object.assign(new Error("Only active attendance readers can capture wristband credentials."), { status: 409 });
  }
  if (!isReaderAvailableForCredentialCapture(device)) {
    throw Object.assign(new Error("Selected attendance reader is offline. Choose the online reader and try again."), { status: 409 });
  }
  return device;
}

async function auditAction(
  db: ReaderCredentialLinkDb,
  ctx: ReaderCredentialLinkContext,
  action: string,
  details: Record<string, unknown>,
) {
  if (!ctx.schoolId) return;
  await db.auditLog.create({
    data: {
      schoolId: ctx.schoolId,
      action,
      details: {
        ...details,
        actor: {
          id: ctx.actorId ?? null,
          role: ctx.role ?? null,
        },
      },
    },
  });
}

export async function startReaderCredentialCapture(
  ctx: ReaderCredentialLinkContext,
  input: { tagId: string; deviceId?: string | null; expiresInSeconds?: number | null },
  db: ReaderCredentialLinkDb = defaultPrisma,
) {
  const schoolId = requireSchoolId(ctx);
  requireTagManager(ctx);
  return runWrite(db, async (tx) => {
    await cleanExpiredSessions(tx, schoolId);

    const activeConflict = await loadActiveCaptureSession(tx, schoolId);
    if (activeConflict) {
      throw Object.assign(new Error("Another reader credential capture is already active for this school."), { status: 409 });
    }

    const tag = await loadAssignedTag(tx, schoolId, input.tagId);
    const reader = input.deviceId ? await loadCaptureReader(tx, schoolId, input.deviceId) : null;

    const expiresInSeconds = Math.min(
      MAX_CAPTURE_EXPIRY_SECONDS,
      Math.max(MIN_CAPTURE_EXPIRY_SECONDS, input.expiresInSeconds ?? DEFAULT_CAPTURE_EXPIRY_SECONDS),
    );
    const now = new Date();
    const expiresAt = new Date(now.getTime() + expiresInSeconds * 1000);

    const session = await tx.readerCredentialCaptureSession.create({
      data: {
        id: randomUUID(),
        schoolId,
        tagId: tag.id,
        studentId: tag.studentId!,
        deviceId: reader?.id ?? null,
        deviceLabel: reader ? formatAttendanceReaderLabel(reader) : null,
        status: "PENDING",
        activeSchoolId: schoolId,
        expiresAt,
        capturedCredentialJson: null,
      },
    }) as ReaderCredentialCaptureSessionRow;

    await auditAction(tx, ctx, "nfc_tag.reader_capture_started", {
      captureId: session.id,
      tagId: tag.id,
      studentId: tag.studentId,
      deviceId: session.deviceId,
      expiresAt: session.expiresAt.toISOString(),
    });

    return {
      ...serializeCaptureSession(session),
      tag: {
        id: tag.id,
        publicCode: tag.publicCode,
        label: tag.label,
        student: {
          id: tag.student.id,
          name: `${tag.student.firstName} ${tag.student.lastName}`.trim(),
          admissionNumber: tag.student.admissionNumber,
        },
      },
    };
  });
}

export async function getReaderCredentialCapture(
  ctx: ReaderCredentialLinkContext,
  captureId: string,
  db: ReaderCredentialLinkDb = defaultPrisma,
) {
  const schoolId = requireSchoolId(ctx);
  requireTagManager(ctx);
  await cleanExpiredSessions(db, schoolId);
  const session = await loadCaptureSession(db, schoolId, captureId);
  return serializeCaptureSession(session);
}

export async function cancelReaderCredentialCapture(
  ctx: ReaderCredentialLinkContext,
  captureId: string,
  db: ReaderCredentialLinkDb = defaultPrisma,
) {
  const schoolId = requireSchoolId(ctx);
  requireTagManager(ctx);
  return runWrite(db, async (tx) => {
    await cleanExpiredSessions(tx, schoolId);
    const session = await tx.readerCredentialCaptureSession.findFirst({
      where: { id: captureId, schoolId },
    }) as ReaderCredentialCaptureSessionRow | null;
    if (!session) {
      return { ok: true, captureId, status: "CANCELLED" as const };
    }
    if (session.status !== "CANCELLED" && session.status !== "CONFIRMED") {
      await tx.readerCredentialCaptureSession.update({
        where: { id: session.id },
        data: {
          status: "CANCELLED",
          activeSchoolId: null,
          cancelledAt: new Date(),
        },
      });
    }
    await auditAction(tx, ctx, "nfc_tag.reader_capture_cancelled", {
      captureId,
      tagId: session.tagId,
      studentId: session.studentId,
      deviceId: session.deviceId,
    });
    return { ok: true, captureId, status: "CANCELLED" as const };
  });
}

export async function captureReaderCredentialFromReader(
  device: CaptureReaderDevice,
  body: {
    credential?: string | null;
    credentialUID?: string | null;
    rawWiegandDecimal?: string | null;
    rawWiegandHex?: string | null;
    facilityCode?: string | null;
    cardNumber?: string | null;
  },
  db: ReaderCredentialLinkDb = defaultPrisma,
) {
  await cleanExpiredSessions(db, device.schoolId);

  const activeSession = await db.readerCredentialCaptureSession.findFirst({
    where: {
      schoolId: device.schoolId,
      activeSchoolId: device.schoolId,
      status: { in: ["PENDING", "CAPTURED"] },
      OR: [
        { deviceId: null },
        { deviceId: device.id },
      ],
    },
    orderBy: { createdAt: "desc" },
  }) as ReaderCredentialCaptureSessionRow | null;

  if (!activeSession) return null;

  if (activeSession.status === "CAPTURED" && activeSession.capturedCredentialJson) {
    return serializeCaptureSession(activeSession);
  }

  const aliases = buildReaderCredentialAliases(buildCaptureInput(body));
  if (!aliases.canonical) {
    return null;
  }

  const updated = await db.readerCredentialCaptureSession.update({
    where: { id: activeSession.id },
    data: {
      status: "CAPTURED",
      capturedAt: new Date(),
      capturedReaderId: device.id,
      capturedReaderName: formatAttendanceReaderLabel(device),
      capturedCredentialJson: {
        canonical: aliases.canonical,
        aliases: aliases.aliases,
        strongAliases: aliases.strongAliases,
        weakAliases: aliases.weakAliases,
        aliasSource: aliases.aliasSource,
        credential: body.credentialUID ?? body.credential ?? null,
        rawWiegandDecimal: body.rawWiegandDecimal ?? null,
        rawWiegandHex: body.rawWiegandHex ?? null,
        facilityCode: body.facilityCode ?? null,
        cardNumber: body.cardNumber ?? null,
        capturedAt: new Date().toISOString(),
        readerId: device.id,
        readerName: formatAttendanceReaderLabel(device),
      },
    },
  }) as ReaderCredentialCaptureSessionRow;

  return serializeCaptureSession(updated);
}

async function findCredentialConflict(
  db: ReaderCredentialLinkDb,
  schoolId: string,
  captured: CapturedReaderCredential,
  targetStudentId: string,
) {
  const candidateAliases = captured.strongAliases.length > 0 ? captured.strongAliases : captured.weakAliases;
  const candidateStrength = captured.strongAliases.length > 0 ? "STRONG" as const : "WEAK" as const;
  if (candidateAliases.length === 0) return null;

  const matches = await db.studentCredential.findMany({
    where: {
      schoolId,
      type: CredentialType.NFC_WRISTBAND,
      status: CredentialStatus.ACTIVE,
      credentialUID: { in: candidateAliases },
      studentId: { not: targetStudentId },
    },
    include: {
      student: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          admissionNumber: true,
        },
      },
    },
  });

  const uniqueStudentIds = [...new Set(matches.map((item) => item.studentId))];
  if (candidateStrength === "WEAK" && uniqueStudentIds.length !== 1) {
    return null;
  }

  const conflictingCredential = matches[0];
  if (!conflictingCredential) return null;

  const previousTag = await db.nfcTag.findFirst({
    where: {
      schoolId,
      studentId: conflictingCredential.studentId,
    },
    select: {
      id: true,
      label: true,
      publicCode: true,
      physicalUid: true,
    },
  });

  const matchedAlias = candidateAliases.find((alias) => alias === conflictingCredential.credentialUID) ?? conflictingCredential.credentialUID;
  return {
    credential: conflictingCredential,
    payload: {
      code: "READER_CREDENTIAL_CONFLICT" as const,
      message: "Reader credential is already linked to another active student. Review the existing assignment or transfer it if this wristband was intentionally reassigned.",
      previousStudent: namedStudent(conflictingCredential.student),
      previousCredential: {
        status: conflictingCredential.status,
        maskedCredential: maskCredentialValue(conflictingCredential.credentialUID),
      },
      previousTag: previousTag ? {
        label: previousTag.label,
        publicCodePrefix: previousTag.publicCode.slice(0, 8),
        physicalUidMatched: previousTag.physicalUid === conflictingCredential.credentialUID,
      } : null,
      matchedAliasMasked: maskCredentialValue(matchedAlias),
      matchedAliasSource: captured.aliasSource[matchedAlias] ?? null,
      matchedAliasStrength: candidateStrength,
      canTransfer: true,
    },
  };
}

async function upsertLinkedCredentialForTarget(
  tx: ReaderCredentialLinkDb,
  ctx: ReaderCredentialLinkContext,
  schoolId: string,
  studentId: string,
  canonicalCredential: string,
) {
  const activeCredential = await tx.studentCredential.findFirst({
    where: {
      schoolId,
      studentId,
      type: CredentialType.NFC_WRISTBAND,
      status: CredentialStatus.ACTIVE,
    },
  });

  const recycledCredential = activeCredential
    ? null
    : await tx.studentCredential.findFirst({
        where: {
          schoolId,
          studentId,
          type: CredentialType.NFC_WRISTBAND,
          credentialUID: canonicalCredential,
          status: CredentialStatus.DEACTIVATED,
        },
      });

  return activeCredential
    ? tx.studentCredential.update({
        where: { id: activeCredential.id },
        data: { credentialUID: canonicalCredential },
      })
    : recycledCredential
      ? tx.studentCredential.update({
          where: { id: recycledCredential.id },
          data: {
            credentialUID: canonicalCredential,
            status: CredentialStatus.ACTIVE,
            issuedAt: new Date(),
            deactivatedAt: null,
            deactivatedReason: null,
            scanToken: recycledCredential.scanToken ?? generateCredentialScanToken(),
            issuedById: ctx.actorId ?? null,
          },
        })
      : tx.studentCredential.create({
          data: {
            schoolId,
            studentId,
            type: CredentialType.NFC_WRISTBAND,
            credentialUID: canonicalCredential,
            scanToken: generateCredentialScanToken(),
            issuedById: ctx.actorId ?? null,
          },
        });
}

export async function confirmReaderCredentialLink(
  ctx: ReaderCredentialLinkContext,
  captureId: string,
  db: ReaderCredentialLinkDb = defaultPrisma,
) {
  const schoolId = requireSchoolId(ctx);
  requireTagManager(ctx);
  return runWrite(db, async (tx) => {
    await cleanExpiredSessions(tx, schoolId);

    const session = await loadCaptureSession(tx, schoolId, captureId);
    if (session.status === "EXPIRED") {
      throw Object.assign(new Error("Capture session expired. Start a new capture and tap again."), { status: 409 });
    }
    if (!session.capturedCredentialJson) {
      throw Object.assign(new Error("No reader credential has been captured yet."), { status: 409 });
    }

    const captured = session.capturedCredentialJson;
    const tag = await loadAssignedTag(tx, schoolId, session.tagId);
    if (tag.studentId !== session.studentId) {
      throw Object.assign(new Error("This wristband assignment changed while capture was in progress."), { status: 409 });
    }

    const conflictingCredential = await findCredentialConflict(tx, schoolId, captured, tag.studentId!);
    if (conflictingCredential) {
      throw readerCredentialConflict(conflictingCredential.payload);
    }

    const conflictingTag = await tx.nfcTag.findFirst({
      where: {
        schoolId,
        id: { not: tag.id },
        physicalUid: { in: captured.strongAliases.length > 0 ? captured.strongAliases : captured.weakAliases },
      },
    });
    if (conflictingTag) {
      throw Object.assign(new Error("This reader credential is already linked to another wristband."), { status: 409 });
    }

    const linkedCredential = await upsertLinkedCredentialForTarget(tx, ctx, schoolId, tag.studentId!, captured.canonical);

    const updatedTag = await tx.nfcTag.update({
      where: { id: tag.id },
      data: { physicalUid: captured.canonical },
      include: {
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            admissionNumber: true,
          },
        },
      },
    });

    const confirmedAt = new Date();
    await tx.readerCredentialCaptureSession.update({
      where: { id: session.id },
      data: {
        status: "CONFIRMED",
        activeSchoolId: null,
        confirmedAt,
      },
    });

    await tx.auditLog.create({
      data: {
        schoolId,
        action: "nfc_tag.reader_credential_linked",
        details: {
          captureId: session.id,
          tagId: updatedTag.id,
          studentId: updatedTag.studentId,
          readerId: captured.readerId,
          readerName: captured.readerName,
          canonicalMasked: maskCredentialValue(captured.canonical),
          aliasMasked: captured.aliases.map((value) => maskCredentialValue(value)).filter(Boolean),
          capturedAt: captured.capturedAt,
          actor: {
            id: ctx.actorId ?? null,
            role: ctx.role ?? null,
          },
          linkedStudentCredentialId: linkedCredential.id,
        },
      },
    });

    return {
      ok: true,
      captureId: session.id,
      maskedCanonicalCredential: maskCredentialValue(captured.canonical),
      credentialId: linkedCredential.id,
      tag: {
        id: updatedTag.id,
        publicCode: updatedTag.publicCode,
        physicalUid: updatedTag.physicalUid,
        studentId: updatedTag.studentId,
        student: updatedTag.student
          ? {
              id: updatedTag.student.id,
              name: `${updatedTag.student.firstName} ${updatedTag.student.lastName}`.trim(),
              admissionNumber: updatedTag.student.admissionNumber,
            }
          : null,
      },
    };
  });
}

export async function transferReaderCredentialLink(
  ctx: ReaderCredentialLinkContext,
  captureId: string,
  reason: string,
  db: ReaderCredentialLinkDb = defaultPrisma,
) {
  const schoolId = requireSchoolId(ctx);
  requireTagManager(ctx);
  if (ctx.role !== "ADMIN_OPERATOR") {
    throw Object.assign(new Error("Only administrators can transfer a reader credential."), { status: 403 });
  }

  const cleanReason = reason.trim();
  if (!cleanReason) {
    throw Object.assign(new Error("Transfer reason is required."), { status: 400 });
  }

  return runWrite(db, async (tx) => {
    await cleanExpiredSessions(tx, schoolId);
    const session = await loadCaptureSession(tx, schoolId, captureId);
    if (!session.capturedCredentialJson) {
      throw Object.assign(new Error("No reader credential has been captured yet."), { status: 409 });
    }

    const captured = session.capturedCredentialJson;
    const tag = await loadAssignedTag(tx, schoolId, session.tagId);
    const conflict = await findCredentialConflict(tx, schoolId, captured, tag.studentId!);
    if (!conflict) {
      throw Object.assign(new Error("No transferable reader credential conflict was found."), { status: 409 });
    }

    const previousTag = conflict.payload.previousTag?.physicalUidMatched
      ? await tx.nfcTag.findFirst({
          where: {
            schoolId,
            studentId: conflict.credential.studentId,
            physicalUid: conflict.credential.credentialUID,
          },
        })
      : null;

    await tx.studentCredential.update({
      where: { id: conflict.credential.id },
      data: {
        status: CredentialStatus.DEACTIVATED,
        deactivatedAt: new Date(),
        deactivatedReason: cleanReason,
      },
    });

    if (previousTag?.physicalUid === conflict.credential.credentialUID) {
      await tx.nfcTag.update({
        where: { id: previousTag.id },
        data: { physicalUid: null },
      });
    }

    const linkedCredential = await upsertLinkedCredentialForTarget(tx, ctx, schoolId, tag.studentId!, captured.canonical);
    const updatedTag = await tx.nfcTag.update({
      where: { id: tag.id },
      data: { physicalUid: captured.canonical },
      include: {
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            admissionNumber: true,
          },
        },
      },
    });

    await tx.readerCredentialCaptureSession.update({
      where: { id: session.id },
      data: {
        status: "CONFIRMED",
        activeSchoolId: null,
        confirmedAt: new Date(),
      },
    });

    await tx.auditLog.create({
      data: {
        schoolId,
        action: "nfc_tag.reader_credential_transferred",
        details: {
          captureId: session.id,
          reason: cleanReason,
          previousStudentId: conflict.credential.studentId,
          previousCredentialId: conflict.credential.id,
          previousTagId: previousTag?.id ?? null,
          newStudentId: updatedTag.studentId,
          newTagId: updatedTag.id,
          canonicalMasked: maskCredentialValue(captured.canonical),
          matchedAliasMasked: conflict.payload.matchedAliasMasked,
          matchedAliasSource: conflict.payload.matchedAliasSource,
          matchedAliasStrength: conflict.payload.matchedAliasStrength,
          actor: {
            id: ctx.actorId ?? null,
            role: ctx.role ?? null,
          },
        },
      },
    });

    return {
      ok: true,
      transfer: true,
      captureId: session.id,
      reason: cleanReason,
      previousStudent: conflict.payload.previousStudent,
      tag: {
        id: updatedTag.id,
        publicCode: updatedTag.publicCode,
        physicalUid: updatedTag.physicalUid,
        studentId: updatedTag.studentId,
        student: updatedTag.student ? namedStudent(updatedTag.student) : null,
      },
      credentialId: linkedCredential.id,
    };
  });
}

export function __resetReaderCredentialCaptureSessionsForTests() {
  // no-op: capture sessions are persisted in the database
}
