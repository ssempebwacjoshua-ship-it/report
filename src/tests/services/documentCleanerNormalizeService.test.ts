import { describe, expect, it } from "vitest";
import {
  findTableColumnHeader,
  groupLinesByRowNumber,
  normalizeFromOcrLines,
  normalizeTableLines,
} from "../../server/services/documentCleanerNormalizeService";

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
