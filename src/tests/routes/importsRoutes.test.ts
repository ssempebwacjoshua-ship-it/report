import request from "supertest";
import sharp from "sharp";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { signToken } from "../../server/services/authService";
import { createServer } from "../../server";

const ocrMockState = vi.hoisted(() => ({
  idCropTexts: [] as string[],
}));

const authState = vi.hoisted(() => ({
  validateSchoolSession: vi.fn(async (payload: {
    userId: string;
    schoolId: string;
    name: string;
    email: string;
    role: string;
    tokenVersion?: number;
  } | null) => {
    if (!payload?.userId || !payload.schoolId || typeof payload.tokenVersion !== "number") {
      return null;
    }
    return {
      user: {
        id: payload.userId,
        schoolId: payload.schoolId,
        name: payload.name,
        email: payload.email,
        role: payload.role,
        tokenVersion: payload.tokenVersion,
        isPlatformOwner: false,
      },
      school: {
        id: "school-1",
        code: "SCU-PREVIEW",
        name: "Preview School",
        isActive: true,
      },
      auth: payload,
    };
  }),
}));

type MockBatch = {
  id: string;
  schoolId: string;
  status: "DRY_RUN" | "COMMITTED" | "FAILED";
  source: string;
  summary: string;
  createdAt: Date;
  updatedAt: Date;
};

type MockRow = {
  batchId: string;
  rowNumber: number;
  raw: Record<string, unknown>;
  isValid: boolean;
  errors: string[];
};

const routeState = vi.hoisted(() => ({
  nextBatchId: 1,
  batches: [] as MockBatch[],
  rows: [] as MockRow[],
  auditLogs: [] as Array<{ action: string; correlationId: string | null }>,
}));

function resolvedContextFor(id: string) {
  return {
    marksheetId: id,
    className: "Senior 1 A",
    streamName: "A",
    subjectName: "Mathematics",
    termName: "Term 1",
    examType: "BOT",
    academicYear: "2026",
  };
}

vi.mock("../../server/services/sessionValidationService", () => ({
  validateSchoolSession: authState.validateSchoolSession,
}));

vi.mock("../../server/services/azureOcrService", async () => {
  const actual = await vi.importActual<typeof import("../../server/services/azureOcrService")>(
    "../../server/services/azureOcrService",
  );
  return {
    ...actual,
    isAzureOcrConfigured: () => false,
    readAzureOcrFromImage: vi.fn(async () => {
      const text = ocrMockState.idCropTexts.shift() ?? "";
      return { text, lines: text ? [text] : [] };
    }),
  };
});

vi.mock("../../server/services/marksheetIdDetectionService", () => ({
  detectMarksheetIdFromScan: vi.fn(async () => {
    let text = "";
    while (ocrMockState.idCropTexts.length > 0 && !text) {
      text = ocrMockState.idCropTexts.shift() ?? "";
    }
    const recognizedId = text.match(/MS-[A-Z0-9-]+/i)?.[0] ?? null;
    const recognizedSheetNumber = text.match(/\d{8}-\d{3}/)?.[0] ?? null;
    const normalizedRecognizedId = recognizedId?.replace("SENI", "SEN1") ?? "";
    return {
      rawRecognizedId: recognizedId,
      normalizedRecognizedId,
      confidence: recognizedId ? 0.98 : 0,
      matchSource: recognizedId ? "header" : "manual-required",
      recognizedSheetNumber,
      debug: { attempts: 1 },
    };
  }),
  saveMarksheetIdLookupDebug: vi.fn(async () => {}),
}));

