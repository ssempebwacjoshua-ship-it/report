import { MemoryRouter } from "react-router-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NfcCanteenChargePage } from "../../pages/NfcCanteenChargePage";

const state = vi.hoisted(() => ({
  user: { id: "cashier-1", schoolId: "school-a", name: "Canteen User", role: "CANTEEN" as const },
  isOfflineReady: false,
  pendingCount: 0,
}));

const mockResolveWalletStudent = vi.hoisted(() => vi.fn());
const mockChargeNfcCanteen = vi.hoisted(() => vi.fn());
const mockResolveOfflineNfcScan = vi.hoisted(() => vi.fn());
const mockQueueCanteenCharge = vi.hoisted(() => vi.fn(async () => undefined));
const mockGetSnapshotMeta = vi.hoisted(() => vi.fn(async () => ({
  snapshotId: "register-1",
  settings: {
    maxOfflineSpendPerStudentPerDay: 10000,
    maxOfflineSpendPerTransaction: 5000,
    maxOfflineSpendPerDeviceSession: 50000,
  },
})));
const mockGetAvailableOfflineBalance = vi.hoisted(() => vi.fn(async () => ({
  availableCents: 5000,
  studentSpentCents: 0,
  deviceSpentCents: 0,
})));
const mockGetSnapshotValidity = vi.hoisted(() => vi.fn(async () => ({ valid: true })));
const mockIsCanteenOfflineEnabled = vi.hoisted(() => vi.fn(async () => true));

function setNavigatorOnline(value: boolean) {
  Object.defineProperty(navigator, "onLine", {
    configurable: true,
    value,
  });
  window.dispatchEvent(new Event(value ? "online" : "offline"));
}

vi.mock("../../contexts/AuthContext", () => ({
  useAuth: () => ({ user: state.user }),
}));

vi.mock("../../hooks/useConnectivityStatus", () => ({
  useConnectivityStatus: () => ({
    isOfflineReady: state.isOfflineReady,
    pendingCount: state.pendingCount,
  }),
}));

vi.mock("../../hooks/useNfcOfflineSnapshotRefresh", () => ({
  useNfcOfflineSnapshotRefresh: () => ({
    validity: null,
    isRefreshing: false,
    refreshError: "",
  }),
}));

vi.mock("../../client/studentCredentialsClient", () => ({
  resolveWalletStudent: mockResolveWalletStudent,
  chargeNfcCanteen: mockChargeNfcCanteen,
}));

vi.mock("../../offline/offlineResolver", () => ({
  resolveOfflineNfcScan: mockResolveOfflineNfcScan,
}));

vi.mock("../../offline/offlineStore", () => ({
  queueCanteenCharge: mockQueueCanteenCharge,
  getSnapshotMeta: mockGetSnapshotMeta,
  getAvailableOfflineBalance: mockGetAvailableOfflineBalance,
}));

vi.mock("../../offline/offlineStatus", () => ({
  getSnapshotValidity: mockGetSnapshotValidity,
  isCanteenOfflineEnabled: mockIsCanteenOfflineEnabled,
}));

vi.mock("../../offline/offlineHash", () => ({
  hashNfcLookupValue: vi.fn(async (value: string) => `hash:${value}`),
}));

describe("NfcCanteenChargePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.isOfflineReady = false;
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
      },
      tag: { id: "tag-1" },
      wallet: {
        id: "wallet-1",
        status: "ACTIVE",
        balanceCents: 5000,
        localStartingBalanceCents: 5000,
        localCurrentBalanceCents: 5000,
      },
    });
  });

  it("uses the Local Canteen Register when the phone is offline even before connectivity state is OFFLINE_READY", async () => {
    setNavigatorOnline(false);

    render(
      <MemoryRouter>
        <NfcCanteenChargePage />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText(/amount/i), { target: { value: "20" } });
    fireEvent.change(screen.getByPlaceholderText(/scan token or uid/i), { target: { value: "PUB001" } });
    fireEvent.click(screen.getByRole("button", { name: "Go" }));

    await waitFor(() => expect(mockResolveOfflineNfcScan).toHaveBeenCalledWith("school-a", "PUB001"));
    expect(mockResolveWalletStudent).not.toHaveBeenCalled();
    expect(await screen.findByText(/local canteen register - student identified/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /queue sale/i }));

    await waitFor(() => expect(mockQueueCanteenCharge).toHaveBeenCalledWith(expect.objectContaining({
      schoolId: "school-a",
      snapshotId: "register-1",
      studentId: "student-1",
      walletId: "wallet-1",
      payload: expect.objectContaining({
        actionType: "CANTEEN_CHARGE",
        amountCents: 2000,
        tokenOrUidHash: "hash:PUB001",
      }),
    })));
    expect(mockQueueCanteenCharge.mock.calls[0]?.[0].payload.tokenOrUid).toBeUndefined();
    expect(await screen.findByText(/local balance updated/i)).toBeInTheDocument();
  });
});
