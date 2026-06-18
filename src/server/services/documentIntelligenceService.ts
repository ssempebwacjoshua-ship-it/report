import { createHash, randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import * as XLSX from "xlsx";
import { prisma } from "../db/prisma";
import {
  extractDocumentKnowledge,
  generateDocumentSchema,
  applyPromptToSchema,
} from "./documentGeminiService";
import {
  createNotification,
  executeWorkflows,
  incrementDocumentAnalytics,
  preferenceMap,
  upsertSearchIndex,
} from "./documentOsService";
import { renderSchemaToPdf } from "./documentExportService";
import { preprocessDocumentForOcr, type DocumentOcrPreprocessMode } from "./documentOcrPreprocessService";
import type {
  SmartDocumentDetail,
  SmartDocumentSummary,
  DocumentVersionSummary,
  DocumentSchema,
  ComponentNode,
  ExtractedKnowledge,
  ActiveVersionSnapshot,
} from "../../shared/types/documentIntelligence";

type SmartPagesActor = {
  id: string;
  type: "SCHOOL_OPERATOR" | "EXTERNAL";
  email: string;
  name: string;
  schoolId: string | null;
};

// ── Creator helpers ────────────────────────────────────────────────────────────

export async function findOrCreateSchoolOperatorCreator(
  schoolId: string,
  email: string,
  name: string,
): Promise<string> {
  const db = prisma as any;
  const existing = await db.creator.findFirst({ where: { schoolId, email } });
  if (existing) return existing.id as string;

  const byEmail = await db.creator.findUnique({ where: { email } });
  if (byEmail) {
    if (byEmail.schoolId === schoolId) {
      return byEmail.id as string;
    }
    if (!byEmail.schoolId) {
      await db.creator.update({
        where: { id: byEmail.id },
        data: { schoolId, type: "SCHOOL_OPERATOR", name, email },
      });
      return byEmail.id as string;
    }
    throw Object.assign(new Error("Creator email already belongs to another school."), { status: 409 });
  }

  const created = await db.creator.create({
    data: { id: randomUUID(), type: "SCHOOL_OPERATOR", email, name, schoolId },
  });
  return created.id as string;
}

export async function findCreatorById(creatorId: string) {
  return (prisma as any).creator.findUnique({ where: { id: creatorId } });
}

async function getSmartPagesActor(creatorId: string): Promise<SmartPagesActor> {
  const db = prisma as any;
  const creator = await db.creator.findUnique({
    where: { id: creatorId },
    select: { id: true, type: true, email: true, name: true, schoolId: true, isActive: true },
  });
  if (!creator || !creator.isActive) throw Object.assign(new Error("Creator not found."), { status: 404 });
  return {
    id: creator.id as string,
    type: creator.type as SmartPagesActor["type"],
    email: creator.email as string,
    name: creator.name as string,
    schoolId: (creator.schoolId as string | null) ?? null,
  };
}

async function loadOwnedSmartDocument(db: any, actor: SmartPagesActor, documentId: string, include?: Record<string, unknown>) {
  const doc = await db.smartDocument.findUnique({
    where: { id: documentId },
    ...(include ? { include } : {}),
  });
  if (!doc) throw Object.assign(new Error("Document not found."), { status: 404 });

  const schoolOwned = actor.type === "SCHOOL_OPERATOR" && actor.schoolId
    ? (doc.schoolId && doc.schoolId === actor.schoolId)
    : false;
  const legacyOwned = doc.schoolId == null && doc.creatorId === actor.id;
  const creatorOwned = actor.type === "EXTERNAL" && doc.creatorId === actor.id && doc.schoolId == null;

  if (!schoolOwned && !legacyOwned && !creatorOwned) {
    throw Object.assign(new Error("You do not have access to this document."), { status: 403 });
  }

  return doc;
}

async function writeSmartPagesAudit(
  actor: SmartPagesActor | null,
  action: string,
  correlationId: string | null,
  details: Record<string, unknown>,
) {
  if (!actor?.schoolId) return;
  const db = prisma as any;
  await db.auditLog.create({
    data: {
      id: randomUUID(),
      schoolId: actor.schoolId,
      action,
      correlationId,
      details: {
        actor: {
          id: actor.id,
          type: actor.type,
          email: actor.email,
          name: actor.name,
        },
        ...details,
      },
    },
  });
}

// ── Document list ──────────────────────────────────────────────────────────────

export async function listDocuments(creatorId: string): Promise<SmartDocumentSummary[]> {
  const db = prisma as any;
  const actor = await getSmartPagesActor(creatorId);
  const docs = await db.smartDocument.findMany({
    where: actor.type === "SCHOOL_OPERATOR" && actor.schoolId
      ? {
          OR: [
            { schoolId: actor.schoolId },
            { creatorId: actor.id, schoolId: null },
          ],
        }
      : { creatorId: actor.id, schoolId: null },
    orderBy: { updatedAt: "desc" },
    include: {
      _count: { select: { versions: true, sourceFiles: true } },
      published: { select: { token: true } },
    },
  });

  return docs.map((d: any) => ({
    id: d.id as string,
    title: d.title as string,
    status: d.status as string,
    extractionStatus: d.extractionStatus as SmartDocumentSummary["extractionStatus"],
    extractionError: d.extractionError as string | null,
    domain: (d.extractedKnowledge as any)?.domain as string | undefined,
    createdAt: (d.createdAt as Date).toISOString(),
    updatedAt: (d.updatedAt as Date).toISOString(),
    versionCount: d._count.versions as number,
    hasSourceFiles: (d._count.sourceFiles as number) > 0,
    publishToken: (d.published?.token as string) ?? undefined,
  }));
}

// ── Create document ────────────────────────────────────────────────────────────

export async function createDocument(creatorId: string, title: string): Promise<SmartDocumentDetail> {
  const db = prisma as any;
  const actor = await getSmartPagesActor(creatorId);
  const doc = await db.smartDocument.create({
    data: {
      id: randomUUID(),
      creatorId,
      ...(actor.schoolId ? { schoolId: actor.schoolId } : {}),
      title,
      status: "DRAFT",
    },
  });
  await upsertSearchIndex(actor.id, "DOCUMENT", doc.id, doc.title, doc.title, { status: doc.status });
  await createNotification(actor.id, "DOCUMENT_CREATED", "Document created", `${doc.title} is ready for content.`);
  await executeWorkflows(actor.id, "DOCUMENT_CREATED", { documentId: doc.id, title: doc.title });
  await writeSmartPagesAudit(actor, "SMART_DOCUMENT_CREATED", doc.id as string, { documentId: doc.id, title: doc.title });
  return rowToDetail(doc, null, 0);
}

// ── Get document ───────────────────────────────────────────────────────────────

export async function getDocument(documentId: string, creatorId: string): Promise<SmartDocumentDetail | null> {
  const db = prisma as any;
  const actor = await getSmartPagesActor(creatorId);
  const doc = await loadOwnedSmartDocument(db, actor, documentId, {
    _count: { select: { versions: true } },
    published: { select: { token: true } },
    sourceFiles: { orderBy: { createdAt: "desc" }, take: 1 },
  });
  const activeVersion = await resolveActiveVersion(db, documentId, doc.activeVersionId);
  return rowToDetail(doc, activeVersion, doc._count.versions);
}

async function resolveActiveVersion(db: any, documentId: string, activeVersionId: string | null) {
  if (activeVersionId) {
    return db.documentVersion.findUnique({ where: { id: activeVersionId } });
  }
  return db.documentVersion.findFirst({ where: { documentId }, orderBy: { createdAt: "desc" } });
}

function rowToDetail(doc: any, version: any, versionCount: number): SmartDocumentDetail {
  const knowledge = doc.extractedKnowledge as ExtractedKnowledge | null;
  const activeVersion: ActiveVersionSnapshot | null = version
    ? {
        id: version.id as string,
        instruction: version.instruction as string | null,
        schema: version.schema as DocumentSchema,
        componentTree: version.componentTree as ComponentNode[],
        renderSettings: version.renderSettings as ActiveVersionSnapshot["renderSettings"],
        createdAt: (version.createdAt as Date).toISOString(),
      }
    : null;

  return {
    id: doc.id as string,
    title: doc.title as string,
    status: doc.status as string,
    extractionStatus: doc.extractionStatus as SmartDocumentSummary["extractionStatus"],
    extractionError: doc.extractionError as string | null,
    domain: knowledge?.domain,
    createdAt: (doc.createdAt as Date).toISOString(),
    updatedAt: (doc.updatedAt as Date).toISOString(),
    versionCount,
    hasSourceFiles: false,
    publishToken: (doc.published?.token as string) ?? undefined,
    extractedKnowledge: knowledge,
    activeVersion,
    latestSourceFile: doc.sourceFiles?.[0]
      ? {
          id: doc.sourceFiles[0].id,
          status: doc.sourceFiles[0].status,
          originalName: doc.sourceFiles[0].originalName,
          extractionError: doc.sourceFiles[0].extractionError,
          extractionStartedAt: doc.sourceFiles[0].extractionStartedAt?.toISOString() ?? null,
          extractionCompletedAt: doc.sourceFiles[0].extractionCompletedAt?.toISOString() ?? null,
        }
      : undefined,
  };
}

// ── Upload + extract ───────────────────────────────────────────────────────────

export async function uploadAndExtract(
  documentId: string,
  creatorId: string,
  file: Express.Multer.File,
): Promise<{ sourceFileId: string; status: "PROCESSING" }> {
  const db = prisma as any;
  const actor = await getSmartPagesActor(creatorId);
  await loadOwnedSmartDocument(db, actor, documentId);
  if (isWordDocumentUpload(file.mimetype, file.originalname)) {
    throw Object.assign(
      new Error("Word documents are coming soon. Please upload PDF, image, CSV, or Excel."),
      { status: 415 },
    );
  }
  const fileHash = createHash("sha256").update(file.buffer).digest("hex");

  const sourceFile = await db.documentSourceFile.create({
    data: {
      id: randomUUID(),
      documentId,
      originalName: file.originalname,
      mimeType: file.mimetype,
      sizeBytes: file.size,
      status: "UPLOADED",
      originalData: file.buffer,
      fileHash,
      extractionStartedAt: new Date(),
      ocrQuality: { retryMode: "fast", notes: [{ code: "QUEUED", message: "Extraction job queued.", severity: "info" }] } as any,
    },
  });
  await db.smartDocument.update({
    where: { id: documentId },
    data: {
      extractionStatus: "PROCESSING",
      extractionError: null,
      extractionStartedAt: new Date(),
      extractionCompletedAt: null,
    },
  });
  await writeSmartPagesAudit(actor, "SMART_DOCUMENT_FILE_UPLOADED", sourceFile.id as string, {
    documentId,
    sourceFileId: sourceFile.id,
    fileName: file.originalname,
    mimeType: file.mimetype,
    sizeBytes: file.size,
  });
  return { sourceFileId: sourceFile.id as string, status: "PROCESSING" };
}

export async function retryDocumentExtraction(
  documentId: string,
  creatorId: string,
  sourceFileId?: string,
  highAccuracy = false,
): Promise<{ sourceFileId: string; status: "PROCESSING" }> {
  const db = prisma as any;
  const actor = await getSmartPagesActor(creatorId);
  const doc = await loadOwnedSmartDocument(db, actor, documentId, { sourceFiles: { orderBy: { createdAt: "desc" }, take: 1 } });
  const sourceFile = sourceFileId
    ? await db.documentSourceFile.findFirst({ where: { id: sourceFileId, documentId } })
    : doc.sourceFiles?.[0];
  if (!sourceFile) throw Object.assign(new Error("No source file available to retry."), { status: 404 });
  await db.documentSourceFile.update({
    where: { id: sourceFile.id },
    data: {
      status: "UPLOADED",
      extractionError: null,
      extractionStartedAt: new Date(),
      extractionCompletedAt: null,
      ocrQuality: {
        ...(typeof sourceFile.ocrQuality === "object" && sourceFile.ocrQuality ? (sourceFile.ocrQuality as Record<string, unknown>) : {}),
        retryMode: highAccuracy ? "high_accuracy" : "fast",
        retryRequestedAt: new Date().toISOString(),
      } as any,
    },
  });
  await db.smartDocument.update({
    where: { id: documentId },
    data: { extractionStatus: "PROCESSING", extractionError: null, extractionStartedAt: new Date(), extractionCompletedAt: null },
  });
  return { sourceFileId: sourceFile.id as string, status: "PROCESSING" };
}

export async function processNextDocumentExtractionJob(): Promise<boolean> {
  const db = prisma as any;
  await failStaleExtractionJobs();
  const sourceFile = await db.documentSourceFile.findFirst({
    where: { status: "UPLOADED" },
    orderBy: { createdAt: "asc" },
    include: { document: true },
  });
  if (!sourceFile) return false;
  await processSourceFileExtraction(sourceFile.id);
  return true;
}

let _documentExtractionWorkerRunning = false;

export function startDocumentExtractionWorker(): void {
  setInterval(async () => {
    if (_documentExtractionWorkerRunning) return;
    _documentExtractionWorkerRunning = true;
    try {
      await processNextDocumentExtractionJob();
    } catch (error) {
      console.error("[document-extraction-worker] error:", error instanceof Error ? error.message : error);
    } finally {
      _documentExtractionWorkerRunning = false;
    }
  }, 2_000);
}

export async function processSourceFileExtraction(sourceFileId: string): Promise<void> {
  const db = prisma as any;
  const sourceFile = await db.documentSourceFile.findUnique({ where: { id: sourceFileId }, include: { document: true } });
  if (!sourceFile || sourceFile.status === "READY") return;
  const document = sourceFile.document;
  const actor = await getSmartPagesActor(document.creatorId);
  try {
    const cached = sourceFile.fileHash
      ? await db.documentSourceFile.findFirst({
          where: {
            fileHash: sourceFile.fileHash,
            status: "READY",
            NOT: { id: sourceFile.id },
          },
          orderBy: { extractionCompletedAt: "desc" },
        })
      : null;
    if (cached?.extractedContent) {
      await completeExtraction(sourceFile, cached.extractedContent as ExtractedKnowledge, actor, {
        processedData: cached.processedData,
        processedMimeType: cached.processedMimeType,
        ocrQuality: { reusedFromSourceFileId: cached.id, notes: [{ code: "CACHE_HIT", message: "Reused extraction from matching file.", severity: "info" }] },
      });
      return;
    }

    const originalData = sourceFile.originalData as Buffer | Uint8Array | null;
    if (!originalData) throw new Error("Uploaded file data is missing. Please upload the file again.");
    const original = Buffer.from(originalData);

    await db.documentSourceFile.update({ where: { id: sourceFile.id }, data: { status: "PREPROCESSING", extractionStartedAt: new Date(), extractionError: null } });
    await db.smartDocument.update({ where: { id: document.id }, data: { extractionStatus: "PROCESSING", extractionError: null, extractionStartedAt: new Date() } });

    const structured = parseStructuredFile(original, sourceFile.mimeType, sourceFile.originalName);
    if (structured) {
      await completeExtraction(sourceFile, structured, actor, {
        processedData: original,
        processedMimeType: sourceFile.mimeType,
        ocrQuality: { notes: [{ code: "LOCAL_STRUCTURED_PARSE", message: "Parsed structured file locally without Gemini.", severity: "info" }] },
      });
      return;
    }

    const retryMode = resolveRetryMode(sourceFile.ocrQuality);
    const preprocessed = await preprocessDocumentForOcr(original, sourceFile.mimeType, retryMode);
    await db.documentSourceFile.update({
      where: { id: sourceFile.id },
      data: {
        status: "EXTRACTING",
        processedData: preprocessed.processedBuffer,
        processedMimeType: preprocessed.processedMimeType,
        ocrQuality: { width: preprocessed.width, height: preprocessed.height, notes: preprocessed.notes, warning: preprocessed.warning } as any,
      },
    });

    const knowledge = await extractDocumentKnowledge(original, sourceFile.mimeType, sourceFile.originalName, {
      highAccuracy: retryMode === "high_accuracy",
      processedBuffer: preprocessed.processedBuffer,
      processedMimeType: preprocessed.processedMimeType,
      sectionBuffers: preprocessed.sectionBuffers,
      priorExtraction: retryMode === "high_accuracy" ? (document.extractedKnowledge as ExtractedKnowledge | null) : null,
    });
    const unclearItems = knowledge.unclearItems ?? [];
    const lowConfidence = typeof knowledge.confidence === "number" ? knowledge.confidence < 0.55 : false;
    const enrichedKnowledge: ExtractedKnowledge = {
      ...knowledge,
      ocrQualityNotes: preprocessed.notes.map((note) => note.message),
      reviewWarning:
        preprocessed.warning
        ?? knowledge.reviewWarning
        ?? (lowConfidence
          ? "Some handwriting was difficult to read. Review the extracted text or try high accuracy extraction."
          : unclearItems.length > 0
            ? "Some handwriting was unclear. Please review before publishing."
            : undefined),
    };
    await completeExtraction(sourceFile, enrichedKnowledge, actor, {
      processedData: preprocessed.processedBuffer,
      processedMimeType: preprocessed.processedMimeType,
      ocrQuality: { width: preprocessed.width, height: preprocessed.height, notes: preprocessed.notes, warning: preprocessed.warning, retryMode },
    });
  } catch (error) {
    const statusValue = (error as { status?: unknown } | null)?.status;
    const causeValue = error instanceof Error ? (error as { cause?: unknown }).cause : undefined;
    const geminiModel = process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash";
    const diagnostic = {
      documentId: sourceFile.documentId,
      sourceFileId: sourceFile.id,
      originalName: sourceFile.originalName,
      mimeType: sourceFile.mimeType,
      sizeBytes: sourceFile.sizeBytes,
      geminiModel,
      errorName: error instanceof Error ? error.name : "Unknown",
      errorMessage: error instanceof Error ? error.message : String(error),
      errorCause: causeValue === undefined || causeValue === null ? undefined : String(causeValue),
      errorStatus: typeof statusValue === "number" ? statusValue : undefined,
    };
    console.error("[document-intelligence] extraction failed", diagnostic);
    const message = friendlyExtractionError(error);
    await db.documentSourceFile.update({
      where: { id: sourceFile.id },
      data: { status: "FAILED", extractionError: message, extractionCompletedAt: new Date() },
    });
    await db.smartDocument.update({
      where: { id: sourceFile.documentId },
      data: { extractionStatus: "FAILED", extractionError: message, extractionCompletedAt: new Date() },
    });
    await writeSmartPagesAudit(actor, "SMART_DOCUMENT_EXTRACTION_FAILED", sourceFile.id as string, {
      documentId: sourceFile.documentId,
      sourceFileId: sourceFile.id,
      originalName: sourceFile.originalName,
      mimeType: sourceFile.mimeType,
      sizeBytes: sourceFile.sizeBytes,
      errorMessage: error instanceof Error ? error.message : String(error),
    });
  }
}

async function completeExtraction(
  sourceFile: any,
  knowledge: ExtractedKnowledge,
  actor: SmartPagesActor,
  extras: { processedData?: Buffer | null; processedMimeType?: string | null; ocrQuality?: unknown },
) {
  const db = prisma as any;
  const document = sourceFile.document ?? await db.smartDocument.findUnique({ where: { id: sourceFile.documentId } });
  const needsTitleUpdate = !document.title || document.title === "Untitled Document";
  const title = needsTitleUpdate && knowledge.title ? knowledge.title : document.title;
  await db.documentSourceFile.update({
    where: { id: sourceFile.id },
    data: {
      status: "READY",
      processedData: extras.processedData ?? sourceFile.processedData,
      processedMimeType: extras.processedMimeType ?? sourceFile.processedMimeType,
      extractedContent: knowledge as any,
      ocrQuality: extras.ocrQuality as any,
      extractionError: null,
      extractionCompletedAt: new Date(),
    },
  });
  await db.smartDocument.update({
    where: { id: sourceFile.documentId },
    data: {
      extractedKnowledge: knowledge as any,
      extractionStatus: "READY",
      extractionError: null,
      extractionCompletedAt: new Date(),
      ...(needsTitleUpdate && knowledge.title ? { title: knowledge.title } : {}),
    },
  });
  await upsertSearchIndex(document.creatorId, "DOCUMENT", sourceFile.documentId, title, [
    title,
    knowledge.documentType,
    knowledge.domain,
    knowledge.rawText ?? "",
    JSON.stringify(knowledge.sections ?? []),
    JSON.stringify(knowledge.tables ?? []),
  ].join("\n"), { status: document.status, sourceFileId: sourceFile.id });
  await createNotification(document.creatorId, "EXTRACTION_READY", "Document ready for review", `${title} has been read and is ready to review.`);
  await writeSmartPagesAudit(actor, "SMART_DOCUMENT_EXTRACTION_COMPLETED", sourceFile.id as string, {
    documentId: sourceFile.documentId,
    sourceFileId: sourceFile.id,
    title,
    status: document.status,
  });
}

function resolveRetryMode(ocrQuality: unknown): DocumentOcrPreprocessMode {
  if (ocrQuality && typeof ocrQuality === "object" && (ocrQuality as { retryMode?: unknown }).retryMode === "high_accuracy") {
    return "high_accuracy";
  }
  return "fast";
}

async function failStaleExtractionJobs() {
  const db = prisma as any;
  const staleBefore = new Date(Date.now() - 10 * 60_000);
  const stale = await db.documentSourceFile.findMany({
    where: {
      status: { in: ["PREPROCESSING", "EXTRACTING"] },
      extractionStartedAt: { lt: staleBefore },
    },
    select: { id: true, documentId: true },
  });
  for (const row of stale) {
    const message = "Extraction took too long. Please retry.";
    await db.documentSourceFile.update({
      where: { id: row.id },
      data: { status: "FAILED", extractionError: message, extractionCompletedAt: new Date() },
    });
    await db.smartDocument.update({
      where: { id: row.documentId },
      data: { extractionStatus: "FAILED", extractionError: message, extractionCompletedAt: new Date() },
    });
  }
}

function parseStructuredFile(buffer: Buffer, mimeType: string, originalName: string): ExtractedKnowledge | null {
  const lowerName = originalName.toLowerCase();
  const isStructured = /(\.csv|\.xlsx|\.xls)$/i.test(lowerName)
    || /csv|spreadsheet|excel|officedocument\.spreadsheetml/i.test(mimeType);
  if (!isStructured) return null;
  try {
    const workbook = lowerName.endsWith(".csv") || /csv/i.test(mimeType)
      ? XLSX.read(buffer.toString("utf8"), { type: "string" })
      : XLSX.read(buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) throw new Error("No worksheet found.");
    const rows = XLSX.utils.sheet_to_json<Array<string | number>>(workbook.Sheets[sheetName], { header: 1, raw: false, defval: "" });
    const nonEmptyRows = rows
      .map((row) => row.map((cell) => String(cell ?? "").trim()))
      .filter((row) => row.some(Boolean));
    if (nonEmptyRows.length === 0) throw new Error("No rows found.");
    const headers = normalizeHeaders(nonEmptyRows[0]);
    const dataRows = nonEmptyRows.slice(1).map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ""])));
    const rawText = nonEmptyRows.map((row) => row.join(" | ")).join("\n");
    return {
      documentType: "table",
      domain: "general",
      title: originalName.replace(/\.[^.]+$/, ""),
      suggestedDocumentType: "table",
      sections: [{ heading: "Imported structured data", content: `${dataRows.length} rows detected locally.` }],
      tables: [{ heading: sheetName, columns: headers, rows: dataRows }],
      statistics: [{ label: "Rows", value: dataRows.length }, { label: "Columns", value: headers.length }],
      entities: [],
      people: [],
      dates: [],
      handwrittenNotes: [],
      keyFacts: [`${dataRows.length} structured rows parsed locally.`],
      unclearItems: [],
      ocrQualityNotes: ["Structured file parsed locally without Gemini."],
      rawText,
    };
  } catch (error) {
    return {
      documentType: "table",
      domain: "general",
      title: originalName.replace(/\.[^.]+$/, ""),
      suggestedDocumentType: "table",
      sections: [{ heading: "Structured file", content: "The spreadsheet could not be parsed cleanly." }],
      tables: [],
      statistics: [],
      entities: [],
      people: [],
      dates: [],
      handwrittenNotes: [],
      keyFacts: [],
      unclearItems: [{ label: "Spreadsheet parsing", value: "", reason: error instanceof Error ? error.message : "Unknown parsing error", unclear: true }],
      reviewWarning: "Some fields were unclear. Please review before publishing.",
      rawText: "",
    };
  }
}

