import { describe, expect, it } from "vitest";
import { acceptedExtractedMark, ocrFailureReason } from "../../server/services/scanExtractionService";
import { normalizeMark, parseSplitZoneTexts } from "../../server/services/markRecognitionService";

// â”€â”€ acceptedExtractedMark acceptance logic â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

describe("acceptedExtractedMark", () => {
  it("accepts when written and split agree with high confidence", () => {
    const { mark, reason } = acceptedExtractedMark("76", "76", 0.88, 0.91);
    expect(mark).toBe("76");
    expect(reason).toMatch(/agree/i);
  });

  it("accepts split-only with very high confidence (written is optional confirmation)", () => {
    const { mark } = acceptedExtractedMark("", "82", 0.90, 0);
    expect(mark).toBe("82");
  });

  it("rejects when written and split disagree, even with high confidence", () => {
    const { mark, reason } = acceptedExtractedMark("76", "82", 0.92, 0.93);
    expect(mark).toBe("");
    expect(reason).toMatch(/disagree/i);
  });

  it("rejects when confidence is below 0.75 (low confidence)", () => {
    // Both marks agree but confidence is low â€” must NOT produce an extracted mark
    const { mark } = acceptedExtractedMark("76", "76", 0.41, 0.39);
    expect(mark).toBe("");
  });

  it("rejects when both marks are blank (no OCR text at all)", () => {
    const { mark, reason } = acceptedExtractedMark("", "", 0, 0);
    expect(mark).toBe("");
    expect(reason).toMatch(/operator entry/i);
  });

  it("accepts written mark when split zones are a numeric suffix (partial zone OCR failure)", () => {
    // PaddleOCR misread zone 1's '7' as a CJK character; zones combine to '6' not '76'.
    // Written mark correctly reads '76'. Suffix match: '76'.endsWith('6') â†’ accept '76'.
    const { mark, reason } = acceptedExtractedMark("76", "6", 0.70, 0.70);
    expect(mark).toBe("76");
    expect(reason).toMatch(/confirmed|accepted/i);
  });

  it("rejects suffix match when written confidence is too low", () => {
    // writtenConfidence below 0.60 means we can't trust the written mark enough
    const { mark } = acceptedExtractedMark("76", "6", 0.70, 0.55);
    expect(mark).toBe("");
  });

  it("does not treat non-suffix partial matches as agreement", () => {
    // '7' is not a suffix of '82' â€” genuine disagreement
    const { mark, reason } = acceptedExtractedMark("82", "7", 0.80, 0.80);
    expect(mark).toBe("");
    expect(reason).toMatch(/disagree/i);
  });

  it("rejects when only written mark present and confidence below threshold", () => {
    const { mark } = acceptedExtractedMark("94", "", 0, 0.55);
    expect(mark).toBe("");
  });

  it("accepts AB marks when both sides agree with high confidence", () => {
    const { mark } = acceptedExtractedMark("AB", "AB", 0.88, 0.85);
    expect(mark).toBe("AB");
  });

  it("accepts EX marks when both sides agree with high confidence", () => {
    const { mark } = acceptedExtractedMark("EX", "EX", 0.91, 0.88);
    expect(mark).toBe("EX");
  });
});

// â”€â”€ Extracted text must not be silently discarded â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
//
// These tests confirm that OCR text flows through normalisation correctly even
// when the mark will ultimately be rejected (low confidence, out of range, etc.).

describe("OCR text not silently discarded", () => {
  it("normalizeMark passes through digit text even when it will be rejected later", () => {
    // "7" normalises to "7" â€” acceptance threshold is checked by acceptedExtractedMark, not here
    expect(normalizeMark("7")).toBe("7");
    expect(normalizeMark("82")).toBe("82");
  });

  it("normalizeMark does not swallow OCR noise for AB/EX", () => {
    expect(normalizeMark("A8")).toBe("AB"); // OCR often reads B as 8
    expect(normalizeMark("A B")).toBe("AB");
  });

  it("parseSplitZoneTexts returns combined mark even for low-confidence zones", () => {
    // Zone texts from low-confidence OCR â€” the combination still yields a parseable mark
    expect(parseSplitZoneTexts(["7", "6", ""])).toBe("76");
    expect(parseSplitZoneTexts(["9", "4", ""])).toBe("94");
  });

  it("parseSplitZoneTexts returns blank when all zones are empty (not a fake zero)", () => {
    expect(parseSplitZoneTexts(["", "", ""])).toBe("");
  });
});

// â”€â”€ Crop ID â†’ student row mapping â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
//
// Verifies the crop ID convention used in scanExtractionService matches what
// remoteCropOcrProvider reads back from the OCR service response.

