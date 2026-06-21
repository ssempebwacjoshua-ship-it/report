import { describe, expect, it } from "vitest";
import { buildReports, computeReadinessCounts, type EngineInput } from "../../server/services/reportEngine";
import { gradeForAverage } from "../../server/services/gradeService";
import { defaultSettingsSections } from "../../shared/types/settings";
import type { StudentReportCard } from "../../shared/types/reports";

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

describe("progressionText from promotionsByStudentId", () => {
  it("sets progressionText from promotionsByStudentId on matching card", () => {
    const report = buildReports({
      ...baseInput,
      promotionsByStudentId: { s1: "Promoted to Senior 2" },
    });
    expect(report.cards[0].progressionText).toBe("Promoted to Senior 2");
  });

  it("sets progressionText to null for students not in promotionsByStudentId", () => {
    const report = buildReports({
      ...baseInput,
      promotionsByStudentId: { s1: "Promoted to Senior 2" },
    });
    expect(report.cards[1].progressionText).toBeNull();
  });

  it("sets progressionText to null for all cards when promotionsByStudentId is absent", () => {
    const report = buildReports(baseInput);
    expect(report.cards[0].progressionText).toBeNull();
    expect(report.cards[1].progressionText).toBeNull();
  });

  it("sets progressionText to null for all cards when promotionsByStudentId is empty", () => {
    const report = buildReports({ ...baseInput, promotionsByStudentId: {} });
    expect(report.cards[0].progressionText).toBeNull();
    expect(report.cards[1].progressionText).toBeNull();
  });
});

describe("gradeService", () => {
  it("maps averages to grades", () => {
    expect(gradeForAverage(80)).toBe("D1");
    expect(gradeForAverage(52)).toBe("C6");
    expect(gradeForAverage(39)).toBe("F9");
  });
});

// ── Helpers for readiness tests ──────────────────────────────────────────────

function makeCard(overrides: Partial<StudentReportCard>): StudentReportCard {
  return {
    studentId: "s1",
    admissionNumber: "ADM-001",
    studentName: "Test Student",
    className: "S1",
    streamName: "A",
    academicYear: "2026",
    term: "Term 1",
    marksFound: 2,
    totalSubjects: 2,
    average: 75,
    grade: "D1",
    overallPosition: null,
    readiness: "READY",
    missingMarks: [],
    comments: "",
    contactReadiness: "READY",
    contactSummary: "Parent - 0700000001",
    subjects: [],
    progressionText: null,
    ...overrides,
  };
}

describe("computeReadinessCounts", () => {
  it("counts total students correctly", () => {
    const cards = [makeCard({ studentId: "s1" }), makeCard({ studentId: "s2" })];
    const counts = computeReadinessCounts(cards, new Set());
    expect(counts.total).toBe(2);
  });

  it("counts students with reports (marksFound > 0)", () => {
    const cards = [
      makeCard({ studentId: "s1", marksFound: 2 }),
      makeCard({ studentId: "s2", marksFound: 0 }),
    ];
    expect(computeReadinessCounts(cards, new Set()).withReports).toBe(1);
  });

  it("counts students with no reports (marksFound === 0)", () => {
    const cards = [
      makeCard({ studentId: "s1", marksFound: 2 }),
      makeCard({ studentId: "s2", marksFound: 0 }),
    ];
    expect(computeReadinessCounts(cards, new Set()).noReports).toBe(1);
  });

  it("counts ready-to-issue: marksFound > 0 and contactReadiness READY", () => {
    const cards = [
      makeCard({ studentId: "s1", marksFound: 2, contactReadiness: "READY" }),
      makeCard({ studentId: "s2", marksFound: 2, contactReadiness: "NO_RECIPIENT" }),
      makeCard({ studentId: "s3", marksFound: 0, contactReadiness: "READY" }),
    ];
    expect(computeReadinessCounts(cards, new Set()).readyToIssue).toBe(1);
  });

  it("counts blocked: marksFound > 0 and contactReadiness not READY", () => {
    const cards = [
      makeCard({ studentId: "s1", marksFound: 2, contactReadiness: "READY" }),
      makeCard({ studentId: "s2", marksFound: 2, contactReadiness: "NO_RECIPIENT" }),
      makeCard({ studentId: "s3", marksFound: 2, contactReadiness: "MISSING_PHONE_EMAIL" }),
    ];
    expect(computeReadinessCounts(cards, new Set()).blockedContact).toBe(2);
  });

  it("counts issued from the issued set", () => {
    const cards = [makeCard({ studentId: "s1" }), makeCard({ studentId: "s2" })];
    expect(computeReadinessCounts(cards, new Set(["s1"])).issued).toBe(1);
  });

  it("counts notIssued as withReports minus issued", () => {
    const cards = [
      makeCard({ studentId: "s1", marksFound: 2 }),
      makeCard({ studentId: "s2", marksFound: 2 }),
      makeCard({ studentId: "s3", marksFound: 0 }),
    ];
    const counts = computeReadinessCounts(cards, new Set(["s1"]));
    expect(counts.notIssued).toBe(1); // 2 withReports - 1 issued
  });
});

