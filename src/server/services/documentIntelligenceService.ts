import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { prisma } from "../db/prisma";
import {
  extractDocumentKnowledge,
  generateDocumentSchema,
  applyPromptToSchema,
} from "./documentGeminiService";
import type {
  SmartDocumentDetail,
  SmartDocumentSummary,
  DocumentVersionSummary,
  DocumentSchema,
  ComponentNode,
  ExtractedKnowledge,
  ActiveVersionSnapshot,
} from "../../shared/types/documentIntelligence";

// ── Creator helpers ────────────────────────────────────────────────────────────

export async function findOrCreateSchoolOperatorCreator(
  schoolId: string,
  email: string,
  name: string,
): Promise<string> {
  const db = prisma as any;
  const existing = await db.creator.findFirst({ where: { schoolId } });
  if (existing) return existing.id as string;

  // Also check by email in case a prior create attempt left an orphan row
  const byEmail = await db.creator.findFirst({ where: { email } });
  if (byEmail) {
    // Adopt this creator for the school
    if (!byEmail.schoolId) {
      await db.creator.update({ where: { id: byEmail.id }, data: { schoolId, type: "SCHOOL_OPERATOR" } });
    }
    return byEmail.id as string;
  }

  const created = await db.creator.create({
    data: { id: randomUUID(), type: "SCHOOL_OPERATOR", email, name, schoolId },
  });
  return created.id as string;
}

export async function findCreatorById(creatorId: string) {
  return (prisma as any).creator.findUnique({ where: { id: creatorId } });
}

// ── Document list ──────────────────────────────────────────────────────────────

