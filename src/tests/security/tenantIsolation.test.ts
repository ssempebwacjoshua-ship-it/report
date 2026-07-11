import express from "express";
import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";

const SCHOOL_A = { id: "school-a", code: "SCHOOL-A", name: "School A" };
const SCHOOL_B = { id: "school-b", code: "SCHOOL-B", name: "School B" };
const USER_A = { id: "user-a", schoolId: SCHOOL_A.id, role: "ADMIN_OPERATOR" };
const MOCKED_MODULES = [
  "../../server/db/prisma",
  "../../server/middleware/requireAuth",
  "../../server/repositories/reportsRepository",
  "../../server/repositories/settingsRepository",
  "../../server/services/documentGeminiService",
  "../../server/services/documentOcrPreprocessService",
  "../../server/services/documentOsService",
  "../../server/services/reportEngine",
  "../../server/services/scanImportValidator",
  "../../server/services/subjectProvisioningService",
];

function scanContext() {
  return {
    marksheetId: "MS-1",
    className: "Senior 1",
    streamName: "A",
    subjectName: "Math",
    termName: "Term 1",
    examType: "BOT",
    academicYear: "2026",
  };
}

function mountSchoolApp(routerFactory: () => express.Router, school = SCHOOL_A, user: unknown = USER_A) {
  const app = express();
  app.use(express.json());
  app.use((req: any, _res, next) => {
    req.school = school;
    req.user = user;
    next();
  });
  app.use(routerFactory());
  return app;
}

afterEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  for (const modulePath of MOCKED_MODULES) {
    vi.doUnmock(modulePath);
  }
});