function normalizeHeaders(row: string[]): string[] {
  return row.map((header, index) => {
    const value = String(header || "").trim();
    return value || `Column ${index + 1}`;
  });
}

function friendlyExtractionError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (/timeout|timed out/i.test(message)) return "Reading took too long. Please retry extraction.";
  if (/GEMINI_API_KEY/i.test(message)) return "Gemini is not configured. Add a Gemini API key and retry extraction.";
  return "We could not read this document. Please retry or upload a clearer file.";
}

export async function updateExtractedKnowledge(
  documentId: string,
  creatorId: string,
  knowledge: ExtractedKnowledge,
): Promise<ExtractedKnowledge> {
  const db = prisma as any;
  const actor = await getSmartPagesActor(creatorId);
  const doc = await loadOwnedSmartDocument(db, actor, documentId);
  await db.smartDocument.update({
    where: { id: documentId },
    data: {
      extractedKnowledge: knowledge as any,
      extractionStatus: "READY",
      extractionError: null,
      extractionCompletedAt: new Date(),
      ...(knowledge.title ? { title: knowledge.title } : {}),
    },
  });
  await upsertSearchIndex(creatorId, "DOCUMENT", documentId, knowledge.title || doc.title, [
    knowledge.title || doc.title,
    knowledge.documentType,
    knowledge.domain,
    knowledge.rawText ?? "",
    JSON.stringify(knowledge.sections ?? []),
    JSON.stringify(knowledge.tables ?? []),
    JSON.stringify(knowledge.unclearItems ?? []),
  ].join("\n"), { status: doc.status, reviewed: true });
  await writeSmartPagesAudit(actor, "SMART_DOCUMENT_KNOWLEDGE_UPDATED", documentId, {
    documentId,
    title: knowledge.title || doc.title,
  });
  return knowledge;
}

