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

  it("allows an admin to register a Gate PWA from the offline page", async () => {
    renderOfflinePage();

    await waitFor(() => expect(mockFetchOfflineSyncStatus).toHaveBeenCalled());

    fireEvent.change(screen.getByLabelText(/device name/i), { target: { value: "Main Gate Phone" } });
    fireEvent.change(screen.getByLabelText(/device key \/ local device id/i), { target: { value: "gate-phone-1" } });
    fireEvent.change(screen.getByLabelText(/location name/i), { target: { value: "Main Gate" } });
    fireEvent.click(screen.getByRole("button", { name: /register device/i }));

    await waitFor(() => expect(mockRegisterOfflineDevice).toHaveBeenCalledWith(expect.objectContaining({
      name: "Main Gate Phone",
      deviceKey: "gate-phone-1",
      mode: "GATE",
      roleScope: "GATE_SECURITY",
      locationType: "GATE",
      attendanceMode: "GATE_ATTENDANCE",
      studentScope: "ALL_STUDENTS",
      direction: "ENTRY",
    })));
    expect(await screen.findByText(/device registered/i)).toBeInTheDocument();
    expect(screen.getByText(/sign in on that physical device and refresh the local gate\/canteen register/i)).toBeInTheDocument();
  });

  it("allows an admin to register a Canteen PWA from the offline page", async () => {
    renderOfflinePage();

    fireEvent.change(screen.getByLabelText(/device type/i), { target: { value: "CANTEEN_PWA" } });
    fireEvent.change(screen.getByLabelText(/device name/i), { target: { value: "Canteen Tablet" } });
    fireEvent.change(screen.getByLabelText(/device key \/ local device id/i), { target: { value: "canteen-tab-1" } });
    fireEvent.change(screen.getByLabelText(/location name/i), { target: { value: "Canteen Counter" } });
    fireEvent.click(screen.getByRole("button", { name: /register device/i }));

    await waitFor(() => expect(mockRegisterOfflineDevice).toHaveBeenCalledWith(expect.objectContaining({
      name: "Canteen Tablet",
      deviceKey: "canteen-tab-1",
      mode: "CANTEEN",
      roleScope: "CANTEEN",
      locationName: "Canteen Counter",
    })));
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
