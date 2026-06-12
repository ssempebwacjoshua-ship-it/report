import { describe, expect, it, vi } from "vitest";

describe("getPublicAppUrl", () => {
  it("prefers APP_BASE_URL and trims trailing slash", async () => {
    vi.resetModules();
    vi.stubEnv("APP_BASE_URL", "https://example.com/");
    const { getPublicAppUrl } = await import("../../server/config/publicUrl");
    expect(getPublicAppUrl()).toBe("https://example.com");
  });
});
