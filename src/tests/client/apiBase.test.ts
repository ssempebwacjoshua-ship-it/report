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
});
