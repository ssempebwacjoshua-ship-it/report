import "dotenv/config";
import { pathToFileURL } from "node:url";
import { prisma } from "../src/server/db/prisma";
import { seedPreviewData, PREVIEW_SCHOOL_CODE } from "./seed-preview";

export const S1_MARKS_SEED_KEY = "reports-lab-s1-olevel-test-marks";

function deterministicMark(studentIndex: number, subjectIndex: number, examType: "BOT" | "EOT"): number {
  const performanceBand = [86, 78, 67, 54, 82, 61, 43][studentIndex] ?? 58;
  const subjectShift = ((subjectIndex * 7) % 15) - 7;
  const examShift = examType === "EOT" ? 4 : -2;
  return Math.max(35, Math.min(96, performanceBand + subjectShift + examShift));
}

export async function seedS1Marks() {
  await seedPreviewData();

  const school = await prisma.school.findUniqueOrThrow({
    where: { code: PREVIEW_SCHOOL_CODE },
    include: {
      subjects: { where: { isActive: true }, orderBy: { sortOrder: "asc" } },
      academicYears: { where: { isActive: true }, include: { terms: { where: { isActive: true } } } },
    },
  });
  const academicYear = school.academicYears[0];
  const term = academicYear.terms[0];
  const enrollments = await prisma.classEnrollment.findMany({
    where: { academicYearId: academicYear.id, termId: term.id, isActive: true, class: { level: 1 }, student: { isActive: true } },
    include: { student: true, class: true, stream: true },
    orderBy: [{ student: { admissionNumber: "asc" } }],
  });

  let count = 0;
  for (const [studentIndex, enrollment] of enrollments.entries()) {
    for (const [subjectIndex, subject] of school.subjects.entries()) {
      for (const assessmentType of ["BOT", "EOT"] as const) {
        await prisma.subjectMark.upsert({
          where: {
            studentId_subjectId_termId_assessmentType: {
              studentId: enrollment.studentId,
              subjectId: subject.id,
              termId: term.id,
              assessmentType,
            },
          },
          update: {
            marks: deterministicMark(studentIndex, subjectIndex, assessmentType),
            status: "FINALIZED",
            comments: `${assessmentType} ${subject.name} seed mark`,
            seedKey: S1_MARKS_SEED_KEY,
            classId: enrollment.classId,
            streamId: enrollment.streamId,
          },
          create: {
            schoolId: school.id,
            studentId: enrollment.studentId,
            academicYearId: academicYear.id,
            termId: term.id,
            classId: enrollment.classId,
            streamId: enrollment.streamId,
            subjectId: subject.id,
            assessmentType,
            marks: deterministicMark(studentIndex, subjectIndex, assessmentType),
            status: "FINALIZED",
            comments: `${assessmentType} ${subject.name} seed mark`,
            seedKey: S1_MARKS_SEED_KEY,
          },
        });
        count += 1;
      }
    }
  }

  await prisma.auditLog.create({
    data: {
      schoolId: school.id,
      action: "seed.s1_marks",
      correlationId: S1_MARKS_SEED_KEY,
      details: { students: enrollments.length, subjects: school.subjects.length, marks: count },
    },
  });

  return { school, academicYear, term, students: enrollments.length, subjects: school.subjects.length, marks: count };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  seedS1Marks()
    .then((result) => {
      console.log(`Seeded ${result.marks} finalized BOT/EOT marks for ${result.students} S1 students.`);
    })
    .finally(async () => prisma.$disconnect());
}
