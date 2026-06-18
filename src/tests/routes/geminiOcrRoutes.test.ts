import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createServer } from "../../server";

// Mock both Gemini services so tests never call the real API.
vi.mock("../../server/services/geminiOcrService", () => ({
  extractMarksWithGemini: vi.fn(),
  pingGemini: vi.fn(),
}));

vi.mock("../../server/services/geminiRosterService", () => ({
  parseRosterImagePerfect: vi.fn(),
}));

import { extractMarksWithGemini, pingGemini } from "../../server/services/geminiOcrService";
import { parseRosterImagePerfect } from "../../server/services/geminiRosterService";
import type { GeminiExtractedMarkRow } from "../../server/services/geminiOcrService";
import type { PerfectRosterRow } from "../../server/services/geminiRosterService";

const mockExtractMarks = vi.mocked(extractMarksWithGemini);
const mockParseRoster = vi.mocked(parseRosterImagePerfect);
const mockPingGemini = vi.mocked(pingGemini);

const FAKE_IMAGE = Buffer.from("fake-image-data");

// ── Marks route ───────────────────────────────────────────────────────────────

describe("GET /api/test-gemini-marks/health", () => {
  it("returns 200 and route confirmation", async () => {
    const app = createServer();
    const res = await request(app).get("/api/test-gemini-marks/health");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.route).toBe("gemini-ocr-mounted");
  });
});

describe("POST /api/test-gemini-marks", () => {
  beforeEach(() => {
    mockExtractMarks.mockReset();
  });

  it("returns 400 when no image file is uploaded", async () => {
    const app = createServer();
    const res = await request(app).post("/api/test-gemini-marks");
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/no image/i);
  });

  it("returns 400 when document is not a marksheet", async () => {
    mockExtractMarks.mockRejectedValueOnce(
      new Error("Uploaded document does not look like a marksheet."),
    );
    const app = createServer();
    const res = await request(app)
      .post("/api/test-gemini-marks")
      .attach("image", FAKE_IMAGE, { filename: "roster.jpg", contentType: "image/jpeg" });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/marksheet/i);
  });

  it("returns 200 with extracted rows and summary when document is a marksheet", async () => {
    const mockRows: GeminiExtractedMarkRow[] = [
      { studentId: "SC2026-0001", studentName: "Alice Nantongo", mark: "82", confidenceScore: 0.95, needsReview: false },
    ];
    mockExtractMarks.mockResolvedValueOnce({
      rows: mockRows,
      summary: { totalRows: 1, validRows: 1, reviewRows: 0, missingMarkRows: 0, invalidMarkRows: 0 },
    });
    const app = createServer();
    const res = await request(app)
      .post("/api/test-gemini-marks")
      .attach("image", FAKE_IMAGE, { filename: "marks.jpg", contentType: "image/jpeg" });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.count).toBe(1);
    expect(res.body.rows[0].studentId).toBe("SC2026-0001");
    expect(res.body.rows[0].mark).toBe("82");
    expect(res.body.summary.totalRows).toBe(1);
    expect(res.body.summary.validRows).toBe(1);
  });

  it("returns 500 for unexpected Gemini errors", async () => {
    mockExtractMarks.mockRejectedValueOnce(new Error("Network timeout"));
    const app = createServer();
    const res = await request(app)
      .post("/api/test-gemini-marks")
      .attach("image", FAKE_IMAGE, { filename: "marks.jpg", contentType: "image/jpeg" });
    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
  });
});

// ── Roster route ──────────────────────────────────────────────────────────────

describe("GET /api/test-gemini-roster/health", () => {
  it("returns 200 and route confirmation", async () => {
    const app = createServer();
    const res = await request(app).get("/api/test-gemini-roster/health");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.route).toBe("gemini-roster-mounted");
  });
});

describe("POST /api/test-gemini-roster", () => {
  beforeEach(() => {
    mockParseRoster.mockReset();
  });

  it("returns 400 when no image file is uploaded", async () => {
    const app = createServer();
    const res = await request(app).post("/api/test-gemini-roster");
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/no image/i);
  });

  it("maps teacher level field correctly ? A' Level and O' Level are not marks", async () => {
    const mockRows: PerfectRosterRow[] = [
      {
        no: "1",
        teacherName: "MAKOHA LAWRENCE",
        subject: "Physics",
        level: "A' Level",
        confidenceScore: 0.95,
        needsReview: false,
      },
      {
        no: "2",
        teacherName: "Nantale Margret",
        subject: "Literature",
        level: "O' Level",
        confidenceScore: 0.9,
        needsReview: false,
      },
    ];
    mockParseRoster.mockResolvedValueOnce(mockRows);
    const app = createServer();
    const res = await request(app)
      .post("/api/test-gemini-roster")
      .attach("image", FAKE_IMAGE, { filename: "roster.jpg", contentType: "image/jpeg" });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.rows[0].level).toBe("A' Level");
    expect(res.body.rows[1].level).toBe("O' Level");
    // level should never appear in a mark-like numeric field
    expect(res.body.rows[0].teacherName).toBe("MAKOHA LAWRENCE");
  });

  it("passes knownTeachers JSON to the service", async () => {
    mockParseRoster.mockResolvedValueOnce([]);
    const app = createServer();
    await request(app)
      .post("/api/test-gemini-roster")
      .field("knownTeachers", JSON.stringify(["MAKOHA LAWRENCE", "Nantale Margret"]))
      .attach("image", FAKE_IMAGE, { filename: "roster.jpg", contentType: "image/jpeg" });
    expect(mockParseRoster).toHaveBeenCalledWith(
      expect.any(Buffer),
      ["MAKOHA LAWRENCE", "Nantale Margret"],
      expect.any(String),
    );
  });

  it("proceeds without knownTeachers when field is absent", async () => {
    mockParseRoster.mockResolvedValueOnce([]);
    const app = createServer();
    const res = await request(app)
      .post("/api/test-gemini-roster")
      .attach("image", FAKE_IMAGE, { filename: "roster.jpg", contentType: "image/jpeg" });
    expect(res.status).toBe(200);
    expect(mockParseRoster).toHaveBeenCalledWith(expect.any(Buffer), [], expect.any(String));
  });
});

