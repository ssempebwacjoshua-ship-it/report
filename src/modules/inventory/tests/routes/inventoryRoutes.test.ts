import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { inventoryRoutes } from "../../server/routes/inventoryRoutes";

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    inventoryItem: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      updateMany: vi.fn(),
    },
    inventoryStockMovement: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
    reportingRequirement: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    studentReportingRecord: {
      findMany: vi.fn(),
    },
    student: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock("../../../../server/db/prisma", () => ({ prisma: mockPrisma }));

function createApp(options?: {
  user?: { userId: string; role: string };
  school?: { id: string; code: string; name: string };
}) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.user = options?.user as never;
    req.school = options?.school as never;
    next();
  });
  app.use(inventoryRoutes());
  app.use((error: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status((error as any).status ?? 500).json({ error: error.message });
  });
  return app;
}

beforeEach(() => {
  vi.resetAllMocks();
  mockPrisma.inventoryItem.findMany.mockResolvedValue([]);
  mockPrisma.inventoryStockMovement.findMany.mockResolvedValue([]);
  mockPrisma.reportingRequirement.findMany.mockResolvedValue([]);
  mockPrisma.studentReportingRecord.findMany.mockResolvedValue([]);
  mockPrisma.student.findMany.mockResolvedValue([]);
});

