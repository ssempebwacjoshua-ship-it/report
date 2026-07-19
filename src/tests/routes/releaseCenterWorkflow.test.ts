import express from "express";
import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildReportLinkToken, buildReportVersionSignature } from "../../server/services/reportLinkService";
import { defaultSettingsSections } from "../../shared/types/settings";
import { sanitizeReportCardForRender, sanitizeReportPersonalizationForReport, sanitizeSchoolSettingsForReport } from "../../shared/utils/reportContentLimits";

const baseSchoolId = "school-1";
const baseStudentId = "student-1";
const baseAcademicYear = "2025/2026";
const baseTerm = "Term 1";
const baseAssessmentType = "EOT";
const issueFilters = {
  schoolCode: "SCU-PREVIEW",
  classId: "class-1",
  assessmentType: baseAssessmentType,
};

const baseReportResult = {
  settings: {
    school: {
      schoolName: "Preview School",
      schoolCode: "SCU-PREVIEW",
      address: "",
      phone: "",
      email: "",
      website: "",
      headTeacherName: "HT",
      reportFooterText: "Footer",
      marksheetFooterText: "",
      logoUrl: "",
      schoolSections: ["SECONDARY"],
    },
    reports: {
      showOverallPosition: false,
      showClassAverage: false,
      showGradeKey: false,
      showSchoolLogo: false,
      printDensity: "compact",
      signatureMode: "name_and_signature_line",
      defaultHmCommentTemplate: "",
      defaultClassTeacherCommentTemplate: "",
    },
    personalization: defaultSettingsSections.reportPersonalization,
    grading: { grades: [] },
  },
  cards: [{
    studentId: baseStudentId,
    admissionNumber: "ADM-1",
    studentName: "Ada Lovelace",
    className: "S1",
    streamName: "A",
    academicYear: baseAcademicYear,
    term: baseTerm,
    marksFound: 10,
    totalSubjects: 1,
    average: 88,
    grade: "D1",
    overallPosition: 1,
    readiness: "READY" as const,
    missingMarks: [],
    comments: "",
    contactReadiness: "READY",
    contactSummary: "Guardian",
    subjects: [],
    progressionText: null,
  }],
};

function buildVersionSnapshot(card: typeof baseReportResult.cards[0]) {
  const cardCopy = JSON.parse(JSON.stringify(card)) as typeof baseReportResult.cards[0];
  const settingsCopy = JSON.parse(JSON.stringify(baseReportResult.settings)) as typeof baseReportResult.settings;
  return {
    card: sanitizeReportCardForRender(cardCopy as any),
    settings: {
      ...settingsCopy,
      school: sanitizeSchoolSettingsForReport(settingsCopy.school as any),
      personalization: sanitizeReportPersonalizationForReport(settingsCopy.personalization),
    },
    filters: issueFilters,
  };
}

const baseEngineInput = {
  filters: {
    schoolCode: "SCU-PREVIEW",
    classId: "class-1",
    assessmentType: baseAssessmentType,
    academicYearId: "ay-1",
    termId: "term-1",
  },
  academicYearName: baseAcademicYear,
  termName: baseTerm,
  hasActiveTerm: true,
  students: [{ id: baseStudentId, admissionNumber: "ADM-1" }],
  subjects: [],
  marks: [],
  promotionsByStudentId: {},
  settings: baseReportResult.settings,
  emptyReasonOverride: null,
};

