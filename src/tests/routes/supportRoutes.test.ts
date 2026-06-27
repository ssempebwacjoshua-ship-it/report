import express from "express";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { signToken } from "../../server/services/authService";

const schoolFindUnique = vi.fn();
const auditLogCreate = vi.fn();

vi.mock("../../server/db/prisma", () => ({
  prisma: {
    school: { findUnique: schoolFindUnique },
    auditLog: { create: auditLogCreate },
  },
}));

vi.mock("../../server/services/sessionValidationService", () => ({
  validateSchoolSession: vi.fn(async (payload: {
    userId: string;
    schoolId: string;
    name: string;
    email: string;
    role: string;
    tokenVersion?: number;
    isPlatformOwner?: boolean;
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
        isPlatformOwner: payload.isPlatformOwner ?? false,
      },
      school: {
        id: payload.schoolId,
        code: "SCU-PREVIEW",
        name: "Preview School",
        isActive: true,
      },
      auth: payload,
    };
  }),
}));

describe("supportRoutes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("TELEGRAM_BOT_TOKEN", "test-bot-token");
    vi.stubEnv("TELEGRAM_SUPPORT_CHAT_ID", "8899226749");
    schoolFindUnique.mockResolvedValue({
      id: "school-1",
      code: "SCU-PREVIEW",
      name: "Preview School",
    });
    auditLogCreate.mockResolvedValue({ id: "audit-1" });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  async function makeToken() {
    return signToken({
      userId: "user-1",
      schoolId: "school-1",
      name: "Support User",
      email: "support.user@example.test",
      role: "ADMIN_OPERATOR",
      tokenVersion: 1,
    });
  }

  async function makeApp() {
    const { supportRoutes } = await import("../../server/routes/supportRoutes");
    const app = express();
    app.use(express.json());
    app.use(supportRoutes());
    app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
      if (error && typeof error === "object" && "issues" in error) {
        res.status(400).json(error);
        return;
      }
      res.status(500).json({ error: "Unexpected test error." });
    });
    return app;
  }

  it("rejects missing or empty messages", async () => {
    const token = await makeToken();
    const app = await makeApp();
    const res = await request(app)
      .post("/api/support/telegram")
      .set("Authorization", `Bearer ${token}`)
      .send({ message: "   ", pageUrl: "http://localhost:5173/students" });

    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body)).toMatch(/Please enter a support message/i);
  });

  it("returns 503 when Telegram support env is missing", async () => {
    vi.stubEnv("TELEGRAM_BOT_TOKEN", "");
    const token = await makeToken();
    const app = await makeApp();
    const res = await request(app)
      .post("/api/support/telegram")
      .set("Authorization", `Bearer ${token}`)
      .send({ message: "Need help with scan review.", pageUrl: "http://localhost:5173/imports" });

    expect(res.status).toBe(503);
    expect(res.body).toEqual({ error: "Support is not configured yet." });
  });

  it("uses the default support chat id when TELEGRAM_SUPPORT_CHAT_ID is not set", async () => {
    let capturedBody = "";
    vi.stubEnv("TELEGRAM_SUPPORT_CHAT_ID", "");
    vi.stubGlobal("fetch", vi.fn().mockImplementation(async (_url: string, init?: RequestInit) => {
      capturedBody = String(init?.body ?? "");
      return {
        json: async () => ({ ok: true }),
      };
    }));

    const token = await makeToken();
    const app = await makeApp();
    const res = await request(app)
      .post("/api/support/telegram")
      .set("Authorization", `Bearer ${token}`)
      .send({
        message: "Need help from the school dashboard.",
        pageUrl: "http://localhost:5173/dashboard",
      });

    expect(res.status).toBe(202);
    expect(capturedBody).toContain('"chat_id":"8899226749"');
  });

  it("sends a Telegram message when configured", async () => {
    let capturedBody = "";
    vi.stubGlobal("fetch", vi.fn().mockImplementation(async (_url: string, init?: RequestInit) => {
      capturedBody = String(init?.body ?? "");
      return {
        json: async () => ({ ok: true }),
      };
    }));

    const token = await makeToken();
    const app = await makeApp();
    const res = await request(app)
      .post("/api/support/telegram")
      .set("Authorization", `Bearer ${token}`)
      .send({
        message: "Students page is slow after filtering.",
        contact: "admin@example.test",
        pageUrl: "http://localhost:5173/students?classId=class-1",
      });

    expect(res.status).toBe(202);
    expect(res.body).toEqual({ ok: true });
    expect(capturedBody).toContain("Preview School");
    expect(capturedBody).toContain("support.user@example.test");
    expect(capturedBody).toContain("Students page is slow after filtering.");
    expect(capturedBody).toContain("/students?classId=class-1");
    expect(auditLogCreate).toHaveBeenCalledTimes(1);
  });
});
