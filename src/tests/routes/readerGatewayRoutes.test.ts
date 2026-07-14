import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMocks = vi.hoisted(() => ({
  nfcOfflineDeviceFindFirst: vi.fn(),
  nfcOfflineDeviceCreate: vi.fn(),
  nfcOfflineDeviceUpdate: vi.fn(),
  schoolFindUnique: vi.fn(),
  schoolNfcPolicyFindUnique: vi.fn(),
  auditLogFindFirst: vi.fn(),
  auditLogCreate: vi.fn(),
  studentCredentialFindFirst: vi.fn(),
  studentCredentialFindMany: vi.fn(),
  nfcTagFindFirst: vi.fn(),
  nfcTagFindMany: vi.fn(),
  studentFeeHoldFindFirst: vi.fn(),
  studentGateHoldFindFirst: vi.fn(),
  studentGateHoldUpdateMany: vi.fn(),
  dailyAttendanceFindFirst: vi.fn(),
  dailyAttendanceUpsert: vi.fn(),
  campusMovementEventFindFirst: vi.fn(),
  campusMovementEventCreate: vi.fn(),
  classroomAttendanceEventFindFirst: vi.fn(),
  classroomAttendanceEventCreate: vi.fn(),
  studentAttendanceEventFindFirst: vi.fn(),
  studentAttendanceEventCreate: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("../../server/db/prisma", () => ({
  prisma: {
    nfcOfflineDevice: {
      findFirst: prismaMocks.nfcOfflineDeviceFindFirst,
      create: prismaMocks.nfcOfflineDeviceCreate,
      update: prismaMocks.nfcOfflineDeviceUpdate,
    },
    school: {
      findUnique: prismaMocks.schoolFindUnique,
    },
    schoolNfcPolicy: {
      findUnique: prismaMocks.schoolNfcPolicyFindUnique,
    },
    auditLog: {
      findFirst: prismaMocks.auditLogFindFirst,
      create: prismaMocks.auditLogCreate,
    },
    studentCredential: {
      findFirst: prismaMocks.studentCredentialFindFirst,
      findMany: prismaMocks.studentCredentialFindMany,
    },
    nfcTag: {
      findFirst: prismaMocks.nfcTagFindFirst,
      findMany: prismaMocks.nfcTagFindMany,
    },
    studentFeeHold: {
      findFirst: prismaMocks.studentFeeHoldFindFirst,
    },
    studentGateHold: {
      findFirst: prismaMocks.studentGateHoldFindFirst,
      updateMany: prismaMocks.studentGateHoldUpdateMany,
    },
    dailyAttendance: {
      findFirst: prismaMocks.dailyAttendanceFindFirst,
      upsert: prismaMocks.dailyAttendanceUpsert,
    },
    campusMovementEvent: {
      findFirst: prismaMocks.campusMovementEventFindFirst,
      create: prismaMocks.campusMovementEventCreate,
    },
    classroomAttendanceEvent: {
      findFirst: prismaMocks.classroomAttendanceEventFindFirst,
      create: prismaMocks.classroomAttendanceEventCreate,
    },
    studentAttendanceEvent: {
      findFirst: prismaMocks.studentAttendanceEventFindFirst,
      create: prismaMocks.studentAttendanceEventCreate,
    },
    $transaction: prismaMocks.transaction,
  },
}));

import { readerGatewayRoutes } from "../../server/routes/readerGatewayRoutes";
import {
  __resetReaderCredentialCaptureSessionsForTests,
  startReaderCredentialCapture,
} from "../../server/services/readerCredentialLinkService";

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(readerGatewayRoutes());
  app.use((error: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(error?.status ?? 500).json({ error: error?.message ?? "Unexpected error" });
  });
  return app;
}

function device(overrides: Record<string, unknown> = {}) {
  return {
    id: "dev-1",
    schoolId: "school-1",
    deviceKey: "attendance-gate-01",
    name: "Attendance Gate 01",
    location: "Main Entrance",
    firmwareVersion: "1.0.0",
    mode: "ATTENDANCE",
    roleScope: "ADMIN_OPERATOR",
    isActive: true,
    status: "ACTIVE",
    ...overrides,
  };
}

function credential(overrides: Record<string, unknown> = {}) {
  return {
    id: "cred-1",
    studentId: "stu-1",
    credentialUID: "WB-123456",
    status: "ACTIVE",
    student: {
      id: "stu-1",
      firstName: "Jane",
      lastName: "Doe",
      isActive: true,
    },
    ...overrides,
  };
}

function eventBody(overrides: Record<string, unknown> = {}) {
  return {
    deviceId: "attendance-gate-01",
    readerId: "attendance-gate-01",
    schoolId: "school-1",
    eventId: "event-1",
    credential: "WB-123456",
    format: "wiegand34",
    deviceTime: "2026-07-10T08:00:00Z",
    firmwareVersion: "1.0.0",
    retryCount: 0,
    syncStatus: "pending",
    ...overrides,
  };
}

type LocationAwareState = {
  device: ReturnType<typeof device>;
  policy: Record<string, unknown>;
  credential: ReturnType<typeof credential> & {
    student: ReturnType<typeof credential>["student"] & {
      studentType: "DAY" | "BOARDING";
      enrollments: Array<{ classId: string | null; streamId: string | null }>;
    };
  };
  feeHolds: Array<Record<string, any>>;
  gateHolds: Array<Record<string, any>>;
  dailyAttendances: Array<Record<string, any>>;
  campusMovementEvents: Array<Record<string, any>>;
  classroomAttendanceEvents: Array<Record<string, any>>;
  nfcGateScans: Array<Record<string, any>>;
  auditLogs: Array<Record<string, any>>;
};

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

function locationAwareDevice(overrides: Record<string, unknown> = {}) {
  return device({
    locationType: "GATE",
    locationName: "Main Entrance",
    attendanceMode: "GATE_ATTENDANCE",
    studentScope: "DAY_SCHOLARS",
    classId: null,
    streamId: null,
    direction: "ENTRY",
    ...overrides,
  });
}

function locationAwareState(overrides: {
  device?: Record<string, unknown>;
  policy?: Record<string, unknown>;
  studentType?: "DAY" | "BOARDING";
  classId?: string | null;
  streamId?: string | null;
  activeFeeHold?: boolean;
  approvedGateOverride?: boolean;
} = {}): LocationAwareState {
  return {
    device: locationAwareDevice(overrides.device),
    policy: {
      schoolId: "school-1",
      timezone: "Africa/Kampala",
      duplicateWindowSeconds: 60,
      gateArrivalStart: "05:30",
      gateArrivalLateAfter: "08:00",
      gateArrivalEnd: "10:00",
      morningClassroomStart: "06:30",
      morningClassroomEnd: "10:00",
      gateDepartureStart: "14:00",
      gateDepartureEnd: "19:00",
      nightPrepStart: "18:30",
      nightPrepEnd: "22:30",
      nightPrepBoardingOnly: true,
      allowAutomaticCheckout: false,
      recordUnclassifiedScans: true,
      feeGatePolicyEnabled: Boolean(overrides.activeFeeHold || overrides.approvedGateOverride),
      ...overrides.policy,
    },
    credential: {
      ...credential(),
      student: {
        ...credential().student,
        studentType: overrides.studentType ?? "DAY",
        enrollments: [{
          classId: overrides.classId ?? "class-a",
          streamId: overrides.streamId ?? "stream-a",
        }],
      },
    },
    feeHolds: overrides.activeFeeHold ? [{
      id: "fee-hold-1",
      schoolId: "school-1",
      studentId: "stu-1",
      status: "ACTIVE",
      updatedAt: new Date("2026-07-11T00:00:00.000Z"),
    }] : [],
    gateHolds: overrides.approvedGateOverride ? [{
      id: "hold-1",
      schoolId: "school-1",
      studentId: "stu-1",
      status: "APPROVED",
      activeFrom: new Date("2026-07-11T00:00:00.000Z"),
      activeUntil: null,
      overrideUntil: null,
      overrideReason: "Office approval",
      reason: "Office approval",
      updatedAt: new Date("2026-07-11T00:00:00.000Z"),
    }] : [],
    dailyAttendances: [],
    campusMovementEvents: [],
    classroomAttendanceEvents: [],
    nfcGateScans: [],
    auditLogs: [],
  };
}

function registerBody(overrides: Record<string, unknown> = {}) {
  return {
    deviceId: "attendance-gate-01",
    readerId: "attendance-gate-01",
    schoolId: "school-1",
    schoolCode: "SCU-PREVIEW",
    location: "Main Gate",
    readerType: "GATE",
    deviceName: "Attendance Gate 01",
    firmwareVersion: "1.0.0",
    firmwareChannel: "stable",
    transport: "esp32-wiegand",
    schemaVersion: "1.0",
    hardware: "ESP32",
    ...overrides,
  };
}

function buildLocationAwareTransactionMocks(
  state: LocationAwareState,
  options: {
    failAuditCreate?: boolean;
    failDeviceUpdate?: boolean;
    firstReady?: ReturnType<typeof deferred>;
    allowFirstCommit?: ReturnType<typeof deferred>;
    firstCommitted?: ReturnType<typeof deferred>;
  } = {},
) {
  let transactionCount = 0;

  prismaMocks.nfcOfflineDeviceFindFirst.mockImplementation(async () => state.device);
  prismaMocks.schoolNfcPolicyFindUnique.mockImplementation(async () => state.policy);
  prismaMocks.studentCredentialFindFirst.mockImplementation(async () => state.credential);
  prismaMocks.nfcTagFindFirst.mockImplementation(async () => null);
  prismaMocks.studentFeeHoldFindFirst.mockImplementation(async ({ where }: { where: Record<string, any> }) =>
    state.feeHolds.find((hold) =>
      hold.schoolId === where.schoolId
      && hold.studentId === where.studentId
      && hold.status === where.status) ?? null);
  prismaMocks.auditLogFindFirst.mockImplementation(async ({ where }: { where: Record<string, any> }) => {
    const matches = state.auditLogs.filter((log) =>
      log.schoolId === where.schoolId
      && log.action === where.action
      && log.correlationId === where.correlationId);
    return matches.at(-1) ?? null;
  });

  const buildTx = (working: LocationAwareState) => ({
    schoolNfcPolicy: {
      findUnique: async () => working.policy,
    },
    studentCredential: {
      findFirst: async () => working.credential,
    },
    nfcTag: {
      findFirst: async () => null,
    },
    studentFeeHold: {
      findFirst: async ({ where }: { where: Record<string, any> }) =>
        working.feeHolds.find((hold) =>
          hold.schoolId === where.schoolId
          && hold.studentId === where.studentId
          && hold.status === where.status) ?? null,
    },
    studentGateHold: {
      findFirst: async ({ where }: { where: Record<string, any> }) =>
        working.gateHolds.find((hold) =>
          hold.schoolId === where.schoolId
          && hold.studentId === where.studentId
          && hold.status === where.status
          && (!where.OR || hold.activeFrom === null || hold.activeFrom <= where.OR[1].activeFrom.lte)
          && (!where.AND || hold.activeUntil === null || hold.activeUntil >= where.AND[0].OR[1].activeUntil.gte)) ?? null,
      updateMany: async ({ where, data }: { where: Record<string, any>; data: Record<string, any> }) => {
        const hold = working.gateHolds.find((item) =>
          item.id === where.id
          && item.schoolId === where.schoolId
          && item.studentId === where.studentId
          && item.status === where.status
          && (item.activeFrom === null || item.activeFrom <= where.OR[1].activeFrom.lte)
          && (item.activeUntil === null || item.activeUntil >= where.AND[0].OR[1].activeUntil.gte));
        if (!hold) {
          return { count: 0 };
        }
        Object.assign(hold, data);
        return { count: 1 };
      },
    },
    dailyAttendance: {
      findFirst: async ({ where }: { where: Record<string, any> }) =>
        working.dailyAttendances.find((item) =>
          item.schoolId === where.schoolId
          && item.studentId === where.studentId
          && item.attendanceDate.getTime() === where.attendanceDate.getTime()) ?? null,
      upsert: async ({ where, create }: { where: Record<string, any>; create: Record<string, any> }) => {
        const existing = working.dailyAttendances.find((item) =>
          item.schoolId === where.schoolId_studentId_attendanceDate.schoolId
          && item.studentId === where.schoolId_studentId_attendanceDate.studentId
          && item.attendanceDate.getTime() === where.schoolId_studentId_attendanceDate.attendanceDate.getTime());
        if (existing) {
          return existing;
        }
        const row = { id: `daily-${working.dailyAttendances.length + 1}`, ...create };
        working.dailyAttendances.push(row);
        return row;
      },
    },
    campusMovementEvent: {
      findFirst: async ({ where, orderBy }: { where: Record<string, any>; orderBy?: { occurredAt: "asc" | "desc" } }) => {
        const filtered = working.campusMovementEvents.filter((item) => {
          if (where.schoolId && item.schoolId !== where.schoolId) return false;
          if (where.studentId && item.studentId !== where.studentId) return false;
          if (where.readerId && item.readerId !== where.readerId) return false;
          if (where.type?.in && !where.type.in.includes(item.type)) return false;
          if (where.occurredAt?.gte && item.occurredAt < where.occurredAt.gte) return false;
          if (where.occurredAt?.lte && item.occurredAt > where.occurredAt.lte) return false;
          if (where.occurredAt?.lt && item.occurredAt >= where.occurredAt.lt) return false;
          return true;
        });
        filtered.sort((left, right) => orderBy?.occurredAt === "asc"
          ? left.occurredAt.getTime() - right.occurredAt.getTime()
          : right.occurredAt.getTime() - left.occurredAt.getTime());
        return filtered[0] ?? null;
      },
      create: async ({ data }: { data: Record<string, any> }) => {
        const row = { id: `move-${working.campusMovementEvents.length + 1}`, ...data };
        working.campusMovementEvents.push(row);
        return row;
      },
    },
    classroomAttendanceEvent: {
      findFirst: async ({ where, orderBy }: { where: Record<string, any>; orderBy?: { occurredAt: "asc" | "desc" } }) => {
        const filtered = working.classroomAttendanceEvents.filter((item) => {
          if (where.schoolId && item.schoolId !== where.schoolId) return false;
          if (where.studentId && item.studentId !== where.studentId) return false;
          if (where.readerId && item.readerId !== where.readerId) return false;
          if (where.sessionType && item.sessionType !== where.sessionType) return false;
          if (where.sessionDate && item.sessionDate.getTime() !== where.sessionDate.getTime()) return false;
          if (where.status?.in && !where.status.in.includes(item.status)) return false;
          if (where.occurredAt?.gte && item.occurredAt < where.occurredAt.gte) return false;
          if (where.occurredAt?.lte && item.occurredAt > where.occurredAt.lte) return false;
          return true;
        });
        filtered.sort((left, right) => orderBy?.occurredAt === "asc"
          ? left.occurredAt.getTime() - right.occurredAt.getTime()
          : right.occurredAt.getTime() - left.occurredAt.getTime());
        return filtered[0] ?? null;
      },
      create: async ({ data }: { data: Record<string, any> }) => {
        const row = { id: `class-${working.classroomAttendanceEvents.length + 1}`, ...data };
        working.classroomAttendanceEvents.push(row);
        return row;
      },
    },
    nfcGateScan: {
      create: async ({ data }: { data: Record<string, any> }) => {
        const row = { id: `gate-${working.nfcGateScans.length + 1}`, scannedAt: new Date("2026-07-11T10:00:00.000Z"), ...data };
        working.nfcGateScans.push(row);
        return row;
      },
    },
    auditLog: {
      create: async ({ data }: { data: Record<string, any> }) => {
        if (options.failAuditCreate) {
          throw new Error("audit create failed");
        }
        const row = { id: `audit-${working.auditLogs.length + 1}`, createdAt: new Date(), ...data };
        working.auditLogs.push(row);
        return row;
      },
    },
    nfcOfflineDevice: {
      update: async ({ data }: { data: Record<string, any> }) => {
        if (options.failDeviceUpdate) {
          throw new Error("device update failed");
        }
        Object.assign(working.device, data);
        return working.device;
      },
    },
  });

  prismaMocks.transaction.mockImplementation(async (fn: (tx: any) => Promise<unknown>) => {
    transactionCount += 1;
    const currentCall = transactionCount;
    const working = structuredClone(state) as LocationAwareState;
    const result = await fn(buildTx(working));

    if (currentCall === 1 && options.firstReady) {
      options.firstReady.resolve();
    }

    if (currentCall === 1 && options.allowFirstCommit) {
      await options.allowFirstCommit.promise;
    }

    if (currentCall > 1 && options.firstCommitted) {
      await options.firstCommitted.promise;
    }

    for (const event of working.campusMovementEvents) {
      const alreadyCommitted = state.campusMovementEvents.some((item) => item.id === event.id);
      const uniqueConflict = state.campusMovementEvents.some((item) =>
        item.schoolId === event.schoolId && item.eventId === event.eventId);
      if (!alreadyCommitted && uniqueConflict) {
        const error = Object.assign(new Error("Unique constraint failed"), {
          code: "P2002",
          meta: { target: ["schoolId", "eventId"] },
        });
        throw error;
      }
    }

    for (const event of working.classroomAttendanceEvents) {
      const alreadyCommitted = state.classroomAttendanceEvents.some((item) => item.id === event.id);
      const uniqueConflict = state.classroomAttendanceEvents.some((item) =>
        item.schoolId === event.schoolId && item.eventId === event.eventId);
      if (!alreadyCommitted && uniqueConflict) {
        const error = Object.assign(new Error("Unique constraint failed"), {
          code: "P2002",
          meta: { target: ["schoolId", "eventId"] },
        });
        throw error;
      }
    }

    state.device = working.device;
    state.feeHolds = working.feeHolds;
    state.gateHolds = working.gateHolds;
    state.dailyAttendances = working.dailyAttendances;
    state.campusMovementEvents = working.campusMovementEvents;
    state.classroomAttendanceEvents = working.classroomAttendanceEvents;
    state.nfcGateScans = working.nfcGateScans;
    state.auditLogs = working.auditLogs;

    if (currentCall === 1 && options.firstCommitted) {
      options.firstCommitted.resolve();
    }

    return result;
  });
}

describe("readerGatewayRoutes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    __resetReaderCredentialCaptureSessionsForTests();
    delete process.env.READER_GATEWAY_PROVISIONING_TOKEN;

    prismaMocks.nfcOfflineDeviceFindFirst.mockResolvedValue(device());
    prismaMocks.nfcOfflineDeviceCreate.mockResolvedValue(device());
    prismaMocks.nfcOfflineDeviceUpdate.mockResolvedValue({});
    prismaMocks.schoolFindUnique.mockResolvedValue({
      id: "school-1",
      code: "SCU-PREVIEW",
      name: "Preview School",
      isActive: true,
    });
    prismaMocks.schoolNfcPolicyFindUnique.mockResolvedValue({
      schoolId: "school-1",
      timezone: "Africa/Kampala",
      duplicateWindowSeconds: 60,
      gateArrivalStart: "05:30",
      gateArrivalLateAfter: "08:00",
      gateArrivalEnd: "10:00",
      morningClassroomStart: "06:30",
      morningClassroomEnd: "10:00",
      gateDepartureStart: "14:00",
      gateDepartureEnd: "19:00",
      nightPrepStart: "18:30",
      nightPrepEnd: "22:30",
      nightPrepBoardingOnly: true,
      allowAutomaticCheckout: false,
      recordUnclassifiedScans: true,
      feeGatePolicyEnabled: false,
    });
    prismaMocks.auditLogFindFirst.mockResolvedValue(null);
    prismaMocks.auditLogCreate.mockResolvedValue({});
    prismaMocks.studentCredentialFindFirst.mockResolvedValue(null);
    prismaMocks.studentCredentialFindMany.mockResolvedValue([credential()]);
    prismaMocks.nfcTagFindFirst.mockResolvedValue(null);
    prismaMocks.nfcTagFindMany.mockResolvedValue([]);
    prismaMocks.studentFeeHoldFindFirst.mockResolvedValue(null);
    prismaMocks.studentGateHoldFindFirst.mockResolvedValue(null);
    prismaMocks.studentGateHoldUpdateMany.mockResolvedValue({ count: 0 });
    prismaMocks.dailyAttendanceFindFirst.mockResolvedValue(null);
    prismaMocks.dailyAttendanceUpsert.mockResolvedValue({ id: "daily-1" });
    prismaMocks.campusMovementEventFindFirst.mockResolvedValue(null);
    prismaMocks.campusMovementEventCreate.mockResolvedValue({ id: "move-1" });
    prismaMocks.classroomAttendanceEventFindFirst.mockResolvedValue(null);
    prismaMocks.classroomAttendanceEventCreate.mockResolvedValue({ id: "class-1" });
    prismaMocks.studentAttendanceEventFindFirst.mockResolvedValue(null);
    prismaMocks.studentAttendanceEventCreate.mockResolvedValue({ id: "att-1" });
    prismaMocks.transaction.mockImplementation(async (fn: (tx: any) => Promise<unknown>) => {
      const tx = {
        nfcOfflineDevice: { update: prismaMocks.nfcOfflineDeviceUpdate },
        auditLog: { create: prismaMocks.auditLogCreate },
        studentAttendanceEvent: { create: prismaMocks.studentAttendanceEventCreate },
      };
      return fn(tx);
    });
    delete process.env.READER_GATEWAY_OTA_RELEASES_JSON;
  });

  it("registers a device heartbeat with bearer-token auth", async () => {
    const res = await request(buildApp())
      .post("/api/readers/register")
      .set("Authorization", "Bearer device-token-123")
      .send({
        deviceId: "attendance-gate-01",
        readerId: "attendance-gate-01",
        schoolId: "school-1",
        firmwareVersion: "1.0.0",
      });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      success: true,
      action: "REGISTER",
      status: "REGISTERED",
      message: "Reader registered",
      beep: "success",
      feedback: { beep: "success" },
    });
    expect(prismaMocks.nfcOfflineDeviceUpdate).toHaveBeenCalled();
    expect(prismaMocks.auditLogCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        action: "reader_device.registered",
        correlationId: "attendance-gate-01",
      }),
    }));
  });

  it("rejects legacy attendance readers until location-aware attendance is configured", async () => {
    const res = await request(buildApp())
      .post("/api/readers/events")
      .set("Authorization", "Bearer device-token-123")
      .send(eventBody());

    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({
      success: false,
      action: "ATTENDANCE",
      status: "MISCONFIGURED",
      message: expect.stringMatching(/configure location-aware attendance/i),
      beep: "error",
      feedback: { beep: "error" },
    });
    expect(prismaMocks.auditLogCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        action: "reader_event.attendance",
        correlationId: "event-1",
      }),
    }));
  });

  it("fails safely for legacy readers even when alternate Wiegand aliases are present", async () => {
    prismaMocks.studentCredentialFindFirst.mockResolvedValue(null);
    prismaMocks.studentCredentialFindMany.mockResolvedValue([credential({
      credentialUID: "1",
    })]);

    const res = await request(buildApp())
      .post("/api/readers/events")
      .set("Authorization", "Bearer device-token-123")
      .send(eventBody({
        credential: "786777",
        rawWiegandBitCount: 26,
        rawWiegandBinary: "10000110000000010101100101",
        rawWiegandDecimal: "35128677",
        rawWiegandHex: "2180565",
        facilityCode: "12",
        cardNumber: "1",
      }));

    expect(res.status).toBe(409);
    expect(res.body.status).toBe("MISCONFIGURED");
  });

  it("does not attempt duplicate resolution through the legacy attendance table", async () => {
    prismaMocks.studentAttendanceEventFindFirst.mockResolvedValue({ id: "att-existing" });

    const res = await request(buildApp())
      .post("/api/readers/events")
      .set("Authorization", "Bearer device-token-123")
      .send(eventBody());

    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({
      success: false,
      action: "ATTENDANCE",
      status: "MISCONFIGURED",
    });
    expect(prismaMocks.studentAttendanceEventCreate).not.toHaveBeenCalled();
  });

  it("returns a safe misconfigured response before legacy credential lookup", async () => {
    prismaMocks.studentCredentialFindFirst.mockResolvedValue(null);
    prismaMocks.studentCredentialFindMany.mockResolvedValue([]);
    prismaMocks.nfcTagFindFirst.mockResolvedValue(null);
    prismaMocks.nfcTagFindMany.mockResolvedValue([]);

    const res = await request(buildApp())
      .post("/api/readers/events")
      .set("Authorization", "Bearer device-token-123")
      .send(eventBody());

    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({
      success: false,
      action: "ATTENDANCE",
      status: "MISCONFIGURED",
      beep: "error",
    });
    expect(prismaMocks.studentAttendanceEventCreate).not.toHaveBeenCalled();
  });

  it("rejects a legacy reader scan safely without cross-school lookup attempts", async () => {
    prismaMocks.studentCredentialFindFirst.mockResolvedValue(null);
    prismaMocks.studentCredentialFindMany.mockResolvedValue([]);
    prismaMocks.nfcTagFindFirst.mockResolvedValue(null);
    prismaMocks.nfcTagFindMany.mockResolvedValue([]);

    const res = await request(buildApp())
      .post("/api/readers/events")
      .set("Authorization", "Bearer device-token-123")
      .send(eventBody({ credential: "OTHER-SCHOOL-WRISTBAND" }));

    expect(res.status).toBe(409);
    expect(res.body.status).toBe("MISCONFIGURED");
  });

  it("rejects a disabled reader", async () => {
    prismaMocks.nfcOfflineDeviceFindFirst.mockResolvedValue(device({ isActive: false, status: "REVOKED" }));

    const res = await request(buildApp())
      .post("/api/readers/events")
      .set("Authorization", "Bearer device-token-123")
      .send(eventBody({ deviceTime: "2026-07-11T04:45:00Z" }));

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/disabled/i);
  });

  it("rejects an invalid bearer token without leaking device secrets", async () => {
    prismaMocks.nfcOfflineDeviceFindFirst.mockResolvedValue(null);

    const res = await request(buildApp())
      .post("/api/readers/events")
      .set("Authorization", "Bearer invalid-token")
      .send(eventBody());

    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/invalid|token/i);
  });

  it("replays an existing correlation ID response idempotently", async () => {
    prismaMocks.auditLogFindFirst.mockResolvedValue({
      details: {
        response: {
          success: true,
          action: "ATTENDANCE",
          status: "PRESENT",
          message: "Attendance recorded",
          studentName: "Jane Doe",
          beep: "success",
          feedback: { beep: "success" },
        },
      },
    });

    const res = await request(buildApp())
      .post("/api/readers/events")
      .set("Authorization", "Bearer device-token-123")
      .send(eventBody({ deviceTime: "2026-07-11T04:45:00Z" }));

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("PRESENT");
    expect(prismaMocks.studentAttendanceEventCreate).not.toHaveBeenCalled();
  });

  it("updates heartbeat health fields", async () => {
    const res = await request(buildApp())
      .post("/api/readers/heartbeat")
      .set("Authorization", "Bearer device-token-123")
      .send({
        deviceId: "attendance-gate-01",
        readerId: "attendance-gate-01",
        schoolId: "school-1",
        firmwareVersion: "1.0.0",
        wifiRssi: -54,
        localIp: "192.168.1.51",
        uptimeMs: 60000,
        freeHeap: 204800,
        queueDepth: 0,
        lastSuccessfulApiContactAt: "2026-07-10T08:00:00Z",
      });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      success: true,
      action: "REGISTER",
      status: "REGISTERED",
      message: "Heartbeat received",
      beep: "none",
    });
    expect(prismaMocks.nfcOfflineDeviceUpdate).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "dev-1" },
      data: expect.objectContaining({
        lastHeartbeatAt: expect.any(Date),
        lastIp: "192.168.1.51",
        lastRssi: -54,
        firmwareVersion: "1.0.0",
        uptimeMs: 60000,
        freeHeap: 204800,
        queueDepth: 0,
        onlineStatus: "ONLINE",
        lastApiContactAt: new Date("2026-07-10T08:00:00Z"),
      }),
    }));
    expect(prismaMocks.auditLogCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        action: "reader_device.heartbeat",
        details: expect.objectContaining({
          deviceId: "attendance-gate-01",
          wifiRssi: -54,
          uptimeMs: 60000,
          freeHeap: 204800,
        }),
      }),
    }));
  });

  it("returns a staged OTA release for an assigned firmware channel", async () => {
    const artifactPath = path.join(os.tmpdir(), "reader-gateway-ota.bin");
    fs.writeFileSync(artifactPath, Buffer.from("firmware-binary"));
    process.env.READER_GATEWAY_OTA_RELEASES_JSON = JSON.stringify([{
      releaseId: "release-stable-101",
      version: "1.0.1",
      channel: "stable",
      sha256: "abc123",
      signature: "ZmFrZS1zaWduYXR1cmU=",
      signatureAlgorithm: "ECDSA_P256_SHA256",
      publicKeyId: "reader-gateway-2026",
      artifactPath,
      sizeBytes: fs.statSync(artifactPath).size,
    }]);

    const res = await request(buildApp())
      .post("/api/readers/ota/check")
      .set("Authorization", "Bearer device-token-123")
      .send({
        deviceId: "attendance-gate-01",
        readerId: "attendance-gate-01",
        schoolId: "school-1",
        firmwareVersion: "1.0.0",
        firmwareChannel: "stable",
        queueDepth: 0,
      });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      success: true,
      action: "OTA",
      status: "UPDATE_AVAILABLE",
      updateAvailable: true,
      releaseId: "release-stable-101",
      version: "1.0.1",
      channel: "stable",
      downloadPath: "/api/readers/ota/download/release-stable-101",
      sha256: "abc123",
      signatureAlgorithm: "ECDSA_P256_SHA256",
    });
  });

  it("serves an assigned OTA artifact only to the authenticated device", async () => {
    const artifactPath = path.join(os.tmpdir(), "reader-gateway-ota-download.bin");
    const artifact = Buffer.from("signed-firmware-image");
    fs.writeFileSync(artifactPath, artifact);
    process.env.READER_GATEWAY_OTA_RELEASES_JSON = JSON.stringify([{
      releaseId: "release-device-101",
      version: "1.0.1",
      channel: "beta",
      sha256: "abc123",
      signature: "ZmFrZS1zaWduYXR1cmU=",
      signatureAlgorithm: "ECDSA_P256_SHA256",
      publicKeyId: "reader-gateway-2026",
      artifactPath,
      sizeBytes: artifact.length,
      targetDeviceIds: ["attendance-gate-01"],
    }]);

    const res = await request(buildApp())
      .get("/api/readers/ota/download/release-device-101")
      .set("Authorization", "Bearer device-token-123")
      .set("X-Device-Id", "attendance-gate-01")
      .set("X-Reader-Id", "attendance-gate-01")
      .set("X-School-Id", "school-1")
      .set("X-Firmware-Channel", "beta");

    expect(res.status).toBe(200);
    expect(res.headers["x-firmware-version"]).toBe("1.0.1");
    expect(Buffer.from(res.body).toString()).toBe(artifact.toString());
  });

  it("records OTA status updates for audit and device health", async () => {
    prismaMocks.transaction.mockImplementation(async (fn: (tx: any) => Promise<unknown>) => {
      const tx = {
        nfcOfflineDevice: { update: prismaMocks.nfcOfflineDeviceUpdate },
        auditLog: { create: prismaMocks.auditLogCreate },
      };
      return fn(tx);
    });

    const res = await request(buildApp())
      .post("/api/readers/ota/status")
      .set("Authorization", "Bearer device-token-123")
      .send({
        deviceId: "attendance-gate-01",
        readerId: "attendance-gate-01",
        schoolId: "school-1",
        releaseId: "release-stable-101",
        firmwareVersion: "1.0.0",
        firmwareChannel: "stable",
        fromVersion: "1.0.0",
        toVersion: "1.0.1",
        status: "CONFIRMED",
        message: "OTA reboot confirmed after successful backend contact.",
      });

    expect(res.status).toBe(200);
    expect(prismaMocks.nfcOfflineDeviceUpdate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        firmwareVersion: "1.0.1",
        lastSeenAt: expect.any(Date),
        lastSyncAt: expect.any(Date),
        otaStatus: "CONFIRMED",
        otaMessage: "OTA reboot confirmed after successful backend contact.",
        onlineStatus: "ONLINE",
      }),
    }));
    expect(prismaMocks.auditLogCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        action: "reader_device.ota_status",
        details: expect.objectContaining({
          releaseId: "release-stable-101",
          status: "CONFIRMED",
        }),
      }),
    }));
  });

  it("captures a pending reader-link tap before attendance resolution", async () => {
    const captureDb = {
      nfcTag: {
        findFirst: async () => ({
          id: "tag-1",
          schoolId: "school-1",
          publicCode: "PUBCODE1234567890",
          label: "Student Wristband 1",
          status: "ASSIGNED",
          studentId: "stu-1",
          student: {
            id: "stu-1",
            firstName: "Jane",
            lastName: "Doe",
            admissionNumber: "A001",
          },
        }),
      },
      studentCredential: {
        findFirst: async () => null,
      },
      nfcOfflineDevice: {
        findFirst: async () => ({
          id: "dev-1",
          schoolId: "school-1",
          name: "Attendance Gate 01",
          deviceKey: "attendance-gate-01",
          mode: "ATTENDANCE",
          location: "Main Entrance",
          locationName: "Main Entrance",
          isActive: true,
          status: "ACTIVE",
        }),
      },
      auditLog: {
        create: async () => ({}),
      },
      $transaction: async <T>(fn: (tx: any) => Promise<T>) => fn(captureDb),
    } as never;

    await startReaderCredentialCapture(
      { schoolId: "school-1", actorId: "admin-1", role: "ADMIN_OPERATOR" },
      { tagId: "tag-1", deviceId: "dev-1" },
      captureDb,
    );

    const res = await request(buildApp())
      .post("/api/readers/events")
      .set("Authorization", "Bearer device-token-123")
      .send(eventBody({
        credential: "786777",
        rawWiegandDecimal: "35128677",
        rawWiegandHex: "02180565",
        facilityCode: "12",
        cardNumber: "1",
      }));

    expect(res.status).toBe(202);
    expect(res.body).toMatchObject({
      success: true,
      action: "LINK_CAPTURE",
      status: "CAPTURED",
      message: "Reader credential captured for linking",
      beep: "success",
    });
    expect(prismaMocks.studentAttendanceEventCreate).not.toHaveBeenCalled();
    expect(prismaMocks.nfcOfflineDeviceUpdate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        lastScanStatus: "CAPTURED",
        lastScanMessage: "Reader credential captured for linking",
      }),
    }));
  });

  it("does not process weak alias lookups through the retired legacy reader path", async () => {
    prismaMocks.studentCredentialFindFirst.mockResolvedValue(null);
    prismaMocks.studentCredentialFindMany.mockImplementation(async ({ where }: { where: { credentialUID?: { in?: string[] } } }) => {
      const weakMatch = credential({
        studentId: "stu-weak",
        student: {
          id: "stu-weak",
          firstName: "Weak",
          lastName: "Alias",
          isActive: true,
        },
        credentialUID: "001",
      });
      return where.credentialUID?.in?.includes("001") ? [weakMatch] : [];
    });
    prismaMocks.studentAttendanceEventFindFirst.mockResolvedValue(null);

    const res = await request(buildApp())
      .post("/api/readers/events")
      .set("Authorization", "Bearer device-token-123")
      .send(eventBody({
        credential: "786777",
        rawWiegandDecimal: "35128677",
        rawWiegandHex: "02180565",
        facilityCode: "12",
        cardNumber: "1",
      }));

    expect(res.status).toBe(409);
    expect(res.body.status).toBe("MISCONFIGURED");
    expect(prismaMocks.studentAttendanceEventCreate).not.toHaveBeenCalled();
  });

  it("registers an already assigned reader idempotently with its existing school", async () => {
    prismaMocks.transaction.mockImplementation(async (fn: (tx: any) => Promise<unknown>) => fn({
      nfcOfflineDevice: { update: prismaMocks.nfcOfflineDeviceUpdate },
      auditLog: { create: prismaMocks.auditLogCreate },
    }));

    const res = await request(buildApp())
      .post("/api/readers/register")
      .set("Authorization", "Bearer device-token-123")
      .send(registerBody());

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      success: true,
      action: "REGISTER",
      status: "REGISTERED",
      schoolId: "school-1",
      schoolName: "Preview School",
      assignmentStatus: "ASSIGNED",
    });
    expect(prismaMocks.nfcOfflineDeviceUpdate).toHaveBeenCalled();
  });

  it("creates and assigns a reader from a valid provisioning school code", async () => {
    process.env.READER_GATEWAY_PROVISIONING_TOKEN = "provision-token";
    prismaMocks.nfcOfflineDeviceFindFirst.mockResolvedValueOnce(null);
    prismaMocks.nfcOfflineDeviceCreate.mockResolvedValue({
      ...device(),
      deviceKey: "attendance-gate-01",
      deviceTokenHash: "hashed-token",
    });
    prismaMocks.transaction.mockImplementation(async (fn: (tx: any) => Promise<unknown>) => fn({
      nfcOfflineDevice: {
        create: prismaMocks.nfcOfflineDeviceCreate,
        update: prismaMocks.nfcOfflineDeviceUpdate,
      },
      auditLog: { create: prismaMocks.auditLogCreate },
    }));

    const res = await request(buildApp())
      .post("/api/readers/register")
      .set("Authorization", "Bearer provision-token")
      .send(registerBody({ schoolId: undefined }));

    expect(res.status).toBe(200);
    expect(res.body.schoolId).toBe("school-1");
    expect(res.body.assignmentStatus).toBe("ASSIGNED");
    expect(res.body.bearerToken).toBeTruthy();
    expect(prismaMocks.nfcOfflineDeviceCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        schoolId: "school-1",
        deviceKey: "attendance-gate-01",
        locationName: "Main Gate",
        locationType: "GATE",
      }),
    }));
  });

  it("looks up existing provisioning devices by deviceKey when the reader identity is not a UUID", async () => {
    process.env.READER_GATEWAY_PROVISIONING_TOKEN = "provision-token";
    prismaMocks.nfcOfflineDeviceFindFirst.mockResolvedValueOnce({
      ...device(),
      id: "dev-1",
      schoolId: "school-1",
      deviceKey: "attendance-gate-01",
      deviceTokenHash: "existing-token-hash",
    });
    prismaMocks.transaction.mockImplementation(async (fn: (tx: any) => Promise<unknown>) => fn({
      nfcOfflineDevice: {
        create: prismaMocks.nfcOfflineDeviceCreate,
        update: prismaMocks.nfcOfflineDeviceUpdate,
      },
      auditLog: { create: prismaMocks.auditLogCreate },
    }));

    const res = await request(buildApp())
      .post("/api/readers/register")
      .set("Authorization", "Bearer provision-token")
      .send(registerBody({ schoolId: undefined }));

    expect(res.status).toBe(200);
    expect(prismaMocks.nfcOfflineDeviceFindFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        deviceKey: "attendance-gate-01",
      },
      select: expect.any(Object),
    }));
    expect(res.body.assignmentStatus).toBe("ASSIGNED");
  });

  it("rejects an invalid provisioning school code safely", async () => {
    process.env.READER_GATEWAY_PROVISIONING_TOKEN = "provision-token";
    prismaMocks.schoolFindUnique.mockResolvedValueOnce(null);

    const res = await request(buildApp())
      .post("/api/readers/register")
      .set("Authorization", "Bearer provision-token")
      .send(registerBody({ schoolId: undefined, schoolCode: "UNKNOWN" }));

    expect(res.status).toBe(404);
    expect(res.body.error).toBe("School code not found");
  });

  it("rejects registration to an inactive school", async () => {
    process.env.READER_GATEWAY_PROVISIONING_TOKEN = "provision-token";
    prismaMocks.schoolFindUnique.mockResolvedValueOnce({
      id: "school-1",
      code: "SCU-PREVIEW",
      name: "Preview School",
      isActive: false,
    });

    const res = await request(buildApp())
      .post("/api/readers/register")
      .set("Authorization", "Bearer provision-token")
      .send(registerBody({ schoolId: undefined }));

    expect(res.status).toBe(403);
    expect(res.body.error).toBe("School is not active");
  });

  it("rejects silent reassignment attempts for an already assigned reader", async () => {
    process.env.READER_GATEWAY_PROVISIONING_TOKEN = "provision-token";
    prismaMocks.nfcOfflineDeviceFindFirst.mockResolvedValueOnce({
      ...device(),
      schoolId: "school-other",
      deviceKey: "attendance-gate-01",
    });

    const res = await request(buildApp())
      .post("/api/readers/register")
      .set("Authorization", "Bearer provision-token")
      .send(registerBody({ schoolId: undefined }));

    expect(res.status).toBe(409);
    expect(res.body.error).toBe("Reader already assigned; contact SSAMENJ");
  });
});