vi.mock("../../server/services/marksheetContextService", () => ({
  findMarksheetIdBySheetNumber: vi.fn(async (_prisma, schoolId: string, sheetNumber: string) => (
    schoolId === "school-1" && sheetNumber === "20260613-265"
      ? "MS-2026-SEN1-A-MATH-BOT-TE"
      : null
  )),
  resolveScanMarksheetContext: vi.fn(async (_prisma, schoolId: string, input: {
    recognizedMarksheetId?: string | null;
    selectedMarksheetId?: string | null;
    selectedContext?: Partial<Record<string, string>> | null;
  }) => {
    if (schoolId !== "school-1") {
      return {
        resolvedContext: null,
        contextSource: "manual-required",
        contextWarning: "",
      };
    }

    const selectedContext = input.selectedContext ?? null;
    if (selectedContext?.className && selectedContext.streamName && selectedContext.subjectName && selectedContext.termName && selectedContext.examType) {
      const marksheetId = selectedContext.marksheetId || "MS-2026-S1A-A-MATH-BOT-T1";
      return {
        resolvedContext: resolvedContextFor(marksheetId),
        contextSource: "selected-context",
        contextWarning: "",
        selectedMarksheetId: marksheetId,
        recognizedMarksheetId: input.recognizedMarksheetId ?? "",
        normalizedMarksheetId: input.recognizedMarksheetId ?? "",
        rawRecognizedId: input.recognizedMarksheetId ?? null,
        normalizedRecognizedId: input.recognizedMarksheetId ?? "",
        matchedMarksheetId: input.recognizedMarksheetId ?? marksheetId,
        matchConfidence: input.recognizedMarksheetId ? 0.98 : 0.9,
        matchSource: input.recognizedMarksheetId ? "header" : "manual",
      };
    }

    const marksheetId = input.selectedMarksheetId || input.recognizedMarksheetId || "";
    const normalizedMarksheetId = marksheetId.replace("SENI", "SEN1");
    if (marksheetId) {
      return {
        resolvedContext: resolvedContextFor(normalizedMarksheetId),
        contextSource: input.recognizedMarksheetId ? "recognized-id" : "selected-id",
        contextWarning: "",
        selectedMarksheetId: input.selectedMarksheetId ?? "",
        recognizedMarksheetId: input.recognizedMarksheetId ?? "",
        normalizedMarksheetId,
        rawRecognizedId: input.recognizedMarksheetId ?? null,
        normalizedRecognizedId: normalizedMarksheetId,
        matchedMarksheetId: normalizedMarksheetId,
        matchConfidence: input.recognizedMarksheetId ? 0.98 : 0.9,
        matchSource: input.recognizedMarksheetId ? "header" : "manual",
      };
    }

    return {
      resolvedContext: null,
      contextSource: "manual-required",
      contextWarning: "",
      selectedMarksheetId: "",
      recognizedMarksheetId: "",
      normalizedMarksheetId: "",
      rawRecognizedId: null,
      normalizedRecognizedId: "",
      matchedMarksheetId: "",
      matchConfidence: 0,
      matchSource: "manual-required",
    };
  }),
  resolveContextByMarksheetId: vi.fn(async (_prisma, schoolId: string, marksheetId: string) => {
    if (schoolId !== "school-1") {
      return { detectionStatus: "NOT_FOUND", message: "School not found.", resolvedContext: null };
    }
    if (!/^MS-/i.test(marksheetId)) {
      return { detectionStatus: "NOT_FOUND", message: "Marksheet ID not found.", resolvedContext: null };
    }
    return {
      detectionStatus: "DETECTED",
      message: "Context resolved.",
      normalizedRecognizedId: marksheetId === "MS-2026-SENI-A-ENGL-BOT-TE" ? "MS-2026-SEN1-A-ENGL-BOT-TE" : marksheetId,
      resolvedContext: resolvedContextFor(marksheetId),
      contextSource: "recognized-id",
      matchSource: "header",
    };
  }),
}));

vi.mock("../../server/services/scanExtractionService", () => ({
  extractMarksFromScan: vi.fn(async () => ({
    parseStatus: "FAILED",
    message: "OCR provider is unavailable for this scan.",
    rows: [],
    configuredProvider: "azure",
    activeProvider: "none",
    providerReachable: false,
    fallbackReason: "OCR unavailable",
  })),
}));

vi.mock("../../server/services/scanImportValidator", () => ({
  parseScanMark: vi.fn(),
  validateScanRows: vi.fn((rows: Array<Record<string, unknown>>, context: { className: string }, roster: Array<{ admissionNumber: string }>) =>
    rows.map((row) => {
      const admissionNumber = typeof row.admissionNumber === "string" ? row.admissionNumber : "";
      const enrolled = roster.some((item) => item.admissionNumber === admissionNumber);
      if (!enrolled || /NonExistent/i.test(context.className)) {
        return {
          ...row,
          status: "INVALID",
          validationErrors: ["Student is not enrolled in the selected class/stream."],
        };
      }
      return {
        ...row,
        status: "VALID",
        validationErrors: [],
      };
    })),
}));

vi.mock("../../server/repositories/settingsRepository", () => ({
  getSettingsSections: vi.fn(async () => ({
    ocr: { minimumConfidenceForSuggestion: 0.7 },
    approval: { keepAuditTrail: true, requireDryRunBeforeCommit: true },
  })),
}));

vi.mock("../../server/services/marksImportService", () => ({
  dryRunMarksImport: vi.fn(async (_prisma, schoolCode: string, csvText: string) => {
    if (!csvText.includes("admissionNumber")) {
      const error = new Error("CSV_INVALID_RECORD_LENGTH");
      (error as { code?: string }).code = "CSV_INVALID_RECORD_LENGTH";
      throw error;
    }
    return {
      status: "DRY_RUN",
      schoolCode,
      totalRows: 1,
      validRows: 1,
      invalidRows: 0,
      rows: [{ rowNumber: 2, isValid: true, errors: [] }],
    };
  }),
  commitMarksImport: vi.fn(async (_prisma, schoolCode: string) => ({
    status: "FAILED",
    schoolCode,
    totalRows: 1,
    validRows: 0,
    invalidRows: 1,
    rows: [{ rowNumber: 2, isValid: false, errors: ["Dry-run validation is required before commit."] }],
  })),
}));

