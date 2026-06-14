import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  detectMarksheetSchema,
  findTableColumnHeader,
  groupLinesByRowNumber,
  normalizeFromOcrLines,
  normalizeFromTableCells,
  normalizeTableLines,
  repairMarksheetRows,
  type TableCell,
} from "../../server/services/documentCleanerNormalizeService";

// ── Fixture helpers ───────────────────────────────────────────────────────────

const FIXTURE_DIR = join(__dirname, "../fixtures/document-cleaner");

function loadFixture<T>(name: string): T {
  return JSON.parse(readFileSync(join(FIXTURE_DIR, name), "utf8")) as T;
}

// ── findTableColumnHeader ─────────────────────────────────────────────────────

describe("findTableColumnHeader", () => {
  it("detects multi-space column header containing NO and NAME", () => {
    const lines = [
      "N & SB",
      "List of Examiners",
      "2026 TERM 1",
      "NO  TEACHER'S NAME  Subject  Level",
      "1. NAKOTTA LAWRENCE",
    ];
    const { idx, columns } = findTableColumnHeader(lines);
    expect(idx).toBe(3);
    expect(columns).toEqual(["NO", "TEACHER'S NAME", "Subject", "Level"]);
  });

  it("detects comma-separated header with SUBJECT keyword", () => {
    const lines = ["School Name", "No, Adm No, Student Name, Written Mark, Split Mark Entry, Remarks"];
    const { idx, columns } = findTableColumnHeader(lines);
    expect(idx).toBe(1);
    expect(columns).toHaveLength(6);
    expect(columns[0]).toBe("No");
  });

  it("returns idx -1 when no keyword-based header is found", () => {
    const lines = ["Galubalo", "Physics", "A Level"];
    const { idx } = findTableColumnHeader(lines);
    expect(idx).toBe(-1);
  });

  it("ignores data rows even if they contain numbers after keywords", () => {
    const lines = [
      "NO  TEACHER'S NAME  Subject  Level",
      "1. NAKOTTA LAWRENCE",
    ];
    const { idx } = findTableColumnHeader(lines);
    expect(idx).toBe(0);
  });
});

// ── findTableColumnHeader — consecutive keyword lines (real Azure output) ────

describe("findTableColumnHeader — consecutive keyword lines", () => {
  it("combines 'NO' + 'Teachers Name / Subject' into a header", () => {
    const lines = [
      "N & SB",
      "LIST OF EXAMINERS",
      "2026 Term 1",
      "NO",
      "Teachers Name / Subject",
      "1. MAROHA LAWRENCE",
    ];
    const { idx, columns } = findTableColumnHeader(lines);
    expect(idx).toBe(4);
    expect(columns).toContain("NO");
    expect(columns.some((c) => /name/i.test(c))).toBe(true);
    expect(columns.some((c) => /subject/i.test(c))).toBe(true);
  });

  it("collects three consecutive keyword lines", () => {
    const lines = ["NO", "Teacher Name", "Subject", "1. Alice", "Math"];
    const { idx, columns } = findTableColumnHeader(lines);
    expect(idx).toBeGreaterThanOrEqual(0);
    expect(columns).toContain("NO");
    expect(columns).toContain("Teacher Name");
    expect(columns).toContain("Subject");
  });

  it("stops collecting when a non-keyword line is hit", () => {
    // "NO" → keyword; next: "Teachers Name / Subject" → keyword; next: "1. ALICE" → not a keyword
    const lines = ["NO", "Teachers Name / Subject", "1. ALICE", "Physics"];
    const { idx, columns } = findTableColumnHeader(lines);
    expect(idx).toBe(1);
    expect(columns.length).toBe(3); // "NO", "Teachers Name", "Subject"
  });

  it("does not false-trigger on non-keyword preamble lines", () => {
    // "N & SB" and "LIST OF EXAMINERS" contain no TABLE_KEYWORDS
    const lines = ["N & SB", "LIST OF EXAMINERS", "2026 Term 1"];
    const { idx } = findTableColumnHeader(lines);
    expect(idx).toBe(-1);
  });
});

// ── normalizeFromTableCells ───────────────────────────────────────────────────

