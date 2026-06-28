import { beforeEach, describe, expect, it, vi } from "vitest";

const offlineStoreMocks = vi.hoisted(() => ({
  getSnapshotMeta: vi.fn(),
  getSnapshotCounts: vi.fn(),
}));

vi.mock("../../offline/offlineStore", () => offlineStoreMocks);

describe("offlineStatus", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    offlineStoreMocks.getSnapshotCounts.mockResolvedValue({ studentCount: 3, tagCount: 2, walletCount: 1 });
  });

  it("accepts a matching snapshot for the same school and module", async () => {
    offlineStoreMocks.getSnapshotMeta.mockResolvedValue({
      snapshotId: "snapshot-1",
      schoolId: "school-a",
      deviceId: "device-a",
      generatedAt: "2026-06-26T09:00:00.000Z",
      expiresAt: "2099-06-26T09:00:00.000Z",
      modules: ["attendance", "gate"],
      settings: { gateOfflineEnabled: true, canteenOfflineEnabled: false },
    });

    const { isSnapshotValid } = await import("../../offline/offlineStatus");

    await expect(isSnapshotValid({ schoolId: "school-a", requiredModule: "attendance" })).resolves.toBe(true);
  });

  it("rejects snapshots from another school even when they are still fresh", async () => {
    offlineStoreMocks.getSnapshotMeta.mockResolvedValue({
      snapshotId: "snapshot-1",
      schoolId: "school-b",
      deviceId: "device-a",
      generatedAt: "2026-06-26T09:00:00.000Z",
      expiresAt: "2099-06-26T09:00:00.000Z",
      modules: ["attendance", "gate"],
      settings: { gateOfflineEnabled: true, canteenOfflineEnabled: false },
    });

    const { getSnapshotValidity, isSnapshotValid } = await import("../../offline/offlineStatus");

    await expect(isSnapshotValid({ schoolId: "school-a", requiredModule: "attendance" })).resolves.toBe(false);
    await expect(getSnapshotValidity({ schoolId: "school-a", requiredModule: "attendance" })).resolves.toMatchObject({ reason: "wrong_school" });
  });

  it("rejects snapshots that do not include the required NFC module", async () => {
    offlineStoreMocks.getSnapshotMeta.mockResolvedValue({
      snapshotId: "snapshot-1",
      schoolId: "school-a",
      deviceId: "device-a",
      generatedAt: "2026-06-26T09:00:00.000Z",
      expiresAt: "2099-06-26T09:00:00.000Z",
      modules: ["gate"],
      settings: { gateOfflineEnabled: true, canteenOfflineEnabled: false },
    });

    const { getSnapshotValidity, isSnapshotValid } = await import("../../offline/offlineStatus");

    await expect(isSnapshotValid({ schoolId: "school-a", requiredModule: "attendance" })).resolves.toBe(false);
    await expect(getSnapshotValidity({ schoolId: "school-a", requiredModule: "attendance" })).resolves.toMatchObject({ reason: "missing_module" });
  });

  it("reports wrong_device when the downloaded snapshot belongs to another kiosk", async () => {
    offlineStoreMocks.getSnapshotMeta.mockResolvedValue({
      snapshotId: "snapshot-1",
      schoolId: "school-a",
      deviceId: "device-b",
      generatedAt: "2026-06-26T09:00:00.000Z",
      expiresAt: "2099-06-26T09:00:00.000Z",
      modules: ["gate"],
      settings: { gateOfflineEnabled: true, canteenOfflineEnabled: false },
    });

    const { getSnapshotValidity } = await import("../../offline/offlineStatus");

    await expect(getSnapshotValidity({ schoolId: "school-a", deviceId: "device-a", requiredModule: "gate" })).resolves.toMatchObject({ reason: "wrong_device" });
  });

  it("reports empty_tags for a snapshot that downloaded without NFC tags", async () => {
    offlineStoreMocks.getSnapshotMeta.mockResolvedValue({
      snapshotId: "snapshot-1",
      schoolId: "school-a",
      deviceId: "device-a",
      generatedAt: "2026-06-26T09:00:00.000Z",
      expiresAt: "2099-06-26T09:00:00.000Z",
      modules: ["gate"],
      settings: { gateOfflineEnabled: true, canteenOfflineEnabled: false },
    });
    offlineStoreMocks.getSnapshotCounts.mockResolvedValue({ studentCount: 3, tagCount: 0, walletCount: 1 });

    const { getSnapshotValidity } = await import("../../offline/offlineStatus");

    await expect(getSnapshotValidity({ schoolId: "school-a", deviceId: "device-a", requiredModule: "gate" })).resolves.toMatchObject({ reason: "empty_tags" });
  });
});