function isWordDocumentUpload(mimeType: string, originalName: string): boolean {
  const lowerName = originalName.toLowerCase();
  return /(\.docx?|application\/vnd\.openxmlformats-officedocument\.wordprocessingml\.document|application\/msword)/i.test(lowerName + " " + mimeType);
}

// ── Generate schema ────────────────────────────────────────────────────────────

export async function generateSchema(
  documentId: string,
  creatorId: string,
  intent: string,
): Promise<{ versionId: string; schema: DocumentSchema; componentTree: ComponentNode[] }> {
  const db = prisma as any;
  const actor = await getSmartPagesActor(creatorId);
  const doc = await loadOwnedSmartDocument(db, actor, documentId);

  const knowledge = doc.extractedKnowledge as ExtractedKnowledge | null;
  if (!knowledge) throw Object.assign(new Error("Upload a file first to extract content."), { status: 400 });
  if (doc.extractionStatus === "PROCESSING") {
    throw Object.assign(new Error("Document extraction is still processing. Please wait for review before generating."), { status: 409 });
  }

  const fitToOnePage = wantsFitToOnePage(intent);
  const { schema, componentTree } = await generateDocumentSchema(knowledge, intent, "#2563eb", await preferenceMap(creatorId));
  const finalSchema = fitToOnePage ? compactSchemaForPrint(schema) : schema;
  const finalComponents = fitToOnePage ? compactComponentsForPrint(componentTree) : componentTree;
  const renderSettings = renderSettingsForIntent(intent);

  const version = await db.documentVersion.create({
    data: {
      id: randomUUID(),
      documentId,
      instruction: intent,
      schema: finalSchema as any,
      componentTree: finalComponents as any,
      renderSettings: renderSettings as any,
    },
  });

  await db.smartDocument.update({ where: { id: documentId }, data: { activeVersionId: version.id } });
  await upsertSearchIndex(creatorId, "VERSION", version.id, doc.title, [
    intent,
    JSON.stringify(finalSchema),
    JSON.stringify(finalComponents),
  ].join("\n"), { documentId });
  await writeSmartPagesAudit(actor, "SMART_DOCUMENT_GENERATED", version.id as string, {
    documentId,
    versionId: version.id,
    instruction: intent,
  });

  return { versionId: version.id as string, schema: finalSchema, componentTree: finalComponents };
}

