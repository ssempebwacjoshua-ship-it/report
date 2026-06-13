import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createServer } from "../../server";
import { defaultSettingsSections, type SettingSection, type SettingsSections } from "../../shared/types/settings";
import { signToken } from "../../server/services/authService";

const SCHOOL = "SETTINGS-TEST";

const sectionPayloads: Record<SettingSection, SettingsSections[SettingSection]> = {
  school: {
    ...defaultSettingsSections.school,
    schoolName: "School Connect Preview School",
    schoolCode: SCHOOL,
    address: "Kampala, Uganda",
    phone: "+256 700 000000",
    email: "info@schoolconnect.test",
    website: "",
    headTeacherName: "Demo Head Teacher",
    reportFooterText: "Reports verified by settings tests.",
    marksheetFooterText: "Marksheet footer verified by settings tests.",
    logoUrl: "",
  },
  academic: {
    ...defaultSettingsSections.academic,
    activeAcademicYear: "2025/2026",
    activeTerm: "Term 1",
    defaultAssessmentType: "EOT",
  },
  reports: {
    ...defaultSettingsSections.reports,
    showOverallPosition: true,
    showGradeKey: false,
    printDensity: "compact",
  },
  marksheets: {
    ...defaultSettingsSections.marksheets,
    includeQrCode: false,
    includeHumanReadableMarksheetId: true,
  },
  ocr: {
    ...defaultSettingsSections.ocr,
    provider: "manual",
    minimumConfidenceForSuggestion: 0.82,
  },
  grading: {
    grades: [
      { label: "D1", minScore: 90, maxScore: 100, descriptor: "Distinction" },
      { label: "D2", minScore: 80, maxScore: 89, descriptor: "Strong" },
      { label: "C3", minScore: 70, maxScore: 79, descriptor: "Good" },
      { label: "C4", minScore: 65, maxScore: 69, descriptor: "Credit" },
      { label: "C5", minScore: 60, maxScore: 64, descriptor: "Credit" },
      { label: "C6", minScore: 50, maxScore: 59, descriptor: "Pass" },
      { label: "P7", minScore: 45, maxScore: 49, descriptor: "Basic pass" },
      { label: "P8", minScore: 40, maxScore: 44, descriptor: "Needs support" },
      { label: "F9", minScore: 0, maxScore: 39, descriptor: "Below standard" },
    ],
  },
  approval: {
    ...defaultSettingsSections.approval,
    requireHmFinalizationBeforeReportPrintRelease: true,
  },
  appearance: {
    ...defaultSettingsSections.appearance,
    appDensity: "compact",
    sidebarWidth: "wide",
    fontSize: "large",
  },
};

