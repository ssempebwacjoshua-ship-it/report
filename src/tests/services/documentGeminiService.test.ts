import { afterEach, describe, expect, it, vi } from "vitest";

const generateContent = vi.fn();

vi.mock("@google/genai", () => {
  class GoogleGenAI {
    models = {
      generateContent,
    };
    constructor(_opts: unknown) {}
  }
  return { GoogleGenAI };
});

describe("documentGeminiService", () => {
  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  it("normalizes extraction quality metadata from Gemini output", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    generateContent.mockResolvedValueOnce({
      text: JSON.stringify({
        documentType: "report",
        domain: "education",
        title: "Handwritten Report",
        suggestedDocumentType: "report",
        confidence: 0.41,
        handwritingDifficulty: "high",
        needsReview: true,
        recommendedNextStep: "high_accuracy_retry",
        sections: [{ heading: "Body", content: "Hello" }],
        tables: [],
        statistics: [],
        entities: [],
        people: [],
        dates: [],
        handwrittenNotes: [],
        keyFacts: [],
        unclearItems: [{ label: "Name", value: "", reason: "Hard to read", unclear: true }],
        unclearTableCells: [{ row: 1, column: "A", value: "[unclear]", reason: "Hard to read" }],
        rawText: "Hello",
      }),
    });

    const { extractDocumentKnowledge } = await import("../../server/services/documentGeminiService");
    const result = await extractDocumentKnowledge(Buffer.from("fake"), "image/jpeg", "report.jpg");

    expect(result.confidence).toBe(0.41);
    expect(result.handwritingDifficulty).toBe("high");
    expect(result.needsReview).toBe(true);
    expect(result.recommendedNextStep).toBe("high_accuracy_retry");
    expect(result.unclearTableCells).toHaveLength(1);
  });

  it("high accuracy mode sends the enhanced compare payload", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    generateContent.mockResolvedValueOnce({
      text: JSON.stringify({
        documentType: "report",
        domain: "education",
        title: "Enhanced Report",
        suggestedDocumentType: "report",
        confidence: 0.9,
        handwritingDifficulty: "low",
        needsReview: false,
        recommendedNextStep: "accept",
        sections: [{ heading: "Body", content: "Hello" }],
        tables: [],
        statistics: [],
        entities: [],
        people: [],
        dates: [],
        handwrittenNotes: [],
        keyFacts: [],
        unclearItems: [],
        unclearTableCells: [],
        rawText: "Hello",
      }),
    });

    const { extractDocumentKnowledge } = await import("../../server/services/documentGeminiService");
    await extractDocumentKnowledge(
      Buffer.from("original"),
      "image/jpeg",
      "report.jpg",
      {
        highAccuracy: true,
        processedBuffer: Buffer.from("processed"),
        processedMimeType: "image/jpeg",
        sectionBuffers: [
          { label: "top", buffer: Buffer.from("section-1"), mimeType: "image/jpeg" },
          { label: "middle", buffer: Buffer.from("section-2"), mimeType: "image/jpeg" },
        ],
      },
    );

    expect(generateContent).toHaveBeenCalledTimes(1);
    const request = generateContent.mock.calls[0]?.[0] as { contents?: Array<{ inlineData?: unknown; text?: string }> };
    expect(request.contents?.filter((part) => Boolean(part.inlineData)).length).toBe(4);
    expect(request.contents?.some((part) => typeof part.text === "string" && part.text.includes("High accuracy mode"))).toBe(true);
    expect(request.config?.responseMimeType).toBe("application/json");
  });

  it("falls back to gemini-3.5-flash when GEMINI_MODEL is blank", async () => {
    vi.stubEnv("GEMINI_MODEL", "");
    const { resolveGeminiDocumentModel } = await import("../../server/services/documentGeminiService");
    expect(resolveGeminiDocumentModel()).toBe("gemini-3.5-flash");
  });

  it("uses the processed buffer in fast extraction when one is supplied", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    generateContent.mockResolvedValueOnce({
      text: JSON.stringify({
        documentType: "report",
        domain: "education",
        title: "Fast Report",
        suggestedDocumentType: "report",
        confidence: 0.8,
        handwritingDifficulty: "low",
        needsReview: false,
        recommendedNextStep: "accept",
        sections: [],
        tables: [],
        statistics: [],
        entities: [],
        people: [],
        dates: [],
        handwrittenNotes: [],
        keyFacts: [],
        unclearItems: [],
        unclearTableCells: [],
        rawText: "ok",
      }),
    });

    const { extractDocumentKnowledge } = await import("../../server/services/documentGeminiService");
    await extractDocumentKnowledge(Buffer.from("original"), "image/png", "report.png", {
      processedBuffer: Buffer.from("processed"),
      processedMimeType: "image/jpeg",
    });

    const request = generateContent.mock.calls[0]?.[0] as {
      contents?: Array<{ inlineData?: { data: string; mimeType: string }; text?: string }>;
      config?: { responseMimeType?: string };
    };
    expect(request.config?.responseMimeType).toBe("application/json");
    expect(request.contents?.[0]?.inlineData?.data).toBe(Buffer.from("processed").toString("base64"));
    expect(request.contents?.[0]?.inlineData?.mimeType).toBe("image/jpeg");
  });

  it("reports the Smart Pages probe using gemini-3.5-flash", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    vi.stubEnv("GEMINI_MODEL", "gemini-3.5-flash");
    generateContent.mockResolvedValueOnce({
      text: JSON.stringify({
        documentType: "report",
        domain: "education",
        title: "Probe Report",
        suggestedDocumentType: "report",
        confidence: 0.91,
        handwritingDifficulty: "low",
        needsReview: false,
        recommendedNextStep: "accept",
        sections: [],
        tables: [],
        statistics: [],
        entities: [],
        people: [],
        dates: [],
        handwrittenNotes: [],
        keyFacts: [],
        unclearItems: [],
        unclearTableCells: [],
        rawText: "probe",
      }),
    });

    const { probeSmartPagesGeminiExtraction } = await import("../../server/services/documentGeminiService");
    const result = await probeSmartPagesGeminiExtraction();

    expect(result.model).toBe("gemini-3.5-flash");
    expect(result.success).toBe(true);
    expect(generateContent).toHaveBeenCalledWith(
      expect.objectContaining({ model: "gemini-3.5-flash" }),
    );
  });
});
