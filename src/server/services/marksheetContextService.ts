/**
 * Marksheet context detection service.
 *
 * Resolves the full marksheet context (class, stream, subject, term, exam type,
 * academic year) from:
 *   1. A committed MarkImportBatch whose computed ID matches the query   (BATCH_LOOKUP)
 *   2. Decoding the ID against live school data (classes/subjects/terms) (ID_PARSED)
 *
 * The marksheet ID format is defined in PrintableMarksheet.tsx:
 *   MS-{YEAR}-{cls4}-{STREAM}-{subj4}-{EXAMTYPE}-{trm2}
 *
 *   cls4   = className.replace(/\s+/g, "").toUpperCase().slice(0, 4)
 *   subj4  = subjectName.replace(/[^A-Za-z]/g, "").toUpperCase().slice(0, 4)
 *   trm2   = termName.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 2)
 */

import type { PrismaClient } from "@prisma/client";
import type { ContextSource, DetectedContext, DetectContextResponse } from "../../shared/types/imports";

// ── ID codec ─────────────────────────────────────────────────────────────────

export type MarksheetIdComponents = {
  valid: boolean;
  year: string;
  classCode: string;
  stream: string;
  subjectCode: string;
  examType: string;
  termCode: string;
};

/** Parse a marksheet ID string into its segment codes. */
export function parseMarksheetIdComponents(id: string): MarksheetIdComponents {
  const EMPTY: MarksheetIdComponents = {
    valid: false,
    year: "",
    classCode: "",
    stream: "",
    subjectCode: "",
    examType: "",
    termCode: "",
  };

  if (!id || typeof id !== "string") return EMPTY;

  const normalised = id.trim().toUpperCase();
  // Format: MS-YYYY-CLASS(1-6)-STREAM(1-3)-SUBJ(1-6)-EXAMTYPE(3)-TERM(1-4)
  const m = normalised.match(
    /^MS-(\d{4})-([A-Z0-9]{1,6})-([A-Z0-9]{1,3})-([A-Z]{1,6})-([A-Z]{3})-([A-Z0-9]{1,4})$/,
  );
  if (!m) return EMPTY;

  return {
    valid: true,
    year:        m[1]!,
    classCode:   m[2]!,
    stream:      m[3]!,
    subjectCode: m[4]!,
    examType:    m[5]!,
    termCode:    m[6]!,
  };
}

/** Compute the marksheet ID from context fields (mirrors PrintableMarksheet.tsx). */
export function computeMarksheetId(
  className: string,
  streamName: string,
  subjectName: string,
  examType: string,
  termName: string,
  year?: number,
): string {
  const y   = year ?? new Date().getFullYear();
  const cls = className.replace(/\s+/g, "").toUpperCase().slice(0, 4);
  const sub = subjectName.replace(/[^A-Za-z]/g, "").toUpperCase().slice(0, 4);
  const trm = termName.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 2);
  return `MS-${y}-${cls}-${streamName.toUpperCase()}-${sub}-${examType.toUpperCase()}-${trm}`;
}

// ── DB lookups ────────────────────────────────────────────────────────────────

/**
 * Search committed/dry-run MarkImportBatch records.
 * For each batch, compute its marksheet ID from stored context and compare.
 * Returns the first exact match.
 */
async function lookupFromBatches(
  prisma: PrismaClient,
  schoolId: string,
  targetId: string,
): Promise<DetectedContext | null> {
  const batches = await prisma.markImportBatch.findMany({
    where: {
      schoolId,
      source: { not: "scan" },
    },
    orderBy: { createdAt: "desc" },
    take: 500,
  });

  for (const batch of batches) {
    let ctx: Record<string, unknown> = {};
    try {
      ctx = JSON.parse(batch.summary ?? "{}") as Record<string, unknown>;
    } catch {
      continue;
    }

    const cn = String(ctx["className"] ?? "");
    const sn = String(ctx["streamName"] ?? "");
    const su = String(ctx["subjectName"] ?? "");
    const et = String(ctx["examType"] ?? "");
    const tn = String(ctx["termName"] ?? "");
    if (!cn || !su || !et || !tn) continue;

    const year = new Date(batch.createdAt).getFullYear();
    const computed = computeMarksheetId(cn, sn, su, et, tn, year);

    if (computed.toUpperCase() === targetId.toUpperCase()) {
      return {
        marksheetId: computed,
        className:    cn,
        streamName:   sn,
        subjectName:  su,
        termName:     tn,
        examType:     et,
        academicYear: String(ctx["academicYear"] ?? year),
        overallConfidence: 1.0,
        source:  "BATCH_LOOKUP",
        partial: false,
        message: "Context matched a previously committed marksheet batch.",
      };
    }
  }

  return null;
}

/**
 * Decode class/subject/term codes against live school data and return the
 * best-matching context.  May be partial if some fields can't be resolved.
 */
