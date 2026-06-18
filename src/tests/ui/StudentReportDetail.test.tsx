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
  subjects: [
    {
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
    },
  ],
};

describe("StudentReportDetail", () => {
  it("renders official subject rows without contact or subject-position columns", () => {
    const { container } = render(<StudentReportDetail card={card} />);
    const printableReport = container.querySelector(".report-card-sheet");
    const printPage = container.querySelector(".report-print-page");

    expect(screen.getAllByText("Esther Nakayiza").length).toBeGreaterThan(0);
    expect(screen.getByText("English Language")).toBeInTheDocument();
    expect(screen.getAllByText("D2").length).toBeGreaterThan(0);
    expect(screen.queryByText("Pos.")).not.toBeInTheDocument();
    expect(screen.queryByText("Parent contact ready")).not.toBeInTheDocument();
    expect(screen.queryByText("Selected child details")).not.toBeInTheDocument();
    expect(screen.queryByText("Recipient:")).not.toBeInTheDocument();
    expect(screen.queryByText("Overall Position")).not.toBeInTheDocument();
    expect(printableReport?.textContent).not.toContain("Parent contact ready");
    expect(printableReport?.textContent).not.toContain("Florence Nakayiza");
    expect(printPage).toBeInTheDocument();
  });

  it("shows only the overall position summary when enabled", () => {
    render(<StudentReportDetail card={card} editOpen showPositions />);

    expect(screen.getAllByText("Overall Position").length).toBeGreaterThan(0);
    expect(screen.queryByText("Pos.")).not.toBeInTheDocument();
  });
});

