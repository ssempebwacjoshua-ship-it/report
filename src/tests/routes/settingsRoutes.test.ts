import request from "supertest";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { createServer } from "../../server";
import { defaultSettingsSections, type SettingSection, type SettingsSections } from "../../shared/types/settings";
import { signToken } from "../../server/services/authService";
import { prisma } from "../../server/db/prisma";
import { previewStudentImport } from "../../server/services/studentImportService";

let realSchoolId = "SCU-PREVIEW-PLACEHOLDER";
beforeAll(async () => {
  const school = await prisma.school.findUnique({ where: { code: "SCU-PREVIEW" } });
  if (school) realSchoolId = school.id;
});

const SCHOOL = "SCU-PREVIEW";

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
  it("GET /api/settings returns valid settings JSON with required section keys", async () => {
    const res = await request(createServer()).get("/api/settings?schoolCode=SCU-PREVIEW");
    expect(res.status).toBe(200);
    expect(res.body.sections).toHaveProperty("academic");
    expect(res.body.sections).toHaveProperty("reports");
    expect(res.body.sections).toHaveProperty("marksheets");
    expect(typeof res.body.sections.academic.defaultAssessmentType).toBe("string");
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

  it("saving academic setup creates active AcademicYear and Term rows", async () => {
    const payload = {
      ...sectionPayloads.academic,
      activeAcademicYear: "2031/2032",
      activeTerm: "Term 2",
      termStartDate: "2031-05-01",
      termEndDate: "2031-08-10",
    };

    const res = await request(createServer())
      .patch(`/api/settings/academic?schoolCode=${SCHOOL}`)
      .send(payload);

    expect(res.status).toBe(200);
    expect(res.body.sections.academic.activeAcademicYear).toBe("2031/2032");
    expect(res.body.sections.academic.activeTerm).toBe("Term 2");

    const school = await prisma.school.findUniqueOrThrow({
      where: { code: SCHOOL },
      include: {
        academicYears: {
          orderBy: [{ isActive: "desc" }, { startsOn: "desc" }],
          include: {
            terms: {
              orderBy: [{ isActive: "desc" }, { startsOn: "desc" }],
            },
          },
        },
      },
    });

    const activeYears = school.academicYears.filter((year) => year.isActive);
    expect(activeYears).toHaveLength(1);
    expect(activeYears[0]?.name).toBe("2031/2032");
    const activeTerms = activeYears[0]?.terms.filter((term) => term.isActive) ?? [];
    expect(activeTerms).toHaveLength(1);
    expect(activeTerms[0]?.name).toBe("Term 2");
  });

  it("student import sees the active DB academic year/term after academic setup save", async () => {
    const structure = await prisma.school.findUniqueOrThrow({
      where: { code: SCHOOL },
      include: {
        classes: {
          orderBy: { level: "asc" },
          include: {
            streams: {
              orderBy: { code: "asc" },
            },
          },
        },
      },
    });
    const klass = structure.classes.find((item) => item.streams.length > 0);
    expect(klass).toBeDefined();
    const stream = klass!.streams[0]!;

    const preview = await previewStudentImport(prisma, SCHOOL, [
      {
        admissionNumber: "SETTINGS-AUDIT-001",
        fullName: "Settings Audit Student",
        gender: "Female",
        className: klass!.name,
        streamName: stream.name,
        guardianName: "Audit Guardian",
        guardianPhone: "+256700000999",
        guardianEmail: "",
        status: "ACTIVE",
      },
    ]);

    expect(preview.validRows).toBe(1);
    expect(preview.invalidRows).toBe(0);
    expect(preview.warnings).toHaveLength(0);
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
      schoolId: realSchoolId,
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
    expect(JSON.stringify(res.body)).not.toMatch(/AZURE_OCR_FUNCTION_URL|code=|azurewebsites/i);
  });

  it("forwards image-byte OCR reads to Azure with auth", async () => {
    process.env.OCR_ENABLED = "true";
    process.env.OCR_PROVIDER = "azure";
    process.env.AZURE_OCR_FUNCTION_URL = "https://azure-ocr.example.test/api/ocr";

    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ ok: true, provider: "azure", text: "crop text", lines: ["crop text"], raw: {} }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    const originalFetch = globalThis.fetch;
    globalThis.fetch = fetchMock as typeof fetch;

    const token = signToken({
      userId: "user-1",
      schoolId: realSchoolId,
      name: "Admin",
      email: "admin@example.test",
      role: "ADMIN_OPERATOR",
    });

    const imageBase64 = Buffer.from("crop-bytes").toString("base64");
    const res = await request(createServer())
      .post("/internal/ocr/read")
      .set("Authorization", `Bearer ${token}`)
      .send({ imageBase64, mimeType: "image/png" });

    globalThis.fetch = originalFetch;

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ provider: "azure", text: "crop text", lines: ["crop text"] });
    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)) as Record<string, string>;
    expect(body).toMatchObject({ imageBase64, mimeType: "image/png" });
    expect(body).not.toHaveProperty("url");
  });

  it("returns 400 and a validation message for an invalid OCR URL", async () => {
    const token = signToken({
      userId: "user-1",
      schoolId: realSchoolId,
      name: "Admin",
      email: "admin@example.test",
      role: "ADMIN_OPERATOR",
    });

    const res = await request(createServer())
      .post("/internal/ocr/read")
      .set("Authorization", `Bearer ${token}`)
      .send({ url: "not-a-url" });

    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body)).toMatch(/url/i);
  });

  it("returns 503 with a user-friendly message when OCR provider is unavailable", async () => {
    const saved = {
      enabled: process.env.OCR_ENABLED,
      provider: process.env.OCR_PROVIDER,
      url: process.env.AZURE_OCR_FUNCTION_URL,
    };
    process.env.OCR_ENABLED = "false";
    delete process.env.OCR_PROVIDER;
    delete process.env.AZURE_OCR_FUNCTION_URL;

    const token = signToken({
      userId: "user-1",
      schoolId: realSchoolId,
      name: "Admin",
      email: "admin@example.test",
      role: "ADMIN_OPERATOR",
    });

    const res = await request(createServer())
      .post("/internal/ocr/read")
      .set("Authorization", `Bearer ${token}`)
      .send({ url: "https://example.com/test.jpg" });

    process.env.OCR_ENABLED = saved.enabled;
    if (saved.provider !== undefined) process.env.OCR_PROVIDER = saved.provider;
    if (saved.url !== undefined) process.env.AZURE_OCR_FUNCTION_URL = saved.url;

    expect(res.status).toBe(503);
    expect(res.body.error).toBe("OCR is temporarily unavailable. Contact platform support.");
    expect(JSON.stringify(res.body)).not.toMatch(/AZURE|FUNCTION_URL|OCR_ENABLED/);
  });

  it("returns a non-technical error when Azure Function itself returns an error", async () => {
    process.env.OCR_ENABLED = "true";
    process.env.OCR_PROVIDER = "azure";
    process.env.AZURE_OCR_FUNCTION_URL = "https://azure-ocr.example.test/api/ocr";

    const fetchMock = vi.fn(async () =>
      new Response("Internal Server Error", {
        status: 500,
        headers: { "Content-Type": "text/plain" },
      }),
    );
    const originalFetch = globalThis.fetch;
    globalThis.fetch = fetchMock as typeof fetch;

    const token = signToken({
      userId: "user-1",
      schoolId: realSchoolId,
      name: "Admin",
      email: "admin@example.test",
      role: "ADMIN_OPERATOR",
    });

    const res = await request(createServer())
      .post("/internal/ocr/read")
      .set("Authorization", `Bearer ${token}`)
      .send({ url: "https://example.com/test.jpg" });

    globalThis.fetch = originalFetch;

    expect(res.status).toBe(503);
    expect(res.body.error).toBe("OCR is temporarily unavailable. Contact platform support.");
    expect(JSON.stringify(res.body)).not.toMatch(/AZURE_OCR_FUNCTION_URL|code=|function\.azurewebsites/i);
  });

  it("OCR settings schema does not include provider infrastructure fields", async () => {
    const res = await request(createServer()).get(`/api/settings?schoolCode=${SCHOOL}`);
    expect(res.status).toBe(200);
    const ocr = res.body.sections.ocr as Record<string, unknown>;
    expect(ocr).not.toHaveProperty("provider");
    expect(ocr).not.toHaveProperty("paddleOcrUrl");
    expect(ocr).not.toHaveProperty("awsRegion");
    expect(ocr).not.toHaveProperty("debugMode");
    expect(ocr).toHaveProperty("minimumConfidenceForSuggestion");
    expect(ocr).toHaveProperty("requireOperatorReviewBeforeCommit");
  });
});
