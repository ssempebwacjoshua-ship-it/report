import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { ParentReportPage } from "../../pages/ParentReportPage";

vi.mock("../../../../components/reports/StudentReportDetail", () => ({
  StudentReportDetail: () => <div data-testid="report-detail">Report detail</div>,
}));

const fetchMock = vi.fn();

vi.stubGlobal("fetch", fetchMock);

const issuedPayload = {
  status: "ISSUED",
  referenceCode: "20260612-ABC123",
  issuedAt: new Date().toISOString(),
  issuedByName: "School Admin",
  school: { name: "School Connect Preview School" },
  snapshot: {
    card: {
      studentId: "",
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
      contactReadiness: "NO_RECIPIENT",
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

function renderShortPage() {
  return render(
    <MemoryRouter initialEntries={["/r/SHORT1234"]}>
      <Routes>
        <Route path="/r/:code" element={<ParentReportPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("ParentReportPage", () => {
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

  it("does not expose internal IDs in the rendered parent report page", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => issuedPayload });

    renderPage();

    await waitFor(() => expect(screen.getByText("Ada Lovelace")).toBeInTheDocument());
    expect(document.body.textContent).not.toContain("issued-1");
    expect(document.body.textContent).not.toContain("studentId");
  });

  it("renders the report preview on screen and keeps a print-only copy", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => issuedPayload });

    renderPage();

    await waitFor(() => expect(screen.getAllByTestId("report-detail")).toHaveLength(2));

    const preview = document.querySelector(".report-parent-preview");
    const printOnly = document.querySelector(".print-only");
    expect(preview?.querySelector("[data-testid='report-detail']")).toBeInTheDocument();
    expect(printOnly?.querySelector("[data-testid='report-detail']")).toBeInTheDocument();
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

  it("loads short-code links from /api/p/short/:code", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => issuedPayload });

    renderShortPage();

    await waitFor(() => expect(screen.getByText("Ada Lovelace")).toBeInTheDocument());
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("/api/p/short/SHORT1234"));
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

  it("renders exactly one preview report and one print report", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => issuedPayload });

    renderPage();

    await waitFor(() => expect(screen.getAllByTestId("report-detail")).toHaveLength(2));
  });

  it("Print Report button calls window.print exactly once", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => issuedPayload });
    fetchMock.mockResolvedValueOnce({ ok: true });
    const printSpy = vi.spyOn(window, "print").mockImplementation(() => {});

    renderPage();

    await waitFor(() => expect(screen.getByRole("button", { name: /print report/i })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /print report/i }));

    expect(printSpy).toHaveBeenCalledTimes(1);
    printSpy.mockRestore();
  });

  it("Download PDF button calls window.print exactly once", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => issuedPayload });
    fetchMock.mockResolvedValueOnce({ ok: true });
    const printSpy = vi.spyOn(window, "print").mockImplementation(() => {});

    renderPage();

    await waitFor(() => expect(screen.getByRole("button", { name: /download pdf/i })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /download pdf/i }));

    expect(printSpy).toHaveBeenCalledTimes(1);
    printSpy.mockRestore();
  });

  it("has no student selection UI", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => issuedPayload });

    renderPage();

    await waitFor(() => expect(screen.getByText("Ada Lovelace")).toBeInTheDocument());

    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(screen.queryByText(/select student/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/choose student/i)).not.toBeInTheDocument();
  });

  it("keeps parent-specific layout hooks for print overrides", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => issuedPayload });

    renderPage();

    await waitFor(() => expect(screen.getAllByTestId("report-detail")).toHaveLength(2));

    expect(document.querySelector(".report-parent-page")).toBeInTheDocument();
    expect(document.querySelector(".report-parent-preview")).toBeInTheDocument();
    expect(document.querySelector(".print-only")).toBeInTheDocument();
  });
});
