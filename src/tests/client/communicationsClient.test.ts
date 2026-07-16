import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("communicationsClient", () => {
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

  it("surfaces provider disabled messages from send endpoint", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
      ok: false,
      error: true,
      message: "WhatsApp/SMS is not configured yet. Contact platform owner.",
    }), { status: 503, headers: { "Content-Type": "application/json" } })));

    const { sendCommunication } = await import("../../client/communicationsClient");
    await expect(sendCommunication("campaign-1", { channel: "WHATSAPP", confirm: true })).rejects.toThrow(
      "WhatsApp/SMS is not configured yet. Contact platform owner.",
    );
  });

  it("calls the approve endpoint and preserves backend request references on failure", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
      error: true,
      message: "Approval failed",
      requestId: "req-approve-1",
    }), { status: 400, headers: { "Content-Type": "application/json" } })));

    const { approveCommunicationCampaign } = await import("../../client/communicationsClient");
    await expect(approveCommunicationCampaign("campaign-1")).rejects.toThrow("Approval failed (ref: req-approve-1)");
  });
});
