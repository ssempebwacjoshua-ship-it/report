import { render, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ReportsPage } from "../../pages/ReportsPage";
import type { ReportContext } from "../../shared/types/reports";

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

vi.mock("../../client/reportsClient", () => ({
  fetchReportContext: vi.fn(async () => CONTEXT),
  fetchReports: vi.fn(async () => ({
    cards: [],
    emptyReason: "NO_STUDENTS",
    filters: { classId: "class-1", assessmentType: "BOT", streamId: "", schoolCode: "SCU-PREVIEW" },
    settings: {
      school: { schoolName: "Test School", schoolCode: "SCU-PREVIEW" },
      reports: { showOverallPosition: false },
      grading: [],
    },
  })),
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

vi.mock("../../client/issueReportClient", () => ({ issueReport: vi.fn() }));
vi.mock("../../components/layout/branding", () => ({ getSchoolDisplayName: vi.fn(() => "Test School") }));
vi.mock("../../shared/reportReleaseMessage", () => ({ buildParentReportReleaseMessage: vi.fn(() => "") }));

// Mock heavy sub-components so the test focuses on filter wiring.
vi.mock("../../components/reports/ReportFilters", () => ({ ReportFilters: () => null }));
vi.mock("../../components/reports/StudentReportCard", () => ({ StudentReportCard: () => null }));
vi.mock("../../components/reports/StudentReportDetail", () => ({ StudentReportDetail: () => null }));
vi.mock("../../components/reports/EmptyReportState", () => ({ EmptyReportState: () => null }));

function renderAtUrl(url: string) {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <ReportsPage />
    </MemoryRouter>,
  );
}

describe("ReportsPage — URL params applied as initial filters", () => {
  it("uses classId from URL instead of context default", async () => {
    const { fetchReports } = await import("../../client/reportsClient");
    const mockFetchReports = vi.mocked(fetchReports);
    mockFetchReports.mockClear();

    renderAtUrl("/reports?classId=class-1&termId=term-1&assessmentType=BOT");

    await waitFor(() => {
      const calls = mockFetchReports.mock.calls;
      expect(calls.length).toBeGreaterThan(0);
      // URL classId (class-1) must be used, not the context default (class-2)
      for (const [filters] of calls) {
        expect(filters.classId).toBe("class-1");
        expect(filters.classId).not.toBe("class-2");
      }
    });
  });

  it("uses assessmentType from URL instead of settings default (TERM_SUMMARY)", async () => {
    const { fetchReports } = await import("../../client/reportsClient");
    const mockFetchReports = vi.mocked(fetchReports);
    mockFetchReports.mockClear();

    renderAtUrl("/reports?classId=class-1&termId=term-1&assessmentType=BOT");

    await waitFor(() => {
      const calls = mockFetchReports.mock.calls;
      expect(calls.length).toBeGreaterThan(0);
      for (const [filters] of calls) {
        expect(filters.assessmentType).toBe("BOT");
        expect(filters.assessmentType).not.toBe("TERM_SUMMARY");
      }
    });
  });

  it("uses termId from URL instead of active term from context", async () => {
    const { fetchReports } = await import("../../client/reportsClient");
    const mockFetchReports = vi.mocked(fetchReports);
    mockFetchReports.mockClear();

    renderAtUrl("/reports?classId=class-1&termId=term-1&assessmentType=BOT");

    await waitFor(() => {
      const calls = mockFetchReports.mock.calls;
      expect(calls.length).toBeGreaterThan(0);
      // term-1 from URL, not term-2 which is the active term from context
      const hasUrlTerm = calls.some(([f]) => f.termId === "term-1");
      expect(hasUrlTerm).toBe(true);
    });
  });

  it("falls back to context defaults when no URL params given", async () => {
    const { fetchReports } = await import("../../client/reportsClient");
    const mockFetchReports = vi.mocked(fetchReports);
    mockFetchReports.mockClear();

    // No classId in URL — page should start with empty classId and not fetch until context loads
    renderAtUrl("/reports");

    await waitFor(() => {
      const calls = mockFetchReports.mock.calls;
      // After context loads, classId should come from context (class-2 = first class)
      const hasFetchWithContextClass = calls.some(([f]) => f.classId === "class-2");
      expect(hasFetchWithContextClass).toBe(true);
    });
  });
});
