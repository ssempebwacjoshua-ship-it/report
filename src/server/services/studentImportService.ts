import { parse as parseCsv } from "csv-parse/sync";
import { read, utils } from "xlsx";
import type { PrismaClient } from "@prisma/client";
import type {
  StudentImportMode,
  StudentImportPreview,
  StudentImportPreviewRow,
  StudentImportRowInput,
} from "../../shared/types/students";
import { generateAdmissionNumber } from "./studentAdmissionNumberService";

const PREVIEW_LIMIT = 100;
const BATCH_SIZE = 400;

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : value == null ? "" : String(value).trim();
}

function norm(value: string) {
  return value.trim().toLowerCase();
}

function splitName(fullName: string) {
  const parts = fullName.trim().split(/\s+/);
  return { firstName: parts[0] ?? "", lastName: parts.slice(1).join(" ") };
}

function normalizeGender(value: string) {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return "";
  if (["m", "male", "boy"].includes(normalized)) return "Male";
  if (["f", "female", "girl"].includes(normalized)) return "Female";
  if (["other", "unknown", "x"].includes(normalized)) return "Other";
  return value.trim();
}

function normalizePhone(value: string) {
  return value.trim().replace(/[^\d+\s()-]/g, "");
}

function inferClassLevel(name: string) {
  const match = name.match(/(\d+)/);
  return match ? Number(match[1]) : 0;
}

function serializeSummary(summary: Record<string, unknown>) {
  return JSON.stringify(summary);
}

