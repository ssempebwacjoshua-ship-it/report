import { afterEach, describe, expect, it, vi } from "vitest";

// The Gemini scan client function must call the real production route and must
// never send x-internal-test-key ? that header belongs only on pilot test
// routes called by developers, not by the frontend UI.

describe("extractMarksWithGeminiScan ? security contract", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it("calls /api/marks-import/scan/extract, not /api/test-gemini-marks", async () => {
    vi.stubEnv("VITE_API_BASE_URL", "https://api.example.com");
    vi.resetModules();

    const mockFetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ success: true, jobId: "j1", count: 0, rows: [], summary: {} }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", mockFetch);

    const { extractMarksWithGeminiScan } = await import("../../client/importsClient");
    const image = new File(["bytes"], "marks.jpg", { type: "image/jpeg" });
    await extractMarksWithGeminiScan(image, {
      classId: "c1",
      streamId: "",
      subjectId: "s1",
      termId: "t1",
      examType: "BOT",
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/api/marks-import/scan/extract");
    expect(url).not.toContain("/api/test-gemini-marks");
  });

  it("does not include x-internal-test-key header in the request", async () => {
    vi.stubEnv("VITE_API_BASE_URL", "https://api.example.com");
    vi.resetModules();

    const mockFetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ success: true, jobId: "j1", count: 0, rows: [], summary: {} }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", mockFetch);

    const { extractMarksWithGeminiScan } = await import("../../client/importsClient");
    const image = new File(["bytes"], "marks.jpg", { type: "image/jpeg" });
    await extractMarksWithGeminiScan(image, {
      classId: "c1",
      streamId: "",
      subjectId: "s1",
      termId: "t1",
      examType: "BOT",
    });

    const [, options] = mockFetch.mock.calls[0] as [string, RequestInit];
    const headers = options?.headers as Record<string, string> | undefined;
    expect(headers?.["x-internal-test-key"]).toBeUndefined();
  });

  it("includes Authorization header when a token is in localStorage", async () => {
    vi.stubEnv("VITE_API_BASE_URL", "https://api.example.com");
    vi.resetModules();

    const mockFetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ success: true, jobId: "j1", count: 0, rows: [], summary: {} }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", mockFetch);
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => (key === "sc_auth_token" ? "tok-abc123" : null),
    });

    const { extractMarksWithGeminiScan } = await import("../../client/importsClient");
    const image = new File(["bytes"], "marks.jpg", { type: "image/jpeg" });
    await extractMarksWithGeminiScan(image, {
      classId: "c1",
      streamId: "",
      subjectId: "s1",
      termId: "t1",
      examType: "BOT",
    });

    const [, options] = mockFetch.mock.calls[0] as [string, RequestInit];
    const headers = options?.headers as Record<string, string> | undefined;
    expect(headers?.["Authorization"]).toBe("Bearer tok-abc123");
  });
});

