import { parse as parseCsv } from "csv-parse/sync";
import type { PrismaClient } from "@prisma/client";
import { read, utils } from "xlsx";
import type {
  StudentImportMode,
  StudentImportPreview,
  StudentImportPreviewRow,
  StudentImportRowInput,
} from "../../shared/types/students";
import { ensureAcademicSettingsBackedByDatabase } from "../repositories/settingsRepository";
import { generateAdmissionNumber } from "./studentAdmissionNumberService";

/** Rows shown in the preview response. The full row set is always processed. */
const PREVIEW_RESPONSE_LIMIT = 50;
/** Rows per processing batch - small enough for steady progress, large enough to amortize round trips. */
const BATCH_SIZE = 50;
/** Maximum per-row errors retained in the job summary (for the error CSV). */
const ROW_ERROR_LIMIT = 1000;

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : value == null ? "" : String(value).trim();
}

function norm(value: string) {
  return value.trim().toLowerCase();
}

const NUMBER_WORDS: Record<string, string> = {
  one: "1",
  two: "2",
  three: "3",
  four: "4",
  five: "5",
  six: "6",
};

function lookupKey(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/\b(one|two|three|four|five|six)\b/g, (word) => NUMBER_WORDS[word] ?? word)
    .replace(/[^a-z0-9]+/g, "");
}

