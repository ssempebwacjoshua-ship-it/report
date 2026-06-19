import { randomUUID } from "node:crypto";
import { prisma } from "../db/prisma";
import { renderSchemaToHtml } from "./documentRenderService";
import { pickAgent, runAgent, type AgentDomain } from "./agentRegistry";
import {
  assistSearchRanking,
  classifyDocumentSchema,
  rewriteDocumentTone,
  summarizeDocumentSchema,
  suggestWorkflow,
  translateDocumentSchema,
} from "./documentGeminiService";
import { renderSchemaToDocx, renderSchemaToMarkdown, renderSchemaToPdf } from "./documentExportService";
import type { ComponentNode, DocumentSchema, ExtractedKnowledge } from "../../shared/types/documentIntelligence";

const db = prisma as any;

type SmartPagesActor = {
  id: string;
  type: "SCHOOL_OPERATOR" | "EXTERNAL";
  email: string;
  name: string;
  schoolId: string | null;
};

async function getSmartPagesActor(creatorId: string): Promise<SmartPagesActor> {
  const creator = await db.creator.findUnique({
    where: { id: creatorId },
    select: { id: true, type: true, email: true, name: true, schoolId: true, isActive: true },
  });
  if (!creator || !creator.isActive) throw Object.assign(new Error("Creator not found."), { status: 404 });
  return {
    id: creator.id,
    type: creator.type as SmartPagesActor["type"],
    email: creator.email,
    name: creator.name,
    schoolId: creator.schoolId ?? null,
  };
}

async function loadOwnedSmartDocument(actor: SmartPagesActor, documentId: string) {
  const doc = await db.smartDocument.findUnique({ where: { id: documentId } });
  if (!doc) throw Object.assign(new Error("Document not found."), { status: 404 });

  const schoolOwned = actor.type === "SCHOOL_OPERATOR" && actor.schoolId
    ? doc.schoolId === actor.schoolId
    : false;
  const legacyOwned = doc.schoolId == null && doc.creatorId === actor.id;
  const creatorOwned = actor.type === "EXTERNAL" && doc.creatorId === actor.id && doc.schoolId == null;

  if (!schoolOwned && !legacyOwned && !creatorOwned) {
    throw Object.assign(new Error("You do not have access to this document."), { status: 403 });
  }

  return doc;
}

export type WorkflowTrigger = "COLLECTION_IMPORTED" | "RECORD_ADDED" | "DOCUMENT_CREATED" | "BULK_GENERATION_COMPLETED" | "PUBLISH_COMPLETED";
export type WorkflowAction = "GENERATE_DOCUMENT" | "PUBLISH_DOCUMENT" | "EXPORT_PDF" | "NOTIFY_CREATOR" | "SEND_EMAIL";
export type SearchEntityType = "DOCUMENT" | "COLLECTION" | "RECORD" | "VERSION" | "PUBLISHED_PAGE";
export type ExportFormat = "html" | "print" | "markdown" | "schema" | "pdf" | "docx";

const actionAliases: Record<string, WorkflowAction> = {
  GENERATE_DOCUMENT: "GENERATE_DOCUMENT",
  PUBLISH: "PUBLISH_DOCUMENT",
  PUBLISH_DOCUMENT: "PUBLISH_DOCUMENT",
  EXPORT_PDF: "EXPORT_PDF",
  NOTIFY: "NOTIFY_CREATOR",
  NOTIFY_CREATOR: "NOTIFY_CREATOR",
  EMAIL: "SEND_EMAIL",
  SEND_EMAIL: "SEND_EMAIL",
};

const triggerAliases: Record<string, WorkflowTrigger> = {
  COLLECTION_IMPORTED: "COLLECTION_IMPORTED",
  RECORD_ADDED: "RECORD_ADDED",
  DOCUMENT_CREATED: "DOCUMENT_CREATED",
  BULK_JOB_COMPLETED: "BULK_GENERATION_COMPLETED",
  BULK_GENERATION_COMPLETED: "BULK_GENERATION_COMPLETED",
  PUBLISH_COMPLETED: "PUBLISH_COMPLETED",
};

export async function listPreferences(creatorId: string, scope?: "school" | "lawyer") {
  const rows = await db.creatorPreference.findMany({ where: { creatorId }, orderBy: { key: "asc" } });
  const filtered = scope === "school"
    ? rows.filter((row: any) => !String(row.key).toLowerCase().startsWith("lawyer."))
    : scope === "lawyer"
      ? rows.filter((row: any) => String(row.key).toLowerCase().startsWith("lawyer."))
      : rows;
  return filtered.map((row: any) => ({ id: row.id, key: row.key, value: row.value, updatedAt: row.updatedAt.toISOString() }));
}

