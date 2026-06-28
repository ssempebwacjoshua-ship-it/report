import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { NfcGateSecurityPage } from "../../pages/NfcGateSecurityPage";

const state = vi.hoisted(() => ({
  user: { id: "user-1", schoolId: "school-a", name: "Gate User", role: "GATE_SECURITY" as const },
  token: "school-token",
  loading: false,
  isOfflineReady: false,
  pendingCount: 0,
  dashboard: { recentScans: [] as Array<{ result: string; reason?: string | null; scannedAt: string; student?: { name: string } }> },
}));

const mockFetchGateDashboard = vi.hoisted(() => vi.fn(async () => state.dashboard));
const mockScanGate = vi.hoisted(() => vi.fn(async () => ({
  result: "ALLOWED",
  reason: null,
  scannedAt: "2026-06-21T10:00:00.000Z",
  credentialStatus: "ACTIVE",
  todayAttendanceStatus: "NONE",
})));
const mockFetchAttendanceScan = vi.hoisted(() => vi.fn());

vi.mock("../../contexts/AuthContext", () => ({
  useAuth: () => ({ user: state.user, token: state.token, loading: state.loading }),
}));

vi.mock("../../hooks/useConnectivityStatus", () => ({
  useConnectivityStatus: () => ({
    state: "ONLINE",
    isOfflineReady: state.isOfflineReady,
    pendingCount: state.pendingCount,
  }),
}));

vi.mock("../../hooks/useNfcScanner", () => ({
  useNfcScanner: ({ onScan }: { onScan: (scan: { tokenOrUid: string; idempotencyKey?: string; deviceId?: string }) => void }) => ({
    state: "IDLE",
    error: null,
    isOnline: true,
    isWebNfcAvailable: false,
    startScanner: vi.fn(),
    stopScanner: vi.fn(),
    submitManual: (value: string) => onScan({ tokenOrUid: value, deviceId: "device-1" }),
  }),
}));

vi.mock("../../client/studentCredentialsClient", () => ({
  fetchNfcGateDashboard: mockFetchGateDashboard,
  scanNfcGate: mockScanGate,
  scanAttendance: mockFetchAttendanceScan,
}));

vi.mock("../../offline/offlineResolver", () => ({
  resolveOfflineNfcScan: vi.fn(),
}));

vi.mock("../../offline/offlineStore", () => ({
  queueGateScan: vi.fn(),
  getSnapshotMeta: vi.fn(async () => ({ snapshotId: "snapshot-1" })),
}));

describe("NfcGateSecurityPage", () => {
  beforeEach(() => {
    mockFetchGateDashboard.mockClear();
    mockScanGate.mockClear();
    mockFetchAttendanceScan.mockClear();
    state.isOfflineReady = false;
    state.dashboard = { recentScans: [] };
    state.user = { id: "user-1", schoolId: "school-a", name: "Gate User", role: "GATE_SECURITY" };
    state.token = "school-token";
    state.loading = false;
  });

  it("uses the gate endpoint and does not call attendance scan", async () => {
    render(<NfcGateSecurityPage />);

    await waitFor(() => expect(mockFetchGateDashboard).toHaveBeenCalledTimes(1));

    fireEvent.change(screen.getByPlaceholderText("Scan token or UID…"), { target: { value: "token-a" } });
    fireEvent.click(screen.getByRole("button", { name: "Go" }));

    await waitFor(() => expect(mockScanGate).toHaveBeenCalledWith(expect.objectContaining({ tokenOrUid: "token-a" })));
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
});