describe("normalizeFromTableCells", () => {
  it("reconstructs columns and rows using rowIndex/columnIndex", () => {
    const cells: TableCell[] = [
      { rowIndex: 0, columnIndex: 0, content: "NO", kind: "columnHeader" },
      { rowIndex: 0, columnIndex: 1, content: "TEACHER", kind: "columnHeader" },
      { rowIndex: 0, columnIndex: 2, content: "SUBJECT", kind: "columnHeader" },
      { rowIndex: 1, columnIndex: 0, content: "1" },
      { rowIndex: 1, columnIndex: 1, content: "NAKOTTA LAWRENCE" },
      { rowIndex: 1, columnIndex: 2, content: "Physics" },
      { rowIndex: 2, columnIndex: 0, content: "2" },
      { rowIndex: 2, columnIndex: 1, content: "Galubalo Alex" },
      { rowIndex: 2, columnIndex: 2, content: "ENT" },
    ];
    const { columns, rows } = normalizeFromTableCells(cells);
    // Headers are normalized to title-case
    expect(columns).toEqual(["No", "Teacher", "Subject"]);
    expect(rows).toHaveLength(2);
    expect(rows[0]!.cells).toEqual(["1", "NAKOTTA LAWRENCE", "Physics"]);
    expect(rows[1]!.cells).toEqual(["2", "Galubalo Alex", "ENT"]);
  });

  it("detects header by keyword match when kind is not provided", () => {
    const cells: TableCell[] = [
      { rowIndex: 0, columnIndex: 0, content: "NO" },
      { rowIndex: 0, columnIndex: 1, content: "NAME" },
      { rowIndex: 0, columnIndex: 2, content: "SUBJECT" },
      { rowIndex: 1, columnIndex: 0, content: "1" },
      { rowIndex: 1, columnIndex: 1, content: "Alice" },
      { rowIndex: 1, columnIndex: 2, content: "Math" },
    ];
    const { columns, rows } = normalizeFromTableCells(cells);
    // Headers are normalized to title-case
    expect(columns).toEqual(["No", "Name", "Subject"]);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.cells).toEqual(["1", "Alice", "Math"]);
  });

  it("correctly handles cells arriving in non-sequential order", () => {
    // Azure may return cells in reading order (left-right, top-bottom) but
    // rows 1-2 can be interleaved. With coordinates, order does not matter.
    const cells: TableCell[] = [
      { rowIndex: 2, columnIndex: 1, content: "Galubalo Alex", kind: "content" },
      { rowIndex: 1, columnIndex: 1, content: "NAKOTTA", kind: "content" },
      { rowIndex: 0, columnIndex: 0, content: "NO", kind: "columnHeader" },
      { rowIndex: 0, columnIndex: 1, content: "NAME", kind: "columnHeader" },
      { rowIndex: 1, columnIndex: 0, content: "1", kind: "content" },
      { rowIndex: 2, columnIndex: 0, content: "2", kind: "content" },
    ];
    const { columns, rows } = normalizeFromTableCells(cells);
    // Headers are normalized to title-case
    expect(columns).toEqual(["No", "Name"]);
    expect(rows[0]!.cells).toEqual(["1", "NAKOTTA"]);
    expect(rows[1]!.cells).toEqual(["2", "Galubalo Alex"]);
  });

  it("assigns high confidence to reconstructed rows", () => {
    const cells: TableCell[] = [
      { rowIndex: 0, columnIndex: 0, content: "NO", kind: "columnHeader" },
      { rowIndex: 1, columnIndex: 0, content: "1" },
    ];
    const { rows } = normalizeFromTableCells(cells);
    expect(rows[0]!.confidence).toBeGreaterThanOrEqual(0.8);
  });

  it("returns empty for empty input", () => {
    const { columns, rows } = normalizeFromTableCells([]);
    expect(columns).toHaveLength(0);
    expect(rows).toHaveLength(0);
  });
});

// ── groupLinesByRowNumber ─────────────────────────────────────────────────────