export async function listDocuments(creatorId: string): Promise<SmartDocumentSummary[]> {
  const db = prisma as any;
  const docs = await db.smartDocument.findMany({
    where: { creatorId },
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
  const doc = await db.smartDocument.create({
    data: { id: randomUUID(), creatorId, title, status: "DRAFT" },
  });
  return rowToDetail(doc, null, 0);
}

// ── Get document ───────────────────────────────────────────────────────────────

export async function getDocument(documentId: string, creatorId: string): Promise<SmartDocumentDetail | null> {
  const db = prisma as any;
  const doc = await db.smartDocument.findFirst({
    where: { id: documentId, creatorId },
    include: {
      _count: { select: { versions: true } },
      published: { select: { token: true } },
    },
  });
  if (!doc) return null;

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
        createdAt: (version.createdAt as Date).toISOString(),
      }
    : null;

  return {
    id: doc.id as string,
    title: doc.title as string,
    status: doc.status as string,
    domain: knowledge?.domain,
    createdAt: (doc.createdAt as Date).toISOString(),
    updatedAt: (doc.updatedAt as Date).toISOString(),
    versionCount,
    hasSourceFiles: false,
    publishToken: (doc.published?.token as string) ?? undefined,
    extractedKnowledge: knowledge,
    activeVersion,
  };
}

// ── Upload + extract ───────────────────────────────────────────────────────────

export async function uploadAndExtract(
  documentId: string,
  creatorId: string,
  file: Express.Multer.File,
): Promise<{ knowledge: ExtractedKnowledge; sourceFileId: string }> {
  const db = prisma as any;
  const doc = await db.smartDocument.findFirst({ where: { id: documentId, creatorId } });
  if (!doc) throw Object.assign(new Error("Document not found."), { status: 404 });

  const knowledge = await extractDocumentKnowledge(file.buffer, file.mimetype, file.originalname);

  const sourceFile = await db.documentSourceFile.create({
    data: {
      id: randomUUID(),
      documentId,
      originalName: file.originalname,
      mimeType: file.mimetype,
      sizeBytes: file.size,
      extractedContent: knowledge as any,
    },
  });

  const needsTitleUpdate = !doc.title || doc.title === "Untitled Document";
  await db.smartDocument.update({
    where: { id: documentId },
    data: {
      extractedKnowledge: knowledge as any,
      ...(needsTitleUpdate && knowledge.title ? { title: knowledge.title } : {}),
    },
  });

  return { knowledge, sourceFileId: sourceFile.id as string };
}

// ── Generate schema ────────────────────────────────────────────────────────────

export async function generateSchema(
  documentId: string,
  creatorId: string,
  intent: string,
): Promise<{ versionId: string; schema: DocumentSchema; componentTree: ComponentNode[] }> {
  const db = prisma as any;
  const doc = await db.smartDocument.findFirst({ where: { id: documentId, creatorId } });
  if (!doc) throw Object.assign(new Error("Document not found."), { status: 404 });

  const knowledge = doc.extractedKnowledge as ExtractedKnowledge | null;
  if (!knowledge) throw Object.assign(new Error("Upload a file first to extract content."), { status: 400 });

  const { schema, componentTree } = await generateDocumentSchema(knowledge, intent);

  const version = await db.documentVersion.create({
    data: {
      id: randomUUID(),
      documentId,
      instruction: intent,
      schema: schema as any,
      componentTree: componentTree as any,
    },
  });

  await db.smartDocument.update({ where: { id: documentId }, data: { activeVersionId: version.id } });

  return { versionId: version.id as string, schema, componentTree };
}

// ── Apply conversational prompt ────────────────────────────────────────────────

export async function applyPrompt(
  documentId: string,
  creatorId: string,
  instruction: string,
): Promise<{ versionId: string; schema: DocumentSchema; componentTree: ComponentNode[] }> {
  const db = prisma as any;
  const doc = await db.smartDocument.findFirst({ where: { id: documentId, creatorId } });
  if (!doc) throw Object.assign(new Error("Document not found."), { status: 404 });

  const currentVersion = await resolveActiveVersion(db, documentId, doc.activeVersionId);
  if (!currentVersion) throw Object.assign(new Error("Generate a schema first."), { status: 400 });

  const currentSchema = currentVersion.schema as DocumentSchema;
  const { schema, componentTree } = await applyPromptToSchema(currentSchema, instruction);

  const version = await db.documentVersion.create({
    data: {
      id: randomUUID(),
      documentId,
      parentId: currentVersion.id,
      instruction,
      schema: schema as any,
      componentTree: componentTree as any,
    },
  });

  await db.smartDocument.update({ where: { id: documentId }, data: { activeVersionId: version.id } });

  return { versionId: version.id as string, schema, componentTree };
}

// ── Version history ────────────────────────────────────────────────────────────

export async function getVersionHistory(
  documentId: string,
  creatorId: string,
): Promise<DocumentVersionSummary[]> {
  const db = prisma as any;
  const doc = await db.smartDocument.findFirst({ where: { id: documentId, creatorId } });
  if (!doc) throw Object.assign(new Error("Document not found."), { status: 404 });

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
  const doc = await db.smartDocument.findFirst({ where: { id: documentId, creatorId } });
  if (!doc) throw Object.assign(new Error("Document not found."), { status: 404 });
  const version = await db.documentVersion.findFirst({ where: { id: versionId, documentId } });
  if (!version) throw Object.assign(new Error("Version not found."), { status: 404 });
  await db.smartDocument.update({ where: { id: documentId }, data: { activeVersionId: versionId } });
}

// ── Publish ────────────────────────────────────────────────────────────────────

export async function publishDocument(
  documentId: string,
  creatorId: string,
  options: { expiresInDays?: number; password?: string } = {},
): Promise<{ token: string; url: string }> {
  const db = prisma as any;
  const doc = await db.smartDocument.findFirst({ where: { id: documentId, creatorId } });
  if (!doc) throw Object.assign(new Error("Document not found."), { status: 404 });

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

  const origin = process.env.CLIENT_ORIGIN ?? "http://localhost:5173";
  return { token, url: `${origin}/p/${token}` };
}

// ── Public document fetch ──────────────────────────────────────────────────────

export async function getPublishedDocument(
  token: string,
  password?: string,
): Promise<{ document: SmartDocumentDetail; publishedAt: string } | null | "PASSWORD_REQUIRED" | "WRONG_PASSWORD"> {
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

  const doc = published.document;
  const activeVersion = await resolveActiveVersion(db, doc.id, doc.activeVersionId);
  const detail = rowToDetail(doc, activeVersion, 0);

  return { document: detail, publishedAt: (published.createdAt as Date).toISOString() };
}
