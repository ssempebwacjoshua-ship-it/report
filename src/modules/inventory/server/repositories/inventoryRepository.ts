import type { PrismaClient } from "@prisma/client";

export async function listInventoryItems(prisma: PrismaClient, schoolId: string) {
  return prisma.inventoryItem.findMany({
    where: { schoolId },
    orderBy: [{ active: "desc" }, { name: "asc" }],
  });
}

export async function listInventoryMovements(prisma: PrismaClient, schoolId: string, take = 50) {
  return prisma.inventoryStockMovement.findMany({
    where: { schoolId },
    include: {
      item: { select: { id: true, name: true } },
      student: { select: { firstName: true, lastName: true } },
    },
    orderBy: { createdAt: "desc" },
    take,
  });
}

export async function listReportingRequirements(prisma: PrismaClient, schoolId: string) {
  return prisma.reportingRequirement.findMany({
    where: { schoolId, active: true },
    include: {
      item: { select: { id: true, name: true } },
      class: { select: { id: true, name: true } },
      term: { select: { id: true, name: true } },
    },
    orderBy: [{ class: { name: "asc" } }, { item: { name: "asc" } }],
  });
}

export async function searchInventoryStudents(prisma: PrismaClient, schoolId: string, search: string) {
  const normalized = search.trim();
  return prisma.student.findMany({
    where: {
      schoolId,
      isActive: true,
      ...(normalized
        ? {
            OR: [
              { admissionNumber: { contains: normalized, mode: "insensitive" } },
              { firstName: { contains: normalized, mode: "insensitive" } },
              { lastName: { contains: normalized, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    include: {
      enrollments: {
        where: { isActive: true, status: "ACTIVE" },
        orderBy: { updatedAt: "desc" },
        take: 1,
        include: {
          class: { select: { name: true } },
          stream: { select: { name: true } },
        },
      },
    },
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    take: normalized ? 25 : 12,
  });
}

export async function listRecentReportingRecords(prisma: PrismaClient, schoolId: string, take = 12) {
  return prisma.studentReportingRecord.findMany({
    where: { schoolId },
    include: {
      student: { select: { id: true, firstName: true, lastName: true, admissionNumber: true } },
      items: {
        include: {
          item: { select: { id: true, name: true } },
        },
      },
    },
    orderBy: { reportedAt: "desc" },
    take,
  });
}
