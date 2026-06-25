import type { PrismaClient } from "@prisma/client";
import { createHash } from "node:crypto";
import type { ImportPreview, RawMarkImportRow, ValidatedMarkImportRow } from "../../shared/types/imports";
import { parseMarksCsv } from "../adapters/csvMarksParser";
import { getSettingsSections } from "../repositories/settingsRepository";
import { finalizedStatus, toAssessmentType, validateImportRows } from "./marksImportValidator";
import { validateScoreEntry } from "./scoreValidationService";

function norm(value: string): string {
  return value.trim().toLowerCase();
}

function dryRunFingerprint(schoolCode: string, csvText: string): string {
  return createHash("sha256").update(`${schoolCode}\n${csvText.trim()}`).digest("hex");
}

function buildCsvBatchSummary(input: {
  lifecycleState: "PARSED" | "DRY_RUN" | "VALIDATED" | "COMMITTING" | "COMMITTED" | "FAILED";
  totalRows: number;
  validRows: number;
  invalidRows: number;
  committedRows: number;
  skippedRows: number;
  message?: string;
}) {
  return JSON.stringify({
    source: "csv",
    lifecycleState: input.lifecycleState,
    totalRows: input.totalRows,
    validRows: input.validRows,
    invalidRows: input.invalidRows,
    committedRows: input.committedRows,
    skippedRows: input.skippedRows,
    message: input.message ?? "",
  });
}

async function recordDryRun(prisma: PrismaClient, schoolId: string, fingerprint: string) {
  await prisma.auditLog.create({
    data: {
      schoolId,
      action: "marks.dry_run",
      correlationId: fingerprint,
      details: { fingerprint },
    },
  });
}

async function hasRecentDryRun(prisma: PrismaClient, schoolId: string, fingerprint: string) {
  const since = new Date(Date.now() - 1000 * 60 * 60 * 4);
  const log = await prisma.auditLog.findFirst({
    where: {
      schoolId,
      action: "marks.dry_run",
      correlationId: fingerprint,
      createdAt: { gte: since },
    },
  });
  return Boolean(log);
}

async function persistFailedBatch(
  prisma: PrismaClient,
  schoolId: string,
  rows: ValidatedMarkImportRow[],
  message: string,
) {
  const batch = await prisma.markImportBatch.create({
    data: {
      schoolId,
      status: "FAILED",
      source: "csv",
      summary: buildCsvBatchSummary({
        lifecycleState: "FAILED",
        totalRows: rows.length,
        validRows: rows.filter((row) => row.isValid).length,
        invalidRows: rows.filter((row) => !row.isValid).length,
        committedRows: 0,
        skippedRows: rows.length,
        message,
      }),
      rows: {
        create: rows.map((row) => ({
          rowNumber: row.rowNumber,
          raw: row.raw,
          isValid: row.isValid,
          errors: row.errors,
        })),
      },
    },
  });
  return batch.id;
}

function rowsWithAppendedError(rows: ValidatedMarkImportRow[], message: string): ValidatedMarkImportRow[] {
  return rows.map((row) => ({
    ...row,
    isValid: false,
    errors: row.errors.includes(message) ? row.errors : [...row.errors, message],
  }));
}

export async function dryRunMarksImport(prisma: PrismaClient, schoolCode: string, csvText: string): Promise<ImportPreview> {
  const rows = parseMarksCsv(csvText);
  const settings = await getSettingsSections(prisma, schoolCode);
  const validated = await validateImportRows(prisma, schoolCode, rows, settings);
  const school = await prisma.school.findUnique({ where: { code: schoolCode }, select: { id: true } });
  if (school && settings.approval.keepAuditTrail) {
    await recordDryRun(prisma, school.id, dryRunFingerprint(schoolCode, csvText));
  }
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
  const settings = await getSettingsSections(prisma, schoolCode);
  const validated = await validateImportRows(prisma, schoolCode, rows, settings);
  const school = await prisma.school.findUniqueOrThrow({
    where: { code: schoolCode },
    include: {
      classes: { include: { streams: true } },
      students: true,
      subjects: true,
      academicYears: { where: { isActive: true }, include: { terms: { where: { isActive: true } } } },
    },
  });

  if (settings.approval.requireDryRunBeforeCommit) {
    const hasDryRun = await hasRecentDryRun(prisma, school.id, dryRunFingerprint(schoolCode, csvText));
    if (!hasDryRun) {
      const failedRows = rowsWithAppendedError(validated, "Dry-run validation is required before commit.");
      const batchId = await persistFailedBatch(prisma, school.id, failedRows, "Dry-run validation is required before commit.");
      return {
        status: "FAILED",
        batchId,
        totalRows: failedRows.length,
        validRows: 0,
        invalidRows: failedRows.length,
        rows: failedRows,
      };
    }
  }

  if (validated.some((row) => !row.isValid)) {
    const batchId = await persistFailedBatch(prisma, school.id, validated, "Import validation failed.");
    return {
      status: "FAILED",
      batchId,
      totalRows: validated.length,
      validRows: validated.filter((row) => row.isValid).length,
      invalidRows: validated.filter((row) => !row.isValid).length,
      rows: validated,
    };
  }

  const activeYear = school.academicYears[0];
  const activeTerm = activeYear.terms[0];

  try {
    const batchId = await prisma.$transaction(async (tx) => {
      const batch = await tx.markImportBatch.create({
        data: {
          schoolId: school.id,
          status: "DRY_RUN",
          source: "csv",
          summary: buildCsvBatchSummary({
            lifecycleState: "COMMITTING",
            totalRows: validated.length,
            validRows: validated.length,
            invalidRows: 0,
            committedRows: 0,
            skippedRows: 0,
            message: "Committing validated rows.",
          }),
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
        const score = validateScoreEntry(raw.marks);

        if (!score.valid || score.kind !== "numeric") {
          throw new Error(`Row ${row.rowNumber} has an invalid numeric mark.`);
        }

        await tx.subjectMark.upsert({
          where: {
            studentId_subjectId_termId_assessmentType: {
              studentId: student.id,
              subjectId: subject.id,
              termId: activeTerm.id,
              assessmentType: toAssessmentType(raw.examType),
            },
          },
          update: {
            marks: score.numericValue,
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
            marks: score.numericValue,
            comments: raw.comments ?? null,
            status: finalizedStatus(),
            importBatchId: batch.id,
          },
        });
      }

      await tx.markImportBatch.update({
        where: { id: batch.id },
        data: {
          status: "COMMITTED",
          summary: buildCsvBatchSummary({
            lifecycleState: "COMMITTED",
            totalRows: validated.length,
            validRows: validated.length,
            invalidRows: 0,
            committedRows: validated.length,
            skippedRows: 0,
            message: `Committed ${validated.length} rows.`,
          }),
        },
      });

      await tx.auditLog.create({
        data: {
          schoolId: school.id,
          action: "marks.imported",
          correlationId: batch.id,
          details: { batchId: batch.id, source: "csv", totalRows: validated.length, successCount: validated.length, failedCount: 0 },
        },
      });

      return batch.id;
    });

    return {
      status: "COMMITTED",
      batchId,
      totalRows: validated.length,
      validRows: validated.length,
      invalidRows: 0,
      rows: validated,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not commit marks import.";
    const failedRows = rowsWithAppendedError(validated, message);
    const batchId = await persistFailedBatch(prisma, school.id, failedRows, "Commit failed. No marks were written.");
    return {
      status: "FAILED",
      batchId,
      totalRows: failedRows.length,
      validRows: 0,
      invalidRows: failedRows.length,
      rows: failedRows,
    };
  }
}
