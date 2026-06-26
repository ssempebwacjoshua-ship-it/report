import { beforeEach, describe, expect, it, vi } from "vitest";

const offlineStoreMocks = vi.hoisted(() => ({
  getSnapshotMeta: vi.fn(),
}));

vi.mock("../../offline/offlineStore", () => offlineStoreMocks);

describe("offlineStatus", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("accepts a matching snapshot for the same school and module", async () => {
    offlineStoreMocks.getSnapshotMeta.mockResolvedValue({
      snapshotId: "snapshot-1",
      schoolId: "school-a",
      deviceId: "device-a",
      generatedAt: "2026-06-26T09:00:00.000Z",
      expiresAt: "2099-06-26T09:00:00.000Z",
      modules: ["attendance", "gate"],
      settings: { canteenOfflineEnabled: false },
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
      settings: { canteenOfflineEnabled: false },
    });

    const { isSnapshotValid } = await import("../../offline/offlineStatus");

    await expect(isSnapshotValid({ schoolId: "school-a", requiredModule: "attendance" })).resolves.toBe(false);
  });

  it("rejects snapshots that do not include the required NFC module", async () => {
    offlineStoreMocks.getSnapshotMeta.mockResolvedValue({
      snapshotId: "snapshot-1",
      schoolId: "school-a",
      deviceId: "device-a",
      generatedAt: "2026-06-26T09:00:00.000Z",
      expiresAt: "2099-06-26T09:00:00.000Z",
      modules: ["gate"],
      settings: { canteenOfflineEnabled: false },
    });

    const { isSnapshotValid } = await import("../../offline/offlineStatus");

    await expect(isSnapshotValid({ schoolId: "school-a", requiredModule: "attendance" })).resolves.toBe(false);
  });
});