export async function preferenceMap(creatorId: string): Promise<Record<string, unknown>> {
  const rows = await db.creatorPreference.findMany({ where: { creatorId } });
  return Object.fromEntries(rows.map((row: any) => [row.key, row.value]));
}

export async function upsertPreference(creatorId: string, key: string, value: unknown) {
  const row = await db.creatorPreference.upsert({
    where: { creatorId_key: { creatorId, key } },
    update: { value: value as any },
    create: { id: randomUUID(), creatorId, key, value: value as any },
  });
  return { id: row.id, key: row.key, value: row.value, updatedAt: row.updatedAt.toISOString() };
}

export async function deletePreference(creatorId: string, key: string): Promise<void> {
  await db.creatorPreference.deleteMany({ where: { creatorId, key } });
}

export async function listWorkflows(creatorId: string) {
  const rows = await db.automationWorkflow.findMany({ where: { creatorId }, orderBy: { updatedAt: "desc" } });
  return rows.map(workflowRow);
}

export async function createWorkflow(
  creatorId: string,
  input: { name: string; trigger: string; actions: Array<{ type: string; config?: Record<string, unknown> }>; isActive?: boolean; enabled?: boolean },
) {
  const trigger = normalizeTrigger(input.trigger);
  const actions = input.actions.map((action) => ({ ...action, type: normalizeAction(action.type) }));
  const row = await db.automationWorkflow.create({
    data: {
      id: randomUUID(),
      creatorId,
      name: input.name,
      trigger,
      actions: actions as any,
      isActive: input.enabled ?? input.isActive ?? true,
    },
  });
  return workflowRow(row);
}

export async function updateWorkflow(
  creatorId: string,
  id: string,
  input: Partial<{ name: string; trigger: string; actions: Array<{ type: string; config?: Record<string, unknown> }>; isActive: boolean; enabled: boolean }>,
) {
  const row = await db.automationWorkflow.updateMany({
    where: { id, creatorId },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.trigger !== undefined ? { trigger: normalizeTrigger(input.trigger) } : {}),
      ...(input.actions !== undefined ? { actions: input.actions.map((action) => ({ ...action, type: normalizeAction(action.type) })) as any } : {}),
      ...(input.enabled !== undefined || input.isActive !== undefined ? { isActive: input.enabled ?? input.isActive } : {}),
    },
  });
  if (row.count === 0) throw Object.assign(new Error("Workflow not found."), { status: 404 });
  const updated = await db.automationWorkflow.findFirst({ where: { id, creatorId } });
  return workflowRow(updated);
}

export async function deleteWorkflow(creatorId: string, id: string): Promise<void> {
  await db.automationWorkflow.deleteMany({ where: { id, creatorId } });
}

export async function createNotification(creatorId: string, type: string, title: string, message: string) {
  const row = await db.notification.create({ data: { id: randomUUID(), creatorId, type, title, message } });
  return notificationRow(row);
}