// ── Apply conversational prompt ────────────────────────────────────────────────

export async function applyPrompt(
  documentId: string,
  creatorId: string,
  instruction: string,
): Promise<{ versionId: string; schema: DocumentSchema; componentTree: ComponentNode[] }> {
  const db = prisma as any;
  const actor = await getSmartPagesActor(creatorId);
  const doc = await loadOwnedSmartDocument(db, actor, documentId);
  if (doc.extractionStatus === "PROCESSING") {
    throw Object.assign(new Error("Document extraction is still processing. Please wait for review before editing."), { status: 409 });
  }

  const currentVersion = await resolveActiveVersion(db, documentId, doc.activeVersionId);
  if (!currentVersion) {
    if (!doc.extractedKnowledge) {
      throw Object.assign(new Error("Upload a file first to extract content."), { status: 400 });
    }
    return generateSchema(documentId, creatorId, instruction);
  }

  const currentSchema = currentVersion.schema as DocumentSchema;
  const fitToOnePage = wantsFitToOnePage(instruction);
  const { schema, componentTree } = await applyPromptToSchema(currentSchema, instruction, await preferenceMap(creatorId));
  const finalSchema = fitToOnePage ? compactSchemaForPrint(schema) : schema;
  const finalComponents = fitToOnePage ? compactComponentsForPrint(componentTree) : componentTree;
  const renderSettings = {
    ...((currentVersion.renderSettings as Record<string, unknown> | null) ?? {}),
    ...renderSettingsForIntent(instruction),
  };

  const version = await db.documentVersion.create({
    data: {
      id: randomUUID(),
      documentId,
      parentId: currentVersion.id,
      instruction,
      schema: finalSchema as any,
      componentTree: finalComponents as any,
      renderSettings: renderSettings as any,
    },
  });

  await db.smartDocument.update({ where: { id: documentId }, data: { activeVersionId: version.id } });
  await upsertSearchIndex(creatorId, "VERSION", version.id, doc.title, [
    instruction,
    JSON.stringify(finalSchema),
    JSON.stringify(finalComponents),
  ].join("\n"), { documentId });
  await writeSmartPagesAudit(actor, "SMART_DOCUMENT_PROMPT_APPLIED", version.id as string, {
    documentId,
    versionId: version.id,
    instruction,
  });

  return { versionId: version.id as string, schema: finalSchema, componentTree: finalComponents };
}

