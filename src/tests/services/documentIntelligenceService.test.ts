import { afterEach, describe, expect, it, vi } from "vitest";

const mockState = vi.hoisted(() => {
  const generateDocumentSchema = vi.fn();
  const applyPromptToSchema = vi.fn();
  const preferenceMap = vi.fn();
  const upsertSearchIndex = vi.fn();
  const createNotification = vi.fn();
  const executeWorkflows = vi.fn();
  const incrementDocumentAnalytics = vi.fn();
  const preprocessDocumentForOcr = vi.fn();

  const prisma = {
    creator: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    smartDocument: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
    },
    documentSourceFile: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      create: vi.fn(),
    },
    documentVersion: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    schoolSmartPagePlan: {
      findUnique: vi.fn(),
      updateMany: vi.fn(),
    },
    smartPageLedger: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    publishedDocument: {
      upsert: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
    $transaction: vi.fn(async (callback: (tx: any) => Promise<unknown>) => callback(prisma)),
  };

  return {
    generateDocumentSchema,
    applyPromptToSchema,
    preferenceMap,
    upsertSearchIndex,
    createNotification,
    executeWorkflows,
    incrementDocumentAnalytics,
    preprocessDocumentForOcr,
    prisma,
  };
});

vi.mock("../../server/db/prisma", () => ({
  prisma: mockState.prisma,
}));

vi.mock("../../server/services/documentGeminiService", () => ({
  generateDocumentSchema: mockState.generateDocumentSchema,
  applyPromptToSchema: mockState.applyPromptToSchema,
  extractDocumentKnowledge: vi.fn(),
  resolveGeminiDocumentModel: () => "gemini-2.5-flash",
}));

vi.mock("../../server/services/documentOsService", () => ({
  createNotification: mockState.createNotification,
  executeWorkflows: mockState.executeWorkflows,
  incrementDocumentAnalytics: mockState.incrementDocumentAnalytics,
  preferenceMap: mockState.preferenceMap,
  upsertSearchIndex: mockState.upsertSearchIndex,
}));

vi.mock("../../server/services/documentOcrPreprocessService", () => ({
  preprocessDocumentForOcr: mockState.preprocessDocumentForOcr,
}));

