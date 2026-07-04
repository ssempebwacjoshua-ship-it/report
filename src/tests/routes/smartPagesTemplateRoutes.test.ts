import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const platformClientMocks = vi.hoisted(() => ({
  checkEntitlement: vi.fn(),
}));

vi.mock("../../server/platformClient", async () => {
  const actual = await vi.importActual<typeof import("../../server/platformClient")>("../../server/platformClient");
  return {
    ...actual,
    checkEntitlement: platformClientMocks.checkEntitlement,
  };
});

import express from "express";
import { createServer } from "../../server";
import { smartPagesTemplateRoutes } from "../../server/routes/smartPagesTemplateRoutes";

function buildSchoolApp() {
  const app = express();
  app.use(express.json());
  app.use((req: any, _res, next) => {
    req.school = { id: "school-1", code: "SCH-1", name: "Preview School" };
    req.user = { userId: "user-1", schoolId: "school-1", role: "ADMIN_OPERATOR" };
    next();
  });
  app.use(smartPagesTemplateRoutes());
  return app;
}

describe("smartPagesTemplateRoutes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("ENABLE_SMART_PAGES_LAWYERS", "false");
    vi.stubEnv("SSAMENJ_PLATFORM_INTEGRATION_ENABLED", "true");
    vi.stubEnv("SSAMENJ_PLATFORM_URL", "http://platform.test");
    vi.stubEnv("SSAMENJ_PLATFORM_SERVICE_TOKEN", "token");
    vi.stubEnv("NODE_ENV", "test");
    platformClientMocks.checkEntitlement.mockResolvedValue({ allowed: true });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns only school templates from the school Smart Pages API", async () => {
    const res = await request(buildSchoolApp()).get("/api/smart-pages/school/templates?scope=parsed");

    expect(res.status).toBe(200);
    expect(res.body.vertical).toBe("SCHOOL");
    expect(res.body.templates.length).toBeGreaterThan(0);
    expect(res.body.templates.every((template: { vertical: string }) => template.vertical === "SCHOOL")).toBe(true);
    expect(JSON.stringify(res.body.templates).toLowerCase()).not.toMatch(/lawyer|legal|court|affidavit|contract|client intake|case brief/);
    expect(platformClientMocks.checkEntitlement).toHaveBeenCalledWith(expect.objectContaining({
      organizationId: "school-1",
      moduleCode: "smart_pages.templates",
    }));
  });

  it("enforces Smart Pages entitlement when platform integration is enabled", async () => {
    platformClientMocks.checkEntitlement.mockResolvedValueOnce({ allowed: false });

    const res = await request(buildSchoolApp()).get("/api/smart-pages/school/templates");

    expect(res.status).toBe(403);
    expect(res.body.error).toBe("MODULE_NOT_ENABLED");
    expect(res.body.moduleCode).toBe("smart_pages.templates");
  });

  it("rejects lawyer template IDs on the school Smart Pages API", async () => {
    const res = await request(buildSchoolApp()).get("/api/smart-pages/school/templates/legal-notice-demand-letter");

    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/not available for school connect smart pages/i);
  });

  it("does not expose lawyer templates unless the lawyer vertical is enabled", async () => {
    const res = await request(buildSchoolApp()).get("/api/smart-pages/lawyer/templates?scope=parsed");

    expect(res.status).toBe(404);
  });

  it("still serves school templates when platform integration is disabled", async () => {
    vi.stubEnv("SSAMENJ_PLATFORM_INTEGRATION_ENABLED", "false");

    const res = await request(buildSchoolApp()).get("/api/smart-pages/school/templates?scope=parsed");

    expect(res.status).toBe(200);
    expect(res.body.vertical).toBe("SCHOOL");
    expect(platformClientMocks.checkEntitlement).not.toHaveBeenCalled();
  });

  it("does not expose school templates publicly without authentication", async () => {
    vi.stubEnv("NODE_ENV", "production");

    const res = await request(createServer()).get("/api/smart-pages/school/templates");

    expect(res.status).toBe(401);
    expect(res.body.error).toBe("Authentication required.");
  });
});