async function resolveFromSchoolData(
  prisma: PrismaClient,
  schoolId: string,
  c: MarksheetIdComponents,
): Promise<DetectedContext> {
  const [classes, subjects, terms] = await Promise.all([
    prisma.schoolClass.findMany({
      where: { schoolId },
      include: { streams: true },
    }),
    prisma.subject.findMany({ where: { schoolId } }),
    prisma.term.findMany({
      where: { academicYear: { schoolId } },
      include: { academicYear: true },
      orderBy: { startsOn: "desc" },
      take: 40,
    }),
  ]);

  // ── Class ──────────────────────────────────────────────────────────────────
  let className  = "";
  let streamName = c.stream; // fallback: use stream code directly

  for (const cls of classes) {
    const code = cls.name.replace(/\s+/g, "").toUpperCase().slice(0, 4);
    if (code === c.classCode) {
      className = cls.name;
      const match = cls.streams.find(
        (s) => s.name.toUpperCase() === c.stream || s.code.toUpperCase() === c.stream,
      );
      if (match) streamName = match.name;
      break;
    }
  }

  // ── Subject ────────────────────────────────────────────────────────────────
  let subjectName = "";

  for (const sub of subjects) {
    const nameCode = sub.name.replace(/[^A-Za-z]/g, "").toUpperCase().slice(0, 4);
    const codeMatch = sub.code.toUpperCase().slice(0, 4);
    if (nameCode === c.subjectCode || codeMatch === c.subjectCode) {
      subjectName = sub.name;
      break;
    }
  }

  // ── Academic year & term ───────────────────────────────────────────────────
  const targetYear = parseInt(c.year, 10);

  // Filter terms belonging to the target academic year
  const yearTerms = terms.filter((t) => {
    const yName = t.academicYear.name;
    // Match "2026", "2025/2026", "2025-2026" etc.
    return yName.includes(c.year) || new Date(t.startsOn).getFullYear() === targetYear;
  });

  let termName    = "";
  let academicYear = c.year;

  if (yearTerms.length > 0) {
    // Try to match by term code
    const matching = yearTerms.filter((t) => {
      const code = t.name.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 2);
      return code === c.termCode;
    });

    // "Term 1", "Term 2", "Term 3" all produce "TE" (first 2 chars of "TERM*").
    // When there are multiple matches, the examType gives a weak hint:
    //   EOT → Term 3 (end-of-year), MOT → Term 2, BOT → Term 1
    const picked =
      matching.length === 1
        ? matching[0]!
        : matching.find((t) => {
            if (c.examType === "EOT") return t.name.includes("3");
            if (c.examType === "MOT") return t.name.includes("2");
            if (c.examType === "BOT") return t.name.includes("1");
            return false;
          }) ?? matching[0];

    if (picked) {
      termName     = picked.name;
      academicYear = picked.academicYear.name;
    }
  }

  const partial = !className || !subjectName || !termName;
  const confidence = partial ? 0.55 : 0.75; // ID_PARSED is always lower than BATCH_LOOKUP

  return {
    marksheetId:   `MS-${c.year}-${c.classCode}-${c.stream}-${c.subjectCode}-${c.examType}-${c.termCode}`,
    className,
    streamName,
    subjectName,
    termName,
    examType:    c.examType,
    academicYear,
    overallConfidence: confidence,
    source:  "ID_PARSED" as ContextSource,
    partial,
    message: partial
      ? "Some context fields could not be resolved from the marksheet ID. Review and correct before continuing."
      : "Context resolved from marksheet ID. Verify before continuing.",
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Resolve context from a marksheet ID string.
 *
 * Tries BATCH_LOOKUP first; falls back to ID_PARSED against school data.
 */
export async function resolveContextByMarksheetId(
  prisma: PrismaClient,
  schoolId: string,
  marksheetId: string,
): Promise<DetectContextResponse> {
  const components = parseMarksheetIdComponents(marksheetId);

  if (!components.valid) {
    return {
      detected: null,
      detectionStatus: "NOT_FOUND",
      message: `"${marksheetId}" is not a valid marksheet ID (expected format: MS-YYYY-CLASS-STREAM-SUBJECT-EXAMTYPE-TERM).`,
    };
  }

  // 1. Exact match from committed batches
  const batchMatch = await lookupFromBatches(prisma, schoolId, marksheetId);
  if (batchMatch) {
    return { detected: batchMatch, detectionStatus: "DETECTED", message: batchMatch.message };
  }

  // 2. Decode against school data
  const resolved = await resolveFromSchoolData(prisma, schoolId, components);
  return {
    detected: resolved,
    detectionStatus: resolved.partial ? "PARTIAL" : "DETECTED",
    message: resolved.message,
  };
}

/**
 * Try to find a marksheet ID in OCR'd text from a scanned header.
 * Returns the first match or null.
 */
export function findMarksheetIdInText(ocrText: string): string | null {
  // Pattern: MS-YYYY-CLASS-STREAM-SUBJECT-EXAMTYPE-TERM (case-insensitive)
  const m = ocrText.match(
    /MS-\d{4}-[A-Z0-9]{1,6}-[A-Z0-9]{1,3}-[A-Z]{1,6}-[A-Z]{3}-[A-Z0-9]{1,4}/i,
  );
  return m ? m[0]!.toUpperCase() : null;
}