describe("settingsRoutes", () => {
  it("GET /api/settings returns defaults when no settings exist", async () => {
    const res = await request(createServer()).get("/api/settings?schoolCode=NO-SUCH-SETTINGS-SCHOOL");
    expect(res.status).toBe(200);
    expect(res.body.sections.academic.defaultAssessmentType).toBe("EOT");
    expect(res.body.sections.reports.showOverallPosition).toBe(false);
    expect(res.body.sections.marksheets.includeQrCode).toBe(true);
  });

  it("every PATCH route persists valid settings", async () => {
    for (const section of Object.keys(sectionPayloads) as SettingSection[]) {
      const res = await request(createServer())
        .patch(`/api/settings/${section}?schoolCode=${SCHOOL}`)
        .send(sectionPayloads[section]);
      expect(res.status).toBe(200);
      expect(res.body.sections[section]).toMatchObject(sectionPayloads[section]);
    }
  });

  it("accepts blank optional school profile fields", async () => {
    const res = await request(createServer())
      .patch(`/api/settings/school?schoolCode=${SCHOOL}`)
      .send({
        ...sectionPayloads.school,
        email: "",
        website: "",
        logoUrl: "",
      });
    expect(res.status).toBe(200);
    expect(res.body.sections.school.email).toBe("");
    expect(res.body.sections.school.website).toBe("");
    expect(res.body.sections.school.logoUrl).toBe("");
  });

  it("accepts practical school profile values and persists them", async () => {
    const res = await request(createServer())
      .patch(`/api/settings/school?schoolCode=${SCHOOL}`)
      .send(sectionPayloads.school);
    expect(res.status).toBe(200);
    expect(res.body.sections.school).toMatchObject({
      schoolName: "School Connect Preview School",
      schoolCode: SCHOOL,
      address: "Kampala, Uganda",
      phone: "+256 700 000000",
      email: "info@schoolconnect.test",
      website: "",
      headTeacherName: "Demo Head Teacher",
      reportFooterText: "Reports verified by settings tests.",
      marksheetFooterText: "Marksheet footer verified by settings tests.",
      logoUrl: "",
    });
  });

  it("returns field-level errors for invalid school profile values", async () => {
    const res = await request(createServer())
      .patch(`/api/settings/school?schoolCode=${SCHOOL}`)
      .send({
        ...sectionPayloads.school,
        email: "not-an-email",
        website: "not-a-url",
        logoUrl: "not-a-logo-url",
      });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Invalid request");
    expect(res.body.fieldErrors.email[0]).toMatch(/email/i);
    expect(res.body.fieldErrors.website[0]).toMatch(/url/i);
    expect(res.body.fieldErrors.logoUrl[0]).toMatch(/url/i);
  });

  it("accepts valid email, URL, and phone formats", async () => {
    const res = await request(createServer())
      .patch(`/api/settings/school?schoolCode=${SCHOOL}`)
      .send({
        ...sectionPayloads.school,
        email: "headteacher@schoolconnect.test",
        website: "https://schoolconnect.test",
        logoUrl: "https://schoolconnect.test/logo.png",
        phone: "+256 700 000000",
      });
    expect(res.status).toBe(200);
    expect(res.body.sections.school.email).toBe("headteacher@schoolconnect.test");
    expect(res.body.sections.school.website).toBe("https://schoolconnect.test");
    expect(res.body.sections.school.logoUrl).toBe("https://schoolconnect.test/logo.png");
    expect(res.body.sections.school.phone).toBe("+256 700 000000");
  });

  it("invalid and overlapping grading ranges are rejected", async () => {
    const res = await request(createServer())
      .patch(`/api/settings/grading?schoolCode=${SCHOOL}`)
      .send({
        grades: [
          { label: "D1", minScore: 90, maxScore: 100, descriptor: "" },
          { label: "D2", minScore: 85, maxScore: 95, descriptor: "" },
          { label: "C3", minScore: 70, maxScore: 79, descriptor: "" },
          { label: "C4", minScore: 65, maxScore: 69, descriptor: "" },
          { label: "C5", minScore: 60, maxScore: 64, descriptor: "" },
          { label: "C6", minScore: 50, maxScore: 59, descriptor: "" },
          { label: "P7", minScore: 45, maxScore: 49, descriptor: "" },
          { label: "P8", minScore: 40, maxScore: 44, descriptor: "" },
          { label: "F9", minScore: 0, maxScore: 39, descriptor: "" },
        ],
      });
    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body.issues)).toMatch(/overlap/i);
  });

  it("settings survive reload", async () => {
    await request(createServer())
      .patch(`/api/settings/reports?schoolCode=${SCHOOL}`)
      .send(sectionPayloads.reports);

    const reload = await request(createServer()).get(`/api/settings?schoolCode=${SCHOOL}`);
    expect(reload.status).toBe(200);
    expect(reload.body.sections.reports.showOverallPosition).toBe(true);
    expect(reload.body.sections.reports.printDensity).toBe("compact");
  });

  it("school profile changes persist after reload", async () => {
    await request(createServer())
      .patch(`/api/settings/school?schoolCode=${SCHOOL}`)
      .send({
        ...sectionPayloads.school,
        reportFooterText: "Persisted report footer.",
        marksheetFooterText: "Persisted marksheet footer.",
      });

    const reload = await request(createServer()).get(`/api/settings?schoolCode=${SCHOOL}`);
    expect(reload.status).toBe(200);
    expect(reload.body.sections.school.reportFooterText).toBe("Persisted report footer.");
    expect(reload.body.sections.school.marksheetFooterText).toBe("Persisted marksheet footer.");
    expect(reload.body.sections.school.schoolName).toBe("School Connect Preview School");
  });

  it("rejects OCR reads without auth", async () => {
    const res = await request(createServer()).post("/internal/ocr/read").send({ url: "https://example.com/test.jpg" });
    expect(res.status).toBe(401);
  });

  it("forwards OCR reads to Azure with auth and returns extracted text", async () => {
    process.env.OCR_ENABLED = "true";
    process.env.OCR_PROVIDER = "azure";
    process.env.AZURE_OCR_FUNCTION_URL = "https://azure-ocr.example.test/api/ocr";

    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ text: "hello world", lines: ["hello", "world"] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    const originalFetch = globalThis.fetch;
    globalThis.fetch = fetchMock as typeof fetch;

    const token = signToken({
      userId: "user-1",
      schoolId: "school-1",
      name: "Admin",
      email: "admin@example.test",
      role: "ADMIN_OPERATOR",
    });

    const res = await request(createServer())
      .post("/internal/ocr/read")
      .set("Authorization", `Bearer ${token}`)
      .send({ url: "https://example.com/test.jpg" });

    globalThis.fetch = originalFetch;

    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBeInstanceOf(URL);
    expect(res.body.text).toBe("hello world");
    expect(res.body.lines).toEqual(["hello", "world"]);
  });
});
