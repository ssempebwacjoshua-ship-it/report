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
    smartDocument: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    documentSourceFile: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    documentVersion: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    publishedDocument: {
      upsert: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
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

  it("falls back to generateSchema when extractedKnowledge exists but no activeVersion is present", async () => {
    mockState.prisma.smartDocument.findFirst.mockResolvedValue({
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
    mockState.prisma.smartDocument.findFirst.mockResolvedValue({
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

  it("logs real extraction diagnostics and keeps the friendly failure message", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    mockState.prisma.documentSourceFile.findUnique.mockResolvedValue({
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
    });
    mockState.prisma.documentSourceFile.findFirst.mockResolvedValue(null);
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

    consoleError.mockRestore();
  });
});
