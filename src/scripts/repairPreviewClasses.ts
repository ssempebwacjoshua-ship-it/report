/**
 * Repairs non-canonical SchoolClass records.
 *
 * Bad pattern: classes with codes like "S1A" or "S1B" that embed both
 * the class (S1 = Senior 1) and the stream (A, B) in one record.
 * Correct model: Class "Senior 1" (code "S1") + Stream "A" / "B".
 *
 * The script can run in dry-run mode or apply mode. It is safe to import in
 * tests because it only executes as a CLI when run directly.
 */

import type { PrismaClient } from "@prisma/client";
import { pathToFileURL } from "node:url";
import {
  CANONICAL_CLASSES,
  getClassesForSections,
  isCanonicalClassCode,
  type SchoolSection,
} from "../shared/constants/classes";
import { ensureDefaultSubjectsForSections } from "../server/services/subjectProvisioningService";
import { parseLegacyCombinedClassCode } from "../shared/utils/classStreamNormalization";

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
  await ensureDefaultSubjectsForSections(
    prisma,
    school.id,
    sections,
    defs.map((def) => def.code),
  );
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

export type NormalizeSchoolClassStreamsOptions = {
  dryRun?: boolean;
};

function buildEmptyResult(schoolCode: string): RepairResult {
  return {
    schoolCode,
    badClassesFound: 0,
    classesRepaired: 0,
    streamsReparented: 0,
    enrollmentsMigrated: 0,
    marksMigrated: 0,
    skipped: [],
  };
}

export async function normalizeSchoolClassStreams(
  prisma: PrismaClient,
  schoolCode: string,
  options: NormalizeSchoolClassStreamsOptions = {},
): Promise<RepairResult> {
  const result = buildEmptyResult(schoolCode);

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
    const parsed =
      parseLegacyCombinedClassCode(badClass.code) ??
      parseLegacyCombinedClassCode(badClass.name);
    if (!parsed) {
      result.skipped.push(`Cannot derive parent for code: ${badClass.code}`);
      continue;
    }

    const catalog = CANONICAL_CLASSES.find((c) => c.code === parsed.parentCode);
    if (!catalog) {
      result.skipped.push(`No catalog entry for derived parent code: ${parsed.parentCode}`);
      continue;
    }

    const [streams, enrollCount, markCount] = await Promise.all([
      prisma.stream.findMany({ where: { classId: badClass.id } }),
      prisma.classEnrollment.count({ where: { classId: badClass.id } }),
      prisma.subjectMark.count({ where: { classId: badClass.id } }),
    ]);
    const canonicalClass = await prisma.schoolClass.findUnique({
      where: { schoolId_code: { schoolId: school.id, code: catalog.code } },
    });
    let reparentableStreams = 0;
    for (const stream of streams) {
      if (!canonicalClass) {
        reparentableStreams += 1;
        continue;
      }
      const collision = await prisma.stream.findUnique({
        where: { classId_code: { classId: canonicalClass.id, code: stream.code } },
      });
      if (!collision) reparentableStreams += 1;
    }

    if (options.dryRun) {
      result.classesRepaired++;
      result.streamsReparented += reparentableStreams;
      result.enrollmentsMigrated += enrollCount;
      result.marksMigrated += markCount;
      continue;
    }

    let repairedStreams = 0;
    await prisma.$transaction(async (tx) => {
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

      for (const stream of streams) {
        const collision = await tx.stream.findUnique({
          where: { classId_code: { classId: canonicalClass.id, code: stream.code } },
        });

        if (!collision) {
          await tx.stream.update({
            where: { id: stream.id },
            data: { classId: canonicalClass.id },
          });
          repairedStreams += 1;
          continue;
        }

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

      await tx.classEnrollment.updateMany({
        where: { classId: badClass.id },
        data: { classId: canonicalClass.id },
      });

      await tx.subjectMark.updateMany({
        where: { classId: badClass.id },
        data: { classId: canonicalClass.id },
      });

      await tx.schoolClass.update({
        where: { id: badClass.id },
        data: {
          name: `ARCHIVED: ${badClass.name}`,
          code: `ARCHIVED:${badClass.code}`,
        },
      });
    });

    result.classesRepaired++;
    result.streamsReparented += repairedStreams;
    result.enrollmentsMigrated += enrollCount;
    result.marksMigrated += markCount;
  }

  return result;
}

export async function repairSchoolClasses(
  prisma: PrismaClient,
  schoolCode: string,
): Promise<RepairResult> {
  return normalizeSchoolClassStreams(prisma, schoolCode, { dryRun: false });
}

async function main() {
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();

  const args = process.argv.slice(2);
  const schoolCodes = args.filter((arg) => !arg.startsWith("--"));
  const dryRun = !args.includes("--apply");

  try {
    const targets = schoolCodes.length > 0 ? schoolCodes : ["SCU-PREVIEW"];
    for (const code of targets) {
      console.log(`\nNormalizing class/stream structure for school: ${code}`);
      const result = await normalizeSchoolClassStreams(prisma, code, { dryRun });
      console.log(JSON.stringify({ ...result, dryRun }, null, 2));
    }
  } finally {
    await prisma.$disconnect();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

export {};

