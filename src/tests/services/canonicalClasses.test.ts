import { describe, expect, it } from "vitest";
import {
  CANONICAL_CLASSES,
  CANONICAL_CLASSES_BY_SECTION,
  getClassesForSections,
  isCanonicalClassCode,
} from "../../shared/constants/classes";

describe("canonical class catalog ? Primary section", () => {
  const primary = CANONICAL_CLASSES_BY_SECTION.PRIMARY;

  it("defines exactly P1–P7", () => {
    expect(primary).toHaveLength(7);
    expect(primary.map((c) => c.code)).toEqual(["P1", "P2", "P3", "P4", "P5", "P6", "P7"]);
  });

  it("uses P1–P7 as both name and code", () => {
    expect(primary.map((c) => c.name)).toEqual([
      "Primary 1", "Primary 2", "Primary 3", "Primary 4", "Primary 5", "Primary 6", "Primary 7",
    ]);
  });

  it("sorts by ascending level", () => {
    const levels = primary.map((c) => c.level);
    expect(levels).toEqual([...levels].sort((a, b) => a - b));
  });
});

describe("canonical class catalog ? Secondary section", () => {
  const secondary = CANONICAL_CLASSES_BY_SECTION.SECONDARY;

  it("defines exactly S1–S6", () => {
    expect(secondary).toHaveLength(6);
    expect(secondary.map((c) => c.code)).toEqual(["S1", "S2", "S3", "S4", "S5", "S6"]);
  });

  it("uses Senior N display names", () => {
    expect(secondary.map((c) => c.name)).toEqual([
      "Senior 1", "Senior 2", "Senior 3", "Senior 4", "Senior 5", "Senior 6",
    ]);
  });

  it("codes differ from display names", () => {
    for (const cls of secondary) {
      expect(cls.name).not.toBe(cls.code);
    }
  });

  it("sorts by ascending level", () => {
    const levels = secondary.map((c) => c.level);
    expect(levels).toEqual([...levels].sort((a, b) => a - b));
  });
});

describe("canonical class catalog ? Nursery section", () => {
  const nursery = CANONICAL_CLASSES_BY_SECTION.NURSERY;

  it("defines Baby Class, Middle Class, Top Class", () => {
    expect(nursery).toHaveLength(3);
    expect(nursery.map((c) => c.name)).toEqual(["Baby Class", "Middle Class", "Top Class"]);
  });

  it("uses stable nursery codes", () => {
    expect(nursery.map((c) => c.code)).toEqual(["NUR_BABY", "NUR_MIDDLE", "NUR_TOP"]);
  });
});

describe("canonical class catalog ? full list", () => {
  it("has 16 classes total (3 nursery + 7 primary + 6 secondary)", () => {
    expect(CANONICAL_CLASSES).toHaveLength(16);
  });

  it("all levels are unique", () => {
    const levels = CANONICAL_CLASSES.map((c) => c.level);
    const unique = new Set(levels);
    expect(unique.size).toBe(levels.length);
  });

  it("all codes are unique", () => {
    const codes = CANONICAL_CLASSES.map((c) => c.code);
    const unique = new Set(codes);
    expect(unique.size).toBe(codes.length);
  });
});

describe("isCanonicalClassCode", () => {
  it("accepts canonical codes exactly", () => {
    expect(isCanonicalClassCode("S1")).toBe(true);
    expect(isCanonicalClassCode("S6")).toBe(true);
    expect(isCanonicalClassCode("P1")).toBe(true);
    expect(isCanonicalClassCode("P7")).toBe(true);
    expect(isCanonicalClassCode("NUR_BABY")).toBe(true);
    expect(isCanonicalClassCode("NUR_MIDDLE")).toBe(true);
    expect(isCanonicalClassCode("NUR_TOP")).toBe(true);
  });

  it("is case-insensitive", () => {
    expect(isCanonicalClassCode("s1")).toBe(true);
    expect(isCanonicalClassCode("p4")).toBe(true);
    expect(isCanonicalClassCode("nur_baby")).toBe(true);
  });

  it("rejects class+stream composite codes", () => {
    // Common bad patterns: class code + stream letter suffix
    expect(isCanonicalClassCode("S1A")).toBe(false);
    expect(isCanonicalClassCode("S1B")).toBe(false);
    expect(isCanonicalClassCode("S2C")).toBe(false);
    expect(isCanonicalClassCode("P4BLUE")).toBe(false);
    expect(isCanonicalClassCode("P5RED")).toBe(false);
  });

  it("rejects arbitrary non-canonical codes", () => {
    expect(isCanonicalClassCode("GRADE1")).toBe(false);
    expect(isCanonicalClassCode("CLASS1")).toBe(false);
    expect(isCanonicalClassCode("")).toBe(false);
    expect(isCanonicalClassCode("S0")).toBe(false);
    expect(isCanonicalClassCode("S7")).toBe(false);
    expect(isCanonicalClassCode("P8")).toBe(false);
  });

  it("trims whitespace before checking", () => {
    expect(isCanonicalClassCode("  S1  ")).toBe(true);
    expect(isCanonicalClassCode("  S1A  ")).toBe(false);
  });
});

describe("getClassesForSections", () => {
  it("returns only PRIMARY classes for [PRIMARY]", () => {
    const result = getClassesForSections(["PRIMARY"]);
    expect(result).toHaveLength(7);
    expect(result.every((c) => c.section === "PRIMARY")).toBe(true);
  });

  it("returns only SECONDARY classes for [SECONDARY]", () => {
    const result = getClassesForSections(["SECONDARY"]);
    expect(result).toHaveLength(6);
    expect(result.every((c) => c.section === "SECONDARY")).toBe(true);
  });

  it("returns only NURSERY classes for [NURSERY]", () => {
    const result = getClassesForSections(["NURSERY"]);
    expect(result).toHaveLength(3);
    expect(result.every((c) => c.section === "NURSERY")).toBe(true);
  });

  it("returns NURSERY + PRIMARY for [NURSERY, PRIMARY]", () => {
    const result = getClassesForSections(["NURSERY", "PRIMARY"]);
    expect(result).toHaveLength(10);
  });

  it("returns PRIMARY + SECONDARY for [PRIMARY, SECONDARY]", () => {
    const result = getClassesForSections(["PRIMARY", "SECONDARY"]);
    expect(result).toHaveLength(13);
  });

  it("returns PRIMARY + SECONDARY for [COMBINED]", () => {
    const result = getClassesForSections(["COMBINED"]);
    expect(result).toHaveLength(13);
  });

  it("returns all 16 for all three sections", () => {
    const result = getClassesForSections(["NURSERY", "PRIMARY", "SECONDARY"]);
    expect(result).toHaveLength(16);
  });

  it("returns empty array for empty input", () => {
    expect(getClassesForSections([])).toHaveLength(0);
  });

  it("maintains level sort order", () => {
    const result = getClassesForSections(["NURSERY", "SECONDARY"]);
    const levels = result.map((c) => c.level);
    expect(levels).toEqual([...levels].sort((a, b) => a - b));
  });
});

