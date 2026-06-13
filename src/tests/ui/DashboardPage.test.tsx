import { render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { DashboardPage } from "../../pages/DashboardPage";

// ── Mocks ──────────────────────────────────────────────────────────────────────

vi.mock("../../client/dashboardClient", () => ({
  fetchDashboardStats: vi.fn(),
}));

vi.mock("../../client/studentsClient", () => ({
  fetchStudentContactSummary: vi.fn(),
}));

vi.mock("../../components/layout/SettingsContext", () => ({
  useAppSettings: () => ({
    settings: { sections: { school: { schoolName: "Test School" } } },
  }),
}));

import { fetchDashboardStats } from "../../client/dashboardClient";
import { fetchStudentContactSummary } from "../../client/studentsClient";
import type { DashboardStats } from "../../shared/types/dashboard";

const mockFetchStats = vi.mocked(fetchDashboardStats);
const mockFetchContacts = vi.mocked(fetchStudentContactSummary);

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

const contactsPayload = {
  guardians: 290,
  emailContacts: 180,
  phoneContacts: 260,
  reportRecipients: 270,
};

function renderPage() {
  return render(
    <MemoryRouter>
      <DashboardPage />
    </MemoryRouter>,
  );
}

// ── Live data fetching ─────────────────────────────────────────────────────────

describe("DashboardPage — live data", () => {
  it("fetches dashboard stats from API on mount", async () => {
    mockFetchStats.mockResolvedValueOnce(statsPayload);
    mockFetchContacts.mockResolvedValueOnce(contactsPayload);

    renderPage();

    await waitFor(() => expect(mockFetchStats).toHaveBeenCalledTimes(1));
    expect(mockFetchStats).toHaveBeenCalledWith(); // no args = uses default schoolCode
  });

  it("KPI cards show live API numbers, not hardcoded values", async () => {
    mockFetchStats.mockResolvedValueOnce(statsPayload);
    mockFetchContacts.mockResolvedValueOnce(contactsPayload);

    renderPage();

    // enrolled students
    await waitFor(() => expect(screen.getByText("342")).toBeInTheDocument());
    // marks pending review
    expect(screen.getByText("7")).toBeInTheDocument();
    // reports issued
    expect(screen.getByText("15")).toBeInTheDocument();
    // reports released
    expect(screen.getByText("9")).toBeInTheDocument();
  });

  it("workflow pipeline shows live counts", async () => {
    mockFetchStats.mockResolvedValueOnce(statsPayload);
    mockFetchContacts.mockResolvedValueOnce(contactsPayload);

    renderPage();

    await waitFor(() => expect(screen.getByText("Marks Uploaded")).toBeInTheDocument());
    // Each stage value is present
    expect(screen.getByText("12")).toBeInTheDocument(); // marksUploaded
    expect(screen.getByText("5")).toBeInTheDocument();  // reviewed
    // generated/approved = 15 (appears once in KPI, once in workflow)
    expect(screen.getAllByText("15").length).toBeGreaterThanOrEqual(1);
  });

  it("recent batches table shows real upload data", async () => {
    mockFetchStats.mockResolvedValueOnce(statsPayload);
    mockFetchContacts.mockResolvedValueOnce(contactsPayload);

    renderPage();

    await waitFor(() => expect(screen.getByText("32")).toBeInTheDocument());
    expect(screen.getByText(/aabbccdd/i)).toBeInTheDocument(); // truncated batch id
  });

  it("hero text shows live term name, not static string", async () => {
    mockFetchStats.mockResolvedValueOnce(statsPayload);
    mockFetchContacts.mockResolvedValueOnce(contactsPayload);

    renderPage();

    await waitFor(() =>
      expect(screen.getByText("Term 2, 2025/2026")).toBeInTheDocument(),
    );
  });
});

// ── Error and loading states ───────────────────────────────────────────────────

describe("DashboardPage — state handling", () => {
  it("shows loading dashes before stats arrive", () => {
    mockFetchStats.mockImplementation(() => new Promise(() => {})); // never resolves
    mockFetchContacts.mockResolvedValueOnce(contactsPayload);

    renderPage();

    // KPI values show — while loading
    expect(screen.getAllByText("—").length).toBeGreaterThan(0);
  });

  it("shows error message in hero when API fails", async () => {
    mockFetchStats.mockRejectedValueOnce(new Error("Network error"));
    mockFetchContacts.mockResolvedValueOnce(contactsPayload);

    renderPage();

    await waitFor(() =>
      expect(screen.getByText(/could not load live stats/i)).toBeInTheDocument(),
    );
  });

  it("shows empty state in uploads table when no batches", async () => {
    mockFetchStats.mockResolvedValueOnce({ ...statsPayload, recentBatches: [] });
    mockFetchContacts.mockResolvedValueOnce(contactsPayload);

    renderPage();

    await waitFor(() => expect(screen.getByText(/no uploads yet/i)).toBeInTheDocument());
    expect(screen.getByRole("link", { name: /import marks now/i })).toBeInTheDocument();
  });
});

// ── Button and link wiring ─────────────────────────────────────────────────────

describe("DashboardPage — all buttons and links wired", () => {
  it("Generate Reports hero button links to /reports", async () => {
    mockFetchStats.mockResolvedValueOnce(statsPayload);
    mockFetchContacts.mockResolvedValueOnce(contactsPayload);

    renderPage();

    const links = screen.getAllByRole("link", { name: /generate reports/i });
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) {
      expect(link).toHaveAttribute("href", "/reports");
    }
  });

  it("Import Marks hero button links to /imports/marks", async () => {
    mockFetchStats.mockResolvedValueOnce(statsPayload);
    mockFetchContacts.mockResolvedValueOnce(contactsPayload);

    renderPage();

    const link = screen.getByRole("link", { name: /import marks/i });
    expect(link).toHaveAttribute("href", "/imports/marks");
  });

  it("Continue reports link points to /reports", async () => {
    mockFetchStats.mockResolvedValueOnce(statsPayload);
    mockFetchContacts.mockResolvedValueOnce(contactsPayload);

    renderPage();

    await waitFor(() => expect(screen.getByText(/continue reports/i)).toBeInTheDocument());
    expect(screen.getByRole("link", { name: /continue reports/i })).toHaveAttribute(
      "href",
      "/reports",
    );
  });

  it("View all uploads link points to /imports/marks", async () => {
    mockFetchStats.mockResolvedValueOnce(statsPayload);
    mockFetchContacts.mockResolvedValueOnce(contactsPayload);

    renderPage();

    await waitFor(() => expect(screen.getByText(/view all uploads/i)).toBeInTheDocument());
    expect(screen.getByRole("link", { name: /view all uploads/i })).toHaveAttribute(
      "href",
      "/imports/marks",
    );
  });

  it("Manage Students link points to /students", async () => {
    mockFetchStats.mockResolvedValueOnce(statsPayload);
    mockFetchContacts.mockResolvedValueOnce(contactsPayload);

    renderPage();

    await waitFor(() =>
      expect(screen.getByRole("link", { name: /manage students/i })).toHaveAttribute(
        "href",
        "/students",
      ),
    );
  });

  it("Enrolled Students KPI card links to /students", async () => {
    mockFetchStats.mockResolvedValueOnce(statsPayload);
    mockFetchContacts.mockResolvedValueOnce(contactsPayload);

    renderPage();

    await waitFor(() => expect(screen.getByText("342")).toBeInTheDocument());
    // StatCard renders as <a href="...">, find it
    const card = screen.getByText("342").closest("a");
    expect(card).toHaveAttribute("href", "/students");
  });

  it("No link or button has href='#'", async () => {
    mockFetchStats.mockResolvedValueOnce(statsPayload);
    mockFetchContacts.mockResolvedValueOnce(contactsPayload);

    renderPage();

    await waitFor(() => expect(screen.getByText("342")).toBeInTheDocument());
    const deadLinks = document.querySelectorAll('a[href="#"]');
    expect(deadLinks.length).toBe(0);
  });

  it("Review batch button links to /imports/marks", async () => {
    mockFetchStats.mockResolvedValueOnce(statsPayload);
    mockFetchContacts.mockResolvedValueOnce(contactsPayload);

    renderPage();

    await waitFor(() =>
      expect(screen.getByRole("link", { name: /review/i })).toHaveAttribute(
        "href",
        "/imports/marks",
      ),
    );
  });
});

