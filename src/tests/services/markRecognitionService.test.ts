import { describe, expect, it } from "vitest";
import { normalizeMark, parseSplitCellText } from "../../server/services/markRecognitionService";

describe("normalizeMark", () => {
  it("returns numeric string for clean digit strings", () => {
    expect(normalizeMark("82")).toBe("82");
    expect(normalizeMark("100")).toBe("100");
    expect(normalizeMark("0")).toBe("0");
    expect(normalizeMark("7")).toBe("7");
  });

  it("normalises AB (absent) including OCR noise variants", () => {
    expect(normalizeMark("AB")).toBe("AB");
    expect(normalizeMark("ab")).toBe("AB");
    expect(normalizeMark("A8")).toBe("AB"); // OCR often reads B as 8
    expect(normalizeMark("A B")).toBe("AB");
  });

  it("normalises EX (exempt)", () => {
    expect(normalizeMark("EX")).toBe("EX");
    expect(normalizeMark("ex")).toBe("EX");
  });

  it("strips non-digit noise and returns numeric mark", () => {
    expect(normalizeMark("82.")).toBe("82"); // trailing period
    expect(normalizeMark(".82")).toBe("82"); // leading period
  });

  it("returns empty string for blank input", () => {
    expect(normalizeMark("")).toBe("");
    expect(normalizeMark("   ")).toBe("");
  });

  it("returns empty string for unreadable garbage", () => {
    expect(normalizeMark("???")).toBe("");
    expect(normalizeMark("---")).toBe("");
  });

  it("rejects values above 100", () => {
    // 101 as a 3-digit number: stripped digits = "101", 101 > 100 → ""
    expect(normalizeMark("101")).toBe("");
  });

  it("handles single-digit marks", () => {
    expect(normalizeMark("5")).toBe("5");
    expect(normalizeMark(" 5 ")).toBe("5");
  });
});

describe("parseSplitCellText", () => {
  it("extracts the last (total) mark from a space-separated split cell", () => {
    // Split mark cell: three sub-totals + total
    expect(parseSplitCellText("20 30 32 82")).toBe("82");
  });

  it("returns the mark when only one value is present", () => {
    expect(parseSplitCellText("74")).toBe("74");
  });

  it("returns empty for blank cell", () => {
    expect(parseSplitCellText("")).toBe("");
    expect(parseSplitCellText("   ")).toBe("");
  });

  it("handles AB in split cell", () => {
    expect(parseSplitCellText("AB")).toBe("AB");
  });

  it("handles pipe-separated values (scanner artefact)", () => {
    expect(parseSplitCellText("25|30|19|74")).toBe("74");
  });

  it("skips noise tokens and finds the valid mark", () => {
    // OCR may produce stray punctuation
    expect(parseSplitCellText("... 82")).toBe("82");
  });

  it("extracts the fixture mark S1A-001=82", () => {
    // Simulated full split-cell read for a student who scored 82
    expect(parseSplitCellText("30 27 25 82")).toBe("82");
  });

  it("extracts the fixture mark S1A-003=100", () => {
    expect(parseSplitCellText("34 33 33 100")).toBe("100");
  });
});