describe("documentIntelligenceService", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  const schoolActor = {
    id: "creator-1",
    type: "SCHOOL_OPERATOR",
    email: "creator@example.com",
    name: "Creator One",
    schoolId: "school-1",
    isActive: true,
  };

  beforeEach(() => {
    mockState.prisma.creator.findUnique.mockResolvedValue(schoolActor);
    mockState.prisma.creator.findFirst.mockResolvedValue(null);
    mockState.prisma.smartDocument.findFirst.mockImplementation(async (...args: Parameters<typeof mockState.prisma.smartDocument.findUnique>) =>
      mockState.prisma.smartDocument.findUnique(...args));
    mockState.prisma.documentSourceFile.findFirst.mockImplementation(async (...args: Parameters<typeof mockState.prisma.documentSourceFile.findUnique>) =>
      mockState.prisma.documentSourceFile.findUnique(...args));
    mockState.prisma.documentVersion.findFirst.mockImplementation(async (...args: Parameters<typeof mockState.prisma.documentVersion.findUnique>) =>
      mockState.prisma.documentVersion.findUnique(...args));
    mockState.prisma.auditLog.create.mockResolvedValue({ id: "audit-1" });
    mockState.prisma.documentSourceFile.findMany.mockResolvedValue([]);
    mockState.prisma.documentSourceFile.updateMany.mockResolvedValue({ count: 1 });
    mockState.prisma.schoolSmartPagePlan.findUnique.mockResolvedValue({
      schoolId: "school-1",
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
    });
    mockState.prisma.schoolSmartPagePlan.updateMany.mockResolvedValue({ count: 1 });
    mockState.prisma.smartPageLedger.findFirst.mockResolvedValue(null);
    mockState.prisma.smartPageLedger.create.mockResolvedValue({ id: "ledger-1" });
    mockState.prisma.$transaction.mockImplementation(async (callback: (tx: any) => Promise<unknown>) => callback(mockState.prisma));
  });

  it("falls back to generateSchema when extractedKnowledge exists but no activeVersion is present", async () => {
    mockState.prisma.smartDocument.findUnique.mockResolvedValue({
      id: "doc-1",
      creatorId: "creator-1",
      title: "Untitled Document",
      status: "DRAFT",
      extractionStatus: "READY",
      extractedKnowledge: {
        title: "Sample extraction",
        documentType: "report",
        domain: "school",
        suggestedDocumentType: "report",
        sections: [],
        tables: [],
        statistics: [],
        entities: [],
        people: [],
        dates: [],
        handwrittenNotes: [],
        keyFacts: [],
        unclearItems: [],
        rawText: "hello",
      },
      activeVersionId: null,
      activeVersion: null,
    });
    mockState.prisma.documentVersion.findFirst.mockResolvedValue(null);
    mockState.prisma.documentVersion.create.mockResolvedValue({ id: "version-1" });
    mockState.generateDocumentSchema.mockResolvedValue({
      schema: { theme: { primaryColor: "#2563eb" } },
      componentTree: [{ id: "root", type: "page", props: {}, children: [] }],
    });
    mockState.preferenceMap.mockResolvedValue({});

    const { applyPrompt } = await import("../../server/services/documentIntelligenceService");
    const result = await applyPrompt("doc-1", "creator-1", "Generate the document");

    expect(mockState.generateDocumentSchema).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Sample extraction" }),
      "Generate the document",
      "#2563eb",
      {},
    );
    expect(mockState.applyPromptToSchema).not.toHaveBeenCalled();
    expect(result.versionId).toBe("version-1");
  });

  it("uses applyPromptToSchema when an activeVersion exists", async () => {
    mockState.prisma.smartDocument.findUnique.mockResolvedValue({
      id: "doc-1",
      creatorId: "creator-1",
      title: "Untitled Document",
      status: "DRAFT",
      extractionStatus: "READY",
      extractedKnowledge: {
        title: "Sample extraction",
        documentType: "report",
        domain: "school",
        suggestedDocumentType: "report",
        sections: [],
        tables: [],
        statistics: [],
        entities: [],
        people: [],
        dates: [],
        handwrittenNotes: [],
        keyFacts: [],
        unclearItems: [],
        rawText: "hello",
      },
      activeVersionId: "version-0",
      activeVersion: {
        id: "version-0",
        instruction: "Initial",
        schema: { theme: { primaryColor: "#111111" }, components: [] },
        componentTree: [],
        renderSettings: {},
      },
    });
    mockState.prisma.documentVersion.findUnique.mockResolvedValue({
      id: "version-0",
      instruction: "Initial",
      schema: { theme: { primaryColor: "#111111" }, components: [] },
      componentTree: [],
      renderSettings: {},
      createdAt: new Date(),
    });
    mockState.prisma.documentVersion.create.mockResolvedValue({ id: "version-1" });
    mockState.applyPromptToSchema.mockResolvedValue({
      schema: { theme: { primaryColor: "#2563eb" } },
      componentTree: [{ id: "root", type: "page", props: {}, children: [] }],
    });
    mockState.preferenceMap.mockResolvedValue({});

    const { applyPrompt } = await import("../../server/services/documentIntelligenceService");
    await applyPrompt("doc-1", "creator-1", "Make it formal");

    expect(mockState.applyPromptToSchema).toHaveBeenCalledTimes(1);
    expect(mockState.generateDocumentSchema).not.toHaveBeenCalled();
  });

  it("successful generateSchema deducts exactly once", async () => {
    mockState.prisma.smartDocument.findUnique.mockResolvedValue({
      id: "doc-1",
      creatorId: "creator-1",
      title: "Untitled Document",
      status: "DRAFT",
      extractionStatus: "READY",
      extractedKnowledge: {
        title: "Sample extraction",
        documentType: "report",
        domain: "school",
        suggestedDocumentType: "report",
        sections: [],
        tables: [],
        statistics: [],
        entities: [],
        people: [],
        dates: [],
        handwrittenNotes: [],
        keyFacts: [],
        unclearItems: [],
        rawText: "hello",
      },
      activeVersionId: null,
      activeVersion: null,
    });
    mockState.prisma.documentVersion.create.mockResolvedValue({ id: "version-1" });
    mockState.generateDocumentSchema.mockResolvedValue({
      schema: { theme: { primaryColor: "#2563eb" }, components: [] },
      componentTree: [{ id: "root", type: "page", props: {}, children: [] }],
    });
    mockState.preferenceMap.mockResolvedValue({});

    const { generateSchema } = await import("../../server/services/documentIntelligenceService");
    const result = await generateSchema("doc-1", "creator-1", "Generate the document");

    expect(result.versionId).toBe("version-1");
    expect(mockState.prisma.schoolSmartPagePlan.updateMany).toHaveBeenCalledTimes(1);
    expect(mockState.prisma.smartPageLedger.create).toHaveBeenCalledTimes(1);
  });

  it("deduction failure does not leave active generated output behind", async () => {
    mockState.prisma.smartDocument.findUnique.mockResolvedValue({
      id: "doc-1",
      creatorId: "creator-1",
      title: "Untitled Document",
      status: "DRAFT",
      extractionStatus: "READY",
      extractedKnowledge: {
        title: "Sample extraction",
        documentType: "report",
        domain: "school",
        suggestedDocumentType: "report",
        sections: [],
        tables: [],
        statistics: [],
        entities: [],
        people: [],
        dates: [],
        handwrittenNotes: [],
        keyFacts: [],
        unclearItems: [],
        rawText: "hello",
      },
      activeVersionId: null,
      activeVersion: null,
    });
    mockState.prisma.documentVersion.create.mockResolvedValue({ id: "version-1" });
    mockState.generateDocumentSchema.mockResolvedValue({
      schema: { theme: { primaryColor: "#2563eb" }, components: [] },
      componentTree: [{ id: "root", type: "page", props: {}, children: [] }],
    });
    mockState.preferenceMap.mockResolvedValue({});
    mockState.prisma.schoolSmartPagePlan.updateMany.mockResolvedValueOnce({ count: 0 });

    const { generateSchema } = await import("../../server/services/documentIntelligenceService");
    await expect(generateSchema("doc-1", "creator-1", "Generate the document")).rejects.toMatchObject({
      code: "SMART_PAGES_CONFLICT",
    });
    expect(mockState.upsertSearchIndex).not.toHaveBeenCalled();
    expect(mockState.prisma.smartPageLedger.create).not.toHaveBeenCalled();
  });

  it("logs real extraction diagnostics and keeps the friendly failure message", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    mockState.prisma.documentSourceFile.findFirst.mockImplementation(async ({ where }: { where: Record<string, unknown> }) => {
      if (where.id === "source-1") {
        return {
          id: "source-1",
          documentId: "doc-1",
          originalName: "scan.png",
          mimeType: "image/png",
          sizeBytes: 1024,
          status: "UPLOADED",
          originalData: Buffer.from("original"),
          fileHash: "hash-1",
          ocrQuality: { retryMode: "fast" },
          document: {
            id: "doc-1",
            creatorId: "creator-1",
            title: "Untitled Document",
          },
        };
      }
      return null;
    });
    mockState.prisma.documentSourceFile.update.mockResolvedValue({});
    mockState.prisma.smartDocument.update.mockResolvedValue({});
    mockState.preprocessDocumentForOcr.mockResolvedValue({
      processedBuffer: Buffer.from("processed"),
      processedMimeType: "image/jpeg",
      width: 100,
      height: 100,
      notes: [{ code: "TEST", message: "processed", severity: "info" }],
      warning: null,
      sectionBuffers: [],
    });

    const { extractDocumentKnowledge } = await import("../../server/services/documentGeminiService");
    vi.mocked(extractDocumentKnowledge).mockRejectedValueOnce(new Error("Gemini 3.5 JSON parse failed"));

    const { processSourceFileExtraction } = await import("../../server/services/documentIntelligenceService");
    await processSourceFileExtraction("source-1");

      expect(consoleError).toHaveBeenCalledWith(
        "[document-intelligence] extraction failed",
      expect.objectContaining({
        documentId: "doc-1",
        sourceFileId: "source-1",
        originalName: "scan.png",
        mimeType: "image/png",
        sizeBytes: 1024,
        geminiModel: "gemini-2.5-flash",
        errorMessage: "Gemini 3.5 JSON parse failed",
      }),
    );
    expect(mockState.prisma.documentSourceFile.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "source-1" },
        data: expect.objectContaining({
          status: "FAILED",
          extractionError: "We could not read this document. Please retry or upload a clearer file.",
        }),
      }),
    );
    expect(mockState.prisma.schoolSmartPagePlan.updateMany).not.toHaveBeenCalled();
    expect(mockState.prisma.smartPageLedger.create).not.toHaveBeenCalled();

    consoleError.mockRestore();
  });

  it("503/model overloaded extraction records a failed ledger row without deducting credits", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    mockState.prisma.documentSourceFile.findFirst.mockImplementation(async ({ where }: { where: Record<string, unknown> }) => {
      if (where.id === "source-1") {
        return {
          id: "source-1",
          documentId: "doc-1",
          originalName: "scan.png",
          mimeType: "image/png",
          sizeBytes: 1024,
          status: "UPLOADED",
          originalData: Buffer.from("original"),
          fileHash: "hash-1",
          ocrQuality: { retryMode: "fast" },
          document: {
            id: "doc-1",
            creatorId: "creator-1",
            title: "Untitled Document",
          },
        };
      }
      return null;
    });
    mockState.prisma.documentSourceFile.update.mockResolvedValue({});
    mockState.prisma.smartDocument.update.mockResolvedValue({});
    mockState.preprocessDocumentForOcr.mockResolvedValue({
      processedBuffer: Buffer.from("processed"),
      processedMimeType: "image/jpeg",
      width: 100,
      height: 100,
      notes: [],
      warning: null,
      sectionBuffers: [],
    });

    const { extractDocumentKnowledge } = await import("../../server/services/documentGeminiService");
    vi.mocked(extractDocumentKnowledge).mockRejectedValueOnce(new Error("503 model overloaded"));

    const { processSourceFileExtraction } = await import("../../server/services/documentIntelligenceService");
    await processSourceFileExtraction("source-1");

    expect(mockState.prisma.schoolSmartPagePlan.updateMany).not.toHaveBeenCalled();
    expect(mockState.prisma.smartPageLedger.create).toHaveBeenCalledTimes(1);
    expect(mockState.prisma.smartPageLedger.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "FAILED",
          pagesCharged: 0,
          creditsCharged: 0,
        }),
      }),
    );
    expect(mockState.prisma.documentSourceFile.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          extractionError: "AI provider is busy. Retrying with stable model...",
          status: "FAILED",
        }),
      }),
    );

    consoleError.mockRestore();
  });

  it("creates school-owned documents with an audit log", async () => {
    mockState.prisma.smartDocument.create.mockResolvedValue({
      id: "doc-new",
      creatorId: "creator-1",
      schoolId: "school-1",
      title: "Term Report",
      status: "DRAFT",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const { createDocument } = await import("../../server/services/documentIntelligenceService");
    await createDocument("creator-1", "Term Report");

    expect(mockState.prisma.smartDocument.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          creatorId: "creator-1",
          schoolId: "school-1",
          title: "Term Report",
        }),
      }),
    );
    expect(mockState.prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          schoolId: "school-1",
          action: "SMART_DOCUMENT_CREATED",
          correlationId: "doc-new",
          details: expect.objectContaining({ documentId: "doc-new", title: "Term Report" }),
        }),
      }),
    );
  });

  it("publishDocument deducts exactly once", async () => {
    mockState.prisma.smartDocument.findUnique.mockResolvedValue({
      id: "doc-1",
      creatorId: "creator-1",
      title: "Term Report",
      status: "DRAFT",
      extractionStatus: "READY",
      extractedKnowledge: null,
      activeVersionId: "version-0",
      createdAt: new Date(),
      updatedAt: new Date(),
      published: null,
      sourceFiles: [],
      _count: { versions: 1 },
    });
    mockState.prisma.documentVersion.findUnique.mockResolvedValue({
      id: "version-0",
      instruction: "Initial",
      schema: { theme: { primaryColor: "#111111" }, components: [] },
      componentTree: [],
      renderSettings: {},
      createdAt: new Date(),
    });
    mockState.prisma.publishedDocument.upsert.mockResolvedValue({ id: "pub-1", token: "token-1" });
    mockState.prisma.smartDocument.update.mockResolvedValue({});

    const { publishDocument } = await import("../../server/services/documentIntelligenceService");
    await publishDocument("doc-1", "creator-1", {});

    expect(mockState.prisma.schoolSmartPagePlan.updateMany).toHaveBeenCalledTimes(1);
    expect(mockState.prisma.smartPageLedger.create).toHaveBeenCalledTimes(1);
    expect(mockState.prisma.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        schoolId: "school-1",
        action: "SMART_DOCUMENT_PUBLISHED",
        details: expect.objectContaining({
          documentId: "doc-1",
          title: "Term Report",
          tokenHash: expect.any(String),
        }),
      }),
    }));
    const publishAudit = mockState.prisma.auditLog.create.mock.calls.find(
      ([call]) => call?.data?.action === "SMART_DOCUMENT_PUBLISHED",
    )?.[0];
    expect(publishAudit?.data?.details).not.toHaveProperty("token");
  });

  it("successful extraction deducts exactly once", async () => {
    mockState.prisma.documentSourceFile.findFirst.mockImplementation(async ({ where }: { where: Record<string, unknown> }) => {
      if (where.id === "source-1") {
        return {
          id: "source-1",
          documentId: "doc-1",
          originalName: "scan.png",
          mimeType: "image/png",
          sizeBytes: 1024,
          status: "UPLOADED",
          originalData: Buffer.from("original"),
          fileHash: "hash-1",
          ocrQuality: { retryMode: "fast" },
          document: {
            id: "doc-1",
            creatorId: "creator-1",
            title: "Untitled Document",
          },
        };
      }
      return null;
    });
    mockState.prisma.documentSourceFile.update.mockResolvedValue({});
    mockState.prisma.smartDocument.update.mockResolvedValue({});
    mockState.preprocessDocumentForOcr.mockResolvedValue({
      processedBuffer: Buffer.from("processed"),
      processedMimeType: "image/jpeg",
      width: 100,
      height: 100,
      notes: [],
      warning: null,
      sectionBuffers: [],
    });

    const { extractDocumentKnowledge } = await import("../../server/services/documentGeminiService");
    vi.mocked(extractDocumentKnowledge).mockResolvedValueOnce({
      title: "Sample extraction",
      documentType: "report",
      domain: "school",
      suggestedDocumentType: "report",
      confidence: 0.95,
      handwritingDifficulty: "low",
      needsReview: false,
      recommendedNextStep: "accept",
      people: [],
      dates: [],
      sections: [],
      tables: [],
      statistics: [],
      entities: [],
      handwrittenNotes: [],
      keyFacts: [],
      unclearItems: [],
      rawText: "hello",
      _meta: {
        requestedModel: "gemini-2.5-flash",
        attemptedModels: ["gemini-2.5-flash"],
        selectedModel: "gemini-2.5-flash",
        retryCount: 0,
        fallbackUsed: false,
        tokenUsage: null,
        extractionTimeMs: 25,
        highAccuracy: false,
      },
    } as any);

    const { processSourceFileExtraction } = await import("../../server/services/documentIntelligenceService");
    await processSourceFileExtraction("source-1");

    expect(mockState.prisma.schoolSmartPagePlan.updateMany).toHaveBeenCalledTimes(1);
    expect(mockState.prisma.smartPageLedger.create).toHaveBeenCalledTimes(1);
    expect(mockState.prisma.smartPageLedger.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "CHARGED",
          pagesCharged: 1,
          creditsCharged: 1,
        }),
      }),
    );
    const readyUpdate = mockState.prisma.documentSourceFile.update.mock.calls.find(([call]) => call?.data?.status === "READY")?.[0];
    expect(readyUpdate?.data?.ocrQuality).toEqual(expect.objectContaining({
      stage: "ready",
      preprocessMs: expect.any(Number),
      geminiMs: expect.any(Number),
      totalMs: expect.any(Number),
    }));
  });

  it("does not reuse another school's cached extraction for the same file hash", async () => {
    mockState.prisma.documentSourceFile.findFirst.mockImplementation(async ({ where }: { where: Record<string, unknown> }) => {
      if (where.id === "source-1") {
        return {
          id: "source-1",
          documentId: "doc-1",
          originalName: "scan.png",
          mimeType: "image/png",
          sizeBytes: 1024,
          status: "UPLOADED",
          originalData: Buffer.from("original"),
          fileHash: "hash-shared",
          ocrQuality: { retryMode: "fast" },
          document: {
            id: "doc-1",
            creatorId: "creator-1",
            schoolId: "school-1",
            title: "Doc A",
            extractedKnowledge: null,
          },
        };
      }
      if (where.fileHash === "hash-shared") {
        return {
          id: "source-b",
          documentId: "doc-b",
          fileHash: "hash-shared",
          status: "READY",
          extractedContent: {
            title: "School B Secret",
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
            rawText: "B_SECRET",
          },
          processedData: Buffer.from("cached"),
          processedMimeType: "image/png",
          extractionCompletedAt: new Date("2026-01-01T00:00:00Z"),
          document: { id: "doc-b", creatorId: "creator-b", schoolId: "school-b" },
        };
      }
      return null;
    });
    mockState.prisma.documentSourceFile.update.mockResolvedValue({});
    mockState.prisma.smartDocument.update.mockResolvedValue({});
    mockState.preprocessDocumentForOcr.mockResolvedValue({
      processedBuffer: Buffer.from("processed"),
      processedMimeType: "image/jpeg",
      width: 100,
      height: 100,
      notes: [],
      warning: null,
      sectionBuffers: [],
    });

    const { extractDocumentKnowledge } = await import("../../server/services/documentGeminiService");
    vi.mocked(extractDocumentKnowledge).mockResolvedValueOnce({
      title: "School A Extraction",
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
      rawText: "A_ONLY",
      confidence: 0.9,
      _meta: {
        requestedModel: "gemini-2.5-flash",
        selectedModel: "gemini-2.5-flash",
        attemptedModels: ["gemini-2.5-flash"],
        retryCount: 0,
        fallbackUsed: false,
        fallbackReason: null,
        providerErrorCode: null,
        extractionTimeMs: 5,
        tokenUsage: null,
      },
    } as any);

    const { processSourceFileExtraction } = await import("../../server/services/documentIntelligenceService");
    await processSourceFileExtraction("source-1");

    expect(extractDocumentKnowledge).toHaveBeenCalledTimes(1);
  });

  it("reuses cached extraction inside the same school for the same file hash", async () => {
    mockState.prisma.documentSourceFile.findFirst.mockImplementation(async ({ where }: { where: Record<string, unknown> }) => {
      if (where.id === "source-1") {
        return {
          id: "source-1",
          documentId: "doc-1",
          originalName: "scan.png",
          mimeType: "image/png",
          sizeBytes: 1024,
          status: "UPLOADED",
          originalData: Buffer.from("original"),
          fileHash: "hash-shared",
          ocrQuality: { retryMode: "fast" },
          document: {
            id: "doc-1",
            creatorId: "creator-1",
            schoolId: "school-1",
            title: "Doc A",
            extractedKnowledge: null,
          },
        };
      }
      if (where.fileHash === "hash-shared") {
        return {
          id: "source-a-older",
          documentId: "doc-a-older",
          fileHash: "hash-shared",
          status: "READY",
          extractedContent: {
            title: "Reused",
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
            rawText: "SAME_SCHOOL_CACHE",
          },
          processedData: Buffer.from("cached"),
          processedMimeType: "image/png",
          extractionCompletedAt: new Date("2026-01-01T00:00:00Z"),
          document: { id: "doc-a-older", creatorId: "creator-1", schoolId: "school-1" },
        };
      }
      return null;
    });
    mockState.prisma.documentSourceFile.update.mockResolvedValue({});
    mockState.prisma.smartDocument.update.mockResolvedValue({});

    const { extractDocumentKnowledge } = await import("../../server/services/documentGeminiService");
    vi.mocked(extractDocumentKnowledge).mockReset();

    const { processSourceFileExtraction } = await import("../../server/services/documentIntelligenceService");
    await processSourceFileExtraction("source-1");

    expect(extractDocumentKnowledge).not.toHaveBeenCalled();
    expect(mockState.prisma.documentSourceFile.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          extractedContent: expect.objectContaining({ rawText: "SAME_SCHOOL_CACHE" }),
        }),
      }),
    );
  });

  it("blocks access to another school's SmartDocument", async () => {
    mockState.prisma.smartDocument.findFirst.mockResolvedValue(null);

    const { getDocument } = await import("../../server/services/documentIntelligenceService");
    await expect(getDocument("doc-b", "creator-1")).rejects.toMatchObject({ status: 404 });
  });

  it("blocks upload and publish for another school's SmartDocument", async () => {
    mockState.prisma.smartDocument.findFirst.mockResolvedValue(null);

    const { uploadAndExtract, publishDocument } = await import("../../server/services/documentIntelligenceService");
    await expect(
      uploadAndExtract("doc-b", "creator-1", {
        originalname: "scan.png",
        mimetype: "image/png",
        size: 100,
        buffer: Buffer.from("file"),
      } as Express.Multer.File),
    ).rejects.toMatchObject({ status: 404 });
    await expect(publishDocument("doc-b", "creator-1")).rejects.toMatchObject({ status: 404 });
  });

  it("rejects Word document uploads with a friendly unsupported-file message", async () => {
    mockState.prisma.smartDocument.findUnique.mockResolvedValue({
      id: "doc-1",
      creatorId: "creator-1",
      schoolId: "school-1",
      title: "Untitled Document",
      status: "DRAFT",
      extractionStatus: "READY",
      extractedKnowledge: null,
      activeVersionId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      published: null,
      sourceFiles: [],
      _count: { versions: 0 },
    });

    const { uploadAndExtract } = await import("../../server/services/documentIntelligenceService");
    await expect(
      uploadAndExtract("doc-1", "creator-1", {
        originalname: "letter.docx",
        mimetype: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        size: 100,
        buffer: Buffer.from("file"),
      } as Express.Multer.File),
    ).rejects.toMatchObject({
      status: 415,
      message: "Word documents are coming soon. Please upload PDF, image, CSV, or Excel.",
    });
    expect(mockState.prisma.documentSourceFile.create).not.toHaveBeenCalled();
  });

  it("queues upload metadata immediately before extraction starts", async () => {
    mockState.prisma.smartDocument.findUnique.mockResolvedValue({
      id: "doc-1",
      creatorId: "creator-1",
      schoolId: "school-1",
      title: "Untitled Document",
      status: "DRAFT",
      extractionStatus: "READY",
      extractedKnowledge: null,
      activeVersionId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      published: null,
      sourceFiles: [],
      _count: { versions: 0 },
    });
    mockState.prisma.documentSourceFile.create.mockResolvedValue({
      id: "source-upload-1",
    });
    mockState.prisma.smartDocument.update.mockResolvedValue({});

    const { uploadAndExtract } = await import("../../server/services/documentIntelligenceService");
    await uploadAndExtract("doc-1", "creator-1", {
      originalname: "scan.png",
      mimetype: "image/png",
      size: 2048,
      buffer: Buffer.from("file"),
    } as Express.Multer.File);

    expect(mockState.prisma.documentSourceFile.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "UPLOADED",
          ocrQuality: expect.objectContaining({
            queuedAt: expect.any(String),
            fileSize: 2048,
            mimeType: "image/png",
            stage: "queued",
          }),
        }),
      }),
    );
    expect(mockState.prisma.smartDocument.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          extractionStartedAt: null,
          extractionStatus: "PROCESSING",
        }),
      }),
    );
  });

  it("does not collapse school operators into a school-wide creator record", async () => {
    mockState.prisma.creator.findFirst.mockResolvedValueOnce(null);
    mockState.prisma.creator.findUnique.mockResolvedValueOnce(null);
    mockState.prisma.creator.create.mockResolvedValue({ id: "creator-new" });

    const { findOrCreateSchoolOperatorCreator } = await import("../../server/services/documentIntelligenceService");
    const creatorId = await findOrCreateSchoolOperatorCreator("school-1", "admin3@example.com", "Admin Three");

    expect(creatorId).toBe("creator-new");
    expect(mockState.prisma.creator.findFirst).toHaveBeenCalledWith({ where: { schoolId: "school-1", email: "admin3@example.com" } });
    expect(mockState.prisma.creator.findUnique).toHaveBeenCalledWith({ where: { email: "admin3@example.com" } });
    expect(mockState.prisma.creator.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          schoolId: "school-1",
          email: "admin3@example.com",
          name: "Admin Three",
        }),
      }),
    );
  });
});