// ── Tab navigation ─────────────────────────────────────────────────────────────

describe("DashboardPage — tab navigation", () => {
  it("Marks Review tab is rendered", async () => {
    mockFetchStats.mockResolvedValueOnce(statsPayload);
    mockFetchContacts.mockResolvedValueOnce(contactsPayload);

    renderPage();

    expect(screen.getByRole("button", { name: /marks review/i })).toBeInTheDocument();
  });

  it("Report Approval tab is rendered", async () => {
    mockFetchStats.mockResolvedValueOnce(statsPayload);
    mockFetchContacts.mockResolvedValueOnce(contactsPayload);

    renderPage();

    expect(screen.getByRole("button", { name: /report approval/i })).toBeInTheDocument();
  });

  it("Release Center tab is rendered", async () => {
    mockFetchStats.mockResolvedValueOnce(statsPayload);
    mockFetchContacts.mockResolvedValueOnce(contactsPayload);

    renderPage();

    expect(screen.getByRole("button", { name: /release center/i })).toBeInTheDocument();
  });
});

// ── No static preview values ───────────────────────────────────────────────────

describe("DashboardPage — no hardcoded preview values", () => {
  it("does not show the hardcoded 1,248 enrolled value", async () => {
    mockFetchStats.mockResolvedValueOnce(statsPayload);
    mockFetchContacts.mockResolvedValueOnce(contactsPayload);

    renderPage();

    await waitFor(() => expect(screen.getByText("342")).toBeInTheDocument());
    expect(screen.queryByText("1,248")).not.toBeInTheDocument();
  });

  it("does not mention 'preview values' anywhere", async () => {
    mockFetchStats.mockResolvedValueOnce(statsPayload);
    mockFetchContacts.mockResolvedValueOnce(contactsPayload);

    renderPage();

    await waitFor(() => expect(screen.getByText("342")).toBeInTheDocument());
    expect(screen.queryByText(/preview values/i)).not.toBeInTheDocument();
  });

  it("does not show hardcoded 24 generated value when real value differs", async () => {
    mockFetchStats.mockResolvedValueOnce({ ...statsPayload, workflow: { ...statsPayload.workflow, generated: 99 } });
    mockFetchContacts.mockResolvedValueOnce(contactsPayload);

    renderPage();

    await waitFor(() => expect(screen.getByText("99")).toBeInTheDocument());
    expect(screen.queryByText("24")).not.toBeInTheDocument();
  });
});