function mountReleaseCenterApp(prisma: any) {
  prisma.reportLabSubscription ??= {
    findUnique: vi.fn(async () => ({ status: "ACTIVE", currentPeriodEnd: new Date("2030-01-01T00:00:00.000Z") })),
  };
  vi.doMock("../../server/db/prisma", () => ({ prisma }));
  vi.doMock("../../server/middleware/requireAuth", () => ({
    requireAuth: (req: any, _res: any, next: () => void) => {
      req.user = { userId: "user-1", schoolId: baseSchoolId, name: "Admin" };
      req.school = { id: baseSchoolId, code: "SCU-PREVIEW" };
      next();
    },
  }));
  vi.doMock("../../server/repositories/settingsRepository", () => ({
    getSettingsSections: vi.fn(async () => ({
      academic: {
        defaultAssessmentType: baseAssessmentType,
        termEndDate: "2099-06-30",
      },
    })),
  }));
  vi.doMock("../../server/repositories/reportsRepository", () => ({
    loadReportEngineInput: vi.fn(async () => baseEngineInput),
  }));
  vi.doMock("../../server/services/reportEngine", () => ({
    buildReports: vi.fn(() => JSON.parse(JSON.stringify(baseReportResult))),
  }));
  vi.doMock("../../server/config/publicUrl", () => ({
    buildParentReportPublicUrl: (token: string) => `https://public.example/r/${token}`,
  }));

  return import("../../server/routes/releaseCenterRoutes").then(({ releaseCenterRoutes }) => {
    const app = express();
    app.use(express.json());
    app.use(releaseCenterRoutes());
    return app;
  });
}

afterEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  vi.restoreAllMocks();
  vi.doUnmock("../../server/db/prisma");
  vi.doUnmock("../../server/middleware/requireAuth");
  vi.doUnmock("../../server/repositories/settingsRepository");
  vi.doUnmock("../../server/repositories/reportsRepository");
  vi.doUnmock("../../server/services/reportEngine");
  vi.doUnmock("../../server/config/publicUrl");
});

