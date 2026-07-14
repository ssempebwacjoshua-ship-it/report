import { createHash, randomBytes } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import { buildDeviceIdentityWhere, RECENT_DEVICE_ORDER_BY } from "../utils/deviceIdentity";
import { getReaderGatewayCanonicalApiBaseUrl } from "../config/readerGatewayCanonicalConfig";

type RegistrationDb = Pick<PrismaClient, "school" | "nfcOfflineDevice" | "auditLog" | "$transaction">;

type RegistrationInput = {
  deviceId: string;
  readerId: string;
  schoolCode?: string;
  location?: string;
  readerType?: "GATE" | "CLASSROOM";
  deviceName?: string;
  firmwareVersion?: string;
  firmwareChannel?: string;
  deviceTime?: string;
  transport?: string;
  schemaVersion?: string;
  hardware?: string;
};

type ActivationInput = {
  activationCode: string;
  hardwareId: string;
  deviceId: string;
  readerId: string;
  firmwareVersion?: string;
  firmwareChannel?: string;
  transport?: string;
  schemaVersion?: string;
  hardware?: string;
};

type ExistingDevice = {
  id: string;
  schoolId: string;
  deviceKey: string;
  deviceTokenHash: string | null;
  name: string;
  location: string | null;
  locationType: string | null;
  status: string;
  isActive: boolean;
};

type SchoolSummary = {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
};

type RegistrationAuth =
  | { kind: "device"; device: ExistingDevice; tokenHash: string }
  | { kind: "provisioning"; tokenHash: string };

export type ReaderGatewayRegistrationResult = {
  deviceId: string;
  readerId: string;
  schoolId: string;
  schoolName: string;
  assignmentStatus: "ASSIGNED";
  bearerToken?: string;
  apiBaseUrl: string;
  firmwareChannel: string;
  deviceName?: string;
  location?: string;
  readerType?: "GATE" | "CLASSROOM";
};

const FAILED_ATTEMPT_LIMIT = 5;
const FAILED_ATTEMPT_WINDOW_MS = 10 * 60 * 1000;
const failedRegistrationAttempts = new Map<string, number[]>();
const failedActivationAttempts = new Map<string, number[]>();

