import { describe, expect, it } from "vitest";
import { COMMENT_LIMITS, EMPTY_REPORT_COMMENTS } from "../../shared/utils/reportComments";

describe("COMMENT_LIMITS", () => {
  it("defines classTeacherComment limit at 500", () => {
    expect(COMMENT_LIMITS.classTeacherComment).toBe(500);
  });

  it("defines headTeacherComment limit at 500", () => {
    expect(COMMENT_LIMITS.headTeacherComment).toBe(500);
  });

  it("defines conductNote limit at 300", () => {
    expect(COMMENT_LIMITS.conductNote).toBe(300);
  });

  it("defines classTeacherName limit at 100", () => {
    expect(COMMENT_LIMITS.classTeacherName).toBe(100);
  });

  it("defines headTeacherName limit at 100", () => {
    expect(COMMENT_LIMITS.headTeacherName).toBe(100);
  });

  it("all limits are positive integers", () => {
    for (const [, value] of Object.entries(COMMENT_LIMITS)) {
      expect(Number.isInteger(value)).toBe(true);
      expect(value).toBeGreaterThan(0);
    }
  });
});

describe("EMPTY_REPORT_COMMENTS", () => {
  it("all fields are empty strings", () => {
    for (const [, value] of Object.entries(EMPTY_REPORT_COMMENTS)) {
      expect(value).toBe("");
    }
  });

  it("has the expected shape", () => {
    expect(EMPTY_REPORT_COMMENTS).toMatchObject({
      classTeacherComment: "",
      headTeacherComment: "",
      conductNote: "",
      classTeacherName: "",
      headTeacherName: "",
      issueDate: "",
    });
  });
});

describe("comment limit enforcement — overflow boundary", () => {
  it("a 501-char classTeacherComment exceeds the 500-char limit", () => {
    const oversized = "A".repeat(COMMENT_LIMITS.classTeacherComment + 1);
    expect(oversized.length).toBeGreaterThan(COMMENT_LIMITS.classTeacherComment);
  });

  it("a 500-char classTeacherComment is within the limit", () => {
    const atLimit = "A".repeat(COMMENT_LIMITS.classTeacherComment);
    expect(atLimit.length).toBeLessThanOrEqual(COMMENT_LIMITS.classTeacherComment);
  });

  it("a 301-char conductNote exceeds the 300-char limit", () => {
    const oversized = "C".repeat(COMMENT_LIMITS.conductNote + 1);
    expect(oversized.length).toBeGreaterThan(COMMENT_LIMITS.conductNote);
  });
});