// ── Version history ────────────────────────────────────────────────────────────

export async function getVersionHistory(
  documentId: string,
  creatorId: string,
): Promise<DocumentVersionSummary[]> {
  const db = prisma as any;
  const actor = await getSmartPagesActor(creatorId);
  const doc = await loadOwnedSmartDocument(db, actor, documentId);

  const versions = await db.documentVersion.findMany({
    where: { documentId },
    orderBy: { createdAt: "desc" },
    select: { id: true, parentId: true, instruction: true, createdAt: true },
  });

  return versions.map((v: any) => ({
    id: v.id as string,
    parentId: v.parentId as string | null,
    instruction: v.instruction as string | null,
    createdAt: (v.createdAt as Date).toISOString(),
  }));
}

export async function restoreVersion(
  documentId: string,
  creatorId: string,
  versionId: string,
): Promise<void> {
  const db = prisma as any;
  const actor = await getSmartPagesActor(creatorId);
  const doc = await loadOwnedSmartDocument(db, actor, documentId);
  const version = await db.documentVersion.findFirst({ where: { id: versionId, documentId } });
  if (!version) throw Object.assign(new Error("Version not found."), { status: 404 });
  await db.smartDocument.update({ where: { id: documentId }, data: { activeVersionId: versionId } });
  await upsertSearchIndex(creatorId, "VERSION", versionId, doc.title, [
    version.instruction ?? "",
    JSON.stringify(version.schema ?? {}),
    JSON.stringify(version.componentTree ?? []),
  ].join("\n"), { documentId });
  await createNotification(creatorId, "VERSION_RESTORED", "Version restored", `${doc.title} was restored to an earlier version.`);
  await writeSmartPagesAudit(actor, "SMART_DOCUMENT_VERSION_RESTORED", versionId, {
    documentId,
    versionId,
    title: doc.title,
  });
}