function deserializeSummary(summary: string | null | undefined) {
  if (!summary) return {};
  try {
    return JSON.parse(summary) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export function parseStudentsCsv(csvText: string): StudentImportRowInput[] {
  const records = parseCsv(csvText, { columns: true, skip_empty_lines: true, trim: true }) as Record<string, unknown>[];
  return records.map((row) => ({
    admissionNumber: text(row.admissionNumber),
    fullName: text(row.fullName),
    gender: text(row.gender),
    className: text(row.class),
    streamName: text(row.stream),
    guardianName: text(row.guardianName),
    guardianPhone: normalizePhone(text(row.guardianPhone)),
    guardianEmail: text(row.guardianEmail),
    status: text(row.status),
  }));
}

export function parseStudentsXlsx(buffer: Buffer): StudentImportRowInput[] {
  const workbook = read(buffer, { type: "buffer" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
  return rows.map((row) => ({
    admissionNumber: text(row.admissionNumber),
    fullName: text(row.fullName),
    gender: text(row.gender),
    className: text(row.class),
    streamName: text(row.stream),
    guardianName: text(row.guardianName),
    guardianPhone: normalizePhone(text(row.guardianPhone)),
    guardianEmail: text(row.guardianEmail),
    status: text(row.status),
  }));
}

function validateRequiredColumns(rows: StudentImportRowInput[]) {
  if (rows.length === 0) throw new Error("Import file is empty.");
}

async function resolveSchool(prisma: PrismaClient, schoolCode: string) {
  return prisma.school.findUnique({
    where: { code: schoolCode },
    include: {
      classes: { include: { streams: true } },
      students: true,
      academicYears: { where: { isActive: true }, include: { terms: { where: { isActive: true } } } },
    },
  });
}

async function buildPreview(prisma: PrismaClient, schoolCode: string, rows: StudentImportRowInput[], mode: StudentImportMode = "CREATE_ONLY"): Promise<StudentImportPreview> {
  const school = await resolveSchool(prisma, schoolCode);
  if (!school) throw new Error(`School ${schoolCode} was not found.`);
  validateRequiredColumns(rows);

  const seen = new Set<string>();
  const previewRows: StudentImportPreviewRow[] = [];
  let duplicateRows = 0;

  for (let i = 0; i < rows.length; i += 1) {
    const raw = rows[i]!;
    const errors: string[] = [];
    const klass = school.classes.find((item) => norm(item.name) === norm(raw.className) || norm(item.code) === norm(raw.className));
    const stream = klass?.streams.find((item) => norm(item.name) === norm(raw.streamName) || norm(item.code) === norm(raw.streamName));
    const admissionNumber = raw.admissionNumber?.trim() || "";

    if (!admissionNumber) errors.push("Admission number is required.");
    if (!raw.fullName.trim()) errors.push("Full name is required.");
    if (!raw.gender.trim()) errors.push("Gender is required.");
    if (!raw.className.trim()) errors.push("Class is required.");
    if (!raw.streamName.trim()) errors.push("Stream is required.");
    if (raw.gender && !normalizeGender(raw.gender)) errors.push("Invalid gender.");
    if (raw.guardianEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw.guardianEmail)) errors.push("Guardian email must be valid.");
    if (raw.guardianPhone && !/^[+]?[0-9\s()-]+$/.test(raw.guardianPhone)) errors.push("Guardian phone must be valid.");

    const effectiveAdmission = admissionNumber || (await generateAdmissionNumber(prisma, schoolCode, raw.className, raw.streamName));
    if (seen.has(norm(effectiveAdmission))) {
      errors.push(`Duplicate admission number in file: ${effectiveAdmission}.`);
      duplicateRows += 1;
    }
    seen.add(norm(effectiveAdmission));

    const existing = school.students.find((item) => norm(item.admissionNumber) === norm(effectiveAdmission));
    if (existing && mode === "CREATE_ONLY") errors.push("Existing student found.");

    const action = errors.length ? "invalid" : existing ? "update" : "create";
    previewRows.push({
      rowNumber: i + 2,
      raw,
      isValid: errors.length === 0 || (existing && mode === "CREATE_AND_UPDATE_EXISTING"),
      errors,
      action,
      existingStudentId: existing?.id ?? null,
      generatedAdmissionNumber: raw.admissionNumber ? null : effectiveAdmission,
    });
  }

  const visibleRows = previewRows.slice(0, PREVIEW_LIMIT);
  const validRows = previewRows.filter((row) => row.isValid).length;
  return {
    status: "PREVIEW",
    totalRows: previewRows.length,
    validRows,
    invalidRows: previewRows.length - validRows,
    duplicateRows,
    createRows: previewRows.filter((row) => row.action === "create" && row.isValid).length,
    updateRows: previewRows.filter((row) => row.action === "update" && row.isValid).length,
    rows: visibleRows,
    mode,
  };
}

async function processChunk(prisma: PrismaClient, schoolId: string, schoolCode: string, rows: StudentImportPreviewRow[], activeYearId: string, activeTermId: string, mode: StudentImportMode) {
  let successCount = 0;
  let duplicateCount = 0;
  let failedCount = 0;
  const rowErrors: Array<{ rowNumber: number; errors: string[] }> = [];

  for (const row of rows) {
    try {
      const admissionNumber = row.raw.admissionNumber?.trim() || row.generatedAdmissionNumber || "";
      if (!admissionNumber) throw new Error("Admission number is required.");
      if (row.errors.length > 0 && row.action === "invalid") {
        failedCount += 1;
        rowErrors.push({ rowNumber: row.rowNumber, errors: row.errors });
        continue;
      }
      if (row.action === "update" && row.existingStudentId && mode === "CREATE_AND_UPDATE_EXISTING") {
        const name = splitName(row.raw.fullName);
        await prisma.student.update({
          where: { id: row.existingStudentId },
          data: {
            firstName: name.firstName,
            lastName: name.lastName,
            isActive: row.raw.status?.toLowerCase() !== "inactive",
          },
        });
        successCount += 1;
        continue;
      }

      const klass =
        (await prisma.schoolClass.findFirst({ where: { schoolId, OR: [{ name: row.raw.className }, { code: row.raw.className }] } })) ??
        (await prisma.schoolClass.create({ data: { schoolId, name: row.raw.className, code: row.raw.className, level: inferClassLevel(row.raw.className) } }));
      const stream =
        (await prisma.stream.findFirst({ where: { schoolId, classId: klass.id, OR: [{ name: row.raw.streamName }, { code: row.raw.streamName }] } })) ??
        (await prisma.stream.create({ data: { schoolId, classId: klass.id, name: row.raw.streamName, code: row.raw.streamName } }));

      const created = await prisma.student.create({
        data: {
          schoolId,
          admissionNumber,
          firstName: row.raw.fullName.trim(),
          lastName: "",
          isActive: row.raw.status?.toLowerCase() !== "inactive",
        },
      });
      await prisma.classEnrollment.create({
        data: {
          studentId: created.id,
          academicYearId: activeYearId,
          termId: activeTermId,
          classId: klass.id,
          streamId: stream.id,
          isActive: row.raw.status?.toLowerCase() !== "inactive",
          status: row.raw.status?.toLowerCase() === "inactive" ? "INACTIVE" : "ACTIVE",
        },
      });
      if (row.raw.guardianName || row.raw.guardianPhone || row.raw.guardianEmail) {
        await prisma.guardianContact.create({
          data: {
            schoolId,
            studentId: created.id,
            guardianName: row.raw.guardianName || "Parent/Guardian",
            relationship: "Parent",
            phone: row.raw.guardianPhone || null,
            email: row.raw.guardianEmail || null,
            preferredContactMethod: row.raw.guardianPhone ? "PHONE" : "EMAIL",
            isPrimary: true,
            canReceiveReports: true,
          },
        });
      }
      successCount += 1;
    } catch (error) {
      failedCount += 1;
      rowErrors.push({ rowNumber: row.rowNumber, errors: [error instanceof Error ? error.message : "Failed to import row"] });
    }
  }

  return { successCount, duplicateCount, failedCount, rowErrors };
}

async function processImportJob(prisma: PrismaClient, batchId: string, schoolCode: string, mode: StudentImportMode) {
  const batch = await prisma.markImportBatch.findUnique({
    where: { id: batchId },
    include: { school: { include: { classes: { include: { streams: true } }, students: true, academicYears: { where: { isActive: true }, include: { terms: { where: { isActive: true } } } } } } },
  });
  if (!batch || batch.source !== "student") return;
  console.log("[student-import] processor picked job", { batchId });
  const summary = deserializeSummary(batch.summary);
  const rows = (summary.rows as StudentImportPreviewRow[] | undefined) ?? [];
  const totalRows = rows.length;
  const activeYear = batch.school.academicYears[0];
  const activeTerm = activeYear?.terms[0];
  if (!activeYear || !activeTerm) {
    await prisma.markImportBatch.update({ where: { id: batchId }, data: { status: "FAILED", summary: serializeSummary({ ...summary, status: "failed", lastError: "An active academic year and term are required before importing students." }) } });
    return;
  }

  let processedRows = 0;
  let successCount = 0;
  let failedCount = 0;
  let duplicateCount = 0;
  await prisma.markImportBatch.update({ where: { id: batchId }, data: { status: "DRY_RUN", summary: serializeSummary({ ...summary, status: "processing", totalRows, processedRows, successCount, failedCount, duplicateCount, startedAt: new Date().toISOString() }) } });
  console.log("[student-import] file loaded", { batchId, rows: totalRows });

  for (let index = 0; index < rows.length; index += BATCH_SIZE) {
    const chunk = rows.slice(index, index + BATCH_SIZE);
    console.log("[student-import] batch started", { batchId, offset: index, size: chunk.length });
    const result = await prisma.$transaction(async (tx) => {
      const chunkResult = await processChunk(tx, batch.schoolId, schoolCode, chunk, activeYear.id, activeTerm.id, mode);
      return chunkResult;
    });
    console.log("[student-import] batch completed", { batchId, offset: index, success: result.successCount, failed: result.failedCount });
    processedRows += chunk.length;
    successCount += result.successCount;
    failedCount += result.failedCount;
    duplicateCount += result.duplicateCount;
    for (const rowError of result.rowErrors) {
      await prisma.markImportRow.create({
        data: { batchId, rowNumber: rowError.rowNumber, raw: {}, isValid: false, errors: rowError.errors },
      });
    }
    await prisma.markImportBatch.update({
      where: { id: batchId },
      data: {
        summary: serializeSummary({ ...summary, status: "processing", totalRows, processedRows, successCount, failedCount, duplicateCount, updatedAt: new Date().toISOString() }),
      },
    });
    console.log("[student-import] processedRows updated", { batchId, processedRows, successCount, failedCount });
  }

  await prisma.markImportBatch.update({
    where: { id: batchId },
    data: { status: "COMMITTED", summary: serializeSummary({ ...summary, status: "completed", totalRows, processedRows, successCount, failedCount, duplicateCount, completedAt: new Date().toISOString() }) },
  });
  console.log("[student-import] job completed", { batchId, totalRows, processedRows, successCount, failedCount });
  await prisma.auditLog.create({
    data: {
      schoolId: batch.schoolId,
      action: "student.import.commit",
      details: { batchId, totalRows, processedRows, successCount, failedCount, duplicateCount },
    },
  });
}

export async function createStudentImportJob(prisma: PrismaClient, schoolCode: string, rows: StudentImportRowInput[], mode: StudentImportMode = "CREATE_ONLY") {
  const preview = await buildPreview(prisma, schoolCode, rows, mode);
  const school = await prisma.school.findUniqueOrThrow({ where: { code: schoolCode } });
  const batch = await prisma.markImportBatch.create({
    data: {
      schoolId: school.id,
      status: "DRY_RUN",
      source: "student",
      summary: serializeSummary({ ...preview, status: "queued", mode, rows: preview.rows }),
    },
  });
  console.log("[student-import] job created", { batchId: batch.id, totalRows: preview.totalRows, mode });
  void processImportJob(prisma, batch.id, schoolCode, mode).catch(async (error) => {
    console.error("[student-import] job failed", { batchId: batch.id, error: error instanceof Error ? error.message : "Import failed" });
    await prisma.markImportBatch.update({
      where: { id: batch.id },
      data: { status: "FAILED", summary: serializeSummary({ ...deserializeSummary(batch.summary), status: "failed", lastError: error instanceof Error ? error.message : "Import failed", updatedAt: new Date().toISOString() }) },
    });
  });
  return { jobId: batch.id, status: "QUEUED" as const, totalRows: preview.totalRows, validRows: preview.validRows, invalidRows: preview.invalidRows, duplicateRows: preview.duplicateRows };
}

export async function recoverStaleStudentImportJobs(prisma: PrismaClient) {
  const stale = await prisma.markImportBatch.findMany({
    where: { source: "student", status: "DRY_RUN", updatedAt: { lt: new Date(Date.now() - 5 * 60 * 1000) } },
    take: 10,
  });
  for (const batch of stale) {
    const summary = deserializeSummary(batch.summary);
    await prisma.markImportBatch.update({ where: { id: batch.id }, data: { status: "FAILED", summary: serializeSummary({ ...summary, status: "failed", lastError: "Import stalled. Please retry or contact admin.", updatedAt: new Date().toISOString() }) } });
  }
}

export async function getStudentImportJob(prisma: PrismaClient, schoolCode: string, jobId: string) {
  const school = await prisma.school.findUnique({ where: { code: schoolCode } });
  if (!school) return null;
  const batch = await prisma.markImportBatch.findFirst({ where: { id: jobId, schoolId: school.id, source: "student" } });
  if (!batch) return null;
  return { id: batch.id, status: batch.status, ...deserializeSummary(batch.summary), createdAt: batch.createdAt.toISOString(), updatedAt: batch.updatedAt.toISOString() };
}

export async function previewStudentImport(prisma: PrismaClient, schoolCode: string, rows: StudentImportRowInput[], mode: StudentImportMode = "CREATE_ONLY"): Promise<StudentImportPreview> {
  return buildPreview(prisma, schoolCode, rows, mode);
}

export async function commitStudentImport(prisma: PrismaClient, schoolCode: string, rows: StudentImportRowInput[], mode: StudentImportMode = "CREATE_ONLY") {
  if (rows.length > 500) {
    return createStudentImportJob(prisma, schoolCode, rows, mode);
  }
  const preview = await buildPreview(prisma, schoolCode, rows, mode);
  if (preview.invalidRows > 0) return { ...preview, status: "PREVIEW" as const };
  const queued = await createStudentImportJob(prisma, schoolCode, rows, mode);
  return { ...preview, ...queued, status: "COMMITTED" as const };
}