describe("buildReports ? readinessCounts in response", () => {
  it("includes readinessCounts with correct totals", () => {
    const report = buildReports(baseInput);
    expect(report.readinessCounts.total).toBe(2);
  });

  it("returns issuedStudentIds from input", () => {
    const report = buildReports({ ...baseInput, issuedStudentIds: ["s1"] });
    expect(report.issuedStudentIds).toContain("s1");
  });

  it("returns empty readinessCounts for NO_ACTIVE_TERM", () => {
    const report = buildReports({ ...baseInput, hasActiveTerm: false });
    expect(report.readinessCounts.total).toBe(0);
  });
});

describe("buildReports ? readinessFilter", () => {
  const inputWithMarks: EngineInput = {
    ...baseInput,
    students: [
      { id: "s1", admissionNumber: "ADM-001", firstName: "Alice", lastName: "A", className: "S1", streamName: "A", contactReadiness: "READY", contactSummary: "" },
      { id: "s2", admissionNumber: "ADM-002", firstName: "Bob", lastName: "B", className: "S1", streamName: "A", contactReadiness: "NO_RECIPIENT", contactSummary: "" },
      { id: "s3", admissionNumber: "ADM-003", firstName: "Carol", lastName: "C", className: "S1", streamName: "A", contactReadiness: "READY", contactSummary: "" },
    ],
    marks: [
      { studentId: "s1", subjectId: "eng", assessmentType: "BOT", marks: 80 },
      { studentId: "s2", subjectId: "eng", assessmentType: "BOT", marks: 70 },
      // s3 has no marks
    ],
    issuedStudentIds: ["s1"],
  };

  it("ALL filter returns all students", () => {
    const report = buildReports({ ...inputWithMarks, filters: { ...inputWithMarks.filters, readinessFilter: "ALL" } });
    expect(report.cards).toHaveLength(3);
  });

  it("WITH_REPORTS filter returns only students with marks", () => {
    const report = buildReports({ ...inputWithMarks, filters: { ...inputWithMarks.filters, readinessFilter: "WITH_REPORTS" } });
    expect(report.cards.map((c) => c.studentId)).toEqual(expect.arrayContaining(["s1", "s2"]));
    expect(report.cards.map((c) => c.studentId)).not.toContain("s3");
  });

  it("NO_REPORTS filter returns only students with no marks", () => {
    const report = buildReports({ ...inputWithMarks, filters: { ...inputWithMarks.filters, readinessFilter: "NO_REPORTS" } });
    expect(report.cards.map((c) => c.studentId)).toEqual(["s3"]);
  });

  it("READY_TO_ISSUE filter returns students with marks and READY contact", () => {
    const report = buildReports({ ...inputWithMarks, filters: { ...inputWithMarks.filters, readinessFilter: "READY_TO_ISSUE" } });
    expect(report.cards.map((c) => c.studentId)).toEqual(["s1"]);
  });

  it("BLOCKED_CONTACT filter returns students with marks but missing contact", () => {
    const report = buildReports({ ...inputWithMarks, filters: { ...inputWithMarks.filters, readinessFilter: "BLOCKED_CONTACT" } });
    expect(report.cards.map((c) => c.studentId)).toEqual(["s2"]);
  });

  it("ISSUED filter returns only issued students", () => {
    const report = buildReports({ ...inputWithMarks, filters: { ...inputWithMarks.filters, readinessFilter: "ISSUED" } });
    expect(report.cards.map((c) => c.studentId)).toEqual(["s1"]);
  });

  it("NOT_ISSUED filter returns students with marks and not yet issued", () => {
    const report = buildReports({ ...inputWithMarks, filters: { ...inputWithMarks.filters, readinessFilter: "NOT_ISSUED" } });
    expect(report.cards.map((c) => c.studentId)).toEqual(["s2"]);
  });
});