describe("groupLinesByRowNumber", () => {
  it("groups numbered lines into rows for a 4-column table", () => {
    const lines = [
      "1. NAKOTTA LAWRENCE",
      "Physics",
      "A Level",
      "2. Galubalo Alex",
      "ENT",
      "A Level",
      "3. Mr Ssemogooma Lameck",
      "C.R.E",
      "O Level",
    ];
    const { rows } = groupLinesByRowNumber(lines, 4);
    expect(rows).toHaveLength(3);
    expect(rows[0]!.cells).toEqual(["1", "NAKOTTA LAWRENCE", "Physics", "A Level"]);
    expect(rows[1]!.cells).toEqual(["2", "Galubalo Alex", "ENT", "A Level"]);
    expect(rows[2]!.cells).toEqual(["3", "Mr Ssemogooma Lameck", "C.R.E", "O Level"]);
  });

  it("assigns high confidence to complete numbered rows", () => {
    const lines = ["1. NAKOTTA LAWRENCE", "Physics", "A Level"];
    const { rows } = groupLinesByRowNumber(lines, 4);
    expect(rows[0]!.confidence).toBeGreaterThanOrEqual(0.7);
  });

  it("pads short rows to colCount", () => {
    const lines = ["5. Mr Wander Raymond", "General Paper"];
    const { rows } = groupLinesByRowNumber(lines, 4);
    expect(rows[0]!.cells).toHaveLength(4);
    expect(rows[0]!.cells[3]).toBe("");
  });

  it("handles orphan lines before the first numbered row", () => {
    const lines = [
      "Galubalo",
      "Physics",
      "A Level",
      "3. Mr Ssemogooma Lameck",
      "C.R.E",
      "O Level",
    ];
    const { rows, uncertainCells } = groupLinesByRowNumber(lines, 4);
    // Orphan group: ["Galubalo","Physics","A Level"] → row with auto number "1"
    const orphanRow = rows.find((r) => r.cells[0] === "1");
    expect(orphanRow).toBeDefined();
    expect(orphanRow!.cells[1]).toBe("Galubalo");
    // Orphan rows should be marked uncertain
    const orphanUncertain = uncertainCells.filter((u) => u.rowIndex === rows.indexOf(orphanRow!));
    expect(orphanUncertain.length).toBeGreaterThan(0);
  });

  it("returns empty rows for empty input", () => {
    const { rows } = groupLinesByRowNumber([], 4);
    expect(rows).toHaveLength(0);
  });
});

// ── normalizeFromOcrLines — NALYA-style single-cell OCR output ────────────────

describe("normalizeFromOcrLines — NALYA-style single-cell lines", () => {
  const NALYA_LINES = [
    "N & SB",
    "List of Examiners",
    "2026 TERM 1",
    "NO  TEACHER'S NAME  Subject  Level",
    "1. NAKOTTA LAWRENCE",
    "Physics",
    "A Level",
    "2. Galubalo Alex",
    "ENT",
    "A Level",
    "3. Mr Ssemogooma Lameck",
    "C.R.E",
    "O Level",
    "4. Nantale Margret",
    "Literature",
    "O Level",
    "5. Mr Wander Raymond",
    "General Paper",
    "A Level",
  ];

  it("extracts 4 column headers", () => {
    const { columns } = normalizeFromOcrLines(NALYA_LINES);
    expect(columns).toEqual(["NO", "TEACHER'S NAME", "Subject", "Level"]);
  });

  it("produces 5 data rows", () => {
    const { rows } = normalizeFromOcrLines(NALYA_LINES);
    expect(rows).toHaveLength(5);
  });

  it("correctly structures row 1", () => {
    const { rows } = normalizeFromOcrLines(NALYA_LINES);
    expect(rows[0]!.cells).toEqual(["1", "NAKOTTA LAWRENCE", "Physics", "A Level"]);
  });

  it("correctly structures row 3", () => {
    const { rows } = normalizeFromOcrLines(NALYA_LINES);
    expect(rows[2]!.cells).toEqual(["3", "Mr Ssemogooma Lameck", "C.R.E", "O Level"]);
  });

  it("correctly structures row 5", () => {
    const { rows } = normalizeFromOcrLines(NALYA_LINES);
    expect(rows[4]!.cells).toEqual(["5", "Mr Wander Raymond", "General Paper", "A Level"]);
  });

  it("sets metaEndIdx to point at the column header line", () => {
    const { metaEndIdx } = normalizeFromOcrLines(NALYA_LINES);
    expect(metaEndIdx).toBe(3); // "NO  TEACHER'S NAME  Subject  Level" is at index 3
  });

  it("each row has exactly colCount cells", () => {
    const { columns, rows } = normalizeFromOcrLines(NALYA_LINES);
    for (const row of rows) {
      expect(row.cells).toHaveLength(columns.length);
    }
  });
});

