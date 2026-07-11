import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMocks = vi.hoisted(() => ({
  nfcOfflineDeviceFindFirst: vi.fn(),
  nfcOfflineDeviceUpdate: vi.fn(),
  auditLogFindFirst: vi.fn(),
  auditLogCreate: vi.fn(),
  studentCredentialFindFirst: vi.fn(),
  nfcTagFindFirst: vi.fn(),
  studentAttendanceEventFindFirst: vi.fn(),
  studentAttendanceEventCreate: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("../../server/db/prisma", () => ({
  prisma: {
    nfcOfflineDevice: {
      findFirst: prismaMocks.nfcOfflineDeviceFindFirst,
      update: prismaMocks.nfcOfflineDeviceUpdate,
    },
    auditLog: {
      findFirst: prismaMocks.auditLogFindFirst,
      create: prismaMocks.auditLogCreate,
    },
    studentCredential: {
      findFirst: prismaMocks.studentCredentialFindFirst,
    },
    nfcTag: {
      findFirst: prismaMocks.nfcTagFindFirst,
    },
    studentAttendanceEvent: {
      findFirst: prismaMocks.studentAttendanceEventFindFirst,
      create: prismaMocks.studentAttendanceEventCreate,
    },
    $transaction: prismaMocks.transaction,
  },
}));

import { readerGatewayRoutes } from "../../server/routes/readerGatewayRoutes";

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

describe("readerGatewayRoutes", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    prismaMocks.nfcOfflineDeviceFindFirst.mockResolvedValue(device());
    prismaMocks.nfcOfflineDeviceUpdate.mockResolvedValue({});
    prismaMocks.auditLogFindFirst.mockResolvedValue(null);
    prismaMocks.auditLogCreate.mockResolvedValue({});
    prismaMocks.studentCredentialFindFirst.mockResolvedValue(credential());
    prismaMocks.nfcTagFindFirst.mockResolvedValue(null);
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

  it("records a valid attendance scan and preserves the device timestamp", async () => {
    const res = await request(buildApp())
      .post("/api/readers/events")
      .set("Authorization", "Bearer device-token-123")
      .send(eventBody());

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      success: true,
      action: "ATTENDANCE",
      status: "PRESENT",
      message: "Attendance recorded",
      studentName: "Jane Doe",
      beep: "success",
      feedback: { beep: "success" },
    });
    expect(prismaMocks.studentAttendanceEventCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        schoolId: "school-1",
        studentId: "stu-1",
        credentialId: "cred-1",
        scannedAt: new Date("2026-07-10T08:00:00Z"),
      }),
    }));
    expect(prismaMocks.auditLogCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        action: "reader_event.attendance",
        correlationId: "event-1",
      }),
    }));
  });

  it("returns a duplicate response without creating another attendance row", async () => {
    prismaMocks.studentAttendanceEventFindFirst.mockResolvedValue({ id: "att-existing" });

    const res = await request(buildApp())
      .post("/api/readers/events")
      .set("Authorization", "Bearer device-token-123")
      .send(eventBody());

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      success: true,
      action: "ATTENDANCE",
      status: "DUPLICATE",
      message: "Attendance already recorded",
      beep: "duplicate",
    });
    expect(prismaMocks.studentAttendanceEventCreate).not.toHaveBeenCalled();
  });

  it("rejects an unknown credential safely", async () => {
    prismaMocks.studentCredentialFindFirst.mockResolvedValue(null);
    prismaMocks.nfcTagFindFirst.mockResolvedValue(null);

    const res = await request(buildApp())
      .post("/api/readers/events")
      .set("Authorization", "Bearer device-token-123")
      .send(eventBody());

    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({
      success: false,
      action: "ATTENDANCE",
      status: "UNKNOWN_CREDENTIAL",
      message: "Wristband not registered",
      beep: "error",
    });
    expect(prismaMocks.studentAttendanceEventCreate).not.toHaveBeenCalled();
  });

  it("rejects a wrong-school credential by searching only inside the reader school", async () => {
    prismaMocks.studentCredentialFindFirst.mockResolvedValue(null);
    prismaMocks.nfcTagFindFirst.mockResolvedValue(null);

    const res = await request(buildApp())
      .post("/api/readers/events")
      .set("Authorization", "Bearer device-token-123")
      .send(eventBody({ credential: "OTHER-SCHOOL-WRISTBAND" }));

    expect(res.status).toBe(404);
    expect(res.body.status).toBe("UNKNOWN_CREDENTIAL");
    expect(prismaMocks.studentCredentialFindFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ schoolId: "school-1" }),
    }));
  });

  it("rejects a disabled reader", async () => {
    prismaMocks.nfcOfflineDeviceFindFirst.mockResolvedValue(device({ isActive: false, status: "REVOKED" }));

    const res = await request(buildApp())
      .post("/api/readers/events")
      .set("Authorization", "Bearer device-token-123")
      .send(eventBody());

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
      .send(eventBody());

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
        lastIp: "192.168.1.51",
        lastRssi: -54,
        firmwareVersion: "1.0.0",
        queueDepth: 0,
        onlineStatus: "ONLINE",
        lastApiContactAt: new Date("2026-07-10T08:00:00Z"),
      }),
    }));
  });
});