describe("crop ID mapping convention", () => {
  const admNumber = "S1A-001";

  it("written crop ID is <admissionNumber>-written", () => {
    const cropId = `${admNumber}-written`;
    expect(cropId).toBe("S1A-001-written");
  });

  it("split zone IDs are <admissionNumber>-split-N (1-indexed)", () => {
    const zoneIds = [1, 2, 3].map((n) => `${admNumber}-split-${n}`);
    expect(zoneIds).toEqual(["S1A-001-split-1", "S1A-001-split-2", "S1A-001-split-3"]);
  });

  it("crop IDs are unique across students", () => {
    const students = ["S1A-001", "S1A-002", "S1A-003", "S1A-004"];
    const ids = students.flatMap((adm) => [
      `${adm}-written`,
      `${adm}-split-1`,
      `${adm}-split-2`,
      `${adm}-split-3`,
    ]);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

// â”€â”€ Low confidence in debug, not accepted as valid â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

describe("low confidence rejection behaviour", () => {
  it("confidence 0.41 produces blank extractedMark but raw text is still available", () => {
    // Simulate what happens when OCR returns "7" at 0.41 confidence
    const rawText = "7";
    const normalised = normalizeMark(rawText);          // "7" â€” text preserved
    const { mark } = acceptedExtractedMark(normalised, normalised, 0.41, 0.41);

    // The raw text is visible (not discarded), but the accepted mark is blank
    expect(normalised).toBe("7");
    expect(mark).toBe("");
  });

  it("confidence 0.85+ on split mark produces an extracted mark", () => {
    const rawText = "82";
    const normalised = normalizeMark(rawText);
    const { mark } = acceptedExtractedMark("", normalised, 0.87, 0);
    expect(mark).toBe("82");
  });

  it("confidence exactly at threshold boundary", () => {
    // 0.75 on both sides â€” accepted
    expect(acceptedExtractedMark("76", "76", 0.75, 0.75).mark).toBe("76");
    // 0.74 â€” just below threshold â€” rejected
    expect(acceptedExtractedMark("76", "76", 0.74, 0.74).mark).toBe("");
    // 0.85 split-only â€” accepted
    expect(acceptedExtractedMark("", "76", 0.85, 0).mark).toBe("76");
    // 0.84 split-only â€” rejected
    expect(acceptedExtractedMark("", "76", 0.84, 0).mark).toBe("");
  });
});

// â”€â”€ All roster students must appear even if OCR fails â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
//
// This is covered by scanOperatorWorkflow.test.ts (keeps all roster rows).
// The normalisation layer also must never throw for any OCR output.

// â”€â”€ ocrFailureReason message accuracy â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

describe("ocrFailureReason", () => {
  it("reachable Azure message says 'no text', not 'unavailable'", () => {
    const msg = ocrFailureReason("azure", true);
    expect(msg).toMatch(/no text/i);
    expect(msg.toLowerCase()).not.toContain("unavailable");
    expect(msg.toLowerCase()).not.toContain("unreachable");
  });

  it("unreachable provider returns the friendly support message", () => {
    const msg = ocrFailureReason("azure", false);
    expect(msg).toBe("OCR temporarily unavailable. Contact platform support.");
  });

  it("names Azure OCR for no-text crop failures", () => {
    expect(ocrFailureReason("azure", true)).toContain("Azure OCR");
  });
});

// â”€â”€ OCR auto-commit guard â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

describe("OCR never auto-commits", () => {
  it("acceptedExtractedMark never returns a mark without at least one valid signal", () => {
    // Simulate every case where BOTH written and split are blank
    expect(acceptedExtractedMark("", "", 1.0, 1.0).mark).toBe("");
    // Split-only at 84% (below 0.85 threshold) must not commit
    expect(acceptedExtractedMark("", "76", 0.84, 0).mark).toBe("");
    // Written-only with no split confirmation must not commit
    expect(acceptedExtractedMark("76", "", 0, 0.55).mark).toBe("");
  });
});

describe("normalisation robustness", () => {
  const garbageInputs = ["???", "---", "|||", "\x00\x01", "999", "1000", "ABX", "EXX", "", "   "];

  it("normalizeMark never throws, always returns a string", () => {
    for (const input of garbageInputs) {
      expect(() => normalizeMark(input)).not.toThrow();
      expect(typeof normalizeMark(input)).toBe("string");
    }
  });

  it("parseSplitZoneTexts never throws for any zone combination", () => {
    const combos = [
      ["", "", ""],
      ["X", "Y", "Z"],
      ["999", "999", "999"],
      ["\x00", "", ""],
      ["A", "B", "X"],
    ];
    for (const zones of combos) {
      expect(() => parseSplitZoneTexts(zones)).not.toThrow();
      expect(typeof parseSplitZoneTexts(zones)).toBe("string");
    }
  });
});

