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
    const movementCreate = vi.fn(async ({ data }: any) => ({
      id: "move-1",
      ...data,
      createdAt: new Date("2026-07-23T08:00:00.000Z"),
      item: { id: "item-1", name: "Soap" },
      student: null,
    }));
    const auditCreate = vi.fn(async () => ({}));
    const prisma = {
      inventoryItem: { findFirst },
      student: { findFirst: vi.fn(async () => ({ id: "student-1" })) },
      inventoryStockMovement: { create: movementCreate },
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
      source: "Dormitory",
    });

    expect(received.type).toBe("RECEIVED");
    expect(issued.type).toBe("ISSUED");
    expect(movementCreate).toHaveBeenCalledTimes(2);
  });

  it("calculates low stock and reporting counts from school-scoped data", async () => {
    const summary = await getInventoryDashboardSummary({
      inventoryItem: {
        findMany: async () => [
          { id: "item-1", schoolId: "school-a", name: "Soap", category: "Hygiene", unit: "bar", minimumStock: 5, active: true, updatedAt: new Date() },
          { id: "item-2", schoolId: "school-a", name: "Rice", category: "Food", unit: "kg", minimumStock: 2, active: true, updatedAt: new Date() },
        ],
      },
      inventoryStockMovement: {
        findMany: async () => [
          { id: "move-1", schoolId: "school-a", itemId: "item-1", type: "RECEIVED", quantity: 3, source: "Store", notes: null, createdAt: new Date(), recordedByUserId: "user-1", item: { id: "item-1", name: "Soap" }, student: null },
          { id: "move-2", schoolId: "school-a", itemId: "item-2", type: "RECEIVED", quantity: 9, source: "Store", notes: null, createdAt: new Date(), recordedByUserId: "user-1", item: { id: "item-2", name: "Rice" }, student: null },
        ],
      },
      studentReportingRecord: {
        findMany: async () => [{
          id: "record-1",
          schoolId: "school-a",
          studentId: "student-1",
          termId: null,
          reportedAt: new Date(),
          status: "REPORTED",
          student: { id: "student-1", firstName: "Ada", lastName: "Lovelace", admissionNumber: "A-1" },
          items: [
            { expectedQuantity: 1, broughtQuantity: 1, status: "COMPLETE", item: { id: "item-1", name: "Soap" } },
            { expectedQuantity: 2, broughtQuantity: 1, status: "PARTIAL", item: { id: "item-2", name: "Rice" } },
          ],
        }],
      },
    } as never, "school-a");

    expect(summary.itemsTracked).toBe(2);
    expect(summary.lowStock).toBe(1);
    expect(summary.reportingToday).toBe(1);
    expect(summary.requirementsReceived).toBe(1);
    expect(summary.reconciliationIssues).toBe(1);
  });

  it("derives reporting and reconciliation statuses from expected vs brought quantities", () => {
    const issues = buildReconciliationIssues(
      [
        { id: "req-1", itemId: "item-1", itemName: "Soap", requiredQuantity: 2, classId: null, className: null, termId: null, termName: null, active: true },
        { id: "req-2", itemId: "item-2", itemName: "Rice", requiredQuantity: 1, classId: null, className: null, termId: null, termName: null, active: true },
      ],
      [{
        id: "record-1",
        studentId: "student-1",
        studentName: "Ada Lovelace",
        admissionNumber: "A-001",
        status: "REPORTED",
        reportedAt: new Date().toISOString(),
        termId: null,
        items: [
          { itemId: "item-1", itemName: "Soap", expectedQuantity: 2, broughtQuantity: 1, status: "PARTIAL" },
          { itemId: "item-2", itemName: "Rice", expectedQuantity: 1, broughtQuantity: 2, status: "EXTRA" },
        ],
      }],
    );

    expect(issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ itemId: "item-1", status: "PARTIAL" }),
      expect.objectContaining({ itemId: "item-2", status: "EXTRA" }),
    ]));
  });

  it("saves a reporting-day record and student-brought movements together", async () => {
    const recordCreate = vi.fn(async () => ({
      id: "record-1",
      studentId: "student-1",
      status: "REPORTED",
      reportedAt: new Date(),
      termId: null,
      student: { id: "student-1", firstName: "Ada", lastName: "Lovelace", admissionNumber: "A-001" },
      items: [
        { expectedQuantity: 1, broughtQuantity: 1, status: "COMPLETE", item: { id: "item-1", name: "Soap" } },
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
      items: [{ itemId: "item-1", expectedQuantity: 1, broughtQuantity: 1 }],
    });

    expect(record.studentId).toBe("student-1");
    expect(movementCreate).toHaveBeenCalledTimes(1);
  });
});
