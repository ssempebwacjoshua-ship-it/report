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
import type {
  ContextSource,
  DetectedContext,
  DetectContextResponse,
  MarksheetIdMatchSource,
  ScanContextSource,
  ScanMarksheetContext,
} from "../../../../shared/types/imports";

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

export type ScanContextResolverInput = {
  recognizedMarksheetId?: string | null;
  recognizedMatchSource?: Extract<MarksheetIdMatchSource, "header" | "footer"> | null;
  recognizedMatchConfidence?: number | null;
  selectedMarksheetId?: string | null;
  selectedClassId?: string | null;
  selectedStreamId?: string | null;
  selectedSubjectId?: string | null;
  selectedExamType?: string | null;
  academicYear?: string | null;
  term?: string | null;
  selectedContext?: Partial<ScanMarksheetContext> | null;
};

export type ScanContextResolution = {
  recognizedMarksheetId: string | null;
  normalizedMarksheetId: string;
  rawRecognizedId: string | null;
  normalizedRecognizedId: string;
  matchedMarksheetId: string;
  matchConfidence: number;
  matchSource: MarksheetIdMatchSource;
  selectedMarksheetId: string;
  resolvedContext: ScanMarksheetContext | null;
  contextSource: ScanContextSource;
  contextWarning: string;
};

const EMPTY_SCAN_CONTEXT_RESOLUTION: ScanContextResolution = {
  recognizedMarksheetId: null,
  normalizedMarksheetId: "",
  rawRecognizedId: null,
  normalizedRecognizedId: "",
  matchedMarksheetId: "",
  matchConfidence: 0,
  matchSource: "manual-required",
  selectedMarksheetId: "",
  resolvedContext: null,
  contextSource: "manual-required",
  contextWarning: "Marksheet context is required before extraction.",
};

function trimString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function selectedContextFromInput(input: ScanContextResolverInput): ScanMarksheetContext | null {
  const selected = input.selectedContext ?? {};
  const context: ScanMarksheetContext = {
    marksheetId: trimString(selected.marksheetId) || trimString(input.selectedMarksheetId),
    className: trimString(selected.className) || trimString(input.selectedClassId),
    streamName: trimString(selected.streamName) || trimString(input.selectedStreamId),
    subjectName: trimString(selected.subjectName) || trimString(input.selectedSubjectId),
    termName: trimString(selected.termName) || trimString(input.term),
    examType: trimString(selected.examType) || trimString(input.selectedExamType),
    academicYear: trimString(selected.academicYear) || trimString(input.academicYear),
  };

  const required: Array<keyof ScanMarksheetContext> = [
    "className",
    "streamName",
    "subjectName",
    "termName",
    "examType",
    "academicYear",
  ];
  return required.every((key) => context[key].trim()) ? context : null;
}

function detectedToScanContext(detected: DetectedContext): ScanMarksheetContext {
  return {
    marksheetId: detected.marksheetId,
    className: detected.className,
    streamName: detected.streamName,
    subjectName: detected.subjectName,
    termName: detected.termName,
    examType: detected.examType,
    academicYear: detected.academicYear,
  };
}

function classCodeVariants(code: string): Set<string> {
  const variants = new Set([code]);
  if (code.endsWith("I")) variants.add(`${code.slice(0, -1)}1`);
  if (code.endsWith("1")) variants.add(`${code.slice(0, -1)}I`);
  return variants;
}

/**
 * Normalize OCR/operator Marksheet IDs before parse/lookup.
 *
 * The generated template historically used the first four characters of
 * "Senior1A", producing SENI. Live school matching often expects SEN1. OCR also
 * swaps O/0 and may insert spaces or non-ASCII dash glyphs.
 */
export function normalizeMarksheetId(input: string): string {
  const cleaned = input
    .trim()
    .toUpperCase()
    .replace(/[–?−]/g, "-")
    .replace(/\|/g, "I")
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  if (!cleaned) return "";

  const parts = cleaned.split("-").filter(Boolean);
  if (parts.length !== 7) return cleaned;

  let [prefix, year, classCode, stream, subjectCode, examType, termCode] = parts as [
    string, string, string, string, string, string, string,
  ];

  prefix = prefix.replace(/^M5$/, "MS");
  year = year.replace(/O/g, "0");
  classCode = classCode.replace(/^SEN[IL1]$/, "SEN1").replace(/O/g, "0");
  stream = stream.replace(/O/g, "0");
  examType = examType.replace(/0/g, "O");
  termCode = termCode.replace(/O/g, "0");

  return [prefix, year, classCode, stream, subjectCode, examType, termCode].join("-");
}

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

  const normalised = normalizeMarksheetId(id);
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