function normalizeCode(value: string) {
  return value.trim().toUpperCase();
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function generateDeviceToken() {
  return randomBytes(32).toString("base64url");
}

function rateLimitKey(auth: RegistrationAuth, schoolCode: string | undefined, requestIp: string | undefined) {
  return [auth.kind, auth.tokenHash, normalizeCode(schoolCode ?? ""), requestIp ?? ""].join(":");
}

function assertWithinFailedAttemptLimit(key: string) {
  const now = Date.now();
  const recent = (failedRegistrationAttempts.get(key) ?? []).filter((timestamp) => now - timestamp < FAILED_ATTEMPT_WINDOW_MS);
  failedRegistrationAttempts.set(key, recent);
  if (recent.length >= FAILED_ATTEMPT_LIMIT) {
    throw Object.assign(new Error("Too many failed school-code attempts. Please retry later."), { status: 429 });
  }
}

function recordFailedAttempt(key: string) {
  const now = Date.now();
  const recent = (failedRegistrationAttempts.get(key) ?? []).filter((timestamp) => now - timestamp < FAILED_ATTEMPT_WINDOW_MS);
  recent.push(now);
  failedRegistrationAttempts.set(key, recent);
}

function clearFailedAttempts(key: string) {
  failedRegistrationAttempts.delete(key);
}

function assertWithinActivationAttemptLimit(key: string) {
  const now = Date.now();
  const recent = (failedActivationAttempts.get(key) ?? []).filter((timestamp) => now - timestamp < FAILED_ATTEMPT_WINDOW_MS);
  failedActivationAttempts.set(key, recent);
  if (recent.length >= FAILED_ATTEMPT_LIMIT) {
    throw Object.assign(new Error("Too many activation attempts. Please retry later."), { status: 429 });
  }
}

function recordFailedActivationAttempt(key: string) {
  const now = Date.now();
  const recent = (failedActivationAttempts.get(key) ?? []).filter((timestamp) => now - timestamp < FAILED_ATTEMPT_WINDOW_MS);
  recent.push(now);
  failedActivationAttempts.set(key, recent);
}

function clearFailedActivationAttempts(key: string) {
  failedActivationAttempts.delete(key);
}

function resolveLocationType(readerType: "GATE" | "CLASSROOM") {
  return readerType;
}

export async function resolveReaderGatewayRegistration(
  db: RegistrationDb,
  auth: RegistrationAuth,
  input: RegistrationInput,
  requestIp?: string,
): Promise<ReaderGatewayRegistrationResult> {
  const normalizedSchoolCode = input.schoolCode ? normalizeCode(input.schoolCode) : "";
  const deviceName = input.deviceName?.trim() || input.deviceId;
  const location = input.location?.trim() || "";
  const readerType = input.readerType ?? "GATE";
  const firmwareChannel = input.firmwareChannel?.trim() || "stable";
  const failureKey = rateLimitKey(auth, normalizedSchoolCode, requestIp);

  if (auth.kind === "device") {
    const school = await db.school.findUnique({
      where: { id: auth.device.schoolId },
      select: { id: true, code: true, name: true, isActive: true },
    }) as SchoolSummary | null;
    if (!school) {
      throw Object.assign(new Error("Assigned school was not found."), { status: 404 });
    }
    if (normalizedSchoolCode && normalizedSchoolCode !== school.code) {
      throw Object.assign(new Error("Reader already assigned; contact SSAMENJ"), { status: 409 });
    }

    await db.$transaction(async (tx) => {
      await tx.nfcOfflineDevice.update({
        where: { id: auth.device.id },
        data: {
          name: deviceName,
          location: location || auth.device.location,
          locationName: location || auth.device.location,
          locationType: resolveLocationType(readerType),
          firmwareVersion: input.firmwareVersion?.trim() || null,
          lastSeenAt: new Date(),
          lastHeartbeatAt: new Date(),
        },
      });
      await tx.auditLog.create({
        data: {
          schoolId: school.id,
          action: "reader_device.registered",
          correlationId: auth.device.deviceKey,
          details: {
            deviceId: input.deviceId,
            readerId: input.readerId,
            deviceName,
            location: location || null,
            readerType,
            firmwareVersion: input.firmwareVersion?.trim() || null,
            firmwareChannel,
            schemaVersion: input.schemaVersion ?? null,
            transport: input.transport ?? null,
            hardware: input.hardware ?? null,
            assignmentStatus: "ASSIGNED",
          },
        },
      });
    });

    return {
      deviceId: input.deviceId,
      readerId: input.readerId,
      schoolId: school.id,
      schoolName: school.name,
      assignmentStatus: "ASSIGNED",
      apiBaseUrl: getReaderGatewayCanonicalApiBaseUrl(),
      firmwareChannel,
    };
  }

  assertWithinFailedAttemptLimit(failureKey);
  if (!normalizedSchoolCode) {
    recordFailedAttempt(failureKey);
    throw Object.assign(new Error("School code not found"), { status: 404 });
  }
  if (!location) {
    throw Object.assign(new Error("Reader location is required."), { status: 400 });
  }
  if (!deviceName.trim()) {
    throw Object.assign(new Error("Device name is required."), { status: 400 });
  }

  const school = await db.school.findUnique({
    where: { code: normalizedSchoolCode },
    select: { id: true, code: true, name: true, isActive: true },
  }) as SchoolSummary | null;
  if (!school) {
    recordFailedAttempt(failureKey);
    throw Object.assign(new Error("School code not found"), { status: 404 });
  }
  if (!school.isActive) {
    recordFailedAttempt(failureKey);
    throw Object.assign(new Error("School is not active"), { status: 403 });
  }

  const existing = await db.nfcOfflineDevice.findFirst({
    where: buildDeviceIdentityWhere(input.deviceId),
    orderBy: RECENT_DEVICE_ORDER_BY,
    select: {
      id: true,
      schoolId: true,
      deviceKey: true,
      deviceTokenHash: true,
      name: true,
      location: true,
      locationType: true,
      status: true,
      isActive: true,
    },
  }) as ExistingDevice | null;

  if (existing && existing.schoolId !== school.id) {
    recordFailedAttempt(failureKey);
    throw Object.assign(new Error("Reader already assigned; contact SSAMENJ"), { status: 409 });
  }

  const oneTimeToken = generateDeviceToken();
  const oneTimeTokenHash = hashToken(oneTimeToken);

  await db.$transaction(async (tx) => {
    const device = existing
      ? await tx.nfcOfflineDevice.update({
          where: { id: existing.id },
          data: {
            name: deviceName,
            schoolId: school.id,
            location,
            locationName: location,
            locationType: resolveLocationType(readerType),
            deviceKey: input.deviceId,
            deviceTokenHash: existing.deviceTokenHash ?? oneTimeTokenHash,
            mode: "ATTENDANCE",
            status: "ACTIVE",
            roleScope: "ADMIN_OPERATOR",
            isActive: true,
            firmwareVersion: input.firmwareVersion?.trim() || null,
            lastSeenAt: new Date(),
            lastHeartbeatAt: new Date(),
          },
        })
      : await tx.nfcOfflineDevice.create({
          data: {
            schoolId: school.id,
            name: deviceName,
            location,
            locationName: location,
            locationType: resolveLocationType(readerType),
            deviceKey: input.deviceId,
            deviceTokenHash: oneTimeTokenHash,
            mode: "ATTENDANCE",
            status: "ACTIVE",
            roleScope: "ADMIN_OPERATOR",
            isActive: true,
            firmwareVersion: input.firmwareVersion?.trim() || null,
          },
        });

    await tx.auditLog.create({
      data: {
        schoolId: school.id,
        action: existing ? "reader_device.re_registered" : "reader_device.registered",
        correlationId: device.deviceKey,
        details: {
          deviceId: input.deviceId,
          readerId: input.readerId,
          schoolCode: school.code,
          deviceName,
          location,
          readerType,
          firmwareVersion: input.firmwareVersion?.trim() || null,
          firmwareChannel,
          schemaVersion: input.schemaVersion ?? null,
          transport: input.transport ?? null,
          hardware: input.hardware ?? null,
          assignmentStatus: "ASSIGNED",
          idempotent: Boolean(existing),
        },
      },
    });
  });

  clearFailedAttempts(failureKey);

  return {
    deviceId: input.deviceId,
    readerId: input.readerId,
    schoolId: school.id,
    schoolName: school.name,
    assignmentStatus: "ASSIGNED",
    bearerToken: existing?.deviceTokenHash ? undefined : oneTimeToken,
    apiBaseUrl: getReaderGatewayCanonicalApiBaseUrl(),
    firmwareChannel,
  };
}

export function authenticateReaderGatewayProvisioning(token: string | null) {
  if (!token) {
    throw Object.assign(new Error("Device bearer token required."), { status: 401 });
  }

  const configured = process.env.READER_GATEWAY_PROVISIONING_TOKEN?.trim();
  if (configured && token === configured) {
    return { kind: "provisioning" as const, tokenHash: hashToken(token) };
  }
  return null;
}

export function hashReaderGatewayToken(token: string) {
  return hashToken(token);
}

export function hashReaderGatewayActivationCode(code: string) {
  return hashToken(normalizeCode(code));
}

export function generateReaderGatewayActivationCode() {
  const raw = randomBytes(9).toString("base64url").replace(/[-_]/g, "").toUpperCase();
  return `RG-${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}`;
}

export async function activateReaderGatewayDevice(
  db: RegistrationDb,
  input: ActivationInput,
  requestIp?: string,
): Promise<ReaderGatewayRegistrationResult> {
  const activationCode = normalizeCode(input.activationCode);
  const hardwareId = input.hardwareId.trim();
  const failureKey = [activationCode, hardwareId, requestIp ?? ""].join(":");
  assertWithinActivationAttemptLimit(failureKey);

  if (!activationCode) {
    recordFailedActivationAttempt(failureKey);
    throw Object.assign(new Error("Activation code is required."), { status: 400 });
  }
  if (!hardwareId) {
    throw Object.assign(new Error("Hardware identity is required."), { status: 400 });
  }

  const activationCodeHash = hashReaderGatewayActivationCode(activationCode);
  const now = new Date();
  const pending = await db.nfcOfflineDevice.findFirst({
    where: { activationCodeHash },
    select: {
      id: true,
      schoolId: true,
      name: true,
      location: true,
      locationType: true,
      deviceKey: true,
      provisioningStatus: true,
      activationCodeExpiresAt: true,
      activationCodeUsedAt: true,
      activationBoundHardwareId: true,
      deviceTokenHash: true,
    },
  }) as (ExistingDevice & {
    provisioningStatus: string;
    activationCodeExpiresAt: Date | null;
    activationCodeUsedAt: Date | null;
    activationBoundHardwareId: string | null;
  }) | null;

  if (!pending) {
    recordFailedActivationAttempt(failureKey);
    throw Object.assign(new Error("Activation code not found."), { status: 404 });
  }
  if (pending.activationCodeExpiresAt && pending.activationCodeExpiresAt <= now) {
    await db.nfcOfflineDevice.update({
      where: { id: pending.id },
      data: {
        provisioningStatus: "ACTIVATION_EXPIRED",
        activationLastError: "Activation code expired.",
      },
    });
    recordFailedActivationAttempt(failureKey);
    throw Object.assign(new Error("Activation code expired."), { status: 410 });
  }
  if (pending.activationCodeUsedAt) {
    recordFailedActivationAttempt(failureKey);
    throw Object.assign(new Error("Activation code already used."), { status: 409 });
  }
  if (pending.activationBoundHardwareId && pending.activationBoundHardwareId !== hardwareId) {
    recordFailedActivationAttempt(failureKey);
    throw Object.assign(new Error("Reader already assigned; contact SSAMENJ"), { status: 409 });
  }

  const school = await db.school.findUnique({
    where: { id: pending.schoolId },
    select: { id: true, code: true, name: true, isActive: true },
  }) as SchoolSummary | null;
  if (!school) {
    throw Object.assign(new Error("Assigned school was not found."), { status: 404 });
  }
  if (!school.isActive) {
    await db.nfcOfflineDevice.update({
      where: { id: pending.id },
      data: {
        provisioningStatus: "ACTIVATION_FAILED",
        activationFailedAttempts: { increment: 1 },
        activationLastFailedAt: now,
        activationLastError: "School is not active.",
      },
    });
    recordFailedActivationAttempt(failureKey);
    throw Object.assign(new Error("School is not active"), { status: 403 });
  }

  const oneTimeToken = generateDeviceToken();
  const oneTimeTokenHash = hashToken(oneTimeToken);
  const canonicalDeviceId = pending.id;
  const canonicalReaderId = pending.id;

  await db.$transaction(async (tx) => {
    const claimed = await tx.nfcOfflineDevice.updateMany({
      where: {
        id: pending.id,
        activationCodeHash,
        activationCodeUsedAt: null,
        provisioningStatus: { in: ["PENDING_SETUP", "ACTIVATION_FAILED", "ACTIVATION_EXPIRED"] },
        OR: [
          { activationBoundHardwareId: null },
          { activationBoundHardwareId: hardwareId },
        ],
      },
      data: {
        deviceKey: hardwareId,
        deviceTokenHash: oneTimeTokenHash,
        provisioningStatus: "ACTIVE",
        activationCodeUsedAt: now,
        activationBoundHardwareId: hardwareId,
        activationFailedAttempts: 0,
        activationLastFailedAt: null,
        activationLastError: null,
        status: "ACTIVE",
        isActive: true,
        firmwareVersion: input.firmwareVersion?.trim() || null,
        lastSeenAt: now,
        lastHeartbeatAt: now,
      },
    });

    if (claimed.count !== 1) {
      throw Object.assign(new Error("Activation code already used."), { status: 409 });
    }

    await tx.auditLog.create({
      data: {
        schoolId: school.id,
        action: "reader_device.activated",
        correlationId: hardwareId,
        details: {
          deviceId: canonicalDeviceId,
          readerId: canonicalReaderId,
          hardwareId,
          deviceName: pending.name,
          location: pending.location ?? null,
          readerType: pending.locationType ?? null,
          firmwareVersion: input.firmwareVersion?.trim() || null,
          firmwareChannel: input.firmwareChannel?.trim() || "stable",
          schemaVersion: input.schemaVersion ?? null,
          transport: input.transport ?? null,
          hardware: input.hardware ?? null,
          assignmentStatus: "ASSIGNED",
        },
      },
    });
  });

  clearFailedActivationAttempts(failureKey);

  return {
    deviceId: canonicalDeviceId,
    readerId: canonicalReaderId,
    schoolId: school.id,
    schoolName: school.name,
    assignmentStatus: "ASSIGNED",
    bearerToken: oneTimeToken,
    apiBaseUrl: getReaderGatewayCanonicalApiBaseUrl(),
    firmwareChannel: input.firmwareChannel?.trim() || "stable",
    deviceName: pending.name,
    location: pending.location ?? undefined,
    readerType: pending.locationType === "CLASSROOM" ? "CLASSROOM" : "GATE",
  };
}
