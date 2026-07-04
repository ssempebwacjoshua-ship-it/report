import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const integrationMocks = vi.hoisted(() => ({
  requirePlatformModule: vi.fn(),
  recordPlatformUsage: vi.fn(),
  attachUsageWarning: vi.fn(),
}));

const prismaMocks = vi.hoisted(() => ({
  markImportBatch: {
    findFirst: vi.fn(),
    update: vi.fn(),
  },
  auditLog: {
    create: vi.fn(),
  },
}));

const marksMocks = vi.hoisted(() => ({
  commitMarksImport: vi.fn(),
  dryRunMarksImport: vi.fn(),
}));

const smartMocks = vi.hoisted(() => ({
  requireCreator: vi.fn(),
  createDocument: vi.fn(),
  generateSchema: vi.fn(),
  uploadAndExtract: vi.fn(),
  retryDocumentExtraction: vi.fn(),
  updateExtractedKnowledge: vi.fn(),
  applyPrompt: vi.fn(),
  createManualDocumentVersion: vi.fn(),
  restoreVersion: vi.fn(),
  getVersionHistory: vi.fn(),
  publishDocument: vi.fn(),
  listDocuments: vi.fn(),
  getDocument: vi.fn(),
  getPublishedDocument: vi.fn(),
  downloadPublishedDocumentPdf: vi.fn(),
}));

const nfcMocks = vi.hoisted(() => ({
  createUrlTagBatch: vi.fn(),
  bulkImportUids: vi.fn(),
  bulkAllocateFromInventory: vi.fn(),
  generateTags: vi.fn(),
  listTagBatches: vi.fn(),
  listTagInventory: vi.fn(),
  listTags: vi.fn(),
  assignTag: vi.fn(),
  unassignTag: vi.fn(),
  enableTag: vi.fn(),
  disableTag: vi.fn(),
  verifyTag: vi.fn(),
  amendTag: vi.fn(),
  getTagEvents: vi.fn(),
  getAttendanceDashboard: vi.fn(),
  getAttendanceRegister: vi.fn(),
  listAttendanceClasses: vi.fn(),
  getSchoolNfcPolicy: vi.fn(),
  updateSchoolNfcPolicy: vi.fn(),
  listStudentFeeHolds: vi.fn(),
  searchNfcFeeHoldStudents: vi.fn(),
  createStudentFeeHold: vi.fn(),
  clearStudentFeeHold: vi.fn(),
  scanAttendance: vi.fn(),
  getWalletDashboard: vi.fn(),
  resolveWalletStudent: vi.fn(),
  topUpWallet: vi.fn(),
  getStudentWalletDetail: vi.fn(),
  listWalletTransactions: vi.fn(),
  reverseTransaction: vi.fn(),
  adjustWallet: vi.fn(),
  getDailySummary: vi.fn(),
  getGateDashboard: vi.fn(),
  scanGate: vi.fn(),
  getStudentWalletPinStatus: vi.fn(),
  setStudentWalletPin: vi.fn(),
  getWalletPinStatus: vi.fn(),
  setWalletPin: vi.fn(),
  changeWalletPin: vi.fn(),
  chargeCanteen: vi.fn(),
  getCanteenReconciliation: vi.fn(),
  closeCanteenReconciliation: vi.fn(),
  approveCanteenReconciliation: vi.fn(),
  rejectCanteenReconciliation: vi.fn(),
}));

vi.mock("../../server/platformIntegration", () => integrationMocks);
vi.mock("../../server/db/prisma", () => ({
  prisma: prismaMocks,
}));
vi.mock("../../server/services/marksImportService", () => marksMocks);
vi.mock("../../server/middleware/requireCreator", () => ({
  requireCreator: (req: any, _res: any, next: any) => {
    req.creator = {
      id: "creator-1",
      type: "SCHOOL_OPERATOR",
      email: "operator@example.com",
      name: "Operator",
      schoolId: "school-1",
    };
    next();
  },
}));
vi.mock("../../server/services/documentIntelligenceService", () => smartMocks);
vi.mock("../../server/services/nfcTagBatchService", () => nfcMocks);
vi.mock("../../server/services/nfcTagsService", () => nfcMocks);
vi.mock("../../server/services/nfcOperationsService", () => nfcMocks);
vi.mock("../../server/services/nfcCanteenReconciliationService", () => nfcMocks);

import { marksheetsRoutes } from "../../server/routes/marksheetsRoutes";
import { documentIntelligenceRoutes } from "../../server/routes/documentIntelligenceRoutes";
import { nfcTagsRoutes } from "../../server/routes/nfcTagsRoutes";