// ── Publish ────────────────────────────────────────────────────────────────────

export async function publishDocument(
  documentId: string,
  creatorId: string,
  options: { expiresInDays?: number; password?: string } = {},
): Promise<{ token: string; url: string }> {
  const db = prisma as any;
  const actor = await getSmartPagesActor(creatorId);
  const doc = await loadOwnedSmartDocument(db, actor, documentId);
  const activeVersion = await resolveActiveVersion(db, documentId, doc.activeVersionId);
  if (!activeVersion) throw Object.assign(new Error("Generate a document first before publishing."), { status: 400 });

  const token = randomUUID().replace(/-/g, "").slice(0, 16);
  const expiresAt = options.expiresInDays
    ? new Date(Date.now() + options.expiresInDays * 86_400_000)
    : null;
  const passwordHash = options.password ? await bcrypt.hash(options.password, 10) : null;

  await db.publishedDocument.upsert({
    where: { documentId },
    update: { token, expiresAt, passwordHash, updatedAt: new Date() },
    create: { id: randomUUID(), documentId, token, expiresAt, passwordHash },
  });

  await db.smartDocument.update({ where: { id: documentId }, data: { status: "PUBLISHED" } });
  await upsertSearchIndex(creatorId, "PUBLISHED_PAGE", documentId, doc.title, doc.title, { token, documentId });
  await incrementDocumentAnalytics(documentId, { shares: 1 });
  await createNotification(creatorId, "DOCUMENT_PUBLISHED", "Document published", `${doc.title} is available at its public link.`);
  await executeWorkflows(creatorId, "PUBLISH_COMPLETED", { documentId, token, title: doc.title });
  await writeSmartPagesAudit(actor, "SMART_DOCUMENT_PUBLISHED", documentId, {
    documentId,
    token,
    title: doc.title,
  });

  const origin = process.env.CLIENT_ORIGIN ?? "http://localhost:5173";
  return { token, url: `${origin}/p/${token}` };
}

