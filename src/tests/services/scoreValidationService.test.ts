import { describe, expect, it } from "vitest";
import { validateScoreEntry } from "../../server/services/scoreValidationService";

describe("validateScoreEntry", () => {
  it("accepts 0", () => {
    const result = validateScoreEntry("0");
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.kind).toBe("numeric");
      expect(result.numericValue).toBe(0);
    }
  });

  it("accepts 100", () => {
    const result = validateScoreEntry("100");
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.kind).toBe("numeric");
      expect(result.numericValue).toBe(100);
    }
  });

  it("rejects negative values", () => {
    const result = validateScoreEntry("-1");
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.error).toMatch(/0.*100|range/i);
  });

  it("rejects values above 100", () => {
    const result = validateScoreEntry("101");
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.error).toMatch(/0.*100|range/i);
  });

  it("rejects blank by default", () => {
    const result = validateScoreEntry("");
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.error).toMatch(/required/i);
  });

  it("allows blank only when explicitly permitted", () => {
    const result = validateScoreEntry("", { allowBlank: true });
    expect(result.valid).toBe(true);
    if (result.valid) expect(result.kind).toBe("blank");
  });

  it("accepts AB only when absence is supported", () => {
    expect(validateScoreEntry("AB").valid).toBe(false);
    const result = validateScoreEntry("AB", { allowAbsent: true });
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.kind).toBe("code");
      expect(result.code).toBe("AB");
    }
  });

  it("accepts EX only when exemption is supported", () => {
    expect(validateScoreEntry("EX").valid).toBe(false);
    const result = validateScoreEntry("EX", { allowExempt: true });
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.kind).toBe("code");
      expect(result.code).toBe("EX");
    }
  });

  it("rejects random text", () => {
    const result = validateScoreEntry("banana", { allowAbsent: true, allowExempt: true });
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.error).toMatch(/not valid/i);
  });
});
