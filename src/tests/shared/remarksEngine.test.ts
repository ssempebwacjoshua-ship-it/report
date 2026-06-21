import { describe, expect, it } from "vitest";
import {
  getBandForAverage,
  generateRemarks,
  type PerformanceBand,
} from "../../shared/utils/remarksEngine";

// ── Band classification ───────────────────────────────────────────────────────

describe("getBandForAverage ? band boundaries", () => {
  const cases: Array<[number, PerformanceBand]> = [
    [100, "EXCELLENT"],
    [85,  "EXCELLENT"],
    [84,  "VERY_GOOD"],
    [70,  "VERY_GOOD"],
    [69,  "GOOD"],
    [55,  "GOOD"],
    [54,  "FAIR"],
    [40,  "FAIR"],
    [39,  "WEAK"],
    [0,   "WEAK"],
  ];

  for (const [score, expected] of cases) {
    it(`score ${score} → ${expected}`, () => {
      expect(getBandForAverage(score)).toBe(expected);
    });
  }
});

describe("getBandForAverage ? typical averages", () => {
  it("92 → EXCELLENT", () => expect(getBandForAverage(92)).toBe("EXCELLENT"));
  it("75 → VERY_GOOD", () => expect(getBandForAverage(75)).toBe("VERY_GOOD"));
  it("62 → GOOD",      () => expect(getBandForAverage(62)).toBe("GOOD"));
  it("47 → FAIR",      () => expect(getBandForAverage(47)).toBe("FAIR"));
  it("25 → WEAK",      () => expect(getBandForAverage(25)).toBe("WEAK"));
});

// ── generateRemarks ───────────────────────────────────────────────────────────

describe("generateRemarks ? null average", () => {
  it("returns null when average is null", () => {
    expect(generateRemarks(null)).toBeNull();
  });
});

describe("generateRemarks ? EXCELLENT band", () => {
  it("generates excellent class teacher comment", () => {
    const result = generateRemarks(90);
    expect(result).not.toBeNull();
    expect(result!.band).toBe("EXCELLENT");
    expect(result!.classTeacherComment).toMatch(/excellent/i);
    expect(result!.classTeacherComment.length).toBeGreaterThan(10);
  });

  it("generates excellent head teacher comment", () => {
    const result = generateRemarks(90);
    expect(result!.headTeacherComment).toMatch(/commendable|excellent|dedication/i);
  });
});

describe("generateRemarks ? VERY_GOOD band", () => {
  it("generates very good class teacher comment", () => {
    const result = generateRemarks(77);
    expect(result!.band).toBe("VERY_GOOD");
    expect(result!.classTeacherComment).toMatch(/very good/i);
  });
});

describe("generateRemarks ? GOOD band", () => {
  it("generates good class teacher comment", () => {
    const result = generateRemarks(60);
    expect(result!.band).toBe("GOOD");
    expect(result!.classTeacherComment).toMatch(/good/i);
  });
});

describe("generateRemarks ? FAIR band", () => {
  it("generates fair class teacher comment mentioning improvement", () => {
    const result = generateRemarks(45);
    expect(result!.band).toBe("FAIR");
    expect(result!.classTeacherComment).toMatch(/fair/i);
  });
});

describe("generateRemarks ? WEAK band", () => {
  it("generates weak class teacher comment mentioning improvement", () => {
    const result = generateRemarks(20);
    expect(result!.band).toBe("WEAK");
    expect(result!.classTeacherComment).toMatch(/improvement|effort/i);
  });

  it("generates weak head teacher comment with urgent language", () => {
    const result = generateRemarks(20);
    expect(result!.headTeacherComment).toMatch(/improvement|urgent/i);
  });
});

describe("generateRemarks ? comment quality", () => {
  it("all bands produce non-empty class teacher comments", () => {
    for (const avg of [90, 77, 60, 45, 20]) {
      const result = generateRemarks(avg);
      expect(result!.classTeacherComment.length).toBeGreaterThan(20);
    }
  });

  it("all bands produce non-empty head teacher comments", () => {
    for (const avg of [90, 77, 60, 45, 20]) {
      const result = generateRemarks(avg);
      expect(result!.headTeacherComment.length).toBeGreaterThan(20);
    }
  });

  it("class teacher and head teacher comments differ for each band", () => {
    for (const avg of [90, 77, 60, 45, 20]) {
      const result = generateRemarks(avg);
      expect(result!.classTeacherComment).not.toBe(result!.headTeacherComment);
    }
  });

  it("result is deterministic (same average always yields same comments)", () => {
    const a = generateRemarks(75);
    const b = generateRemarks(75);
    expect(a).toEqual(b);
  });

  it("clamps out-of-range averages (>100) to EXCELLENT", () => {
    const result = generateRemarks(105);
    expect(result!.band).toBe("EXCELLENT");
  });

  it("clamps negative averages to WEAK", () => {
    const result = generateRemarks(-5);
    expect(result!.band).toBe("WEAK");
  });
});
