import { MemoryRouter } from "react-router-dom";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getLocalDateInputValue, NfcAttendancePage } from "../../pages/NfcAttendancePage";

const mockFetchAttendanceClasses = vi.hoisted(() => vi.fn());
const mockFetchNfcAttendanceRegister = vi.hoisted(() => vi.fn());
const mockFetchGateAttendanceReport = vi.hoisted(() => vi.fn());
const mockFetchClassroomAttendanceReport = vi.hoisted(() => vi.fn());
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
  fetchClassroomAttendanceReport: mockFetchClassroomAttendanceReport,
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
  mockFetchClassroomAttendanceReport.mockResolvedValue({
    summary: { totalEvents: 1, morningPresent: 1, nightPrepPresent: 0, missingBoarders: 0, wrongClassAttempts: 0, sessionClosedScans: 0 },
    rows: [
      {
        id: "classroom-row-1",
        studentId: "student-3",
        studentName: "Alan Turing",
        admissionNumber: "A-003",
        className: "Senior 1",
        streamName: "B",
        scholarType: "BOARDING",
        eventType: "MORNING_CLASS",
        eventStatus: "RECORDED",
        morningAttendance: true,
        nightPrepAttendance: false,
        missingBoarder: false,
        wrongClassAttempt: false,
        sessionClosedScan: false,
        readerUsed: "Classroom Reader A",
        originalDeviceTime: "2026-07-12T07:15:00.000Z",
      },
    ],
  });
});

