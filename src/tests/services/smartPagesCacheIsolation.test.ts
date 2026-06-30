import { afterEach, describe, expect, it, vi } from "vitest";

const SCHOOL_A = { id: "school-a", code: "SCHOOL-A", name: "School A" };
const SCHOOL_B = { id: "school-b", code: "SCHOOL-B", name: "School B" };

afterEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe("smart cache isolation", () => {
  it("does not reuse School B extracted content for School A when the file hash matches", async () => {
    const extractDocumentKnowledge = vi.fn(async () => ({
      title: "School A extraction",
      documentType: "report",
      domain: "school",
      sections: [],
      tables: [],
      statistics: [],
      entities: [],
      people: [],
      dates: [],
      handwrittenNotes: [],
      keyFacts: [],
      unclearItems: [],
      rawText: "A_SAFE_TEXT",
      confidence: 0.9,
      _meta: {
        requestedModel: "gemini-fast",
        selectedModel: "gemini-fast",
        attemptedModels: ["gemini-fast"],
        retryCount: 0,
        fallbackUsed: false,
        fallbackReason: null,
        providerErrorCode: null,
        extractionTimeMs: 10,
        tokenUsage: null,
      },
    }));

    const sourceA = {
      id: "source-a",
      documentId: "doc-a",
      originalName: "a.png",
      mimeType: "image/png",
      sizeBytes: 100,
      status: "UPLOADED",
      originalData: Buffer.from("A"),
      fileHash: "hash-x",
      processedData: null,
      processedMimeType: null,
      ocrQuality: { retryMode: "fast" },
      document: { id: "doc-a", creatorId: "creator-a", schoolId: SCHOOL_A.id, title: "Doc A", extractedKnowledge: null },
    };
    const cachedB = {
      id: "source-b",
      fileHash: "hash-x",
      status: "READY",
      extractedContent: { rawText: "B_SECRET", title: "School B secret" },
      processedData: Buffer.from("B"),
      processedMimeType: "image/png",
      extractionCompletedAt: new Date(),
      document: { id: "doc-b", creatorId: "creator-b", schoolId: SCHOOL_B.id },
    };

    const documentSourceFileUpdate = vi.fn(async () => ({}));
    const smartDocumentUpdate = vi.fn(async () => ({}));

    const prisma = {
      creator: { findUnique: vi.fn(async () => ({ id: "creator-a", type: "SCHOOL_OPERATOR", email: "a@example.com", name: "A", schoolId: SCHOOL_A.id, isActive: true })) },
      documentSourceFile: {
        findFirst: vi.fn(async ({ where }: any) => {
          if (where?.id === "source-a") return sourceA;
          if (where?.fileHash === "hash-x") return cachedB;
          return null;
        }),
        findUnique: vi.fn(async () => sourceA),
        updateMany: vi.fn(async () => ({ count: 1 })),
        update: documentSourceFileUpdate,
      },
      smartDocument: {
        findFirst: vi.fn(async ({ where }: any) => (where?.id === "doc-a" ? sourceA.document : null)),
        findUnique: vi.fn(async () => sourceA.document),
        update: smartDocumentUpdate,
      },
      schoolSmartPagePlan: {
        findUnique: vi.fn(async () => ({
          schoolId: SCHOOL_A.id,
          planName: "STARTER",
          includedPages: 100,
          billingCycle: "ACADEMIC_YEAR",
          cycleStart: new Date("2026-01-01T00:00:00Z"),
          cycleEnd: new Date("2026-12-31T00:00:00Z"),
          usedPages: 0,
          topUpPages: 0,
          rolloverPages: 0,
          status: "ACTIVE",
          allowHighAccuracy: false,
        })),
        updateMany: vi.fn(async () => ({ count: 1 })),
      },
      smartPageLedger: {
        findFirst: vi.fn(async () => null),
        create: vi.fn(async () => ({})),
      },
      auditLog: { create: vi.fn(async () => ({})) },
      $transaction: vi.fn(async (callback: (tx: any) => Promise<unknown>) => callback(prisma)),
    };

    vi.doMock("../../server/db/prisma", () => ({ prisma }));
    vi.doMock("../../server/services/documentGeminiService", () => ({
      extractDocumentKnowledge,
      generateDocumentSchema: vi.fn(),
      applyPromptToSchema: vi.fn(),
      resolveGeminiDocumentModel: () => "gemini-fast",
    }));
    vi.doMock("../../server/services/documentOsService", () => ({
      createNotification: vi.fn(async () => ({})),
      executeWorkflows: vi.fn(async () => []),
      incrementDocumentAnalytics: vi.fn(async () => ({})),
      preferenceMap: vi.fn(async () => ({})),
      upsertSearchIndex: vi.fn(async () => ({})),
    }));
    vi.doMock("../../server/services/documentOcrPreprocessService", () => ({
      preprocessDocumentForOcr: vi.fn(async () => ({
        processedBuffer: Buffer.from("processed"),
        processedMimeType: "image/png",
        width: 100,
        height: 100,
        notes: [],
        warning: null,
        sectionBuffers: [],
      })),
    }));

    const { processSourceFileExtraction } = await import("../../server/services/documentIntelligenceService");
    await processSourceFileExtraction("source-a");

    expect(extractDocumentKnowledge).toHaveBeenCalledTimes(1);
    expect(documentSourceFileUpdate).not.toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          extractedContent: expect.objectContaining({ rawText: "B_SECRET" }),
        }),
      }),
    );
  });

  it("reuses extracted content safely inside the same school for the same file hash", async () => {
    const extractDocumentKnowledge = vi.fn(async () => {
      throw new Error("should not be called for same-school cache hit");
    });

    const sourceA = {
      id: "source-a",
      documentId: "doc-a",
      originalName: "a.png",
      mimeType: "image/png",
      sizeBytes: 100,
      status: "UPLOADED",
      originalData: Buffer.from("A"),
      fileHash: "hash-x",
      processedData: null,
      processedMimeType: null,
      ocrQuality: { retryMode: "fast" },
      document: { id: "doc-a", creatorId: "creator-a", schoolId: SCHOOL_A.id, title: "Doc A", extractedKnowledge: null },
    };
    const cachedA = {
      id: "source-cache-a",
      fileHash: "hash-x",
      status: "READY",
      extractedContent: { rawText: "SAFE_SAME_SCHOOL", title: "School A cache" },
      processedData: Buffer.from("cached"),
      processedMimeType: "image/png",
      extractionCompletedAt: new Date(),
      document: { id: "doc-cache-a", creatorId: "creator-a-2", schoolId: SCHOOL_A.id },
    };

    const documentSourceFileUpdate = vi.fn(async () => ({}));

    const prisma = {
      creator: { findUnique: vi.fn(async () => ({ id: "creator-a", type: "SCHOOL_OPERATOR", email: "a@example.com", name: "A", schoolId: SCHOOL_A.id, isActive: true })) },
      documentSourceFile: {
        findFirst: vi.fn(async ({ where }: any) => {
          if (where?.id === "source-a") return sourceA;
          if (where?.fileHash === "hash-x") return cachedA;
          return null;
        }),
        findUnique: vi.fn(async () => sourceA),
        updateMany: vi.fn(async () => ({ count: 1 })),
        update: documentSourceFileUpdate,
      },
      smartDocument: {
        findFirst: vi.fn(async ({ where }: any) => (where?.id === "doc-a" ? sourceA.document : null)),
        findUnique: vi.fn(async () => sourceA.document),
        update: vi.fn(async () => ({})),
      },
      schoolSmartPagePlan: {
        findUnique: vi.fn(async () => ({
          schoolId: SCHOOL_A.id,
          planName: "STARTER",
          includedPages: 100,
          billingCycle: "ACADEMIC_YEAR",
          cycleStart: new Date("2026-01-01T00:00:00Z"),
          cycleEnd: new Date("2026-12-31T00:00:00Z"),
          usedPages: 0,
          topUpPages: 0,
          rolloverPages: 0,
          status: "ACTIVE",
          allowHighAccuracy: false,
        })),
        updateMany: vi.fn(async () => ({ count: 1 })),
      },
      smartPageLedger: {
        findFirst: vi.fn(async () => null),
        create: vi.fn(async () => ({})),
      },
      auditLog: { create: vi.fn(async () => ({})) },
      $transaction: vi.fn(async (callback: (tx: any) => Promise<unknown>) => callback(prisma)),
    };

    vi.doMock("../../server/db/prisma", () => ({ prisma }));
    vi.doMock("../../server/services/documentGeminiService", () => ({
      extractDocumentKnowledge,
      generateDocumentSchema: vi.fn(),
      applyPromptToSchema: vi.fn(),
      resolveGeminiDocumentModel: () => "gemini-fast",
    }));
    vi.doMock("../../server/services/documentOsService", () => ({
      createNotification: vi.fn(async () => ({})),
      executeWorkflows: vi.fn(async () => []),
      incrementDocumentAnalytics: vi.fn(async () => ({})),
      preferenceMap: vi.fn(async () => ({})),
      upsertSearchIndex: vi.fn(async () => ({})),
    }));
    vi.doMock("../../server/services/documentOcrPreprocessService", () => ({
      preprocessDocumentForOcr: vi.fn(async () => ({
        processedBuffer: Buffer.from("processed"),
        processedMimeType: "image/png",
        width: 100,
        height: 100,
        notes: [],
        warning: null,
        sectionBuffers: [],
      })),
    }));

    const { processSourceFileExtraction } = await import("../../server/services/documentIntelligenceService");
    await processSourceFileExtraction("source-a");

    expect(extractDocumentKnowledge).not.toHaveBeenCalled();
    expect(documentSourceFileUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          extractedContent: expect.objectContaining({ rawText: "SAFE_SAME_SCHOOL" }),
        }),
      }),
    );
  });
});
