import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  fetchOfflineBootstrap: vi.fn(),
  saveBootstrapSnapshot: vi.fn(),
  getCanteenSaleSyncSummary: vi.fn(),
  getCanteenRegisterStatus: vi.fn(),
  getSnapshotValidity: vi.fn(),
}));

vi.mock("../../client/nfcOfflineClient", () => ({
  fetchOfflineBootstrap: mocks.fetchOfflineBootstrap,
}));

vi.mock("../../offline/offlineStore", () => ({
  saveBootstrapSnapshot: mocks.saveBootstrapSnapshot,
  getCanteenSaleSyncSummary: mocks.getCanteenSaleSyncSummary,
}));

vi.mock("../../offline/offlineStatus", () => ({
  getSnapshotValidity: mocks.getSnapshotValidity,
  getCanteenRegisterStatus: mocks.getCanteenRegisterStatus,
}));

function online(value: boolean) {
  Object.defineProperty(navigator, "onLine", { configurable: true, value });
}

const validSnapshot = {
  valid: true,
  meta: {
    snapshotId: "snapshot-1",
    snapshotVersion: "snapshot-1",
    schoolId: "school-a",
    deviceId: "device-a",
    mode: "GATE",
    generatedAt: "2026-06-28T09:00:00.000Z",
    expiresAt: "2099-06-28T09:00:00.000Z",
    modules: ["gate"],
    settings: { gateOfflineEnabled: true, canteenOfflineEnabled: false },
  },
  diagnostics: {
    snapshotExists: true,
    expired: false,
    studentCount: 1,
    tagCount: 1,
    walletCount: 0,
  },
};

describe("useNfcOfflineSnapshotRefresh", () => {
  beforeEach(() => {
    vi.useRealTimers();
    vi.resetAllMocks();
    online(true);
    mocks.fetchOfflineBootstrap.mockResolvedValue({ snapshotId: "snapshot-2" });
    mocks.saveBootstrapSnapshot.mockResolvedValue(undefined);
    mocks.getCanteenSaleSyncSummary.mockResolvedValue({ pending: 0, syncing: 0, failed: 0, conflict: 0 });
    mocks.getCanteenRegisterStatus.mockResolvedValue({
      available: true,
      canSellOffline: true,
      updateRecommended: true,
      message: "Local Canteen Register is available. Update recommended when online.",
    });
    vi.spyOn(console, "info").mockImplementation(() => undefined);
  });

  it("refreshes on page load when the mode-specific snapshot is missing", async () => {
    mocks.getSnapshotValidity
      .mockResolvedValueOnce({ valid: false, reason: "no_snapshot", diagnostics: { snapshotExists: false, expired: false, studentCount: 0, tagCount: 0, walletCount: 0 } })
      .mockResolvedValueOnce(validSnapshot);

    const { useNfcOfflineSnapshotRefresh } = await import("../../hooks/useNfcOfflineSnapshotRefresh");
    renderHook(() => useNfcOfflineSnapshotRefresh({ schoolId: "school-a", deviceId: "device-a", mode: "GATE", requiredModule: "gate" }));

    await waitFor(() => expect(mocks.fetchOfflineBootstrap).toHaveBeenCalledWith(["gate"], "device-a", "GATE"));
    expect(mocks.saveBootstrapSnapshot).toHaveBeenCalledWith({ snapshotId: "snapshot-2" });
  });

  it("refreshes when the current snapshot expires within thirty minutes", async () => {
    mocks.getSnapshotValidity
      .mockResolvedValueOnce({
        ...validSnapshot,
        meta: { ...validSnapshot.meta, expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString() },
      })
      .mockResolvedValueOnce(validSnapshot);

    const { useNfcOfflineSnapshotRefresh } = await import("../../hooks/useNfcOfflineSnapshotRefresh");
    renderHook(() => useNfcOfflineSnapshotRefresh({ schoolId: "school-a", deviceId: "device-a", mode: "GATE", requiredModule: "gate" }));

    await waitFor(() => expect(mocks.fetchOfflineBootstrap).toHaveBeenCalledTimes(1));
  });

  it("keeps the last valid snapshot usable if refresh fails", async () => {
    mocks.fetchOfflineBootstrap.mockRejectedValueOnce(new Error("network down"));
    mocks.getSnapshotValidity.mockResolvedValue(validSnapshot);

    const { useNfcOfflineSnapshotRefresh } = await import("../../hooks/useNfcOfflineSnapshotRefresh");
    const { result } = renderHook(() => useNfcOfflineSnapshotRefresh({ schoolId: "school-a", deviceId: "device-a", mode: "GATE", requiredModule: "gate" }));

    await waitFor(() => expect(result.current.validity?.valid).toBe(true));
    await act(async () => {
      await result.current.refreshNow("test");
    });

    expect(result.current.validity?.valid).toBe(true);
    expect(result.current.refreshError).toBe("network down");
  });

  it("refreshes every fifteen minutes while online", async () => {
    vi.useFakeTimers();
    mocks.getSnapshotValidity.mockResolvedValue(validSnapshot);

    const { useNfcOfflineSnapshotRefresh } = await import("../../hooks/useNfcOfflineSnapshotRefresh");
    renderHook(() => useNfcOfflineSnapshotRefresh({ schoolId: "school-a", deviceId: "device-a", mode: "GATE", requiredModule: "gate" }));

    await act(async () => {
      await Promise.resolve();
    });
    expect(mocks.fetchOfflineBootstrap).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(15 * 60 * 1000);
      await Promise.resolve();
    });

    expect(mocks.fetchOfflineBootstrap).toHaveBeenCalledWith(["gate"], "device-a", "GATE");
    vi.useRealTimers();
  });

  it("syncs pending canteen sales before updating the local canteen register", async () => {
    const syncBeforeRefresh = vi.fn(async () => undefined);
    mocks.getCanteenSaleSyncSummary
      .mockResolvedValueOnce({ pending: 1, syncing: 0, failed: 0, conflict: 0 })
      .mockResolvedValueOnce({ pending: 0, syncing: 0, failed: 0, conflict: 0 });
    mocks.getSnapshotValidity.mockResolvedValue(validSnapshot);

    const { useNfcOfflineSnapshotRefresh } = await import("../../hooks/useNfcOfflineSnapshotRefresh");
    const { result } = renderHook(() => useNfcOfflineSnapshotRefresh({
      schoolId: "school-a",
      deviceId: "device-a",
      mode: "CANTEEN",
      requiredModule: "canteen",
      syncBeforeRefresh,
    }));

    await act(async () => {
      await result.current.refreshNow("test");
    });

    expect(syncBeforeRefresh).toHaveBeenCalled();
    expect(mocks.saveBootstrapSnapshot).toHaveBeenCalledWith({ snapshotId: "snapshot-2" });
  });

  it("does not overwrite the canteen register when failed sales need reconciliation", async () => {
    mocks.getCanteenSaleSyncSummary.mockResolvedValue({ pending: 0, syncing: 0, failed: 1, conflict: 0 });
    mocks.getSnapshotValidity.mockResolvedValue(validSnapshot);

    const { useNfcOfflineSnapshotRefresh } = await import("../../hooks/useNfcOfflineSnapshotRefresh");
    const { result } = renderHook(() => useNfcOfflineSnapshotRefresh({
      schoolId: "school-a",
      deviceId: "device-a",
      mode: "CANTEEN",
      requiredModule: "canteen",
    }));

    await act(async () => {
      await result.current.refreshNow("test");
    });

    expect(mocks.saveBootstrapSnapshot).not.toHaveBeenCalled();
    expect(result.current.refreshError).toMatch(/register is available/i);
  });
});
