import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { ParentReportPage } from "../../pages/ParentReportPage";

vi.mock("../../components/reports/StudentReportDetail", () => ({
  StudentReportDetail: () => <div data-testid="report-detail">Report detail</div>,
}));

const fetchMock = vi.fn();

vi.stubGlobal("fetch", fetchMock);

describe("ParentReportPage", () => {
  it("renders the issued snapshot in a print container and hides admin shell chrome", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: "issued-1",
        status: "ISSUED",
        referenceCode: "20260612-ABC123",
        issuedAt: new Date().toISOString(),
        issuedByName: "School Admin",
        school: { name: "School Connect Preview School", code: "SCU-PREVIEW" },
        snapshot: {
          card: {
            studentId: "s1",
            admissionNumber: "ADM-001",
            studentName: "Ada Lovelace",
            className: "S1",
            streamName: "A",
            academicYear: "2025/2026",
            term: "Term 1",
            marksFound: 0,
            totalSubjects: 0,
            average: null,
            grade: null,
            overallPosition: null,
            readiness: "READY",
            missingMarks: [],
            comments: "",
            contactReadiness: "READY",
            contactSummary: "",
            subjects: [],
          },
          settings: {
            school: { schoolName: "School Connect Preview School" },
            reports: {
              showOverallPosition: false,
              showClassAverage: false,
              showGradeKey: false,
              showSchoolLogo: false,
              printDensity: "compact",
              signatureMode: "name_and_signature_line",
              defaultHmCommentTemplate: "",
              defaultClassTeacherCommentTemplate: "",
            },
            grading: { grades: [] },
          },
          filters: { assessmentType: "EOT" },
        },
      }),
    });

    render(
      <MemoryRouter initialEntries={["/parent/r/raw-token"]}>
        <Routes>
          <Route path="/parent/r/:token" element={<ParentReportPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByTestId("report-detail")).toBeInTheDocument());
    expect(document.querySelector(".report-print-page")).toBeInTheDocument();
    expect(document.querySelector(".app-shell-sidebar")).not.toBeInTheDocument();
    expect(document.querySelector(".report-print-page")?.className).toContain("report-print-page");
  });
});