function uniqueValues(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

function classLookupKeys(value: string) {
  const key = lookupKey(value);
  const keys = [key];
  const match = key.match(/^(senior|primary|s|p)?(\d+)([a-z])?$/);
  if (match) {
    const number = match[2];
    const suffix = match[3] ?? "";
    keys.push(`senior${number}`, `s${number}`, `primary${number}`, `p${number}`);
    if (suffix) keys.push(`senior${number}${suffix}`, `s${number}${suffix}`);
  }
  return uniqueValues(keys);
}

function streamLookupKeys(value: string) {
  const key = lookupKey(value);
  const keys = [key];
  const match = key.match(/^(?:stream)?([a-z0-9]+)$/);
  if (match) keys.push(match[1]);
  return uniqueValues(keys);
}

function splitName(fullName: string) {
  const parts = fullName.trim().split(/\s+/);
  return { firstName: parts[0] ?? "", lastName: parts.slice(1).join(" ") };
}

function normalizePhone(value: string) {
  return value.trim().replace(/[^\d+\s()-]/g, "");
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

/**
 * Normalize a column header for fuzzy matching:
 * strip spaces, underscores, hyphens, dots, parens and lowercase everything.
 * "Admission Number", "admission_number", "AdmissionNumber" -> "admissionnumber"
 */
function normalizeKey(k: string): string {
  return String(k)
    .toLowerCase()
    .replace(/[\s_\-./()#]+/g, "");
}

/**
 * Build a normalized-key -> value lookup from a raw row object so we can
 * find a column regardless of how the user named it in their spreadsheet.
 */
function makeRowLookup(row: Record<string, unknown>): Map<string, unknown> {
  const map = new Map<string, unknown>();
  for (const [k, v] of Object.entries(row)) {
    map.set(normalizeKey(k), v);
  }
  return map;
}

/**
 * Pick a value from the normalized row using the first alias that matches.
 * All alias strings are themselves normalized before lookup.
 */
function pick(lookup: Map<string, unknown>, ...aliases: string[]): unknown {
  for (const alias of aliases) {
    const v = lookup.get(normalizeKey(alias));
    if (v !== undefined && v !== "") return v;
  }
  return "";
}

export function parseStudentsCsv(csvText: string): StudentImportRowInput[] {
  const records = parseCsv(csvText, {
    columns: (headers: string[]) => headers.map(normalizeKey),
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true,
  }) as Record<string, unknown>[];
  return records.map((row) => {
    const lk = makeRowLookup(row);
    return {
      admissionNumber: text(pick(lk, "admissionNumber", "admission number", "adm no", "adm", "admission_number", "admno", "admnumber")),
      fullName: text(pick(lk, "fullName", "full name", "name", "student name", "studentname", "student_name")),
      gender: text(pick(lk, "gender", "sex")),
      className: text(pick(lk, "class", "className", "class name", "classname", "class_name")),
      streamName: text(pick(lk, "stream", "streamName", "stream name", "streamname", "stream_name")),
      guardianName: text(pick(lk, "guardianName", "guardian name", "guardian", "parent name", "parentname", "parent_name")),
      guardianPhone: normalizePhone(text(pick(lk, "guardianPhone", "guardian phone", "phone", "mobile", "contact", "guardiancontact"))),
      guardianEmail: text(pick(lk, "guardianEmail", "guardian email", "email")),
      status: text(pick(lk, "status")),
    };
  });
}

export function parseStudentsXlsx(buffer: Buffer): StudentImportRowInput[] {
  const workbook = read(buffer, { type: "buffer" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
  return rows.map((row) => {
    const lk = makeRowLookup(row);
    return {
      admissionNumber: text(pick(lk, "admissionNumber", "admission number", "adm no", "adm", "admission_number", "admno", "admnumber")),
      fullName: text(pick(lk, "fullName", "full name", "name", "student name", "studentname", "student_name")),
      gender: text(pick(lk, "gender", "sex")),
      className: text(pick(lk, "class", "className", "class name", "classname", "class_name")),
      streamName: text(pick(lk, "stream", "streamName", "stream name", "streamname", "stream_name")),
      guardianName: text(pick(lk, "guardianName", "guardian name", "guardian", "parent name", "parentname", "parent_name")),
      guardianPhone: normalizePhone(text(pick(lk, "guardianPhone", "guardian phone", "phone", "mobile", "contact", "guardiancontact"))),
      guardianEmail: text(pick(lk, "guardianEmail", "guardian email", "email")),
      status: text(pick(lk, "status")),
    };
  });
}

function validateRequiredColumns(rows: StudentImportRowInput[]) {
  if (rows.length === 0) throw new Error("Import file is empty.");
}

async function resolveSchool(prisma: PrismaClient, schoolCode: string) {
  await ensureAcademicSettingsBackedByDatabase(prisma, schoolCode);
  return prisma.school.findUnique({
    where: { code: schoolCode },
    include: {
      classes: { include: { streams: true } },
      students: { select: { id: true, admissionNumber: true } },
      academicYears: {
        orderBy: [{ isActive: "desc" }, { startsOn: "desc" }],
        include: {
          terms: {
            orderBy: [{ isActive: "desc" }, { startsOn: "desc" }],
          },
        },
      },
    },
  });
}

type SchoolContext = NonNullable<Awaited<ReturnType<typeof resolveSchool>>>;

type EnrollmentContext = {
  academicYearId: string | null;
  termId: string | null;
  warnings: string[];
};

type ResolvedMaps = {
  classesByKey: Map<string, Array<{ id: string; name: string; code: string; streamByKey: Map<string, string> }>>;
  existingByAdm: Map<string, string>;
};

function buildMaps(school: SchoolContext): ResolvedMaps {
  const classesByKey = new Map<string, Array<{ id: string; name: string; code: string; streamByKey: Map<string, string> }>>();
  for (const klass of school.classes) {
    const streamByKey = new Map<string, string>();
    for (const stream of klass.streams) {
      for (const key of streamLookupKeys(stream.name)) streamByKey.set(key, stream.id);
      for (const key of streamLookupKeys(stream.code)) streamByKey.set(key, stream.id);
    }
    const entry = { id: klass.id, name: klass.name, code: klass.code, streamByKey };
    for (const key of uniqueValues([...classLookupKeys(klass.name), ...classLookupKeys(klass.code)])) {
      const bucket = classesByKey.get(key) ?? [];
      bucket.push(entry);
      classesByKey.set(key, bucket);
    }
  }
  const existingByAdm = new Map<string, string>();
  for (const student of school.students) existingByAdm.set(norm(student.admissionNumber), student.id);
  return { classesByKey, existingByAdm };
}

function resolveEnrollmentContext(school: SchoolContext): EnrollmentContext {
  const activeYear = school.academicYears.find((year) => year.isActive);
  const activeTerm = activeYear?.terms.find((term) => term.isActive);
  if (activeYear && activeTerm) {
    return { academicYearId: activeYear.id, termId: activeTerm.id, warnings: [] };
  }

  const latestYearWithTerm = school.academicYears.find((year) => year.terms.length > 0);
  const latestTerm = latestYearWithTerm?.terms[0];
  if (latestYearWithTerm && latestTerm) {
    return {
      academicYearId: latestYearWithTerm.id,
      termId: latestTerm.id,
      warnings: [
        `No active academic year/term is set. Import will use the latest available setup: ${latestYearWithTerm.name} / ${latestTerm.name}.`,
      ],
    };
  }

  const latestYear = school.academicYears[0];
  if (latestYear) {
    return {
      academicYearId: null,
      termId: null,
      warnings: [
        `No term is configured for ${latestYear.name}. Students can be created, but enrollments will be skipped until a term is added.`,
      ],
    };
  }

  return {
    academicYearId: null,
    termId: null,
    warnings: [
      "No academic year or term is configured. Students can be created, but enrollments will be skipped until setup is completed.",
    ],
  };
}

function resolveClassAndStream(maps: ResolvedMaps, className: string, streamName: string) {
  const candidates = new Map<string, { id: string; name: string; code: string; streamByKey: Map<string, string> }>();
  for (const key of classLookupKeys(className)) {
    for (const klass of maps.classesByKey.get(key) ?? []) candidates.set(klass.id, klass);
  }
  const streamKeys = streamLookupKeys(streamName);
  const withStream = [...candidates.values()]
    .map((klass) => ({
      klass,
      streamId: streamKeys.map((key) => klass.streamByKey.get(key)).find(Boolean) ?? null,
    }))
    .filter((item) => item.streamId);
  if (withStream.length === 1) return { klass: withStream[0].klass, streamId: withStream[0].streamId };
  if (withStream.length > 1) {
    const exactClassKey = lookupKey(className);
    const exact = withStream.find((item) => lookupKey(item.klass.name) === exactClassKey || lookupKey(item.klass.code) === exactClassKey);
    const canonical = exact ?? withStream.find((item) => /^s\d+$/i.test(item.klass.code) || /^senior\s+\d+$/i.test(item.klass.name));
    if (canonical) return { klass: canonical.klass, streamId: canonical.streamId };
    return { klass: withStream[0].klass, streamId: withStream[0].streamId };
  }
  const first = candidates.values().next().value as { id: string; name: string; code: string; streamByKey: Map<string, string> } | undefined;
  return { klass: first ?? null, streamId: null };
}

async function buildPreviewRows(prisma: PrismaClient, schoolCode: string, rows: StudentImportRowInput[], mode: StudentImportMode) {
  const t0 = Date.now();
  const school = await resolveSchool(prisma, schoolCode);
  if (!school) throw new Error(`School ${schoolCode} was not found.`);
  validateRequiredColumns(rows);
  const enrollmentContext = resolveEnrollmentContext(school);
  const maps = buildMaps(school);
  const { existingByAdm } = maps;

  const seen = new Set<string>();
  const previewRows: StudentImportPreviewRow[] = [];
  let duplicateRows = 0;

  for (let i = 0; i < rows.length; i += 1) {
    const raw = rows[i]!;
    const errors: string[] = [];
    const resolved = resolveClassAndStream(maps, raw.className, raw.streamName);
    const klass = resolved.klass;
    const streamId = resolved.streamId;
    const admissionNumber = raw.admissionNumber?.trim() || "";

    if (!raw.fullName.trim()) errors.push("Full name is required.");
    if (!raw.gender.trim()) errors.push("Gender is required.");
    if (!raw.className.trim()) errors.push("Class is required.");
    else if (!klass) errors.push(`Class "${raw.className}" does not match an existing class. Use names such as "Senior 1" or "S1".`);
    if (!raw.streamName.trim()) errors.push("Stream is required.");
    else if (klass && !streamId) errors.push(`Stream "${raw.streamName}" does not exist in class "${klass.name}". Create it first in School Structure or fix the stream column.`);
    if (raw.guardianEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw.guardianEmail)) errors.push("Guardian email must be valid.");
    if (raw.guardianPhone && !/^[+]?[0-9\s()-]+$/.test(raw.guardianPhone)) errors.push("Guardian phone must be valid.");

    let effectiveAdmission = admissionNumber;
    if (!effectiveAdmission && errors.length === 0) {
      try {
        effectiveAdmission = await generateAdmissionNumber(prisma, schoolCode, raw.className, raw.streamName, seen);
      } catch {
        errors.push("Could not auto-generate a unique admission number. Please provide one manually.");
        effectiveAdmission = `__GEN_${i}`;
      }
    } else if (!effectiveAdmission) {
      effectiveAdmission = `__INVALID_${i}`;
    }
    if (seen.has(norm(effectiveAdmission))) {
      errors.push(`Duplicate admission number in file: ${effectiveAdmission}.`);
    }
    seen.add(norm(effectiveAdmission));

    const existingStudentId = existingByAdm.get(norm(effectiveAdmission)) ?? null;
    let action: StudentImportPreviewRow["action"];
    if (errors.length > 0) {
      action = "invalid";
    } else if (existingStudentId) {
      action = mode === "CREATE_AND_UPDATE_EXISTING" ? "update" : "duplicate";
      if (action === "duplicate") duplicateRows += 1;
    } else {
      action = "create";
    }

    previewRows.push({
      rowNumber: i + 2,
      raw,
      isValid: action === "create" || action === "update",
      errors,
      action,
      existingStudentId,
      generatedAdmissionNumber: raw.admissionNumber ? null : effectiveAdmission,
      classId: klass?.id ?? null,
      streamId,
    });
  }

  console.log("[student-import] preview built", { schoolCode, rows: rows.length, ms: Date.now() - t0 });
  return { school, previewRows, duplicateRows, enrollmentContext };
}

function summarizePreview(
  previewRows: StudentImportPreviewRow[],
  duplicateRows: number,
  mode: StudentImportMode,
  warnings: string[],
): StudentImportPreview {
  const validRows = previewRows.filter((row) => row.isValid).length;
  return {
    status: "PREVIEW",
    totalRows: previewRows.length,
    validRows,
    invalidRows: previewRows.filter((row) => row.action === "invalid").length,
    duplicateRows,
    createRows: previewRows.filter((row) => row.action === "create").length,
    updateRows: previewRows.filter((row) => row.action === "update").length,
    rows: previewRows.slice(0, PREVIEW_RESPONSE_LIMIT),
    mode,
    warnings,
  };
}

type BatchOutcome = {
  successCount: number;
  createdCount: number;
  updatedCount: number;
  duplicateCount: number;
  failedCount: number;
  studentOnlyCount: number;
  rowErrors: Array<{ rowNumber: number; admissionNumber?: string; errors: string[] }>;
};

async function processBatch(
  prisma: PrismaClient,
  schoolId: string,
  rows: StudentImportPreviewRow[],
  academicYearId: string | null,
  termId: string | null,
  mode: StudentImportMode,
  existingByAdm: Map<string, string>,
): Promise<BatchOutcome> {
  let successCount = 0;
  let createdCount = 0;
  let updatedCount = 0;
  let duplicateCount = 0;
  let failedCount = 0;
  let studentOnlyCount = 0;
  const rowErrors: BatchOutcome["rowErrors"] = [];

  type CreateRow = { row: StudentImportPreviewRow; adm: string; isActive: boolean };
  const creates: CreateRow[] = [];
  const updates: StudentImportPreviewRow[] = [];

  for (const row of rows) {
    const adm = row.raw.admissionNumber?.trim() || row.generatedAdmissionNumber || "";
    if (row.action === "invalid" || !adm) {
      failedCount += 1;
      rowErrors.push({ rowNumber: row.rowNumber, admissionNumber: adm, errors: row.errors.length ? row.errors : ["Admission number is required."] });
      continue;
    }
    if (existingByAdm.has(norm(adm))) {
      if (mode === "CREATE_AND_UPDATE_EXISTING") {
        updates.push(row);
      } else {
        duplicateCount += 1;
        rowErrors.push({ rowNumber: row.rowNumber, admissionNumber: adm, errors: [`Student ${adm} already exists. Row skipped (append-only mode).`] });
      }
      continue;
    }
    if (!row.classId || !row.streamId) {
      failedCount += 1;
      rowErrors.push({ rowNumber: row.rowNumber, admissionNumber: adm, errors: ["Class/stream could not be resolved. Student was not imported."] });
      continue;
    }
    creates.push({ row, adm, isActive: row.raw.status?.toLowerCase() !== "inactive" });
    existingByAdm.set(norm(adm), "pending");
  }

  for (const row of updates) {
    try {
      const existingId = existingByAdm.get(norm(row.raw.admissionNumber?.trim() || row.generatedAdmissionNumber || ""));
      if (!existingId || existingId === "pending") throw new Error("Existing student id not found.");
      const name = splitName(row.raw.fullName);
      await prisma.student.update({
        where: { id: existingId },
        data: { firstName: name.firstName, lastName: name.lastName, isActive: row.raw.status?.toLowerCase() !== "inactive" },
      });
      successCount += 1;
      updatedCount += 1;
    } catch (error) {
      failedCount += 1;
      rowErrors.push({ rowNumber: row.rowNumber, errors: [error instanceof Error ? error.message : "Failed to update student"] });
    }
  }

  for (const c of creates) {
    const name = splitName(c.row.raw.fullName);
    try {
      const studentId = academicYearId && termId
        ? await prisma.$transaction(async (tx) => {
          const student = await tx.student.upsert({
            where: { schoolId_admissionNumber: { schoolId, admissionNumber: c.adm } },
            create: { schoolId, admissionNumber: c.adm, firstName: name.firstName, lastName: name.lastName, isActive: c.isActive },
            update: {},
          });
          await tx.classEnrollment.upsert({
            where: { studentId_academicYearId_termId: { studentId: student.id, academicYearId, termId } },
            update: {
              classId: c.row.classId!,
              streamId: c.row.streamId!,
              isActive: c.isActive,
              status: c.isActive ? "ACTIVE" : "INACTIVE",
              leftAt: null,
            },
            create: {
              schoolId,
              studentId: student.id,
              academicYearId,
              termId,
              classId: c.row.classId!,
              streamId: c.row.streamId!,
              isActive: c.isActive,
              status: c.isActive ? "ACTIVE" : "INACTIVE",
            },
          });
          return student.id;
        })
        : await prisma.student.upsert({
          where: { schoolId_admissionNumber: { schoolId, admissionNumber: c.adm } },
          create: { schoolId, admissionNumber: c.adm, firstName: name.firstName, lastName: name.lastName, isActive: c.isActive },
          update: {},
        }).then((student) => student.id);
      existingByAdm.set(norm(c.adm), studentId);
      if (c.row.raw.guardianName || c.row.raw.guardianPhone || c.row.raw.guardianEmail) {
        await prisma.guardianContact.createMany({
          data: [{
            schoolId,
            studentId,
            guardianName: c.row.raw.guardianName || "Parent/Guardian",
            relationship: "Parent",
            phone: c.row.raw.guardianPhone || null,
            email: c.row.raw.guardianEmail || null,
            preferredContactMethod: c.row.raw.guardianPhone ? "PHONE" : "EMAIL",
            isPrimary: true,
            canReceiveReports: true,
          }] as never,
          skipDuplicates: true,
        });
      }
      successCount += 1;
      createdCount += 1;
      if (!academicYearId || !termId) studentOnlyCount += 1;
    } catch (rowError) {
      failedCount += 1;
      rowErrors.push({
        rowNumber: c.row.rowNumber,
        admissionNumber: c.adm,
        errors: [rowError instanceof Error ? rowError.message : "Failed to import row"],
      });
    }
  }

  return { successCount, createdCount, updatedCount, duplicateCount, failedCount, studentOnlyCount, rowErrors };
}

export async function processImportJob(prisma: PrismaClient, batchId: string, schoolCode: string, mode: StudentImportMode) {
  const tStart = Date.now();
  const batch = await prisma.markImportBatch.findUnique({
    where: { id: batchId },
    include: {
      school: {
        include: {
          classes: { include: { streams: true } },
          students: { select: { id: true, admissionNumber: true } },
          academicYears: {
            orderBy: [{ isActive: "desc" }, { startsOn: "desc" }],
            include: {
              terms: {
                orderBy: [{ isActive: "desc" }, { startsOn: "desc" }],
              },
            },
          },
        },
      },
    },
  });
  if (!batch || batch.source !== "student") return;
  console.log("[student-import] stage: job loaded", { batchId, ms: Date.now() - tStart });

  const summary = deserializeSummary(batch.summary);
  const rows = (summary.rows as StudentImportPreviewRow[] | undefined) ?? [];
  const totalRows = rows.length;
  const enrollmentContext = resolveEnrollmentContext(batch.school as SchoolContext);
  const warnings = Array.isArray(summary.warnings)
    ? [...new Set([...summary.warnings.filter((value): value is string => typeof value === "string"), ...enrollmentContext.warnings])]
    : enrollmentContext.warnings;

  const { existingByAdm } = buildMaps(batch.school as SchoolContext);
  console.log("[student-import] stage: maps built", { batchId, existingStudents: existingByAdm.size, ms: Date.now() - tStart });

  let processedRows = 0;
  let successCount = 0;
  let createdCount = 0;
  let updatedCount = 0;
  let failedCount = 0;
  let duplicateCount = 0;
  let studentOnlyCount = 0;
  const allRowErrors: BatchOutcome["rowErrors"] = [];

  await prisma.markImportBatch.update({
    where: { id: batchId },
    data: {
      status: "DRY_RUN",
      summary: serializeSummary({
        ...summary,
        status: "processing",
        totalRows,
        processedRows,
        successCount,
        createdCount,
        updatedCount,
        failedCount,
        duplicateCount,
        studentOnlyCount,
        created: createdCount,
        updated: updatedCount,
        skipped: duplicateCount + failedCount,
        errors: [],
        warnings,
        startedAt: new Date().toISOString(),
      }),
    },
  });

  for (let index = 0; index < rows.length; index += BATCH_SIZE) {
    const chunk = rows.slice(index, index + BATCH_SIZE);
    const tBatch = Date.now();
    const result = await processBatch(
      prisma,
      batch.schoolId,
      chunk,
      enrollmentContext.academicYearId,
      enrollmentContext.termId,
      mode,
      existingByAdm,
    );
    processedRows += chunk.length;
    successCount += result.successCount;
    createdCount += result.createdCount;
    updatedCount += result.updatedCount;
    failedCount += result.failedCount;
    duplicateCount += result.duplicateCount;
    studentOnlyCount += result.studentOnlyCount;
    if (result.rowErrors.length > 0 && allRowErrors.length < ROW_ERROR_LIMIT) {
      allRowErrors.push(...result.rowErrors.slice(0, ROW_ERROR_LIMIT - allRowErrors.length));
      await prisma.markImportRow.createMany({
        data: result.rowErrors.map((rowError) => ({ batchId, rowNumber: rowError.rowNumber, raw: {}, isValid: false, errors: rowError.errors })),
        skipDuplicates: true,
      });
    }
    await prisma.markImportBatch.update({
      where: { id: batchId },
      data: {
        summary: serializeSummary({
          ...summary,
          status: "processing",
          totalRows,
          processedRows,
          successCount,
          createdCount,
          updatedCount,
          failedCount,
          duplicateCount,
          studentOnlyCount,
          created: createdCount,
          updated: updatedCount,
          skipped: duplicateCount + failedCount,
          errors: allRowErrors.map((item) => ({
            row: item.rowNumber,
            field: item.admissionNumber ? "admissionNumber" : "row",
            message: item.errors.join("; "),
          })),
          warnings,
          updatedAt: new Date().toISOString(),
        }),
      },
    });
    console.log(`[student-import] job ${batchId}: processed ${processedRows}/${totalRows}`, {
      batchMs: Date.now() - tBatch,
      success: result.successCount,
      created: result.createdCount,
      updated: result.updatedCount,
      failed: result.failedCount,
      duplicates: result.duplicateCount,
      studentOnly: result.studentOnlyCount,
    });
  }

  await prisma.markImportBatch.update({
    where: { id: batchId },
    data: {
      status: "COMMITTED",
      summary: serializeSummary({
        ...summary,
        rows: undefined,
        status: "completed",
        totalRows,
        processedRows,
        successCount,
        createdCount,
        updatedCount,
        failedCount,
        duplicateCount,
        studentOnlyCount,
        created: createdCount,
        updated: updatedCount,
        skipped: duplicateCount + failedCount,
        rowErrors: allRowErrors,
        errors: allRowErrors.map((item) => ({
          row: item.rowNumber,
          field: item.admissionNumber ? "admissionNumber" : "row",
          message: item.errors.join("; "),
        })),
        warnings,
        completedAt: new Date().toISOString(),
      }),
    },
  });
  console.log("[student-import] stage: completed", {
    batchId,
    totalRows,
    processedRows,
    successCount,
    createdCount,
    updatedCount,
    failedCount,
    duplicateCount,
    studentOnlyCount,
    totalMs: Date.now() - tStart,
  });
  await prisma.auditLog.create({
    data: {
      schoolId: batch.schoolId,
      action: "student.import.commit",
      details: {
        batchId,
        mode,
        totalRows,
        processedRows,
        successCount,
        createdCount,
        updatedCount,
        failedCount,
        duplicateCount,
        studentOnlyCount,
        destructive: false,
      },
    },
  });
}

export async function createStudentImportJob(prisma: PrismaClient, schoolCode: string, rows: StudentImportRowInput[], mode: StudentImportMode = "CREATE_ONLY") {
  const { previewRows, duplicateRows, school, enrollmentContext } = await buildPreviewRows(prisma, schoolCode, rows, mode);
  const preview = summarizePreview(previewRows, duplicateRows, mode, enrollmentContext.warnings);
  const batch = await prisma.markImportBatch.create({
    data: {
      schoolId: school.id,
      status: "DRY_RUN",
      source: "student",
      summary: serializeSummary({ ...preview, status: "queued", mode, rows: previewRows }),
    },
  });
  console.log("[student-import] job created", { batchId: batch.id, totalRows: preview.totalRows, mode });
  void processImportJob(prisma, batch.id, schoolCode, mode).catch(async (error) => {
    console.error("[student-import] job failed", { batchId: batch.id, error: error instanceof Error ? error.message : "Import failed" });
    await prisma.markImportBatch.update({
      where: { id: batch.id },
      data: { status: "FAILED", summary: serializeSummary({ ...preview, status: "failed", lastError: error instanceof Error ? error.message : "Import failed", updatedAt: new Date().toISOString() }) },
    });
  });
  return {
    jobId: batch.id,
    status: "QUEUED" as const,
    totalRows: preview.totalRows,
    validRows: preview.validRows,
    invalidRows: preview.invalidRows,
    duplicateRows: preview.duplicateRows,
    warnings: preview.warnings,
  };
}

export async function recoverStaleStudentImportJobs(prisma: PrismaClient) {
  const stale = await prisma.markImportBatch.findMany({
    where: { source: "student", status: "DRY_RUN", updatedAt: { lt: new Date(Date.now() - 5 * 60 * 1000) } },
    take: 10,
  });
  for (const batch of stale) {
    const summary = deserializeSummary(batch.summary);
    await prisma.markImportBatch.update({
      where: { id: batch.id },
      data: {
        status: "FAILED",
        summary: serializeSummary({
          ...summary,
          rows: undefined,
          status: "failed",
          lastError: "Import stalled. Please retry or contact admin.",
          updatedAt: new Date().toISOString(),
        }),
      },
    });
  }
}

export async function getStudentImportJob(prisma: PrismaClient, schoolCode: string, jobId: string) {
  const school = await prisma.school.findUnique({ where: { code: schoolCode } });
  if (!school) return null;
  const batch = await prisma.markImportBatch.findFirst({ where: { id: jobId, schoolId: school.id, source: "student" } });
  if (!batch) return null;
  const summary = deserializeSummary(batch.summary);
  delete (summary as Record<string, unknown>).rows;
  return { ...summary, jobId: batch.id, status: batch.status, createdAt: batch.createdAt.toISOString(), updatedAt: batch.updatedAt.toISOString() };
}

export async function previewStudentImport(prisma: PrismaClient, schoolCode: string, rows: StudentImportRowInput[], mode: StudentImportMode = "CREATE_ONLY"): Promise<StudentImportPreview> {
  const { previewRows, duplicateRows, enrollmentContext } = await buildPreviewRows(prisma, schoolCode, rows, mode);
  return summarizePreview(previewRows, duplicateRows, mode, enrollmentContext.warnings);
}

export async function commitStudentImport(prisma: PrismaClient, schoolCode: string, rows: StudentImportRowInput[], mode: StudentImportMode = "CREATE_ONLY") {
  const { previewRows, duplicateRows, enrollmentContext } = await buildPreviewRows(prisma, schoolCode, rows, mode);
  const preview = summarizePreview(previewRows, duplicateRows, mode, enrollmentContext.warnings);
  if (preview.validRows === 0) return { ...preview, status: "PREVIEW" as const };
  const queued = await createStudentImportJob(prisma, schoolCode, rows, mode);
  return { ...preview, ...queued };
}
