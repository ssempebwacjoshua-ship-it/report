import type { PrismaClient } from "@prisma/client";
import { getClassesForSections, type SchoolSection } from "../../shared/constants/classes";
import { getDefaultSubjectsForSections } from "../../shared/constants/subjects";

type SubjectDelegate = Pick<PrismaClient["subject"], "findFirst" | "create" | "update">;

export type ProvisionDefaultSubjectsResult = {
  created: number;
  updated: number;
  totalDefaults: number;
};

export async function ensureDefaultSubjectsForSections(
  prisma: { subject: SubjectDelegate },
  schoolId: string,
  sections: SchoolSection[],
  classCodes = getClassesForSections(sections).map((klass) => klass.code),
): Promise<ProvisionDefaultSubjectsResult> {
  const defaults = getDefaultSubjectsForSections(sections, classCodes);
  let created = 0;
  let updated = 0;

  for (const [index, subject] of defaults.entries()) {
    const existing = await prisma.subject.findFirst({
      where: {
        schoolId,
        OR: [{ code: subject.code }, { name: subject.name }],
      },
    });

    const data = {
      name: subject.name,
      code: subject.code,
      sortOrder: index + 1,
      isActive: true,
    };

    if (existing) {
      await prisma.subject.update({
        where: { id: existing.id },
        data,
      });
      updated++;
      continue;
    }

    await prisma.subject.create({
      data: {
        schoolId,
        ...data,
      },
    });
    created++;
  }

  return { created, updated, totalDefaults: defaults.length };
}
