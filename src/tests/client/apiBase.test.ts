import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ── getApiBaseUrl ─────────────────────────────────────────────────────────────

describe("getApiBaseUrl", () => {
  it("uses VITE_API_BASE_URL when set", async () => {
    vi.resetModules();
    vi.stubEnv("VITE_API_BASE_URL", "https://report-production-b00d.up.railway.app");
    const { getApiBaseUrl } = await import("../../client/apiBase");
    expect(getApiBaseUrl()).toBe("https://report-production-b00d.up.railway.app");
  });

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

// ── parseApiError ─────────────────────────────────────────────────────────────

function fakeResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("parseApiError", () => {
  let removeItem: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    removeItem = vi.fn();
    vi.stubGlobal("localStorage", {
      getItem: vi.fn(() => null),
      removeItem,
      setItem: vi.fn(),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("returns body.message, not 'true', for { error: true, message: 'Server failed' }", async () => {
    const { parseApiError } = await import("../../client/apiBase");
    const res = fakeResponse(422, { error: true, message: "Server failed" });
    const msg = await parseApiError(res, "fallback");
    expect(msg).toBe("Server failed");
    expect(msg).not.toBe("true");
  });

  it("returns friendly server-error message for 500 with no message field", async () => {
    const { parseApiError } = await import("../../client/apiBase");
    const res = fakeResponse(500, { error: true, code: "SERVER_ERROR" });
    const msg = await parseApiError(res, "fallback");
    expect(msg.toLowerCase()).toContain("server error");
    expect(msg).not.toBe("true");
  });

  it("returns server body.message for 500 when present", async () => {
    const { parseApiError } = await import("../../client/apiBase");
    const res = fakeResponse(500, { error: true, message: "DB connection lost", requestId: "r1" });
    const msg = await parseApiError(res, "fallback");
    expect(msg).toContain("DB connection lost");
    expect(msg).toContain("r1");
  });

  it("returns server body.error for 503 when message is absent", async () => {
    const { parseApiError } = await import("../../client/apiBase");
    const res = fakeResponse(503, { error: "Support is not configured yet." });
    const msg = await parseApiError(res, "fallback");
    expect(msg).toBe("Support is not configured yet.");
  });

  it("clears session token for 401 and returns expiry message", async () => {
    const { parseApiError } = await import("../../client/apiBase");
    const res = fakeResponse(401, {});
    const msg = await parseApiError(res, "fallback");
    expect(removeItem).toHaveBeenCalledWith("sc_auth_token");
    expect(msg).toContain("Session expired");
  });

  it("returns access-denied message for 403", async () => {
    const { parseApiError } = await import("../../client/apiBase");
    const res = fakeResponse(403, {});
    const msg = await parseApiError(res, "fallback");
    expect(msg).toContain("do not have access");
  });

  it("appends requestId suffix when server echoes it back", async () => {
    const { parseApiError } = await import("../../client/apiBase");
    const res = fakeResponse(500, {
      error: true,
      code: "SERVER_ERROR",
      message: "A server error occurred.",
      requestId: "req-abc-123",
    });
    const msg = await parseApiError(res, "fallback");
    expect(msg).toContain("req-abc-123");
  });

  it("ignores boolean error field and returns fallback for unknown 4xx body", async () => {
    const { parseApiError } = await import("../../client/apiBase");
    const res = fakeResponse(400, { error: true });
    const msg = await parseApiError(res, "Validation error");
    expect(msg).toBe("Validation error");
    expect(msg).not.toBe("true");
  });

  it("joins issues array into a readable string", async () => {
    const { parseApiError } = await import("../../client/apiBase");
    const res = fakeResponse(400, {
      error: true,
      issues: [{ message: "Email is required" }, { message: "Password too short" }],
    });
    const msg = await parseApiError(res, "fallback");
    expect(msg).toContain("Email is required");
    expect(msg).toContain("Password too short");
  });

  it("returns fallback when 4xx response body is not valid JSON", async () => {
    const { parseApiError } = await import("../../client/apiBase");
    const res = new Response("Bad Request", { status: 400 });
    const msg = await parseApiError(res, "Something went wrong");
    expect(msg).toBe("Something went wrong");
  });

  it("returns hardcoded server-error message (not raw text) when 500 body is not JSON", async () => {
    const { parseApiError } = await import("../../client/apiBase");
    const res = new Response("Internal Server Error", { status: 500 });
    const msg = await parseApiError(res, "fallback");
    expect(msg.toLowerCase()).toContain("server error");
    expect(msg).not.toContain("Internal Server Error");
  });
});