describe("readerGatewayRoutes location-aware atomicity", () => {
  it("commits override consumption, movement, attendance, audit, and device update together", async () => {
    const state = locationAwareState({ activeFeeHold: true, approvedGateOverride: true });
    buildLocationAwareTransactionMocks(state);

    const res = await request(buildApp())
      .post("/api/readers/events")
      .set("Authorization", "Bearer device-token-123")
      .send(eventBody({ deviceTime: "2026-07-11T04:45:00Z" }));

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      success: true,
      action: "GATE_ENTRY",
      status: "PRESENT",
      message: "Arrival recorded",
    });
    expect(state.gateHolds[0]?.status).toBe("CONSUMED");
    expect(state.campusMovementEvents.map((item) => item.type)).toEqual(["MANUAL_GATE_OVERRIDE", "GATE_ENTRY"]);
    expect(state.dailyAttendances).toHaveLength(1);
    expect(state.auditLogs).toHaveLength(1);
    expect(state.auditLogs[0]?.details?.responseStatusCode).toBe(200);
    expect(state.device.lastScanStatus).toBe("PRESENT");
  });

  it("rolls back an approved override when audit creation fails", async () => {
    const state = locationAwareState({ activeFeeHold: true, approvedGateOverride: true });
    buildLocationAwareTransactionMocks(state, { failAuditCreate: true });

    const res = await request(buildApp())
      .post("/api/readers/events")
      .set("Authorization", "Bearer device-token-123")
      .send(eventBody());

    expect(res.status).toBe(500);
    expect(state.gateHolds[0]?.status).toBe("APPROVED");
    expect(state.campusMovementEvents).toHaveLength(0);
    expect(state.dailyAttendances).toHaveLength(0);
    expect(state.auditLogs).toHaveLength(0);
  });

  it("rolls back the full location-aware write when device update fails", async () => {
    const state = locationAwareState({ activeFeeHold: true, approvedGateOverride: true });
    buildLocationAwareTransactionMocks(state, { failDeviceUpdate: true });

    const res = await request(buildApp())
      .post("/api/readers/events")
      .set("Authorization", "Bearer device-token-123")
      .send(eventBody());

    expect(res.status).toBe(500);
    expect(state.gateHolds[0]?.status).toBe("APPROVED");
    expect(state.campusMovementEvents).toHaveLength(0);
    expect(state.dailyAttendances).toHaveLength(0);
    expect(state.auditLogs).toHaveLength(0);
    expect(state.device.lastScanStatus).toBeUndefined();
  });

  it("replays the same location-aware event idempotently after success", async () => {
    const state = locationAwareState();
    buildLocationAwareTransactionMocks(state);

    const first = await request(buildApp())
      .post("/api/readers/events")
      .set("Authorization", "Bearer device-token-123")
      .send(eventBody({ deviceTime: "2026-07-11T04:45:00Z" }));
    const second = await request(buildApp())
      .post("/api/readers/events")
      .set("Authorization", "Bearer device-token-123")
      .send(eventBody({ deviceTime: "2026-07-10T04:45:00Z" }));

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(second.body).toEqual(first.body);
    expect(state.campusMovementEvents).toHaveLength(1);
    expect(state.dailyAttendances).toHaveLength(1);
    expect(state.auditLogs).toHaveLength(1);
  });

  it("logs an unknown credential as a blocked scan and still updates the device", async () => {
    const state = locationAwareState();
    state.credential = null as any;
    buildLocationAwareTransactionMocks(state);

    const res = await request(buildApp())
      .post("/api/readers/events")
      .set("Authorization", "Bearer device-token-123")
      .send(eventBody({ eventId: "unknown-event-1", credential: "UNKNOWN-WRISTBAND", deviceTime: "2026-07-11T08:30:00Z" }));

    expect([403, 404]).toContain(res.status);
    if (res.body.status) {
      expect(["UNKNOWN_CREDENTIAL", "BLOCKED"]).toContain(res.body.status);
    } else {
      expect(typeof res.body.error).toBe("string");
    }
    expect(state.nfcGateScans).toHaveLength(1);
    expect(state.nfcGateScans[0]).toMatchObject({
      schoolId: "school-1",
      studentId: null,
      credentialId: null,
      result: "BLOCKED",
      reason: "Unassigned NFC card",
    });
    expect(state.device.lastScanStatus).toBe("UNKNOWN_CREDENTIAL");
    expect(state.device.lastScanMessage).toBe("Wristband not registered");
  });

  it("returns a stored replay instead of 500 during a same-event race", async () => {
    const state = locationAwareState();
    const firstReady = deferred();
    const allowFirstCommit = deferred();
    const firstCommitted = deferred();
    buildLocationAwareTransactionMocks(state, { firstReady, allowFirstCommit, firstCommitted });

    const firstRequest = request(buildApp())
      .post("/api/readers/events")
      .set("Authorization", "Bearer device-token-123")
      .send(eventBody({ deviceTime: "2026-07-11T04:45:00Z" }))
      .then((response) => response);

    await firstReady.promise;

    const secondRequest = request(buildApp())
      .post("/api/readers/events")
      .set("Authorization", "Bearer device-token-123")
      .send(eventBody({ deviceTime: "2026-07-11T04:45:00Z" }))
      .then((response) => response);

    allowFirstCommit.resolve();

    const [first, second] = await Promise.all([firstRequest, secondRequest]);

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(second.body).toEqual(first.body);
    expect(state.campusMovementEvents).toHaveLength(1);
    expect(state.dailyAttendances).toHaveLength(1);
    expect(state.auditLogs).toHaveLength(1);
  });

  it("rolls back classroom attendance and morning daily attendance together on failure", async () => {
    const state = locationAwareState({
      studentType: "BOARDING",
      device: {
        locationType: "CLASSROOM",
        locationName: "Senior 1 A",
        attendanceMode: "CLASSROOM_ATTENDANCE",
        studentScope: "ASSIGNED_CLASS",
        classId: "class-a",
        streamId: "stream-a",
      },
    });
    buildLocationAwareTransactionMocks(state, { failDeviceUpdate: true });

    const res = await request(buildApp())
      .post("/api/readers/events")
      .set("Authorization", "Bearer device-token-123")
      .send(eventBody({ eventId: "classroom-event-1", deviceTime: "2026-07-11T05:00:00Z" }));

    expect(res.status).toBe(500);
    expect(state.classroomAttendanceEvents).toHaveLength(0);
    expect(state.dailyAttendances).toHaveLength(0);
    expect(state.auditLogs).toHaveLength(0);
  });
});