/**
 * Compute the short human-typeable Sheet Number from an internal marksheet ID.
 *
 * Format: YYYYMMDD-NNN
 *   YYYYMMDD = generation date
 *   NNN      = 3-digit deterministic hash of the marksheet ID (date-independent)
 *
 * The hash is stable: the same marksheet ID always yields the same suffix,
 * so the system can identify a scan by trying all candidate IDs and comparing
 * their suffixes against the NNN in the OCR-detected sheet number.
 */
export function computeSheetNumber(marksheetId: string, generatedDate?: Date): string {
  const date = generatedDate ?? new Date();
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const dateStr = `${y}${m}${d}`;
  const suffix = sheetNumberSuffix(marksheetId);
  return `${dateStr}-${suffix}`;
}

function sheetNumberSuffix(marksheetId: string): string {
  // Always normalize before hashing so SENI and SEN1 produce the same suffix
  const normalized = normalizeMarksheetId(marksheetId);
  const chars = normalized.replace(/[^A-Z0-9]/gi, "").toUpperCase();
  let hash = 7;
  for (let i = 0; i < chars.length; i++) {
    hash = (hash * 31 + chars.charCodeAt(i)) & 0x7fffffff;
  }
  return String(hash % 1000).padStart(3, "0");
}

/**
 * Extract the YYYYMMDD-NNN sheet number from OCR text, if present.
 * Matches "SHEET NO: 20260611-042" or "SHEET NO 20260611-042".
 */
export function findSheetNumberInText(text: string): string | null {
  const m = text
    .toUpperCase()
    .match(/SHEET\s+N[O0][\s:.]+(\d{8}-\d{3})/);
  return m ? m[1]! : null;
}

/**
 * Try to resolve a marksheet ID from a sheet number by hashing all candidate
 * marksheet IDs known for this school and matching the NNN suffix.
 *
 * Candidates come from:
 *   1. Previously committed batches (batch lookup)
 *   2. Cross-product of live school data (classes × streams × subjects × terms × exam types)
 */
