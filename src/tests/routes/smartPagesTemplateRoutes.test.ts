import request from "supertest";
import { describe, expect, it } from "vitest";
import { createServer } from "../../server";

describe("smartPagesTemplateRoutes", () => {
  it("returns only school templates from the school Smart Pages API", async () => {
    const res = await request(createServer()).get("/api/smart-pages/school/templates?scope=parsed");

    expect(res.status).toBe(200);
    expect(res.body.vertical).toBe("SCHOOL");
    expect(res.body.templates.length).toBeGreaterThan(0);
    expect(res.body.templates.every((template: { vertical: string }) => template.vertical === "SCHOOL")).toBe(true);
    expect(JSON.stringify(res.body.templates).toLowerCase()).not.toMatch(/lawyer|legal|court|affidavit|contract|client intake|case brief/);
  });

  it("rejects lawyer template IDs on the school Smart Pages API", async () => {
    const res = await request(createServer()).get("/api/smart-pages/school/templates/legal-notice-demand-letter");

    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/not available for school connect smart pages/i);
  });

  it("does not expose lawyer templates unless the lawyer vertical is enabled", async () => {
    const original = process.env.ENABLE_SMART_PAGES_LAWYERS;
    process.env.ENABLE_SMART_PAGES_LAWYERS = "false";
    const res = await request(createServer()).get("/api/smart-pages/lawyer/templates?scope=parsed");
    if (original === undefined) {
      delete process.env.ENABLE_SMART_PAGES_LAWYERS;
    } else {
      process.env.ENABLE_SMART_PAGES_LAWYERS = original;
    }

    expect(res.status).toBe(404);
  });
});
