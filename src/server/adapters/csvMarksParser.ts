import { parse } from "csv-parse/sync";
import type { RawMarkImportRow } from "../../shared/types/imports";

const COLUMNS = ["admissionNumber", "studentName", "class", "stream", "subject", "term", "examType", "marks", "comments"] as const;

export function parseMarksCsv(input: string): RawMarkImportRow[] {
  return parse(input, {
    bom: true,
    columns: (headers: string[]) => headers.map((header) => header.trim()),
    skip_empty_lines: true,
    trim: true,
  }).map((row: Record<string, string>) => {
    const normalized: Record<string, string> = {};
    for (const column of COLUMNS) normalized[column] = row[column] ?? "";
    return normalized as RawMarkImportRow;
  });
}

