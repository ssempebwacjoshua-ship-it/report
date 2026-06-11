import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { StudentReportCard } from "../../components/reports/StudentReportCard";
import type { StudentReportCard as Card } from "../../shared/types/reports";

const card: Card = {
  studentId: "s1",
  admissionNumber: "S1A-001",
  studentName: "Kampala Ssempebwa",
  className: "Senior 1 A",
  streamName: "A",
  academicYear: "2025/2026",
  term: "Term 1",
  marksFound: 30,
  totalSubjects: 15,
  average: 81,
  grade: "D1",
  overallPosition: 1,
  readiness: "READY",
  missingMarks: [],
  comments: "",
  contactReadiness: "READY",
  contactSummary: "Agnes Namusoke (Mother) - +256700100001",
  subjects: [],
};

describe("StudentReportCard", () => {
  it("renders compact student row without contact details", () => {
    render(<StudentReportCard card={card} selected={false} showPositions={false} onOpen={vi.fn()} />);
    expect(screen.getByText("Kampala Ssempebwa")).toBeInTheDocument();
    expect(screen.getByText("S1A-001")).toBeInTheDocument();
    expect(screen.getByText("D1")).toBeInTheDocument();
    expect(screen.getByText("Avg 81")).toBeInTheDocument();
    expect(screen.queryByText("Parent contact ready")).not.toBeInTheDocument();
    expect(screen.queryByText("Agnes Namusoke (Mother) - +256700100001")).not.toBeInTheDocument();
    expect(screen.queryByText("#1 Kampala Ssempebwa")).not.toBeInTheDocument();
  });

  it("shows position in the row only when enabled", () => {
    render(<StudentReportCard card={card} selected={false} showPositions onOpen={vi.fn()} />);
    expect(screen.getByText("#1 Kampala Ssempebwa")).toBeInTheDocument();
  });
});
