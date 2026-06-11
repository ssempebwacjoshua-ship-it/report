import "dotenv/config";
import { pathToFileURL } from "node:url";
import { prisma } from "../src/server/db/prisma";
import { O_LEVEL_SUBJECTS } from "../src/shared/constants/subjects";
import { PREVIEW_SCHOOL_CODE } from "./seed-preview";
import { S1_MARKS_SEED_KEY } from "./seed-s1-marks-test";
import { loadReportEngineInput } from "../src/server/repositories/reportsRepository";
import { buildReports } from "../src/server/services/reportEngine";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

export async function verifyS1Marks() {
  const school = await prisma.school.findUnique({
    where: { code: PREVIEW_SCHOOL_CODE },
    include: {
      subjects: { where: { isActive: true } },
      classes: { include: { streams: true } },
      academicYears: { where: { isActive: true }, include: { terms: { where: { isActive: true } } } },
    },
  });
  assert(school, "school exists");
  const academicYear = school.academicYears[0];
  assert(academicYear, "active academic year exists");
  const term = academicYear.terms[0];
  assert(term, "active term exists");

  const senior1A = school.classes.find((klass) => klass.name === "Senior 1 A");
  const senior1B = school.classes.find((klass) => klass.name === "Senior 1 B");
  assert(senior1A, "Senior 1 A exists");
  assert(senior1B, "Senior 1 B exists");
  assert(senior1A.streams.some((stream) => stream.code === "A"), "Senior 1 A stream exists");
  assert(senior1B.streams.some((stream) => stream.code === "B"), "Senior 1 B stream exists");
  assert(school.subjects.length === O_LEVEL_SUBJECTS.length, "15 subjects exist");

  const enrollments = await prisma.classEnrollment.findMany({
    where: { academicYearId: academicYear.id, termId: term.id, isActive: true, class: { level: 1 } },
    include: { student: true, class: true, stream: true },
  });
  assert(enrollments.some((enrollment) => enrollment.classId === senior1A.id), "students exist in Senior 1 A");
  assert(enrollments.some((enrollment) => enrollment.classId === senior1B.id), "students exist in Senior 1 B");

  const expectedMarks = enrollments.length * O_LEVEL_SUBJECTS.length * 2;
  const seededMarks = await prisma.subjectMark.count({
    where: { seedKey: S1_MARKS_SEED_KEY, termId: term.id, status: "FINALIZED" },
  });
  assert(seededMarks === expectedMarks, `expected ${expectedMarks} finalized seed marks, found ${seededMarks}`);

  for (const klass of [senior1A, senior1B]) {
    const report = buildReports(
      await loadReportEngineInput(prisma, {
        schoolCode: PREVIEW_SCHOOL_CODE,
        academicYearId: academicYear.id,
        termId: term.id,
        classId: klass.id,
        assessmentType: "ALL",
      }),
    );
    assert(report.cards.length > 0, `${klass.name} report cards are produced`);
    assert(report.cards[0].subjects.length === O_LEVEL_SUBJECTS.length, `${klass.name} first student has all subjects`);
    assert(report.cards.every((card) => card.readiness === "READY"), `${klass.name} cards are ready`);
  }

  return {
    school: school.code,
    academicYear: academicYear.name,
    term: term.name,
    students: enrollments.length,
    subjects: school.subjects.length,
    finalizedMarks: seededMarks,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  verifyS1Marks()
    .then((summary) => {
      console.log("S1 marks verification passed.");
      console.table(summary);
    })
    .finally(async () => prisma.$disconnect());
}
