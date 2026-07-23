import type { PrismaClient } from "@prisma/client";
import {
  listInventoryItems,
  listInventoryMovements,
  listRecentReportingRecords,
  searchInventoryStudents,
} from "../repositories/inventoryRepository";
import type {
  InventoryDashboardSummary,
  InventoryItemSummary,
  InventoryMovementView,
  InventoryOverviewResponse,
  InventoryReconciliationIssue,
  InventoryReconciliationResponse,
  InventoryReportingContextResponse,
  InventoryStudentOption,
  StudentReportingRecordView,
} from "../../shared/types";

function studentNameOf(student: { firstName: string; lastName: string }) {
  return `${student.firstName} ${student.lastName}`.trim();
}

function userDisplayName(user: { firstName: string | null; lastName: string | null; email: string | null }) {
  const fullName = `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim();
  return fullName || user.email || "Staff";
}

function toInventoryItemSummary(
  item: {
    id: string;
    name: string;
    category: string;
    unit: string;
    minimumStock: number;
    active: boolean;
    updatedAt: Date;
  },
  onHandQuantity: number,
): InventoryItemSummary {
  return {
    id: item.id,
    name: item.name,
    category: item.category,
    unit: item.unit,
    minimumStock: item.minimumStock,
    active: item.active,
    onHandQuantity,
    lowStock: onHandQuantity <= item.minimumStock,
    updatedAt: item.updatedAt.toISOString(),
  };
}

function toMovementView(movement: {
  id: string;
  itemId: string;
  type: "RECEIVED" | "ISSUED" | "ADJUSTED" | "STUDENT_BROUGHT";
  quantity: number;
  source: string;
  notes: string | null;
  createdAt: Date;
  recordedByUserId: string;
  item: { id: string; name: string };
  student: { firstName: string; lastName: string } | null;
}): InventoryMovementView {
  return {
    id: movement.id,
    itemId: movement.itemId,
    itemName: movement.item.name,
    type: movement.type,
    quantity: movement.quantity,
    source: movement.source,
    notes: movement.notes,
    createdAt: movement.createdAt.toISOString(),
    studentName: movement.student ? studentNameOf(movement.student) : null,
    recordedByUserId: movement.recordedByUserId,
  };
}

function toStudentOption(student: {
  id: string;
  admissionNumber: string;
  firstName: string;
  lastName: string;
  enrollments: Array<{
    class: { name: string } | null;
    stream: { name: string } | null;
  }>;
}): InventoryStudentOption {
  const enrollment = student.enrollments[0];
  return {
    id: student.id,
    admissionNumber: student.admissionNumber,
    studentName: studentNameOf(student),
    className: enrollment?.class?.name ?? null,
    streamName: enrollment?.stream?.name ?? null,
  };
}

function toReportingRecordView(record: {
  id: string;
  studentId: string;
  status: "REPORTED" | "PENDING";
  reportedAt: Date;
  termId: string | null;
  student: { id: string; firstName: string; lastName: string; admissionNumber: string };
  recordedByUser: { firstName: string | null; lastName: string | null; email: string | null };
  items: Array<{
    broughtQuantity: number;
    item: { id: string; name: string };
  }>;
}): StudentReportingRecordView {
  return {
    id: record.id,
    studentId: record.studentId,
    studentName: studentNameOf(record.student),
    admissionNumber: record.student.admissionNumber,
    status: record.status,
    reportedAt: record.reportedAt.toISOString(),
    termId: record.termId,
    items: record.items.map((item) => ({
      itemId: item.item.id,
      itemName: item.item.name,
      quantity: item.broughtQuantity,
      recordedAt: record.reportedAt.toISOString(),
      recordedByName: userDisplayName(record.recordedByUser),
    })),
  };
}

function calculateOnHandByItem(
  movements: Array<{ itemId: string; type: "RECEIVED" | "ISSUED" | "ADJUSTED" | "STUDENT_BROUGHT"; quantity: number }>,
) {
  const totals = new Map<string, number>();
  for (const movement of movements) {
    const delta = movement.type === "ISSUED" ? -movement.quantity : movement.quantity;
    totals.set(movement.itemId, (totals.get(movement.itemId) ?? 0) + delta);
  }
  return totals;
}

async function createAuditLog(
  prisma: PrismaClient,
  schoolId: string,
  action: string,
  details: Record<string, unknown>,
) {
  await prisma.auditLog.create({
    data: {
      schoolId,
      action,
      details,
    },
  });
}

export async function getInventoryDashboardSummary(prisma: PrismaClient, schoolId: string): Promise<InventoryDashboardSummary> {
  const [items, movements, recentRecords] = await Promise.all([
    listInventoryItems(prisma, schoolId),
    listInventoryMovements(prisma, schoolId, 500),
    listRecentReportingRecords(prisma, schoolId, 200),
  ]);
  const totals = calculateOnHandByItem(movements);
  const today = new Date().toISOString().slice(0, 10);
  const lowStock = items.filter((item) => (totals.get(item.id) ?? 0) <= item.minimumStock && item.active).length;
  const reportingToday = recentRecords.filter((record) => record.reportedAt.toISOString().startsWith(today)).length;
  const itemsBroughtToday = recentRecords
    .filter((record) => record.reportedAt.toISOString().startsWith(today))
    .flatMap((record) => record.items)
    .reduce((total, item) => total + item.broughtQuantity, 0);
  const adjustmentsToday = movements.filter(
    (movement) => movement.type === "ADJUSTED" && movement.createdAt.toISOString().startsWith(today),
  ).length;

  return {
    itemsTracked: items.filter((item) => item.active).length,
    lowStock,
    reportingToday,
    itemsBroughtToday,
    adjustmentsToday,
  };
}

export async function getInventoryOverview(prisma: PrismaClient, schoolId: string): Promise<InventoryOverviewResponse> {
  const [items, movements, recentRecords, summary] = await Promise.all([
    listInventoryItems(prisma, schoolId),
    listInventoryMovements(prisma, schoolId, 20),
    listRecentReportingRecords(prisma, schoolId, 8),
    getInventoryDashboardSummary(prisma, schoolId),
  ]);
  const onHandTotals = calculateOnHandByItem(movements);
  const itemSummaries = items.map((item) => toInventoryItemSummary(item, onHandTotals.get(item.id) ?? 0));
  const lowStockItems = itemSummaries.filter((item) => item.active && item.lowStock).slice(0, 8);
  const recentMovementViews = movements.map(toMovementView);
  const reportingToday = recentRecords.map(toReportingRecordView);

  return {
    summary,
    items: itemSummaries,
    recentMovements: recentMovementViews,
    lowStockItems,
    reportingToday,
    reconciliationIssues: [],
  };
}

export async function getInventoryItemsResponse(prisma: PrismaClient, schoolId: string) {
  const [items, movements] = await Promise.all([
    listInventoryItems(prisma, schoolId),
    listInventoryMovements(prisma, schoolId, 500),
  ]);
  const totals = calculateOnHandByItem(movements);
  return {
    items: items.map((item) => toInventoryItemSummary(item, totals.get(item.id) ?? 0)),
  };
}

export async function createInventoryItem(
  prisma: PrismaClient,
  input: {
    schoolId: string;
    actorId: string;
    name: string;
    category: string;
    unit: string;
    minimumStock: number;
  },
) {
  const item = await prisma.inventoryItem.create({
    data: {
      schoolId: input.schoolId,
      name: input.name,
      category: input.category,
      unit: input.unit,
      minimumStock: input.minimumStock,
    },
  });
  await createAuditLog(prisma, input.schoolId, "inventory.item_created", {
    itemId: item.id,
    actorId: input.actorId,
    name: item.name,
    category: item.category,
  });
  return item;
}

export async function updateInventoryItem(
  prisma: PrismaClient,
  input: {
    schoolId: string;
    actorId: string;
    itemId: string;
    name: string;
    category: string;
    unit: string;
    minimumStock: number;
    active: boolean;
  },
) {
  const item = await prisma.inventoryItem.updateMany({
    where: { id: input.itemId, schoolId: input.schoolId },
    data: {
      name: input.name,
      category: input.category,
      unit: input.unit,
      minimumStock: input.minimumStock,
      active: input.active,
    },
  });
  if (!item.count) {
    throw Object.assign(new Error("Inventory item not found."), { status: 404, expose: true });
  }
  await createAuditLog(prisma, input.schoolId, "inventory.item_updated", {
    itemId: input.itemId,
    actorId: input.actorId,
  });
}

export async function archiveInventoryItem(prisma: PrismaClient, schoolId: string, actorId: string, itemId: string) {
  const updated = await prisma.inventoryItem.updateMany({
    where: { id: itemId, schoolId },
    data: { active: false },
  });
  if (!updated.count) {
    throw Object.assign(new Error("Inventory item not found."), { status: 404, expose: true });
  }
  await createAuditLog(prisma, schoolId, "inventory.item_archived", { itemId, actorId });
}

export async function recordInventoryMovement(
  prisma: PrismaClient,
  input: {
    schoolId: string;
    actorId: string;
    itemId: string;
    type: "RECEIVED" | "ISSUED" | "ADJUSTED" | "STUDENT_BROUGHT";
    quantity: number;
    source: string;
    notes?: string | null;
    studentId?: string | null;
  },
) {
  const item = await prisma.inventoryItem.findFirst({
    where: { id: input.itemId, schoolId: input.schoolId },
    select: { id: true, name: true },
  });
  if (!item) {
    throw Object.assign(new Error("Inventory item not found."), { status: 404, expose: true });
  }
  if (input.studentId) {
    const student = await prisma.student.findFirst({
      where: { id: input.studentId, schoolId: input.schoolId },
      select: { id: true },
    });
    if (!student) {
      throw Object.assign(new Error("Student not found for this school."), { status: 400, expose: true });
    }
  }

  const movement = await prisma.inventoryStockMovement.create({
    data: {
      schoolId: input.schoolId,
      itemId: input.itemId,
      type: input.type,
      quantity: input.quantity,
      source: input.source,
      notes: input.notes ?? null,
      studentId: input.studentId ?? null,
      recordedByUserId: input.actorId,
    },
    include: {
      item: { select: { id: true, name: true } },
      student: { select: { firstName: true, lastName: true } },
    },
  });
  const auditAction = input.type === "RECEIVED"
    ? "inventory.stock_received"
    : input.type === "ISSUED"
      ? "inventory.stock_issued"
      : input.type === "ADJUSTED"
        ? "inventory.stock_adjusted"
        : "inventory.student_brought_recorded";
  await createAuditLog(prisma, input.schoolId, auditAction, {
    itemId: input.itemId,
    actorId: input.actorId,
    quantity: input.quantity,
    source: input.source,
    studentId: input.studentId ?? null,
  });
  return toMovementView(movement);
}

export async function saveReportingRequirement(
  prisma: PrismaClient,
  input: {
    schoolId: string;
    actorId: string;
    itemId: string;
    classId?: string | null;
    termId?: string | null;
    requiredQuantity: number;
  },
) {
  const existing = await prisma.reportingRequirement.findFirst({
    where: {
      schoolId: input.schoolId,
      itemId: input.itemId,
      classId: input.classId ?? null,
      termId: input.termId ?? null,
      active: true,
    },
    select: { id: true },
  });
  if (existing) {
    await prisma.reportingRequirement.update({
      where: { id: existing.id },
      data: { requiredQuantity: input.requiredQuantity, active: true },
    });
  } else {
    await prisma.reportingRequirement.create({
      data: {
        schoolId: input.schoolId,
        itemId: input.itemId,
        classId: input.classId ?? null,
        termId: input.termId ?? null,
        requiredQuantity: input.requiredQuantity,
      },
    });
  }
  await createAuditLog(prisma, input.schoolId, "inventory.reporting_requirement_saved", {
    itemId: input.itemId,
    classId: input.classId ?? null,
    termId: input.termId ?? null,
    actorId: input.actorId,
    requiredQuantity: input.requiredQuantity,
  });
}

export async function getInventoryReportingContext(prisma: PrismaClient, schoolId: string, search = ""): Promise<InventoryReportingContextResponse> {
  const [students, recentRecords] = await Promise.all([
    searchInventoryStudents(prisma, schoolId, search),
    listRecentReportingRecords(prisma, schoolId, 10),
  ]);
  return {
    students: students.map(toStudentOption),
    recentRecords: recentRecords.map(toReportingRecordView),
  };
}

export async function saveStudentReportingRecord(
  prisma: PrismaClient,
  input: {
    schoolId: string;
    actorId: string;
    studentId: string;
    termId?: string | null;
    items: Array<{
      itemId: string;
      quantity: number;
    }>;
  },
) {
  const student = await prisma.student.findFirst({
    where: { id: input.studentId, schoolId: input.schoolId, isActive: true },
    select: { id: true, firstName: true, lastName: true, admissionNumber: true },
  });
  if (!student) {
    throw Object.assign(new Error("Student not found for this school."), { status: 404, expose: true });
  }

  const itemIds = input.items.map((item) => item.itemId);
  const inventoryItems = await prisma.inventoryItem.findMany({
    where: { schoolId: input.schoolId, id: { in: itemIds } },
    select: { id: true, name: true },
  });
  if (inventoryItems.length !== itemIds.length) {
    throw Object.assign(new Error("One or more reporting items were not found for this school."), { status: 400, expose: true });
  }

  const record = await prisma.$transaction(async (tx) => {
    const created = await tx.studentReportingRecord.create({
      data: {
        schoolId: input.schoolId,
        studentId: input.studentId,
        termId: input.termId ?? null,
        recordedByUserId: input.actorId,
        status: "REPORTED",
        items: {
          create: input.items.map((item) => ({
            itemId: item.itemId,
            expectedQuantity: 0,
            broughtQuantity: item.quantity,
            status: "COMPLETE",
          })),
        },
      },
      include: {
        student: { select: { id: true, firstName: true, lastName: true, admissionNumber: true } },
        items: { include: { item: { select: { id: true, name: true } } } },
      },
    });

    const broughtMovements = input.items.filter((item) => item.quantity > 0);
    for (const item of broughtMovements) {
      await tx.inventoryStockMovement.create({
        data: {
          schoolId: input.schoolId,
          itemId: item.itemId,
          type: "STUDENT_BROUGHT",
          quantity: item.quantity,
          source: "REPORTING_DAY",
          studentId: input.studentId,
          notes: "Recorded from student reporting day registration.",
          recordedByUserId: input.actorId,
        },
      });
    }

    return created;
  });

  await createAuditLog(prisma, input.schoolId, "inventory.student_reporting_record_saved", {
    recordId: record.id,
    studentId: input.studentId,
    actorId: input.actorId,
    itemCount: input.items.length,
  });

  return toReportingRecordView(record);
}

export function buildReconciliationIssues(items: InventoryItemSummary[]): InventoryReconciliationIssue[] {
  return items
    .filter((item) => item.active && item.lowStock)
    .map((item) => ({
      itemId: item.id,
      itemName: item.name,
      currentQuantity: item.onHandQuantity,
      minimumStock: item.minimumStock,
      difference: item.onHandQuantity - item.minimumStock,
      status: "LOW_STOCK",
    }));
}

export async function getInventoryReconciliation(prisma: PrismaClient, schoolId: string): Promise<InventoryReconciliationResponse> {
  const [itemsResponse, summary] = await Promise.all([
    getInventoryItemsResponse(prisma, schoolId),
    getInventoryDashboardSummary(prisma, schoolId),
  ]);
  const issues = buildReconciliationIssues(itemsResponse.items);
  return { summary, issues };
}
