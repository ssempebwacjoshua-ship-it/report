import { describe, expect, it } from "vitest";
import { buildReports, type EngineInput } from "../../server/services/reportEngine";
import { gradeForAverage } from "../../server/services/gradeService";

const baseInput: EngineInput = {
  filters: { schoolCode: "SCU-PREVIEW", classId: "c1", assessmentType: "ALL" },
  academicYearName: "2025/2026",
  termName: "Term 1",
  hasActiveTerm: true,
  subjects: [
    { id: "eng", name: "English Language", sortOrder: 1 },
    { id: "math", name: "Mathematics", sortOrder: 2 },
  ],
  students: [
    { id: "s1", admissionNumber: "S1A-001", firstName: "Kampala", lastName: "Ssempebwa", className: "Senior 1 A", streamName: "A" },
    { id: "s2", admissionNumber: "S1A-002", firstName: "Brian", lastName: "Mugisha", className: "Senior 1 A", streamName: "A" },
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
    const report = buildReports(baseInput);
    expect(report.cards[0].average).toBe(80);
    expect(report.cards[0].grade).toBe("D1");
    expect(report.cards[0].overallPosition).toBe(1);
    expect(report.cards[1].readiness).toBe("MISSING_MARKS");
  });

  it("filters by assessment type", () => {
    const report = buildReports({ ...baseInput, filters: { ...baseInput.filters, assessmentType: "BOT" } });
    expect(report.cards[0].subjects[0].average).toBe(80);
    expect(report.cards[0].subjects[0].total).toBe(80);
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