// ── Health endpoint ───────────────────────────────────────────────────────────

describe("GET /api/test-gemini-health", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    mockPingGemini.mockReset();
  });

  it("returns keyConfigured: false and success: false when API key is missing", async () => {
    vi.stubEnv("GEMINI_API_KEY", "");
    const app = createServer();
    const res = await request(app).get("/api/test-gemini-health");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(false);
    expect(res.body.keyConfigured).toBe(false);
    expect(res.body.nodeVersion).toBeTruthy();
    expect(res.body.message).toMatch(/not configured/i);
  });

  it("does not expose the API key value in the response", async () => {
    vi.stubEnv("GEMINI_API_KEY", "super-secret-key-12345");
    mockPingGemini.mockResolvedValueOnce({ model: "gemini-2.5-flash" });
    const app = createServer();
    const res = await request(app).get("/api/test-gemini-health");
    const body = JSON.stringify(res.body);
    expect(body).not.toContain("super-secret-key-12345");
  });

  it("returns success: true when pingGemini resolves", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    mockPingGemini.mockResolvedValueOnce({ model: "gemini-2.5-flash" });
    const app = createServer();
    const res = await request(app).get("/api/test-gemini-health");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.keyConfigured).toBe(true);
    expect(res.body.nodeVersion).toBe(process.version);
  });

  it("returns success: false with diagnostic in dev when pingGemini throws a network error", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    vi.stubEnv("NODE_ENV", "development");
    const fetchErr = new Error("fetch failed");
    mockPingGemini.mockRejectedValueOnce(fetchErr);
    const app = createServer();
    const res = await request(app).get("/api/test-gemini-health");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(false);
    expect(res.body.keyConfigured).toBe(true);
    expect(res.body.diagnostic).toBeDefined();
    expect(res.body.diagnostic.message).toBe("fetch failed");
  });

  it("omits diagnostic object in production when pingGemini throws", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("INTERNAL_TEST_KEY", "test-secret");
    mockPingGemini.mockRejectedValueOnce(new Error("fetch failed"));
    const app = createServer();
    const res = await request(app)
      .get("/api/test-gemini-health")
      .set("x-internal-test-key", "test-secret");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(false);
    expect(res.body.diagnostic).toBeUndefined();
  });
});

// ── Production key-protection boundary tests ──────────────────────────────────
//
// These tests verify the separation of concerns:
//   /api/test-gemini-*  ? protected by x-internal-test-key in production
//   /api/marks-import/* ? protected by normal app auth, NOT x-internal-test-key
//
// Root cause that was fixed: router.use(requireInternalKey) gated ALL /api/*
// traffic because the router is mounted with app.use("/api", ...). Moving the
// guard to per-route middleware ensures only the pilot test routes are affected.

describe("production x-internal-test-key protection", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("POST /api/test-gemini-marks rejects without x-internal-test-key in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("INTERNAL_TEST_KEY", "test-secret");
    const app = createServer();
    const res = await request(app)
      .post("/api/test-gemini-marks")
      .attach("image", FAKE_IMAGE, { filename: "marks.jpg", contentType: "image/jpeg" });
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/x-internal-test-key/i);
  });

  it("GET /api/test-gemini-marks/health rejects without x-internal-test-key in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("INTERNAL_TEST_KEY", "test-secret");
    const app = createServer();
    const res = await request(app).get("/api/test-gemini-marks/health");
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/x-internal-test-key/i);
  });

  it("GET /api/test-gemini-health rejects without x-internal-test-key in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("INTERNAL_TEST_KEY", "test-secret");
    const app = createServer();
    const res = await request(app).get("/api/test-gemini-health");
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/x-internal-test-key/i);
  });

  it("POST /api/marks-import/scan/extract does NOT return 403 without x-internal-test-key in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("INTERNAL_TEST_KEY", "test-secret");
    const app = createServer();
    // Send without the internal key ? the real route uses normal app auth, not the test key.
    // Without a bearer token in production, resolveSchoolContext returns 401.
    // If the x-internal-test-key guard were blocking here it would return 403 ? that would be wrong.
    const res = await request(app)
      .post("/api/marks-import/scan/extract")
      .attach("image", FAKE_IMAGE, { filename: "marks.jpg", contentType: "image/jpeg" })
      .field("classId", "c1").field("subjectId", "s1").field("termId", "t1").field("examType", "BOT");
    expect(res.status).toBe(401); // auth required ? not 403 key-guard
  });
});

