import { MemoryRouter } from "react-router-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NfcAttendancePage } from "../../pages/NfcAttendancePage";

const mockResolveOfflineNfcScan = vi.hoisted(() => vi.fn());
const mockQueueAttendanceEvent = vi.hoisted(() => vi.fn(async () => undefined));
const mockScanNfcAttendance = vi.hoisted(() => vi.fn());
const mockGetNextAttendanceDirection = vi.hoisted(() => vi.fn(async () => "TAP_IN"));
const mockHasRecentAttendancePunch = vi.hoisted(() => vi.fn(async () => false));
const mockTriggerSync = vi.hoisted(() => vi.fn(async () => undefined));
const authState = vi.hoisted(() => ({
  role: "GATE_SECURITY",
}));

function setNavigatorOnline(value: boolean) {
  Object.defineProperty(navigator, "onLine", { configurable: true, value });
}

vi.mock("../../contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { id: "user-1", schoolId: "school-a", name: "Attendance User", role: authState.role },
  }),
}));

vi.mock("../../hooks/useConnectivityStatus", () => ({
  useConnectivityStatus: () => ({
    isOfflineReady: false,
    pendingCount: 0,
    triggerSync: mockTriggerSync,
  }),
}));

vi.mock("../../hooks/useNfcOfflineSnapshotRefresh", () => ({
  useNfcOfflineSnapshotRefresh: () => ({
    validity: {
      valid: true,
      diagnostics: { studentCount: 1, tagCount: 1 },
    },
    isRefreshing: false,
    refreshError: "",
  }),
}));

vi.mock("../../client/studentCredentialsClient", () => ({
  fetchAttendanceClasses: vi.fn(async () => ({ classes: [] })),
  fetchNfcAttendanceRegister: vi.fn(async () => ({
    date: "2026-07-12",
    summary: { totalStudents: 1, present: 0, out: 0, absent: 1, blockedScans: 0, duplicateScans: 0 },
    rows: [],
  })),
  fetchGateAttendanceReport: vi.fn(async () => ({
    date: "2026-07-12",
    summary: { totalStudents: 0, present: 0, late: 0, absent: 0, onCampus: 0, offCampus: 0, departureMissing: 0, restrictedAttempts: 0, manualOverrides: 0 },
    rows: [],
  })),
  fetchClassroomAttendanceReport: vi.fn(async () => ({
    date: "2026-07-12",
    summary: { totalEvents: 0, morningPresent: 0, nightPrepPresent: 0, missingBoarders: 0, wrongClassAttempts: 0, sessionClosedScans: 0 },
    rows: [],
  })),
  approveGateAttendanceOverride: vi.fn(),
  scanNfcAttendance: mockScanNfcAttendance,
}));

vi.mock("../../offline/offlineResolver", () => ({
  resolveOfflineNfcScan: mockResolveOfflineNfcScan,
}));

vi.mock("../../offline/offlineStore", () => ({
  getSnapshotMeta: vi.fn(async () => ({ snapshotId: "attendance-register-1" })),
  getNextAttendanceDirection: mockGetNextAttendanceDirection,
  hasRecentAttendancePunch: mockHasRecentAttendancePunch,
  queueAttendanceEvent: mockQueueAttendanceEvent,
}));

vi.mock("../../offline/offlineStatus", () => ({
  getSnapshotValidity: vi.fn(async () => ({ valid: true })),
}));

vi.mock("../../offline/offlineHash", () => ({
  hashNfcLookupValue: vi.fn(async (value: string) => `hash:${value}`),
}));

describe("NfcAttendancePage local-first", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authState.role = "GATE_SECURITY";
    setNavigatorOnline(true);
    mockResolveOfflineNfcScan.mockResolvedValue({
      found: true,
      blocked: false,
      student: {
        id: "student-1",
        firstName: "Ada",
        lastName: "Lovelace",
        admissionNumber: "A001",
        className: "P4",
        streamName: "A",
      },
      tag: { id: "tag-1" },
    });
  });

  it("uses local DB first while online and queues punch before background sync", async () => {
    render(
      <MemoryRouter>
        <NfcAttendancePage />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByPlaceholderText(/scan token or uid/i), { target: { value: "PUB001" } });
    fireEvent.click(screen.getByRole("button", { name: "Go" }));

    await waitFor(() => expect(mockResolveOfflineNfcScan).toHaveBeenCalledWith("school-a", "PUB001"));
    expect(mockScanNfcAttendance).not.toHaveBeenCalled();
    await waitFor(() => expect(mockQueueAttendanceEvent).toHaveBeenCalledWith(expect.objectContaining({
      schoolId: "school-a",
      snapshotId: "attendance-register-1",
      studentId: "student-1",
      direction: "TAP_IN",
      payload: expect.objectContaining({
        actionType: "ATTENDANCE_SCAN",
        tokenOrUidHash: "hash:PUB001",
        direction: "TAP_IN",
      }),
    })));
    expect(mockQueueAttendanceEvent.mock.calls[0]?.[0].payload.tokenOrUid).toBeUndefined();
    expect(mockTriggerSync).toHaveBeenCalled();
    await waitFor(() => expect(screen.getAllByText(/Ada Lovelace/i).length).toBeGreaterThan(0));
    expect(screen.getAllByText(/Punch IN/i).length).toBeGreaterThan(0);
  });

  it("does not queue a duplicate punch inside the cooldown window", async () => {
    mockHasRecentAttendancePunch.mockResolvedValueOnce(true);

    render(
      <MemoryRouter>
        <NfcAttendancePage />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByPlaceholderText(/scan token or uid/i), { target: { value: "PUB001" } });
    fireEvent.click(screen.getByRole("button", { name: "Go" }));

    await waitFor(() => expect(mockHasRecentAttendancePunch).toHaveBeenCalled());
    expect(mockQueueAttendanceEvent).not.toHaveBeenCalled();
    expect(await screen.findByText(/recent duplicate punch/i)).toBeInTheDocument();
  });
});
