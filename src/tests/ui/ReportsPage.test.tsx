import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ReportsPage } from "../../pages/ReportsPage";
import type { ReportContext, ReportsResponse } from "../../shared/types/reports";

// Silence matchMedia — unavailable in JSDOM
beforeEach(() => {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
});

const CONTEXT: ReportContext = {
  academicYears: [{ id: "year-2", name: "2024/2025", isActive: true }],
  terms: [{ id: "term-2", name: "Term 2", isActive: true }],
  classes: [{ id: "class-2", name: "Senior 2", code: "S2" }],
  streams: [],
};

const EMPTY_COUNTS = {
  total: 0, withReports: 0, noReports: 0,
  readyToIssue: 0, blockedContact: 0, issued: 0, notIssued: 0,
};

const EMPTY_REPORT: ReportsResponse = {
  cards: [],
  emptyReason: "NO_STUDENTS",
  filters: { classId: "class-1", assessmentType: "BOT", streamId: "", schoolCode: "SCU-PREVIEW" },
  readinessCounts: EMPTY_COUNTS,
  issuedStudentIds: [],
  settings: {
    school: { schoolName: "Test School" } as never,
    reports: { showOverallPosition: false } as never,
    grading: [] as never,
  },
};

const STUDENT_CARD_READY = {
  studentId: "stu-1",
  admissionNumber: "ADM-001",
  studentName: "Alice Namusoke",
  className: "Senior 2",
  streamName: "A",
  academicYear: "2026",
  term: "Term 2",
  marksFound: 2,
  totalSubjects: 2,
  average: 78,
  grade: "D1",
  overallPosition: null,
  readiness: "READY" as const,
  missingMarks: [],
  comments: "",
  contactReadiness: "READY" as const,
  contactSummary: "Parent - 0700000001",
  subjects: [],
  progressionText: null,
};

const STUDENT_CARD_NO_CONTACT = {
  ...STUDENT_CARD_READY,
  studentId: "stu-2",
  admissionNumber: "ADM-002",
  studentName: "Bob Mugisha",
  contactReadiness: "NO_RECIPIENT" as const,
  contactSummary: "No guardian contacts",
};

const STUDENT_CARD_NO_MARKS = {
  ...STUDENT_CARD_READY,
  studentId: "stu-3",
  admissionNumber: "ADM-003",
  studentName: "Carol Williams",
  marksFound: 0,
  readiness: "MISSING_MARKS" as const,
};

function makeReport(cards: typeof STUDENT_CARD_READY[]): ReportsResponse {
  const total = cards.length;
  const withReports = cards.filter((c) => c.marksFound > 0).length;
  const noReports = total - withReports;
  const readyToIssue = cards.filter((c) => c.marksFound > 0 && c.contactReadiness === "READY").length;
  const blockedContact = cards.filter((c) => c.marksFound > 0 && c.contactReadiness !== "READY").length;
  return {
    ...EMPTY_REPORT,
    cards,
    emptyReason: null,
    readinessCounts: { total, withReports, noReports, readyToIssue, blockedContact, issued: 0, notIssued: withReports },
  };
}

vi.mock("../../client/reportsClient", () => ({
  fetchReportContext: vi.fn(async () => CONTEXT),
  fetchReports: vi.fn(async () => EMPTY_REPORT),
}));

vi.mock("../../client/settingsClient", () => ({
  fetchSettings: vi.fn(async () => ({
    sections: {
      academic: {
        activeAcademicYear: "2024/2025",
        activeTerm: "Term 2",
        defaultAssessmentType: "TERM_SUMMARY",
      },
    },
  })),
}));

vi.mock("../../client/issueReportClient", () => ({
  issueReport: vi.fn(),
  bulkIssueReports: vi.fn(),
  BulkIssueMissingContactError: class extends Error {
    blockedStudents: unknown[];
    constructor(message: string, blockedStudents: unknown[]) {
      super(message);
      this.name = "BulkIssueMissingContactError";
      this.blockedStudents = blockedStudents;
    }
  },
}));
vi.mock("../../components/layout/branding", () => ({ getSchoolDisplayName: vi.fn(() => "Test School") }));
vi.mock("../../shared/reportReleaseMessage", () => ({ buildParentReportReleaseMessage: vi.fn(() => "") }));

