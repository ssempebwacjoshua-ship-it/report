import type { PrismaClient } from "@prisma/client";

export async function countActiveStudentsForClass(prisma: PrismaClient, classId: string, termId: string): Promise<number> {
  return prisma.classEnrollment.count({ where: { classId, termId, isActive: true, student: { isActive: true } } });
}