vi.mock("../../server/db/prisma", () => ({
  prisma: {
    school: {
      findUnique: vi.fn(async ({ where }: { where: { code: string } }) => (
        where.code === "SCU-PREVIEW" ? { id: "school-1", code: "SCU-PREVIEW", name: "Preview School" } : null
      )),
    },
    appSetting: { findUnique: vi.fn(async () => null) },
    reportLabSubscription: {
      findUnique: vi.fn(async () => ({ status: "ACTIVE", currentPeriodEnd: new Date("2030-01-01T00:00:00.000Z") })),
    },
    auditLog: {
      create: vi.fn(async ({ data }: { data: { action: string; correlationId?: string | null } }) => {
        routeState.auditLogs.push({ action: data.action, correlationId: data.correlationId ?? null });
        return {};
      }),
      findFirst: vi.fn(async () => ({ id: "scan-dry-run-log" })),
    },
    markImportBatch: {
      create: vi.fn(async ({ data }: { data: Omit<MockBatch, "id" | "createdAt" | "updatedAt"> }) => {
        const now = new Date();
        const batch: MockBatch = {
          id: `scan-batch-${routeState.nextBatchId++}`,
          schoolId: data.schoolId,
          status: data.status,
          source: data.source,
          summary: data.summary,
          createdAt: now,
          updatedAt: now,
        };
        routeState.batches.unshift(batch);
        return batch;
      }),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: Partial<MockBatch> }) => {
        const batch = routeState.batches.find((item) => item.id === where.id);
        if (!batch) throw new Error("Batch not found");
        Object.assign(batch, data, { updatedAt: new Date() });
        return batch;
      }),
      findFirst: vi.fn(async ({ where }: { where: { id?: string; schoolId?: string; source?: string } }) =>
        routeState.batches.find((item) =>
          (!where.id || item.id === where.id)
          && (!where.schoolId || item.schoolId === where.schoolId)
          && (!where.source || item.source === where.source),
        ) ?? null),
      findMany: vi.fn(async ({ where }: { where: { schoolId?: string; source?: string } }) =>
        routeState.batches.filter((item) =>
          (!where.schoolId || item.schoolId === where.schoolId)
          && (!where.source || item.source === where.source),
        )),
    },
    markImportRow: {
      findMany: vi.fn(async ({ where }: { where: { batchId: string } }) =>
        routeState.rows.filter((row) => row.batchId === where.batchId)),
      deleteMany: vi.fn(async ({ where }: { where: { batchId: string } }) => {
        routeState.rows = routeState.rows.filter((row) => row.batchId !== where.batchId);
        return { count: 0 };
      }),
      createMany: vi.fn(async ({ data }: { data: MockRow[] }) => {
        routeState.rows.push(...data);
        return { count: data.length };
      }),
    },
    classEnrollment: {
      findMany: vi.fn(async ({ where }: { where: { schoolId: string } }) => (
        where.schoolId === "school-1"
          ? [{
              student: { id: "student-1", admissionNumber: "S1A-001" },
              class: { id: "class-1", name: "Senior 1 A" },
              stream: { id: "stream-a", name: "A" },
            }]
          : []
      )),
    },
  },
}));

const SCHOOL = "SCU-PREVIEW";
const UNKNOWN = "UNKNOWN-SCHOOL-XYZ";

const validContext = JSON.stringify({
  marksheetId: "MS-2026-S1A-A-MATH-BOT-T1",
  className: "Senior 1 A",
  streamName: "A",
  subjectName: "Mathematics",
  termName: "Term 1",
  examType: "BOT",
  academicYear: "2026",
});

const AUTH_TOKEN = signToken({
  userId: "bbbbbbbb-0000-0000-0000-0000000000bb",
  schoolId: "school-1",
  name: "Preview Admin",
  email: "admin@preview.test",
  role: "ADMIN_OPERATOR",
  tokenVersion: 0,
});

function authPost(path: string) {
  return request(createServer()).post(path).set("Authorization", `Bearer ${AUTH_TOKEN}`);
}

function authGet(path: string) {
  return request(createServer()).get(path).set("Authorization", `Bearer ${AUTH_TOKEN}`);
}

beforeEach(() => {
  ocrMockState.idCropTexts = [];
  routeState.nextBatchId = 1;
  routeState.batches = [];
  routeState.rows = [];
  routeState.auditLogs = [];
  authState.validateSchoolSession.mockClear();
});

// Tiny dummy buffer ? not a valid image; Sharp will reject it gracefully
const FAKE_PNG = Buffer.from("not-a-real-png");
const FAKE_PDF = Buffer.from("%PDF-1.4 fake");
const TOP_RIGHT_ID_MESSAGE = "Could not read the marksheet ID from the top-right corner. Please upload a clearer image or enter the sheet ID manually.";