// ── Public document fetch ──────────────────────────────────────────────────────

export async function getPublishedDocument(
  token: string,
  password?: string,
): Promise<{ document: SmartDocumentDetail; publishedAt: string } | null | "PASSWORD_REQUIRED" | "WRONG_PASSWORD"> {
  const db = prisma as any;
  const resolved = await resolvePublishedDocumentByToken(token, password);
  if (resolved === null || resolved === "PASSWORD_REQUIRED" || resolved === "WRONG_PASSWORD") return resolved;
  const { published, document: doc } = resolved;
  const activeVersion = await resolveActiveVersion(db, doc.id, doc.activeVersionId);
  const detail = rowToDetail(doc, activeVersion, 0);

  return { document: detail, publishedAt: (published.createdAt as Date).toISOString() };
}

export async function downloadPublishedDocumentPdf(
  token: string,
  password?: string,
): Promise<{ contentType: string; body: Buffer; filename: string } | null | "PASSWORD_REQUIRED" | "WRONG_PASSWORD"> {
  const resolved = await resolvePublishedDocumentByToken(token, password);
  if (resolved === null || resolved === "PASSWORD_REQUIRED" || resolved === "WRONG_PASSWORD") return resolved;
  const { published, document: doc } = resolved;
  const activeVersion = await resolveActiveVersion(db, doc.id, doc.activeVersionId);
  if (!activeVersion) throw Object.assign(new Error("Document has no active version."), { status: 400 });
  await db.publishedDocument.update({
    where: { token },
    data: { downloadCount: { increment: 1 } },
  });
  await incrementDocumentAnalytics(published.documentId as string, { downloads: 1 });
  return {
    contentType: "application/pdf",
    body: renderSchemaToPdf(doc.title, activeVersion.schema as DocumentSchema, activeVersion.componentTree as ComponentNode[]),
    filename: `${slug(doc.title)}.pdf`,
  };
}