function buildApp(routes: express.Router, mountPath = "") {
  const app = express();
  app.use(express.json());
  app.use((req: any, _res, next) => {
    req.school = { id: "school-1", code: "SCH-1", name: "Preview School" };
    req.user = { userId: "user-1", schoolId: "school-1", role: "ADMIN_OPERATOR" };
    next();
  });
  app.use(mountPath, routes);
  app.use((error: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(error?.status ?? 500).json(error?.responseBody ?? { error: error?.message ?? "Unexpected error" });
  });
  return app;
}

describe("platform integration routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    integrationMocks.requirePlatformModule.mockResolvedValue(true);
    integrationMocks.recordPlatformUsage.mockResolvedValue(null);
    prismaMocks.markImportBatch.findFirst.mockResolvedValue({ id: "batch-1", summary: null });
    prismaMocks.markImportBatch.update.mockResolvedValue({ id: "batch-1" });
    prismaMocks.auditLog.create.mockResolvedValue({ id: "audit-1" });
    marksMocks.commitMarksImport.mockResolvedValue({
      status: "COMMITTED",
      batchId: "batch-1",
      totalRows: 1,
      validRows: 1,
      invalidRows: 0,
      rows: [],
    });
    marksMocks.dryRunMarksImport.mockResolvedValue({
      status: "DRY_RUN",
      totalRows: 1,
      validRows: 1,
      invalidRows: 0,
      rows: [],
    });
    smartMocks.createDocument.mockResolvedValue({ id: "doc-1" });
    smartMocks.generateSchema.mockResolvedValue({
      versionId: "version-1",
      schema: {},
      componentTree: [],
    });
    nfcMocks.generateTags.mockResolvedValue({
      tags: [{ id: "tag-1" }, { id: "tag-2" }],
      generated: 2,
    });
  });

  it("blocks marks import when entitlement is missing", async () => {
    integrationMocks.requirePlatformModule.mockImplementationOnce(async (_req, res) => {
      res.status(403).json({ error: "MODULE_NOT_ENABLED" });
      return false;
    });

    const app = buildApp(marksheetsRoutes());
    const res = await request(app).post("/api/marksheets/commit").send({
      csvText: "admissionNumber,class,stream,subject,term,examType,marks\n1,A,A,Math,Term 1,BOT,80",
      context: {
        className: "Senior 1",
        streamName: "A",
        subjectName: "Math",
        termName: "Term 1",
        examType: "BOT",
        operatorName: "Operator",
        studentsCount: 1,
        marksEntered: 1,
      },
    });

    expect(res.status).toBe(403);
    expect(integrationMocks.recordPlatformUsage).not.toHaveBeenCalled();
  });

  it("records marks import usage after success", async () => {
    const app = buildApp(marksheetsRoutes());
    const res = await request(app).post("/api/marksheets/commit").send({
      csvText: "admissionNumber,class,stream,subject,term,examType,marks\n1,A,A,Math,Term 1,BOT,80",
      context: {
        className: "Senior 1",
        streamName: "A",
        subjectName: "Math",
        termName: "Term 1",
        examType: "BOT",
        operatorName: "Operator",
        studentsCount: 1,
        marksEntered: 1,
      },
    });

    expect(res.status).toBe(200);
    expect(integrationMocks.recordPlatformUsage).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      moduleCode: "report_lab.marks_import",
      sourceType: "marks_import",
      sourceId: "batch-1",
    }));
  });

  it("records Smart Pages generation usage after success", async () => {
    const app = buildApp(documentIntelligenceRoutes(), "/api/smart-documents");
    const res = await request(app).post("/api/smart-documents/doc-1/generate").send({ intent: "Generate a report" });

    expect(res.status).toBe(200);
    expect(integrationMocks.recordPlatformUsage).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      moduleCode: "smart_pages.document_generation",
      sourceType: "smart_pages_generation",
      sourceId: "version-1",
    }));
  });

  it("records NFC tag issue usage after success", async () => {
    const app = buildApp(nfcTagsRoutes());
    const res = await request(app).post("/api/nfc/tags/generate").send({ count: 2 });

    expect(res.status).toBe(201);
    expect(integrationMocks.recordPlatformUsage).toHaveBeenCalledTimes(2);
    expect(integrationMocks.recordPlatformUsage).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      moduleCode: "nfc.tags",
      sourceType: "nfc_tag_issue",
    }));
  });
});