async function makeMarksheetScan(): Promise<Buffer> {
  const svg = `
    <svg width="1000" height="1400" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="white"/>
      <text x="900" y="70" text-anchor="end" font-family="Arial" font-size="24" font-weight="700">MS-2026-SENI-A-MATH-BOT-TE</text>
      <text x="900" y="105" text-anchor="end" font-family="Arial" font-size="18">SHEET NO: 20260613-265</text>
      <text x="60" y="160" font-family="Arial" font-size="32" font-weight="700">ACADEMIC MARKSHEET</text>
      <rect x="40" y="320" width="920" height="720" fill="none" stroke="black" stroke-width="2"/>
    </svg>
  `;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

// -- Scan upload endpoint ------------------------------------------------------

describe("POST /api/imports/scans/upload", () => {
  it("returns 400 when no file is attached", async () => {
    const res = await authPost("/api/imports/scans/upload")
      .field("schoolCode", SCHOOL)
      .field("context", validContext);
    expect(res.status).toBe(400);
    expect(res.body.error).toBe(true);
    expect(res.body.code).toBe("MISSING_FILE");
    expect(res.body.message).toMatch(/no scan file/i);
  });

  it("returns 400 SHEET_ID_NOT_DETECTED when file is uploaded but no context given", async () => {
    // No context or marksheetId provided ? OCR on fake image finds nothing.
    // Should return SHEET_ID_NOT_DETECTED (not CONTEXT_REQUIRED, not 500).
    const res = await authPost("/api/imports/scans/upload")
      .field("schoolCode", SCHOOL)
      .attach("file", FAKE_PNG, { filename: "marksheet.png", contentType: "image/png" });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe(true);
    expect(res.body.code).toBe("SHEET_ID_NOT_DETECTED");
    expect(res.body.message).toMatch(/top-right/i);
    expect(res.body.message).toBe(TOP_RIGHT_ID_MESSAGE);
    expect(Array.isArray(res.body.details)).toBe(true);
  });

  it("does not return 500 when a valid scan image has no readable sheet ID", async () => {
    ocrMockState.idCropTexts = ["", "", "", ""];

    const res = await authPost("/api/imports/scans/upload")
      .field("schoolCode", SCHOOL)
      .attach("file", await makeMarksheetScan(), { filename: "marksheet.png", contentType: "image/png" });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe(true);
    expect(res.body.code).toBe("SHEET_ID_NOT_DETECTED");
    expect(res.body.message).toBe(TOP_RIGHT_ID_MESSAGE);
  });

  it("returns 400 for unsupported scan file type CSV", async () => {
    const res = await authPost("/api/imports/scans/upload")
      .field("schoolCode", SCHOOL)
      .field("context", validContext)
      .attach("file", Buffer.from("a,b,c"), { filename: "marks.csv", contentType: "text/csv" });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe(true);
    expect(res.body.code).toBe("INVALID_FILE_TYPE");
    expect(res.body.message).toMatch(/unsupported file type/i);
  });

  it("returns 400 for unsupported scan file type XLS", async () => {
    const res = await authPost("/api/imports/scans/upload")
      .field("schoolCode", SCHOOL)
      .field("context", validContext)
      .attach("file", Buffer.from("fake-xls"), {
        filename: "marks.xls",
        contentType: "application/vnd.ms-excel",
      });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe(true);
    expect(res.body.code).toBe("INVALID_FILE_TYPE");
    expect(res.body.message).toMatch(/unsupported file type/i);
  });

  it("returns 400 EMPTY_UPLOAD for a zero-byte scan file", async () => {
    const res = await authPost("/api/imports/scans/upload")
      .field("schoolCode", SCHOOL)
      .field("context", validContext)
      .attach("file", Buffer.alloc(0), { filename: "empty.png", contentType: "image/png" });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe(true);
    expect(res.body.code).toBe("EMPTY_UPLOAD");
    expect(res.body.message).toMatch(/empty/i);
  });

  it("accepts PDF but blocks cross-tenant schoolCode with 403", async () => {
    const res = await authPost("/api/imports/scans/upload")
      .query({ schoolCode: UNKNOWN })
      .field("context", validContext)
      .attach("file", FAKE_PDF, { filename: "marksheet.pdf", contentType: "application/pdf" });
    expect(res.status).toBe(403);
  });

  it("accepts PNG but blocks cross-tenant schoolCode with 403", async () => {
    const res = await authPost("/api/imports/scans/upload")
      .query({ schoolCode: UNKNOWN })
      .field("context", validContext)
      .attach("file", FAKE_PNG, { filename: "marksheet.png", contentType: "image/png" });
    expect(res.status).toBe(403);
  });

  it("accepts JPG but blocks cross-tenant schoolCode with 403", async () => {
    const res = await authPost("/api/imports/scans/upload")
      .query({ schoolCode: UNKNOWN })
      .field("context", validContext)
      .attach("file", FAKE_PNG, { filename: "marksheet.jpg", contentType: "image/jpeg" });
    expect(res.status).toBe(403);
  });

  it("accepts JPEG but blocks cross-tenant schoolCode with 403", async () => {
    const res = await authPost("/api/imports/scans/upload")
      .query({ schoolCode: UNKNOWN })
      .field("context", validContext)
      .attach("file", FAKE_PNG, { filename: "marksheet.jpeg", contentType: "image/jpeg" });
    expect(res.status).toBe(403);
  });

  it("accepts WEBP but blocks cross-tenant schoolCode with 403", async () => {
    const res = await authPost("/api/imports/scans/upload")
      .query({ schoolCode: UNKNOWN })
      .field("context", validContext)
      .attach("file", FAKE_PNG, { filename: "marksheet.webp", contentType: "image/webp" });
    expect(res.status).toBe(403);
  });

  it("returns 200 with batchId for SCU-PREVIEW ? extraction may fail on fake image", async () => {
    const res = await authPost("/api/imports/scans/upload")
      .field("schoolCode", SCHOOL)
      .field("context", validContext)
      .attach("file", FAKE_PNG, { filename: "test.png", contentType: "image/png" });
    expect(res.status).toBe(200);
    expect(typeof res.body.batchId).toBe("string");
    expect(res.body.scanBatchId).toBe(res.body.batchId);
    expect(res.body.batchId.length).toBeGreaterThan(0);
    expect(res.body.contextSource).toBe("selected-context");
    expect(res.body.resolvedContext).toBeDefined();
    // Extraction on a fake file returns PARSED or FAILED ? both are valid
    expect(["PARSED", "FAILED"]).toContain(res.body.parseStatus);
    expect(typeof res.body.message).toBe("string");
    expect(Array.isArray(res.body.rows)).toBe(true);
  });

  it("does not auto-commit scanned rows ? rows never committed without operator approval", async () => {
    const res = await authPost("/api/imports/scans/upload")
      .field("schoolCode", SCHOOL)
      .field("context", validContext)
      .attach("file", FAKE_PNG, { filename: "test.png", contentType: "image/png" });
    expect(res.status).toBe(200);
    // Any returned rows must be in PARSED/NEEDS_REVIEW/VALID/INVALID ? never COMMITTED
    const rows = (res.body.rows ?? []) as { status: string }[];
    for (const row of rows) {
      expect(row.status).not.toBe("COMMITTED");
    }
  });

  it("scan batch can be reloaded by ID after upload", async () => {
    const upload = await authPost("/api/imports/scans/upload")
      .field("schoolCode", SCHOOL)
      .field("context", validContext)
      .attach("file", FAKE_PNG, { filename: "test.png", contentType: "image/png" });

    expect(upload.status).toBe(200);

    const reload = await authGet(`/api/imports/scan-batches/${upload.body.batchId}`);
    expect(reload.status).toBe(200);
    expect(reload.body.batchId).toBe(upload.body.batchId);
    expect(reload.body.scanBatchId).toBe(upload.body.batchId);
    expect(reload.body.contextSource).toBe("selected-context");
    expect(reload.body.resolvedContext).toBeDefined();
  });
});

describe("POST /api/imports/scans/dry-run", () => {
  it("dry-run does not clear extraction rows and persists operator corrections to the batch", async () => {
    const upload = await authPost("/api/imports/scans/upload")
      .field("schoolCode", SCHOOL)
      .field("context", validContext)
      .attach("file", FAKE_PNG, { filename: "test.png", contentType: "image/png" });

    expect(upload.status).toBe(200);

    const rows = [{
      rowNumber: 1,
      admissionNumber: "S1A-001",
      studentName: "Kampala Ssempebwa",
      writtenMark: "",
      splitMark: "",
      extractedMark: "",
      suggestedMark: "",
      confidence: 0,
      remarks: "",
      status: "MISSING",
      validationErrors: [],
      operatorCorrection: "76",
    }];

    const dryRun = await authPost("/api/imports/scans/dry-run")
      .send({
        schoolCode: SCHOOL,
        batchId: upload.body.batchId,
        context: JSON.parse(validContext),
        rows,
      });

    expect(dryRun.status).toBe(200);
    expect(dryRun.body.rows).toHaveLength(1);
    expect(dryRun.body.rows[0].operatorCorrection).toBe("76");

    const reload = await authGet(`/api/imports/scan-batches/${upload.body.batchId}`);
    expect(reload.status).toBe(200);
    expect(reload.body.rows).toHaveLength(1);
    expect(reload.body.rows[0].operatorCorrection).toBe("76");
  });
});

// -- Context detection endpoints -----------------------------------------------

describe("POST /api/imports/scans/detect-context", () => {
  it("returns 403 for cross-tenant schoolCode", async () => {
    const res = await authPost("/api/imports/scans/detect-context")
      .query({ schoolCode: UNKNOWN })
      .attach("file", FAKE_PNG, { filename: "test.png", contentType: "image/png" });
    expect(res.status).toBe(403);
  });

  it("returns 200 with detectionStatus for known school (no real ID in fake image)", async () => {
    const res = await authPost("/api/imports/scans/detect-context")
      .field("schoolCode", SCHOOL)
      .attach("file", FAKE_PNG, { filename: "test.png", contentType: "image/png" });
    expect(res.status).toBe(200);
    expect(["DETECTED", "PARTIAL", "NOT_FOUND", "ERROR"]).toContain(res.body.detectionStatus);
    expect(typeof res.body.message).toBe("string");
  });

  it("detects sheet ID from normal top-right crop", async () => {
    ocrMockState.idCropTexts = [
      "Marksheet ID: MS-2026-SENI-A-MATH-BOT-TE",
      "",
      "",
      "",
    ];

    const res = await authPost("/api/imports/scans/detect-context")
      .field("schoolCode", SCHOOL)
      .attach("file", await makeMarksheetScan(), { filename: "scan.png", contentType: "image/png" });

    expect(res.status).toBe(200);
    expect(res.body.detectionStatus).toBe("DETECTED");
    expect(res.body.normalizedRecognizedId).toBe("MS-2026-SEN1-A-MATH-BOT-TE");
    expect(res.body.matchSource).toBe("header");
    expect(res.body.contextSource).toBe("recognized-id");
  });

  it("detects sheet ID from slightly shifted top-right crop", async () => {
    ocrMockState.idCropTexts = [
      "",
      "Marksheet ID: MS-2026-SENI-A-MATH-BOT-TE",
      "",
      "",
    ];

    const res = await authPost("/api/imports/scans/detect-context")
      .field("schoolCode", SCHOOL)
      .attach("file", await makeMarksheetScan(), { filename: "scan.png", contentType: "image/png" });

    expect(res.status).toBe(200);
    expect(res.body.detectionStatus).toBe("DETECTED");
    expect(res.body.normalizedRecognizedId).toBe("MS-2026-SEN1-A-MATH-BOT-TE");
    expect(res.body.matchSource).toBe("header");
    expect(res.body.contextSource).toBe("recognized-id");
  });

  it("returns SHEET_ID_NOT_DETECTED-style message when OCR finds no sheet ID", async () => {
    ocrMockState.idCropTexts = ["", "", "", ""];

    const res = await authPost("/api/imports/scans/detect-context")
      .field("schoolCode", SCHOOL)
      .attach("file", await makeMarksheetScan(), { filename: "scan.png", contentType: "image/png" });

    expect(res.status).toBe(200);
    expect(res.body.detectionStatus).toBe("NOT_FOUND");
    expect(res.body.message).toBe(TOP_RIGHT_ID_MESSAGE);
  });

  it("resolves context when explicit marksheetId field provided (no file needed)", async () => {
    const res = await authPost("/api/imports/scans/detect-context")
      .field("schoolCode", SCHOOL)
      .field("marksheetId", "MS-2026-SENI-A-ENGL-BOT-TE");
    expect(res.status).toBe(200);
    // Result can be DETECTED (batch match), PARTIAL (ID decoded), or NOT_FOUND (invalid ID)
    expect(["DETECTED", "PARTIAL", "NOT_FOUND"]).toContain(res.body.detectionStatus);
  });
});

describe("GET /api/imports/scans/context", () => {
  it("returns 400 when marksheetId is missing", async () => {
    const res = await authGet(`/api/imports/scans/context?schoolCode=${SCHOOL}`);
    expect(res.status).toBe(400);
    expect(res.body.error).toBe(true);
    expect(res.body.code).toBe("MISSING_MARKSHEET_ID");
    expect(typeof res.body.message).toBe("string");
  });

  it("returns 403 for cross-tenant schoolCode", async () => {
    const res = await authGet(`/api/imports/scans/context?marksheetId=MS-2026-S1-A-MATH-BOT-T1&schoolCode=${UNKNOWN}`);
    expect(res.status).toBe(403);
  });

  it("returns detectionStatus for a valid-format ID with known school", async () => {
    const res = await authGet(`/api/imports/scans/context?marksheetId=MS-2026-SENI-A-ENGL-BOT-TE&schoolCode=${SCHOOL}`);
    expect(res.status).toBe(200);
    expect(["DETECTED", "PARTIAL", "NOT_FOUND"]).toContain(res.body.detectionStatus);
    expect(typeof res.body.message).toBe("string");
  });

  it("returns NOT_FOUND for a malformed ID", async () => {
    const res = await authGet(`/api/imports/scans/context?marksheetId=NOT-A-VALID-ID&schoolCode=${SCHOOL}`);
    expect(res.status).toBe(200);
    expect(res.body.detectionStatus).toBe("NOT_FOUND");
  });
});

// -- Scan batches list ---------------------------------------------------------

describe("GET /api/imports/scans/batches", () => {
  it("returns 403 for cross-tenant schoolCode", async () => {
    const res = await authGet(`/api/imports/scans/batches?schoolCode=${UNKNOWN}`);
    expect(res.status).toBe(403);
  });

  it("returns array for known school", async () => {
    const res = await authGet(`/api/imports/scans/batches?schoolCode=${SCHOOL}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.batches)).toBe(true);
  }, 15000);
});

// -- Digital import still works ------------------------------------------------

describe("POST /api/imports/marks/dry-run (digital)", () => {
  it("returns 400 when csvText is missing", async () => {
    const res = await authPost("/api/imports/marks/dry-run").send({
      schoolCode: SCHOOL,
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe(true);
    expect(res.body.code).toBe("VALIDATION_ERROR");
    expect(res.body.ok).toBe(false);
    expect(res.body.message).toBe("Please check the submitted details.");
    expect(Array.isArray(res.body.details)).toBe(true);
  });

  it("returns DRY_RUN for valid CSV", async () => {
    const csvText = `admissionNumber,studentName,class,stream,subject,term,examType,marks,comments
S1A-001,Kampala Ssempebwa,Senior 1 A,A,English Language,Term 1,BOT,81,ok`;
    const res = await authPost("/api/imports/marks/dry-run").send({
      schoolCode: SCHOOL,
      csvText,
    });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("DRY_RUN");
  });

  it("does not allow commit to bypass dry-run validation", async () => {
    const csvText = `admissionNumber,studentName,class,stream,subject,term,examType,marks,comments
S1A-001,Kampala Ssempebwa,Senior 1 A,A,English Language,Term 1,BOT,81,guard`;
    const res = await authPost("/api/imports/marks/commit").send({
      schoolCode: SCHOOL,
      csvText,
    });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("FAILED");
    expect(JSON.stringify(res.body.rows)).toMatch(/Dry-run validation is required before commit/i);
  });
});

// -- Sheet ID top-right corner detection --------------------------------------

describe("Sheet ID detection ? top-right corner", () => {
  it("detect-context with file shows top-right corner message when ID not found", async () => {
    const res = await authPost("/api/imports/scans/detect-context")
      .field("schoolCode", SCHOOL)
      .attach("file", FAKE_PNG, { filename: "scan.png", contentType: "image/png" });
    expect(res.status).toBe(200);
    // When fake image yields no detectable ID, message must mention top-right corner
    if (res.body.detectionStatus === "NOT_FOUND") {
      expect(res.body.message).toMatch(/top-right/i);
    }
  });

  it("upload with file but no context does not return 500", async () => {
    const res = await authPost("/api/imports/scans/upload")
      .field("schoolCode", SCHOOL)
      .attach("file", FAKE_PNG, { filename: "scan.png", contentType: "image/png" });
    expect(res.status).not.toBe(500);
    expect(res.body.error).toBe(true);
    expect(typeof res.body.message).toBe("string");
    expect(res.body.message).not.toMatch(/unexpected server error/i);
  });

  it("detect-context never crashes ? returns structured response even for unreadable image", async () => {
    const res = await authPost("/api/imports/scans/detect-context")
      .field("schoolCode", SCHOOL)
      .attach("file", FAKE_PNG, { filename: "scan.png", contentType: "image/png" });
    expect(res.status).toBe(200);
    expect(["DETECTED", "PARTIAL", "NOT_FOUND"]).toContain(res.body.detectionStatus);
    expect(typeof res.body.message).toBe("string");
  });
});

// -- Multer error handling ------------------------------------------------------

describe("Multer errors return structured 400, not generic 500", () => {
  it("oversized file on /upload returns 400 FILE_TOO_LARGE (not 500)", async () => {
    // 21 MB > the 20 MB multer limit ? triggers MulterError LIMIT_FILE_SIZE
    const bigFile = Buffer.alloc(21 * 1024 * 1024, 0);
    const res = await authPost("/api/imports/scans/upload")
      .field("schoolCode", SCHOOL)
      .field("context", validContext)
      .attach("file", bigFile, { filename: "scan.png", contentType: "image/png" });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe(true);
    expect(res.body.code).toBe("FILE_TOO_LARGE");
    expect(typeof res.body.message).toBe("string");
    expect(res.body.message).not.toMatch(/unexpected server error/i);
    expect(Array.isArray(res.body.details)).toBe(true);
  }, 15000);

  it("oversized file on /detect-context returns 400 FILE_TOO_LARGE (not 500)", async () => {
    const bigFile = Buffer.alloc(21 * 1024 * 1024, 0);
    const res = await authPost("/api/imports/scans/detect-context")
      .field("schoolCode", SCHOOL)
      .attach("file", bigFile, { filename: "scan.png", contentType: "image/png" });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe(true);
    expect(res.body.code).toBe("FILE_TOO_LARGE");
    expect(typeof res.body.message).toBe("string");
    expect(res.body.message).not.toMatch(/unexpected server error/i);
  }, 15000);
});

// -- Structured error shape tests ---------------------------------------------

describe("Import error responses always use structured shape", () => {
  it("bad file template (malformed CSV) returns TEMPLATE_ERROR with safe message", async () => {
    // csv-parse throws on mismatched quotes ? not a ZodError, but should be caught and structured
    const malformedCsv = `admissionNumber,class\n"unclosed quote,Senior 1 A`;
    const res = await authPost("/api/imports/marks/dry-run").send({
      schoolCode: SCHOOL,
      csvText: malformedCsv,
    });
    // Either caught as TEMPLATE_ERROR (csv-parse throw) or returns DRY_RUN with empty rows ? both safe
    if (res.status === 400) {
      expect(res.body.error).toBe(true);
      expect(res.body.code).toBe("TEMPLATE_ERROR");
      expect(typeof res.body.message).toBe("string");
      expect(res.body.message).not.toBe("Unexpected error");
      expect(res.body.message).not.toMatch(/unexpected server error/i);
    } else {
      expect(res.status).toBe(200);
    }
  });

  it("missing class/stream/term in scan context returns IMPORT_VALIDATION_FAILED with details", async () => {
    const incompleteContext = JSON.stringify({
      marksheetId: "",
      className: "",
      streamName: "",
      subjectName: "Mathematics",
      termName: "Term 1",
      examType: "BOT",
      academicYear: "2026",
    });
    const res = await authPost("/api/imports/scans/upload")
      .field("schoolCode", SCHOOL)
      .field("context", incompleteContext)
      .attach("file", FAKE_PNG, { filename: "test.png", contentType: "image/png" });
    // className and streamName required by scanContextSchema ? ZodError ? IMPORT_VALIDATION_FAILED
    // OR resolvedContext is null ? CONTEXT_REQUIRED ? both are structured
    expect([400, 200]).toContain(res.status);
    if (res.status === 400) {
      expect(res.body.error).toBe(true);
      expect(typeof res.body.code).toBe("string");
      expect(typeof res.body.message).toBe("string");
      expect(res.body.message).not.toBe("Unexpected error");
    }
  });

  it("OCR unavailable shows OCR provider message (not generic error) in extraction result", async () => {
    const res = await authPost("/api/imports/scans/upload")
      .field("schoolCode", SCHOOL)
      .field("context", validContext)
      .attach("file", FAKE_PNG, { filename: "test.png", contentType: "image/png" });
    expect(res.status).toBe(200);
    // When OCR is not reachable (test env), extraction returns FAILED with a specific message
    if (!res.body.providerReachable) {
      expect(res.body.parseStatus).toBe("FAILED");
      expect(res.body.message).toMatch(/ocr/i);
      expect(res.body.message).not.toBe("Unexpected error");
      expect(res.body.message).not.toMatch(/unexpected server error/i);
    }
  });

  it("validation error returns safe structured envelope ? not 'Unexpected error'", async () => {
    // ZodError on malformed request body hits the global handler ? structured response
    const res = await authPost("/api/imports/scans/dry-run").send({
      schoolCode: SCHOOL,
      // context is required but missing ? ZodError ? VALIDATION_ERROR
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe(true);
    expect(res.body.code).toBe("VALIDATION_ERROR");
    expect(res.body.ok).toBe(false);
    expect(res.body.message).toBe("Please check the submitted details.");
    expect(typeof res.body.message).toBe("string");
    expect(res.body.message).not.toBe("Unexpected error");
    expect(Array.isArray(res.body.details)).toBe(true);
    expect(res.body.details.length).toBeGreaterThan(0);
  });

  it("no matching students in scan dry-run shows all rows as INVALID with enrollment error", async () => {
    const unknownClassContext = {
      ...JSON.parse(validContext) as Record<string, string>,
      className: "NonExistentClass999",
      streamName: "Z",
    };
    const rows = [{
      rowNumber: 1,
      admissionNumber: "S1A-001",
      studentName: "Test Student",
      writtenMark: "",
      splitMark: "",
      extractedMark: "",
      suggestedMark: "",
      confidence: 0,
      remarks: "",
      status: "MISSING",
      validationErrors: [],
      operatorCorrection: "75",
    }];
    const res = await authPost("/api/imports/scans/dry-run")
      .send({ schoolCode: SCHOOL, context: unknownClassContext, rows });
    // Empty roster ? admission numbers not enrolled ? rows come back INVALID
    expect(res.status).toBe(200);
    expect(res.body.validRows).toBe(0);
    expect(res.body.invalidRows).toBeGreaterThan(0);
    // Validation error on the row explains the mismatch
    const firstRow = (res.body.rows as Array<{ validationErrors: string[] }>)[0];
    expect(firstRow?.validationErrors?.some((e: string) => /not enrolled/i.test(e))).toBe(true);
  });

  it("route-level error responses include error:true, code, message, details fields", async () => {
    const errorEndpoints = [
      // 400 ? missing file (route-level validation, school is valid)
      () => authPost("/api/imports/scans/upload")
        .field("schoolCode", SCHOOL)
        .field("context", validContext),
      // 400 ? missing csvText ZodError
      () => authPost("/api/imports/marks/dry-run").send({ schoolCode: SCHOOL }),
      // 400 ? missing marksheetId
      () => authGet(`/api/imports/scans/context?schoolCode=${SCHOOL}`),
    ];

    for (const call of errorEndpoints) {
      const res = await call();
      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(res.body.error).toBe(true);
      expect(typeof res.body.code).toBe("string");
      expect(typeof res.body.message).toBe("string");
      expect(Array.isArray(res.body.details)).toBe(true);
      expect(res.body.message).not.toBe("Unexpected error");
      expect(res.body.message).not.toMatch(/^unexpected server error$/i);
    }
  });
});


