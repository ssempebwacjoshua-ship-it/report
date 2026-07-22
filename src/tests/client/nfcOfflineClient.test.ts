import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("nfcOfflineClient", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_API_BASE_URL", "https://api.example.com");
    vi.stubGlobal("localStorage", {
      getItem: vi.fn(() => "token-1"),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("calls the offline device registration endpoint", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      id: "device-1",
      name: "Main Gate Phone",
      deviceKey: "gate-phone-1",
      mode: "GATE",
      status: "ACTIVE",
      isActive: true,
      lastSeenAt: null,
    }), { status: 200, headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);

    const { registerOfflineDevice } = await import("../../client/nfcOfflineClient");
    await registerOfflineDevice({
      name: "Main Gate Phone",
      deviceKey: "gate-phone-1",
      roleScope: "GATE_SECURITY",
      mode: "GATE",
      locationType: "GATE",
      attendanceMode: "GATE_ATTENDANCE",
      studentScope: "ALL_STUDENTS",
      direction: "ENTRY",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.example.com/api/nfc/offline/devices/register",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer token-1",
          "Content-Type": "application/json",
        }),
      }),
    );
  });
});
