import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { OwnerSchoolsPage } from "../../pages/owner/OwnerSchoolsPage";

const ownerClientMocks = vi.hoisted(() => ({
  createOwnerSchool: vi.fn(),
  fetchOwnerSchools: vi.fn(),
  fetchOwnerSchoolConsole: vi.fn(),
  fetchOwnerSchoolSubscription: vi.fn(),
  ownerResetMfa: vi.fn(),
  ownerResetPasswordAdvanced: vi.fn(),
  ownerTerminateUserSessions: vi.fn(),
  ownerUnlockUser: vi.fn(),
  patchOwnerSchool: vi.fn(),
  requestOwnerMaintenance: vi.fn(),
  requestOwnerReaderAction: vi.fn(),
  saveOwnerSchoolSubscription: vi.fn(),
  startOwnerSupportSession: vi.fn(),
  updateOwnerFeatureFlags: vi.fn(),
  updateOwnerSchoolDetails: vi.fn(),
}));

vi.mock("../../client/ownerClient", () => ownerClientMocks);

const subscription = {
  id: "sub-1",
  schoolId: "school-1",
  planCode: "REPORT_LAB_500",
  billingCycle: "YEAR",
  status: "PENDING",
  currentPeriodStart: "2026-01-01T00:00:00.000Z",
  currentPeriodEnd: "2026-12-31T00:00:00.000Z",
  studentLimit: 500,
};

const school = {
  id: "school-1",
  code: "SCH-01",
  name: "St. Marys College",
  phone: null,
  email: null,
  address: null,
  logoUrl: null,
  timezone: "Africa/Kampala",
  brandingMode: "PLATFORM_DEFAULTS",
  isActive: true,
  createdAt: "2026-01-01T00:00:00.000Z",
  subscription,
  primaryAdmin: { id: "admin-1", name: "Admin User", email: "admin@school.ac.ug" },
  studentCount: 430,
};

function consoleData() {
  return {
    school: {
      ...school,
      studentCount: 430,
      userCount: 1,
      reportCount: 0,
      importCount: 0,
    },
    users: [],
    admins: [],
    readers: [],
    featureFlags: [],
    auditLogs: [],
    supportSessions: [],
    sessions: { active: [], note: "No sessions" },
    apiKeys: { readerTokens: [], webhookKeys: [] },
    health: {
      studentCount: 430,
      userCount: 1,
      issuedReportCount: 0,
      importCount: 0,
      storageUsage: null,
      databaseSize: null,
      lastBackup: null,
      ocrUsage: 0,
      gatewayStatus: "OK",
      smartPagesStatus: "OK",
    },
  };
}

function subscriptionResponse(nextSubscription = subscription) {
  return {
    school: { id: school.id, code: school.code, name: school.name },
    subscription: nextSubscription,
    entitlements: {
      planName: "Up to 500 Students",
      studentLimit: 500,
      billingCycle: "YEAR",
      features: ["Report generation", "Marks upload/import"],
      addOns: ["SMS/WhatsApp delivery costs"],
    },
  };
}

function renderPage() {
  return render(
    <MemoryRouter>
      <OwnerSchoolsPage />
    </MemoryRouter>,
  );
}

describe("OwnerSchoolsPage subscription management", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    ownerClientMocks.fetchOwnerSchools.mockResolvedValue({ schools: [school] });
    ownerClientMocks.fetchOwnerSchoolConsole.mockResolvedValue(consoleData());
    ownerClientMocks.fetchOwnerSchoolSubscription.mockResolvedValue(subscriptionResponse());
    ownerClientMocks.saveOwnerSchoolSubscription.mockResolvedValue(subscriptionResponse({ ...subscription, status: "ACTIVE" }));
  });

  it("shows Manage Subscription and opens the owner subscription editor", async () => {
    renderPage();

    await waitFor(() => expect(screen.getByRole("heading", { name: /schools/i, level: 2 })).toBeInTheDocument());
    fireEvent.click(screen.getAllByRole("button", { name: /manage subscription/i })[0]!);

    await waitFor(() => expect(ownerClientMocks.fetchOwnerSchoolConsole).toHaveBeenCalledWith("school-1"));
    await waitFor(() => expect(ownerClientMocks.fetchOwnerSchoolSubscription).toHaveBeenCalledWith("school-1"));
    expect(await screen.findByRole("heading", { name: /manage subscription/i })).toBeInTheDocument();
    expect(screen.getByText(/owner-only controls/i)).toBeInTheDocument();
    expect(screen.getByText(/report generation/i)).toBeInTheDocument();
  });

  it("saves subscription changes through the owner subscription client helper", async () => {
    renderPage();

    await waitFor(() => expect(screen.getByRole("heading", { name: /schools/i, level: 2 })).toBeInTheDocument());
    fireEvent.click(screen.getAllByRole("button", { name: /manage subscription/i })[0]!);
    await screen.findByRole("heading", { name: /manage subscription/i });

    fireEvent.change(screen.getByLabelText(/status/i), { target: { value: "ACTIVE" } });
    fireEvent.change(screen.getByLabelText(/student limit/i), { target: { value: "600" } });
    fireEvent.click(screen.getByRole("button", { name: /save subscription/i }));

    await waitFor(() =>
      expect(ownerClientMocks.saveOwnerSchoolSubscription).toHaveBeenCalledWith(
        "school-1",
        expect.objectContaining({
          planCode: "REPORT_LAB_500",
          billingCycle: "YEAR",
          status: "ACTIVE",
          studentLimit: 600,
        }),
      ),
    );
    expect((await screen.findAllByText(/subscription saved/i)).length).toBeGreaterThan(0);
  });
});
