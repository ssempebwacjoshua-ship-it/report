import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import type { ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { OwnerDashboardPage } from "../../pages/owner/OwnerDashboardPage";
import { OwnerReaderDetailPage, OwnerReaderManagementPage } from "../../pages/owner/OwnerReaderManagementPage";
import { OwnerSchoolsPage } from "../../pages/owner/OwnerSchoolsPage";
import { OwnerUsersPage } from "../../pages/owner/OwnerUsersPage";

const ownerClientMocks = vi.hoisted(() => ({
  fetchOwnerDashboard: vi.fn(),
  fetchOwnerSmartPagesPayments: vi.fn(),
  fetchOwnerSmartPagesUsage: vi.fn(),
  confirmOwnerSmartPagesPayment: vi.fn(),
  rejectOwnerSmartPagesPayment: vi.fn(),
  fetchOwnerSchools: vi.fn(),
  fetchOwnerSchoolSubscription: vi.fn(),
  fetchOwnerReaders: vi.fn(),
  fetchOwnerReader: vi.fn(),
  createOwnerSchool: vi.fn(),
  patchOwnerSchool: vi.fn(),
  fetchOwnerUsers: vi.fn(),
  createOwnerUser: vi.fn(),
  ownerResetPassword: vi.fn(),
  ownerDisableUser: vi.fn(),
  ownerEnableUser: vi.fn(),
  requestOwnerReaderAction: vi.fn(),
  saveOwnerSchoolSubscription: vi.fn(),
}));

vi.mock("../../client/ownerClient", () => ownerClientMocks);

function renderInRouter(element: ReactElement, initialEntries: string[] = ["/owner"], routePath = "*") {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <Routes>
        <Route path={routePath} element={element} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("Owner console responsive layouts", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubGlobal("confirm", vi.fn(() => true));
  });

  it("renders Smart Pages usage and payments as mobile cards while keeping desktop tables", async () => {
    ownerClientMocks.fetchOwnerDashboard.mockResolvedValue({
      totalSchools: 3,
      activeSchools: 2,
      expiredSchools: 1,
      suspendedSchools: 0,
      noSubscriptionSchools: 0,
      totalUsers: 18,
      recentSchools: [{ id: "school-1", code: "SCH-01", name: "St. Marys College Very Long Campus Name", createdAt: new Date().toISOString() }],
    });
    ownerClientMocks.fetchOwnerSmartPagesPayments.mockResolvedValue({
      payments: [
        {
          id: "pay-1",
          schoolId: "school-1",
          schoolName: "St. Marys College Very Long Campus Name That Should Clamp Nicely",
          packageCode: "STANDARD",
          packageName: "Standard",
          credits: 500,
          amountUgx: 225000,
          network: "MTN",
          merchantCode: "98642335",
          merchantName: "MTN MoMo",
          paymentReference: "SMARTPAGES-pay-1",
          transactionId: "TX-1234567890",
          payerPhone: "256700000000",
          status: "PENDING",
          createdAt: new Date().toISOString(),
        },
      ],
    });
    ownerClientMocks.fetchOwnerSmartPagesUsage.mockResolvedValue({
      ledger: [
        {
          id: "ledger-1",
          schoolId: "school-1",
          schoolName: "St. Marys College Very Long Campus Name That Should Clamp Nicely",
          operation: "EXTRACT",
          pagesProcessed: 4,
          creditsUsed: 4,
          priceUgx: 2000,
          status: "CHARGED",
          createdAt: new Date().toISOString(),
          provider: "gemini",
          model: "gemini-3.5-flash",
          tokenUsage: { totalTokenCount: 1200 },
          geminiCostEstimateUgx: 280,
          marginEstimateUgx: 1720,
        },
      ],
    });

    renderInRouter(<OwnerDashboardPage />);

    await waitFor(() => expect(screen.getByRole("heading", { name: /pending mobile money confirmations/i })).toBeInTheDocument());
    expect(screen.getAllByText(/^Extract$/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/^Top-up$/).length).toBeGreaterThan(0);
    expect(screen.getByText(/view technical details/i)).toBeInTheDocument();
    expect(screen.getAllByRole("table")).toHaveLength(2);
    expect(screen.getAllByText(/st\. marys college very long campus name that should clamp nicely/i)[0]?.closest("article")?.className).toContain("rounded-2xl");
  });

  it("renders owner schools as cards on mobile and a table on desktop", async () => {
    ownerClientMocks.fetchOwnerSchools.mockResolvedValue({
      schools: [
        {
          id: "school-1",
          code: "SCH-01",
          name: "St. Marys College of Excellence with an Extremely Long Campus Name for Testing",
          phone: null,
          address: null,
          isActive: true,
          createdAt: new Date().toISOString(),
          subscription: { planCode: "STARTER", status: "ACTIVE", currentPeriodEnd: new Date().toISOString(), studentLimit: 100 },
          primaryAdmin: { id: "admin-1", name: "Admin User", email: "admin@school.ac.ug" },
          studentCount: 430,
        },
      ],
    });

    renderInRouter(<OwnerSchoolsPage />);

    await waitFor(() => expect(screen.getByRole("heading", { name: /schools/i, level: 2 })).toBeInTheDocument());
    expect(screen.getAllByText(/st\. marys college of excellence/i)[0]?.className).toContain("line-clamp-2");
    expect(screen.getByText(/manage all onboarded schools/i)).toBeInTheDocument();
    expect(screen.queryByText(/loading schools/i)).not.toBeInTheDocument();
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.getByText(/create school/i)).toBeInTheDocument();
  });

  it("submits selected default stream codes and shows platform default onboarding details", async () => {
    ownerClientMocks.fetchOwnerSchools.mockResolvedValue({ schools: [] });
    ownerClientMocks.createOwnerSchool.mockResolvedValue({
      ok: true,
      school: { id: "school-1", code: "SCH-01", name: "St. Marys College", phone: null, address: null, isActive: true },
      subscription: { id: "sub-1", planCode: "REPORT_LAB_500", status: "TRIAL", currentPeriodEnd: new Date().toISOString(), studentLimit: 500 },
      invoice: { id: "inv-1", setupFeeUgx: 500000, amountUgx: 300000, totalUgx: 800000, status: "UNPAID" },
      admin: { id: "admin-1", email: "admin@school.ac.ug", name: "Admin User", mustChangePassword: true },
      academicYear: { id: "year-1", name: "2026/2027" },
      activeTerm: { id: "term-1", name: "Term 1" },
      settings: {
        schoolSections: ["PRIMARY", "SECONDARY"],
        defaultStreamCodes: ["A", "C"],
        brandingMode: "PLATFORM_DEFAULTS",
        reportFooterText: "This report was generated by School Connect Reports First.",
        marksheetFooterText: "",
        logoUrl: "",
      },
      classesSeeded: 13,
      streamsSeeded: 26,
    });

    renderInRouter(<OwnerSchoolsPage />);

    await waitFor(() => expect(screen.getByRole("heading", { name: /schools/i, level: 2 })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /\+ create school/i }));

    fireEvent.change(screen.getByPlaceholderText(/st\. julian primary school/i), { target: { value: "New School" } });
    fireEvent.change(screen.getByPlaceholderText("STJULIAN"), { target: { value: "NEW-SCHOOL" } });
    fireEvent.click(screen.getByLabelText("SECONDARY"));
    fireEvent.click(screen.getByLabelText("C"));
    fireEvent.change(screen.getByPlaceholderText("John Doe"), { target: { value: "Owner Admin" } });
    fireEvent.change(screen.getByPlaceholderText(/admin@stjulian\.ac\.ug/i), { target: { value: "admin@school.ac.ug" } });
    fireEvent.change(screen.getByPlaceholderText(/Min 10 characters/i), { target: { value: "TempPassword123" } });

    fireEvent.click(screen.getAllByRole("button", { name: /create school/i })[1]!);

    await waitFor(() =>
      expect(ownerClientMocks.createOwnerSchool).toHaveBeenCalledWith(
        expect.objectContaining({
          defaultStreamCodes: ["A", "C"],
          sections: ["PRIMARY", "SECONDARY"],
        }),
      ),
    );
    await waitFor(() => expect(screen.getByText(/platform defaults applied/i)).toBeInTheDocument());
    expect(screen.getByText(/^A, C$/)).toBeInTheDocument();
  });

  it("keeps create school disabled until the admin temporary password reaches 10 characters", async () => {
    ownerClientMocks.fetchOwnerSchools.mockResolvedValue({ schools: [] });

    renderInRouter(<OwnerSchoolsPage />);

    await waitFor(() => expect(screen.getByRole("heading", { name: /schools/i, level: 2 })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /\+ create school/i }));

    fireEvent.change(screen.getByPlaceholderText(/st\. julian primary school/i), { target: { value: "New School" } });
    fireEvent.change(screen.getByPlaceholderText("STJULIAN"), { target: { value: "NEW-SCHOOL" } });
    fireEvent.change(screen.getByPlaceholderText("John Doe"), { target: { value: "Owner Admin" } });
    fireEvent.change(screen.getByPlaceholderText(/admin@stjulian\.ac\.ug/i), { target: { value: "admin@school.ac.ug" } });

    const createButton = screen.getAllByRole("button", { name: /create school/i })[1]!;
    const passwordInput = screen.getByPlaceholderText(/min 10 characters/i);

    fireEvent.change(passwordInput, { target: { value: "123456789" } });
    expect(createButton).toBeDisabled();

    fireEvent.change(passwordInput, { target: { value: "1234567890" } });
    expect(createButton).not.toBeDisabled();
  });

  it("renders owner users as cards on mobile and a table on desktop", async () => {
    ownerClientMocks.fetchOwnerUsers.mockResolvedValue({
      users: [
        {
          id: "user-1",
          name: "Patricia Christine Nankabirwa Very Long Name for Layout Testing",
          email: "patricia.nankabirwa@school.ac.ug",
          role: "ADMIN_OPERATOR",
          isActive: true,
          mustChangePassword: true,
          lastLoginAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          school: { id: "school-1", code: "SCH-01", name: "St. Marys College of Excellence", },
        },
      ],
    });
    ownerClientMocks.fetchOwnerSchools.mockResolvedValue({
      schools: [
        { id: "school-1", code: "SCH-01", name: "St. Marys College of Excellence", phone: null, address: null, isActive: true, createdAt: new Date().toISOString(), subscription: null, primaryAdmin: null, studentCount: 0 },
      ],
    });

    renderInRouter(<OwnerUsersPage />);

    await waitFor(() => expect(screen.getByRole("heading", { name: /users/i, level: 2 })).toBeInTheDocument());
    await waitFor(() => expect(screen.queryByText(/loading users/i)).not.toBeInTheDocument());
    expect(screen.getAllByText(/patricia christine nankabirwa/i)[0]?.className).toContain("line-clamp-2");
    expect(screen.getByPlaceholderText(/search by name or email/i)).toBeInTheDocument();
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.getByText(/create user/i)).toBeInTheDocument();
  });

  it("renders the reader management inventory and detail view", async () => {
    ownerClientMocks.fetchOwnerReaders.mockResolvedValue({
      readers: [
        {
          id: "reader-1",
          schoolId: "school-1",
          school: { id: "school-1", code: "BULO", name: "Buloba High School" },
          name: "NFC Reader Gate 01",
          deviceKey: "attendance-gate-01",
          location: "Main Gate",
          locationType: "GATE",
          locationName: "Main Gate",
          mode: "ATTENDANCE",
          attendanceMode: "GATE_ATTENDANCE",
          setupStatus: "READY",
          studentScope: "ALL_STUDENTS",
          classId: null,
          streamId: null,
          status: "ACTIVE",
          isActive: true,
          firmwareVersion: "1.0.2",
          lastHeartbeatAt: new Date().toISOString(),
          lastIp: "192.168.1.51",
          lastRssi: -52,
          lastSeenAt: new Date().toISOString(),
          lastScanAt: new Date().toISOString(),
          lastScanStatus: "SUCCESS",
          lastScanMessage: "Scan accepted",
          queueDepth: 0,
          onlineStatus: "ONLINE",
          rawOnlineStatus: "ONLINE",
          uptimeMs: 12345,
          freeHeap: 204800,
          rebootReason: "POWERON_RESET",
          otaStatus: "NO_UPDATE",
          otaMessage: "No firmware update available.",
          heartbeatStale: false,
          hasToken: true,
          tokenHashPrefix: "abc123...",
        },
      ],
    });
    ownerClientMocks.fetchOwnerReader.mockResolvedValue({
      reader: {
        id: "reader-1",
        schoolId: "school-1",
        school: { id: "school-1", code: "BULO", name: "Buloba High School" },
        name: "NFC Reader Gate 01",
        deviceKey: "attendance-gate-01",
        location: "Main Gate",
        locationType: "GATE",
        locationName: "Main Gate",
        mode: "ATTENDANCE",
        attendanceMode: "GATE_ATTENDANCE",
        setupStatus: "READY",
        studentScope: "ALL_STUDENTS",
        classId: null,
        streamId: null,
        status: "ACTIVE",
        isActive: true,
        firmwareVersion: "1.0.2",
        lastHeartbeatAt: new Date().toISOString(),
        lastIp: "192.168.1.51",
        lastRssi: -52,
        lastSeenAt: new Date().toISOString(),
        lastScanAt: new Date().toISOString(),
        lastScanStatus: "SUCCESS",
        lastScanMessage: "Scan accepted",
        queueDepth: 0,
        onlineStatus: "ONLINE",
        rawOnlineStatus: "ONLINE",
        uptimeMs: 12345,
        freeHeap: 204800,
        rebootReason: "POWERON_RESET",
        otaStatus: "NO_UPDATE",
        otaMessage: "No firmware update available.",
        heartbeatStale: false,
        hasToken: true,
        tokenHashPrefix: "abc123...",
      },
      diagnostics: {
        health: {
          status: "ONLINE",
          heartbeatAgeMinutes: 1,
          queueDepth: 0,
          firmwareVersion: "1.0.2",
          wifiRssi: -52,
          freeHeap: 204800,
          uptimeMs: 12345,
          rebootReason: "POWERON_RESET",
          otaStatus: "NO_UPDATE",
        },
        recentScans: [],
        recentErrors: [],
        otaHistory: [],
        heartbeats: [],
      },
    });

    renderInRouter(<OwnerReaderManagementPage />);

    await waitFor(() => expect(screen.getByRole("heading", { name: /reader management/i, level: 2 })).toBeInTheDocument());
    await waitFor(() => expect(screen.getAllByText(/Buloba High School/i).length).toBeGreaterThan(0));
    expect(screen.getAllByText(/NFC Reader Gate 01/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/unknown taps are retained as blocked/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /refresh/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /show filters/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /show filters/i }));
    expect(screen.getAllByText(/^school$/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/more reader details/i)).toBeInTheDocument();
  });

  it("surfaces incomplete attendance setup in the reader inventory", async () => {
    ownerClientMocks.fetchOwnerReaders.mockResolvedValue({
      readers: [
        {
          id: "reader-1",
          schoolId: "school-1",
          school: { id: "school-1", code: "BULO", name: "Buloba High School" },
          name: "NFC Reader Gate 01",
          deviceKey: "attendance-gate-01",
          location: "Main Gate",
          locationType: null,
          locationName: null,
          mode: "ATTENDANCE",
          attendanceMode: null,
          setupStatus: "INCOMPLETE_SETUP",
          studentScope: "ALL_STUDENTS",
          classId: null,
          streamId: null,
          status: "ACTIVE",
          isActive: true,
          firmwareVersion: "1.0.2",
          lastHeartbeatAt: new Date().toISOString(),
          lastIp: "192.168.1.51",
          lastRssi: -52,
          lastSeenAt: new Date().toISOString(),
          lastScanAt: new Date().toISOString(),
          lastScanStatus: "SUCCESS",
          lastScanMessage: "Scan accepted",
          queueDepth: 0,
          onlineStatus: "ONLINE",
          rawOnlineStatus: "ONLINE",
          uptimeMs: 12345,
          freeHeap: 204800,
          rebootReason: "POWERON_RESET",
          otaStatus: "NO_UPDATE",
          otaMessage: "No firmware update available.",
          heartbeatStale: false,
          hasToken: true,
          tokenHashPrefix: "abc123...",
        },
      ],
    });
    ownerClientMocks.fetchOwnerReader.mockResolvedValue({
      reader: {
        id: "reader-1",
        schoolId: "school-1",
        school: { id: "school-1", code: "BULO", name: "Buloba High School" },
        name: "NFC Reader Gate 01",
        deviceKey: "attendance-gate-01",
        location: "Main Gate",
        locationType: null,
        locationName: null,
        mode: "ATTENDANCE",
        attendanceMode: null,
        setupStatus: "INCOMPLETE_SETUP",
        studentScope: "ALL_STUDENTS",
        classId: null,
        streamId: null,
        status: "ACTIVE",
        isActive: true,
        firmwareVersion: "1.0.2",
        lastHeartbeatAt: new Date().toISOString(),
        lastIp: "192.168.1.51",
        lastRssi: -52,
        lastSeenAt: new Date().toISOString(),
        lastScanAt: new Date().toISOString(),
        lastScanStatus: "SUCCESS",
        lastScanMessage: "Scan accepted",
        queueDepth: 0,
        onlineStatus: "ONLINE",
        rawOnlineStatus: "ONLINE",
        uptimeMs: 12345,
        freeHeap: 204800,
        rebootReason: "POWERON_RESET",
        otaStatus: "NO_UPDATE",
        otaMessage: "No firmware update available.",
        heartbeatStale: false,
        hasToken: true,
        tokenHashPrefix: "abc123...",
      },
      diagnostics: {
        health: {
          status: "ONLINE",
          heartbeatAgeMinutes: 1,
          queueDepth: 0,
          firmwareVersion: "1.0.2",
          wifiRssi: -52,
          freeHeap: 204800,
          uptimeMs: 12345,
          rebootReason: "POWERON_RESET",
          otaStatus: "NO_UPDATE",
        },
        recentScans: [],
        recentErrors: [],
        otaHistory: [],
        heartbeats: [],
      },
    });

    renderInRouter(<OwnerReaderManagementPage />);

    await waitFor(() => expect(screen.getByText(/incomplete setup/i)).toBeInTheDocument());
  });

  it("renders reader detail diagnostics and actions", async () => {
    ownerClientMocks.fetchOwnerReader.mockResolvedValue({
      reader: {
        id: "reader-1",
        schoolId: "school-1",
        school: { id: "school-1", code: "BULO", name: "Buloba High School" },
        name: "NFC Reader Gate 01",
        deviceKey: "attendance-gate-01",
        location: "Main Gate",
        locationType: "GATE",
        locationName: "Main Gate",
        mode: "ATTENDANCE",
        attendanceMode: "GATE_ATTENDANCE",
        studentScope: "ALL_STUDENTS",
        classId: null,
        streamId: null,
        status: "ACTIVE",
        isActive: true,
        firmwareVersion: "1.0.2",
        lastHeartbeatAt: new Date().toISOString(),
        lastIp: "192.168.1.51",
        lastRssi: -52,
        lastSeenAt: new Date().toISOString(),
        lastScanAt: new Date().toISOString(),
        lastScanStatus: "SUCCESS",
        lastScanMessage: "Scan accepted",
        queueDepth: 0,
        onlineStatus: "ONLINE",
        rawOnlineStatus: "ONLINE",
        uptimeMs: 12345,
        freeHeap: 204800,
        rebootReason: "POWERON_RESET",
        otaStatus: "NO_UPDATE",
        otaMessage: "No firmware update available.",
        heartbeatStale: false,
        hasToken: true,
        tokenHashPrefix: "abc123...",
      },
      diagnostics: {
        health: {
          status: "ONLINE",
          heartbeatAgeMinutes: 1,
          queueDepth: 0,
          firmwareVersion: "1.0.2",
          wifiRssi: -52,
          freeHeap: 204800,
          uptimeMs: 12345,
          rebootReason: "POWERON_RESET",
          otaStatus: "NO_UPDATE",
        },
        recentScans: [],
        recentErrors: [],
        otaHistory: [],
        heartbeats: [],
      },
    });

    renderInRouter(<OwnerReaderDetailPage />, ["/owner/readers/reader-1"], "/owner/readers/:readerId");

    await waitFor(() => expect(screen.getByRole("heading", { name: /nfc reader gate 01/i })).toBeInTheDocument());
    expect(await screen.findAllByText(/Buloba High School/i)).toHaveLength(2);
    expect(screen.queryByRole("button", { name: /rotate token/i })).not.toBeInTheDocument();
    expect(screen.getByText(/recent scans/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /update firmware/i })).toBeInTheDocument();
  });

});
