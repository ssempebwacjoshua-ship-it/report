import { describe, expect, it } from "vitest";
import { normalizeTableLines } from "../../server/services/documentCleanerNormalizeService";

const HEADER = "No, Adm No, Student Name, Written Mark, Split Mark Entry, Remarks";
const ROW1 = "1, SC226-0001, Daniel Bamwesigye, 45, 4, 5";
const ROW2 = "2, SC226-0005, Allan Andrew Nakiwala, 71, 71, blank";

// ── Comma-separated table (main use case) ─────────────────────────────────────

describe("normalizeTableLines — comma-separated table", () => {
  const lines = [HEADER, ROW1, ROW2];

  it("extracts column headers from the first line", () => {
    const { columns } = normalizeTableLines(lines);
    expect(columns).toEqual([
      "No",
      "Adm No",
      "Student Name",
      "Written Mark",
      "Split Mark Entry",
      "Remarks",
    ]);
  });

  it("parses two data rows", () => {
    const { rows } = normalizeTableLines(lines);
    expect(rows).toHaveLength(2);
  });

  it("parses row 1 cells correctly", () => {
    const { rows } = normalizeTableLines(lines);
    expect(rows[0]!.cells).toEqual(["1", "SC226-0001", "Daniel Bamwesigye", "45", "4", "5"]);
  });

  it("parses row 2 cells correctly", () => {
    const { rows } = normalizeTableLines(lines);
    expect(rows[1]!.cells).toEqual(["2", "SC226-0005", "Allan Andrew Nakiwala", "71", "71", "blank"]);
  });

  it("assigns high confidence to well-formed rows", () => {
    const { rows } = normalizeTableLines(lines);
    expect(rows[0]!.confidence).toBeGreaterThanOrEqual(0.7);
    expect(rows[1]!.confidence).toBeGreaterThanOrEqual(0.7);
  });

  it("produces no uncertain cells for well-formed rows", () => {
    const { uncertainCells } = normalizeTableLines(lines);
    expect(uncertainCells).toHaveLength(0);
  });

  it("row cell count matches the number of header columns", () => {
    const { columns, rows } = normalizeTableLines(lines);
    for (const row of rows) {
      expect(row.cells).toHaveLength(columns.length);
    }
  });
});

// ── Empty / blank input ────────────────────────────────────────────────────────

describe("normalizeTableLines — empty input", () => {
  it("returns empty result for no lines", () => {
    const result = normalizeTableLines([]);
    expect(result.columns).toHaveLength(0);
    expect(result.rows).toHaveLength(0);
    expect(result.uncertainCells).toHaveLength(0);
  });

  it("returns empty result for all-blank lines", () => {
    const result = normalizeTableLines(["", "  ", "\t"]);
    expect(result.columns).toHaveLength(0);
    expect(result.rows).toHaveLength(0);
  });
});

// ── Mismatched row length ─────────────────────────────────────────────────────

describe("normalizeTableLines — mismatched row cell count", () => {
  it("pads a short row to match header column count", () => {
    const lines = [HEADER, "3, SC226-0010, Partial Row"]; // 3 of 6 cells
    const { columns, rows } = normalizeTableLines(lines);
    expect(rows[0]!.cells).toHaveLength(columns.length);
  });

  it("marks all cells in a short row as uncertain", () => {
    const lines = [HEADER, "3, SC226-0010, Partial Row"];
    const { uncertainCells } = normalizeTableLines(lines);
    expect(uncertainCells.length).toBeGreaterThan(0);
    expect(uncertainCells[0]!.reason).toMatch(/review/i);
  });

  it("assigns low confidence to a short row", () => {
    const lines = [HEADER, "3, SC226-0010, Partial Row"];
    const { rows } = normalizeTableLines(lines);
    expect(rows[0]!.confidence).toBeLessThan(0.6);
  });
});

// ── Tab-separated table ───────────────────────────────────────────────────────

describe("normalizeTableLines — tab-separated table", () => {
  const lines = [
    "No\tAdm No\tStudent Name\tWritten Mark",
    "1\tSC226-0001\tDaniel Bamwesigye\t45",
    "2\tSC226-0005\tAllan Andrew Nakiwala\t71",
  ];

  it("detects tab delimiter and extracts headers", () => {
    const { columns } = normalizeTableLines(lines);
    expect(columns).toEqual(["No", "Adm No", "Student Name", "Written Mark"]);
  });

  it("parses row 1 with tab delimiter", () => {
    const { rows } = normalizeTableLines(lines);
    expect(rows[0]!.cells).toEqual(["1", "SC226-0001", "Daniel Bamwesigye", "45"]);
  });
});

// ── Multi-space-separated table ───────────────────────────────────────────────

describe("normalizeTableLines — multi-space-separated table", () => {
  const lines = [
    "NO   TEACHER NAME   SUBJECT",
    "1    NAKOTTA        Physics",
    "2    NAKAZZI        Mathematics",
  ];

  it("detects multi-space delimiter and extracts headers", () => {
    const { columns } = normalizeTableLines(lines);
    expect(columns).toEqual(["NO", "TEACHER NAME", "SUBJECT"]);
  });

  it("parses row 1 with multi-space delimiter", () => {
    const { rows } = normalizeTableLines(lines);
    expect(rows[0]!.cells).toEqual(["1", "NAKOTTA", "Physics"]);
  });
});

// ── No header line ────────────────────────────────────────────────────────────

describe("normalizeTableLines — no detectable header", () => {
  it("treats all lines as data rows when every row starts with a number", () => {
    const lines = ["1, 45, 50", "2, 60, 70"];
    const { columns, rows } = normalizeTableLines(lines);
    expect(columns).toHaveLength(0);
    expect(rows).toHaveLength(2);
  });
});
