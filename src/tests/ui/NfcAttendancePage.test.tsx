import { MemoryRouter } from "react-router-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NfcAttendancePage } from "../../pages/NfcAttendancePage";

const mockFetchAttendanceClasses = vi.hoisted(() => vi.fn());
const mockFetchNfcAttendanceRegister = vi.hoisted(() => vi.fn());
const mockFetchGateAttendanceReport = vi.hoisted(() => vi.fn());
const authState = vi.hoisted(() => ({
  role: "ADMIN_OPERATOR",
}));

vi.mock("../../contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { id: "user-1", schoolId: "school-a", name: "Attendance User", role: authState.role },
  }),
}));

vi.mock("../../components/layout/SettingsContext", () => ({
  useAppSettings: () => ({
    settings: {
      sections: {
        school: {
          schoolName: "Test School",
          address: "Kampala",
          phone: "+256700000000",
          email: "admin@test.school",
          logoUrl: "https://cdn.example.com/logo.png",
        },
      },
    },
  }),
}));

vi.mock("../../hooks/useConnectivityStatus", () => ({
  useConnectivityStatus: () => ({
    isOfflineReady: false,
    pendingCount: 0,
    triggerSync: vi.fn(async () => undefined),
  }),
}));

vi.mock("../../hooks/useNfcOfflineSnapshotRefresh", () => ({
  useNfcOfflineSnapshotRefresh: () => ({
    validity: { valid: true, diagnostics: { studentCount: 2, tagCount: 2 } },
    isRefreshing: false,
    refreshError: "",
  }),
}));

vi.mock("../../hooks/useNfcScanner", () => ({
  useNfcScanner: () => ({
    state: "IDLE",
    error: "",
    isOnline: true,
    isWebNfcAvailable: false,
    startScanner: vi.fn(),
    stopScanner: vi.fn(),
    submitManual: vi.fn(),
  }),
}));

vi.mock("../../client/studentCredentialsClient", () => ({
  fetchAttendanceClasses: mockFetchAttendanceClasses,
  fetchNfcAttendanceRegister: mockFetchNfcAttendanceRegister,
  fetchGateAttendanceReport: mockFetchGateAttendanceReport,
  fetchClassroomAttendanceReport: vi.fn(async () => ({ summary: { totalEvents: 0, morningPresent: 0, nightPrepPresent: 0, missingBoarders: 0, wrongClassAttempts: 0, sessionClosedScans: 0 }, rows: [] })),
  scanNfcAttendance: vi.fn(),
  approveGateAttendanceOverride: vi.fn(),
}));

vi.mock("../../offline/offlineResolver", () => ({
  resolveOfflineNfcScan: vi.fn(),
}));

vi.mock("../../offline/offlineStore", () => ({
  getSnapshotMeta: vi.fn(async () => ({ snapshotId: "attendance-register-1" })),
  getNextAttendanceDirection: vi.fn(async () => "TAP_IN"),
  hasRecentAttendancePunch: vi.fn(async () => false),
  queueAttendanceEvent: vi.fn(async () => undefined),
}));

vi.mock("../../offline/offlineStatus", () => ({
  getSnapshotValidity: vi.fn(async () => ({ valid: true })),
}));

vi.mock("../../offline/offlineHash", () => ({
  hashNfcLookupValue: vi.fn(async (value: string) => `hash:${value}`),
}));

function renderPage(initialEntry = "/nfc/attendance") {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <NfcAttendancePage />
    </MemoryRouter>,
  );
}

const gateRows = [
  {
    studentId: "student-1",
    studentName: "Ada Lovelace",
    admissionNumber: "A-001",
    className: "Senior 1",
    streamName: "A",
    scholarType: "DAY",
    attendanceStatus: "PRESENT",
    arrivalTime: "2026-07-12T05:00:00.000Z",
    lateIndicator: false,
    departureTime: null,
    departureNotRecorded: true,
    campusStatus: "ON_CAMPUS",
    feeHoldAttempt: false,
    manualOverride: false,
    readerUsed: "Main Entrance",
    offlineSynced: false,
    lastRestrictedAttemptAt: null,
  },
  {
    studentId: "student-2",
    studentName: "Grace Hopper",
    admissionNumber: "A-002",
    className: "Senior 1",
    streamName: "A",
    scholarType: "DAY",
    attendanceStatus: "LATE",
    arrivalTime: "2026-07-12T05:20:00.000Z",
    lateIndicator: true,
    departureTime: "2026-07-12T13:30:00.000Z",
    departureNotRecorded: false,
    campusStatus: "OFF_CAMPUS",
    feeHoldAttempt: false,
    manualOverride: false,
    readerUsed: null,
    offlineSynced: false,
    lastRestrictedAttemptAt: null,
  },
  {
    studentId: "student-3",
    studentName: "Alan Turing",
    admissionNumber: "A-003",
    className: "Senior 1",
    streamName: "B",
    scholarType: "BOARDING",
    attendanceStatus: "ABSENT",
    arrivalTime: null,
    lateIndicator: false,
    departureTime: null,
    departureNotRecorded: false,
    campusStatus: "OFF_CAMPUS",
    feeHoldAttempt: false,
    manualOverride: false,
    readerUsed: null,
    offlineSynced: false,
    lastRestrictedAttemptAt: null,
  },
] as const;