async function resolvePublishedDocumentByToken(
  token: string,
  password?: string,
): Promise<
  | { published: any; document: any }
  | null
  | "PASSWORD_REQUIRED"
  | "WRONG_PASSWORD"
> {
  const db = prisma as any;
  const published = await db.publishedDocument.findUnique({
    where: { token },
    include: { document: true },
  });

  if (!published) return null;
  if (published.expiresAt && new Date(published.expiresAt as Date) < new Date()) return null;

  if (published.passwordHash) {
    if (!password) return "PASSWORD_REQUIRED";
    const valid = await bcrypt.compare(password, published.passwordHash as string);
    if (!valid) return "WRONG_PASSWORD";
  }

  await db.publishedDocument.update({
    where: { token },
    data: { viewCount: { increment: 1 } },
  });
  await incrementDocumentAnalytics(published.documentId as string, { views: 1, visitors: 1 });

  return { published, document: published.document };
}

function wantsFitToOnePage(instruction: string): boolean {
  return /\b(fit|make|compress|keep)\b.*\b(one page|1 page|single page|print)\b/i.test(instruction)
    || /\bfit on one page\b/i.test(instruction)
    || /\bcompress for print\b/i.test(instruction);
}

function renderSettingsForIntent(instruction: string): Record<string, unknown> {
  if (!wantsFitToOnePage(instruction)) return {};
  return { fitToOnePage: true, compact: true, fontScale: 0.9, spacing: "compact" };
}

function compactSchemaForPrint(schema: DocumentSchema): DocumentSchema {
  return {
    ...schema,
    theme: {
      ...schema.theme,
      pageSize: schema.theme?.pageSize ?? "A4",
      orientation: schema.theme?.orientation ?? "PORTRAIT",
    },
  };
}

function compactComponentsForPrint(components: ComponentNode[]): ComponentNode[] {
  return components.map((component) => {
    if ((component.type === "textBlock" || component.type === "aiSummary") && typeof component.props.content === "string") {
      return {
        ...component,
        props: {
          ...component.props,
          content: shortenText(component.props.content, 420),
        },
      };
    }
    return component;
  });
}

function shortenText(value: unknown, limit: number): string {
  const text = String(value ?? "").trim();
  if (text.length <= limit) return text;
  const shortened = text.slice(0, limit);
  return `${shortened.slice(0, shortened.lastIndexOf(" ") > 120 ? shortened.lastIndexOf(" ") : limit).trim()}...`;
}

