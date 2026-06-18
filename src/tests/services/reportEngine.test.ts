import { describe, expect, it } from "vitest";
import { buildReports, type EngineInput } from "../../server/services/reportEngine";
import { gradeForAverage } from "../../server/services/gradeService";
import { defaultSettingsSections } from "../../shared/types/settings";

const baseInput: EngineInput = {
  filters: { schoolCode: "SCU-PREVIEW", classId: "c1", assessmentType: "TERM_SUMMARY" },
  academicYearName: "2025/2026",
  termName: "Term 1",
  hasActiveTerm: true,
  subjects: [
    { id: "eng", name: "English Language", sortOrder: 1 },
    { id: "math", name: "Mathematics", sortOrder: 2 },
  ],
  students: [
    {
      id: "s1",
      admissionNumber: "S1A-001",
      firstName: "Kampala",
      lastName: "Ssempebwa",
      className: "Senior 1 A",
      streamName: "A",
      contactReadiness: "READY",
      contactSummary: "Agnes Namusoke (Mother) - +256700100001",
    },
    {
      id: "s2",
      admissionNumber: "S1A-002",
      firstName: "Brian",
      lastName: "Mugisha",
      className: "Senior 1 A",
      streamName: "A",
      contactReadiness: "NO_RECIPIENT",
      contactSummary: "No guardian contacts",
    },
  ],
  marks: [
    { studentId: "s1", subjectId: "eng", assessmentType: "BOT", marks: 80 },
    { studentId: "s1", subjectId: "eng", assessmentType: "EOT", marks: 90 },
    { studentId: "s1", subjectId: "math", assessmentType: "BOT", marks: 70 },
    { studentId: "s1", subjectId: "math", assessmentType: "EOT", marks: 80 },
    { studentId: "s2", subjectId: "eng", assessmentType: "BOT", marks: 50 },
    { studentId: "s2", subjectId: "eng", assessmentType: "EOT", marks: 60 },
  ],
};

describe("reportEngine", () => {
  it("calculates averages, grades, and positions", () => {
    const report = buildReports({
      ...baseInput,
      settings: {
        school: defaultSettingsSections.school,
        reports: { ...defaultSettingsSections.reports, showOverallPosition: true },
        grading: defaultSettingsSections.grading,
      },
    });
    expect(report.cards[0].average).toBe(80);
    expect(report.cards[0].grade).toBe("D1");
    expect(report.cards[0].overallPosition).toBe(1);
    expect(report.cards[1].readiness).toBe("MISSING_MARKS");
  });

  it("hides overall position when the report setting is off", () => {
    const report = buildReports(baseInput);
    expect(report.cards[0].overallPosition).toBeNull();
  });

  it("does not create cards from marks when the student is not in enrolled input", () => {
    const report = buildReports({
      ...baseInput,
      marks: [...baseInput.marks, { studentId: "not-enrolled", subjectId: "eng", assessmentType: "BOT", marks: 99 }],
    });
    expect(report.cards).toHaveLength(2);
    expect(report.cards.some((card) => card.studentId === "not-enrolled")).toBe(false);
  });

  it("passes report contact readiness warnings onto cards", () => {
    const report = buildReports(baseInput);
    expect(report.cards[0].contactReadiness).toBe("READY");
    expect(report.cards[1].contactReadiness).toBe("NO_RECIPIENT");
  });

  it("filters by BOT assessment type", () => {
    const report = buildReports({ ...baseInput, filters: { ...baseInput.filters, assessmentType: "BOT" } });
    expect(report.cards[0].subjects[0].average).toBe(80);
    expect(report.cards[0].subjects[0].total).toBe(80);
  });

  it("filters by MOT assessment type", () => {
    const motInput: EngineInput = {
      ...baseInput,
      filters: { ...baseInput.filters, assessmentType: "MOT" },
      marks: [
        { studentId: "s1", subjectId: "eng", assessmentType: "MOT", marks: 85 },
        { studentId: "s1", subjectId: "math", assessmentType: "MOT", marks: 75 },
        { studentId: "s2", subjectId: "eng", assessmentType: "MOT", marks: 60 },
      ],
    };
    const report = buildReports(motInput);
    expect(report.cards[0].subjects[0].motMarks).toBe(85);
    expect(report.cards[0].subjects[0].botMarks).toBeNull();
    expect(report.cards[0].subjects[0].eotMarks).toBeNull();
    expect(report.cards[0].subjects[0].average).toBe(85);
    expect(report.cards[0].subjects[0].total).toBe(85);
  });

  it("term summary includes BOT + MOT + EOT", () => {
    const summaryInput: EngineInput = {
      ...baseInput,
      students: [baseInput.students[0]],
      marks: [
        { studentId: "s1", subjectId: "eng", assessmentType: "BOT", marks: 70 },
        { studentId: "s1", subjectId: "eng", assessmentType: "MOT", marks: 80 },
        { studentId: "s1", subjectId: "eng", assessmentType: "EOT", marks: 90 },
        { studentId: "s1", subjectId: "math", assessmentType: "BOT", marks: 60 },
        { studentId: "s1", subjectId: "math", assessmentType: "MOT", marks: 70 },
        { studentId: "s1", subjectId: "math", assessmentType: "EOT", marks: 80 },
      ],
    };
    const report = buildReports(summaryInput);
    const eng = report.cards[0].subjects[0];
    expect(eng.botMarks).toBe(70);
    expect(eng.motMarks).toBe(80);
    expect(eng.eotMarks).toBe(90);
    expect(eng.total).toBe(240);
    expect(eng.average).toBe(80);
    expect(eng.grade).toBe("D1");
    expect(report.cards[0].readiness).toBe("READY");
  });

  it("reports no active term empty state", () => {
    const report = buildReports({ ...baseInput, hasActiveTerm: false });
    expect(report.readiness).toBe("NO_ACTIVE_TERM");
    expect(report.cards).toHaveLength(0);
  });
});

describe("gradeService", () => {
  it("maps averages to grades", () => {
    expect(gradeForAverage(80)).toBe("D1");
    expect(gradeForAverage(52)).toBe("C6");
    expect(gradeForAverage(39)).toBe("F9");
  });
});

