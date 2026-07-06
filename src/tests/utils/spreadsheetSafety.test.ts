import { describe, expect, it } from "vitest";
import { assertSpreadsheetMatrixShape, escapeSpreadsheetCell, escapeSpreadsheetRow, sanitizeSpreadsheetDisplayValue } from "../../server/utils/spreadsheetSafety";

describe("spreadsheet safety helpers", () => {
  it("escapes formula-like cell values", () => {
    expect(escapeSpreadsheetCell("=1+1")).toBe("'=1+1");
    expect(escapeSpreadsheetCell("+SUM(A1:A2)")).toBe("'+SUM(A1:A2)");
    expect(escapeSpreadsheetCell("-2+3")).toBe("'-2+3");
    expect(escapeSpreadsheetCell("@cmd")).toBe("'@cmd");
  });

  it("leaves safe values unchanged", () => {
    expect(escapeSpreadsheetCell("Student Name")).toBe("Student Name");
    expect(escapeSpreadsheetCell("SCU-001")).toBe("SCU-001");
  });

  it("escapes every cell in a row", () => {
    expect(escapeSpreadsheetRow(["=1", "safe", "+2"])).toEqual(["'=1", "safe", "'+2"]);
  });

  it("sanitizes display objects recursively", () => {
    expect(sanitizeSpreadsheetDisplayValue({
      rows: [
        { fullName: "=cmd", admissionNumber: "+123", className: "-A", streamName: "@B" },
      ],
    })).toEqual({
      rows: [
        { fullName: "'=cmd", admissionNumber: "'+123", className: "'-A", streamName: "'@B" },
      ],
    });
  });

  it("rejects oversized spreadsheet matrices", () => {
    expect(() => assertSpreadsheetMatrixShape(Array.from({ length: 5001 }, () => ["ok"]), "The test sheet")).toThrow(/too many rows/i);
    expect(() => assertSpreadsheetMatrixShape([Array.from({ length: 51 }, () => "ok")], "The test sheet")).toThrow(/too many columns/i);
    expect(() => assertSpreadsheetMatrixShape([["x".repeat(2001)]], "The test sheet")).toThrow(/maximum allowed length/i);
  });
});
