import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

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
  mimeType = "image/jpeg",
): Promise<GeminiExtractedMarkRow[]> {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("Missing GEMINI_API_KEY");
  }

  const response = await ai.models.generateContent({
    model: process.env.GEMINI_MODEL ?? "gemini-2.5-flash",
    contents: [
      {
        inlineData: {
          data: imageBuffer.toString("base64"),
          mimeType,
        },
      },
      {
        text: `
You are reading a school document image.

First, determine if this is a student marksheet: a table containing student IDs (admission numbers),
student names, and numeric scores or marks.

- If this document is a teacher roster, timetable, attendance sheet, or anything other than a
  student marksheet, return documentType "not_marksheet" and an empty rows array.

- If it IS a student marksheet, return documentType "marksheet" and extract each row:
  - studentId: student admission number or ID exactly as written
  - studentName: full name exactly as written
  - mark: numeric score from the marks/score column ONLY
  - confidenceScore: 0 to 1
  - needsReview: true if any field is unclear
  - reason: short explanation when needsReview is true

IMPORTANT: "A' Level" and "O' Level" are education levels, not marks. Do not put them in mark.
        `,
      },
    ],
    config: {
      temperature: 0,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          documentType: {
            type: Type.STRING,
            description: "Either 'marksheet' or 'not_marksheet'",
          },
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
              required: ["studentId", "studentName", "mark", "confidenceScore", "needsReview"],
            },
          },
        },
        required: ["documentType", "rows"],
      },
    },
  });

  const text = response.text;
  if (!text) throw new Error("Gemini returned empty response");

  let parsed: { documentType?: string; rows?: GeminiExtractedMarkRow[] };
  try {
    parsed = JSON.parse(text) as typeof parsed;
  } catch {
    throw new Error("Gemini returned invalid JSON");
  }

  if (parsed.documentType !== "marksheet") {
    throw new Error("Uploaded document does not look like a marksheet.");
  }

  if (!Array.isArray(parsed.rows)) {
    throw new Error("Gemini response missing rows array");
  }

  return parsed.rows;
}