export async function listNotifications(creatorId: string, includeRead = false) {
  const rows = await db.notification.findMany({
    where: { creatorId, ...(includeRead ? {} : { readAt: null }) },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return rows.map(notificationRow);
}

export async function markNotificationRead(creatorId: string, id: string) {
  await db.notification.updateMany({ where: { id, creatorId }, data: { readAt: new Date() } });
}

export async function upsertSearchIndex(creatorId: string, entityType: SearchEntityType, entityId: string, title: string | null, searchableText: string, metadata?: Record<string, unknown>) {
  await db.searchIndex.upsert({
    where: { entityType_entityId: { entityType, entityId } },
    update: { creatorId, title, searchableText, metadata: metadata as any },
    create: { id: randomUUID(), creatorId, entityType, entityId, title, searchableText, metadata: metadata as any },
  });
}

export async function removeSearchIndex(entityType: SearchEntityType, entityId: string) {
  await db.searchIndex.deleteMany({ where: { entityType, entityId } });
}

export async function reindexCreatorContent(creatorId: string): Promise<{ count: number }> {
  let count = 0;
  const docs = await db.smartDocument.findMany({
    where: { creatorId },
    include: {
      versions: { orderBy: { createdAt: "desc" }, take: 3 },
      published: true,
    },
  });
  for (const doc of docs) {
    await upsertSearchIndex(creatorId, "DOCUMENT", doc.id, doc.title, [
      doc.title,
      JSON.stringify(doc.extractedKnowledge ?? {}),
      doc.status,
    ].join("\n"), { status: doc.status });
    count += 1;
    for (const version of doc.versions) {
      await upsertSearchIndex(creatorId, "VERSION", version.id, doc.title, [
        version.instruction ?? "",
        JSON.stringify(version.schema ?? {}),
        JSON.stringify(version.componentTree ?? {}),
      ].join("\n"), { documentId: doc.id });
      count += 1;
    }
    if (doc.published) {
      await upsertSearchIndex(creatorId, "PUBLISHED_PAGE", doc.published.id, doc.title, doc.title, { token: doc.published.token, documentId: doc.id });
      count += 1;
    }
  }

  const collections = await db.collection.findMany({ where: { creatorId }, include: { records: { take: 100 } } });
  for (const collection of collections) {
    await upsertSearchIndex(creatorId, "COLLECTION", collection.id, collection.name, `${collection.name}\n${collection.type}`, { type: collection.type });
    count += 1;
    for (const record of collection.records) {
      await upsertSearchIndex(creatorId, "RECORD", record.id, collection.name, JSON.stringify(record.data), { collectionId: collection.id });
      count += 1;
    }
  }
  return { count };
}

export async function searchCreatorContent(creatorId: string, query: string, entityType?: SearchEntityType) {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  const rows = await db.searchIndex.findMany({
    where: { creatorId, ...(entityType ? { entityType } : {}) },
    orderBy: { updatedAt: "desc" },
    take: 500,
  });
  const ranked = rows
    .map((row: any) => {
      const haystack = `${row.title ?? ""}\n${row.searchableText}`.toLowerCase();
      const score = terms.reduce((sum, term) => sum + (haystack.includes(term) ? 1 : 0), 0);
      return { row, score };
    })
    .filter((item: any) => item.score > 0 || terms.length === 0)
    .sort((a: any, b: any) => b.score - a.score)
    .slice(0, 50)
    .map(({ row, score }: any) => ({
      id: row.id,
      entityType: row.entityType,
      entityId: row.entityId,
      title: row.title,
      snippet: row.searchableText.slice(0, 220),
      metadata: row.metadata,
      score,
      updatedAt: row.updatedAt.toISOString(),
    }));
  if (terms.length < 2 || ranked.length < 2 || !process.env.GEMINI_API_KEY) return ranked;
  try {
    const assisted = await assistSearchRanking({
      query,
      results: ranked.slice(0, 20).map((result: any) => ({
        id: result.id,
        entityType: result.entityType,
        title: result.title,
        snippet: result.snippet,
        score: result.score,
      })),
    });
    const order = new Map(assisted.rankedIds.map((id, index) => [id, index]));
    return ranked.sort((a: any, b: any) => (order.get(a.id) ?? 999) - (order.get(b.id) ?? 999));
  } catch {
    return ranked;
  }
}

export async function runDocumentAgent(creatorId: string, input: { domain?: AgentDomain; instruction: string; documentId?: string }) {
  const actor = await getSmartPagesActor(creatorId);
  const doc = input.documentId
    ? await loadOwnedSmartDocument(actor, input.documentId)
    : null;
  const active = doc ? await resolveActiveVersion(doc.id, doc.activeVersionId) : null;
  const knowledge = doc?.extractedKnowledge as ExtractedKnowledge | null | undefined;
  const agent = input.domain ? pickAgent(input.domain) : pickAgent(knowledge?.domain);
  return runAgent(agent, input.instruction, {
    knowledge,
    schema: active?.schema as DocumentSchema | null | undefined,
    preferences: await preferenceMap(creatorId),
  });
}

export async function translateDocument(creatorId: string, documentId: string, language: "Arabic" | "French" | "Swahili" | "Spanish") {
  const actor = await getSmartPagesActor(creatorId);
  const doc = await loadOwnedSmartDocument(actor, documentId);
  const active = await resolveActiveVersion(documentId, doc.activeVersionId);
  if (!active) throw Object.assign(new Error("Document has no active version."), { status: 400 });
  const translated = await translateDocumentSchema(active.schema as DocumentSchema, language);
  const version = await db.documentVersion.create({
    data: {
      id: randomUUID(),
      documentId,
      parentId: active.id,
      instruction: `Translate to ${language}`,
      schema: translated.schema as any,
      componentTree: translated.componentTree as any,
    },
  });
  await db.smartDocument.update({ where: { id: documentId }, data: { activeVersionId: version.id } });
  await createNotification(creatorId, "TRANSLATION_CREATED", "Translation created", `${doc.title} was translated to ${language}.`);
  await upsertSearchIndex(creatorId, "VERSION", version.id, doc.title, JSON.stringify(translated.schema), { documentId, language });
  return { versionId: version.id as string, schema: translated.schema, componentTree: translated.componentTree };
}

export async function exportDocument(creatorId: string, documentId: string, format: ExportFormat) {
  const actor = await getSmartPagesActor(creatorId);
  const doc = await loadOwnedSmartDocument(actor, documentId);
  const active = await resolveActiveVersion(documentId, doc.activeVersionId);
  if (!active) throw Object.assign(new Error("Document has no active version."), { status: 400 });
  const schema = active.schema as DocumentSchema;
  const components = active.componentTree as ComponentNode[];
  if (format === "html" || format === "print") {
    return { contentType: "text/html; charset=utf-8", body: renderSchemaToHtml(schema, components, doc.title, active.renderSettings as any), filename: `${slug(doc.title)}.html` };
  }
  if (format === "schema") {
    return { contentType: "application/json; charset=utf-8", body: JSON.stringify(schema, null, 2), filename: `${slug(doc.title)}.json` };
  }
  if (format === "markdown") {
    await incrementDocumentAnalytics(documentId, { downloads: 1 });
    await createNotification(creatorId, "EXPORT_COMPLETED", "Markdown export ready", `${doc.title} was exported as Markdown.`);
    return { contentType: "text/markdown; charset=utf-8", body: renderSchemaToMarkdown(doc.title, components), filename: `${slug(doc.title)}.md` };
  }
  if (format === "pdf") {
    await incrementDocumentAnalytics(documentId, { downloads: 1 });
    await createNotification(creatorId, "EXPORT_COMPLETED", "PDF export ready", `${doc.title} was exported as PDF.`);
    return { contentType: "application/pdf", body: renderSchemaToPdf(doc.title, schema, components), filename: `${slug(doc.title)}.pdf` };
  }
  if (format === "docx") {
    await incrementDocumentAnalytics(documentId, { downloads: 1 });
    await createNotification(creatorId, "EXPORT_COMPLETED", "DOCX export ready", `${doc.title} was exported as DOCX.`);
    return {
      contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      body: renderSchemaToDocx(doc.title, components),
      filename: `${slug(doc.title)}.docx`,
    };
  }
  throw Object.assign(new Error(`Unsupported export format: ${format}.`), { status: 400 });
}

export async function analyticsSummary(creatorId: string) {
  const docs = await db.smartDocument.findMany({
    where: { creatorId },
    include: { analytics: true, _count: { select: { versions: true } }, published: true },
    orderBy: { updatedAt: "desc" },
    take: 100,
  });
  const rows = docs.map((doc: any) => ({
    documentId: doc.id,
    title: doc.title,
    status: doc.status,
    views: doc.analytics?.views ?? doc.published?.viewCount ?? 0,
    downloads: doc.analytics?.downloads ?? doc.published?.downloadCount ?? 0,
    shares: doc.analytics?.shares ?? 0,
    visitors: doc.analytics?.visitors ?? 0,
    versionCount: doc._count.versions,
    updatedAt: doc.updatedAt.toISOString(),
  }));
  return {
    totals: {
      documents: rows.length,
      publishedDocuments: rows.filter((row: any) => row.status === "PUBLISHED").length,
      views: rows.reduce((sum: number, row: any) => sum + row.views, 0),
      downloads: rows.reduce((sum: number, row: any) => sum + row.downloads, 0),
      shares: rows.reduce((sum: number, row: any) => sum + row.shares, 0),
    },
    mostViewed: [...rows].sort((a, b) => b.views - a.views).slice(0, 10),
    mostDownloaded: [...rows].sort((a, b) => b.downloads - a.downloads).slice(0, 10),
    mostActiveCollections: await mostActiveCollections(creatorId),
  };
}

export async function incrementDocumentAnalytics(
  documentId: string,
  delta: { views?: number; downloads?: number; shares?: number; visitors?: number },
) {
  await db.documentAnalytics.upsert({
    where: { documentId },
    update: {
      ...(delta.views ? { views: { increment: delta.views }, lastViewedAt: new Date() } : {}),
      ...(delta.downloads ? { downloads: { increment: delta.downloads } } : {}),
      ...(delta.shares ? { shares: { increment: delta.shares } } : {}),
      ...(delta.visitors ? { visitors: { increment: delta.visitors } } : {}),
    },
    create: {
      id: randomUUID(),
      documentId,
      views: delta.views ?? 0,
      downloads: delta.downloads ?? 0,
      shares: delta.shares ?? 0,
      visitors: delta.visitors ?? 0,
      lastViewedAt: delta.views ? new Date() : null,
    },
  });
}

export async function executeWorkflows(
  creatorId: string,
  trigger: WorkflowTrigger | string,
  context: Record<string, unknown> = {},
) {
  const normalizedTrigger = normalizeTrigger(trigger);
  const workflows = await db.automationWorkflow.findMany({
    where: { creatorId, trigger: normalizedTrigger, isActive: true },
    orderBy: { createdAt: "asc" },
  });
  const results: Array<{ workflowId: string; actionCount: number; errors: string[] }> = [];
  for (const workflow of workflows) {
    const errors: string[] = [];
    const actions = Array.isArray(workflow.actions) ? workflow.actions : [];
    for (const action of actions) {
      try {
        await executeWorkflowAction(creatorId, normalizeAction(action.type), action.config ?? {}, context);
      } catch (error) {
        errors.push(error instanceof Error ? error.message : String(error));
      }
    }
    await db.automationWorkflow.update({ where: { id: workflow.id }, data: { lastRunAt: new Date() } });
    await createNotification(
      creatorId,
      errors.length ? "WORKFLOW_FINISHED_WITH_ERRORS" : "WORKFLOW_FINISHED",
      errors.length ? "Workflow finished with errors" : "Workflow finished",
      `${workflow.name} ran ${actions.length} action${actions.length === 1 ? "" : "s"}.`,
    );
    results.push({ workflowId: workflow.id, actionCount: actions.length, errors });
  }
  return results;
}

export async function summarizeDocument(creatorId: string, documentId: string) {
  const { doc, active } = await getOwnedActiveVersion(creatorId, documentId);
  const result = await summarizeDocumentSchema(active.schema as DocumentSchema);
  await createNotification(creatorId, "DOCUMENT_SUMMARIZED", "Document summarized", `${doc.title} summary is ready.`);
  return result;
}

export async function classifyDocument(creatorId: string, documentId: string) {
  const { doc, active } = await getOwnedActiveVersion(creatorId, documentId);
  const result = await classifyDocumentSchema(active.schema as DocumentSchema);
  await createNotification(creatorId, "DOCUMENT_CLASSIFIED", "Document classified", `${doc.title} was classified as ${result.documentType}.`);
  return result;
}

export async function rewriteDocumentToneVersion(creatorId: string, documentId: string, tone: string) {
  const { doc, active } = await getOwnedActiveVersion(creatorId, documentId);
  const rewritten = await rewriteDocumentTone(active.schema as DocumentSchema, tone);
  const version = await db.documentVersion.create({
    data: {
      id: randomUUID(),
      documentId,
      parentId: active.id,
      instruction: `Rewrite tone: ${tone}`,
      schema: rewritten.schema as any,
      componentTree: rewritten.componentTree as any,
    },
  });
  await db.smartDocument.update({ where: { id: documentId }, data: { activeVersionId: version.id } });
  await createNotification(creatorId, "TONE_REWRITE_CREATED", "Tone rewrite created", `${doc.title} was rewritten in a ${tone} tone.`);
  await upsertSearchIndex(creatorId, "VERSION", version.id, doc.title, JSON.stringify(rewritten.schema), { documentId, tone });
  return { versionId: version.id as string, schema: rewritten.schema, componentTree: rewritten.componentTree };
}

export async function suggestAutomationWorkflow(creatorId: string, context: unknown = {}) {
  return suggestWorkflow({ creatorPreferences: await preferenceMap(creatorId), context });
}

async function executeWorkflowAction(
  creatorId: string,
  actionType: WorkflowAction,
  config: Record<string, unknown>,
  context: Record<string, unknown>,
) {
  const documentId = String(config.documentId ?? context.documentId ?? "");
  const collectionId = String(config.collectionId ?? context.collectionId ?? "");
  if (actionType === "NOTIFY_CREATOR") {
    await createNotification(
      creatorId,
      String(config.type ?? "AUTOMATION_NOTICE"),
      String(config.title ?? "Automation update"),
      String(config.message ?? "An automation workflow ran successfully."),
    );
    return;
  }
  if (actionType === "SEND_EMAIL") {
    await createNotification(creatorId, "EMAIL_QUEUED_FUTURE", "Email action recorded", "Email sending is reserved for a future delivery provider.");
    return;
  }
  if (actionType === "EXPORT_PDF" && documentId) {
    await exportDocument(creatorId, documentId, "pdf");
    return;
  }
  if (actionType === "PUBLISH_DOCUMENT" && documentId) {
    await publishOwnedDocument(creatorId, documentId, config);
    return;
  }
  if (actionType === "GENERATE_DOCUMENT" && collectionId) {
    const intent = String(config.intent ?? context.intent ?? "Generate documents from this collection.");
    const bulk = await import("./bulkGenerationService");
    await bulk.createBulkJob(creatorId, collectionId, intent);
    return;
  }
}

async function publishOwnedDocument(creatorId: string, documentId: string, config: Record<string, unknown>) {
  const actor = await getSmartPagesActor(creatorId);
  const doc = await loadOwnedSmartDocument(actor, documentId);
  const token = randomUUID().replace(/-/g, "").slice(0, 16);
  const expiresInDays = Number(config.expiresInDays ?? 0);
  const expiresAt = Number.isFinite(expiresInDays) && expiresInDays > 0
    ? new Date(Date.now() + expiresInDays * 86_400_000)
    : null;
  await db.publishedDocument.upsert({
    where: { documentId },
    update: { token, expiresAt, updatedAt: new Date() },
    create: { id: randomUUID(), documentId, token, expiresAt },
  });
  await db.smartDocument.update({ where: { id: documentId }, data: { status: "PUBLISHED" } });
  await incrementDocumentAnalytics(documentId, { shares: 1 });
  await upsertSearchIndex(creatorId, "PUBLISHED_PAGE", documentId, doc.title, doc.title, { token, documentId });
  await createNotification(creatorId, "DOCUMENT_PUBLISHED", "Document published", `${doc.title} was published by automation.`);
}

async function getOwnedActiveVersion(creatorId: string, documentId: string) {
  const actor = await getSmartPagesActor(creatorId);
  const doc = await loadOwnedSmartDocument(actor, documentId);
  const active = await resolveActiveVersion(documentId, doc.activeVersionId);
  if (!active) throw Object.assign(new Error("Document has no active version."), { status: 400 });
  return { doc, active };
}

async function mostActiveCollections(creatorId: string) {
  const rows = await db.collection.findMany({
    where: { creatorId },
    include: { _count: { select: { records: true, bulkJobs: true } } },
    orderBy: { updatedAt: "desc" },
    take: 50,
  });
  return rows
    .map((row: any) => ({
      collectionId: row.id,
      name: row.name,
      recordCount: row._count.records,
      bulkJobCount: row._count.bulkJobs,
      activityScore: row._count.records + row._count.bulkJobs * 5,
      updatedAt: row.updatedAt.toISOString(),
    }))
    .sort((a: any, b: any) => b.activityScore - a.activityScore)
    .slice(0, 10);
}

async function resolveActiveVersion(documentId: string, activeVersionId: string | null) {
  if (activeVersionId) return db.documentVersion.findUnique({ where: { id: activeVersionId } });
  return db.documentVersion.findFirst({ where: { documentId }, orderBy: { createdAt: "desc" } });
}

function workflowRow(row: any) {
  return {
    id: row.id,
    name: row.name,
    trigger: row.trigger,
    actions: row.actions,
    isActive: row.isActive,
    enabled: row.isActive,
    lastRunAt: row.lastRunAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function notificationRow(row: any) {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    message: row.message,
    readAt: row.readAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

function slug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "document";
}

function normalizeTrigger(trigger: string): WorkflowTrigger {
  const normalized = triggerAliases[trigger];
  if (!normalized) throw Object.assign(new Error(`Unsupported workflow trigger: ${trigger}.`), { status: 400 });
  return normalized;
}

function normalizeAction(action: string): WorkflowAction {
  const normalized = actionAliases[action];
  if (!normalized) throw Object.assign(new Error(`Unsupported workflow action: ${action}.`), { status: 400 });
  return normalized;
}

