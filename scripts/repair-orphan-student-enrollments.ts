/**
 * Detects students with no active ClassEnrollment for the current academic term.
 * These are "orphaned" students who appear in the total count but not in any class filter.
 *
 * Usage:
 *   npx tsx scripts/repair-orphan-student-enrollments.ts --school=SCU-PREVIEW [--commit]
 *
 * --dry-run (default): lists orphaned students; makes no changes.
 * --commit: deletes the orphaned Student records (cascades contacts and marks).
 *           Run only after confirming the list with --dry-run first.
 */

import "dotenv/config";
import { pathToFileURL } from "node:url";
import { prisma } from "../src/server/db/prisma";

const args = process.argv.slice(2);
const schoolCode = args.find((a) => a.startsWith("--school="))?.split("=")[1];
const isCommit = args.includes("--commit");

async function main() {
  if (!schoolCode) {
    console.error("Error: --school=<CODE> is required.");
    console.error("Usage: npx tsx scripts/repair-orphan-student-enrollments.ts --school=SCU-PREVIEW [--commit]");
    process.exit(1);
  }

  const school = await prisma.school.findUnique({
    where: { code: schoolCode },
    include: {
      academicYears: {
        where: { isActive: true },
        include: { terms: { where: { isActive: true } } },
      },
    },
  });

  if (!school) {
    console.error(`School "${schoolCode}" not found.`);
    process.exit(1);
  }

  const activeYear = school.academicYears[0];
  const activeTerm = activeYear?.terms[0];

  if (!activeYear || !activeTerm) {
    console.error(`No active academic year and term found for ${schoolCode}.`);
    process.exit(1);
  }

  console.log(`School : ${school.name} (${school.code})`);
  console.log(`Year   : ${activeYear.name}`);
  console.log(`Term   : ${activeTerm.name}`);
  console.log();

  // Students who are active but have no enrollment record for the current term.
  const orphans = await prisma.student.findMany({
    where: {
      schoolId: school.id,
      isActive: true,
      enrollments: {
        none: {
          academicYearId: activeYear.id,
          termId: activeTerm.id,
        },
      },
    },
    select: {
      id: true,
      admissionNumber: true,
      firstName: true,
      lastName: true,
    },
    orderBy: { admissionNumber: "asc" },
  });

  if (orphans.length === 0) {
    console.log("No orphaned students found. Nothing to repair.");
    return;
  }

  console.log(`Found ${orphans.length} orphaned student(s) with no enrollment for ${activeYear.name} / ${activeTerm.name}:`);
  console.log();
  for (const s of orphans) {
    console.log(`  ${s.admissionNumber.padEnd(20)} ${s.firstName} ${s.lastName}  (id: ${s.id})`);
  }
  console.log();

  if (!isCommit) {
    console.log("[dry-run] No changes made.");
    console.log("Re-run with --commit to delete the orphaned students listed above,");
    console.log("or re-import them via the Students page to assign them to a class.");
    return;
  }

  const { count } = await prisma.student.deleteMany({
    where: { id: { in: orphans.map((s) => s.id) } },
  });

  await prisma.auditLog.create({
    data: {
      schoolId: school.id,
      action: "student.repair.orphan-delete",
      details: {
        deletedCount: count,
        studentIds: orphans.map((s) => s.id),
        academicYearId: activeYear.id,
        termId: activeTerm.id,
      },
    },
  });

  console.log(`[commit] Deleted ${count} orphaned student(s) and recorded audit log.`);
  console.log("To restore them, re-import via the Students page with the correct class assignment.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => prisma.$disconnect());

export {};
