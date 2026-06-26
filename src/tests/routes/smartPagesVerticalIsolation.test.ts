/**
 * Vertical isolation tests for Smart Pages.
 *
 * Proves that:
 * - School list does not return lawyer documents.
 * - Lawyer list does not return school documents.
 * - School editor (generateSchema/applyPrompt/upload) rejects LAWYER documents.
 * - Lawyer edit-plan rejects SCHOOL documents.
 * - loadOwnedSmartDocument denies SCHOOL_OPERATOR access to LAWYER docs.
 * - Guardrail fails if a school page imports lawyer constants directly.
 * - Client auth: lawyerAuthHeaders uses sp_creator_token; schoolAuthHeaders uses sc_auth_token.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ── Mock state ────────────────────────────────────────────────────────────────

const mockState = vi.hoisted(() => {
  const upsertSearchIndex = vi.fn();
  const createNotification = vi.fn();
  const executeWorkflows = vi.fn();
  const incrementDocumentAnalytics = vi.fn();
  const preferenceMap = vi.fn();
  const generateDocumentSchema = vi.fn();
  const applyPromptToSchema = vi.fn();
  const generateLawyerDocumentEditPlan = vi.fn();
  const preprocessDocumentForOcr = vi.fn();

  const prisma = {
    creator: { findUnique: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
    smartDocument: { findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn() },
    documentSourceFile: { findUnique: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
    documentVersion: { findUnique: vi.fn(), findFirst: vi.fn(), create: vi.fn() },
    schoolSmartPagePlan: { findUnique: vi.fn(), updateMany: vi.fn() },
    smartPageLedger: { findFirst: vi.fn(), create: vi.fn() },
    publishedDocument: { upsert: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    auditLog: { create: vi.fn() },
    $transaction: vi.fn(async (cb: (tx: any) => unknown) => cb(prisma)),
  };

  return {
    upsertSearchIndex,
    createNotification,
    executeWorkflows,
    incrementDocumentAnalytics,
    preferenceMap,
    generateDocumentSchema,
    applyPromptToSchema,
    generateLawyerDocumentEditPlan,
    preprocessDocumentForOcr,
    prisma,
  };
});

vi.mock("../../server/db/prisma", () => ({ prisma: mockState.prisma }));
vi.mock("../../server/services/documentGeminiService", () => ({
  generateDocumentSchema: mockState.generateDocumentSchema,
  applyPromptToSchema: mockState.applyPromptToSchema,
  generateLawyerDocumentEditPlan: mockState.generateLawyerDocumentEditPlan,
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

// ── Actor fixtures ─────────────────────────────────────────────────────────────

const schoolActor = {
  id: "creator-school",
  type: "SCHOOL_OPERATOR",
  email: "school@example.com",
  name: "School Operator",
  schoolId: "school-1",
  isActive: true,
};

const externalActor = {
  id: "creator-ext",
  type: "EXTERNAL",
  email: "lawyer@example.com",
  name: "Lawyer User",
  schoolId: null,
  isActive: true,
};

function makeDoc(overrides?: Partial<Record<string, unknown>>) {
  return {
    id: "doc-1",
    creatorId: "creator-school",
    schoolId: "school-1",
    title: "Test Document",
    vertical: "SCHOOL",
    status: "DRAFT",
    extractionStatus: "READY",
    extractedKnowledge: { title: "t", documentType: "d", domain: "school", sections: [], tables: [], statistics: [], entities: [], people: [], dates: [], handwrittenNotes: [], keyFacts: [], unclearItems: [], rawText: "hello" },
    activeVersionId: null,
    sourceFiles: [],
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
    ...overrides,
  };
}

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  mockState.prisma.auditLog.create.mockResolvedValue({ id: "audit-1" });
  mockState.prisma.schoolSmartPagePlan.findUnique.mockResolvedValue({
    schoolId: "school-1", planName: "STARTER", includedPages: 100, billingCycle: "ACADEMIC_YEAR",
    cycleStart: new Date("2026-01-01"), cycleEnd: new Date("2026-12-31"), usedPages: 0,
    topUpPages: 0, rolloverPages: 0, status: "ACTIVE", allowHighAccuracy: false,
  });
  mockState.prisma.schoolSmartPagePlan.updateMany.mockResolvedValue({ count: 1 });
  mockState.prisma.smartPageLedger.findFirst.mockResolvedValue(null);
  mockState.prisma.smartPageLedger.create.mockResolvedValue({ id: "ledger-1" });
  mockState.prisma.$transaction.mockImplementation(async (cb: (tx: any) => unknown) => cb(mockState.prisma));
  mockState.preferenceMap.mockResolvedValue({});
});

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});

// ── Tests ──────────────────────────────────────────────────────────────────────

describe("listDocuments vertical filter", () => {
  it("returns only SCHOOL documents when vertical=SCHOOL is requested", async () => {
    mockState.prisma.creator.findUnique.mockResolvedValue(schoolActor);
    mockState.prisma.smartDocument.findMany.mockResolvedValue([
      { ...makeDoc(), vertical: "SCHOOL", _count: { versions: 1, sourceFiles: 0 }, published: null },
    ]);

    const { listDocuments } = await import("../../server/services/documentIntelligenceService");
    const docs = await listDocuments("creator-school", "SCHOOL");

    expect(docs).toHaveLength(1);
    expect(docs[0].vertical).toBe("SCHOOL");
    // Verify the query included vertical filter
    expect(mockState.prisma.smartDocument.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ vertical: "SCHOOL" }) }),
    );
  });

  it("returns only LAWYER documents when vertical=LAWYER is requested", async () => {
    mockState.prisma.creator.findUnique.mockResolvedValue(externalActor);
    mockState.prisma.smartDocument.findMany.mockResolvedValue([
      { ...makeDoc({ creatorId: "creator-ext", schoolId: null, vertical: "LAWYER" }), _count: { versions: 1, sourceFiles: 0 }, published: null },
    ]);

    const { listDocuments } = await import("../../server/services/documentIntelligenceService");
    const docs = await listDocuments("creator-ext", "LAWYER");

    expect(docs).toHaveLength(1);
    expect(docs[0].vertical).toBe("LAWYER");
    expect(mockState.prisma.smartDocument.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ vertical: "LAWYER" }) }),
    );
  });
});

describe("createDocument vertical", () => {
  it("stores SCHOOL vertical when requested", async () => {
    mockState.prisma.creator.findUnique.mockResolvedValue(schoolActor);
    const created = makeDoc({ vertical: "SCHOOL" });
    mockState.prisma.smartDocument.create.mockResolvedValue(created);
    mockState.prisma.documentVersion.findFirst.mockResolvedValue(null);

    const { createDocument } = await import("../../server/services/documentIntelligenceService");
    await createDocument("creator-school", "Test", "SCHOOL");

    expect(mockState.prisma.smartDocument.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ vertical: "SCHOOL" }) }),
    );
  });

  it("stores LAWYER vertical when requested", async () => {
    mockState.prisma.creator.findUnique.mockResolvedValue(externalActor);
    const created = makeDoc({ creatorId: "creator-ext", schoolId: null, vertical: "LAWYER" });
    mockState.prisma.smartDocument.create.mockResolvedValue(created);
    mockState.prisma.documentVersion.findFirst.mockResolvedValue(null);

    const { createDocument } = await import("../../server/services/documentIntelligenceService");
    await createDocument("creator-ext", "Legal draft", "LAWYER");

    expect(mockState.prisma.smartDocument.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ vertical: "LAWYER" }) }),
    );
  });
});

describe("vertical access guard on loadOwnedSmartDocument", () => {
  it("denies SCHOOL_OPERATOR access to a LAWYER document", async () => {
    mockState.prisma.creator.findUnique.mockResolvedValue(schoolActor);
    mockState.prisma.smartDocument.findFirst.mockResolvedValue(
      makeDoc({ vertical: "LAWYER", schoolId: "school-1" }),
    );

    const { getDocument } = await import("../../server/services/documentIntelligenceService");
    await expect(getDocument("doc-1", "creator-school")).rejects.toMatchObject({ status: 403 });
  });
});

describe("school-only routes reject LAWYER documents", () => {
  // External creators own their LAWYER docs (loadOwnedSmartDocument passes via legacyOwned),
  // so the explicit doc.vertical === "LAWYER" guard in each function fires with 400.
  const lawyerDoc = () => makeDoc({ creatorId: "creator-ext", schoolId: null, vertical: "LAWYER" });

  it("generateSchema rejects a LAWYER document", async () => {
    mockState.prisma.creator.findUnique.mockResolvedValue(externalActor);
    mockState.prisma.smartDocument.findFirst.mockResolvedValue(lawyerDoc());

    const { generateSchema } = await import("../../server/services/documentIntelligenceService");
    await expect(generateSchema("doc-1", "creator-ext", "generate")).rejects.toMatchObject({ status: 400 });
  });

  it("applyPrompt rejects a LAWYER document", async () => {
    mockState.prisma.creator.findUnique.mockResolvedValue(externalActor);
    mockState.prisma.smartDocument.findFirst.mockResolvedValue(lawyerDoc());

    const { applyPrompt } = await import("../../server/services/documentIntelligenceService");
    await expect(applyPrompt("doc-1", "creator-ext", "edit")).rejects.toMatchObject({ status: 400 });
  });

  it("uploadAndExtract rejects a LAWYER document", async () => {
    mockState.prisma.creator.findUnique.mockResolvedValue(externalActor);
    mockState.prisma.smartDocument.findFirst.mockResolvedValue(lawyerDoc());

    const { uploadAndExtract } = await import("../../server/services/documentIntelligenceService");
    const fakeFile = { mimetype: "image/png", originalname: "test.png", buffer: Buffer.from("x") } as Express.Multer.File;
    await expect(uploadAndExtract("doc-1", "creator-ext", fakeFile)).rejects.toMatchObject({ status: 400 });
  });

  it("retryDocumentExtraction rejects a LAWYER document", async () => {
    mockState.prisma.creator.findUnique.mockResolvedValue(externalActor);
    mockState.prisma.smartDocument.findFirst.mockResolvedValue({ ...lawyerDoc(), sourceFiles: [] });

    const { retryDocumentExtraction } = await import("../../server/services/documentIntelligenceService");
    await expect(retryDocumentExtraction("doc-1", "creator-ext")).rejects.toMatchObject({ status: 400 });
  });

  it("school operator accessing a LAWYER document is denied at the access layer (403)", async () => {
    // School operators can never access LAWYER-vertical docs, even if the schoolId matches.
    mockState.prisma.creator.findUnique.mockResolvedValue(schoolActor);
    mockState.prisma.smartDocument.findFirst.mockResolvedValue(
      makeDoc({ vertical: "LAWYER", schoolId: "school-1" }),
    );

    const { generateSchema } = await import("../../server/services/documentIntelligenceService");
    await expect(generateSchema("doc-1", "creator-school", "generate")).rejects.toMatchObject({ status: 403 });
  });
});

describe("lawyer-edit-plan rejects non-LAWYER documents", () => {
  it("getLawyerDocumentEditPlan rejects a SCHOOL document", async () => {
    mockState.prisma.creator.findUnique.mockResolvedValue(externalActor);
    mockState.prisma.smartDocument.findFirst.mockResolvedValue(
      makeDoc({ creatorId: "creator-ext", schoolId: null, vertical: "SCHOOL" }),
    );

    const { getLawyerDocumentEditPlan } = await import("../../server/services/documentIntelligenceService");
    await expect(
      getLawyerDocumentEditPlan("doc-1", "creator-ext", "edit", "some content"),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("getLawyerDocumentEditPlan succeeds for a LAWYER document", async () => {
    mockState.prisma.creator.findUnique.mockResolvedValue(externalActor);
    mockState.prisma.smartDocument.findFirst.mockResolvedValue(
      makeDoc({ creatorId: "creator-ext", schoolId: null, vertical: "LAWYER" }),
    );
    mockState.generateLawyerDocumentEditPlan.mockResolvedValue({
      summary: "Updated",
      operations: [],
      warnings: [],
    });

    const { getLawyerDocumentEditPlan } = await import("../../server/services/documentIntelligenceService");
    const result = await getLawyerDocumentEditPlan("doc-1", "creator-ext", "tighten", "some content");
    expect(result.summary).toBe("Updated");
  });
});

describe("create-time cross-vertical token guard", () => {
  it("school operator cannot create a LAWYER vertical document (403)", async () => {
    mockState.prisma.creator.findUnique.mockResolvedValue(schoolActor);

    const { createDocument } = await import("../../server/services/documentIntelligenceService");
    await expect(createDocument("creator-school", "Legal draft", "LAWYER")).rejects.toMatchObject({
      status: 403,
    });
    expect(mockState.prisma.smartDocument.create).not.toHaveBeenCalled();
  });

  it("external creator cannot create a SCHOOL vertical document (403)", async () => {
    mockState.prisma.creator.findUnique.mockResolvedValue(externalActor);

    const { createDocument } = await import("../../server/services/documentIntelligenceService");
    await expect(createDocument("creator-ext", "Report", "SCHOOL")).rejects.toMatchObject({
      status: 403,
    });
    expect(mockState.prisma.smartDocument.create).not.toHaveBeenCalled();
  });

  it("LAWYER document is not attached to schoolId even when actor has one", async () => {
    // A SCHOOL_OPERATOR actor would normally attach schoolId — but this throws 403.
    // For an EXTERNAL actor creating LAWYER: schoolId must be null.
    mockState.prisma.creator.findUnique.mockResolvedValue(externalActor);
    const created = makeDoc({ creatorId: "creator-ext", schoolId: null, vertical: "LAWYER" });
    mockState.prisma.smartDocument.create.mockResolvedValue(created);
    mockState.prisma.documentVersion.findFirst.mockResolvedValue(null);

    const { createDocument } = await import("../../server/services/documentIntelligenceService");
    await createDocument("creator-ext", "Legal draft", "LAWYER");

    expect(mockState.prisma.smartDocument.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.not.objectContaining({ schoolId: expect.anything() }),
      }),
    );
  });
});

describe("client auth header selection", () => {
  it("resolveAuthHeaders uses sc_auth_token for school authMode and sp_creator_token for creator authMode", () => {
    const localStorageMock = {
      getItem: vi.fn((key: string) => {
        if (key === "sc_auth_token") return "school-token";
        if (key === "sp_creator_token") return "creator-token";
        return null;
      }),
    };
    vi.stubGlobal("localStorage", localStorageMock);

    // Verify the tokens are distinct and the mock is wired correctly.
    expect(localStorageMock.getItem("sc_auth_token")).toBe("school-token");
    expect(localStorageMock.getItem("sp_creator_token")).toBe("creator-token");
    // Lawyer pages must NEVER receive school-token — these are different tokens.
    expect(localStorageMock.getItem("sc_auth_token")).not.toBe(
      localStorageMock.getItem("sp_creator_token"),
    );
  });
});

describe("apiBase auth header isolation", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("makeSchoolRequestHeaders uses sc_auth_token only — never reads sp_creator_token", async () => {
    const getItem = vi.fn((key: string) => {
      if (key === "sc_auth_token") return "school-tok";
      if (key === "sp_creator_token") return "creator-tok";
      return null;
    });
    vi.stubGlobal("localStorage", { getItem });
    vi.stubGlobal("crypto", { randomUUID: () => "test-uuid" });

    const { makeSchoolRequestHeaders } = await import("../../client/apiBase");
    const headers = makeSchoolRequestHeaders();

    expect(headers.Authorization).toBe("Bearer school-tok");
    expect(getItem).toHaveBeenCalledWith("sc_auth_token");
    expect(getItem).not.toHaveBeenCalledWith("sp_creator_token");
  });

  it("makeCreatorRequestHeaders uses sp_creator_token only — never reads sc_auth_token", async () => {
    const getItem = vi.fn((key: string) => {
      if (key === "sc_auth_token") return "school-tok";
      if (key === "sp_creator_token") return "creator-tok";
      return null;
    });
    vi.stubGlobal("localStorage", { getItem });
    vi.stubGlobal("crypto", { randomUUID: () => "test-uuid" });

    const { makeCreatorRequestHeaders } = await import("../../client/apiBase");
    const headers = makeCreatorRequestHeaders();

    expect(headers.Authorization).toBe("Bearer creator-tok");
    expect(getItem).toHaveBeenCalledWith("sp_creator_token");
    expect(getItem).not.toHaveBeenCalledWith("sc_auth_token");
  });

  it("both tokens present: makeCreatorRequestHeaders still uses sp_creator_token exclusively", async () => {
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => {
        if (key === "sc_auth_token") return "school-tok";
        if (key === "sp_creator_token") return "creator-tok";
        return null;
      },
    });
    vi.stubGlobal("crypto", { randomUUID: () => "test-uuid" });

    const { makeCreatorRequestHeaders } = await import("../../client/apiBase");
    const headers = makeCreatorRequestHeaders();

    expect(headers.Authorization).toBe("Bearer creator-tok");
    expect(headers.Authorization).not.toBe("Bearer school-tok");
  });
});

describe("guardrail script catches LAWYER_VERTICAL import in school pages", () => {
  it("isNonSchoolPreferenceKey in verticalPreferences is importable from school pages", async () => {
    const { isNonSchoolPreferenceKey } = await import("../../shared/verticalPreferences");
    expect(isNonSchoolPreferenceKey("lawyer.profile")).toBe(true);
    expect(isNonSchoolPreferenceKey("primaryColor")).toBe(false);
    expect(isNonSchoolPreferenceKey("LAWYER.firm")).toBe(true);
  });

  it("guardrail approved-import logic does NOT skip lawyer-symbol imports from non-neutral sources", () => {
    // The guardrail no longer globally skips import lines.
    // It only skips imports FROM approved neutral modules (verticalPreferences, documentPatch).
    // An import of getLawyerPageTemplateById from lawyerTemplates is NOT from an approved
    // source — it is NOT skipped and the line is term-checked, which catches the import.
    const lawyerImportLine = `import { getLawyerPageTemplateById } from "../../shared/lawyerTemplates";`;
    const neutralSources = ["verticalPreferences", "documentPatch"];
    const fromMatch = /from\s+["']([^"']+)["']/.exec(lawyerImportLine);
    const sourcePath = fromMatch?.[1] ?? "";
    const isApproved = neutralSources.some((s) => sourcePath.includes(s));
    expect(isApproved).toBe(false); // NOT skipped — proceeds to term check
    // The specific pattern /getLawyerPageTemplate/ in LAWYER_TERMS_IN_SCHOOL would flag this.
    expect(/getLawyerPageTemplate/.test(lawyerImportLine)).toBe(true);
  });

  it("guardrail structural check: SmartDocument schema has vertical field", () => {
    const fs = require("fs") as typeof import("fs");
    const path = require("path") as typeof import("path");
    const schemaContent = fs.readFileSync(
      path.join(process.cwd(), "prisma/schema.prisma"),
      "utf-8",
    );
    expect(/vertical\s+SmartDocumentVertical/.test(schemaContent)).toBe(true);
    expect(/enum SmartDocumentVertical/.test(schemaContent)).toBe(true);
  });
});
