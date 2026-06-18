import type { AssessmentType, MarkStatus, PrismaClient } from "@prisma/client";
import type { RawMarkImportRow, ValidatedMarkImportRow } from "../../shared/types/imports";
import type { SettingsSections } from "../../shared/types/settings";
import { getSettingsSections } from "../repositories/settingsRepository";
import { validateScore } from "../../shared/utils/validateScore";

export type ImportReferenceData = Awaited<ReturnType<typeof loadImportReferenceData>>;

const validExamTypes = new Set(["BOT", "MOT", "EOT"]);

function norm(value: string): string {
  return value.trim().toLowerCase();
}

export async function loadImportReferenceData(prisma: PrismaClient, schoolCode: string) {
  const school = await prisma.school.findUnique({
    where: { code: schoolCode },
    include: {
      classes: { include: { streams: true } },
      students: true,
      subjects: true,
      academicYears: { where: { isActive: true }, include: { terms: { where: { isActive: true } } } },
    },
  });
  return school;
}

export async function validateImportRows(
  prisma: PrismaClient,
  schoolCode: string,
  rows: RawMarkImportRow[],
  settings?: SettingsSections,
): Promise<ValidatedMarkImportRow[]> {
  const appSettings = settings ?? await getSettingsSections(prisma, schoolCode);
  const school = await loadImportReferenceData(prisma, schoolCode);
  if (!school) {
    return rows.map((raw, index) => ({ rowNumber: index + 2, raw, isValid: false, errors: [`School ${schoolCode} was not found.`] }));
  }

  const activeYear = school.academicYears[0];
  const activeTerm = activeYear?.terms[0];
  const existingMarks = activeTerm
    ? await prisma.subjectMark.findMany({
        where: {
          schoolId: school.id,
          termId: activeTerm.id,
          status: "FINALIZED",
          ...(appSettings.approval.protectCommittedMarksFromEditing ? {} : { importBatchId: null, seedKey: null }),
        },
      })
    : [];
  const lockedMarkKeys = new Set(existingMarks.map((mark) => `${mark.studentId}:${mark.subjectId}:${mark.assessmentType}`));

  return rows.map((raw, index) => {
    const errors: string[] = [];
    const student = school.students.find((item) => norm(item.admissionNumber) === norm(raw.admissionNumber));
    const klass = school.classes.find((item) => norm(item.name) === norm(raw.class) || norm(item.code) === norm(raw.class));
    const stream = klass?.streams.find((item) => norm(item.name) === norm(raw.stream) || norm(item.code) === norm(raw.stream));
    const subject = school.subjects.find((item) => norm(item.name) === norm(raw.subject) || norm(item.code) === norm(raw.subject));
    const examType = toAssessmentType(raw.examType);
    if (!raw.admissionNumber) errors.push("Admission number is required.");
    if (!student) errors.push(`Admission number ${raw.admissionNumber} was not found.`);
    if (!klass) errors.push(`Class ${raw.class} was not found.`);
    if (!stream) errors.push(`Stream ${raw.stream} was not found for class ${raw.class}.`);
    if (!subject) errors.push(`Subject ${raw.subject} was not found.`);
    if (!activeTerm) errors.push("No active term is configured.");
    if (activeTerm && norm(raw.term) !== norm(activeTerm.name)) errors.push(`Term must match active term ${activeTerm.name}.`);
    if (!validExamTypes.has(examType)) errors.push("Exam type must be BOT, MOT, or EOT.");
    const markText = raw.marks.trim().toUpperCase();
    if (markText === "") {
      errors.push("Blank marks are missing, not zero. Enter 0-100, AB, or EX.");
    } else if (markText === "AB" || markText === "EX") {
      errors.push(`${markText} is valid on handwritten sheets but is not committed as a numeric mark.`);
    } else {
      const scoreCheck = validateScore(raw.marks);
      if (!scoreCheck.valid) errors.push(scoreCheck.error);
    }
    if (student && subject && validExamTypes.has(examType) && lockedMarkKeys.has(`${student.id}:${subject.id}:${examType}`)) {
      errors.push("A finalized non-import-owned mark already exists for this student, subject, and exam type.");
    }

    return { rowNumber: index + 2, raw, isValid: errors.length === 0, errors };
  });
}

export function toAssessmentType(value: string): AssessmentType {
  const upper = value.trim().toUpperCase();
  if (upper === "MID TERM" || upper === "MIDTERM" || upper === "MID-TERM") return "MOT" as AssessmentType;
  return upper as AssessmentType;
}

export function finalizedStatus(): MarkStatus {
  return "FINALIZED";
}

