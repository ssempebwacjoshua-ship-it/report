import "dotenv/config";
import { prisma } from "../src/server/db/prisma";

/**
 * Audit student enrollments for orphaned class/stream references.
 *
 * Usage:
 *   npx tsx scripts/audit-student-enrollments.ts           # all schools
 *   npx tsx scripts/audit-student-enrollments.ts SCU-2025  # one school
 */

async function auditSchool(schoolCode: string) {
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
    console.log(`  School not found: ${schoolCode}`);
    return;
  }

  const academicYear = school.academicYears[0];
  const term = academicYear?.terms[0];

  if (!academicYear || !term) {
    console.log(`\nSchool: ${school.name} (${schoolCode})`);
    console.log("  No active academic year or term — skipping enrollment audit.");
    return;
  }

  const enrollments = await prisma.classEnrollment.findMany({
    where: {
      schoolId: school.id,
      academicYearId: academicYear.id,
      termId: term.id,
      isActive: true,
      status: "ACTIVE",
    },
    include: {
      class: true,
      stream: true,
      student: { select: { admissionNumber: true } },
    },
  });

  type EnrollmentRow = (typeof enrollments)[number];
  const orphanedClass = enrollments.filter((e: EnrollmentRow) => !(e.class as (typeof e.class) | null));
  const orphanedStream = enrollments.filter((e: EnrollmentRow) => !(e.stream as (typeof e.stream) | null));

  console.log(`\nSchool: ${school.name} (${schoolCode})`);
  console.log(`  Active term: ${term.id}`);
  console.log(`  Active enrollments: ${enrollments.length}`);
  console.log(`  Missing class relation: ${orphanedClass.length}`);
  console.log(`  Missing stream relation: ${orphanedStream.length}`);

  if (orphanedClass.length > 0) {
    console.log("  Enrollments with orphaned classId:");
    for (const e of orphanedClass) {
      console.log(
        `    enrollmentId=${e.id}  studentAdmNo=${e.student?.admissionNumber ?? "(unknown)"}  classId=${e.classId}`,
      );
    }
  }

  if (orphanedStream.length > 0) {
    console.log("  Enrollments with orphaned streamId:");
    for (const e of orphanedStream) {
      console.log(
        `    enrollmentId=${e.id}  studentAdmNo=${e.student?.admissionNumber ?? "(unknown)"}  streamId=${e.streamId}`,
      );
    }
  }

  if (orphanedClass.length === 0 && orphanedStream.length === 0) {
    console.log("  All enrollments have valid class and stream references.");
  }
}

async function main() {
  const arg = process.argv[2];

  if (arg) {
    await auditSchool(arg);
  } else {
    const schools = await prisma.school.findMany({ select: { code: true }, orderBy: { code: "asc" } });
    if (schools.length === 0) {
      console.log("No schools found in database.");
    }
    for (const school of schools) {
      await auditSchool(school.code);
    }
  }

  await prisma.$disconnect();
}

main().catch((err: unknown) => {
  console.error("Audit failed:", err);
  process.exit(1);
});
