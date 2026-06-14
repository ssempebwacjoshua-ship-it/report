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

export interface MarksheetValidationSummary {
  totalRows: number;
  validRows: number;
  reviewRows: number;
  missingMarkRows: number;
  invalidMarkRows: number;
}

/**
 * Deterministic validation pass applied after Gemini returns rows.
 * Gemini's confidenceScore and needsReview are NOT trusted for mark validity —
 * we check the mark field ourselves and override when necessary.
 *
 * Rules:
 *  - trimmed empty   → needsReview true, reason "Missing mark",        confidenceScore 0
 *  - non-numeric     → needsReview true, reason "Invalid mark",         confidenceScore 0
 *  - < 0 or > 100   → needsReview true, reason "Mark outside valid range", confidenceScore 0
 *  - valid mark      → preserve Gemini's needsReview and reason as-is
 *
 * Exported for direct unit testing.
 */
export function validateMarksheetRows(rows: GeminiExtractedMarkRow[]): {
  rows: GeminiExtractedMarkRow[];
  summary: MarksheetValidationSummary;
} {
  let missingMarkRows = 0;
  let invalidMarkRows = 0;

  const validated = rows.map((row): GeminiExtractedMarkRow => {
    const mark = row.mark.trim();

    if (mark === "") {
      missingMarkRows++;
      return { ...row, mark, needsReview: true, reason: "Missing mark", confidenceScore: 0 };
    }

    const num = Number(mark);
    if (isNaN(num)) {
      invalidMarkRows++;
      return { ...row, mark, needsReview: true, reason: "Invalid mark", confidenceScore: 0 };
    }

    if (num < 0 || num > 100) {
      invalidMarkRows++;
      return {
        ...row, mark, needsReview: true, reason: "Mark outside valid range", confidenceScore: 0,
      };
    }

    // Mark is valid — preserve Gemini's judgment (including any existing needsReview: true)
    return { ...row, mark };
  });

  const reviewRows = validated.filter((r) => r.needsReview).length;

  return {
    rows: validated,
    summary: {
      totalRows: validated.length,
      validRows: validated.length - reviewRows,
      reviewRows,
      missingMarkRows,
      invalidMarkRows,
    },
  };
}

export async function extractMarksWithGemini(
  imageBuffer: Buffer,
  mimeType = "image/jpeg",
): Promise<{ rows: GeminiExtractedMarkRow[]; summary: MarksheetValidationSummary }> {
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
  - mark: numeric score from the marks/score column ONLY — use empty string if the cell is blank
  - confidenceScore: 0 to 1
  - needsReview: true if name, ID, or mark is unclear or missing
  - reason: short explanation when needsReview is true

IMPORTANT: "A' Level" and "O' Level" are education levels, not marks. Do not put them in mark.
If a mark cell is blank or unreadable, set mark to "" and needsReview to true.
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

  return validateMarksheetRows(parsed.rows);
}
