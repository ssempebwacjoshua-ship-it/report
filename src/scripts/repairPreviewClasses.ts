/**
 * Repairs non-canonical SchoolClass records.
 *
 * Bad pattern: classes with codes like "S1A" or "S1B" that embed both
 * the class (S1 = Senior 1) and the stream (A, B) in one record.
 * Correct model: Class "Senior 1" (code "S1") + Stream "A" / Stream "B".
 *
 * For each bad class the repair:
 *   1. Derives canonical parent code and stream suffix (S1A → S1 + A)
 *   2. Upserts the canonical parent class
 *   3. Re-parents streams under the bad class → canonical parent class
 *   4. Updates ClassEnrollment.classId and SubjectMark.classId
 *   5. Renames the bad class to "ARCHIVED: <name>" (prevents duplicate constraint)
 *
 * Idempotent: safe to run multiple times.
 */

import type { PrismaClient } from "@prisma/client";
import {
  CANONICAL_CLASSES,
  getClassesForSections,
  isCanonicalClassCode,
  type SchoolSection,
} from "../shared/constants/classes";

export type ProvisionResult = {
  schoolCode: string;
  sectionsProvisioned: SchoolSection[];
  totalClassesProcessed: number;
};

/**
 * Upserts every canonical class definition for the given sections into the DB.
 * Idempotent: safe to run multiple times. Existing records are left unchanged.
 */
export async function provisionCanonicalClasses(
  prisma: PrismaClient,
  schoolCode: string,
  sections: SchoolSection[],
): Promise<ProvisionResult> {
  const school = await prisma.school.findUnique({ where: { code: schoolCode } });
  if (!school) throw new Error(`School not found: ${schoolCode}`);

  const defs = getClassesForSections(sections);
  for (const def of defs) {
    await prisma.schoolClass.upsert({
      where: { schoolId_code: { schoolId: school.id, code: def.code } },
      create: { schoolId: school.id, name: def.name, code: def.code, level: def.level },
      update: {},
    });
  }
  return { schoolCode, sectionsProvisioned: sections, totalClassesProcessed: defs.length };
}

export type RepairResult = {
  schoolCode: string;
  badClassesFound: number;
  classesRepaired: number;
  streamsReparented: number;
  enrollmentsMigrated: number;
  marksMigrated: number;
  skipped: string[];
};

function parseCanonicalParent(
  badCode: string,
): { parentCode: string; streamSuffix: string } | null {
  for (let suffixLen = 1; suffixLen < badCode.length; suffixLen++) {
    const prefix = badCode.slice(0, badCode.length - suffixLen);
    if (isCanonicalClassCode(prefix)) {
      return { parentCode: prefix.toUpperCase(), streamSuffix: badCode.slice(-suffixLen) };
    }
  }
  return null;
}

export async function repairSchoolClasses(
  prisma: PrismaClient,
  schoolCode: string,
): Promise<RepairResult> {
  const result: RepairResult = {
    schoolCode,
    badClassesFound: 0,
    classesRepaired: 0,
    streamsReparented: 0,
    enrollmentsMigrated: 0,
    marksMigrated: 0,
    skipped: [],
  };

  const school = await prisma.school.findUnique({ where: { code: schoolCode } });
  if (!school) {
    result.skipped.push(`School not found: ${schoolCode}`);
    return result;
  }

  const allClasses = await prisma.schoolClass.findMany({
    where: { schoolId: school.id },
  });

  const badClasses = allClasses.filter(
    (cls) =>
      !isCanonicalClassCode(cls.code) && !cls.name.startsWith("ARCHIVED:"),
  );

  result.badClassesFound = badClasses.length;

  for (const badClass of badClasses) {
    const parsed = parseCanonicalParent(badClass.code);
    if (!parsed) {
      result.skipped.push(`Cannot derive parent for code: ${badClass.code}`);
      continue;
    }

    const { parentCode } = parsed;
    const catalog = CANONICAL_CLASSES.find((c) => c.code === parentCode);
    if (!catalog) {
      result.skipped.push(`No catalog entry for derived parent code: ${parentCode}`);
      continue;
    }

    await prisma.$transaction(async (tx) => {
      // 1. Upsert the canonical parent class
      const existing = await tx.schoolClass.findUnique({
        where: { schoolId_code: { schoolId: school.id, code: catalog.code } },
      });

      const canonicalClass = existing
        ? existing
        : await tx.schoolClass.create({
            data: {
              schoolId: school.id,
              name: catalog.name,
              code: catalog.code,
              level: catalog.level,
            },
          });

      // 2. Find all streams under the bad class
      const streams = await tx.stream.findMany({
        where: { classId: badClass.id },
      });

      for (const stream of streams) {
        // Check if a stream with the same code already exists under canonical class
        const collision = await tx.stream.findUnique({
          where: { classId_code: { classId: canonicalClass.id, code: stream.code } },
        });

        if (!collision) {
          // Re-parent: update stream.classId to canonical class
          await tx.stream.update({
            where: { id: stream.id },
            data: { classId: canonicalClass.id },
          });
          result.streamsReparented++;
        } else {
          // Merge: point enrollments + marks to existing stream, then delete old stream
          await tx.classEnrollment.updateMany({
            where: { streamId: stream.id },
            data: { streamId: collision.id },
          });
          await tx.subjectMark.updateMany({
            where: { streamId: stream.id },
            data: { streamId: collision.id },
          });
          await tx.stream.delete({ where: { id: stream.id } });
        }
      }

      // 3. Migrate classId on enrollments
      const { count: enrollCount } = await tx.classEnrollment.updateMany({
        where: { classId: badClass.id },
        data: { classId: canonicalClass.id },
      });
      result.enrollmentsMigrated += enrollCount;

      // 4. Migrate classId on marks
      const { count: markCount } = await tx.subjectMark.updateMany({
        where: { classId: badClass.id },
        data: { classId: canonicalClass.id },
      });
      result.marksMigrated += markCount;

      // 5. Archive the bad class (avoids duplicate name/code constraints)
      await tx.schoolClass.update({
        where: { id: badClass.id },
        data: {
          name: `ARCHIVED: ${badClass.name}`,
          code: `ARCHIVED:${badClass.code}`,
        },
      });

      result.classesRepaired++;
    });
  }

  return result;
}

// ── CLI entry point ──────────────────────────────────────────────────────────

async function main() {
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();

  const schoolCodes = process.argv.slice(2).length
    ? process.argv.slice(2)
    : ["SCU-PREVIEW"];

  // Section to provision can be extended; default is SECONDARY for this preview school.
  const sections: SchoolSection[] = ["SECONDARY"];

  try {
    for (const code of schoolCodes) {
      console.log(`\nProvisioning canonical classes for school: ${code} (sections: ${sections.join(", ")})`);
      const provResult = await provisionCanonicalClasses(prisma, code, sections);
      console.log(JSON.stringify(provResult, null, 2));

      console.log(`\nRepairing non-canonical class names for school: ${code}`);
      const repairResult = await repairSchoolClasses(prisma, code);
      console.log(JSON.stringify(repairResult, null, 2));
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
