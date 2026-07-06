const DANGEROUS_FORMULA_PREFIXES = new Set(["=", "+", "-", "@"]);

export const MAX_SPREADSHEET_ROWS = 5000;
export const MAX_SPREADSHEET_COLUMNS = 50;
export const MAX_SPREADSHEET_CELL_LENGTH = 2000;

export function escapeSpreadsheetCell(value: string): string {
  if (!value) return value;
  return DANGEROUS_FORMULA_PREFIXES.has(value[0] ?? "") ? `'${value}` : value;
}

export function escapeSpreadsheetRow(values: string[]): string[] {
  return values.map((value) => escapeSpreadsheetCell(value));
}

export function sanitizeSpreadsheetDisplayValue(value: unknown): unknown {
  if (typeof value === "string") return escapeSpreadsheetCell(value);
  if (Array.isArray(value)) return value.map((item) => sanitizeSpreadsheetDisplayValue(item));
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, entry]) => [key, sanitizeSpreadsheetDisplayValue(entry)]),
  );
}

export function assertSpreadsheetMatrixShape(rows: Array<Array<unknown>>, sourceLabel: string) {
  if (rows.length > MAX_SPREADSHEET_ROWS) {
    throw Object.assign(new Error(`${sourceLabel} has too many rows. Maximum allowed is ${MAX_SPREADSHEET_ROWS}.`), { status: 400 });
  }

  for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex] ?? [];
    if (row.length > MAX_SPREADSHEET_COLUMNS) {
      throw Object.assign(new Error(`${sourceLabel} has too many columns. Maximum allowed is ${MAX_SPREADSHEET_COLUMNS}.`), { status: 400 });
    }
    for (const cell of row) {
      const text = typeof cell === "string" ? cell : cell == null ? "" : String(cell);
      if (text.length > MAX_SPREADSHEET_CELL_LENGTH) {
        throw Object.assign(new Error(`${sourceLabel} has a cell that exceeds the maximum allowed length.`), { status: 400 });
      }
    }
  }
}
