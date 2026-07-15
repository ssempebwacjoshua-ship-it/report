import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DashboardPage } from "../../pages/DashboardPage";
import {
  fetchDashboardAttendanceSummary,
  fetchDashboardStats,
  streamDashboardAttendanceSummary,
} from "../../client/dashboardClient";
import type {
  DashboardAttendanceSummary,
  DashboardStats,
} from "../../shared/types/dashboard";

vi.mock("../../client/dashboardClient", () => ({
  fetchDashboardStats: vi.fn(),
  fetchDashboardAttendanceSummary: vi.fn(),
  streamDashboardAttendanceSummary: vi.fn(async () => {}),
}));

vi.mock("../../components/layout/SettingsContext", () => ({
  useAppSettings: () => ({
    settings: { sections: { school: { schoolName: "Test School" } } },
  }),
}));

const mockFetchStats = vi.mocked(fetchDashboardStats);
const mockFetchAttendanceSummary = vi.mocked(fetchDashboardAttendanceSummary);
const mockStreamDashboardAttendanceSummary = vi.mocked(streamDashboardAttendanceSummary);

const statsPayload: DashboardStats = {
  schoolName: "Test School",
  activeTerm: { id: "term-1", name: "Term 2", academicYear: "2025/2026" },
  enrolledStudents: 342,
  marksUploadsPendingReview: 7,
  reportsIssuedCount: 15,
  reportsReleasedCount: 9,
  workflow: {
    marksUploaded: 12,
    reviewed: 5,
    generated: 15,
    approved: 15,
    released: 9,
  },
  recentBatches: [],
  recentActivity: [],
};

const attendancePayload: DashboardAttendanceSummary = {
  date: "2026-07-12",
  timezone: "Africa/Kampala",
  totalStudents: 10,
  present: 7,
  absent: 3,
  late: 2,
  attendanceRate: 70,
  onCampus: 5,
  offCampus: 5,
  lastUpdatedAt: "2026-07-12T07:45:00.000Z",
};

function renderPage() {
  return render(
    <MemoryRouter>
      <DashboardPage />
    </MemoryRouter>,
  );
}

function setNavigatorOnline(value: boolean) {
  Object.defineProperty(navigator, "onLine", { configurable: true, value });
}

function setVisibility(value: DocumentVisibilityState) {
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => value });
}

beforeEach(() => {
  mockFetchStats.mockReset();
  mockFetchAttendanceSummary.mockReset();
  mockStreamDashboardAttendanceSummary.mockReset();
  setNavigatorOnline(true);
  setVisibility("visible");
  mockFetchStats.mockResolvedValue(statsPayload);
  mockFetchAttendanceSummary.mockResolvedValue(attendancePayload);
  mockStreamDashboardAttendanceSummary.mockResolvedValue();
});