vi.mock("../../components/reports/ReportFilters", () => ({
  ReportFilters: ({ readinessCounts }: { readinessCounts?: { total: number } }) => (
    <div data-testid="report-filters">
      {readinessCounts ? <span data-testid="counts-received">{readinessCounts.total}</span> : null}
    </div>
  ),
}));
vi.mock("../../components/reports/StudentReportCard", () => ({
  StudentReportCard: ({ card, onOpen }: { card: { studentName: string; studentId: string }; onOpen: () => void }) => (
    <button data-testid={`student-card-${card.studentId}`} onClick={onOpen}>{card.studentName}</button>
  ),
}));
vi.mock("../../components/reports/StudentReportDetail", () => ({
  StudentReportDetail: ({ card }: { card: { studentName?: string } | null }) => (
    <div data-testid="report-detail">{card?.studentName ?? "no card"}</div>
  ),
}));
vi.mock("../../components/reports/EmptyReportState", () => ({ EmptyReportState: () => <div data-testid="empty-state" /> }));

function renderAtUrl(url = "/reports") {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <ReportsPage />
    </MemoryRouter>,
  );
}

// Reset fetchReports to EMPTY_REPORT before each test so mockResolvedValueOnce
// queues don't leak between tests
beforeEach(async () => {
  const { fetchReports } = await import("../../client/reportsClient");
  vi.mocked(fetchReports).mockReset();
  vi.mocked(fetchReports).mockResolvedValue(EMPTY_REPORT);
});

describe("ReportsPage — URL params applied as initial filters", () => {
  it("uses classId from URL instead of context default", async () => {
    const { fetchReports } = await import("../../client/reportsClient");

    renderAtUrl("/reports?classId=class-1&termId=term-1&assessmentType=BOT");

    await waitFor(() => {
      const calls = vi.mocked(fetchReports).mock.calls;
      expect(calls.length).toBeGreaterThan(0);
      expect(calls.some(([f]) => f.classId === "class-1")).toBe(true);
    });
  });

  it("uses assessmentType from URL instead of settings default", async () => {
    const { fetchReports } = await import("../../client/reportsClient");

    renderAtUrl("/reports?classId=class-1&termId=term-1&assessmentType=BOT");

    await waitFor(() => {
      const calls = vi.mocked(fetchReports).mock.calls;
      expect(calls.some(([f]) => f.assessmentType === "BOT")).toBe(true);
    });
  });

  it("uses termId from URL instead of active term from context", async () => {
    const { fetchReports } = await import("../../client/reportsClient");

    renderAtUrl("/reports?classId=class-1&termId=term-1&assessmentType=BOT");

    await waitFor(() => {
      const calls = vi.mocked(fetchReports).mock.calls;
      expect(calls.some(([f]) => f.termId === "term-1")).toBe(true);
    });
  });

  it("falls back to context defaults when no URL params given", async () => {
    const { fetchReports } = await import("../../client/reportsClient");

    renderAtUrl("/reports");

    await waitFor(() => {
      const calls = vi.mocked(fetchReports).mock.calls;
      expect(calls.some(([f]) => f.classId === "class-2")).toBe(true);
    });
  });
});

describe("ReportsPage — readiness summary counts", () => {
  it("passes readinessCounts to ReportFilters when report loads", async () => {
    const { fetchReports } = await import("../../client/reportsClient");
    vi.mocked(fetchReports).mockResolvedValue(
      makeReport([STUDENT_CARD_READY, STUDENT_CARD_NO_CONTACT, STUDENT_CARD_NO_MARKS]),
    );

    renderAtUrl("/reports");

    await waitFor(() => expect(screen.getByTestId("counts-received")).toBeInTheDocument());
    expect(screen.getByTestId("counts-received").textContent).toBe("3");
  });

  it("shows counts summary bar aria element when report loads", async () => {
    const { fetchReports } = await import("../../client/reportsClient");
    vi.mocked(fetchReports).mockResolvedValue(makeReport([STUDENT_CARD_READY, STUDENT_CARD_NO_CONTACT]));

    renderAtUrl("/reports");

    await waitFor(() => expect(screen.getByLabelText("Readiness summary")).toBeInTheDocument());
  });
});

