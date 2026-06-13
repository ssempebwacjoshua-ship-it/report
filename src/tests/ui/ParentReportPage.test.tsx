import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { ParentReportPage } from "../../pages/ParentReportPage";

vi.mock("../../components/reports/StudentReportDetail", () => ({
  StudentReportDetail: () => <div data-testid="report-detail">Report detail</div>,
}));

const fetchMock = vi.fn();

vi.stubGlobal("fetch", fetchMock);

const issuedPayload = {
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
};

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/parent/r/raw-token"]}>
      <Routes>
        <Route path="/parent/r/:token" element={<ParentReportPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("ParentReportPage — public action card", () => {
  it("shows Print Report and Download PDF buttons", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => issuedPayload });

    renderPage();

    await waitFor(() => expect(screen.getByRole("button", { name: /print report/i })).toBeInTheDocument());
    expect(screen.getByRole("button", { name: /download pdf/i })).toBeInTheDocument();
  });

  it("shows student name and reference code on screen", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => issuedPayload });

    renderPage();

    await waitFor(() => expect(screen.getByText("Ada Lovelace")).toBeInTheDocument());
    expect(screen.getByText("20260612-ABC123")).toBeInTheDocument();
  });

  it("report detail is inside a print-only container, not directly visible on screen", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => issuedPayload });

    renderPage();

    await waitFor(() => expect(screen.getByTestId("report-detail")).toBeInTheDocument());

    const reportDetail = screen.getByTestId("report-detail");
    const printContainer = reportDetail.closest(".print-only");
    expect(printContainer).toBeInTheDocument();
  });

  it("print container is in the DOM for window.print() to use", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => issuedPayload });

    renderPage();

    // The print-only container must exist so window.print() can render it
    await waitFor(() => expect(document.querySelector(".print-only")).toBeInTheDocument());
    // The report detail must be inside the print-only container
    const printContainer = document.querySelector(".print-only");
    expect(printContainer?.querySelector("[data-testid='report-detail']")).toBeInTheDocument();
  });

  it("does not render admin shell chrome", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => issuedPayload });

    renderPage();

    await waitFor(() => expect(screen.getByText("Ada Lovelace")).toBeInTheDocument());
    expect(document.querySelector(".app-shell-sidebar")).not.toBeInTheDocument();
  });

  it("shows a Valid badge for issued reports", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => issuedPayload });

    renderPage();

    await waitFor(() => expect(screen.getByText("Valid")).toBeInTheDocument());
  });

  it("shows a Revoked badge and warning for revoked reports", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ...issuedPayload, status: "REVOKED" }),
    });

    renderPage();

    await waitFor(() => expect(screen.getAllByText("Revoked").length).toBeGreaterThan(0));
    expect(screen.getByText(/revoked by the school/i)).toBeInTheDocument();
  });

  it("shows an error card when the API returns 404", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 404,
      text: async () => JSON.stringify({ message: "Not found" }),
    });

    renderPage();

    await waitFor(() => expect(screen.getByText("Report not available")).toBeInTheDocument());
    expect(screen.getByText("Not found")).toBeInTheDocument();
  });
});

describe("ParentReportPage — one-report-only enforcement", () => {
  it("renders exactly one report page — no multi-student list", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => issuedPayload });

    renderPage();

    await waitFor(() => expect(screen.getByTestId("report-detail")).toBeInTheDocument());

    // Exactly one report detail rendered
    expect(screen.getAllByTestId("report-detail")).toHaveLength(1);
  });

  it("Print Report button calls window.print exactly once", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => issuedPayload });
    fetchMock.mockResolvedValueOnce({ ok: true }); // /downloaded POST triggered by handlePrint
    const printSpy = vi.spyOn(window, "print").mockImplementation(() => {});

    renderPage();

    await waitFor(() => expect(screen.getByRole("button", { name: /print report/i })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /print report/i }));

    expect(printSpy).toHaveBeenCalledTimes(1);
    printSpy.mockRestore();
  });

  it("Download PDF button calls window.print exactly once", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => issuedPayload });
    fetchMock.mockResolvedValueOnce({ ok: true }); // /downloaded POST triggered by handlePrint
    const printSpy = vi.spyOn(window, "print").mockImplementation(() => {});

    renderPage();

    await waitFor(() => expect(screen.getByRole("button", { name: /download pdf/i })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /download pdf/i }));

    expect(printSpy).toHaveBeenCalledTimes(1);
    printSpy.mockRestore();
  });

  it("has no student selection UI (no combobox or student selector)", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => issuedPayload });

    renderPage();

    await waitFor(() => expect(screen.getByText("Ada Lovelace")).toBeInTheDocument());

    // No dropdowns or selection controls
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(screen.queryByText(/select student/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/choose student/i)).not.toBeInTheDocument();
  });

  it("has no bulk report list — only one student's data shown", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => issuedPayload });

    renderPage();

    await waitFor(() => expect(screen.getByTestId("report-detail")).toBeInTheDocument());

    // No list of students or multiple reports
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
    expect(screen.queryByText(/all students/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/select all/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/print all/i)).not.toBeInTheDocument();
    // Only one report detail exists
    expect(document.querySelectorAll("[data-testid='report-detail']")).toHaveLength(1);
  });
});
