import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export interface PerfectRosterRow {
  no: string;
  teacherName: string;
  matchedTeacherName?: string;
  subject?: string;
  level: string;
  confidenceScore: number;
  needsReview: boolean;
  reason?: string;
}

export async function parseRosterImagePerfect(
  imageBuffer: Buffer,
  knownTeachers: string[],
  mimeType = "image/jpeg",
): Promise<PerfectRosterRow[]> {
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
You are an expert school registry data extraction assistant.

The uploaded image is a handwritten or scanned teacher roster/list.

Extract each visible row.

COLUMNS TO EXTRACT:
- no: row number / serial number
- teacherName: teacher name as written
- subject: subject taught, only if visible. If no subject column exists, return an empty string.
- level: education level examples: A' Level, O' Level, A & O Level
- confidenceScore: number from 0 to 1
- needsReview: true if name, subject, or level is unclear
- reason: short explanation when needsReview is true

STRICT NAME MATCHING RULES:
- Compare handwritten teacher names against this valid database list:
${JSON.stringify(knownTeachers)}
- If a handwritten name clearly matches one valid database name, put that exact database name in matchedTeacherName.
- Keep teacherName as the raw extracted text.
- Do not invent names.
- Do not silently replace unclear names.
- If the match is uncertain, keep matchedTeacherName empty and set needsReview true.

IMPORTANT:
- A' Level and O' Level are education levels, not marks or scores.
- This is a teacher roster, not a student marksheet.
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
                no: { type: Type.STRING },
                teacherName: { type: Type.STRING },
                matchedTeacherName: { type: Type.STRING },
                subject: {
                  type: Type.STRING,
                  description:
                    "Examples: Physics, ENT, C.R.E, Literature, General Paper, GEOG, History, Luganda. Empty string if not visible.",
                },
                level: {
                  type: Type.STRING,
                  description: "Examples: A' Level, O' Level, A & O Level",
                },
                confidenceScore: { type: Type.NUMBER },
                needsReview: { type: Type.BOOLEAN },
                reason: { type: Type.STRING },
              },
              required: ["no", "teacherName", "subject", "level", "confidenceScore", "needsReview"],
            },
          },
        },
        required: ["rows"],
      },
    },
  });

  const text = response.text;
  if (!text) throw new Error("Gemini returned empty response");

  let parsed: { rows?: PerfectRosterRow[] };
  try {
    parsed = JSON.parse(text) as typeof parsed;
  } catch {
    throw new Error("Gemini returned invalid JSON");
  }

  if (!Array.isArray(parsed.rows)) {
    throw new Error("Gemini response missing rows array");
  }

  return parsed.rows;
}

