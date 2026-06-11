import * as XLSX from "xlsx";

// ── File type constants ───────────────────────────────────────────────────────

export const DIGITAL_ACCEPT =
  ".csv,.xlsx,.xls,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export const SCAN_ACCEPT =
  ".pdf,.png,.jpg,.jpeg,.webp,application/pdf,image/png,image/jpeg,image/webp";

const SCAN_EXTENSIONS = new Set(["pdf", "png", "jpg", "jpeg", "webp"]);

export function isScanFile(file: File): boolean {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  return SCAN_EXTENSIONS.has(ext);
}

export function getScanFileType(file: File): string {
  return file.name.split(".").pop()?.toUpperCase() ?? "UNKNOWN";
}

// ── Digital marks template columns ───────────────────────────────────────────

export const MARKS_TEMPLATE_COLUMNS = [
  "admissionNumber",
  "studentName",
  "class",
  "stream",
  "subject",
  "term",
  "examType",
  "marks",
  "comments",
] as const;

const SAMPLE_ROW = {
  admissionNumber: "S1A-001",
  studentName: "Kampala Ssempebwa",
  class: "Senior 1 A",
  stream: "A",
  subject: "English Language",
  term: "Term 1",
  examType: "BOT",
  marks: "81",
  comments: "examType accepts: BOT, MOT, EOT (or Mid Term / Midterm / Mid-Term)",
};

export type ParsedMarksFile = {
  csvText: string;
  fileName: string;
  fileType: string;
};

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function requiredColumnError(headers: string[]) {
  const normalized = new Set(headers.map((header) => header.trim()));
  const missing = MARKS_TEMPLATE_COLUMNS.filter((column) => !normalized.has(column));
  return missing.length ? `Missing required columns: ${missing.join(", ")}` : "";
}

function assertRequiredColumnsFromCsv(csvText: string) {
  const firstLine = csvText.split(/\r?\n/).find((line) => line.trim().length > 0) ?? "";
  const headers = firstLine.split(",").map((header) => header.trim().replace(/^"|"$/g, ""));
  const error = requiredColumnError(headers);
  if (error) throw new Error(error);
}

export function downloadCsvTemplate() {
  const header = MARKS_TEMPLATE_COLUMNS.join(",");
  const sample = MARKS_TEMPLATE_COLUMNS.map((column) => SAMPLE_ROW[column]).join(",");
  downloadBlob(new Blob([`${header}\n${sample}\n`], { type: "text/csv;charset=utf-8" }), "school-connect-marks-template.csv");
}

export function downloadExcelTemplate() {
  const worksheet = XLSX.utils.json_to_sheet([SAMPLE_ROW], { header: [...MARKS_TEMPLATE_COLUMNS] });
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Marks");
  const bytes = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
  downloadBlob(
    new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    "school-connect-marks-template.xlsx",
  );
}

export async function parseMarksFile(file: File): Promise<ParsedMarksFile> {
  const extension = file.name.split(".").pop()?.toLowerCase();
  if (!extension || !["csv", "xlsx", "xls"].includes(extension)) {
    throw new Error("Unsupported file type. Upload a .csv, .xlsx, or .xls marks sheet.");
  }

  if (extension === "csv") {
    const csvText = await file.text();
    assertRequiredColumnsFromCsv(csvText);
    return { csvText, fileName: file.name, fileType: "CSV" };
  }

  const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) throw new Error("The spreadsheet does not contain any sheets.");

  const worksheet = workbook.Sheets[firstSheetName];
  const rows = XLSX.utils.sheet_to_json<string[]>(worksheet, { header: 1, defval: "" });
  const headers = (rows[0] ?? []).map((header) => String(header).trim());
  const error = requiredColumnError(headers);
  if (error) throw new Error(error);

  const csvText = XLSX.utils.sheet_to_csv(worksheet);
  return { csvText, fileName: file.name, fileType: extension.toUpperCase() };
}

export function validatePastedCsv(csvText: string) {
  assertRequiredColumnsFromCsv(csvText);
}
