import { describe, expect, it, vi } from "vitest";

describe("getApiBaseUrl", () => {
  it("rejects postgres URLs", async () => {
    vi.resetModules();
    vi.stubEnv("VITE_API_BASE_URL", "postgresql://example.com/db");
    const { getApiBaseUrl } = await import("../../client/apiBase");
    expect(() => getApiBaseUrl()).toThrow(
      "VITE_API_BASE_URL must be the backend API URL, not DATABASE_URL.",
    );
  });

  it("rejects relative URLs", async () => {
    vi.resetModules();
    vi.stubEnv("VITE_API_BASE_URL", "report-production-b00d.up.railway.app");
    const { getApiBaseUrl } = await import("../../client/apiBase");
    expect(() => getApiBaseUrl()).toThrow("Invalid VITE_API_BASE_URL: must be absolute HTTPS URL");
  });
});
