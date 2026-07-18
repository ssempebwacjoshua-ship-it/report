import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { NfcGateSecurityPage } from "../../pages/NfcGateSecurityPage";

const state = vi.hoisted(() => ({
  user: { id: "user-1", schoolId: "school-a", name: "Gate User", role: "GATE_SECURITY" as const },
  token: "school-token",
  loading: false,
  isOfflineReady: false,
  connectivityState: "ONLINE",
  pendingCount: 0,
  dashboard: { recentScans: [] as Array<{ result: string; reason?: string | null; scannedAt: string; student?: { name: string } }> },
}));

const mockFetchGateDashboard = vi.hoisted(() => vi.fn(async () => state.dashboard));
const mockFetchVisitors = vi.hoisted(() => vi.fn(async () => ({ visits: [] })));
const mockRegisterVisitor = vi.hoisted(() => vi.fn(async () => ({ visit: { id: "visit-2", status: "CHECKED_IN" } })));
const mockCheckOutVisitor = vi.hoisted(() => vi.fn(async () => ({ visit: { id: "visit-1", status: "CHECKED_OUT" }, duplicate: false })));
const mockScanGate = vi.hoisted(() => vi.fn(async () => ({
  result: "ALLOWED",
  reason: null,
  scannedAt: "2026-06-21T10:00:00.000Z",
  credentialStatus: "ACTIVE",
  todayAttendanceStatus: "NONE",
})));
const mockFetchAttendanceScan = vi.hoisted(() => vi.fn());
const mockResolveOfflineNfcScan = vi.hoisted(() => vi.fn());
const mockQueueGateScan = vi.hoisted(() => vi.fn(async () => undefined));
const mockGetSnapshotMeta = vi.hoisted(() => vi.fn(async () => ({ snapshotId: "snapshot-1" })));
const mockGetGateQueueStatus = vi.hoisted(() => vi.fn(async () => ({
  pending: 0,
  syncing: 0,
  failed: 0,
  conflict: 0,
  lastError: null,
  items: [],
})));
const mockGetSnapshotValidity = vi.hoisted(() => vi.fn(async () => ({ valid: false, reason: "no_snapshot" })));
const mockTriggerSync = vi.hoisted(() => vi.fn(async () => undefined));

function setNavigatorOnline(value: boolean) {
  Object.defineProperty(navigator, "onLine", {
    configurable: true,
    value,
  });
  window.dispatchEvent(new Event(value ? "online" : "offline"));
}

vi.mock("../../contexts/AuthContext", () => ({
  useAuth: () => ({ user: state.user, token: state.token, loading: state.loading }),
}));

vi.mock("../../hooks/useConnectivityStatus", () => ({
  useConnectivityStatus: () => ({
    state: state.connectivityState,
    isOfflineReady: state.isOfflineReady,
    pendingCount: state.pendingCount,
    triggerSync: mockTriggerSync,
  }),
}));

vi.mock("../../hooks/useNfcOfflineSnapshotRefresh", () => ({
  useNfcOfflineSnapshotRefresh: () => ({
    validity: null,
    isRefreshing: false,
    refreshError: "",
    refreshNow: vi.fn(),
  }),
}));

vi.mock("../../client/studentCredentialsClient", () => ({
  fetchNfcGateDashboard: mockFetchGateDashboard,
  fetchNfcVisitors: mockFetchVisitors,
  registerNfcVisitor: mockRegisterVisitor,
  checkOutNfcVisitor: mockCheckOutVisitor,
  scanNfcGate: mockScanGate,
  scanAttendance: mockFetchAttendanceScan,
}));

vi.mock("../../offline/offlineResolver", () => ({
  resolveOfflineNfcScan: mockResolveOfflineNfcScan,
}));

vi.mock("../../offline/offlineStore", () => ({
  queueGateScan: mockQueueGateScan,
  getSnapshotMeta: mockGetSnapshotMeta,
  getGateQueueStatus: mockGetGateQueueStatus,
}));

vi.mock("../../offline/offlineStatus", () => ({
  getSnapshotValidity: mockGetSnapshotValidity,
}));

vi.mock("../../offline/offlineHash", () => ({
  hashNfcLookupValue: vi.fn(async (value: string) => `hash:${value}`),
}));