describe("DashboardPage", () => {
  it("renders today's attendance metrics and dashboard links", async () => {
    renderPage();

    await waitFor(() => expect(screen.getByText("Today's Attendance")).toBeInTheDocument());
    await waitFor(() => expect(screen.getByText("70.0%")).toBeInTheDocument());

    expect(screen.getAllByText("7").length).toBeGreaterThan(0);
    expect(screen.getAllByText("3").length).toBeGreaterThan(0);
    expect(screen.getAllByText("2").length).toBeGreaterThan(0);
    expect(screen.getAllByText("5").length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: /enrolled students/i })).toHaveAttribute("href", "/students");
    expect(screen.getByRole("link", { name: /marks pending review/i })).toHaveAttribute("href", "/imports/marks");
    expect(screen.getByRole("link", { name: /reports issued/i })).toHaveAttribute("href", "/reports?status=issued");
    expect(screen.getByRole("link", { name: /reports released/i })).toHaveAttribute("href", "/reports?status=released");
    expect(screen.getByRole("link", { name: /gate and classroom attendance, including late students/i })).toHaveAttribute(
      "href",
      "/nfc/attendance?view=REGISTER",
    );
    expect(screen.getByRole("link", { name: /no gate or classroom attendance yet/i })).toHaveAttribute(
      "href",
      "/nfc/attendance?view=REGISTER",
    );
    expect(screen.getByRole("link", { name: /late arrivals from the canonical daily register/i })).toHaveAttribute(
      "href",
      "/nfc/attendance?view=REGISTER",
    );
  });

  it("refreshes attendance every 15 seconds without refetching full stats", async () => {
    vi.useFakeTimers();
    renderPage();

    await vi.advanceTimersByTimeAsync(0);
    expect(mockFetchStats).toHaveBeenCalledTimes(1);
    expect(mockFetchAttendanceSummary).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(14_999);
    expect(mockFetchAttendanceSummary).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1);
    expect(mockFetchAttendanceSummary).toHaveBeenCalledTimes(2);
    expect(mockFetchStats).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it("pauses polling while hidden or offline and resumes when visible again", async () => {
    vi.useFakeTimers();
    renderPage();

    await vi.advanceTimersByTimeAsync(0);
    expect(mockFetchAttendanceSummary).toHaveBeenCalledTimes(1);

    setVisibility("hidden");
    document.dispatchEvent(new Event("visibilitychange"));
    await vi.advanceTimersByTimeAsync(15_000);
    expect(mockFetchAttendanceSummary).toHaveBeenCalledTimes(1);

    setNavigatorOnline(false);
    window.dispatchEvent(new Event("offline"));
    await vi.advanceTimersByTimeAsync(15_000);
    expect(mockFetchAttendanceSummary).toHaveBeenCalledTimes(1);

    setNavigatorOnline(true);
    setVisibility("visible");
    window.dispatchEvent(new Event("online"));
    document.dispatchEvent(new Event("visibilitychange"));
    await vi.advanceTimersByTimeAsync(0);
    expect(mockFetchAttendanceSummary.mock.calls.length).toBeGreaterThanOrEqual(2);
    vi.useRealTimers();
  });

  it("aborts the live attendance request on unmount", async () => {
    vi.useFakeTimers();
    let capturedSignal: AbortSignal | undefined;
    mockFetchAttendanceSummary.mockImplementation((signal) => {
      capturedSignal = signal;
      return new Promise(() => {});
    });

    const view = renderPage();

    await vi.advanceTimersByTimeAsync(0);
    expect(mockFetchAttendanceSummary).toHaveBeenCalledTimes(1);
    expect(capturedSignal?.aborted).toBe(false);

    view.unmount();

    expect(capturedSignal?.aborted).toBe(true);
    vi.useRealTimers();
  });

  it("preserves previous attendance values during temporary failures and shows a paused notice", async () => {
    vi.useFakeTimers();
    mockFetchAttendanceSummary
      .mockResolvedValueOnce(attendancePayload)
      .mockRejectedValueOnce(new Error("Temporary outage"))
      .mockRejectedValueOnce(new Error("Temporary outage"))
      .mockResolvedValueOnce({ ...attendancePayload, present: 8, absent: 2, attendanceRate: 80 });

    renderPage();

    await vi.advanceTimersByTimeAsync(0);
    expect(screen.getByText("70.0%")).toBeInTheDocument();

    window.dispatchEvent(new Event("focus"));
    await vi.advanceTimersByTimeAsync(0);
    expect(mockFetchAttendanceSummary).toHaveBeenCalledTimes(2);
    expect(screen.getByText("70.0%")).toBeInTheDocument();

    window.dispatchEvent(new Event("focus"));
    await vi.advanceTimersByTimeAsync(0);
    expect(mockFetchAttendanceSummary).toHaveBeenCalledTimes(3);
    expect(screen.getByText(/attendance update paused/i)).toBeInTheDocument();
    expect(screen.getByText("70.0%")).toBeInTheDocument();

    window.dispatchEvent(new Event("focus"));
    await vi.advanceTimersByTimeAsync(0);
    expect(screen.getByText("80.0%")).toBeInTheDocument();
    expect(screen.queryByText(/attendance update paused/i)).not.toBeInTheDocument();
    vi.useRealTimers();
  });

  it("shows no active students safely", async () => {
    mockFetchAttendanceSummary.mockResolvedValueOnce({
      ...attendancePayload,
      totalStudents: 0,
      present: 0,
      absent: 0,
      late: 0,
      attendanceRate: 0,
      onCampus: 0,
      offCampus: 0,
    });

    renderPage();

    await waitFor(() => expect(screen.getAllByText("0").length).toBeGreaterThan(0));
    expect(screen.getAllByText(/no active students/i).length).toBeGreaterThan(0);
  });
});