describe("NfcAttendancePage", () => {
  it("derives the report date from local calendar fields instead of UTC ISO strings", () => {
    const fakeLocalDate = {
      getFullYear: () => 2026,
      getMonth: () => 6,
      getDate: () => 15,
      toISOString: () => "2026-07-14T21:15:00.000Z",
    } as Date;

    expect(getLocalDateInputValue(fakeLocalDate)).toBe("2026-07-15");
  });

  it("keeps oversight data visible for administrators while hiding manual punch controls and collapsing the operator layout", async () => {
    renderPage();

    await waitFor(() => expect(mockFetchNfcAttendanceRegister).toHaveBeenCalled());
    expect(screen.getByText(/daily attendance register/i)).toBeInTheDocument();
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

  it("disables generate until the required date is present", async () => {
    renderPage();

    await waitFor(() => expect(mockFetchNfcAttendanceRegister).toHaveBeenCalled());
    const dateInput = screen.getByTestId("attendance-filter-grid").querySelector('input[type="date"]') as HTMLInputElement;
    const generateButton = screen.getByTestId("attendance-generate-button");
    expect(generateButton).toBeEnabled();

    fireEvent.change(dateInput, { target: { value: "" } });
    expect(generateButton).toBeDisabled();

    fireEvent.change(dateInput, { target: { value: "2026-07-12" } });
    expect(generateButton).toBeEnabled();
  });

  it("submits exactly one preview request per click burst and shows a loading state", async () => {
    let resolvePreview: ((value: unknown) => void) | undefined;
    mockFetchNfcAttendanceRegister.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolvePreview = resolve as (value: unknown) => void;
        }),
    );

    renderPage();

    await waitFor(() => expect(mockFetchNfcAttendanceRegister).toHaveBeenCalledTimes(2));
    const initialCalls = mockFetchNfcAttendanceRegister.mock.calls.length;
    const generateButton = screen.getByTestId("attendance-generate-button");

    fireEvent.click(generateButton);
    fireEvent.click(generateButton);

    expect(mockFetchNfcAttendanceRegister).toHaveBeenCalledTimes(initialCalls + 1);
    expect(screen.getAllByRole("button", { name: /generating/i }).length).toBeGreaterThan(0);

    resolvePreview?.({
      date: "2026-07-12",
      summary: { totalStudents: 2, present: 1, out: 0, absent: 1, blockedScans: 0, duplicateScans: 0 },
      rows: [
        {
          student: {
            id: "student-1",
            name: "Ada Lovelace",
            admissionNumber: "A-001",
            className: "Senior 1",
            streamName: "A",
            studentType: "DAY",
            photoUrl: null,
          },
          tapIn: {
            id: "scan-1",
            direction: "TAP_IN",
            scannedAt: "2026-07-12T05:00:00.000Z",
            status: "VALID",
            source: "Main Entrance",
          },
          tapOut: null,
          lastScan: {
            id: "scan-1",
            direction: "TAP_IN",
            scannedAt: "2026-07-12T05:00:00.000Z",
            status: "VALID",
            reason: null,
          },
          currentStatus: "PRESENT",
        },
      ],
    });

    await waitFor(() => expect(screen.getByTestId("attendance-preview-sheet")).toBeInTheDocument());
  });

  it("renders a same-page gate preview, keeps print controls outside the printable sheet, and uses browser print", async () => {
    const printSpy = vi.spyOn(window, "print").mockImplementation(() => undefined);
    const openSpy = vi.spyOn(window, "open");
    renderPage("/nfc/attendance?view=GATE");

    await waitFor(() => expect(mockFetchGateAttendanceReport).toHaveBeenCalledTimes(2));
    fireEvent.click(screen.getByTestId("attendance-generate-button"));

    await waitFor(() => expect(mockFetchGateAttendanceReport).toHaveBeenCalledTimes(3));
    const previewSection = await screen.findByTestId("attendance-preview-section");
    const previewSheet = await screen.findByTestId("attendance-preview-sheet");
    const previewTable = await screen.findByTestId("attendance-preview-table");

    expect(previewSection).toHaveClass("attendance-preview-section", "report-print-area");
    expect(previewSheet).toHaveClass("attendance-preview-sheet", "report-print-page");
    expect(within(previewSection).getByText(/gate attendance report/i)).toBeInTheDocument();
    expect(within(previewTable).getByText("Ada Lovelace")).toBeInTheDocument();
    expect(within(previewTable).getByText("Grace Hopper")).toBeInTheDocument();
    expect(within(previewTable).getByText("Alan Turing")).toBeInTheDocument();
    expect(within(previewSheet).getAllByText(/day scholar/i).length).toBeGreaterThan(0);
    expect(previewSection.querySelector(".no-print")).not.toBeNull();

    fireEvent.click(screen.getByTestId("attendance-preview-print-button"));
    expect(printSpy).toHaveBeenCalledTimes(1);
    expect(openSpy).not.toHaveBeenCalled();
  });

  it("shows a safe preview error and restores generate after a failed request", async () => {
    renderPage("/nfc/attendance?view=GATE");

    await waitFor(() => expect(mockFetchGateAttendanceReport).toHaveBeenCalledTimes(2));
    mockFetchGateAttendanceReport.mockRejectedValueOnce(new Error("Server exploded"));
    fireEvent.click(screen.getByTestId("attendance-generate-button"));

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(/could not generate the attendance preview/i),
    );
    await waitFor(() => expect(screen.getByTestId("attendance-generate-button")).toBeEnabled());
  });

  it("renders a professional empty preview instead of failing when no canonical records exist", async () => {
    renderPage("/nfc/attendance?view=GATE");

    await waitFor(() => expect(mockFetchGateAttendanceReport).toHaveBeenCalledTimes(2));
    mockFetchGateAttendanceReport.mockResolvedValueOnce({
      date: "2026-07-12",
      summary: { totalStudents: 0, present: 0, late: 0, absent: 0, onCampus: 0, offCampus: 0, departureMissing: 0, restrictedAttempts: 0, manualOverrides: 0 },
      rows: [],
    });
    fireEvent.click(screen.getByTestId("attendance-generate-button"));

    await screen.findByTestId("attendance-preview-sheet");
    const previewTable = await screen.findByTestId("attendance-preview-table");
    expect(within(previewTable).getByText(/no attendance records matched the selected filters/i)).toBeInTheDocument();
  });

  it("preserves the selected Day Scholar or Boarder filter in the preview output", async () => {
    renderPage("/nfc/attendance?view=GATE");

    await waitFor(() => expect(mockFetchGateAttendanceReport).toHaveBeenCalledTimes(2));
    fireEvent.click(screen.getByRole("button", { name: /boarders/i }));
    fireEvent.click(screen.getByTestId("attendance-generate-button"));

    await waitFor(() => expect(mockFetchGateAttendanceReport).toHaveBeenCalledTimes(3));
    expect(mockFetchGateAttendanceReport.mock.calls.at(-1)?.[0]).toEqual(
      expect.objectContaining({ studentType: "BOARDING" }),
    );
    const previewSheet = await screen.findByTestId("attendance-preview-sheet");
    expect(within(previewSheet).getByText(/^boarders$/i)).toBeInTheDocument();
  });

  it("uses the classroom canonical source when classroom view is selected", async () => {
    renderPage("/nfc/attendance?view=CLASSROOM");

    await waitFor(() => expect(mockFetchClassroomAttendanceReport).toHaveBeenCalledTimes(2));
    const initialClassroomCalls = mockFetchClassroomAttendanceReport.mock.calls.length;
    const initialRegisterCalls = mockFetchNfcAttendanceRegister.mock.calls.length;
    const initialGateCalls = mockFetchGateAttendanceReport.mock.calls.length;

    fireEvent.click(screen.getByTestId("attendance-generate-button"));

    await waitFor(() => expect(mockFetchClassroomAttendanceReport).toHaveBeenCalledTimes(initialClassroomCalls + 1));
    expect(mockFetchNfcAttendanceRegister).toHaveBeenCalledTimes(initialRegisterCalls);
    expect(mockFetchGateAttendanceReport).toHaveBeenCalledTimes(initialGateCalls);
    const previewSheet = await screen.findByTestId("attendance-preview-sheet");
    expect(within(previewSheet).getAllByText("Alan Turing").length).toBeGreaterThan(0);
  });

  it("allows closing the preview without disturbing the filter layout", async () => {
    renderPage("/nfc/attendance?view=GATE");

    await waitFor(() => expect(mockFetchGateAttendanceReport).toHaveBeenCalledTimes(2));
    fireEvent.click(screen.getByTestId("attendance-generate-button"));

    await waitFor(() => expect(screen.getByTestId("attendance-preview-sheet")).toBeInTheDocument());
    fireEvent.click(screen.getByTestId("attendance-preview-close-button"));

    await waitFor(() => expect(screen.queryByTestId("attendance-preview-sheet")).not.toBeInTheDocument());
    expect(screen.getByTestId("attendance-filter-grid")).toBeInTheDocument();
    expect(screen.getByTestId("attendance-print-actions")).toHaveClass("flex", "flex-wrap", "gap-2");
  });
});
