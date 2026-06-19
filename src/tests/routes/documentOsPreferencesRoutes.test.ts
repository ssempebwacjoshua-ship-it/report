import request from "supertest";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// ── Mock auth ─────────────────────────────────────────────────────────────────

vi.mock("../../server/services/documentIntelligenceService", () => ({
  findOrCreateSchoolOperatorCreator: vi.fn().mockResolvedValue("creator-school-001"),
  findCreatorById: vi.fn(),
}));

// ── Mock Prisma ───────────────────────────────────────────────────────────────

const mockFindMany = vi.fn();

vi.mock("../../server/db/prisma", () => ({
  prisma: {
    school: { findUnique: vi.fn().mockResolvedValue({ id: "school-001", code: "SCU", name: "Test School" }) },
    creator: { findFirst: vi.fn(), upsert: vi.fn() },
    creatorPreference: { findMany: mockFindMany },
  },
}));

// ── Constants ─────────────────────────────────────────────────────────────────

const SCHOOL_ID = "00000000-0000-0000-0000-000000000099";

async function makeToken() {
  const { signToken } = await import("../../server/services/authService");
  return signToken({
    userId: "00000000-0000-0000-0000-000000000001",
    schoolId: SCHOOL_ID,
    name: "Test Admin",
    email: "admin@test.ac.ug",
    role: "ADMIN_OPERATOR",
  });
}

function makePreferenceRow(key: string, value: unknown) {
  return {
    id: `pref-${key}`,
    creatorId: "creator-school-001",
    key,
    value,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

// ── Suite ─────────────────────────────────────────────────────────────────────

describe("GET /api/document-os/preferences (scope filtering)", () => {
  let app: ReturnType<typeof import("../../server").createServer>;

  beforeAll(async () => {
    const { createServer } = await import("../../server");
    app = createServer();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockFindMany.mockResolvedValue([
      makePreferenceRow("primaryColor", "#2563eb"),
      makePreferenceRow("defaultTone", "Formal"),
      makePreferenceRow("lawyer.firm", { name: "Acacia Legal", contact: "+256 700 000000" }),
      makePreferenceRow("lawyer.profile", { name: "Jane Lawyer", location: "Kampala" }),
      makePreferenceRow("lawyer.signatureBlock", "Sincerely,\nJane Lawyer"),
      makePreferenceRow("lawyer.withoutPrejudice", true),
      makePreferenceRow("lawyer.reviewDisclaimer", true),
    ]);
  });

  it("returns 401 without a token", async () => {
    const res = await request(app).get("/api/document-os/preferences");
    expect(res.status).toBe(401);
  });

  it("returns all preferences when no scope is given", async () => {
    const token = await makeToken();
    const res = await request(app)
      .get("/api/document-os/preferences")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.preferences).toHaveLength(7);
  });

  it("scope=school excludes all keys starting with 'lawyer.'", async () => {
    const token = await makeToken();
    const res = await request(app)
      .get("/api/document-os/preferences?scope=school")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    const keys: string[] = res.body.preferences.map((p: { key: string }) => p.key);
    expect(keys).not.toContain("lawyer.firm");
    expect(keys).not.toContain("lawyer.profile");
    expect(keys).not.toContain("lawyer.signatureBlock");
    expect(keys).not.toContain("lawyer.withoutPrejudice");
    expect(keys).not.toContain("lawyer.reviewDisclaimer");
    expect(keys.some((k) => k.toLowerCase().startsWith("lawyer."))).toBe(false);
    expect(keys).toContain("primaryColor");
    expect(keys).toContain("defaultTone");
  });

  it("scope=school response contains no key beginning with LAWYER. (case-insensitive)", async () => {
    const token = await makeToken();
    const res = await request(app)
      .get("/api/document-os/preferences?scope=school")
      .set("Authorization", `Bearer ${token}`);

    const body = JSON.stringify(res.body.preferences);
    expect(body.toLowerCase()).not.toContain('"lawyer.');
  });

  it("scope=lawyer returns only keys starting with 'lawyer.'", async () => {
    const token = await makeToken();
    const res = await request(app)
      .get("/api/document-os/preferences?scope=lawyer")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    const keys: string[] = res.body.preferences.map((p: { key: string }) => p.key);
    expect(keys.every((k) => k.toLowerCase().startsWith("lawyer."))).toBe(true);
    expect(keys).not.toContain("primaryColor");
    expect(keys).not.toContain("defaultTone");
  });

  it("scope=school returns at least the school preference keys", async () => {
    const token = await makeToken();
    const res = await request(app)
      .get("/api/document-os/preferences?scope=school")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.preferences.length).toBeGreaterThan(0);
  });

  it("ignores an unrecognised scope value and returns all preferences", async () => {
    const token = await makeToken();
    const res = await request(app)
      .get("/api/document-os/preferences?scope=unknown")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.preferences).toHaveLength(7);
  });
});
