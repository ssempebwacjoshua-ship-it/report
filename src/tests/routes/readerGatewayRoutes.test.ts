import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMocks = vi.hoisted(() => ({
  nfcOfflineDeviceFindFirst: vi.fn(),
  nfcOfflineDeviceUpdate: vi.fn(),
  auditLogFindFirst: vi.fn(),
  auditLogCreate: vi.fn(),
  transaction: vi.fn(),
}));

const nfcMocks = vi.hoisted(() => ({
  scanAttendance: vi.fn(),
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
    $transaction: prismaMocks.transaction,
  },
}));

vi.mock("../../server/services/nfcOperationsService", () => ({
  scanAttendance: nfcMocks.scanAttendance,
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

describe("readerGatewayRoutes", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    prismaMocks.nfcOfflineDeviceFindFirst.mockResolvedValue({
      id: "dev-1",
      schoolId: "school-1",
      deviceKey: "attendance-gate-01",
      name: "Attendance Gate",
      mode: "ATTENDANCE",
      roleScope: "ADMIN_OPERATOR",
    });

    prismaMocks.nfcOfflineDeviceUpdate.mockResolvedValue({});
    prismaMocks.auditLogFindFirst.mockResolvedValue(null);
    prismaMocks.auditLogCreate.mockResolvedValue({});
    prismaMocks.transaction.mockImplementation(async (fn: (tx: any) => Promise<unknown>) => {
      const tx = {
        nfcOfflineDevice: { update: prismaMocks.nfcOfflineDeviceUpdate },
        auditLog: { create: prismaMocks.auditLogCreate },
      };
      return fn(tx);
    });
    nfcMocks.scanAttendance.mockResolvedValue({
      scan: {
        student: { id: "stu-1", name: "Jane Doe", admissionNumber: "A001", className: "P4", streamName: "A", photoUrl: null },
        direction: "TAP_IN",
        status: "VALID",
        reason: null,
        scannedAt: "2026-07-10T08:00:00Z",
      },
      summary: { totalTappedIn: 1, totalTappedOut: 0, lateArrivals: 0, notYetTapped: 9 },
      events: [],
    });
  });

  it("registers a device heartbeat with bearer-token auth", async () => {
    const app = buildApp();
    const res = await request(app)
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

  it("processes an attendance tap and stores an idempotent response", async () => {
    const app = buildApp();
    const body = {
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
    };

    const first = await request(app)
      .post("/api/readers/events")
      .set("Authorization", "Bearer device-token-123")
      .send(body);

    expect(first.status).toBe(200);
    expect(first.body).toMatchObject({
      success: true,
      action: "ATTENDANCE",
      message: "Attendance recorded",
      studentName: "Jane Doe",
      beep: "success",
      feedback: { beep: "success" },
    });
    expect(nfcMocks.scanAttendance).toHaveBeenCalledTimes(1);
    expect(prismaMocks.auditLogCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        action: "reader_event.attendance",
        correlationId: "event-1",
        details: expect.objectContaining({
          credentialUID: "WB-123456",
        }),
      }),
    }));

    prismaMocks.auditLogFindFirst.mockResolvedValue({
      details: {
        response: first.body,
      },
    });

    const second = await request(app)
      .post("/api/readers/events")
      .set("Authorization", "Bearer device-token-123")
      .send(body);

    expect(second.status).toBe(200);
    expect(second.body).toEqual(first.body);
    expect(nfcMocks.scanAttendance).toHaveBeenCalledTimes(1);
  });

  it("rejects a bad token without leaking device secrets", async () => {
    prismaMocks.nfcOfflineDeviceFindFirst.mockResolvedValue(null);

    const res = await request(buildApp())
      .post("/api/readers/events")
      .set("Authorization", "Bearer invalid-token")
      .send({
        deviceId: "attendance-gate-01",
        readerId: "attendance-gate-01",
        schoolId: "school-1",
        eventId: "event-1",
        credential: "WB-123456",
      });

    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/device bearer token|required|invalid/i);
  });
});
