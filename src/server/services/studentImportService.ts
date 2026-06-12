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
import { createStudentRecord } from "../repositories/studentRepository";

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

export function parseStudentsCsv(csvText: string): StudentImportRowInput[] {
  const records = parseCsv(csvText, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as Record<string, unknown>[];

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

export async function previewStudentImport(
  prisma: PrismaClient,
  schoolCode: string,
  rows: StudentImportRowInput[],
  mode: StudentImportMode = "CREATE_ONLY",
): Promise<StudentImportPreview> {
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
    if (!klass) {
      // classes can be created during commit
    }
    if (!stream) {
      // streams can be created during commit
    }
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

  const validRows = previewRows.filter((row) => row.isValid).length;
  return {
    status: "PREVIEW",
    totalRows: previewRows.length,
    validRows,
    invalidRows: previewRows.length - validRows,
    duplicateRows,
    createRows: previewRows.filter((row) => row.action === "create" && row.isValid).length,
    updateRows: previewRows.filter((row) => row.action === "update" && row.isValid).length,
    rows: previewRows,
    mode,
  };
}

export async function commitStudentImport(
  prisma: PrismaClient,
  schoolCode: string,
  rows: StudentImportRowInput[],
  mode: StudentImportMode = "CREATE_ONLY",
) {
  const preview = await previewStudentImport(prisma, schoolCode, rows, mode);
  if (preview.invalidRows > 0) return { ...preview, status: "PREVIEW" as const };

  const school = await prisma.school.findUniqueOrThrow({
    where: { code: schoolCode },
    include: { academicYears: { where: { isActive: true }, include: { terms: { where: { isActive: true } } } } },
  });
  const activeYear = school.academicYears[0];
  const activeTerm = activeYear?.terms[0];
  if (!activeYear || !activeTerm) throw new Error("An active academic year and term are required before importing students.");

  const batch = await prisma.markImportBatch.create({
    data: {
      schoolId: school.id,
      status: "COMMITTED",
      source: "student",
      summary: JSON.stringify(preview),
    },
  });

  for (let index = 0; index < preview.rows.length; index += 500) {
    const chunk = preview.rows.slice(index, index + 500);
    for (const row of chunk) {
      const admissionNumber = row.raw.admissionNumber?.trim() || row.generatedAdmissionNumber || "";
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
        continue;
      }

      if (row.action === "create" || (row.action === "update" && mode === "CREATE_AND_UPDATE_EXISTING")) {
        const klass =
          (await prisma.schoolClass.findFirst({
            where: { schoolId: school.id, OR: [{ name: row.raw.className }, { code: row.raw.className }] },
          })) ??
          (await prisma.schoolClass.create({
            data: {
              schoolId: school.id,
              name: row.raw.className,
              code: row.raw.className,
              level: inferClassLevel(row.raw.className),
            },
          }));
        const stream =
          (await prisma.stream.findFirst({
            where: { schoolId: school.id, classId: klass.id, OR: [{ name: row.raw.streamName }, { code: row.raw.streamName }] },
          })) ??
          (await prisma.stream.create({
            data: {
              schoolId: school.id,
              classId: klass.id,
              name: row.raw.streamName,
              code: row.raw.streamName,
            },
          }));
        await createStudentRecord(
          prisma,
          schoolCode,
          {
            admissionNumber,
            fullName: row.raw.fullName,
            gender: normalizeGender(row.raw.gender),
            classId: klass.id,
            streamId: stream.id,
            isActive: row.raw.status?.toLowerCase() !== "inactive",
            guardianName: row.raw.guardianName,
            guardianPhone: normalizePhone(row.raw.guardianPhone ?? ""),
            guardianEmail: row.raw.guardianEmail,
            notes: "",
            schoolCode,
          },
          null,
        );
      }
    }
  }

  await prisma.auditLog.create({
    data: {
      schoolId: school.id,
      action: "student.import.commit",
      details: {
        batchId: batch.id,
        totalRows: preview.totalRows,
        validRows: preview.validRows,
        invalidRows: preview.invalidRows,
        duplicateRows: preview.duplicateRows,
        createRows: preview.createRows,
        updateRows: preview.updateRows,
      },
    },
  });

  return { ...preview, status: "COMMITTED" as const, batchId: batch.id };
}
