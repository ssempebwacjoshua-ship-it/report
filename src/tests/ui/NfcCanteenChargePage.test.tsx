import { MemoryRouter } from "react-router-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NfcCanteenChargePage } from "../../pages/NfcCanteenChargePage";

const state = vi.hoisted(() => ({
  user: { id: "cashier-1", schoolId: "school-a", name: "Canteen User", role: "CANTEEN" as const },
  isOfflineReady: false,
  pendingCount: 0,
  snapshotValidity: null as null | { valid: boolean },
  snapshotRefreshError: "",
}));
const mockTriggerSync = vi.hoisted(() => vi.fn(async () => undefined));

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
const mockGetCanteenQueueStatus = vi.hoisted(() => vi.fn(async () => ({
  pending: 0,
  syncing: 0,
  failed: 0,
  conflict: 0,
  lastError: null,
  items: [],
})));
const mockRetryFailedCanteenSales = vi.hoisted(() => vi.fn(async () => 0));
const mockGetSnapshotValidity = vi.hoisted(() => vi.fn(async () => ({ valid: false, reason: "expired" })));
const mockGetCanteenRegisterStatus = vi.hoisted(() => vi.fn(async () => ({
  available: true,
  canSellOffline: true,
  updateRecommended: true,
  message: "Local Canteen Register is available. Update recommended when online.",
})));
const mockVerifyLocalWalletPin = vi.hoisted(() => vi.fn(async () => true));

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
    triggerSync: mockTriggerSync,
  }),
}));

