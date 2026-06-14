import type { PrismaClient } from "@prisma/client";
import type { GeminiExtractedMarkRow } from "./geminiOcrService";

/**
 * Gemini marksheet → production review pipeline.
 *
 * This module deliberately does NOT trust Gemini's confidenceScore or needsReview
 * flags to decide safety. Every extracted row is re-validated with deterministic
 * backend rules and matched against the students actually enrolled in the selected
 * class/stream/term. Marks are NEVER persisted here — extraction only produces a
 * review payload for an operator.
 */

export type RowStatus = "READY" | "REVIEW_REQUIRED" | "BLOCKED";

/** A student we expect to find on the marksheet, loaded from the database. */
export interface ExpectedStudent {
  studentId: string; // DB primary key
  admissionNumber: string; // a.k.a. studentId on the sheet
  studentName: string;
}

export interface GeminiImportRow {
  rowNumber: number;
  extractedStudentId: string;
  extractedStudentName: string;
  matchedStudentId: string | null;
  matchedStudentName: string | null;
  mark: string;
  confidenceScore: number;
  status: RowStatus;
  issues: string[];
  raw: GeminiExtractedMarkRow;
}

export interface GeminiImportSummary {
  totalRows: number;
  readyRows: number;
  reviewRows: number;
  blockedRows: number;
  missingMarkRows: number;
  invalidMarkRows: number;
  unmatchedStudentRows: number;
  duplicateStudentRows: number;
}

