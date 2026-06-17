import { afterEach, describe, expect, it, vi } from "vitest";

const mockState = vi.hoisted(() => {
  const generateDocumentSchema = vi.fn();
  const applyPromptToSchema = vi.fn();
  const preferenceMap = vi.fn();
  const upsertSearchIndex = vi.fn();
  const createNotification = vi.fn();
  const executeWorkflows = vi.fn();
  const incrementDocumentAnalytics = vi.fn();

  const prisma = {
    smartDocument: {
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
}));

vi.mock("../../server/services/documentOsService", () => ({
  createNotification: mockState.createNotification,
  executeWorkflows: mockState.executeWorkflows,
  incrementDocumentAnalytics: mockState.incrementDocumentAnalytics,
  preferenceMap: mockState.preferenceMap,
  upsertSearchIndex: mockState.upsertSearchIndex,
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
});