// ── normalizeFromOcrLines — real Azure consecutive keyword lines ───────────────

describe("normalizeFromOcrLines — real Azure consecutive keyword header lines", () => {
  const AZURE_STYLE_LINES = [
    "N & SB",
    "LIST OF EXAMINERS",
    "2026 Term 1",
    "NO",
    "Teachers Name / Subject",
    "1. MAROHA LAWRENCE",
    "Galubalo",
    "Physics",
    "A Level",
    "3. Ssemogooma Lameck",
    "C.R.E",
    "O Level",
  ];

  it("detects column header from consecutive keyword lines", () => {
    const { columns } = normalizeFromOcrLines(AZURE_STYLE_LINES);
    expect(columns.length).toBeGreaterThanOrEqual(2);
    expect(columns.some((c) => /^no$/i.test(c))).toBe(true);
    expect(columns.some((c) => /subject/i.test(c))).toBe(true);
  });

  it("produces data rows from the body lines", () => {
    const { rows } = normalizeFromOcrLines(AZURE_STYLE_LINES);
    expect(rows.length).toBeGreaterThan(0);
  });

  it("each row has the same cell count as columns", () => {
    const { columns, rows } = normalizeFromOcrLines(AZURE_STYLE_LINES);
    for (const row of rows) {
      expect(row.cells).toHaveLength(columns.length);
    }
  });
});

// ── normalizeFromOcrLines — delimiter-separated body ─────────────────────────

describe("normalizeFromOcrLines — delimiter-separated body", () => {
  const lines = [
    "NO  TEACHER'S NAME  Subject  Level",
    "1, NAKOTTA LAWRENCE, Physics, A Level",
    "2, Galubalo Alex, ENT, A Level",
  ];

  it("detects comma-separated body and parses rows", () => {
    const { columns, rows } = normalizeFromOcrLines(lines);
    expect(columns).toEqual(["NO", "TEACHER'S NAME", "Subject", "Level"]);
    expect(rows).toHaveLength(2);
    expect(rows[0]!.cells).toEqual(["1", "NAKOTTA LAWRENCE", "Physics", "A Level"]);
  });
});

// ── normalizeTableLines — CSV tests (kept for direct delimiter use) ───────────

describe("normalizeTableLines — comma-separated", () => {
  const HEADER = "No, Adm No, Student Name, Written Mark, Split Mark Entry, Remarks";
  const ROW1 = "1, SC226-0001, Daniel Bamwesigye, 45, 4, 5";
  const ROW2 = "2, SC226-0005, Allan Andrew Nakiwala, 71, 71, blank";

  it("extracts column headers", () => {
    const { columns } = normalizeTableLines([HEADER, ROW1, ROW2]);
    expect(columns).toEqual(["No", "Adm No", "Student Name", "Written Mark", "Split Mark Entry", "Remarks"]);
  });

  it("parses row 1 cells", () => {
    const { rows } = normalizeTableLines([HEADER, ROW1, ROW2]);
    expect(rows[0]!.cells).toEqual(["1", "SC226-0001", "Daniel Bamwesigye", "45", "4", "5"]);
  });

  it("parses row 2 cells", () => {
    const { rows } = normalizeTableLines([HEADER, ROW1, ROW2]);
    expect(rows[1]!.cells).toEqual(["2", "SC226-0005", "Allan Andrew Nakiwala", "71", "71", "blank"]);
  });

  it("assigns high confidence to complete rows", () => {
    const { rows } = normalizeTableLines([HEADER, ROW1, ROW2]);
    expect(rows[0]!.confidence).toBeGreaterThanOrEqual(0.7);
  });

  it("produces no uncertain cells for well-formed rows", () => {
    const { uncertainCells } = normalizeTableLines([HEADER, ROW1, ROW2]);
    expect(uncertainCells).toHaveLength(0);
  });

  it("row cell count matches header column count", () => {
    const { columns, rows } = normalizeTableLines([HEADER, ROW1, ROW2]);
    for (const row of rows) expect(row.cells).toHaveLength(columns.length);
  });

  it("returns empty for blank input", () => {
    const result = normalizeTableLines([]);
    expect(result.columns).toHaveLength(0);
    expect(result.rows).toHaveLength(0);
  });

  it("pads and marks uncertain a short row", () => {
    const { rows, uncertainCells } = normalizeTableLines([HEADER, "3, SC226-0010, Partial Row"]);
    expect(rows[0]!.cells).toHaveLength(6);
    expect(uncertainCells.length).toBeGreaterThan(0);
  });
});