export interface GeminiImportResult {
  rows: GeminiImportRow[];
  summary: GeminiImportSummary;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function norm(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function normId(value: string): string {
  // Admission numbers compare case-insensitively, ignoring surrounding/inner spaces.
  return value.trim().toLowerCase().replace(/\s+/g, "");
}

const SEVERITY: Record<RowStatus, number> = {
  READY: 0,
  REVIEW_REQUIRED: 1,
  BLOCKED: 2,
};

function escalate(current: RowStatus, next: RowStatus): RowStatus {
  return SEVERITY[next] > SEVERITY[current] ? next : current;
}

/**
 * Classifies a raw mark string. Returns the validation issue (if any) — the
 * single source of truth for mark safety, independent of Gemini's confidence.
 */
export function classifyMark(raw: string): { issue: string | null; kind: "missing" | "invalid" | "valid" } {
  const mark = (raw ?? "").trim();
  if (mark === "") return { issue: "Missing mark", kind: "missing" };
  const num = Number(mark);
  if (Number.isNaN(num)) return { issue: "Invalid mark", kind: "invalid" };
  if (num < 0 || num > 100) return { issue: "Mark outside valid range", kind: "invalid" };
  return { issue: null, kind: "valid" };
}

/**
 * Deterministic validation + DB matching for Gemini-extracted marksheet rows.
 *
 * Pure function (no IO) so it can be unit-tested directly. Matching strategy:
 *   1. Match by studentId / admission number (authoritative).
 *   2. If no ID match, optionally fuzzy-match by name → REVIEW_REQUIRED.
 *   3. If neither, the row is BLOCKED (cannot be safely assigned to a student).
 *
 * Extracted OCR text is always preserved in extractedStudentId / extractedStudentName;
 * DB values are surfaced separately in matchedStudentId / matchedStudentName.
 */
export function validateAndMatchGeminiRows(
  geminiRows: GeminiExtractedMarkRow[],
  expectedStudents: ExpectedStudent[],
): GeminiImportResult {
  const byAdmission = new Map<string, ExpectedStudent>();
  const byName = new Map<string, ExpectedStudent[]>();
  for (const student of expectedStudents) {
    byAdmission.set(normId(student.admissionNumber), student);
    const key = norm(student.studentName);
    const list = byName.get(key) ?? [];
    list.push(student);
    byName.set(key, list);
  }

  // Count occurrences of each non-empty extracted studentId to flag duplicates.
  const idCounts = new Map<string, number>();
  for (const row of geminiRows) {
    const id = normId(row.studentId ?? "");
    if (id) idCounts.set(id, (idCounts.get(id) ?? 0) + 1);
  }

  const rows = geminiRows.map((raw, index): GeminiImportRow => {
    const extractedStudentId = (raw.studentId ?? "").trim();
    const extractedStudentName = (raw.studentName ?? "").trim();
    const mark = (raw.mark ?? "").trim();

    const issues: string[] = [];
    let status: RowStatus = "READY";

    // ── Mark validation (deterministic — overrides Gemini confidence) ──────────
    const markCheck = classifyMark(mark);
    if (markCheck.issue) {
      issues.push(markCheck.issue);
      status = escalate(status, "REVIEW_REQUIRED");
    }

    // ── Identity matching ──────────────────────────────────────────────────────
    let matched: ExpectedStudent | null = null;
    let matchKind: "id" | "name" | "none" = "none";

    if (!extractedStudentId) {
      issues.push("Missing student ID");
      status = escalate(status, "REVIEW_REQUIRED");
    }
    if (!extractedStudentName) {
      issues.push("Missing student name");
      status = escalate(status, "REVIEW_REQUIRED");
    }

    const idMatch = extractedStudentId ? byAdmission.get(normId(extractedStudentId)) : undefined;
    if (idMatch) {
      matched = idMatch;
      matchKind = "id";
    } else if (extractedStudentName) {
      const nameMatches = byName.get(norm(extractedStudentName));
      if (nameMatches && nameMatches.length === 1) {
        matched = nameMatches[0]!;
        matchKind = "name";
        issues.push("Matched by name only — verify student");
        status = escalate(status, "REVIEW_REQUIRED");
      }
    }

    if (matchKind === "none") {
      issues.push("Student not found in selected class/stream");
      status = escalate(status, "BLOCKED");
    }

    // ── Name mismatch (only meaningful when matched by ID) ─────────────────────
    if (matchKind === "id" && matched && extractedStudentName &&
        norm(extractedStudentName) !== norm(matched.studentName)) {
      issues.push("Name mismatch with enrolled student");
      // Not blocked: a valid studentId match is authoritative.
      status = escalate(status, "REVIEW_REQUIRED");
    }

    // ── Duplicate studentId across extracted rows ──────────────────────────────
    const normalizedId = normId(extractedStudentId);
    if (normalizedId && (idCounts.get(normalizedId) ?? 0) > 1) {
      issues.push("Duplicate student ID in scan");
      status = escalate(status, "REVIEW_REQUIRED");
    }

    return {
      rowNumber: index + 1,
      extractedStudentId,
      extractedStudentName,
      matchedStudentId: matched?.studentId ?? null,
      matchedStudentName: matched?.studentName ?? null,
      mark,
      confidenceScore: typeof raw.confidenceScore === "number" ? raw.confidenceScore : 0,
      status,
      issues,
      raw,
    };
  });

  const summary: GeminiImportSummary = {
    totalRows: rows.length,
    readyRows: rows.filter((r) => r.status === "READY").length,
    reviewRows: rows.filter((r) => r.status === "REVIEW_REQUIRED").length,
    blockedRows: rows.filter((r) => r.status === "BLOCKED").length,
    missingMarkRows: rows.filter((r) => r.issues.includes("Missing mark")).length,
    invalidMarkRows: rows.filter(
      (r) => r.issues.includes("Invalid mark") || r.issues.includes("Mark outside valid range"),
    ).length,
    unmatchedStudentRows: rows.filter((r) => r.matchedStudentId === null).length,
    duplicateStudentRows: rows.filter((r) => r.issues.includes("Duplicate student ID in scan")).length,
  };

  return { rows, summary };
}

// ── Database access ───────────────────────────────────────────────────────────

export interface LoadExpectedStudentsParams {
  schoolId: string;
  classId: string;
  streamId?: string;
  termId: string;
}

/**
 * Fetch the students enrolled in the selected class/stream/term for a school.
 * Uses the existing ClassEnrollment model — students are never hardcoded.
 */
export async function loadExpectedStudents(
  prisma: PrismaClient,
  { schoolId, classId, streamId, termId }: LoadExpectedStudentsParams,
): Promise<ExpectedStudent[]> {
  const enrollments = await prisma.classEnrollment.findMany({
    where: {
      isActive: true,
      status: "ACTIVE",
      termId,
      classId,
      ...(streamId ? { streamId } : {}),
      student: { schoolId },
    },
    include: { student: true },
    orderBy: { student: { admissionNumber: "asc" } },
  });

  return enrollments.map((enrollment) => ({
    studentId: enrollment.student.id,
    admissionNumber: enrollment.student.admissionNumber,
    studentName: `${enrollment.student.firstName} ${enrollment.student.lastName}`.trim(),
  }));
}
