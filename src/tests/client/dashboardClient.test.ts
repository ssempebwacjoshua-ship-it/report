import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("dashboardClient", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_API_BASE_URL", "https://api.example.com");
    vi.stubGlobal("localStorage", {
      getItem: vi.fn(() => "token-1"),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    });
    vi.stubGlobal("crypto", { randomUUID: vi.fn(() => "req-1") });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("requests the lightweight attendance summary endpoint with auth headers", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ date: "2026-07-12" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const { fetchDashboardAttendanceSummary } = await import("../../client/dashboardClient");
    await fetchDashboardAttendanceSummary();

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.example.com/api/dashboard/attendance-summary",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer token-1",
          "x-request-id": "req-1",
        }),
      }),
    );
  });

  it("passes abort signals through to attendance summary fetches", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ date: "2026-07-12" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const controller = new AbortController();

    const { fetchDashboardAttendanceSummary } = await import("../../client/dashboardClient");
    await fetchDashboardAttendanceSummary(controller.signal);

    expect(fetchMock.mock.calls[0]?.[1]).toEqual(
      expect.objectContaining({ signal: controller.signal }),
    );
  });
});