vi.mock("../../hooks/useNfcOfflineSnapshotRefresh", () => ({
  useNfcOfflineSnapshotRefresh: () => ({
    validity: state.snapshotValidity,
    isRefreshing: false,
    refreshError: state.snapshotRefreshError,
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
  getCanteenQueueStatus: mockGetCanteenQueueStatus,
  retryFailedCanteenSales: mockRetryFailedCanteenSales,
}));

vi.mock("../../offline/offlineStatus", () => ({
  getSnapshotValidity: mockGetSnapshotValidity,
  getCanteenRegisterStatus: mockGetCanteenRegisterStatus,
}));

vi.mock("../../offline/offlineHash", () => ({
  hashNfcLookupValue: vi.fn(async (value: string) => `hash:${value}`),
}));

vi.mock("../../offline/offlinePin", () => ({
  assertLocalPinFormat: vi.fn((pin: string) => {
    if (!/^\d{4,6}$/.test(pin)) throw new Error("PIN must be 4 to 6 digits.");
  }),
  verifyLocalWalletPin: mockVerifyLocalWalletPin,
}));

describe("NfcCanteenChargePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.isOfflineReady = false;
    state.snapshotValidity = null;
    state.snapshotRefreshError = "";
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
        pinHash: "pbkdf2$100000$salt$hash",
        pinLockedUntil: null,
      },
    });
  });

  it("keeps the canteen operator page compact for dedicated PWA use", () => {
    const fs = require("fs") as typeof import("fs");
    const path = require("path") as typeof import("path");
    const pageSource = fs.readFileSync(path.join(process.cwd(), "src/pages/NfcCanteenChargePage.tsx"), "utf-8");

    expect(pageSource).toContain("min-[560px]:grid-cols");
    expect(pageSource).toContain("pb-28");
    expect(pageSource).toContain("id=\"canteen-charge\"");
    expect(pageSource).toContain("id=\"canteen-result\"");
  });

  it("uses the Local Canteen Register first even when the phone is online", async () => {
    setNavigatorOnline(true);
    state.isOfflineReady = false;

    render(
      <MemoryRouter>
        <NfcCanteenChargePage />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText(/amount/i), { target: { value: "20" } });
    fireEvent.change(screen.getByPlaceholderText(/scan token or uid/i), { target: { value: "PUB001" } });
    fireEvent.click(screen.getByRole("button", { name: "Go" }));

    await waitFor(() => expect(mockGetCanteenRegisterStatus).toHaveBeenCalledWith({ schoolId: "school-a", deviceId: expect.any(String) }));
    await waitFor(() => expect(mockResolveOfflineNfcScan).toHaveBeenCalledWith("school-a", "PUB001"));
    expect(mockResolveWalletStudent).not.toHaveBeenCalled();
    expect(mockChargeNfcCanteen).not.toHaveBeenCalled();

    fireEvent.change(screen.getByPlaceholderText(/pin/i), { target: { value: "1234" } });
    fireEvent.click(screen.getByRole("button", { name: /queue sale/i }));

    await waitFor(() => expect(mockQueueCanteenCharge).toHaveBeenCalled());
    expect(mockChargeNfcCanteen).not.toHaveBeenCalled();
    expect(await screen.findByText(/local balance updated/i)).toBeInTheDocument();
    expect(await screen.findByText(/syncing in background/i)).toBeInTheDocument();
    await waitFor(() => expect(mockTriggerSync).toHaveBeenCalled());
  });

  it("shows local charge success before background sync finishes", async () => {
    setNavigatorOnline(true);
    mockTriggerSync.mockImplementationOnce(() => new Promise(() => undefined));

    render(
      <MemoryRouter>
        <NfcCanteenChargePage />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText(/amount/i), { target: { value: "20" } });
    fireEvent.change(screen.getByPlaceholderText(/scan token or uid/i), { target: { value: "PUB001" } });
    fireEvent.click(screen.getByRole("button", { name: "Go" }));

    await screen.findByText(/local canteen register - student identified/i);
    fireEvent.change(screen.getByPlaceholderText(/pin/i), { target: { value: "1234" } });
    fireEvent.click(screen.getByRole("button", { name: /queue sale/i }));

    expect(await screen.findByText(/local balance updated/i)).toBeInTheDocument();
    expect(screen.getByText(/local remaining balance: ugx 30/i)).toBeInTheDocument();
    expect(mockTriggerSync).toHaveBeenCalled();
  });

  it("falls back to the online server charge path only when no local register is usable", async () => {
    setNavigatorOnline(true);
    mockGetCanteenRegisterStatus.mockResolvedValueOnce({
      available: false,
      canSellOffline: false,
      updateRecommended: true,
      updateBlockedReason: "no_register",
      message: "Local Canteen Register is not downloaded yet. Go online to update register.",
    });
    mockResolveWalletStudent.mockResolvedValueOnce({
      student: { name: "Ada Lovelace", admissionNumber: "A001", className: "P4" },
      wallet: { balanceCents: 5000, status: "ACTIVE", pinSet: true },
    });

    render(
      <MemoryRouter>
        <NfcCanteenChargePage />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText(/amount/i), { target: { value: "20" } });
    fireEvent.change(screen.getByPlaceholderText(/scan token or uid/i), { target: { value: "PUB001" } });
    fireEvent.click(screen.getByRole("button", { name: "Go" }));

    await waitFor(() => expect(mockResolveWalletStudent).toHaveBeenCalledWith({ tokenOrUid: "PUB001" }));
    expect(mockResolveOfflineNfcScan).not.toHaveBeenCalled();
    expect(await screen.findByText(/student identified/i)).toBeInTheDocument();
  });

  it("allows a new local charge while failed or conflict canteen sales exist", async () => {
    setNavigatorOnline(true);
    state.snapshotValidity = { valid: true };
    state.snapshotRefreshError = "Register update waits for reconciliation.";
    mockGetCanteenQueueStatus.mockResolvedValue({
      pending: 0,
      syncing: 0,
      failed: 1,
      conflict: 1,
      lastError: "Previous test sale needs review",
      items: [],
    });

    render(
      <MemoryRouter>
        <NfcCanteenChargePage />
      </MemoryRouter>,
    );

    expect(await screen.findByText(/previous test sale needs review/i)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/amount/i), { target: { value: "20" } });
    fireEvent.change(screen.getByPlaceholderText(/scan token or uid/i), { target: { value: "PUB001" } });
    fireEvent.click(screen.getByRole("button", { name: "Go" }));

    await screen.findByText(/local canteen register - student identified/i);
    fireEvent.change(screen.getByPlaceholderText(/pin/i), { target: { value: "1234" } });
    fireEvent.click(screen.getByRole("button", { name: /queue sale/i }));

    await waitFor(() => expect(mockQueueCanteenCharge).toHaveBeenCalled());
    expect(await screen.findByText(/local balance updated/i)).toBeInTheDocument();
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
    expect(mockGetCanteenRegisterStatus).toHaveBeenCalledWith({ schoolId: "school-a", deviceId: expect.any(String) });
    expect(mockGetSnapshotValidity).not.toHaveBeenCalled();
    expect(mockResolveWalletStudent).not.toHaveBeenCalled();
    expect(await screen.findByText(/local canteen register - student identified/i)).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText(/pin/i), { target: { value: "1234" } });
    fireEvent.click(screen.getByRole("button", { name: /queue sale/i }));

    await waitFor(() => expect(mockVerifyLocalWalletPin).toHaveBeenCalledWith("1234", "pbkdf2$100000$salt$hash"));
    await waitFor(() => expect(mockQueueCanteenCharge).toHaveBeenCalledWith(expect.objectContaining({
      schoolId: "school-a",
      snapshotId: "register-1",
      studentId: "student-1",
      walletId: "wallet-1",
      payload: expect.objectContaining({
        actionType: "CANTEEN_CHARGE",
        amountCents: 2000,
        cashierUserId: "cashier-1",
        tokenOrUidHash: "hash:PUB001",
        pinVerified: true,
      }),
    })));
    expect(mockQueueCanteenCharge.mock.calls[0]?.[0].payload.tokenOrUid).toBeUndefined();
    expect(await screen.findByText(/local balance updated/i)).toBeInTheDocument();
  });

  it("does not deduct or queue when the offline PIN is wrong", async () => {
    setNavigatorOnline(false);
    mockVerifyLocalWalletPin.mockResolvedValueOnce(false);

    render(
      <MemoryRouter>
        <NfcCanteenChargePage />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText(/amount/i), { target: { value: "20" } });
    fireEvent.change(screen.getByPlaceholderText(/scan token or uid/i), { target: { value: "PUB001" } });
    fireEvent.click(screen.getByRole("button", { name: "Go" }));

    await screen.findByText(/local canteen register - student identified/i);
    fireEvent.change(screen.getByPlaceholderText(/pin/i), { target: { value: "9999" } });
    fireEvent.click(screen.getByRole("button", { name: /queue sale/i }));

    await waitFor(() => expect(screen.getByText(/incorrect pin/i)).toBeInTheDocument());
    expect(mockQueueCanteenCharge).not.toHaveBeenCalled();
  });

  it("keeps scanner usable when canteen register refresh failed but an existing register is valid", async () => {
    setNavigatorOnline(false);
    state.snapshotValidity = { valid: true };
    state.snapshotRefreshError = "Pending canteen sales must sync before register update.";

    render(
      <MemoryRouter>
        <NfcCanteenChargePage />
      </MemoryRouter>,
    );

    expect(screen.getByText(/local canteen register is available/i)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/amount/i), { target: { value: "20" } });
    fireEvent.change(screen.getByPlaceholderText(/scan token or uid/i), { target: { value: "PUB001" } });
    fireEvent.click(screen.getByRole("button", { name: "Go" }));

    await waitFor(() => expect(mockResolveOfflineNfcScan).toHaveBeenCalledWith("school-a", "PUB001"));
    expect(await screen.findByText(/local canteen register - student identified/i)).toBeInTheDocument();
  });

  it("shows exact canteen queue status and retry result when register update is blocked", async () => {
    state.snapshotValidity = { valid: true };
    state.snapshotRefreshError = "Local Canteen Register is available. Some sales need sync/reconciliation before register update.";
    mockGetCanteenQueueStatus
      .mockResolvedValueOnce({
        pending: 1,
        syncing: 0,
        failed: 1,
        conflict: 1,
        lastError: "Wallet not found",
        items: [],
      })
      .mockResolvedValueOnce({
        pending: 1,
        syncing: 0,
        failed: 1,
        conflict: 1,
        lastError: "Wallet not found",
        items: [],
      })
      .mockResolvedValueOnce({
        pending: 0,
        syncing: 0,
        failed: 0,
        conflict: 0,
        lastError: null,
        items: [],
      });

    render(
      <MemoryRouter>
        <NfcCanteenChargePage />
      </MemoryRouter>,
    );

    expect(await screen.findByText(/pending sales:/i)).toBeInTheDocument();
    expect(screen.getByText(/wallet not found/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /retry sync/i }));

    await waitFor(() => expect(mockRetryFailedCanteenSales).toHaveBeenCalledWith("school-a"));
    await waitFor(() => expect(mockTriggerSync).toHaveBeenCalled());
    expect(await screen.findByText(/canteen sales synced/i)).toBeInTheDocument();
  });

  it("blocks local canteen sale clearly when no register exists", async () => {
    setNavigatorOnline(false);
    mockGetCanteenRegisterStatus.mockResolvedValueOnce({
      available: false,
      canSellOffline: false,
      updateRecommended: true,
      updateBlockedReason: "no_register",
      message: "Local Canteen Register is not downloaded yet. Go online to update register.",
    });

    render(
      <MemoryRouter>
        <NfcCanteenChargePage />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText(/amount/i), { target: { value: "20" } });
    fireEvent.change(screen.getByPlaceholderText(/scan token or uid/i), { target: { value: "PUB001" } });
    fireEvent.click(screen.getByRole("button", { name: "Go" }));

    expect(await screen.findByText(/local canteen register is not downloaded yet/i)).toBeInTheDocument();
    expect(mockResolveOfflineNfcScan).not.toHaveBeenCalled();
  });
});