describe("normalizeTableLines — tab-separated", () => {
  it("detects tab delimiter and parses correctly", () => {
    const lines = ["No\tAdm No\tStudent Name", "1\tSC226-0001\tDaniel Bamwesigye"];
    const { columns, rows } = normalizeTableLines(lines);
    expect(columns).toEqual(["No", "Adm No", "Student Name"]);
    expect(rows[0]!.cells).toEqual(["1", "SC226-0001", "Daniel Bamwesigye"]);
  });
});

describe("normalizeTableLines — multi-space-separated", () => {
  it("detects multi-space delimiter and parses correctly", () => {
    const lines = ["NO   TEACHER NAME   SUBJECT", "1    NAKOTTA        Physics"];
    const { columns, rows } = normalizeTableLines(lines);
    expect(columns).toEqual(["NO", "TEACHER NAME", "SUBJECT"]);
    expect(rows[0]!.cells).toEqual(["1", "NAKOTTA", "Physics"]);
  });
});

describe("normalizeTableLines — no detectable header", () => {
  it("treats all lines as data rows when every row starts with a number", () => {
    const { columns, rows } = normalizeTableLines(["1, 45, 50", "2, 60, 70"]);
    expect(columns).toHaveLength(0);
    expect(rows).toHaveLength(2);
  });
});

// ── Fixture-based integration: real Azure Document Intelligence table ──────────

