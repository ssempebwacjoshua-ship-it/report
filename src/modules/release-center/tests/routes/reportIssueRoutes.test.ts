import express from "express";
import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ZodError } from "zod";
import { COMMENT_LIMITS } from "../../../../shared/utils/reportComments";

const VALID_STUDENT_ID = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";

function buildCreatedIssuedReport(id: string) {
  return {
    id,
    referenceCode: "20260719-ABC123",
    publicShortCode: "SHORT1234",
    assessmentType: "EOT",
    issuedAt: new Date("2026-07-19T00:00:00.000Z"),
  };
}

function mountReportIssueApp(prisma: any, overrides: { cardReadiness?: "READY" | "MISSING_MARKS" | "NO_FINALIZED_MARKS" } = {}) {
  prisma.reportLabSubscription ??= {
    findUnique: vi.fn(async () => ({ status: "ACTIVE", currentPeriodEnd: new Date("2030-01-01T00:00:00.000Z") })),
  };
  vi.doMock("../../../../server/db/prisma", () => ({ prisma }));
  vi.doMock("../../../../server/middleware/requireAuth", () => ({
    requireAuth: (req: any, _res: any, next: () => void) => {
      req.user = { userId: "user-1", schoolId: "school-1", name: "Admin" };
      req.school = { id: "school-1", code: "SCU-PREVIEW" };
      next();
    },
  }));
  vi.doMock("../../../../server/repositories/settingsRepository", () => ({
    getSettingsSections: vi.fn(async () => ({
      academic: { defaultAssessmentType: "EOT" },
    })),
  }));
  vi.doMock("../../../../server/repositories/reportsRepository", () => ({
    loadReportEngineInput: vi.fn(async () => ({
      filters: { schoolCode: "SCU-PREVIEW", classId: "00000000-0000-0000-0000-000000000002", studentId: VALID_STUDENT_ID, assessmentType: "EOT" },
      academicYearName: "2025/2026",
      termName: "Term 1",
      hasActiveTerm: true,
      students: [],
      subjects: [],
      marks: [],
      promotionsByStudentId: {},
      settings: {
        school: { schoolName: "Preview School", schoolCode: "SCU-PREVIEW", address: "", phone: "", email: "", website: "", headTeacherName: "HT", reportFooterText: "Footer", marksheetFooterText: "", logoUrl: "", schoolSections: ["SECONDARY"] },
        reports: { showOverallPosition: false, showClassAverage: false, showGradeKey: false, showSchoolLogo: false, printDensity: "compact", signatureMode: "name_and_signature_line", defaultHmCommentTemplate: "", defaultClassTeacherCommentTemplate: "" },
        grading: { grades: [] },
      },
    })),
  }));
  vi.doMock("../../../../server/services/reportEngine", () => ({
    buildReports: vi.fn(() => ({
      settings: {
        school: { schoolName: "Preview School", schoolCode: "SCU-PREVIEW", address: "", phone: "", email: "", website: "", headTeacherName: "HT", reportFooterText: "Footer", marksheetFooterText: "", logoUrl: "", schoolSections: ["SECONDARY"] },
        reports: { showOverallPosition: false, showClassAverage: false, showGradeKey: false, showSchoolLogo: false, printDensity: "compact", signatureMode: "name_and_signature_line", defaultHmCommentTemplate: "", defaultClassTeacherCommentTemplate: "" },
        grading: { grades: [] },
      },
      cards: [{
        studentId: VALID_STUDENT_ID,
        admissionNumber: "ADM-1",
        studentName: "Ada Lovelace",
        className: "S1",
        streamName: "A",
        academicYear: "2025/2026",
        term: "Term 1",
        marksFound: 0,
        totalSubjects: 0,
        average: null,
        grade: null,
        overallPosition: null,
        readiness: overrides.cardReadiness ?? "READY",
        missingMarks: [],
        comments: "",
        contactReadiness: "READY",
        contactSummary: "",
        subjects: [],
        progressionText: null,
      }],
    })),
  }));

  return import("../../../../server/routes/reportIssueRoutes").then(({ reportIssueRoutes }) => {
    const app = express();
    app.use(express.json());
    app.use(reportIssueRoutes());
    app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
      if (error instanceof ZodError) {
        res.status(400).json({ error: true, message: "Invalid request" });
        return;
      }
      res.status(500).json({ error: true, message: error instanceof Error ? error.message : "Unexpected error" });
    });
    return app;
  });
}

