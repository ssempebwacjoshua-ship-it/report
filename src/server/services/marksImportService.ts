import type { PrismaClient } from "@prisma/client";
import type { ImportPreview, RawMarkImportRow } from "../../shared/types/imports";
import { parseMarksCsv } from "../adapters/csvMarksParser";
import { finalizedStatus, toAssessmentType, validateImportRows } from "./marksImportValidator";

function norm(value: string): string {
  return value.trim().toLowerCase();
}

export async function dryRunMarksImport(prisma: PrismaClient, schoolCode: string, csvText: string): Promise<ImportPreview> {
  const rows = parseMarksCsv(csvText);
  const validated = await validateImportRows(prisma, schoolCode, rows);
  return {
    status: "DRY_RUN",
    totalRows: validated.length,
    validRows: validated.filter((row) => row.isValid).length,
    invalidRows: validated.filter((row) => !row.isValid).length,
    rows: validated,
  };
}

export async function commitMarksImport(prisma: PrismaClient, schoolCode: string, csvText: string): Promise<ImportPreview> {
  const rows = parseMarksCsv(csvText);
  const validated = await validateImportRows(prisma, schoolCode, rows);
  if (validated.some((row) => !row.isValid)) {
    return {
      status: "FAILED",
      totalRows: validated.length,
      validRows: validated.filter((row) => row.isValid).length,
      invalidRows: validated.filter((row) => !row.isValid).length,
      rows: validated,
    };
  }

  const school = await prisma.school.findUniqueOrThrow({
    where: { code: schoolCode },
    include: {
      classes: { include: { streams: true } },
      students: true,
      subjects: true,
      academicYears: { where: { isActive: true }, include: { terms: { where: { isActive: true } } } },
    },
  });
  const activeYear = school.academicYears[0];
  const activeTerm = activeYear.terms[0];

  const batch = await prisma.markImportBatch.create({
    data: {
      schoolId: school.id,
      status: "COMMITTED",
      source: "csv",
      summary: `${validated.length} rows committed`,
      rows: {
        create: validated.map((row) => ({
          rowNumber: row.rowNumber,
          raw: row.raw,
          isValid: row.isValid,
          errors: row.errors,
        })),
      },
    },
  });

  for (const row of validated) {
    const raw = row.raw as RawMarkImportRow;
    const student = school.students.find((item) => norm(item.admissionNumber) === norm(raw.admissionNumber))!;
    const klass = school.classes.find((item) => norm(item.name) === norm(raw.class) || norm(item.code) === norm(raw.class))!;
    const stream = klass.streams.find((item) => norm(item.name) === norm(raw.stream) || norm(item.code) === norm(raw.stream))!;
    const subject = school.subjects.find((item) => norm(item.name) === norm(raw.subject) || norm(item.code) === norm(raw.subject))!;

    await prisma.subjectMark.upsert({
      where: {
        studentId_subjectId_termId_assessmentType: {
          studentId: student.id,
          subjectId: subject.id,
          termId: activeTerm.id,
          assessmentType: toAssessmentType(raw.examType),
        },
      },
      update: {
        marks: Number(raw.marks),
        comments: raw.comments ?? null,
        status: finalizedStatus(),
        importBatchId: batch.id,
      },
      create: {
        schoolId: school.id,
        studentId: student.id,
        academicYearId: activeYear.id,
        termId: activeTerm.id,
        classId: klass.id,
        streamId: stream.id,
        subjectId: subject.id,
        assessmentType: toAssessmentType(raw.examType),
        marks: Number(raw.marks),
        comments: raw.comments ?? null,
        status: finalizedStatus(),
        importBatchId: batch.id,
      },
    });
  }

  return { status: "COMMITTED", batchId: batch.id, totalRows: validated.length, validRows: validated.length, invalidRows: 0, rows: validated };
}
