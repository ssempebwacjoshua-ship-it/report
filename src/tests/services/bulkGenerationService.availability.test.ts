import { describe, expect, it, vi, beforeEach } from "vitest";

const state = vi.hoisted(() => {
  const bulkGenerationJob = {
    create: vi.fn(),
  };
  const bulkJobOutput = {
    createMany: vi.fn(),
  };
  const collection = {
    findFirst: vi.fn(),
  };
  const collectionRecord = {
    findMany: vi.fn(),
  };
  const prisma = {
    $queryRaw: vi.fn(),
    bulkGenerationJob,
    bulkJobOutput,
    collection,
    collectionRecord,
  };
  return {
    prisma,
    bulkGenerationJob,
    bulkJobOutput,
    collection,
    collectionRecord,
  };
});

vi.mock("../../server/db/prisma", () => ({
  prisma: state.prisma,
}));

vi.mock("../../server/services/documentGeminiService", () => ({
  generateBulkTemplate: vi.fn(),
}));

vi.mock("../../server/services/documentOsService", () => ({
  createNotification: vi.fn(),
  executeWorkflows: vi.fn(),
  preferenceMap: vi.fn().mockResolvedValue({}),
  upsertSearchIndex: vi.fn(),
}));

describe("bulk generation availability", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    state.collection.findFirst.mockResolvedValue({
      id: "collection-1",
      creatorId: "creator-1",
      name: "Term Records",
      type: "DOCUMENT",
      records: [{ data: { name: "Alice" } }],
      _count: { records: 1 },
    });
    state.collectionRecord.findMany.mockResolvedValue([{ id: "record-1" }]);
    state.bulkGenerationJob.create.mockImplementation(async ({ data }: any) => ({
      ...data,
      id: data.id,
      createdAt: new Date("2026-01-01T00:00:00Z"),
      errorMessage: null,
      startedAt: null,
      completedAt: null,
      processedRecords: 0,
      failedRecords: 0,
    }));
    state.bulkJobOutput.createMany.mockResolvedValue({ count: 1 });
  });

  it("rechecks schema availability on later calls instead of staying disabled", async () => {
    state.prisma.$queryRaw
      .mockResolvedValueOnce([{ exists: null }])
      .mockResolvedValueOnce([{ exists: "BulkGenerationJob" }]);

    const { createBulkJob } = await import("../../server/services/bulkGenerationService");

    await expect(createBulkJob("creator-1", "collection-1", "Create a document")).rejects.toMatchObject({
      status: 503,
    });

    await expect(createBulkJob("creator-1", "collection-1", "Create a document")).resolves.toMatchObject({
      id: expect.any(String),
      collectionId: "collection-1",
      collectionName: "Term Records",
      status: "PENDING",
      totalRecords: 1,
    });
  });
});