describe("releaseCenterRoutes workflow", () => {
  it("creates a replacement report when the previous link is expired", async () => {
    const auditLogCreate = vi.fn(async () => ({}));
    const issuedUpdateMany = vi.fn(async () => ({ count: 0 }));
    const created = vi.fn(async () => ({ id: "issued-2" }));
    const existingRecord = {
      id: "issued-1",
      schoolId: baseSchoolId,
      studentId: baseStudentId,
      academicYear: baseAcademicYear,
      term: baseTerm,
      assessmentType: baseAssessmentType,
      referenceCode: "20260710-OLD111",
      status: "ISSUED",
      issuedAt: new Date("2026-07-10T00:00:00.000Z"),
      expiresAt: new Date("2026-07-11T00:00:00.000Z"),
      reportSnapshotJson: buildVersionSnapshot(baseReportResult.cards[0]),
      viewedAt: null,
      lastViewedAt: null,
      openCount: 0,
      downloadedAt: null,
      lastDownloadedAt: null,
      downloadCount: 0,
      sentAt: null,
      revokedAt: null,
      revokeReason: null,
    };

    const prisma = {
      issuedReport: {
        findMany: vi.fn(async () => [existingRecord]),
        updateMany: issuedUpdateMany,
        create: created,
      },
      auditLog: { create: auditLogCreate },
      guardianContact: { findMany: vi.fn(async () => [{ studentId: baseStudentId, guardianName: "Parent", preferredContactMethod: "WHATSAPP", phone: "+256700000000", email: null, isPrimary: true, canReceiveReports: true }]) },
    };

    const app = await mountReleaseCenterApp(prisma);
    const res = await request(app)
      .post("/api/reports/issue-bulk")
      .send({ classId: "class-1", assessmentType: baseAssessmentType });

    expect(res.status).toBe(201);
    expect(issuedUpdateMany).not.toHaveBeenCalled();
    expect(created).toHaveBeenCalledTimes(1);
    expect(auditLogCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ action: "report.link_issued" }),
    }));
  });

  it("reuses an active link when the report version matches", async () => {
    const auditLogCreate = vi.fn(async () => ({}));
    const issuedUpdateMany = vi.fn(async () => ({ count: 0 }));
    const created = vi.fn(async () => ({ id: "issued-2" }));
    const existingRecord = {
      id: "issued-1",
      schoolId: baseSchoolId,
      studentId: baseStudentId,
      academicYear: baseAcademicYear,
      term: baseTerm,
      assessmentType: baseAssessmentType,
      referenceCode: "20260710-ABC123",
      status: "ISSUED",
      issuedAt: new Date("2026-07-10T00:00:00.000Z"),
      expiresAt: null,
      reportSnapshotJson: buildVersionSnapshot(baseReportResult.cards[0]),
      viewedAt: null,
      lastViewedAt: null,
      openCount: 0,
      downloadedAt: null,
      lastDownloadedAt: null,
      downloadCount: 0,
      sentAt: null,
      revokedAt: null,
      revokeReason: null,
    };

    const prisma = {
      issuedReport: {
        findMany: vi.fn(async () => [existingRecord]),
        updateMany: issuedUpdateMany,
        create: created,
      },
      auditLog: { create: auditLogCreate },
      guardianContact: { findMany: vi.fn(async () => [{ studentId: baseStudentId, guardianName: "Parent", preferredContactMethod: "WHATSAPP", phone: "+256700000000", email: null, isPrimary: true, canReceiveReports: true }]) },
    };

    const app = await mountReleaseCenterApp(prisma);
    const res = await request(app)
      .post("/api/reports/issue-bulk")
      .send({ classId: "class-1", assessmentType: baseAssessmentType });

    expect(res.status).toBe(201);
    expect(issuedUpdateMany).not.toHaveBeenCalled();
    expect(created).not.toHaveBeenCalled();
    expect(auditLogCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ action: "report.link_reused", correlationId: "issued-1" }),
    }));

    const expectedToken = buildReportLinkToken({
      reportId: "issued-1",
      snapshotSignature: buildReportVersionSignature({
        ...buildVersionSnapshot(baseReportResult.cards[0]),
      }),
      schoolId: baseSchoolId,
      studentId: baseStudentId,
      academicYear: baseAcademicYear,
      term: baseTerm,
      assessmentType: baseAssessmentType,
    });

    expect(res.body.issued).toEqual([
      expect.objectContaining({
        issuedReportId: "issued-1",
        referenceCode: "20260710-ABC123",
        parentLink: `https://public.example/r/${expectedToken}`,
      }),
    ]);
  });

  it("supersedes the older active link when the report version changes", async () => {
    const auditLogCreate = vi.fn(async () => ({}));
    const issuedUpdateMany = vi.fn(async () => ({ count: 1 }));
    const created = vi.fn(async () => ({ id: "issued-2" }));
    const existingRecord = {
      id: "issued-1",
      schoolId: baseSchoolId,
      studentId: baseStudentId,
      academicYear: baseAcademicYear,
      term: baseTerm,
      assessmentType: baseAssessmentType,
      referenceCode: "20260710-OLD999",
      status: "ISSUED",
      issuedAt: new Date("2026-07-10T00:00:00.000Z"),
      expiresAt: null,
      reportSnapshotJson: {
        ...buildVersionSnapshot({
          ...baseReportResult.cards[0],
          average: 70,
        }),
      },
      viewedAt: null,
      lastViewedAt: null,
      openCount: 0,
      downloadedAt: null,
      lastDownloadedAt: null,
      downloadCount: 0,
      sentAt: null,
      revokedAt: null,
      revokeReason: null,
    };

    const prisma = {
      issuedReport: {
        findMany: vi.fn(async () => [existingRecord]),
        updateMany: issuedUpdateMany,
        create: created,
      },
      auditLog: { create: auditLogCreate },
      guardianContact: { findMany: vi.fn(async () => [{ studentId: baseStudentId, guardianName: "Parent", preferredContactMethod: "WHATSAPP", phone: "+256700000000", email: null, isPrimary: true, canReceiveReports: true }]) },
    };

    const app = await mountReleaseCenterApp(prisma);
    const res = await request(app)
      .post("/api/reports/issue-bulk")
      .send({ classId: "class-1", assessmentType: baseAssessmentType });

    expect(res.status).toBe(201);
    expect(issuedUpdateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: "SUPERSEDED" }),
    }));
    expect(created).toHaveBeenCalledTimes(1);
    expect(auditLogCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ action: "report.link_replaced", correlationId: "issued-1" }),
    }));
    expect(auditLogCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ action: "report.link_issued" }),
    }));
  });
});