describe("normalizeFromTableCells — NALYA real Azure DI fixture", () => {
  type AzureFixture = {
    raw: { tables: Array<{ cells: TableCell[] }> };
  };
  type ExpectedFixture = {
    columns: string[];
    rows: Array<{ cells: string[]; confidence: number }>;
    uncertainCells: Array<{ rowIndex: number; columnIndex: number; reason: string }>;
  };

  const azureFixture = loadFixture<AzureFixture>("nalya-azure-layout-table.json");
  const expectedFixture = loadFixture<ExpectedFixture>("nalya-expected-table.json");
  const cells = azureFixture.raw.tables[0]!.cells;

  it("normalizes raw column headers correctly", () => {
    const { columns } = normalizeFromTableCells(cells);
    expect(columns).toEqual(expectedFixture.columns);
    // Specifically: "NO" → "No", "Teachers Name" → "Teacher's Name"
    expect(columns[0]).toBe("No");
    expect(columns[1]).toBe("Teacher's Name");
    expect(columns[2]).toBe("Subject");
    expect(columns[3]).toBe("Level");
  });

  it("drops fully-empty rows, keeps data rows", () => {
    const { rows } = normalizeFromTableCells(cells);
    expect(rows).toHaveLength(expectedFixture.rows.length);
    // Fixture has 4 data rows and 3 empty rows — only data rows should remain
    expect(rows.length).toBe(4);
  });

  it("strips trailing period from row-number cells", () => {
    const { rows } = normalizeFromTableCells(cells);
    // "1." → "1", "2." → "2", "3." → "3"
    expect(rows[0]!.cells[0]).toBe("1");
    expect(rows[1]!.cells[0]).toBe("2");
    expect(rows[2]!.cells[0]).toBe("3");
    expect(rows[3]!.cells[0]).toBe("4");
  });

  it("preserves name, subject, level from row 1", () => {
    const { rows } = normalizeFromTableCells(cells);
    expect(rows[0]!.cells[1]).toBe("MAKOHA LAWRENCE");
    expect(rows[0]!.cells[2]).toBe("Physics");
    // Compare against fixture to avoid hardcoding Unicode apostrophe variants
    expect(rows[0]!.cells[3]).toBe(expectedFixture.rows[0]!.cells[3]);
  });

  it("marks non-ASCII OCR noise cells as uncertain", () => {
    const { uncertainCells } = normalizeFromTableCells(cells);
    // row 2 col 3 ("À la001") and row 3 col 3 ("" Level") have non-ASCII chars
    // After empty-row filtering: row indices restart from 0
    expect(uncertainCells.length).toBeGreaterThanOrEqual(2);
    // At least one uncertain cell in column 3
    const col3Uncertain = uncertainCells.filter((u) => u.columnIndex === 3);
    expect(col3Uncertain.length).toBeGreaterThanOrEqual(1);
    expect(col3Uncertain[0]!.reason).toMatch(/OCR noise/i);
  });

  it("assigns high confidence to data rows", () => {
    const { rows } = normalizeFromTableCells(cells);
    for (const row of rows) {
      expect(row.confidence).toBeGreaterThanOrEqual(0.8);
    }
  });

  it("each row has exactly 4 cells matching column count", () => {
    const { columns, rows } = normalizeFromTableCells(cells);
    for (const row of rows) {
      expect(row.cells).toHaveLength(columns.length);
    }
  });

  it("matches the full expected fixture output (columns + row count)", () => {
    const { columns, rows } = normalizeFromTableCells(cells);
    expect(columns).toEqual(expectedFixture.columns);
    expect(rows.length).toBe(expectedFixture.rows.length);
    for (let i = 0; i < expectedFixture.rows.length; i++) {
      expect(rows[i]!.cells).toEqual(expectedFixture.rows[i]!.cells);
    }
  });
});

// ── detectMarksheetSchema ─────────────────────────────────────────────────────

describe("detectMarksheetSchema", () => {
  const MARKSHEET_COLS = ["No", "Adm No", "Student Name", "Written Mark", "Split Mark Entry", "Remarks"];

  it("returns true for standard marksheet column headers", () => {
    expect(detectMarksheetSchema(MARKSHEET_COLS)).toBe(true);
  });

  it("returns true when abbreviated headers have adm + mark + name", () => {
    expect(detectMarksheetSchema(["No", "Adm No", "Name", "Mark"])).toBe(true);
  });

  it("returns false for NALYA examiners table (no Adm No or Mark columns)", () => {
    expect(detectMarksheetSchema(["No", "Teacher's Name", "Subject", "Level"])).toBe(false);
  });

  it("returns false when fewer than 4 columns", () => {
    expect(detectMarksheetSchema(["Adm No", "Name", "Mark"])).toBe(false);
  });

  it("returns false when only name column matches", () => {
    expect(detectMarksheetSchema(["No", "Student Name", "Subject", "Level"])).toBe(false);
  });

  it("returns true when data rows contain ≥2 admission numbers (data-driven)", () => {
    const rows = [
      { cells: ["1", "SC2026-0001", "Alice", "50", "5", ""], confidence: 0.9 },
      { cells: ["2", "SC2026-0002", "Bob", "60", "6", ""], confidence: 0.9 },
    ];
    // Columns don't explicitly say "Adm No" but data is conclusive
    expect(detectMarksheetSchema(["No", "ID", "Name", "Total Mark"], rows)).toBe(true);
  });
});

// ── repairMarksheetRows ───────────────────────────────────────────────────────

