import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StudentReportDetail } from "../../components/reports/StudentReportDetail";
import type { StudentReportCard } from "../../shared/types/reports";

const card: StudentReportCard = {
  studentId: "s1",
  admissionNumber: "S1B-001",
  studentName: "Esther Nakayiza",
  className: "Senior 1 B",
  streamName: "B",
  academicYear: "2025/2026",
  term: "Term 1",
  marksFound: 30,
  totalSubjects: 15,
  average: 77,
  grade: "D2",
  overallPosition: 2,
  readiness: "READY",
  missingMarks: [],
  comments: "",
  contactReadiness: "READY",
  contactSummary: "Florence Nakayiza (Mother) - +256700100005",
  progressionText: null,
  subjects: [{
    subjectId: "eng",
    subjectName: "English Language",
    botMarks: 74,
    motMarks: null,
    eotMarks: 80,
    total: 154,
    average: 77,
    grade: "D2",
    subjectPosition: 2,
    missingMarks: [],
    comments: "",
  }],
};

describe("StudentReportDetail", () => {
  it("renders an A4 single-page report template with positions hidden by default", () => {
    const { container } = render(<StudentReportDetail card={card} assessmentType="EOT" />);
    const printPage = container.querySelector(".report-print-page");

    expect(printPage).toHaveAttribute("data-report-page-target", "a4-single");
    expect(printPage).toHaveAttribute("data-report-assessment", "EOT");
    expect(screen.getAllByText("EOT").length).toBeGreaterThan(0);
    expect(screen.queryByText("Overall Position")).not.toBeInTheDocument();
    expect(screen.queryByText("Pos.")).not.toBeInTheDocument();
  });

  it("shows only the overall position summary when enabled", () => {
    render(<StudentReportDetail card={card} editOpen showPositions />);

    expect(screen.getAllByText("Overall Position").length).toBeGreaterThan(0);
    expect(screen.queryByText("Pos.")).not.toBeInTheDocument();
  });

  it("constrains long teacher comments and avoids raw null or undefined text", () => {
    render(
      <StudentReportDetail
        card={card}
        initialComments={{
          classTeacherComment: `Excellent work ${"A".repeat(400)}`,
          headTeacherComment: `Keep going ${"B".repeat(400)}`,
          conductNote: "",
          classTeacherName: "",
          headTeacherName: "",
          issueDate: "2026-06-26",
        }}
      />,
    );

    const report = document.querySelector(".report-card-sheet");
    expect(report?.textContent).not.toContain("undefined");
    expect(report?.textContent).not.toContain("null");
    expect(report?.textContent).toContain("...");
  });

  it("switches to compact table mode when many subject rows are present", () => {
    const manySubjects: StudentReportCard = {
      ...card,
      subjects: Array.from({ length: 18 }, (_, index) => ({
        subjectId: `subject-${index}`,
        subjectName: `Subject ${index + 1}`,
        botMarks: 70,
        motMarks: 72,
        eotMarks: 74,
        total: 216,
        average: 72,
        grade: "C3",
        subjectPosition: null,
        missingMarks: [],
        comments: "",
      })),
    };

    const { container } = render(<StudentReportDetail card={manySubjects} />);
    const printPage = container.querySelector(".report-print-page");
    const table = container.querySelector(".report-table");

    expect(printPage).toHaveAttribute("data-report-layout", "compact");
    expect(table?.className).toContain("report-table-compact");
  });
});
