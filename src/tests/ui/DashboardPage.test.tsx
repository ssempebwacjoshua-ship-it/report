import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DashboardPage } from "../../pages/DashboardPage";
import { fetchDashboardStats } from "../../client/dashboardClient";
import type { DashboardStats } from "../../shared/types/dashboard";

vi.mock("../../client/dashboardClient", () => ({
  fetchDashboardStats: vi.fn(),
}));

vi.mock("../../components/layout/SettingsContext", () => ({
  useAppSettings: () => ({
    settings: { sections: { school: { schoolName: "Test School" } } },
  }),
}));

const mockFetchStats = vi.mocked(fetchDashboardStats);

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
  recentBatches: [
    {
      id: "batch-aabbccdd-1234-5678-90ab-cdef01234567",
      uploadedAt: new Date("2026-06-10T09:00:00Z").toISOString(),
      rowCount: 32,
      status: "COMMITTED",
    },
  ],
  recentActivity: [
    {
      action: "marks.committed",
      label: "Marks imported: 32 rows",
      occurredAt: new Date("2026-06-10T09:00:00Z").toISOString(),
    },
  ],
};

function renderPage() {
  return render(
    <MemoryRouter>
      <DashboardPage />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  mockFetchStats.mockReset();
});

describe("DashboardPage", () => {
  it("fetches dashboard stats on mount", async () => {
    mockFetchStats.mockResolvedValueOnce(statsPayload);

    renderPage();

    await waitFor(() => expect(mockFetchStats).toHaveBeenCalledTimes(1));
    expect(mockFetchStats).toHaveBeenCalledWith();
  });

  it("renders live hero, KPI cards, and workflow counts", async () => {
    mockFetchStats.mockResolvedValueOnce(statsPayload);

    renderPage();

    await waitFor(() => expect(screen.getByText("342")).toBeInTheDocument());
    expect(screen.getByText("7")).toBeInTheDocument();
    expect(screen.getAllByText("15").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("9").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Marks Uploaded")).toBeInTheDocument();
    expect(screen.getByText("Reviewed")).toBeInTheDocument();
    expect(screen.getByText("Generated")).toBeInTheDocument();
    expect(screen.getByText("Approved")).toBeInTheDocument();
    expect(screen.getByText("Released")).toBeInTheDocument();
    expect(screen.getByText("Term 2, 2025/2026")).toBeInTheDocument();
  });

  it("shows loading state in the hero", () => {
    mockFetchStats.mockImplementationOnce(() => new Promise(() => {}));

    renderPage();

    expect(screen.getAllByText("-").length).toBeGreaterThan(0);
  });

  it("shows error state in the hero", async () => {
    mockFetchStats.mockReset();
    mockFetchStats.mockRejectedValueOnce(new Error("Network error"));

    renderPage();

    await waitFor(() =>
      expect(screen.getByText(/could not load live stats/i)).toBeInTheDocument(),
    );
  });

  it("wires the main actions and tabs", async () => {
    mockFetchStats.mockResolvedValueOnce(statsPayload);

    renderPage();

    await waitFor(() => expect(screen.getByText("342")).toBeInTheDocument());

    expect(screen.getByRole("link", { name: /generate reports/i })).toHaveAttribute(
      "href",
      "/reports",
    );
    expect(screen.getByRole("link", { name: /import marks/i })).toHaveAttribute(
      "href",
      "/imports/marks",
    );
    expect(screen.getByRole("link", { name: /continue reports/i })).toHaveAttribute(
      "href",
      "/reports",
    );
    expect(screen.getByRole("button", { name: /marks review/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /report approval/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /release center/i })).toBeInTheDocument();
  });

  it("does not render the removed lower dashboard sections", async () => {
    mockFetchStats.mockResolvedValueOnce(statsPayload);

    renderPage();

    await waitFor(() => expect(screen.getByText("342")).toBeInTheDocument());

    expect(screen.queryByText(/recent marks uploads/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/reports overview/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/quick actions/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/student contacts for reports/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/recent activity/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/today's focus/i)).not.toBeInTheDocument();
  });
});
