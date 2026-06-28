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
    vi.useRealTimers();
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
    const request = generateContent.mock.calls[0]?.[0] as {
      contents?: Array<{ inlineData?: unknown; text?: string }>;
      config?: { responseMimeType?: string; mediaResolution?: string };
    };
    expect(request.contents?.filter((part) => Boolean(part.inlineData)).length).toBe(4);
    expect(request.contents?.some((part) => typeof part.text === "string" && part.text.includes("High accuracy mode"))).toBe(true);
    expect(request.config?.responseMimeType).toBe("application/json");
    expect(request.config?.mediaResolution).toBe("MEDIA_RESOLUTION_HIGH");
  });

  it("uses gemini-3.5-flash as the default fast model when GEMINI_MODEL is blank", async () => {
    vi.stubEnv("GEMINI_MODEL", "");
    const { resolveGeminiDocumentModel, resolveGeminiHighAccuracyDocumentModel } = await import("../../server/services/documentGeminiService");
    expect(resolveGeminiDocumentModel()).toBe("gemini-3.5-flash");
    expect(resolveGeminiHighAccuracyDocumentModel().stable).toBe("gemini-2.5-flash");
  });

  it("retries 503s, falls back to stable model, and returns success metadata", async () => {
    vi.useFakeTimers();
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    vi.stubEnv("SMART_PAGES_GEMINI_FAST_MODEL", "gemini-3.5-flash");
    vi.stubEnv("SMART_PAGES_GEMINI_STABLE_ACCURACY_MODEL", "gemini-2.5-flash");
    const overloaded = new Error("503 UNAVAILABLE: model overloaded");
    generateContent
      .mockRejectedValueOnce(overloaded)
      .mockRejectedValueOnce(overloaded)
      .mockRejectedValueOnce(overloaded)
      .mockRejectedValueOnce(overloaded)
      .mockRejectedValueOnce(overloaded)
      .mockResolvedValueOnce({
        text: JSON.stringify({
          documentType: "report",
          domain: "education",
          title: "Fallback Report",
          suggestedDocumentType: "report",
          confidence: 0.84,
          handwritingDifficulty: "low",
          needsReview: false,
          recommendedNextStep: "accept",
          sections: [{ heading: "Body", content: "Recovered" }],
          tables: [],
          statistics: [],
          entities: [],
          people: [],
          dates: [],
          handwrittenNotes: [],
          keyFacts: [],
          unclearItems: [],
          unclearTableCells: [],
          rawText: "Recovered",
        }),
      });

    const { extractDocumentKnowledge } = await import("../../server/services/documentGeminiService");
    const pending = extractDocumentKnowledge(Buffer.from("fake"), "image/jpeg", "report.jpg");
    await vi.runAllTimersAsync();
    const result = await pending;

    expect(result.title).toBe("Fallback Report");
    expect(result._meta.requestedModel).toBe("gemini-3.5-flash");
    expect(result._meta.selectedModel).toBe("gemini-2.5-flash");
    expect(result._meta.attemptedModels).toEqual(["gemini-3.5-flash", "gemini-2.5-flash"]);
    expect(result._meta.retryCount).toBe(4);
    expect(result._meta.fallbackUsed).toBe(true);
    expect(result._meta.fallbackReason).toBe("Model overloaded");
    expect(result._meta.providerErrorCode).toBe("MODEL_OVERLOADED");
    expect(result._meta.mediaResolution).toBe("MEDIA_RESOLUTION_MEDIUM");
    expect(result._meta.retryDelaysMs).toEqual([500, 1500]);
    expect(generateContent).toHaveBeenCalledTimes(6);
    expect(generateContent.mock.calls[0]?.[0]).toEqual(expect.objectContaining({ model: "gemini-3.5-flash" }));
    expect(generateContent.mock.calls[5]?.[0]).toEqual(expect.objectContaining({ model: "gemini-2.5-flash" }));
    vi.useRealTimers();
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
      config?: { responseMimeType?: string; mediaResolution?: string };
    };
    expect(request.config?.responseMimeType).toBe("application/json");
    expect(request.config?.mediaResolution).toBe("MEDIA_RESOLUTION_MEDIUM");
    expect(request.contents?.[0]?.inlineData?.data).toBe(Buffer.from("processed").toString("base64"));
    expect(request.contents?.[0]?.inlineData?.mimeType).toBe("image/jpeg");
  });

  it("reports the Smart Pages probe using gemini-2.5-flash", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    vi.stubEnv("GEMINI_MODEL", "gemini-2.5-flash");
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

    expect(result.model).toBe("gemini-2.5-flash");
    expect(result.success).toBe(true);
    expect(generateContent).toHaveBeenCalledWith(
      expect.objectContaining({ model: "gemini-2.5-flash" }),
    );
  });
});

