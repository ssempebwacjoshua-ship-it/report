import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PermissionGuard } from "../../components/PermissionGuard";
import { NfcOfflinePage } from "../../pages/NfcOfflinePage";

const authState = vi.hoisted(() => ({
  user: { id: "admin-1", schoolId: "school-a", name: "Admin User", email: "admin@example.com", role: "ADMIN_OPERATOR" as const },
}));

const mockRefreshPendingCount = vi.hoisted(() => vi.fn(async () => undefined));
const mockTriggerSync = vi.hoisted(() => vi.fn(async () => undefined));
const mockFetchOfflineBootstrap = vi.hoisted(() => vi.fn());
const mockFetchOfflineSyncStatus = vi.hoisted(() => vi.fn(async () => ({ batches: [], devices: [] })));
const mockRegisterOfflineDevice = vi.hoisted(() => vi.fn(async (input: { name: string; deviceKey: string; mode: string; roleScope: string }) => ({
  id: `${input.deviceKey}-id`,
  name: input.name,
  deviceKey: input.deviceKey,
  mode: input.mode,
  roleScope: input.roleScope,
  location: null,
  locationType: null,
  locationName: null,
  status: "ACTIVE",
  isActive: true,
  lastSeenAt: null,
})));
const mockUpdateOfflineDeviceConfig = vi.hoisted(() => vi.fn());
const mockFetchAttendanceClasses = vi.hoisted(() => vi.fn(async () => ({ classes: [] })));
const mockSaveBootstrapSnapshot = vi.hoisted(() => vi.fn(async () => undefined));
const mockListAllQueueItems = vi.hoisted(() => vi.fn(async () => []));
const mockClearSyncedItems = vi.hoisted(() => vi.fn(async () => undefined));
const mockGetSnapshotMeta = vi.hoisted(() => vi.fn(async () => null));

vi.mock("../../contexts/AuthContext", () => ({
  useAuth: () => ({
    user: authState.user,
  }),
}));

vi.mock("../../hooks/useConnectivityStatus", () => ({
  useConnectivityStatus: () => ({
    state: "ONLINE",
    pendingCount: 0,
    refreshPendingCount: mockRefreshPendingCount,
    triggerSync: mockTriggerSync,
  }),
}));

vi.mock("../../client/nfcOfflineClient", () => ({
  fetchOfflineBootstrap: mockFetchOfflineBootstrap,
  fetchOfflineSyncStatus: mockFetchOfflineSyncStatus,
  registerOfflineDevice: mockRegisterOfflineDevice,
  updateOfflineDeviceConfig: mockUpdateOfflineDeviceConfig,
}));

vi.mock("../../client/studentCredentialsClient", () => ({
  fetchAttendanceClasses: mockFetchAttendanceClasses,
}));

vi.mock("../../offline/offlineStore", () => ({
  saveBootstrapSnapshot: mockSaveBootstrapSnapshot,
  listAllQueueItems: mockListAllQueueItems,
  clearSyncedItems: mockClearSyncedItems,
  getSnapshotMeta: mockGetSnapshotMeta,
}));

function renderOfflinePage() {
  return render(
    <MemoryRouter>
      <NfcOfflinePage />
    </MemoryRouter>,
  );
}

describe("NfcOfflinePage", () => {
  beforeEach(() => {
    authState.user = { id: "admin-1", schoolId: "school-a", name: "Admin User", email: "admin@example.com", role: "ADMIN_OPERATOR" };
    mockFetchOfflineSyncStatus.mockClear();
    mockRegisterOfflineDevice.mockClear();
    mockFetchAttendanceClasses.mockClear();
    mockListAllQueueItems.mockClear();
    mockGetSnapshotMeta.mockClear();
    vi.stubGlobal("crypto", { randomUUID: vi.fn(() => "device-123") });
    vi.stubGlobal("localStorage", {
      getItem: vi.fn((key: string) => (key === "schoolconnect_nfc_device_id" ? "device-123" : null)),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    });
  });

  it("shows attendance-reader-only registration fields for admins", async () => {
    renderOfflinePage();

    await waitFor(() => expect(mockFetchOfflineSyncStatus).toHaveBeenCalled());

    expect(screen.queryByLabelText(/device type/i)).not.toBeInTheDocument();
    expect(screen.getByText(/register school-managed attendance readers/i)).toBeInTheDocument();
    expect(screen.queryByText(/gate pwa/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/canteen pwa/i)).not.toBeInTheDocument();
  });

  it("allows an admin to register an attendance reader from the offline page", async () => {
    renderOfflinePage();

    fireEvent.change(screen.getByLabelText(/device name/i), { target: { value: "Assembly Hall Reader" } });
    fireEvent.change(screen.getByLabelText(/device key \/ local device id/i), { target: { value: "reader-1" } });
    fireEvent.change(screen.getByLabelText(/location name/i), { target: { value: "Assembly Hall" } });
    fireEvent.click(screen.getByRole("button", { name: /register device/i }));

    await waitFor(() => expect(mockRegisterOfflineDevice).toHaveBeenCalledWith(expect.objectContaining({
      name: "Assembly Hall Reader",
      deviceKey: "reader-1",
      mode: "ATTENDANCE",
      roleScope: "ADMIN_OPERATOR",
      locationName: "Assembly Hall",
      locationType: "GATE",
      attendanceMode: "GATE_ATTENDANCE",
      studentScope: "ALL_STUDENTS",
      direction: "ENTRY",
    })));
    expect(await screen.findByText(/device registered/i)).toBeInTheDocument();
    expect(screen.getByText(/sign in on that physical device and refresh the local attendance reader/i)).toBeInTheDocument();
  });
});

describe("/nfc/offline guard", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    });
  });

  function renderGuard(role: "GATE_SECURITY" | "CANTEEN") {
    authState.user = { id: "user-1", schoolId: "school-a", name: "Scoped User", email: "user@example.com", role };
    return render(
      <MemoryRouter initialEntries={["/nfc/offline"]}>
        <Routes>
          <Route
            path="/nfc/offline"
            element={
              <PermissionGuard permission="nfc.devices.manage">
                <div>Offline admin page</div>
              </PermissionGuard>
            }
          />
          <Route path="/nfc/gate" element={<div>Gate page</div>} />
          <Route path="/nfc/canteen" element={<div>Canteen page</div>} />
        </Routes>
      </MemoryRouter>,
    );
  }

  it("still blocks gate users from /nfc/offline", async () => {
    renderGuard("GATE_SECURITY");
    await waitFor(() => expect(screen.getByText("Gate page")).toBeInTheDocument());
    expect(screen.queryByText("Offline admin page")).not.toBeInTheDocument();
  });

  it("still blocks canteen users from /nfc/offline", async () => {
    renderGuard("CANTEEN");
    await waitFor(() => expect(screen.getByText("Canteen page")).toBeInTheDocument());
    expect(screen.queryByText("Offline admin page")).not.toBeInTheDocument();
  });
});