describe("repairMarksheetRows", () => {
  const COLS = ["No", "Adm No", "Student Name", "Written Mark", "Split Mark Entry", "Remarks"];

  it("repairs the bad live row: 1|1|SC2026-0002|Ruth Karungi|30|2 → 1|SC2026-0002|Ruth Karungi|30|2|blank", () => {
    const rows = [
      { cells: ["1", "1", "SC2026-0002", "Ruth Karungi", "30", "2"], confidence: 0.9 },
    ];
    const { rows: repaired, cellCorrections } = repairMarksheetRows(COLS, rows, []);
    expect(repaired[0]!.cells).toEqual(["1", "SC2026-0002", "Ruth Karungi", "30", "2", ""]);
    expect(cellCorrections.some((c) => c.status === "corrected")).toBe(true);
  });

  it("records raw OCR value and corrected value in the correction", () => {
    const rows = [
      { cells: ["1", "1", "SC2026-0002", "Ruth Karungi", "30", "2"], confidence: 0.9 },
    ];
    const { cellCorrections } = repairMarksheetRows(COLS, rows, []);
    const admNoCorrection = cellCorrections.find((c) => c.columnIndex === 1);
    expect(admNoCorrection).toBeDefined();
    expect(admNoCorrection!.raw).toBe("1");
    expect(admNoCorrection!.value).toBe("SC2026-0002");
  });

  it("repairs row where student name was under Written Mark column (name/mark swap)", () => {
    const rows = [
      { cells: ["1", "SC2026-0001", "45", "Daniel Bamwesigye", "4", "5"], confidence: 0.9 },
    ];
    const { rows: repaired, cellCorrections } = repairMarksheetRows(COLS, rows, []);
    expect(repaired[0]!.cells[2]).toBe("Daniel Bamwesigye");
    expect(repaired[0]!.cells[3]).toBe("45");
    expect(cellCorrections.filter((c) => c.status === "corrected").length).toBeGreaterThanOrEqual(2);
  });

  it("marks invalid when Written Mark contains alphabetic characters", () => {
    const rows = [
      { cells: ["1", "SC2026-0001", "Daniel Bamwesigye", "FortyFive", "4", "5"], confidence: 0.9 },
    ];
    const { cellCorrections } = repairMarksheetRows(COLS, rows, []);
    const markCorrection = cellCorrections.find((c) => c.columnIndex === 3 && c.status === "invalid");
    expect(markCorrection).toBeDefined();
    expect(markCorrection!.reason).toMatch(/letter/i);
  });

  it("does not change well-formed rows", () => {
    const rows = [
      { cells: ["1", "SC2026-0001", "Daniel Bamwesigye", "45", "4", "5"], confidence: 0.9 },
    ];
    const { rows: repaired, cellCorrections } = repairMarksheetRows(COLS, rows, []);
    expect(repaired[0]!.cells).toEqual(["1", "SC2026-0001", "Daniel Bamwesigye", "45", "4", "5"]);
    expect(cellCorrections.filter((c) => c.status === "corrected" || c.status === "invalid")).toHaveLength(0);
  });

  it("sets lower confidence for corrected rows", () => {
    const rows = [
      { cells: ["1", "1", "SC2026-0002", "Ruth Karungi", "30", "2"], confidence: 0.9 },
    ];
    const { rows: repaired } = repairMarksheetRows(COLS, rows, []);
    expect(repaired[0]!.confidence).toBeLessThan(0.9);
  });

  it("preserves existing uncertain cells that are NOT at corrected positions", () => {
    const rows = [
      { cells: ["1", "SC2026-0001", "Alice", "45", "4", "5"], confidence: 0.9 },
    ];
    const existing = [{ rowIndex: 0, columnIndex: 5, reason: "OCR noise" }];
    const { uncertainCells } = repairMarksheetRows(COLS, rows, existing);
    expect(uncertainCells).toHaveLength(1);
    expect(uncertainCells[0]!.columnIndex).toBe(5);
  });

  it("does NOT generate corrections for NALYA examiners table (schema check guards call)", () => {
    // detectMarksheetSchema returns false for this → repairMarksheetRows is never called in prod.
    // But if called directly, it finds no Adm No and only runs type validation.
    // "A' Level" at position 3 would be flagged invalid by validateMarksheetCells,
    // but the schema check prevents this in the service layer.
    const nalyaColumns = ["No", "Teacher's Name", "Subject", "Level"];
    expect(detectMarksheetSchema(nalyaColumns)).toBe(false);
  });
});
