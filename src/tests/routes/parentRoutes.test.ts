import express from "express";
import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";

function mountRouteApp(routeModulePath: string, exportName: "parentRoutes" | "verifyRoutes", prisma: any) {
  vi.doMock("../../server/db/prisma", () => ({ prisma }));
  return import(routeModulePath).then((mod: any) => {
    const app = express();
    app.use(express.json());
    app.use(mod[exportName]());
    return app;
  });
}

afterEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  vi.restoreAllMocks();
  vi.doUnmock("../../server/db/prisma");
});

describe("parentRoutes - GET /api/p/:token", () => {
  it("returns 404 JSON for non-existent token", async () => {
    const app = await mountRouteApp("../../server/routes/parentRoutes", "parentRoutes", {
      issuedReport: { findUnique: vi.fn(async () => null) },
    });

    const res = await request(app).get(`/api/p/${"a".repeat(64)}`);
    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({
      code: "REPORT_LINK_NOT_FOUND",
      message: "Report link not found or expired",
    });
  });

  it("returns a limited public snapshot without internal ids", async () => {
    const prisma = {
      issuedReport: {
        findUnique: vi.fn(async () => ({
          id: "issued-1",
          status: "ISSUED",
          referenceCode: "20260626-ABC123",
          issuedAt: new Date("2026-06-26T00:00:00.000Z"),
          issuedByName: "School Admin",
          viewedAt: null,
          reportSnapshotJson: {
            card: {
              studentId: "student-1",
              admissionNumber: "ADM-1",
              studentName: "Ada Lovelace",
              className: "S1",
              streamName: "A",
              academicYear: "2025/2026",
              term: "Term 1",
              marksFound: 1,
              totalSubjects: 1,
              average: 88,
              grade: "D1",
              overallPosition: 1,
              readiness: "READY",
              missingMarks: [],
              comments: "",
              contactReadiness: "READY",
              contactSummary: "Guardian",
              subjects: [{
                subjectId: "subject-1",
                subjectName: "English",
                botMarks: 88,
                motMarks: null,
                eotMarks: null,
                total: 88,
                average: 88,
                grade: "D1",
                subjectPosition: 1,
                missingMarks: [],
                comments: "Strong work",
              }],
              progressionText: null,
            },
            settings: {
              school: { schoolName: "Preview School", schoolCode: "SCU", address: "", phone: "", email: "", website: "", headTeacherName: "HT", reportFooterText: "Footer", marksheetFooterText: "", logoUrl: "", schoolSections: ["SECONDARY"] },
              reports: { showOverallPosition: false, showClassAverage: false, showGradeKey: false, showSchoolLogo: false, printDensity: "compact", signatureMode: "name_and_signature_line", defaultHmCommentTemplate: "", defaultClassTeacherCommentTemplate: "" },
              grading: { grades: [] },
            },
            filters: { assessmentType: "EOT" },
            reportComments: { classTeacherComment: "Great effort", headTeacherComment: "", conductNote: "", classTeacherName: "", headTeacherName: "", issueDate: "2026-06-26" },
          },
          school: { name: "Preview School" },
        })),
        update: vi.fn(async () => ({})),
      },
    };

    const app = await mountRouteApp("../../server/routes/parentRoutes", "parentRoutes", prisma);
    const res = await request(app).get(`/api/p/${"b".repeat(64)}`);

    expect(res.status).toBe(200);
    expect(res.body).not.toHaveProperty("id");
    expect(res.body.snapshot.card.studentId).toBe("");
    expect(res.body.snapshot.card.subjects[0].subjectId).toBe("");
    expect(res.body.snapshot.card.contactSummary).toBe("");
  });

  it("returns 410 for revoked links", async () => {
    const app = await mountRouteApp("../../server/routes/parentRoutes", "parentRoutes", {
      issuedReport: {
        findUnique: vi.fn(async () => ({
          id: "issued-1",
          status: "REVOKED",
          reportSnapshotJson: {},
          school: { name: "Preview School" },
        })),
      },
    });

    const res = await request(app).get(`/api/p/${"c".repeat(64)}`);
    expect(res.status).toBe(410);
    expect(res.body.code).toBe("REPORT_REVOKED");
  });
});

describe("parentRoutes - POST /api/p/:token/downloaded", () => {
  it("returns 404 JSON for non-existent token", async () => {
    const app = await mountRouteApp("../../server/routes/parentRoutes", "parentRoutes", {
      issuedReport: { findUnique: vi.fn(async () => null) },
    });

    const res = await request(app).post(`/api/p/${"d".repeat(64)}/downloaded`);
    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({
      code: "REPORT_LINK_NOT_FOUND",
      message: "Report link not found or expired",
    });
  });

  it("returns 410 when the report link has been revoked", async () => {
    const prisma = {
      issuedReport: {
        findUnique: vi.fn(async () => ({
          id: "issued-1",
          status: "REVOKED",
          downloadedAt: null,
        })),
        update: vi.fn(async () => ({})),
      },
    };

    const app = await mountRouteApp("../../server/routes/parentRoutes", "parentRoutes", prisma);
    const res = await request(app).post(`/api/p/${"e".repeat(64)}/downloaded`);

    expect(res.status).toBe(410);
    expect(prisma.issuedReport.update).not.toHaveBeenCalled();
  });
});

describe("verifyRoutes - GET /api/verify/:code", () => {
  it("returns 404 with found:false for unknown code", async () => {
    const app = await mountRouteApp("../../server/routes/verifyRoutes", "verifyRoutes", {
      issuedReport: { findUnique: vi.fn(async () => null) },
    });

    const res = await request(app).get("/api/verify/NONEXISTENT-CODE");
    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ found: false });
  });

  it("normalises code to uppercase", async () => {
    const prisma = { issuedReport: { findUnique: vi.fn(async () => null) } };
    const app = await mountRouteApp("../../server/routes/verifyRoutes", "verifyRoutes", prisma);

    const res = await request(app).get("/api/verify/nonexistent-code");
    expect(res.status).toBe(404);
    expect(prisma.issuedReport.findUnique).toHaveBeenCalledWith({
      where: { referenceCode: "NONEXISTENT-CODE" },
      include: {
        school: { select: { name: true } },
        student: { select: { firstName: true, lastName: true } },
      },
    });
  });
});
