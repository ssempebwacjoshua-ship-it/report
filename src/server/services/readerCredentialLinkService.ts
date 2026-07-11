import type { PrismaClient } from "@prisma/client";
import { CredentialStatus, CredentialType } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { prisma as defaultPrisma } from "../db/prisma";
import { hasPermission } from "../../shared/permissions";
import {
  buildReaderCredentialAliases,
  maskCredentialValue,
  type CredentialNormalizationInput,
} from "../../shared/utils/credentialNormalization";
import { generateCredentialScanToken } from "./studentCredentialService";

type ReaderCredentialLinkContext = {
  schoolId?: string | null;
  actorId?: string | null;
  role?: string | null;
};

type ReaderCredentialLinkDb = Pick<
  PrismaClient,
  "nfcTag" | "studentCredential" | "nfcOfflineDevice" | "auditLog"
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
  isActive: boolean;
  status: string;
};

type CapturedReaderCredential = {
  canonical: string;
  aliases: string[];
  credential: string | null;
  rawWiegandDecimal: string | null;
  rawWiegandHex: string | null;
  facilityCode: string | null;
  cardNumber: string | null;
  capturedAt: string;
  readerId: string;
  readerName: string;
};

type ReaderCredentialCaptureSession = {
  id: string;
  schoolId: string;
  tagId: string;
  studentId: string;
  deviceId: string | null;
  deviceLabel: string | null;
  createdAt: string;
  expiresAt: string;
  confirmedAt: string | null;
  captured: CapturedReaderCredential | null;
};

const ACTIVE_CAPTURE_STATUSES = new Set(["PENDING", "CAPTURED"]);
const DEFAULT_CAPTURE_EXPIRY_SECONDS = 90;
const MAX_CAPTURE_EXPIRY_SECONDS = 180;
const MIN_CAPTURE_EXPIRY_SECONDS = 15;
const captureSessions = new Map<string, ReaderCredentialCaptureSession>();

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

function cleanExpiredSessions(now = Date.now()) {
  for (const [captureId, session] of captureSessions.entries()) {
    if (session.confirmedAt) continue;
    if (new Date(session.expiresAt).getTime() <= now) {
      captureSessions.delete(captureId);
    }
  }
}

function sessionStatus(session: ReaderCredentialCaptureSession, now = Date.now()) {
  if (session.confirmedAt) return "CONFIRMED" as const;
  if (new Date(session.expiresAt).getTime() <= now) return "EXPIRED" as const;
  return session.captured ? "CAPTURED" as const : "PENDING" as const;
}