async function mountReportIssueAndParentApp(prisma: any, overrides: { cardReadiness?: "READY" | "MISSING_MARKS" | "NO_FINALIZED_MARKS" } = {}) {
  prisma.reportLabSubscription ??= {
    findUnique: vi.fn(async () => ({ status: "ACTIVE", currentPeriodEnd: new Date("2030-01-01T00:00:00.000Z") })),
  };
  vi.doMock("../../../../server/db/prisma", () => ({ prisma }));
  vi.doMock("../../../../server/middleware/requireAuth", () => ({
    requireAuth: (req: any, _res: any, next: () => void) => {
      req.user = { userId: "user-1", schoolId: "school-1", name: "Admin" };
      req.school = { id: "school-1", code: "SCU-PREVIEW" };
      next();
    },
  }));
  vi.doMock("../../../../server/repositories/settingsRepository", () => ({
    getSettingsSections: vi.fn(async () => ({
      academic: { defaultAssessmentType: "EOT" },
    })),
  }));
  vi.doMock("../../../../server/repositories/reportsRepository", () => ({
    loadReportEngineInput: vi.fn(async () => ({
      filters: { schoolCode: "SCU-PREVIEW", classId: "00000000-0000-0000-0000-000000000002", studentId: VALID_STUDENT_ID, assessmentType: "EOT" },
      academicYearName: "2025/2026",
      termName: "Term 1",
      hasActiveTerm: true,
      students: [],
      subjects: [],
      marks: [],
      promotionsByStudentId: {},
      settings: {
        school: { schoolName: "Preview School", schoolCode: "SCU-PREVIEW", address: "", phone: "", email: "", website: "", headTeacherName: "HT", reportFooterText: "Footer", marksheetFooterText: "", logoUrl: "", schoolSections: ["SECONDARY"] },
        reports: { showOverallPosition: false, showClassAverage: false, showGradeKey: false, showSchoolLogo: false, printDensity: "compact", signatureMode: "name_and_signature_line", defaultHmCommentTemplate: "", defaultClassTeacherCommentTemplate: "" },
        grading: { grades: [] },
      },
    })),
  }));
  vi.doMock("../../../../server/services/reportEngine", () => ({
    buildReports: vi.fn(() => ({
      settings: {
        school: { schoolName: "Preview School", schoolCode: "SCU-PREVIEW", address: "", phone: "", email: "", website: "", headTeacherName: "HT", reportFooterText: "Footer", marksheetFooterText: "", logoUrl: "", schoolSections: ["SECONDARY"] },
        reports: { showOverallPosition: false, showClassAverage: false, showGradeKey: false, showSchoolLogo: false, printDensity: "compact", signatureMode: "name_and_signature_line", defaultHmCommentTemplate: "", defaultClassTeacherCommentTemplate: "" },
        grading: { grades: [] },
      },
      cards: [{
        studentId: VALID_STUDENT_ID,
        admissionNumber: "ADM-1",
        studentName: "Ada Lovelace",
        className: "S1",
        streamName: "A",
        academicYear: "2025/2026",
        term: "Term 1",
        marksFound: 0,
        totalSubjects: 0,
        average: null,
        grade: null,
        overallPosition: null,
        readiness: overrides.cardReadiness ?? "READY",
        missingMarks: [],
        comments: "",
        contactReadiness: "READY",
        contactSummary: "",
        subjects: [],
        progressionText: null,
      }],
    })),
  }));

  const [{ reportIssueRoutes }, { parentRoutes }] = await Promise.all([
    import("../../../../server/routes/reportIssueRoutes"),
    import("../../../../server/routes/parentRoutes"),
  ]);
  const app = express();
  app.use(express.json());
  app.use(reportIssueRoutes());
  app.use(parentRoutes());
  app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (error instanceof ZodError) {
      res.status(400).json({ error: true, message: "Invalid request" });
      return;
    }
    res.status(500).json({ error: true, message: error instanceof Error ? error.message : "Unexpected error" });
  });
  return app;
}

afterEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  vi.restoreAllMocks();
  vi.doUnmock("../../../../server/db/prisma");
  vi.doUnmock("../../../../server/middleware/requireAuth");
  vi.doUnmock("../../../../server/repositories/reportsRepository");
  vi.doUnmock("../../../../server/repositories/settingsRepository");
  vi.doUnmock("../../../../server/services/reportEngine");
});

describe("reportIssueRoutes", () => {
  it("returns 400 when studentId is not a valid UUID", async () => {
    const app = await mountReportIssueApp({
      issuedReport: { updateMany: vi.fn(async () => ({ count: 0 })), create: vi.fn(async () => ({ id: "issued-1", assessmentType: "EOT", issuedAt: new Date() })) },
      auditLog: { create: vi.fn(async () => ({})) },
    });

    const res = await request(app).post("/api/reports/issue").send({ studentId: "not-a-uuid", classId: "00000000-0000-0000-0000-000000000002" });
    expect(res.status).toBe(400);
  });

  it("rejects classTeacherComment exceeding the shared limit", async () => {
    const app = await mountReportIssueApp({
      issuedReport: { updateMany: vi.fn(async () => ({ count: 0 })), create: vi.fn(async () => ({ id: "issued-1", assessmentType: "EOT", issuedAt: new Date() })) },
      auditLog: { create: vi.fn(async () => ({})) },
    });

    const res = await request(app).post("/api/reports/issue").send({
      studentId: VALID_STUDENT_ID,
      classId: "00000000-0000-0000-0000-000000000002",
      reportComments: { classTeacherComment: "A".repeat(COMMENT_LIMITS.classTeacherComment + 1) },
    });

    expect(res.status).toBe(400);
  });

  it("creates a new issued report and supersedes the existing one", async () => {
    const prisma = {
      issuedReport: {
        findMany: vi.fn(async () => [{
          id: "issued-old",
          status: "ISSUED",
          expiresAt: null,
          issuedAt: new Date("2026-07-18T00:00:00.000Z"),
          reportSnapshotJson: { card: { studentId: VALID_STUDENT_ID, average: 10 } },
          referenceCode: "20260718-OLD111",
        }]),
        updateMany: vi.fn(async () => ({ count: 1 })),
        create: vi.fn(async () => buildCreatedIssuedReport("issued-new")),
      },
      auditLog: { create: vi.fn(async () => ({})) },
    };

    const app = await mountReportIssueApp(prisma);
    const res = await request(app).post("/api/reports/issue").send({
      studentId: VALID_STUDENT_ID,
      classId: "00000000-0000-0000-0000-000000000002",
      assessmentType: "EOT",
    });

    expect(res.status).toBe(201);
    expect(prisma.issuedReport.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: "SUPERSEDED" }),
    }));
    expect(prisma.issuedReport.create).toHaveBeenCalledTimes(1);
  });

  it("allows a safe empty-state report path when the card is missing marks", async () => {
    const prisma = {
      issuedReport: {
        updateMany: vi.fn(async () => ({ count: 0 })),
        findMany: vi.fn(async () => []),
        create: vi.fn(async () => buildCreatedIssuedReport("issued-empty")),
      },
      auditLog: { create: vi.fn(async () => ({})) },
    };

    const app = await mountReportIssueApp(prisma, { cardReadiness: "MISSING_MARKS" });
    const res = await request(app).post("/api/reports/issue").send({
      studentId: VALID_STUDENT_ID,
      classId: "00000000-0000-0000-0000-000000000002",
      assessmentType: "EOT",
    });

    expect(res.status).toBe(201);
    expect(prisma.issuedReport.create).toHaveBeenCalledTimes(1);
  });

  it("keeps report.issue audit details free of raw parent tokens", async () => {
    const auditLogCreate = vi.fn(async () => ({}));
    const prisma = {
      issuedReport: {
        updateMany: vi.fn(async () => ({ count: 0 })),
        findMany: vi.fn(async () => []),
        create: vi.fn(async () => buildCreatedIssuedReport("issued-safe")),
      },
      auditLog: { create: auditLogCreate },
    };

    const app = await mountReportIssueApp(prisma);
    const res = await request(app).post("/api/reports/issue").send({
      studentId: VALID_STUDENT_ID,
      classId: "00000000-0000-0000-0000-000000000002",
      assessmentType: "EOT",
    });

    expect(res.status).toBe(201);
    const reportIssueAudit = ((auditLogCreate.mock.calls as unknown) as Array<[any, ...any[]]>).find(
      ([call]) => call?.data?.action === "report.issue",
    )?.[0];
    expect(reportIssueAudit?.data?.details).toEqual(expect.objectContaining({
      issuedReportId: "issued-safe",
      studentId: VALID_STUDENT_ID,
    }));
    expect(reportIssueAudit?.data?.details).not.toHaveProperty("parentAccessToken");
    expect(reportIssueAudit?.data?.details).not.toHaveProperty("parentLink");
    expect(reportIssueAudit?.data?.details).not.toHaveProperty("token");
  });

  it("issued report links from Reports Page open through /api/p/:token", async () => {
    let storedIssued: any = null;
    const prisma = {
      issuedReport: {
        updateMany: vi.fn(async () => ({ count: 0 })),
        findMany: vi.fn(async () => []),
        create: vi.fn(async ({ data }: any) => {
          storedIssued = {
            id: "issued-open",
            schoolId: "school-1",
            studentId: VALID_STUDENT_ID,
            assessmentType: "EOT",
            academicYear: "2025/2026",
            term: "Term 1",
            referenceCode: "20260719-OPEN01",
            publicShortCode: "SHORTOPEN",
            issuedAt: new Date("2026-07-19T00:00:00.000Z"),
            issuedByName: "Admin",
            status: "ISSUED",
            expiresAt: null,
            viewedAt: null,
            lastViewedAt: null,
            openCount: 0,
            downloadedAt: null,
            lastDownloadedAt: null,
            downloadCount: 0,
            reportSnapshotJson: data.reportSnapshotJson,
            parentAccessToken: data.parentAccessToken,
            school: { name: "Preview School" },
          };
          return buildCreatedIssuedReport("issued-open");
        }),
        update: vi.fn(async () => ({})),
        findUnique: vi.fn(async ({ where }: any) => {
          if (where.parentAccessToken === storedIssued?.parentAccessToken) {
            return storedIssued;
          }
          return null;
        }),
      },
      auditLog: { create: vi.fn(async () => ({})) },
    };

    const app = await mountReportIssueAndParentApp(prisma);
    const issueRes = await request(app).post("/api/reports/issue").send({
      studentId: VALID_STUDENT_ID,
      classId: "00000000-0000-0000-0000-000000000002",
      assessmentType: "EOT",
    });

    expect(issueRes.status).toBe(201);
    expect(issueRes.body.parentAccessToken).toEqual(expect.any(String));

    const openRes = await request(app).get(`/api/p/${issueRes.body.parentAccessToken}`);
    expect(openRes.status).toBe(200);
    expect(openRes.body.referenceCode).toBe("20260719-OPEN01");
  });

  it("keeps issued report list queries scoped to the authenticated school", async () => {
    const findMany = vi.fn(async () => []);
    const app = await mountReportIssueApp({
      issuedReport: {
        updateMany: vi.fn(async () => ({ count: 0 })),
        findMany,
        create: vi.fn(async () => ({ id: "issued-1", assessmentType: "EOT", issuedAt: new Date() })),
      },
      auditLog: { create: vi.fn(async () => ({})) },
    });

    const res = await request(app).get("/api/reports/issued");

    expect(res.status).toBe(200);
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { schoolId: "school-1" },
    }));
  });
});