describe("inventoryRoutes", () => {
  it("rejects unauthenticated requests", async () => {
    const res = await request(createApp({
      school: { id: "school-a", code: "SC-A", name: "School A" },
    })).get("/api/inventory/items");

    expect(res.status).toBe(401);
  });

  it("rejects users without the required permission", async () => {
    const res = await request(createApp({
      user: { userId: "teacher-1", role: "TEACHER" },
      school: { id: "school-a", code: "SC-A", name: "School A" },
    })).post("/api/inventory/items").send({
      name: "Soap",
      category: "Hygiene",
      unit: "bar",
      minimumStock: 4,
    });

    expect(res.status).toBe(403);
  });

  it("creates and lists items for the authenticated school only", async () => {
    mockPrisma.inventoryItem.create.mockResolvedValue({
      id: "item-1",
      schoolId: "school-a",
      name: "Soap",
      category: "Hygiene",
      unit: "bar",
      minimumStock: 4,
      active: true,
      updatedAt: new Date("2026-07-23T09:00:00.000Z"),
    });
    mockPrisma.inventoryItem.findMany.mockResolvedValue([{
      id: "item-1",
      schoolId: "school-a",
      name: "Soap",
      category: "Hygiene",
      unit: "bar",
      minimumStock: 4,
      active: true,
      updatedAt: new Date("2026-07-23T09:00:00.000Z"),
    }]);

    const app = createApp({
      user: { userId: "admin-1", role: "ADMIN_OPERATOR" },
      school: { id: "school-a", code: "SC-A", name: "School A" },
    });

    const createRes = await request(app).post("/api/inventory/items").send({
      name: "Soap",
      category: "Hygiene",
      unit: "bar",
      minimumStock: 4,
    });
    const listRes = await request(app).get("/api/inventory/items");

    expect(createRes.status).toBe(201);
    expect(listRes.status).toBe(200);
    expect(mockPrisma.inventoryItem.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ schoolId: "school-a" }),
    }));
  });

  it("records stock receive and issue movements", async () => {
    mockPrisma.inventoryItem.findFirst.mockResolvedValue({ id: "11111111-1111-4111-8111-111111111111", name: "Soap" });
    mockPrisma.inventoryStockMovement.findMany.mockResolvedValue([{
      itemId: "11111111-1111-4111-8111-111111111111",
      type: "RECEIVED",
      quantity: 8,
    }]);
    mockPrisma.inventoryStockMovement.create.mockImplementation(async ({ data }: any) => ({
      id: "move-1",
      ...data,
      createdAt: new Date("2026-07-23T09:00:00.000Z"),
      item: { id: "item-1", name: "Soap" },
      student: null,
      recordedByUser: { name: "Admin User", email: "admin@example.com" },
    }));
    const app = createApp({
      user: { userId: "admin-1", role: "ADMIN_OPERATOR" },
      school: { id: "school-a", code: "SC-A", name: "School A" },
    });

    const receiveRes = await request(app).post("/api/inventory/movements/receive").send({
      itemId: "11111111-1111-4111-8111-111111111111",
      quantity: 8,
      source: "Store",
    });
    const issueRes = await request(app).post("/api/inventory/movements/issue").send({
      itemId: "11111111-1111-4111-8111-111111111111",
      quantity: 2,
      recipientName: "Kitchen team",
      recipientType: "Kitchen",
      source: "Lunch service",
    });

    expect(receiveRes.status).toBe(201);
    expect(issueRes.status).toBe(201);
  });

  it("requires inventory.stock.issue permission for stock issue", async () => {
    const app = createApp({
      user: { userId: "teacher-1", role: "TEACHER" },
      school: { id: "school-a", code: "SC-A", name: "School A" },
    });

    const res = await request(app).post("/api/inventory/movements/issue").send({
      itemId: "11111111-1111-4111-8111-111111111111",
      quantity: 1,
      recipientName: "Kitchen team",
      recipientType: "Kitchen",
      source: "Lunch service",
    });

    expect(res.status).toBe(403);
  });

  it("does not allow school A to issue school B inventory items", async () => {
    mockPrisma.inventoryItem.findFirst.mockResolvedValue(null);
    const app = createApp({
      user: { userId: "admin-1", role: "ADMIN_OPERATOR" },
      school: { id: "school-a", code: "SC-A", name: "School A" },
    });

    const res = await request(app).post("/api/inventory/movements/issue").send({
      itemId: "33333333-3333-4333-8333-333333333333",
      quantity: 1,
      recipientName: "Office clerk",
      recipientType: "Office",
      source: "Term office use",
    });

    expect(res.status).toBe(404);
  });

  it("saves reporting-day records with school-scoped student validation", async () => {
    mockPrisma.student.findFirst.mockResolvedValue({ id: "student-1", firstName: "Ada", lastName: "Lovelace", admissionNumber: "A-001" });
    mockPrisma.inventoryItem.findMany.mockResolvedValue([{ id: "item-1", name: "Soap" }]);
    mockPrisma.$transaction.mockImplementation(async (callback: any) => callback({
      studentReportingRecord: {
        create: async () => ({
          id: "record-1",
          studentId: "student-1",
          status: "REPORTED",
          reportedAt: new Date("2026-07-23T10:00:00.000Z"),
          termId: null,
          student: { id: "student-1", firstName: "Ada", lastName: "Lovelace", admissionNumber: "A-001" },
          recordedByUser: { name: "Admin User", email: "admin@example.com" },
          items: [{ expectedQuantity: 0, broughtQuantity: 1, status: "COMPLETE", item: { id: "item-1", name: "Soap" } }],
        }),
      },
      inventoryStockMovement: { create: async () => ({}) },
    }));
    const app = createApp({
      user: { userId: "admin-1", role: "ADMIN_OPERATOR" },
      school: { id: "school-a", code: "SC-A", name: "School A" },
    });

    const res = await request(app).post("/api/inventory/reporting/records").send({
      studentId: "22222222-2222-4222-8222-222222222222",
      items: [{ itemId: "11111111-1111-4111-8111-111111111111", quantity: 1 }],
    });

    expect(res.status).toBe(201);
  });

  it("does not allow school A requests to mutate school B items", async () => {
    mockPrisma.inventoryItem.updateMany.mockResolvedValue({ count: 0 });
    const app = createApp({
      user: { userId: "admin-1", role: "ADMIN_OPERATOR" },
      school: { id: "school-a", code: "SC-A", name: "School A" },
    });

    const res = await request(app).post("/api/inventory/items/33333333-3333-4333-8333-333333333333/archive");

    expect(res.status).toBe(404);
    expect(mockPrisma.inventoryItem.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "33333333-3333-4333-8333-333333333333", schoolId: "school-a" },
    }));
  });
});
