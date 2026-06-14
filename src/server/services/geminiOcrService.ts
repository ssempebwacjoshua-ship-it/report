import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

export interface GeminiExtractedMarkRow {
  studentId: string;
  studentName: string;
  mark: string;
  confidenceScore: number;
  needsReview: boolean;
  reason?: string;
}

export async function extractMarksWithGemini(
  imageBuffer: Buffer,
  mimeType = "image/jpeg"
): Promise<GeminiExtractedMarkRow[]> {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("Missing GEMINI_API_KEY");
  }

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: [
      {
        inlineData: {
          data: imageBuffer.toString("base64"),
          mimeType,
        },
      },
      {
        text: `
You are reading a school handwritten marksheet.

Extract each student row.

Rules:
- Read student ID exactly.
- Read student name exactly.
- Read mark only from the mark/final mark column.
- Do not guess.
- If unclear, set needsReview true.
- Return JSON only.
        `,
      },
    ],
    config: {
      temperature: 0,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          rows: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                studentId: { type: Type.STRING },
                studentName: { type: Type.STRING },
                mark: { type: Type.STRING },
                confidenceScore: { type: Type.NUMBER },
                needsReview: { type: Type.BOOLEAN },
                reason: { type: Type.STRING },
              },
              required: [
                "studentId",
                "studentName",
                "mark",
                "confidenceScore",
                "needsReview",
              ],
            },
          },
        },
        required: ["rows"],
      },
    },
  });

  const text = response.text;
  if (!text) throw new Error("Gemini returned empty response");

  const parsed = JSON.parse(text);
  return parsed.rows ?? [];
}