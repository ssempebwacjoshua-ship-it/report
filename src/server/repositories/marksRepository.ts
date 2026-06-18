import type { PrismaClient } from "@prisma/client";

export async function countSeededMarks(prisma: PrismaClient, seedKey: string): Promise<number> {
  return prisma.subjectMark.count({ where: { seedKey } });
}

