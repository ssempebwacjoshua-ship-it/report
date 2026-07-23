import { describe, expect, it, vi } from "vitest";
import {
  buildReconciliationIssues,
  createInventoryItem,
  getInventoryDashboardSummary,
  recordInventoryMovement,
  saveStudentReportingRecord,
} from "../../server/services/inventoryService";

describe("inventoryService", () => {
  it("creates an item scoped to the provided school", async () => {
    const create = vi.fn(async ({ data }: any) => ({ id: "item-1", ...data }));
    const auditCreate = vi.fn(async ({ data }: any) => data);
    await createInventoryItem({
      inventoryItem: { create },
      auditLog: { create: auditCreate },
    } as never, {
      schoolId: "school-a",
      actorId: "user-1",
      name: "Soap",
      category: "Hygiene",
      unit: "bar",
      minimumStock: 4,
    });

    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ schoolId: "school-a", name: "Soap" }),
    }));
  });

  it("records received and issued stock movements", async () => {
    const findFirst = vi.fn(async () => ({ id: "item-1", name: "Soap" }));
    const movementFindMany = vi.fn(async () => [
      { itemId: "item-1", type: "RECEIVED", quantity: 12 },
    ]);
    const movementCreate = vi.fn(async ({ data }: any) => ({
      id: "move-1",
      ...data,
      createdAt: new Date("2026-07-23T08:00:00.000Z"),
      item: { id: "item-1", name: "Soap" },
      student: null,
      recordedByUser: { name: "Admin User", email: "admin@example.com" },
    }));
    const auditCreate = vi.fn(async () => ({}));
    const prisma = {
      inventoryItem: { findFirst },
      student: { findFirst: vi.fn(async () => ({ id: "student-1" })) },
      inventoryStockMovement: { create: movementCreate, findMany: movementFindMany },
      auditLog: { create: auditCreate },
    } as never;

    const received = await recordInventoryMovement(prisma, {
      schoolId: "school-a",
      actorId: "user-1",
      itemId: "item-1",
      type: "RECEIVED",
      quantity: 12,
      source: "Store",
    });
    const issued = await recordInventoryMovement(prisma, {
      schoolId: "school-a",
      actorId: "user-1",
      itemId: "item-1",
      type: "ISSUED",
      quantity: 2,
      source: "Cleaning supplies",
      recipientName: "Matron",
      recipientType: "Staff",
    });

    expect(received.type).toBe("RECEIVED");
    expect(issued.type).toBe("ISSUED");
    expect(issued.recipientName).toBe("Matron");
    expect(issued.recordedByName).toBe("Admin User");
    expect(movementCreate).toHaveBeenCalledTimes(2);
  });

  it("blocks issuing more stock than is available", async () => {
    const prisma = {
      inventoryItem: { findFirst: vi.fn(async () => ({ id: "item-1", name: "Soap" })) },
      inventoryStockMovement: {
        findMany: vi.fn(async () => [{ itemId: "item-1", type: "RECEIVED", quantity: 1 }]),
        create: vi.fn(),
      },
      student: { findFirst: vi.fn() },
      auditLog: { create: vi.fn() },
    } as never;

    await expect(recordInventoryMovement(prisma, {
      schoolId: "school-a",
      actorId: "user-1",
      itemId: "item-1",
      type: "ISSUED",
      quantity: 3,
      source: "Kitchen use",
      recipientName: "Kitchen",
      recipientType: "Kitchen",
    })).rejects.toMatchObject({
      message: "Cannot take out more than the available stock.",
      status: 400,
    });
  });

  it("calculates low stock, items brought today, items issued today, and reconciliation issues from school-scoped data", async () => {
    const summary = await getInventoryDashboardSummary({
      inventoryItem: {
        findMany: async () => [
          { id: "item-1", schoolId: "school-a", name: "Soap", category: "Hygiene", unit: "bar", minimumStock: 5, active: true, updatedAt: new Date("2026-07-23T08:00:00.000Z") },
          { id: "item-2", schoolId: "school-a", name: "Rice", category: "Food", unit: "kg", minimumStock: 2, active: true, updatedAt: new Date("2026-07-23T08:00:00.000Z") },
        ],
      },
      inventoryStockMovement: {
        findMany: async () => [
          { id: "move-1", schoolId: "school-a", itemId: "item-1", type: "RECEIVED", quantity: 3, source: "Store", notes: null, createdAt: new Date("2026-07-23T09:00:00.000Z"), recordedByUserId: "user-1", item: { id: "item-1", name: "Soap" }, student: null },
          { id: "move-2", schoolId: "school-a", itemId: "item-2", type: "RECEIVED", quantity: 9, source: "Store", notes: null, createdAt: new Date("2026-07-23T09:00:00.000Z"), recordedByUserId: "user-1", item: { id: "item-2", name: "Rice" }, student: null },
          { id: "move-3", schoolId: "school-a", itemId: "item-2", type: "ISSUED", quantity: 2, source: "Lunch service", notes: null, createdAt: new Date("2026-07-23T10:30:00.000Z"), recordedByUserId: "user-1", item: { id: "item-2", name: "Rice" }, student: null },
          { id: "move-4", schoolId: "school-a", itemId: "item-2", type: "ADJUSTED", quantity: 1, source: "RECONCILIATION", notes: null, createdAt: new Date("2026-07-23T11:00:00.000Z"), recordedByUserId: "user-1", item: { id: "item-2", name: "Rice" }, student: null },
        ],
      },
      studentReportingRecord: {
        findMany: async () => [{
          id: "record-1",
          schoolId: "school-a",
          studentId: "student-1",
          termId: null,
          reportedAt: new Date("2026-07-23T10:00:00.000Z"),
          status: "REPORTED",
          student: { id: "student-1", firstName: "Ada", lastName: "Lovelace", admissionNumber: "A-1" },
          recordedByUser: { name: "Admin User", email: "admin@example.com" },
          items: [
            { expectedQuantity: 0, broughtQuantity: 1, status: "COMPLETE", item: { id: "item-1", name: "Soap" } },
            { expectedQuantity: 0, broughtQuantity: 2, status: "COMPLETE", item: { id: "item-2", name: "Rice" } },
          ],
        }],
      },
    } as never, "school-a");

    expect(summary.itemsTracked).toBe(2);
    expect(summary.lowStock).toBe(1);
    expect(summary.itemsBroughtToday).toBe(3);
    expect(summary.itemsIssuedToday).toBe(2);
    expect(summary.reconciliationIssues).toBe(1);
  });

  it("builds low-stock reconciliation rows from current inventory balances", () => {
    const issues = buildReconciliationIssues([
      {
        id: "item-1",
        name: "Soap",
        category: "Hygiene",
        unit: "bar",
        minimumStock: 2,
        active: true,
        onHandQuantity: 1,
        lowStock: true,
        updatedAt: new Date("2026-07-23T08:00:00.000Z").toISOString(),
      },
      {
        id: "item-2",
        name: "Rice",
        category: "Food",
        unit: "kg",
        minimumStock: 2,
        active: true,
        onHandQuantity: 4,
        lowStock: false,
        updatedAt: new Date("2026-07-23T08:00:00.000Z").toISOString(),
      },
    ]);

    expect(issues).toEqual([
      expect.objectContaining({
        itemId: "item-1",
        currentQuantity: 1,
        minimumStock: 2,
        status: "LOW_STOCK",
      }),
    ]);
  });

  it("saves a reporting-day record and student-brought movements together", async () => {
    const recordCreate = vi.fn(async () => ({
      id: "record-1",
      studentId: "student-1",
      status: "REPORTED",
      reportedAt: new Date("2026-07-23T10:00:00.000Z"),
      termId: null,
      student: { id: "student-1", firstName: "Ada", lastName: "Lovelace", admissionNumber: "A-001" },
      recordedByUser: { name: "Admin User", email: "admin@example.com" },
      items: [
        { expectedQuantity: 0, broughtQuantity: 1, status: "COMPLETE", item: { id: "item-1", name: "Soap" } },
      ],
    }));
    const movementCreate = vi.fn(async () => ({}));
    const auditCreate = vi.fn(async () => ({}));
    const prisma = {
      student: { findFirst: vi.fn(async () => ({ id: "student-1", firstName: "Ada", lastName: "Lovelace", admissionNumber: "A-001" })) },
      inventoryItem: { findMany: vi.fn(async () => [{ id: "item-1", name: "Soap" }]) },
      auditLog: { create: auditCreate },
      $transaction: async (callback: any) => callback({
        studentReportingRecord: { create: recordCreate },
        inventoryStockMovement: { create: movementCreate },
      }),
    } as never;

    const record = await saveStudentReportingRecord(prisma, {
      schoolId: "school-a",
      actorId: "user-1",
      studentId: "student-1",
      items: [{ itemId: "item-1", quantity: 1 }],
    });

    expect(record.studentId).toBe("student-1");
    expect(record.items).toEqual([{
      itemId: "item-1",
      itemName: "Soap",
      quantity: 1,
      recordedAt: "2026-07-23T10:00:00.000Z",
      recordedByName: "Admin User",
    }]);
    expect(movementCreate).toHaveBeenCalledTimes(1);
    expect(recordCreate).toHaveBeenCalledWith(expect.objectContaining({
      include: expect.objectContaining({
        recordedByUser: { select: { name: true, email: true } },
      }),
    }));
  });
});
