import { describe, expect, it } from "vitest";
import { COMMENT_LIMITS, EMPTY_REPORT_COMMENTS } from "../../shared/utils/reportComments";
import {
  REPORT_CONTENT_LIMITS,
  constrainReportText,
  sanitizeReportCardForRender,
  sanitizeReportComments,
  sanitizeSchoolSettingsForReport,
} from "../../shared/utils/reportContentLimits";
import { defaultSettingsSections } from "../../shared/types/settings";

describe("report content limits", () => {
  it("keeps short comments unchanged", () => {
    expect(constrainReportText("Well done.", REPORT_CONTENT_LIMITS.classTeacherComment)).toBe("Well done.");
  });

  it("truncates long comments with a visible ellipsis", () => {
    const value = constrainReportText("A".repeat(REPORT_CONTENT_LIMITS.classTeacherComment + 20), REPORT_CONTENT_LIMITS.classTeacherComment);
    expect(value.endsWith("...")).toBe(true);
    expect(value.length).toBe(REPORT_CONTENT_LIMITS.classTeacherComment);
  });

  it("collapses repeated whitespace and newlines safely", () => {
    expect(constrainReportText("Excellent   work\n\n\nKeep going", 80, { preserveLineBreaks: true })).toBe("Excellent work\n\nKeep going");
  });

  it("sanitizes subject remarks and null comments safely", () => {
    const card = sanitizeReportCardForRender({
      studentId: "student-1",
      admissionNumber: "ADM-1",
      studentName: "Ada Student",
      className: "Senior 1",
      streamName: "A",
      academicYear: "2025/2026",
      term: "Term 1",
      marksFound: 1,
      totalSubjects: 1,
      average: 88,
      grade: "D1",
      overallPosition: null,
      readiness: "READY",
      missingMarks: [],
      comments: "",
      contactReadiness: "READY",
      contactSummary: "",
      progressionText: null,
      subjects: [{
        subjectId: "subject-1",
        subjectName: "English",
        botMarks: 88,
        motMarks: null,
        eotMarks: null,
        total: 88,
        average: 88,
        grade: "D1",
        subjectPosition: null,
        missingMarks: [],
        comments: `Strong start ${"x".repeat(200)}`,
      }],
    });

    expect(card.subjects[0].comments.length).toBeLessThanOrEqual(REPORT_CONTENT_LIMITS.subjectRemark);
    expect(sanitizeReportComments({
      classTeacherComment: null,
      headTeacherComment: undefined,
      conductNote: null,
      classTeacherName: undefined,
      headTeacherName: null,
      issueDate: "",
    })).toMatchObject({
      classTeacherComment: "",
      headTeacherComment: "",
      conductNote: "",
      classTeacherName: "",
      headTeacherName: "",
    });
  });

  it("constrains school footer/header text for report layout safety", () => {
    const school = sanitizeSchoolSettingsForReport({
      ...defaultSettingsSections.school,
      schoolName: "The Very Long School Name ".repeat(10),
      address: "Plot 1 Kampala",
      phone: "+256700000001",
      email: "school@example.com",
      reportFooterText: "Footer ".repeat(40),
    });

    expect(school.schoolName.length).toBeLessThanOrEqual(REPORT_CONTENT_LIMITS.schoolName);
    expect(school.address.length).toBeLessThanOrEqual(REPORT_CONTENT_LIMITS.schoolContactLine);
    expect(school.reportFooterText.length).toBeLessThanOrEqual(REPORT_CONTENT_LIMITS.reportFooterText);
    expect(school.phone).toBe("");
    expect(school.email).toBe("");
  });
});

describe("legacy report comment exports", () => {
  it("mirror the shared content limits", () => {
    expect(COMMENT_LIMITS.classTeacherComment).toBe(REPORT_CONTENT_LIMITS.classTeacherComment);
    expect(COMMENT_LIMITS.headTeacherComment).toBe(REPORT_CONTENT_LIMITS.headTeacherComment);
    expect(COMMENT_LIMITS.conductNote).toBe(REPORT_CONTENT_LIMITS.conductNote);
  });

  it("preserves the empty report comments shape", () => {
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
