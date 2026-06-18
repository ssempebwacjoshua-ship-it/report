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
      update: vi.fn(),
      create: vi.fn(),
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
    auditLog: {
      create: vi.fn(),
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
    mockState.prisma.auditLog.create.mockResolvedValue({ id: "audit-1" });
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

  it("blocks access to another school's SmartDocument", async () => {
    mockState.prisma.smartDocument.findUnique.mockResolvedValue({
      id: "doc-b",
      creatorId: "creator-b",
      schoolId: "school-2",
      title: "Other School Document",
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

    const { getDocument } = await import("../../server/services/documentIntelligenceService");
    await expect(getDocument("doc-b", "creator-1")).rejects.toMatchObject({ status: 403 });
  });

  it("blocks upload and publish for another school's SmartDocument", async () => {
    mockState.prisma.smartDocument.findUnique.mockResolvedValue({
      id: "doc-b",
      creatorId: "creator-b",
      schoolId: "school-2",
      title: "Other School Document",
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

    const { uploadAndExtract, publishDocument } = await import("../../server/services/documentIntelligenceService");
    await expect(
      uploadAndExtract("doc-b", "creator-1", {
        originalname: "scan.png",
        mimetype: "image/png",
        size: 100,
        buffer: Buffer.from("file"),
      } as Express.Multer.File),
    ).rejects.toMatchObject({ status: 403 });
    await expect(publishDocument("doc-b", "creator-1")).rejects.toMatchObject({ status: 403 });
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

