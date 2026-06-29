import { beforeEach, describe, expect, it, vi } from "vitest";

const storeMocks = vi.hoisted(() => ({
  getTagByScanValue: vi.fn(),
  getStudentById: vi.fn(),
  getOfflineWallet: vi.fn(),
}));

vi.mock("../../offline/offlineStore", () => storeMocks);

const activeStudent = {
  id: "stu-1",
  schoolId: "school-a",
  admissionNumber: "A001",
  firstName: "Ada",
  lastName: "Lovelace",
  isActive: true,
  classId: null,
  className: null,
  streamId: null,
  streamName: null,
};

function tag(status: string, studentId: string | null = "stu-1") {
  return {
    id: `tag-${status}`,
    schoolId: "school-a",
    publicCode: "PUB001",
    physicalUid: "UID001",
    studentId,
    status,
    tagMode: "WRISTBAND",
    purpose: "STUDENT",
    writtenPayload: null,
  };
}

describe("resolveOfflineNfcScan", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    storeMocks.getStudentById.mockResolvedValue(activeStudent);
    storeMocks.getOfflineWallet.mockResolvedValue(null);
  });

  it.each(["ASSIGNED", "ALLOCATED", "ACTIVE", "VERIFIED", "REGISTERED", "WRITTEN", "GENERATED"])(
    "allows %s tags that are linked to a student",
    async (status) => {
      storeMocks.getTagByScanValue.mockResolvedValue(tag(status));
      const { resolveOfflineNfcScan } = await import("../../offline/offlineResolver");

      await expect(resolveOfflineNfcScan("school-a", "PUB001")).resolves.toMatchObject({
        found: true,
        blocked: false,
        student: activeStudent,
      });
    },
  );

  it.each(["UNASSIGNED", "UNALLOCATED", "GENERATED"])("blocks %s tags with no student", async (status) => {
    storeMocks.getTagByScanValue.mockResolvedValue(tag(status, null));
    const { resolveOfflineNfcScan } = await import("../../offline/offlineResolver");

    await expect(resolveOfflineNfcScan("school-a", "PUB001")).resolves.toMatchObject({
      found: true,
      blocked: true,
      reason: "unassigned tag",
    });
  });

  it.each(["DISABLED", "LOST"])("blocks %s tags even when linked to a student", async (status) => {
    storeMocks.getTagByScanValue.mockResolvedValue(tag(status));
    const { resolveOfflineNfcScan } = await import("../../offline/offlineResolver");

    await expect(resolveOfflineNfcScan("school-a", "PUB001")).resolves.toMatchObject({
      found: true,
      blocked: true,
    });
  });

  it("blocks locally when the Local Gate Register marks an active fee hold", async () => {
    storeMocks.getTagByScanValue.mockResolvedValue(tag("ASSIGNED"));
    storeMocks.getStudentById.mockResolvedValue({
      ...activeStudent,
      feeHoldStatus: "ACTIVE",
      gateBlockedReason: "school fees defaulter",
    });
    const { resolveOfflineNfcScan } = await import("../../offline/offlineResolver");

    await expect(resolveOfflineNfcScan("school-a", "PUB001")).resolves.toMatchObject({
      found: true,
      blocked: true,
      reason: "school fees defaulter",
    });
  });

  it("does not guess fee-hold blocking when fee-hold fields are missing", async () => {
    storeMocks.getTagByScanValue.mockResolvedValue(tag("ASSIGNED"));
    storeMocks.getStudentById.mockResolvedValue(activeStudent);
    const { resolveOfflineNfcScan } = await import("../../offline/offlineResolver");

    await expect(resolveOfflineNfcScan("school-a", "PUB001")).resolves.toMatchObject({
      found: true,
      blocked: false,
      student: activeStudent,
    });
  });
});
