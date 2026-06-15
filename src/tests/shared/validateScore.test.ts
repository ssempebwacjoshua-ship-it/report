import { describe, expect, it } from "vitest";
import { validateScore } from "../../shared/utils/validateScore";

describe("validateScore — valid inputs", () => {
  it("accepts 0", () => {
    const result = validateScore("0");
    expect(result.valid).toBe(true);
    if (result.valid) expect(result.value).toBe(0);
  });

  it("accepts 100", () => {
    const result = validateScore("100");
    expect(result.valid).toBe(true);
    if (result.valid) expect(result.value).toBe(100);
  });

  it("accepts mid-range score", () => {
    const result = validateScore("72");
    expect(result.valid).toBe(true);
    if (result.valid) expect(result.value).toBe(72);
  });

  it("accepts a decimal score within range", () => {
    const result = validateScore("85.5");
    expect(result.valid).toBe(true);
    if (result.valid) expect(result.value).toBe(85.5);
  });

  it("accepts a number input (not a string)", () => {
    const result = validateScore(55);
    expect(result.valid).toBe(true);
    if (result.valid) expect(result.value).toBe(55);
  });

  it("trims surrounding whitespace", () => {
    const result = validateScore("  42  ");
    expect(result.valid).toBe(true);
    if (result.valid) expect(result.value).toBe(42);
  });
});

describe("validateScore — rejected inputs", () => {
  it("rejects empty string", () => {
    const result = validateScore("");
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.error).toBeTruthy();
  });

  it("rejects null", () => {
    const result = validateScore(null);
    expect(result.valid).toBe(false);
  });

  it("rejects undefined", () => {
    const result = validateScore(undefined);
    expect(result.valid).toBe(false);
  });

  it("rejects whitespace-only string", () => {
    const result = validateScore("   ");
    expect(result.valid).toBe(false);
  });

  it("rejects non-numeric text", () => {
    expect(validateScore("abc").valid).toBe(false);
    expect(validateScore("text").valid).toBe(false);
    expect(validateScore("PASS").valid).toBe(false);
  });

  it("rejects -1 (below zero)", () => {
    const result = validateScore("-1");
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.error).toMatch(/range|0/i);
  });

  it("rejects 101 (above 100)", () => {
    const result = validateScore("101");
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.error).toMatch(/range|100/i);
  });

  it("rejects 990", () => {
    const result = validateScore("990");
    expect(result.valid).toBe(false);
  });

  it("rejects NaN-producing input", () => {
    expect(validateScore("NaN").valid).toBe(false);
    expect(validateScore("Infinity").valid).toBe(false);
    expect(validateScore("-Infinity").valid).toBe(false);
  });
});

describe("validateScore — error messages", () => {
  it("error is null when valid", () => {
    const result = validateScore("50");
    expect(result.error).toBeNull();
  });

  it("error is a non-empty string when invalid", () => {
    const result = validateScore("-5");
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(typeof result.error).toBe("string");
      expect(result.error.length).toBeGreaterThan(0);
    }
  });

  it("value is null when invalid", () => {
    const result = validateScore("abc");
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.value).toBeNull();
  });
});
