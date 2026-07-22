import { GoogleGenAI } from "@google/genai";
import { COMMENT_LIMITS } from "../../../../shared/utils/reportComments";
import type { ReportAssistantContext, StudentReadinessSummary } from "./reportAssistantContextService";

export const MAX_COMMENT_LENGTH = COMMENT_LIMITS.classTeacherComment;

let aiInstance: GoogleGenAI | null = null;

function getGeminiClient(): GoogleGenAI {
  if (!process.env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY not set");
  if (!aiInstance) aiInstance = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  return aiInstance;
}

export type CommentDraftStatus = "DRAFT" | "UNAVAILABLE" | "CONTEXT_INCOMPLETE";

export type CommentDraftResult = {
  status: CommentDraftStatus;
  studentId: string;
  comment: string | null;
  reason?: string;
};

function buildCommentPrompt(
  studentName: string,
  className: string,
  termName: string,
  subjectCount: number,
): string {
  return `You are helping a Ugandan school teacher write a brief end-of-term report comment.

Student: ${studentName}
Class: ${className}
Term: ${termName}
Subjects assessed: ${subjectCount}

Write a single sincere, encouraging comment (1–2 sentences, under 500 characters) for this student's report card.
Rules:
- Do NOT invent marks, grades, positions, attendance figures, or subject names.
- Do NOT make specific claims about individual subjects without evidence.
- Write in positive, constructive language appropriate for a school report card.
- Respond with ONLY the comment text ? no preamble, no labels, no quotation marks.`;
}

export async function callGeminiForComment(prompt: string): Promise<string> {
  const model = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";
  const response = await getGeminiClient().models.generateContent({
    model,
    contents: [{ text: prompt }],
    config: { temperature: 0.4, maxOutputTokens: 200 },
  });
  return (response.text ?? "").trim();
}

export async function generateStudentCommentDraft(
  student: Pick<StudentReadinessSummary, "studentId" | "name" | "hasAllFinalized" | "missingSubjectNames">,
  context: Pick<ReportAssistantContext, "className" | "term" | "totalSubjects">,
  geminiCall: (prompt: string) => Promise<string> = callGeminiForComment,
): Promise<CommentDraftResult> {
  if (!student.hasAllFinalized) {
    const missing = student.missingSubjectNames.join(", ") || "one or more subjects";
    return {
      status: "CONTEXT_INCOMPLETE",
      studentId: student.studentId,
      comment: null,
      reason: `Cannot generate a comment for ${student.name}: missing or unfinalized marks for ${missing}.`,
    };
  }

  if (!process.env.GEMINI_API_KEY) {
    return {
      status: "UNAVAILABLE",
      studentId: student.studentId,
      comment: null,
      reason: "AI comment generation is not configured on this server.",
    };
  }

  const prompt = buildCommentPrompt(student.name, context.className, context.term, context.totalSubjects);

  try {
    const raw = await geminiCall(prompt);
    if (!raw) {
      return {
        status: "UNAVAILABLE",
        studentId: student.studentId,
        comment: null,
        reason: "AI returned an empty response. Please write the comment manually.",
      };
    }
    const comment = raw.length > MAX_COMMENT_LENGTH ? raw.slice(0, MAX_COMMENT_LENGTH - 3) + "..." : raw;
    return { status: "DRAFT", studentId: student.studentId, comment };
  } catch (err) {
    console.error("[report-comment] Gemini error:", err instanceof Error ? err.message : String(err));
    return {
      status: "UNAVAILABLE",
      studentId: student.studentId,
      comment: null,
      reason: "AI comment generation is temporarily unavailable. Please write the comment manually.",
    };
  }
}

