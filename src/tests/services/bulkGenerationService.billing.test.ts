import { describe, expect, it, vi, beforeEach } from "vitest";

const state = vi.hoisted(() => {
  const bulkGenerationJob = {
    findUnique: vi.fn(),
    update: vi.fn(),
  };
  const collectionRecord = {
    findMany: vi.fn(),
  };
  const smartDocument = {
    create: vi.fn(),
    update: vi.fn(),
  };
  const documentVersion = {
    create: vi.fn(),
  };
  const publishedDocument = {
    create: vi.fn(),
  };
  const bulkJobOutput = {
    updateMany: vi.fn(),
  };
  const schoolSmartPagePlan = {
    findUnique: vi.fn(),
    updateMany: vi.fn(),
  };
  const smartPageLedger = {
    findFirst: vi.fn(),
    create: vi.fn(),
  };

  const prisma = {
    bulkGenerationJob,
    collectionRecord,
    smartDocument,
    documentVersion,
    publishedDocument,
    bulkJobOutput,
    schoolSmartPagePlan,
    smartPageLedger,
    $transaction: vi.fn(async (callback: (tx: any) => Promise<unknown>) => callback(prisma)),
  };

  return {
    prisma,
    bulkGenerationJob,
    collectionRecord,
    smartDocument,
    documentVersion,
    publishedDocument,
    bulkJobOutput,
    schoolSmartPagePlan,
    smartPageLedger,
  };
});

vi.mock("../../server/db/prisma", () => ({
  prisma: state.prisma,
}));

vi.mock("../../server/services/documentGeminiService", () => ({
  generateBulkTemplate: vi.fn(),
}));

vi.mock("../../server/services/documentOsService", () => ({
  createNotification: vi.fn().mockResolvedValue({}),
  executeWorkflows: vi.fn().mockResolvedValue({}),
  preferenceMap: vi.fn().mockResolvedValue({}),
  upsertSearchIndex: vi.fn().mockResolvedValue({}),
}));

describe("bulk generation billing", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    const job = {
      id: "job-1",
      creatorId: "creator-1",
      creator: { schoolId: "school-1" },
      collectionId: "collection-1",
      intent: "Create simple pages",
      templateSchema: {
        theme: { primaryColor: "#2563eb" },
        components: [{ id: "h1", type: "header", props: { title: "{{name}}" } }],
      },
      status: "PENDING",
      totalRecords: 2,
      processedRecords: 0,
      failedRecords: 0,
      collection: { name: "Term Records" },
    };

    const outputs = [
      { id: "out-1", recordId: "record-1", status: "PENDING" },
      { id: "out-2", recordId: "record-2", status: "PENDING" },
    ];

    state.bulkGenerationJob.findUnique.mockImplementation(async () => ({ ...job }));
    state.bulkGenerationJob.update.mockImplementation(async ({ data }: any) => {
      if (typeof data?.processedRecords?.increment === "number") job.processedRecords += data.processedRecords.increment;
      if (typeof data?.failedRecords?.increment === "number") job.failedRecords += data.failedRecords.increment;
      if (data?.status) job.status = data.status;
      return job;
    });

    state.collectionRecord.findMany.mockResolvedValue([
      { id: "record-1", data: { name: "Alice" } },
      { id: "record-2", data: { name: "Bob" } },
    ]);

    state.smartDocument.create.mockImplementation(async ({ data }: any) => ({
      id: `doc-${data.title.toLowerCase().replace(/\s+/g, "-")}`,
      ...data,
    }));
    state.documentVersion.create.mockImplementation(async ({ data }: any) => ({
      id: `version-${data.documentId}`,
      ...data,
    }));
    state.publishedDocument.create.mockImplementation(async ({ data }: any) => data);

    state.bulkJobOutput.updateMany.mockImplementation(async ({ where, data }: any) => {
      const row = outputs.find((entry) => entry.recordId === where.recordId);
      if (row) Object.assign(row, data);
      return { count: row ? 1 : 0 };
    });

    let usedPages = 0;
    state.schoolSmartPagePlan.findUnique.mockImplementation(async () => ({
      schoolId: "school-1",
      planName: "STARTER",
      includedPages: 1,
      billingCycle: "ACADEMIC_YEAR",
      cycleStart: new Date("2026-01-01T00:00:00Z"),
      cycleEnd: new Date("2026-12-31T00:00:00Z"),
      usedPages,
      topUpPages: 0,
      rolloverPages: 0,
      status: "ACTIVE",
      allowHighAccuracy: false,
    }));
    state.schoolSmartPagePlan.updateMany.mockImplementation(async ({ where, data }: any) => {
      if (where.usedPages !== usedPages) return { count: 0 };
      const increment = data?.usedPages?.increment ?? 0;
      usedPages += increment;
      return { count: 1 };
    });
    state.smartPageLedger.findFirst.mockResolvedValue(null);
    state.smartPageLedger.create.mockImplementation(async (args: any) => args);

    state.prisma.bulkGenerationJob.findUnique.mockResolvedValue(job);
    state.prisma.collectionRecord.findMany.mockResolvedValue([
      { id: "record-1", data: { name: "Alice" } },
      { id: "record-2", data: { name: "Bob" } },
    ]);
  });

  it("charges only successful bulk outputs", async () => {
    const { processJob } = await import("../../server/services/bulkGenerationService");

    await processJob("job-1");

    expect(state.smartPageLedger.create).toHaveBeenCalledTimes(1);
    expect(state.bulkJobOutput.updateMany).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: { jobId: "job-1", recordId: "record-1" },
        data: expect.objectContaining({ status: "DONE" }),
      }),
    );
    expect(state.bulkJobOutput.updateMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: { jobId: "job-1", recordId: "record-2" },
        data: expect.objectContaining({ status: "FAILED" }),
      }),
    );
  });
});