describe("NfcGateSecurityPage", () => {
  beforeEach(() => {
    mockFetchGateDashboard.mockClear();
    mockScanGate.mockClear();
    mockFetchVisitors.mockReset();
    mockFetchVisitors.mockResolvedValue({ visits: [] });
    mockRegisterVisitor.mockClear();
    mockCheckOutVisitor.mockClear();
    mockFetchAttendanceScan.mockClear();
    mockResolveOfflineNfcScan.mockReset();
    mockQueueGateScan.mockClear();
    mockGetSnapshotMeta.mockClear();
    mockGetGateQueueStatus.mockReset();
    mockGetGateQueueStatus.mockResolvedValue({
      pending: 0,
      syncing: 0,
      failed: 0,
      conflict: 0,
      lastError: null,
      items: [],
    });
    mockGetSnapshotValidity.mockReset();
    mockGetSnapshotValidity.mockResolvedValue({ valid: false, reason: "no_snapshot" });
    mockTriggerSync.mockClear();
    state.isOfflineReady = false;
    state.connectivityState = "ONLINE";
    state.dashboard = { recentScans: [] };
    state.user = { id: "user-1", schoolId: "school-a", name: "Gate User", role: "GATE_SECURITY" };
    state.token = "school-token";
    state.loading = false;
    setNavigatorOnline(true);
  });

  it("uses the gate endpoint and does not call attendance scan", async () => {
    render(<NfcGateSecurityPage />);

    await waitFor(() => expect(mockFetchGateDashboard).toHaveBeenCalledTimes(1));

    fireEvent.change(screen.getByPlaceholderText("Scan token or UID…"), { target: { value: "token-a" } });
    fireEvent.click(screen.getByRole("button", { name: "Go" }));

    await waitFor(() => expect(mockScanGate).toHaveBeenCalledWith(expect.objectContaining({ tokenOrUid: "token-a" })));
    expect(mockFetchAttendanceScan).not.toHaveBeenCalled();
  });

  it("uses the Local Gate Register first even when the phone is online", async () => {
    setNavigatorOnline(true);
    mockGetSnapshotValidity.mockResolvedValue({ valid: true, meta: { snapshotId: "snapshot-1" } });
    mockResolveOfflineNfcScan.mockResolvedValueOnce({
      found: true,
      blocked: false,
      reason: null,
      student: {
        id: "student-1",
        firstName: "Ada",
        lastName: "Lovelace",
        admissionNumber: "A-001",
        className: "S1",
        streamName: "A",
      },
      tag: { id: "tag-1", publicCode: "tag-1", physicalUid: "uid-1" },
    });

    render(<NfcGateSecurityPage />);

    fireEvent.change(screen.getByPlaceholderText(/scan token or uid/i), { target: { value: "token-a" } });
    fireEvent.click(screen.getByRole("button", { name: "Go" }));

    await waitFor(() => expect(mockResolveOfflineNfcScan).toHaveBeenCalledWith("school-a", "token-a"));
    await waitFor(() => expect(mockQueueGateScan).toHaveBeenCalledWith(expect.objectContaining({
      schoolId: "school-a",
      payload: expect.objectContaining({
        actionType: "GATE_SCAN",
        tokenOrUidHash: "hash:token-a",
        result: "ALLOWED",
      }),
    })));
    expect(mockQueueGateScan.mock.calls[0]?.[0].payload.tokenOrUid).toBeUndefined();
    expect(mockScanGate).not.toHaveBeenCalled();
    expect(await screen.findByText(/syncing in background/i)).toBeInTheDocument();
    await waitFor(() => expect(mockTriggerSync).toHaveBeenCalled());
  });

  it("keeps server-backed gate scan as online fallback when no Local Gate Register exists", async () => {
    mockGetSnapshotValidity.mockResolvedValue({ valid: false, reason: "no_snapshot" });

    render(<NfcGateSecurityPage />);

    fireEvent.change(screen.getByPlaceholderText(/scan token or uid/i), { target: { value: "token-a" } });
    fireEvent.click(screen.getByRole("button", { name: "Go" }));

    await waitFor(() => expect(mockScanGate).toHaveBeenCalledWith(expect.objectContaining({ tokenOrUid: "token-a" })));
    expect(mockResolveOfflineNfcScan).not.toHaveBeenCalled();
    expect(mockFetchAttendanceScan).not.toHaveBeenCalled();
  });

  it("keeps the gate page free of attendance scan endpoints", () => {
    const fs = require("fs") as typeof import("fs");
    const path = require("path") as typeof import("path");
    const pageSource = fs.readFileSync(path.join(process.cwd(), "src/pages/NfcGateSecurityPage.tsx"), "utf-8");

    expect(pageSource).toContain("fetchNfcGateDashboard");
    expect(pageSource).toContain("scanNfcGate");
    expect(pageSource).not.toContain("/api/nfc/attendance/scan");
    expect(pageSource).not.toContain("scanAttendance");
  });

  it("shows a sign-in prompt and skips the gate request when the token is missing", async () => {
    state.token = null;

    render(<NfcGateSecurityPage />);

    await waitFor(() => expect(screen.getByText(/please sign in again to continue using gate security/i)).toBeInTheDocument());
    expect(mockFetchGateDashboard).not.toHaveBeenCalled();
  });

  it("does not ask the user to sign in again for a gate permission denial", async () => {
    mockFetchGateDashboard.mockRejectedValueOnce(new Error("You do not have access to this resource."));

    render(<NfcGateSecurityPage />);

    await waitFor(() => expect(screen.getByText(/gate access is blocked for this account/i)).toBeInTheDocument());
    expect(screen.queryByText(/^please sign in again\.$/i)).not.toBeInTheDocument();
  });

  it("queues an offline-ready gate scan locally instead of calling the backend", async () => {
    state.isOfflineReady = true;
    state.connectivityState = "OFFLINE_READY";
    setNavigatorOnline(false);
    mockGetSnapshotValidity.mockResolvedValue({ valid: true, meta: { snapshotId: "snapshot-1" } });
    mockResolveOfflineNfcScan.mockResolvedValueOnce({
      found: true,
      blocked: false,
      reason: null,
      student: {
        id: "student-1",
        firstName: "Ada",
        lastName: "Lovelace",
        admissionNumber: "A-001",
        className: "S1",
        streamName: "A",
      },
      tag: { id: "tag-1", publicCode: "tag-1", physicalUid: "uid-1" },
    });

    render(<NfcGateSecurityPage />);

    fireEvent.change(screen.getByPlaceholderText(/scan token or uid/i), { target: { value: "offline-token" } });
    fireEvent.click(screen.getByRole("button", { name: "Go" }));

    await waitFor(() => expect(mockQueueGateScan).toHaveBeenCalledWith(expect.objectContaining({
      schoolId: "school-a",
      payload: expect.objectContaining({ tokenOrUidHash: "hash:offline-token", result: "ALLOWED" }),
    })));
    expect(mockQueueGateScan.mock.calls[0]?.[0].payload.tokenOrUid).toBeUndefined();
    expect(mockScanGate).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.getAllByText("ALLOWED").length).toBeGreaterThan(0));
    expect(screen.getAllByText(/pending/i).length).toBeGreaterThan(0);
  });

  it("shows gate queue status and retries failed gate sync without blocking scanning", async () => {
    mockGetSnapshotValidity.mockResolvedValue({ valid: true, meta: { snapshotId: "snapshot-1" } });
    mockGetGateQueueStatus.mockResolvedValue({
      pending: 1,
      syncing: 0,
      failed: 1,
      conflict: 0,
      lastError: "Network timeout",
      items: [],
    });
    mockResolveOfflineNfcScan.mockResolvedValueOnce({
      found: true,
      blocked: true,
      reason: "inactive student",
      student: {
        id: "student-1",
        firstName: "Ada",
        lastName: "Lovelace",
        admissionNumber: "A-001",
        className: "S1",
        streamName: "A",
      },
      tag: { id: "tag-1", publicCode: "tag-1", physicalUid: "uid-1" },
    });

    render(<NfcGateSecurityPage />);

    expect(await screen.findByText(/network timeout/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /retry sync/i }));
    await waitFor(() => expect(mockTriggerSync).toHaveBeenCalled());

    fireEvent.change(screen.getByPlaceholderText(/scan token or uid/i), { target: { value: "token-a" } });
    fireEvent.click(screen.getByRole("button", { name: "Go" }));

    await waitFor(() => expect(mockQueueGateScan).toHaveBeenCalled());
    expect(await screen.findByText("BLOCKED")).toBeInTheDocument();
    expect(screen.getByText(/inactive student/i)).toBeInTheDocument();
  });

  it("shows a local fee-hold block reason from the Local Gate Register", async () => {
    mockGetSnapshotValidity.mockResolvedValue({ valid: true, meta: { snapshotId: "snapshot-1" } });
    mockResolveOfflineNfcScan.mockResolvedValueOnce({
      found: true,
      blocked: true,
      reason: "school fees defaulter",
      student: {
        id: "student-1",
        firstName: "Ada",
        lastName: "Lovelace",
        admissionNumber: "A-001",
        className: "S1",
        streamName: "A",
      },
      tag: { id: "tag-1", publicCode: "tag-1", physicalUid: "uid-1" },
    });

    render(<NfcGateSecurityPage />);

    fireEvent.change(screen.getByPlaceholderText(/scan token or uid/i), { target: { value: "token-a" } });
    fireEvent.click(screen.getByRole("button", { name: "Go" }));

    await waitFor(() => expect(mockScanGate).not.toHaveBeenCalled());
    expect(await screen.findByText("BLOCKED")).toBeInTheDocument();
    expect(screen.getByText(/school fees defaulter/i)).toBeInTheDocument();
  });

  it("shows offline setup guidance when offline without a ready snapshot", async () => {
    state.connectivityState = "OFFLINE_NOT_READY";
    setNavigatorOnline(false);

    render(<NfcGateSecurityPage />);

    fireEvent.change(screen.getByPlaceholderText(/scan token or uid/i), { target: { value: "offline-token" } });
    fireEvent.click(screen.getByRole("button", { name: "Go" }));

    await waitFor(() => expect(screen.getByText(/local gate register is not downloaded yet/i)).toBeInTheDocument());
    expect(mockScanGate).not.toHaveBeenCalled();
    expect(mockResolveOfflineNfcScan).not.toHaveBeenCalled();
  });

  it("shows pass-out details from the gate scan response", async () => {
    mockScanGate.mockResolvedValueOnce({
      result: "ALLOWED",
      reason: null,
      scannedAt: "2026-07-18T10:00:00.000Z",
      credentialStatus: "ACTIVE",
      todayAttendanceStatus: "NONE",
      student: {
        id: "student-1",
        name: "Ada Lovelace",
        admissionNumber: "A-001",
        className: "S1",
        streamName: "A",
      },
      passOut: {
        id: "passout-1",
        status: "CHECKED_OUT",
        activeFrom: "2026-07-18T08:00:00.000Z",
        activeUntil: "2026-07-18T18:00:00.000Z",
        checkedOutAt: "2026-07-18T09:00:00.000Z",
        checkedInAt: null,
      },
    });

    render(<NfcGateSecurityPage />);

    fireEvent.change(screen.getByPlaceholderText(/scan token or uid/i), { target: { value: "token-a" } });
    fireEvent.click(screen.getByRole("button", { name: "Go" }));

    expect(await screen.findByText(/pass-out: checked out/i)).toBeInTheDocument();
    expect(screen.getByText(/window:/i)).toBeInTheDocument();
  });

  it("registers a visitor and refreshes the visitor register", async () => {
    render(<NfcGateSecurityPage />);

    await waitFor(() => expect(mockFetchVisitors).toHaveBeenCalledTimes(1));

    fireEvent.change(screen.getByLabelText(/visitor name/i), { target: { value: "Grace Hopper" } });
    fireEvent.change(screen.getByLabelText(/phone number/i), { target: { value: "256700000001" } });
    fireEvent.change(screen.getByLabelText(/id\/passport type/i), { target: { value: "National ID" } });
    fireEvent.change(screen.getByLabelText(/id\/passport number/i), { target: { value: "CF1234" } });
    fireEvent.change(screen.getByLabelText(/^purpose$/i), { target: { value: "Meeting" } });
    fireEvent.change(screen.getByLabelText(/host or person visiting/i), { target: { value: "Head Teacher" } });

    const idFile = new File(["id-image"], "id.png", { type: "image/png" });
    const selfieFile = new File(["selfie-image"], "selfie.png", { type: "image/png" });
    fireEvent.change(screen.getByLabelText(/id\/passport image/i), { target: { files: [idFile] } });
    fireEvent.change(screen.getByLabelText(/selfie image/i), { target: { files: [selfieFile] } });
    fireEvent.click(screen.getByRole("button", { name: /check in visitor/i }));

    await waitFor(() => expect(mockRegisterVisitor).toHaveBeenCalledWith(expect.objectContaining({
      fullName: "Grace Hopper",
      idDocumentImage: idFile,
      selfieImage: selfieFile,
    })));
    expect(await screen.findByText(/visitor checked in and added to the gate register/i)).toBeInTheDocument();
    expect(mockFetchVisitors).toHaveBeenCalledTimes(2);
  });

  it("checks out a current visitor from the register", async () => {
    mockFetchVisitors.mockResolvedValue({
      visits: [
        {
          id: "visit-1",
          status: "CHECKED_IN",
          purpose: "Delivery",
          hostName: "Bursar",
          checkedInAt: "2026-07-18T08:30:00.000Z",
          checkedOutAt: null,
          idDocumentImageUrl: null,
          selfieImageUrl: null,
          createdAt: "2026-07-18T08:30:00.000Z",
          updatedAt: "2026-07-18T08:30:00.000Z",
          visitor: {
            id: "visitor-1",
            fullName: "Mary Nakiwala",
            phone: null,
            idDocumentType: "Passport",
            idDocumentNumber: "P12345",
          },
        },
      ],
    });

    render(<NfcGateSecurityPage />);

    expect(await screen.findByText(/mary nakiwala/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /check out/i }));

    await waitFor(() => expect(mockCheckOutVisitor).toHaveBeenCalledWith("visit-1"));
  });
});
