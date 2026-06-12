import { read, utils } from "xlsx";
import type { PrismaClient } from "@prisma/client";
import type {
  StudentImportMode,
  StudentImportPreview,
  StudentImportPreviewRow,
  StudentImportRowInput,
} from "../../shared/types/students";
import { generateAdmissionNumber } from "./studentAdmissionNumberService";
import { createStudentRecord, getStudentByAdmissionNumber } from "../repositories/studentRepository";

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

export function parseStudentsCsv(csvText: string): StudentImportRowInput[] {
  const [header, ...lines] = csvText.trim().split(/\r?\n/);
  const cols = header.split(",").map((item) => item.trim());
  return lines.filter(Boolean).map((line) => {
    const values = line.split(",");
    const row = Object.fromEntries(cols.map((col, index) => [col, text(values[index])]));
    return {
      admissionNumber: row.admissionNumber || "",
      fullName: row.fullName || "",
      gender: row.gender || "",
      className: row.class || "",
      streamName: row.stream || "",
      guardianName: row.guardianName || "",
      guardianPhone: row.guardianPhone || "",
      guardianEmail: row.guardianEmail || "",
      status: row.status || "",
    };
  });
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
    guardianPhone: text(row.guardianPhone),
    guardianEmail: text(row.guardianEmail),
    status: text(row.status),
  }));
}

export async function previewStudentImport(
  prisma: PrismaClient,
  schoolCode: string,
  rows: StudentImportRowInput[],
  mode: StudentImportMode = "CREATE_ONLY",
): Promise<StudentImportPreview> {
  const school = await prisma.school.findUnique({ where: { code: schoolCode }, include: { classes: { include: { streams: true } }, students: true } });
  if (!school) throw new Error(`School ${schoolCode} was not found.`);
  const seen = new Set<string>();
  const previewRows: StudentImportPreviewRow[] = [];
  let duplicateRows = 0;
  for (let i = 0; i < rows.length; i += 1) {
    const raw = rows[i]!;
    const errors: string[] = [];
    const klass = school.classes.find((item) => norm(item.name) === norm(raw.className) || norm(item.code) === norm(raw.className));
    const stream = klass?.streams.find((item) => norm(item.name) === norm(raw.streamName) || norm(item.code) === norm(raw.streamName));
    let admissionNumber = raw.admissionNumber?.trim() || "";
    if (!raw.fullName.trim()) errors.push("Full name is required.");
    if (!raw.className.trim()) errors.push("Class is required.");
    if (!raw.streamName.trim()) errors.push("Stream is required.");
    if (!klass) errors.push(`Class ${raw.className} was not found.`);
    if (!stream) errors.push(`Stream ${raw.streamName} was not found for class ${raw.className}.`);
    if (raw.guardianEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw.guardianEmail)) errors.push("Guardian email must be valid.");
    if (raw.guardianPhone && !/^[+]?[0-9\s()-]+$/.test(raw.guardianPhone)) errors.push("Guardian phone must be valid.");
    if (!admissionNumber) admissionNumber = await generateAdmissionNumber(prisma, schoolCode, raw.className, raw.streamName);
    if (seen.has(norm(admissionNumber))) {
      errors.push(`Duplicate admission number in file: ${admissionNumber}.`);
      duplicateRows += 1;
    }
    seen.add(norm(admissionNumber));
    const existing = school.students.find((item) => norm(item.admissionNumber) === norm(admissionNumber));
    if (existing) {
      if (mode === "CREATE_ONLY") {
        errors.push("Existing student found.");
      }
    }
    const action = errors.length ? "invalid" : existing ? "update" : "create";
    previewRows.push({
      rowNumber: i + 2,
      raw,
      isValid: errors.length === 0 || (existing && mode === "CREATE_AND_UPDATE_EXISTING"),
      errors,
      action,
      existingStudentId: existing?.id ?? null,
      generatedAdmissionNumber: raw.admissionNumber ? null : admissionNumber,
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
  const school = await prisma.school.findUniqueOrThrow({ where: { code: schoolCode } });
  const batch = await prisma.markImportBatch.create({ data: { schoolId: school.id, status: "COMMITTED", source: "student", summary: JSON.stringify(preview) } });
  for (const row of preview.rows) {
    const admissionNumber = row.raw.admissionNumber?.trim() || row.generatedAdmissionNumber || "";
    if (row.action === "update" && row.existingStudentId && mode === "CREATE_AND_UPDATE_EXISTING") {
      const name = splitName(row.raw.fullName);
      await prisma.student.update({
        where: { id: row.existingStudentId },
        data: { firstName: name.firstName, lastName: name.lastName, isActive: row.raw.status?.toLowerCase() !== "inactive" },
      });
      continue;
    }
    if (row.action === "create" || (row.action === "update" && mode === "CREATE_AND_UPDATE_EXISTING")) {
      await createStudentRecord(prisma, schoolCode, {
        admissionNumber,
        fullName: row.raw.fullName,
        gender: row.raw.gender,
        classId: (await prisma.schoolClass.findFirstOrThrow({ where: { schoolId: school.id, OR: [{ name: row.raw.className }, { code: row.raw.className }] } })).id,
        streamId: (await prisma.stream.findFirstOrThrow({ where: { schoolId: school.id, OR: [{ name: row.raw.streamName }, { code: row.raw.streamName }] } })).id,
        isActive: row.raw.status?.toLowerCase() !== "inactive",
        guardianName: row.raw.guardianName,
        guardianPhone: row.raw.guardianPhone,
        guardianEmail: row.raw.guardianEmail,
        notes: "",
        schoolCode,
      }, null);
    }
  }
  return { ...preview, status: "COMMITTED" as const, batchId: batch.id };
}
