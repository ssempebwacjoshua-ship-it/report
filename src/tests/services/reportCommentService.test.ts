import { describe, expect, it, afterEach } from "vitest";
import { generateStudentCommentDraft, MAX_COMMENT_LENGTH } from "../../server/services/reportCommentService";

// ── Test fixtures ─────────────────────────────────────────────────────────────

const context = {
  className: "Senior 1",
  term: "Term 1",
  totalSubjects: 8,
};

function makeStudent(overrides: Partial<{
  studentId: string;
  name: string;
  hasAllFinalized: boolean;
  missingSubjectNames: string[];
}> = {}) {
  return {
    studentId: "stu-h3-1",
    name: "Ann Bee",
    hasAllFinalized: true,
    missingSubjectNames: [],
    ...overrides,
  };
}

const savedKey = process.env.GEMINI_API_KEY;

afterEach(() => {
  process.env.GEMINI_API_KEY = savedKey;
});

// ── CONTEXT_INCOMPLETE ────────────────────────────────────────────────────────

describe("reportCommentService ? CONTEXT_INCOMPLETE", () => {
  it("returns CONTEXT_INCOMPLETE when student has missing marks (no Gemini call)", async () => {
    delete process.env.GEMINI_API_KEY; // ensure no accidental Gemini calls
    const result = await generateStudentCommentDraft(
      makeStudent({ hasAllFinalized: false, missingSubjectNames: ["Mathematics", "English"] }),
      context,
    );
    expect(result.status).toBe("CONTEXT_INCOMPLETE");
    expect(result.comment).toBeNull();
    expect(result.reason).toContain("Ann Bee");
    expect(result.reason).toContain("Mathematics");
  });
});

// ── UNAVAILABLE ───────────────────────────────────────────────────────────────

describe("reportCommentService ? UNAVAILABLE fallback", () => {
  it("returns UNAVAILABLE when GEMINI_API_KEY is not set", async () => {
    delete process.env.GEMINI_API_KEY;
    const result = await generateStudentCommentDraft(makeStudent(), context);
    expect(result.status).toBe("UNAVAILABLE");
    expect(result.comment).toBeNull();
    expect(result.reason).toMatch(/not configured/i);
  });

  it("returns UNAVAILABLE when Gemini throws (network error)", async () => {
    process.env.GEMINI_API_KEY = "fake-key-for-test";
    const throwingGemini = async (_prompt: string): Promise<string> => {
      throw new Error("fetch failed");
    };

    const result = await generateStudentCommentDraft(makeStudent(), context, throwingGemini);
    expect(result.status).toBe("UNAVAILABLE");
    expect(result.comment).toBeNull();
    expect(result.reason).toMatch(/unavailable/i);
  });

  it("returns UNAVAILABLE when Gemini returns empty string", async () => {
    process.env.GEMINI_API_KEY = "fake-key-for-test";
    const emptyGemini = async (_prompt: string): Promise<string> => "";

    const result = await generateStudentCommentDraft(makeStudent(), context, emptyGemini);
    expect(result.status).toBe("UNAVAILABLE");
    expect(result.comment).toBeNull();
  });
});

// ── DRAFT ? comment length enforcement ───────────────────────────────────────

describe("reportCommentService ? DRAFT and max length", () => {
  it("returns DRAFT status with the comment when Gemini succeeds", async () => {
    process.env.GEMINI_API_KEY = "fake-key-for-test";
    const mockGemini = async (_prompt: string) =>
      "Ann is a dedicated learner who consistently demonstrates effort and enthusiasm in her studies.";

    const result = await generateStudentCommentDraft(makeStudent(), context, mockGemini);
    expect(result.status).toBe("DRAFT");
    expect(result.comment).toBeTruthy();
    expect(result.studentId).toBe("stu-h3-1");
  });

  it("truncates comments longer than MAX_COMMENT_LENGTH to exactly MAX_COMMENT_LENGTH characters", async () => {
    process.env.GEMINI_API_KEY = "fake-key-for-test";
    const longComment = "A".repeat(MAX_COMMENT_LENGTH + 50);
    const mockGemini = async (_prompt: string) => longComment;

    const result = await generateStudentCommentDraft(makeStudent(), context, mockGemini);
    expect(result.status).toBe("DRAFT");
    expect(result.comment!.length).toBe(MAX_COMMENT_LENGTH);
    expect(result.comment!.endsWith("...")).toBe(true);
  });

  it("returns comment unchanged when it is at or under MAX_COMMENT_LENGTH", async () => {
    process.env.GEMINI_API_KEY = "fake-key-for-test";
    const exactComment = "A".repeat(MAX_COMMENT_LENGTH);
    const mockGemini = async (_prompt: string) => exactComment;

    const result = await generateStudentCommentDraft(makeStudent(), context, mockGemini);
    expect(result.status).toBe("DRAFT");
    expect(result.comment).toBe(exactComment);
    expect(result.comment!.length).toBe(MAX_COMMENT_LENGTH);
  });

  it("includes only student name, class, term, subject count in prompt (no invented facts)", async () => {
    process.env.GEMINI_API_KEY = "fake-key-for-test";
    let capturedPrompt = "";
    const capturingGemini = async (prompt: string) => {
      capturedPrompt = prompt;
      return "Good student.";
    };

    await generateStudentCommentDraft(
      makeStudent({ name: "Bob Cee" }),
      { className: "P3", term: "Term 2", totalSubjects: 5 },
      capturingGemini,
    );

    // Prompt must contain only what we passed ? no fabricated data
    expect(capturedPrompt).toContain("Bob Cee");
    expect(capturedPrompt).toContain("P3");
    expect(capturedPrompt).toContain("Term 2");
    expect(capturedPrompt).toContain("5");
    // Must NOT invent marks or grades
    expect(capturedPrompt).not.toMatch(/\b\d{2,3}%|\b\d{2,3} marks?\b/i);
  });
});