describe("tenant isolation", () => {
  it("blocks School A dry-run from updating School B scan batch", async () => {
    const prisma = {
      classEnrollment: { findMany: vi.fn(async () => []) },
      auditLog: { create: vi.fn(async () => ({})) },
      markImportBatch: {
        findFirst: vi.fn(async () => null),
        update: vi.fn(async () => ({})),
      },
    };

    vi.doMock("../../server/db/prisma", () => ({ prisma }));
    vi.doMock("../../server/repositories/settingsRepository", () => ({
      getSettingsSections: vi.fn(async () => ({
        ocr: { minimumConfidenceForSuggestion: 0.6 },
        approval: { keepAuditTrail: false, requireDryRunBeforeCommit: false },
      })),
    }));
    vi.doMock("../../server/services/scanImportValidator", () => ({
      parseScanMark: vi.fn((value: string) => value),
      validateScanRows: vi.fn(() => []),
    }));

    const { importsRoutes } = await import("../../server/routes/importsRoutes");
    const app = mountSchoolApp(importsRoutes);

    const res = await request(app)
      .post("/api/imports/scans/dry-run")
      .send({ batchId: "batch-b", context: scanContext(), rows: [] });

    expect(res.status).toBe(404);
    expect(res.body.code).toBe("BATCH_NOT_FOUND");
    expect(res.body.message).toBe("Scan batch not found.");
    expect(prisma.markImportBatch.update).not.toHaveBeenCalled();
  });

  it("blocks School A from reloading School B scan batch", async () => {
    const prisma = {
      markImportBatch: { findFirst: vi.fn(async () => null) },
      markImportRow: { findMany: vi.fn(async () => []) },
    };

    vi.doMock("../../server/db/prisma", () => ({ prisma }));
    const { importsRoutes } = await import("../../server/routes/importsRoutes");
    const app = mountSchoolApp(importsRoutes);

    const res = await request(app).get("/api/imports/scan-batches/batch-b");

    expect(res.status).toBe(404);
    expect(res.body.message).toMatch(/not found/i);
    expect(prisma.markImportRow.findMany).not.toHaveBeenCalled();
  });

  it("blocks School A from committing School B scan batch and leaves School B data unchanged", async () => {
    const batchB = {
      id: "batch-b",
      schoolId: SCHOOL_B.id,
      status: "DRY_RUN",
      summary: JSON.stringify({ owner: "school-b", committedRows: 0 }),
    };
    const rowsB = [{ batchId: "batch-b", rowNumber: 1, raw: { admissionNumber: "B-1", mark: "91" } }];
    const marksB = [{ schoolId: SCHOOL_B.id, studentId: "student-b", importBatchId: "batch-b", marks: 91 }];

    const prisma = {
      markImportBatch: {
        findFirst: vi.fn(async () => null),
        create: vi.fn(async () => ({ id: "batch-a" })),
        update: vi.fn(async () => batchB),
      },
      markImportRow: {
        deleteMany: vi.fn(async () => ({ count: 0 })),
        createMany: vi.fn(async () => ({ count: 0 })),
      },
      subjectMark: { upsert: vi.fn(async () => ({})) },
      academicYear: { findMany: vi.fn(async () => []) },
      schoolClass: { findMany: vi.fn(async () => []) },
      subject: { findMany: vi.fn(async () => []) },
      classEnrollment: { findMany: vi.fn(async () => []) },
      reportLabSubscription: {
        findUnique: vi.fn(async () => ({ status: "ACTIVE", currentPeriodEnd: new Date("2030-01-01T00:00:00.000Z") })),
      },
      auditLog: { findFirst: vi.fn(async () => ({ id: "audit-1" })) },
    };

    vi.doMock("../../server/db/prisma", () => ({ prisma }));
    vi.doMock("../../server/repositories/settingsRepository", () => ({
      getSettingsSections: vi.fn(async () => ({
        ocr: { minimumConfidenceForSuggestion: 0.6 },
        approval: { keepAuditTrail: false, requireDryRunBeforeCommit: false },
      })),
    }));
    vi.doMock("../../server/services/scanImportValidator", () => ({
      parseScanMark: vi.fn((value: string) => value),
      validateScanRows: vi.fn(() => []),
    }));

    const { importsRoutes } = await import("../../server/routes/importsRoutes");
    const app = mountSchoolApp(importsRoutes);

    const res = await request(app)
      .post("/api/imports/scans/commit")
      .send({ batchId: "batch-b", context: scanContext(), rows: [] });

    expect(res.status).toBe(404);
    expect(res.body.code).toBe("BATCH_NOT_FOUND");
    expect(batchB.summary).toBe(JSON.stringify({ owner: "school-b", committedRows: 0 }));
    expect(rowsB).toEqual([{ batchId: "batch-b", rowNumber: 1, raw: { admissionNumber: "B-1", mark: "91" } }]);
    expect(marksB).toEqual([{ schoolId: SCHOOL_B.id, studentId: "student-b", importBatchId: "batch-b", marks: 91 }]);
    expect(prisma.markImportBatch.create).not.toHaveBeenCalled();
    expect(prisma.markImportBatch.update).not.toHaveBeenCalled();
    expect(prisma.markImportRow.deleteMany).not.toHaveBeenCalled();
    expect(prisma.markImportRow.createMany).not.toHaveBeenCalled();
    expect(prisma.subjectMark.upsert).not.toHaveBeenCalled();
  });

  it("blocks School A from reading School B student data", async () => {
    const prisma = {
      school: {
        findUnique: vi.fn(async ({ where }: any) => (
          where.code === SCHOOL_A.code
            ? {
                id: SCHOOL_A.id,
                academicYears: [{ id: "year-a", isActive: true, terms: [{ id: "term-a", isActive: true }] }],
              }
            : null
        )),
      },
      classEnrollment: {
        findMany: vi.fn(async ({ where }: any) => {
          if (where.schoolId === SCHOOL_A.id && where.studentId === "student-a") {
            return [{
              id: "enroll-a",
              studentId: "student-a",
              classId: "class-a",
              streamId: "stream-a",
              academicYearId: "year-a",
              termId: "term-a",
              status: "ACTIVE",
              student: {
                id: "student-a",
                admissionNumber: "A-1",
                firstName: "Alice",
                lastName: "A",
                isActive: true,
                guardianContacts: [],
              },
            }];
          }
          return [];
        }),
      },
      schoolClass: { findMany: vi.fn(async () => [{ id: "class-a", name: "Senior 1" }]) },
      stream: { findMany: vi.fn(async () => [{ id: "stream-a", name: "A", code: "A" }]) },
    };

    const { getEnrolledStudent } = await import("../../server/repositories/studentRepository");
    const result = await getEnrolledStudent(prisma as any, SCHOOL_A.code, "student-b");

    expect(result).toBeNull();
  });

  it("keeps release-center issued report queries scoped to School A", async () => {
    const prisma = {
      guardianContact: { findMany: vi.fn(async () => []) },
      issuedReport: { findMany: vi.fn(async () => []) },
    };

    vi.doMock("../../server/db/prisma", () => ({ prisma }));
    vi.doMock("../../server/middleware/requireAuth", () => ({
      requireAuth: (_req: unknown, _res: unknown, next: () => void) => next(),
    }));
    vi.doMock("../../server/repositories/settingsRepository", () => ({
      getSettingsSections: vi.fn(async () => ({
        academic: { defaultAssessmentType: "TERM_SUMMARY" },
        school: { schoolName: SCHOOL_A.name },
      })),
    }));
    vi.doMock("../../server/repositories/reportsRepository", () => ({
      loadReportEngineInput: vi.fn(async () => ({
        students: [{ id: "student-b", admissionNumber: "B-1", firstName: "Bob", lastName: "B" }],
        academicYearName: "2026",
        termName: "Term 1",
        subjects: [],
        marks: [],
        promotionsByStudentId: {},
        settings: {},
      })),
    }));
    vi.doMock("../../server/services/reportEngine", () => ({
      buildReports: vi.fn(() => ({ cards: [{ studentId: "student-b", studentName: "Bob B", readiness: "READY" }] })),
    }));

    const { releaseCenterRoutes } = await import("../../server/routes/releaseCenterRoutes");
    const app = mountSchoolApp(releaseCenterRoutes);

    const res = await request(app).get("/api/reports/release-status").query({ classId: "class-b" });

    expect(res.status).toBe(200);
    expect(prisma.issuedReport.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ schoolId: SCHOOL_A.id }),
      }),
    );
  });

  it("blocks School A from deleting School B school-structure streams", async () => {
    const prisma = {
      schoolClass: { findMany: vi.fn(async () => []) },
      stream: {
        findFirst: vi.fn(async () => null),
        findMany: vi.fn(async () => []),
        deleteMany: vi.fn(async () => ({ count: 0 })),
      },
      classEnrollment: { count: vi.fn(async () => 0) },
      subjectMark: { count: vi.fn(async () => 0) },
    };

    vi.doMock("../../server/db/prisma", () => ({ prisma }));
    vi.doMock("../../server/repositories/settingsRepository", () => ({
      getSettingsSections: vi.fn(async () => ({ school: { schoolSections: ["SECONDARY"] } })),
      patchSettingsSection: vi.fn(async () => ({})),
    }));
    vi.doMock("../../server/services/subjectProvisioningService", () => ({
      ensureDefaultSubjectsForSections: vi.fn(async () => ({})),
    }));

    const { schoolStructureRoutes } = await import("../../server/routes/schoolStructureRoutes");
    const app = mountSchoolApp(schoolStructureRoutes);

    const res = await request(app).delete("/api/settings/school-structure/streams/stream-b");

    expect(res.status).toBe(404);
    expect(prisma.stream.deleteMany).not.toHaveBeenCalled();
  });

  it("blocks School A from School B NFC wallet, tag, and credential data", async () => {
    const { assignTag } = await import("../../server/services/nfcTagsService");
    const { getStudentWalletDetail } = await import("../../server/services/nfcOperationsService");
    const { getCredentialAllocation } = await import("../../server/services/studentCredentialService");

    await expect(assignTag(
      { schoolId: SCHOOL_A.id, actorId: "user-a", role: "ADMIN_OPERATOR" },
      "tag-b",
      { studentId: "student-b" },
      {
        nfcTag: { findFirst: vi.fn(async () => null) },
        student: { findFirst: vi.fn(async () => null) },
        nfcTapEvent: { findMany: vi.fn(async () => []) },
        auditLog: { create: vi.fn(async () => ({})) },
      } as any,
    )).rejects.toMatchObject({ status: 404 });

    await expect(getStudentWalletDetail(
      { schoolId: SCHOOL_A.id, actorId: "user-a", role: "ADMIN_OPERATOR" },
      "student-b",
      {
        student: { findFirst: vi.fn(async () => null) },
        studentWallet: { findFirst: vi.fn(async () => null) },
        studentWalletTransaction: { findMany: vi.fn(async () => []) },
      } as any,
    )).rejects.toMatchObject({ status: 404 });

    const allocation = await getCredentialAllocation(
      { schoolId: SCHOOL_A.id, actorId: "user-a" },
      { search: "student-b" },
      {
        student: { findMany: vi.fn(async () => []) },
      } as any,
    );

    expect(allocation.rows).toEqual([]);
  });

  it("does not reuse School B Smart Pages extraction cache for School A", async () => {
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
    const smartPageLedgerCreate = vi.fn(async () => ({}));
    const schoolSmartPagePlanUpdateMany = vi.fn(async () => ({ count: 1 }));

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
        updateMany: schoolSmartPagePlanUpdateMany,
      },
      smartPageLedger: {
        findFirst: vi.fn(async () => null),
        create: smartPageLedgerCreate,
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
});