export async function findMarksheetIdBySheetNumber(
  prisma: PrismaClient,
  schoolId: string,
  sheetNumber: string,
): Promise<string | null> {
  const suffixMatch = sheetNumber.match(/-(\d{3})$/);
  if (!suffixMatch) return null;
  const targetSuffix = suffixMatch[1]!;

  // 1. Scan committed batches
  const batches = await prisma.markImportBatch.findMany({
    where: { schoolId, source: { not: "scan" } },
    orderBy: { createdAt: "desc" },
    take: 500,
  });
  for (const batch of batches) {
    let ctx: Record<string, unknown> = {};
    try { ctx = JSON.parse(batch.summary ?? "{}") as Record<string, unknown>; } catch { continue; }
    const cn = String(ctx["className"] ?? "");
    const sn = String(ctx["streamName"] ?? "");
    const su = String(ctx["subjectName"] ?? "");
    const et = String(ctx["examType"] ?? "");
    const tn = String(ctx["termName"] ?? "");
    if (!cn || !su || !et || !tn) continue;
    const year = new Date(batch.createdAt).getFullYear();
    const id = computeMarksheetId(cn, sn, su, et, tn, year);
    // sheetNumberSuffix normalizes before hashing ? return the normalized form
    if (sheetNumberSuffix(id) === targetSuffix) return normalizeMarksheetId(id);
  }

  // 2. Cross-product from live school data
  const [classes, subjects, terms] = await Promise.all([
    prisma.schoolClass.findMany({ where: { schoolId }, include: { streams: true } }),
    prisma.subject.findMany({ where: { schoolId } }),
    prisma.term.findMany({
      where: { academicYear: { schoolId } },
      include: { academicYear: true },
      orderBy: { startsOn: "desc" },
      take: 40,
    }),
  ]);

  const examTypes = ["BOT", "MOT", "EOT"];
  for (const cls of classes) {
    for (const stream of cls.streams) {
      for (const sub of subjects) {
        for (const term of terms) {
          const year = new Date(term.startsOn).getFullYear();
          for (const et of examTypes) {
            const id = computeMarksheetId(cls.name, stream.name, sub.name, et, term.name, year);
            if (sheetNumberSuffix(id) === targetSuffix) return normalizeMarksheetId(id);
          }
        }
      }
    }
  }

  return null;
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

    if (normalizeMarksheetId(computed) === normalizeMarksheetId(targetId)) {
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
  let className = "";
  let streamName = c.stream; // fallback: use stream code directly
  const classMatches: Array<{
    cls: typeof classes[number];
    streamMatch: typeof classes[number]["streams"][number] | undefined;
  }> = [];

  for (const cls of classes) {
    const code = cls.name.replace(/\s+/g, "").toUpperCase().slice(0, 4);
    const variants = classCodeVariants(code);
    if (variants.has(c.classCode)) {
      const match = cls.streams.find(
        (s) => s.name.toUpperCase() === c.stream || s.code.toUpperCase() === c.stream,
      );
      classMatches.push({ cls, streamMatch: match });
    }
  }
  const bestClassMatch = classMatches.find((match) => match.streamMatch) ?? classMatches[0];
  if (bestClassMatch) {
    className = bestClassMatch.cls.name;
    if (bestClassMatch.streamMatch) streamName = bestClassMatch.streamMatch.name;
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
    //   EOT ? Term 3 (end-of-year), MOT ? Term 2, BOT ? Term 1
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
  const normalized = normalizeMarksheetId(marksheetId);
  const components = parseMarksheetIdComponents(normalized);

  if (!components.valid) {
    return {
      detected: null,
      detectionStatus: "NOT_FOUND",
        message: `"${marksheetId}" is not a valid marksheet ID (expected format: MS-YYYY-CLASS-STREAM-SUBJECT-EXAMTYPE-TERM).`,
        normalizedMarksheetId: normalized,
      };
  }

  // 1. Exact match from committed batches
  const batchMatch = await lookupFromBatches(prisma, schoolId, normalized);
  if (batchMatch) {
    return {
      detected: batchMatch,
      detectionStatus: "DETECTED",
      message: batchMatch.message,
      normalizedMarksheetId: normalized,
    };
  }

  // 2. Decode against school data
  const resolved = await resolveFromSchoolData(prisma, schoolId, components);
  return {
    detected: resolved,
    detectionStatus: resolved.partial ? "PARTIAL" : "DETECTED",
    message: resolved.message,
    normalizedMarksheetId: normalized,
  };
}

/**
 * Try to find a marksheet ID in OCR'd text from a scanned header.
 * Returns the first match or null.
 */
export function findMarksheetIdCandidatesInText(ocrText: string): string[] {
  if (!ocrText || typeof ocrText !== "string") return [];

  const text = ocrText
    .toUpperCase()
    .replace(/[–?−]/g, "-")
    .replace(/\|/g, "I")
    .replace(/\bSENL\b/g, "SEN1")
    .replace(/\bSENI\b/g, "SEN1");

  const candidates: string[] = [];
  const push = (raw: string) => {
    const normalized = normalizeMarksheetId(raw);
    if (parseMarksheetIdComponents(normalized).valid && !candidates.includes(normalized)) {
      candidates.push(normalized);
    }
  };

  const strictMatches = text.match(/M[S5]-[20O]{4}-[A-Z0-9]{1,6}-[A-Z0-9]{1,3}-[A-Z]{1,6}-[A-Z0-9]{3}-[A-Z0-9]{1,4}/g) ?? [];
  for (const match of strictMatches) push(match);

  const tokens = text.match(/[A-Z0-9]+/g) ?? [];
  for (let index = 0; index <= tokens.length - 7; index += 1) {
    if (tokens[index] !== "MS" && tokens[index] !== "M5") continue;
    push(tokens.slice(index, index + 7).join("-"));
  }

  return candidates;
}

export function findMarksheetIdInText(ocrText: string): string | null {
  return findMarksheetIdCandidatesInText(ocrText)[0] ?? null;
}

export async function resolveScanMarksheetContext(
  prisma: PrismaClient,
  schoolId: string,
  input: ScanContextResolverInput,
): Promise<ScanContextResolution> {
  const selectedContext = selectedContextFromInput(input);
  const selectedMarksheetId = normalizeMarksheetId(
    trimString(input.selectedMarksheetId) || selectedContext?.marksheetId || "",
  );
  const recognizedRaw = trimString(input.recognizedMarksheetId);
  const normalizedRecognized = normalizeMarksheetId(recognizedRaw);
  const recognizedSource = input.recognizedMatchSource ?? "header";
  const recognizedConfidence = typeof input.recognizedMatchConfidence === "number"
    ? Math.max(0, Math.min(1, input.recognizedMatchConfidence))
    : 0;

  if (normalizedRecognized) {
    const recognizedLookup = await resolveContextByMarksheetId(prisma, schoolId, normalizedRecognized);
    if (recognizedLookup.detected && !recognizedLookup.detected.partial) {
      const resolvedContext = detectedToScanContext(recognizedLookup.detected);
      return {
        recognizedMarksheetId: recognizedRaw || normalizedRecognized,
        normalizedMarksheetId: recognizedLookup.normalizedMarksheetId || normalizedRecognized,
        rawRecognizedId: recognizedRaw || normalizedRecognized,
        normalizedRecognizedId: recognizedLookup.normalizedMarksheetId || normalizedRecognized,
        matchedMarksheetId: resolvedContext.marksheetId || recognizedLookup.normalizedMarksheetId || normalizedRecognized,
        matchConfidence: recognizedConfidence || recognizedLookup.detected.overallConfidence || 1,
        matchSource: recognizedSource,
        selectedMarksheetId,
        resolvedContext,
        contextSource: "recognized-id",
        contextWarning: "",
      };
    }

    if (selectedContext) {
      const fallbackContext = {
        ...selectedContext,
        marksheetId: selectedMarksheetId || selectedContext.marksheetId || normalizedRecognized,
      };
      return {
        recognizedMarksheetId: recognizedRaw || normalizedRecognized,
        normalizedMarksheetId: recognizedLookup.normalizedMarksheetId || normalizedRecognized,
        rawRecognizedId: recognizedRaw || normalizedRecognized,
        normalizedRecognizedId: recognizedLookup.normalizedMarksheetId || normalizedRecognized,
        matchedMarksheetId: fallbackContext.marksheetId,
        matchConfidence: 0.65,
        matchSource: "selected-fallback",
        selectedMarksheetId,
        resolvedContext: fallbackContext,
        contextSource: "selected-context",
        contextWarning: "Marksheet ID OCR failed; using selected marksheet.",
      };
    }

    return {
      ...EMPTY_SCAN_CONTEXT_RESOLUTION,
      recognizedMarksheetId: recognizedRaw || normalizedRecognized,
      normalizedMarksheetId: recognizedLookup.normalizedMarksheetId || normalizedRecognized,
      rawRecognizedId: recognizedRaw || normalizedRecognized,
      normalizedRecognizedId: recognizedLookup.normalizedMarksheetId || normalizedRecognized,
      matchedMarksheetId: "",
      matchConfidence: recognizedConfidence,
      selectedMarksheetId,
      contextWarning: recognizedLookup.message || "Recognized Marksheet ID could not be resolved. Confirm the marksheet context manually.",
    };
  }

  if (selectedContext) {
    const fallbackContext = {
      ...selectedContext,
      marksheetId: selectedMarksheetId || selectedContext.marksheetId,
    };
    return {
      recognizedMarksheetId: null,
      normalizedMarksheetId: selectedMarksheetId,
      rawRecognizedId: null,
      normalizedRecognizedId: "",
      matchedMarksheetId: fallbackContext.marksheetId,
      matchConfidence: 0.65,
      matchSource: "selected-fallback",
      selectedMarksheetId,
      resolvedContext: fallbackContext,
      contextSource: "selected-context",
      contextWarning: "Marksheet context resolved from selected context.",
    };
  }

  return {
    ...EMPTY_SCAN_CONTEXT_RESOLUTION,
    selectedMarksheetId,
  };
}

