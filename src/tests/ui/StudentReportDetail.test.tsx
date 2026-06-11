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
  subjects: [
    {
      subjectId: "eng",
      subjectName: "English Language",
      botMarks: 74,
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
  it("renders subject rows", () => {
    render(<StudentReportDetail card={card} />);
    expect(screen.getByText("Esther Nakayiza")).toBeInTheDocument();
    expect(screen.getByText("English Language")).toBeInTheDocument();
    expect(screen.getAllByText("D2").length).toBeGreaterThan(0);
  });
});