describe("ReportsPage — missing contact blocking", () => {
  it("shows missing contact modal when issuing a student without contacts", async () => {
    const { fetchReports } = await import("../../client/reportsClient");
    vi.mocked(fetchReports).mockResolvedValue(makeReport([STUDENT_CARD_NO_CONTACT]));

    renderAtUrl("/reports");

    await waitFor(() => expect(screen.getByTestId("student-card-stu-2")).toBeInTheDocument());
    fireEvent.click(screen.getByTestId("student-card-stu-2"));

    fireEvent.click(screen.getByRole("button", { name: /issue report link/i }));

    await waitFor(() =>
      expect(screen.getByRole("dialog", { name: /missing parent contacts/i })).toBeInTheDocument(),
    );
    expect(screen.getByText(/cannot issue reports/i)).toBeInTheDocument();
  });

  it("does not show modal for student with READY contacts — calls issueReport", async () => {
    const { fetchReports } = await import("../../client/reportsClient");
    const { issueReport } = await import("../../client/issueReportClient");
    vi.mocked(fetchReports).mockResolvedValue(makeReport([STUDENT_CARD_READY]));
    vi.mocked(issueReport).mockResolvedValue({
      id: "ir-1", referenceCode: "20260101-AAA", parentAccessToken: "tok", parentLink: "http://p.test/r/tok",
      studentName: "Alice Namusoke", academicYear: "2026", term: "Term 2", assessmentType: "TERM_SUMMARY", issuedAt: new Date().toISOString(),
    });

    renderAtUrl("/reports");
    await waitFor(() => expect(screen.getByTestId("student-card-stu-1")).toBeInTheDocument());
    fireEvent.click(screen.getByTestId("student-card-stu-1"));
    fireEvent.click(screen.getByRole("button", { name: /issue report link/i }));

    await waitFor(() => expect(vi.mocked(issueReport)).toHaveBeenCalled());
    expect(screen.queryByRole("dialog", { name: /missing parent contacts/i })).toBeNull();
  });

  it("viewing a student with missing contacts does NOT show the blocking modal", async () => {
    const { fetchReports } = await import("../../client/reportsClient");
    vi.mocked(fetchReports).mockResolvedValue(makeReport([STUDENT_CARD_NO_CONTACT]));

    renderAtUrl("/reports");

    await waitFor(() => expect(screen.getByTestId("student-card-stu-2")).toBeInTheDocument());
    fireEvent.click(screen.getByTestId("student-card-stu-2"));

    // Opening the detail does not trigger modal — only issuing does
    expect(screen.queryByRole("dialog", { name: /missing parent contacts/i })).toBeNull();
    expect(screen.getByTestId("report-detail")).toBeInTheDocument();
  });
});

describe("ReportsPage — bulk issue mode", () => {
  it("entering bulk mode shows Bulk Issue panel", async () => {
    const { fetchReports } = await import("../../client/reportsClient");
    vi.mocked(fetchReports).mockResolvedValue(makeReport([STUDENT_CARD_READY]));

    renderAtUrl("/reports");
    await waitFor(() => expect(screen.getByTestId("student-card-stu-1")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /bulk issue/i }));
    expect(screen.getByRole("button", { name: /cancel bulk/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /select all/i })).toBeInTheDocument();
  });

  it("shows student checkboxes in bulk mode", async () => {
    const { fetchReports } = await import("../../client/reportsClient");
    vi.mocked(fetchReports).mockResolvedValue(makeReport([STUDENT_CARD_READY, STUDENT_CARD_NO_CONTACT]));

    renderAtUrl("/reports");
    await waitFor(() => expect(screen.getByTestId("student-card-stu-1")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /bulk issue/i }));
    expect(screen.getByLabelText(/select alice namusoke for bulk issue/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/select bob mugisha for bulk issue/i)).toBeInTheDocument();
  });

  it("bulk issue blocked modal shown when server rejects with missing contacts", async () => {
    const { fetchReports } = await import("../../client/reportsClient");
    const { bulkIssueReports, BulkIssueMissingContactError } = await import("../../client/issueReportClient");

    vi.mocked(fetchReports).mockResolvedValue(
      makeReport([STUDENT_CARD_READY, STUDENT_CARD_NO_CONTACT]),
    );
    vi.mocked(bulkIssueReports).mockRejectedValue(
      new BulkIssueMissingContactError("Missing contacts.", [
        { ...STUDENT_CARD_NO_CONTACT, contactReadiness: "NO_RECIPIENT" },
      ]),
    );

    renderAtUrl("/reports");
    await waitFor(() => expect(screen.getByTestId("student-card-stu-1")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /bulk issue/i }));

    await waitFor(() => expect(screen.getByLabelText(/select alice namusoke for bulk issue/i)).toBeInTheDocument());
    fireEvent.click(screen.getByLabelText(/select alice namusoke for bulk issue/i));
    fireEvent.click(screen.getByLabelText(/select bob mugisha for bulk issue/i));
    fireEvent.click(screen.getByRole("button", { name: /issue 2 reports/i }));

    await waitFor(() =>
      expect(screen.getByRole("dialog", { name: /missing parent contacts/i })).toBeInTheDocument(),
    );
  });
});