beforeEach(() => {
  vi.clearAllMocks();
  authState.role = "ADMIN_OPERATOR";
  mockFetchAttendanceClasses.mockResolvedValue({
    classes: [{ id: "class-1", name: "Senior 1", code: "S1", streams: [{ id: "stream-1", name: "A", code: "A" }] }],
  });
  mockFetchNfcAttendanceRegister.mockResolvedValue({
    date: "2026-07-12",
    summary: { totalStudents: 0, present: 0, out: 0, absent: 0, blockedScans: 0, duplicateScans: 0 },
    rows: [],
  });
  mockFetchGateAttendanceReport.mockResolvedValue({
    date: "2026-07-12",
    summary: { totalStudents: 3, present: 2, late: 1, absent: 1, onCampus: 1, offCampus: 2, departureMissing: 1, restrictedAttempts: 0, manualOverrides: 0 },
    rows: gateRows,
  });
});

describe("NfcAttendancePage", () => {
  it("keeps oversight data visible for administrators while hiding manual punch controls and collapsing the operator layout", async () => {
    renderPage();

    await waitFor(() => expect(mockFetchNfcAttendanceRegister).toHaveBeenCalled());
    expect(screen.getByText(/class attendance register/i)).toBeInTheDocument();
    expect(screen.getAllByText(/^present$/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/^absent$/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/^filters$/i).length).toBeGreaterThan(0);
    expect(screen.queryByText(/punch mode/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /punch in/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /punch out/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/current mode/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /start attendance scanner/i })).not.toBeInTheDocument();
    expect(screen.getByTestId("attendance-main-layout")).not.toHaveClass("lg:grid-cols-[380px_minmax(0,1fr)]");
  });

  it("renders filters in a compact desktop layout with horizontal print actions", async () => {
    renderPage();

    await waitFor(() => expect(mockFetchNfcAttendanceRegister).toHaveBeenCalled());
    expect(screen.getByTestId("attendance-filter-grid")).toHaveClass("xl:grid-cols-[160px_220px_180px_180px_minmax(0,1fr)]");
    expect(screen.getByTestId("attendance-print-actions")).toHaveClass("flex", "flex-wrap", "gap-2");
    expect(screen.getByTestId("attendance-filter-actions")).toHaveClass("flex", "flex-wrap", "items-center", "gap-2");
  });

  it("keeps the register directly after filters and preserves filter handlers", async () => {
    renderPage();

    await waitFor(() => expect(mockFetchNfcAttendanceRegister).toHaveBeenCalledTimes(2));
    fireEvent.change(screen.getByPlaceholderText(/name or admission number/i), { target: { value: "Ada" } });
    fireEvent.click(screen.getByRole("button", { name: /apply filters/i }));

    await waitFor(() => expect(mockFetchNfcAttendanceRegister).toHaveBeenCalledTimes(3));
    expect(mockFetchNfcAttendanceRegister.mock.calls.at(-1)?.[0]).toEqual(
      expect.objectContaining({ search: "Ada" }),
    );
    expect(screen.getByTestId("attendance-register-card")).toBeInTheDocument();
  });

  it("shows punch mode to explicitly authorized attendance operators", async () => {
    authState.role = "GATE_SECURITY";
    renderPage();

    await waitFor(() => expect(mockFetchNfcAttendanceRegister).toHaveBeenCalled());
    expect(screen.getByText(/punch mode/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /punch in/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /punch out/i })).toBeInTheDocument();
    expect(screen.getByTestId("attendance-main-layout")).toHaveClass("lg:grid-cols-[380px_minmax(0,1fr)]");
  });

  it("applies initial dashboard query parameters only on first load", async () => {
    renderPage("/nfc/attendance?view=GATE&attendanceStatus=PRESENT");

    await waitFor(() => expect(mockFetchGateAttendanceReport).toHaveBeenCalledTimes(2));
    expect(mockFetchGateAttendanceReport.mock.calls.at(-1)?.[0]).toEqual(
      expect.objectContaining({ attendanceStatus: "PRESENT" }),
    );
    expect(screen.getByRole("button", { name: /gate view/i })).toHaveClass("bg-blue-600");
  });

  it("prints the full register from a fresh canonical fetch and excludes private credential data", async () => {
    const printSpy = vi.fn();
    const closeSpy = vi.fn();
    const openSpy = vi.spyOn(window, "open").mockReturnValue({
      document: { open: vi.fn(), write: vi.fn(), close: vi.fn() },
      focus: vi.fn(),
      print: printSpy,
      close: closeSpy,
      onload: null,
    } as unknown as Window);

    renderPage("/nfc/attendance?view=GATE");

    await waitFor(() => expect(mockFetchGateAttendanceReport).toHaveBeenCalledTimes(2));
    fireEvent.click(screen.getByRole("button", { name: /full register/i }));

    await waitFor(() => expect(mockFetchGateAttendanceReport).toHaveBeenCalledTimes(3));
    const popup = openSpy.mock.results[0]?.value as unknown as {
      document: { write: (html: string) => void };
      onload: (() => void) | null;
    };
    const writtenHtml = vi.mocked(popup.document.write).mock.calls[0]?.[0] as string;

    expect(writtenHtml).toContain("DAILY ATTENDANCE REGISTER");
    expect(writtenHtml).toContain("Ada Lovelace");
    expect(writtenHtml).toContain("Grace Hopper");
    expect(writtenHtml).toContain("Alan Turing");
    expect(writtenHtml).toContain("Not recorded");
    expect(writtenHtml).toContain("thead { display: table-header-group; }");
    expect(writtenHtml).not.toContain("credential");
    expect(writtenHtml).not.toContain("token");
    expect(writtenHtml).not.toContain("student-1");

    popup.onload?.();
    expect(printSpy).toHaveBeenCalledTimes(1);
    expect(closeSpy).toHaveBeenCalledTimes(1);
  });

  it("prints present students with PRESENT and LATE rows only, and absent print excludes present rows", async () => {
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => ({
      document: { open: vi.fn(), write: vi.fn(), close: vi.fn() },
      focus: vi.fn(),
      print: vi.fn(),
      close: vi.fn(),
      onload: null,
    } as unknown as Window));

    renderPage("/nfc/attendance?view=GATE");

    await waitFor(() => expect(mockFetchGateAttendanceReport).toHaveBeenCalledTimes(2));

    fireEvent.click(screen.getByRole("button", { name: /present students/i }));
    await waitFor(() => expect(mockFetchGateAttendanceReport).toHaveBeenCalledTimes(3));
    const presentHtml = vi.mocked((openSpy.mock.results[0]?.value as any).document.write).mock.calls[0]?.[0] as string;
    expect(presentHtml).toContain("Ada Lovelace");
    expect(presentHtml).toContain("Grace Hopper");
    expect(presentHtml).not.toContain("Alan Turing");

    fireEvent.click(screen.getByRole("button", { name: /absent students/i }));
    await waitFor(() => expect(mockFetchGateAttendanceReport).toHaveBeenCalledTimes(4));
    const absentHtml = vi.mocked((openSpy.mock.results[1]?.value as any).document.write).mock.calls[0]?.[0] as string;
    expect(absentHtml).toContain("Alan Turing");
    expect(absentHtml).not.toContain("Ada Lovelace");
    expect(absentHtml).not.toContain("Grace Hopper");
  });

  it("does not print when the fresh fetch returns no matching students", async () => {
    mockFetchGateAttendanceReport
      .mockResolvedValueOnce({
        date: "2026-07-12",
        summary: { totalStudents: 3, present: 2, late: 1, absent: 1, onCampus: 1, offCampus: 2, departureMissing: 1, restrictedAttempts: 0, manualOverrides: 0 },
        rows: gateRows,
      })
      .mockResolvedValueOnce({
        date: "2026-07-12",
        summary: { totalStudents: 3, present: 2, late: 1, absent: 1, onCampus: 1, offCampus: 2, departureMissing: 1, restrictedAttempts: 0, manualOverrides: 0 },
        rows: gateRows,
      })
      .mockResolvedValueOnce({
        date: "2026-07-12",
        summary: { totalStudents: 0, present: 0, late: 0, absent: 0, onCampus: 0, offCampus: 0, departureMissing: 0, restrictedAttempts: 0, manualOverrides: 0 },
        rows: [],
      });
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);

    renderPage("/nfc/attendance?view=GATE");

    await waitFor(() => expect(mockFetchGateAttendanceReport).toHaveBeenCalledTimes(2));
    fireEvent.click(screen.getByRole("button", { name: /full register/i }));

    await waitFor(() => expect(screen.getByText(/no students match these filters/i)).toBeInTheDocument());
    expect(openSpy).not.toHaveBeenCalled();
  });
});