function serializeCaptureSession(session: ReaderCredentialCaptureSession) {
  return {
    captureId: session.id,
    tagId: session.tagId,
    studentId: session.studentId,
    deviceId: session.deviceId,
    deviceLabel: session.deviceLabel,
    createdAt: session.createdAt,
    expiresAt: session.expiresAt,
    confirmedAt: session.confirmedAt,
    status: sessionStatus(session),
    preview: session.captured
      ? {
          maskedCanonicalCredential: maskCredentialValue(session.captured.canonical),
          maskedAliases: session.captured.aliases.map((value) => maskCredentialValue(value)).filter(Boolean),
          credential: maskCredentialValue(session.captured.credential),
          rawWiegandDecimal: maskCredentialValue(session.captured.rawWiegandDecimal),
          rawWiegandHex: maskCredentialValue(session.captured.rawWiegandHex),
          facilityCode: maskCredentialValue(session.captured.facilityCode),
          cardNumber: maskCredentialValue(session.captured.cardNumber),
          capturedAt: session.captured.capturedAt,
          readerId: session.captured.readerId,
          readerName: session.captured.readerName,
        }
      : null,
  };
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
      OR: [{ id: deviceId }, { deviceKey: deviceId }],
    },
    select: {
      id: true,
      schoolId: true,
      name: true,
      deviceKey: true,
      mode: true,
      location: true,
      locationName: true,
      isActive: true,
      status: true,
    },
  }) as CaptureReaderDevice | null;

  if (!device) throw Object.assign(new Error("Attendance reader not found."), { status: 404 });
  if (device.mode !== "ATTENDANCE" || !device.isActive || device.status !== "ACTIVE") {
    throw Object.assign(new Error("Only active attendance readers can capture wristband credentials."), { status: 409 });
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
  cleanExpiredSessions();

  const activeConflict = [...captureSessions.values()].find((session) =>
    session.schoolId === schoolId && ACTIVE_CAPTURE_STATUSES.has(sessionStatus(session)));
  if (activeConflict) {
    throw Object.assign(new Error("Another reader credential capture is already active for this school."), { status: 409 });
  }

  const tag = await loadAssignedTag(db, schoolId, input.tagId);
  const reader = input.deviceId ? await loadCaptureReader(db, schoolId, input.deviceId) : null;

  const expiresInSeconds = Math.min(
    MAX_CAPTURE_EXPIRY_SECONDS,
    Math.max(MIN_CAPTURE_EXPIRY_SECONDS, input.expiresInSeconds ?? DEFAULT_CAPTURE_EXPIRY_SECONDS),
  );
  const now = new Date();
  const expiresAt = new Date(now.getTime() + expiresInSeconds * 1000);

  const session: ReaderCredentialCaptureSession = {
    id: randomUUID(),
    schoolId,
    tagId: tag.id,
    studentId: tag.studentId!,
    deviceId: reader?.id ?? null,
    deviceLabel: reader ? (reader.locationName ?? reader.location ?? reader.name) : null,
    createdAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    confirmedAt: null,
    captured: null,
  };

  captureSessions.set(session.id, session);
  await auditAction(db, ctx, "nfc_tag.reader_capture_started", {
    captureId: session.id,
    tagId: tag.id,
    studentId: tag.studentId,
    deviceId: session.deviceId,
    expiresAt: session.expiresAt,
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
}

export async function getReaderCredentialCapture(
  ctx: ReaderCredentialLinkContext,
  captureId: string,
) {
  const schoolId = requireSchoolId(ctx);
  requireTagManager(ctx);
  cleanExpiredSessions();

  const session = captureSessions.get(captureId);
  if (!session || session.schoolId !== schoolId) {
    throw Object.assign(new Error("Capture session not found."), { status: 404 });
  }

  return serializeCaptureSession(session);
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
) {
  cleanExpiredSessions();

  const activeSession = [...captureSessions.values()]
    .filter((session) =>
      session.schoolId === device.schoolId
      && sessionStatus(session) === "PENDING"
      && (!session.deviceId || session.deviceId === device.id))
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())[0];

  if (!activeSession) return null;

  const aliases = buildReaderCredentialAliases(buildCaptureInput(body));
  if (!aliases.canonical) {
    return null;
  }

  activeSession.captured = {
    canonical: aliases.canonical,
    aliases: aliases.aliases,
    credential: body.credentialUID ?? body.credential ?? null,
    rawWiegandDecimal: body.rawWiegandDecimal ?? null,
    rawWiegandHex: body.rawWiegandHex ?? null,
    facilityCode: body.facilityCode ?? null,
    cardNumber: body.cardNumber ?? null,
    capturedAt: new Date().toISOString(),
    readerId: device.id,
    readerName: device.locationName ?? device.location ?? device.name,
  };

  return serializeCaptureSession(activeSession);
}

export async function confirmReaderCredentialLink(
  ctx: ReaderCredentialLinkContext,
  captureId: string,
  db: ReaderCredentialLinkDb = defaultPrisma,
) {
  const schoolId = requireSchoolId(ctx);
  requireTagManager(ctx);
  cleanExpiredSessions();

  const session = captureSessions.get(captureId);
  if (!session || session.schoolId !== schoolId) {
    throw Object.assign(new Error("Capture session not found."), { status: 404 });
  }
  if (sessionStatus(session) === "EXPIRED") {
    throw Object.assign(new Error("Capture session expired. Start a new capture and tap again."), { status: 409 });
  }
  if (!session.captured) {
    throw Object.assign(new Error("No reader credential has been captured yet."), { status: 409 });
  }

  const captured = session.captured;

  const result = await runWrite(db, async (tx) => {
    const tag = await loadAssignedTag(tx, schoolId, session.tagId);
    if (tag.studentId !== session.studentId) {
      throw Object.assign(new Error("This wristband assignment changed while capture was in progress."), { status: 409 });
    }

    const conflictingCredential = await tx.studentCredential.findFirst({
      where: {
        schoolId,
        type: CredentialType.NFC_WRISTBAND,
        status: CredentialStatus.ACTIVE,
        credentialUID: { in: captured.aliases },
        studentId: { not: tag.studentId! },
      },
    });
    if (conflictingCredential) {
      throw Object.assign(new Error("This reader credential is already active for another student."), { status: 409 });
    }

    const conflictingTag = await tx.nfcTag.findFirst({
      where: {
        schoolId,
        id: { not: tag.id },
        physicalUid: { in: captured.aliases },
      },
    });
    if (conflictingTag) {
      throw Object.assign(new Error("This reader credential is already linked to another wristband."), { status: 409 });
    }

    const activeCredential = await tx.studentCredential.findFirst({
      where: {
        schoolId,
        studentId: tag.studentId!,
        type: CredentialType.NFC_WRISTBAND,
        status: CredentialStatus.ACTIVE,
      },
    });

    const recycledCredential = activeCredential
      ? null
      : await tx.studentCredential.findFirst({
          where: {
            schoolId,
            studentId: tag.studentId!,
            type: CredentialType.NFC_WRISTBAND,
            credentialUID: captured.canonical,
            status: CredentialStatus.DEACTIVATED,
          },
        });

    const linkedCredential = activeCredential
      ? await tx.studentCredential.update({
          where: { id: activeCredential.id },
          data: { credentialUID: captured.canonical },
        })
      : recycledCredential
        ? await tx.studentCredential.update({
            where: { id: recycledCredential.id },
            data: {
              credentialUID: captured.canonical,
              status: CredentialStatus.ACTIVE,
              issuedAt: new Date(),
              deactivatedAt: null,
              deactivatedReason: null,
              scanToken: recycledCredential.scanToken ?? generateCredentialScanToken(),
              issuedById: ctx.actorId ?? null,
            },
          })
        : await tx.studentCredential.create({
            data: {
              schoolId,
              studentId: tag.studentId!,
              type: CredentialType.NFC_WRISTBAND,
              credentialUID: captured.canonical,
              scanToken: generateCredentialScanToken(),
              issuedById: ctx.actorId ?? null,
            },
          });

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
      tag: updatedTag,
      credentialId: linkedCredential.id,
    };
  });

  session.confirmedAt = new Date().toISOString();

  return {
    ok: true,
    captureId: session.id,
    maskedCanonicalCredential: maskCredentialValue(captured.canonical),
    credentialId: result.credentialId,
    tag: {
      id: result.tag.id,
      publicCode: result.tag.publicCode,
      physicalUid: result.tag.physicalUid,
      studentId: result.tag.studentId,
      student: result.tag.student
        ? {
            id: result.tag.student.id,
            name: `${result.tag.student.firstName} ${result.tag.student.lastName}`.trim(),
            admissionNumber: result.tag.student.admissionNumber,
          }
        : null,
    },
  };
}

export function __resetReaderCredentialCaptureSessionsForTests() {
  captureSessions.clear();
}
