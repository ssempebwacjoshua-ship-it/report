import type { PrismaClient } from "@prisma/client";

export async function countActiveSubjects(prisma: PrismaClient, schoolId: string): Promise<number> {
  return prisma.subject.count({ where: { schoolId, isActive: true } });
}

