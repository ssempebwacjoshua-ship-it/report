import { describe, expect, it, vi } from "vitest";

describe("publicUrl helpers", () => {
  it("prefers APP_BASE_URL and trims trailing slash", async () => {
    vi.resetModules();
    vi.stubEnv("APP_BASE_URL", "https://example.com/");
    const { getPublicAppUrl } = await import("../../server/config/publicUrl");
    expect(getPublicAppUrl()).toBe("https://example.com");
  });

  it("builds parent short links from the site origin", async () => {
    vi.resetModules();
    vi.stubEnv("APP_BASE_URL", "https://schools.ssamenj.online/report-lab");
    const { buildParentReportPublicUrl } = await import("../../server/config/publicUrl");
    expect(buildParentReportPublicUrl("abc123")).toBe("https://schools.ssamenj.online/r/abc123");
  });
});
