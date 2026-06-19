import { randomUUID } from "node:crypto";
import { prisma } from "../db/prisma";
import { generateBulkTemplate } from "./documentGeminiService";
import { createNotification, executeWorkflows, preferenceMap, upsertSearchIndex } from "./documentOsService";
import { calculateGenerateDocumentCredits, calculatePriceUgx, deductPagesInTransaction } from "./smartPagesService";

const db = prisma as any;

export interface BulkJobSummary {
  id: string;
  collectionId: string;
  collectionName: string;
  intent: string;
  status: string;
  totalRecords: number;
  processedRecords: number;
  failedRecords: number;
  progressPct: number;
  errorMessage: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

export interface BulkJobOutput {
  id: string;
  recordId: string;
  recordData: Record<string, unknown>;
  documentId: string | null;
  publishToken: string | null;
  status: string;
  error: string | null;
}

// ── Create job ─────────────────────────────────────────────────────────────────

export async function createBulkJob(
  creatorId: string,
  collectionId: string,
  intent: string,
): Promise<BulkJobSummary> {
  await ensureBulkGenerationAvailable();
  const collection = await db.collection.findFirst({
    where: { id: collectionId, creatorId },
    include: { records: { take: 5, orderBy: { sortOrder: "asc" } }, _count: { select: { records: true } } },
  });
  if (!collection) throw Object.assign(new Error("Collection not found."), { status: 404 });

  const totalRecords = collection._count.records;
  if (totalRecords === 0) throw Object.assign(new Error("Collection has no records."), { status: 400 });

  // Generate template from sample records
  const sampleData = collection.records.map((r: any) => r.data as Record<string, unknown>);
  const template = await generateBulkTemplate(sampleData, intent, collection.type, await preferenceMap(creatorId));

  const job = await db.bulkGenerationJob.create({
    data: {
      id: randomUUID(),
      creatorId,
      collectionId,
      intent,
      templateSchema: template as any,
      status: "PENDING",
      totalRecords,
    },
  });

  // Create PENDING output entries for all records
  const allRecords = await db.collectionRecord.findMany({
    where: { collectionId },
    orderBy: { sortOrder: "asc" },
    select: { id: true },
  });

  await db.bulkJobOutput.createMany({
    data: allRecords.map((r: any) => ({
      id: randomUUID(),
      jobId: job.id,
      recordId: r.id,
      status: "PENDING",
    })),
  });

  return jobToSummary(job, collection.name);
}

// ── Process a single job ───────────────────────────────────────────────────────

export async function processJob(jobId: string): Promise<void> {
  const job = await db.bulkGenerationJob.findUnique({ where: { id: jobId }, include: { collection: true } });
  if (!job || job.status !== "PENDING") return;

  await db.bulkGenerationJob.update({
    where: { id: jobId },
    data: { status: "PROCESSING", startedAt: new Date() },
  });

  const records = await db.collectionRecord.findMany({
    where: { collectionId: job.collectionId },
    orderBy: { sortOrder: "asc" },
  });

  const templateJson = JSON.stringify(job.templateSchema);

  for (const record of records) {
    try {
      const filledJson = fillTemplate(templateJson, record.data as Record<string, unknown>);
      const filledSchema = JSON.parse(filledJson) as { theme: unknown; components: unknown[] };
      const docTitle = deriveTitle(record.data as Record<string, unknown>, job.collection?.name ?? "Document");
      const token = randomUUID().replace(/-/g, "").slice(0, 16);
      const outputCreditCount = calculateGenerateDocumentCredits(1);
      const chargeKey = `bulk:${jobId}:${record.id}`;
      const result = await db.$transaction(async (tx: any) => {
        const doc = await tx.smartDocument.create({
          data: {
            id: randomUUID(),
            creatorId: job.creatorId,
            title: docTitle,
            extractedKnowledge: { source: "bulk_generation", jobId, recordId: record.id },
            status: "PUBLISHED",
          },
        });

        const version = await tx.documentVersion.create({
          data: {
            id: randomUUID(),
            documentId: doc.id,
            instruction: job.intent,
            schema: filledSchema as any,
            componentTree: (filledSchema.components ?? []) as any,
          },
        });

        await tx.smartDocument.update({
          where: { id: doc.id },
          data: { activeVersionId: version.id },
        });

        await tx.publishedDocument.create({
          data: { id: randomUUID(), documentId: doc.id, token },
        });

        if (job.creator?.schoolId) {
          await deductPagesInTransaction(tx, job.creator.schoolId, {
            jobId: version.id as string,
            fileHash: chargeKey,
            pagesCharged: outputCreditCount,
            creditsCharged: outputCreditCount,
            operation: "GENERATE_DOCUMENT",
            pagesProcessed: 1,
            priceUgx: calculatePriceUgx(outputCreditCount),
            extractionMode: "balanced",
            provider: "gemini",
            model: "",
            reason: "Bulk generation output",
            tokenUsage: null,
            geminiCostEstimateUgx: 0,
            marginEstimateUgx: calculatePriceUgx(outputCreditCount),
          });
        }

        return { doc, version };
      });

      await upsertSearchIndex(job.creatorId, "DOCUMENT", result.doc.id, docTitle, [
        docTitle,
        job.intent,
        JSON.stringify(record.data),
      ].join("\n"), { status: "PUBLISHED", jobId, recordId: record.id });
      await upsertSearchIndex(job.creatorId, "VERSION", result.version.id, docTitle, JSON.stringify(filledSchema), { documentId: result.doc.id });
      await upsertSearchIndex(job.creatorId, "PUBLISHED_PAGE", result.doc.id, docTitle, docTitle, { token, documentId: result.doc.id });

      await db.bulkJobOutput.updateMany({
        where: { jobId, recordId: record.id },
        data: { documentId: result.doc.id, publishToken: token, status: "DONE" },
      });

      await db.bulkGenerationJob.update({
        where: { id: jobId },
        data: { processedRecords: { increment: 1 } },
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await db.bulkJobOutput.updateMany({
        where: { jobId, recordId: record.id },
        data: { status: "FAILED", error: msg },
      });
      await db.bulkGenerationJob.update({
        where: { id: jobId },
        data: { failedRecords: { increment: 1 } },
      });
    }
  }

  const finalJob = await db.bulkGenerationJob.findUnique({ where: { id: jobId } });
  const hasFailed = finalJob.failedRecords > 0;
  const hasSuccess = finalJob.processedRecords > 0;
  const finalStatus = hasFailed ? (hasSuccess ? "PARTIAL" : "FAILED") : "COMPLETED";

  await db.bulkGenerationJob.update({
    where: { id: jobId },
    data: { status: finalStatus, completedAt: new Date() },
  });
  await createNotification(
    job.creatorId,
    "BULK_GENERATION_COMPLETED",
    "Bulk generation completed",
    `${job.collection?.name ?? "Collection"} finished with ${finalJob.processedRecords} generated and ${finalJob.failedRecords} failed.`,
  );
  await executeWorkflows(job.creatorId, "BULK_GENERATION_COMPLETED", {
    jobId,
    collectionId: job.collectionId,
    collectionName: job.collection?.name,
    status: finalStatus,
    processedRecords: finalJob.processedRecords,
    failedRecords: finalJob.failedRecords,
  });
}

// ── Polling worker ─────────────────────────────────────────────────────────────

let _workerRunning = false;
let _workerDisabledReason: string | null = null;

function isMissingBulkGenerationTableError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /BulkGenerationJob|BulkJobOutput/i.test(message) && /does not exist|not exist|P2021/i.test(message);
}

async function bulkGenerationTablesReady(): Promise<boolean> {
  try {
    const rows = await db.$queryRaw<Array<{ exists: string | null }>>`
      SELECT to_regclass('"BulkGenerationJob"')::text AS exists
    `;
    return rows[0]?.exists === "BulkGenerationJob";
  } catch (error) {
    if (isMissingBulkGenerationTableError(error)) return false;
    throw error;
  }
}

function unavailableError(): Error & { status: number } {
  return Object.assign(
    new Error("Bulk generation is unavailable until database migrations are applied."),
    { status: 503 },
  );
}

async function ensureBulkGenerationAvailable(): Promise<void> {
  if (_workerDisabledReason) throw unavailableError();
  const ready = await bulkGenerationTablesReady();
  if (!ready) {
    _workerDisabledReason = "BulkGenerationJob table is missing. Run `npx prisma migrate deploy` against this database.";
    throw unavailableError();
  }
}

export function startBulkGenerationWorker(): void {
  void bulkGenerationTablesReady()
    .then((ready) => {
      if (!ready) {
        _workerDisabledReason = "BulkGenerationJob table is missing. Run `npx prisma migrate deploy` against this database.";
        console.warn(`[bulk-worker] disabled: ${_workerDisabledReason}`);
      }
    })
    .catch((error) => {
      _workerDisabledReason = error instanceof Error ? error.message : String(error);
      console.warn("[bulk-worker] disabled: could not verify database schema:", _workerDisabledReason);
    });

  setInterval(async () => {
    if (_workerDisabledReason) return;
    if (_workerRunning) return;
    try {
      const job = await db.bulkGenerationJob.findFirst({
        where: { status: "PENDING" },
        orderBy: { createdAt: "asc" },
      });
      if (!job) return;
      _workerRunning = true;
      await processJob(job.id as string);
    } catch (e) {
      if (isMissingBulkGenerationTableError(e)) {
        _workerDisabledReason = "BulkGenerationJob table is missing. Run `npx prisma migrate deploy` against this database.";
        console.warn(`[bulk-worker] disabled: ${_workerDisabledReason}`);
        return;
      }
      console.error("[bulk-worker] error:", e instanceof Error ? e.message : e);
    } finally {
      _workerRunning = false;
    }
  }, 5_000);
}

// ── List jobs ──────────────────────────────────────────────────────────────────

export async function listBulkJobs(creatorId: string): Promise<BulkJobSummary[]> {
  await ensureBulkGenerationAvailable();
  const jobs = await db.bulkGenerationJob.findMany({
    where: { creatorId },
    orderBy: { createdAt: "desc" },
    include: { collection: { select: { name: true } } },
  });
  return jobs.map((j: any) => jobToSummary(j, j.collection?.name ?? "Unknown"));
}

export async function getBulkJobOutputs(
  jobId: string,
  creatorId: string,
): Promise<{ job: BulkJobSummary; outputs: BulkJobOutput[] }> {
  await ensureBulkGenerationAvailable();
  const job = await db.bulkGenerationJob.findFirst({
    where: { id: jobId, creatorId },
    include: { collection: { select: { name: true } } },
  });
  if (!job) throw Object.assign(new Error("Job not found."), { status: 404 });

  const outputs = await db.bulkJobOutput.findMany({
    where: { jobId },
    include: { record: { select: { data: true } } },
    orderBy: { createdAt: "asc" },
  });

  return {
    job: jobToSummary(job, job.collection?.name ?? "Unknown"),
    outputs: outputs.map((o: any) => ({
      id: o.id as string,
      recordId: o.recordId as string,
      recordData: o.record?.data as Record<string, unknown>,
      documentId: o.documentId as string | null,
      publishToken: o.publishToken as string | null,
      status: o.status as string,
      error: o.error as string | null,
    })),
  };
}

// ── Utilities ─────────────────────────────────────────────────────────────────

export function fillTemplate(templateJson: string, data: Record<string, unknown>): string {
  const parsed = JSON.parse(templateJson) as unknown;
  const filled = fillTemplateNode(parsed, data);
  return JSON.stringify(filled);
}

function fillTemplateNode(value: unknown, data: Record<string, unknown>): unknown {
  if (typeof value === "string") {
    return value.replace(/\{\{([^}]+)\}\}/g, (_, placeholder: string) => {
      const resolved = resolvePlaceholder(data, placeholder.trim());
      return resolved === undefined || resolved === null ? "" : String(resolved);
    });
  }
  if (Array.isArray(value)) return value.map((item) => fillTemplateNode(item, data));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, entry]) => [key, fillTemplateNode(entry, data)]),
    );
  }
  return value;
}

export function resolvePlaceholder(data: Record<string, unknown>, placeholderName: string): unknown {
  const trimmed = placeholderName.trim();
  if (!trimmed) return "";

  const exactPath = resolvePath(data, trimmed, (segment, key) => segment === key);
  if (exactPath !== undefined) return exactPath;

  const caseInsensitivePath = resolvePath(data, trimmed, (segment, key) => segment.toLowerCase() === key.toLowerCase());
  if (caseInsensitivePath !== undefined) return caseInsensitivePath;

  const normalizedTarget = normalizePlaceholderToken(trimmed);
  const candidates = flattenEntries(data);
  const match = candidates.find((candidate) => {
    const normalizedPath = normalizePlaceholderToken(candidate.path);
    const normalizedKey = normalizePlaceholderToken(candidate.key);
    return normalizedPath === normalizedTarget || normalizedKey === normalizedTarget;
  });
  return match?.value ?? "";
}

function resolvePath(
  source: Record<string, unknown>,
  placeholderName: string,
  compare: (segment: string, key: string) => boolean,
): unknown {
  const segments = placeholderName.split(".").map((segment) => segment.trim()).filter(Boolean);
  if (segments.length === 0) return undefined;
  let current: unknown = source;
  for (const segment of segments) {
    if (!current || typeof current !== "object" || Array.isArray(current)) return undefined;
    const entries = Object.entries(current as Record<string, unknown>);
    const match = entries.find(([key]) => compare(segment, key));
    if (!match) return undefined;
    current = match[1];
  }
  return current;
}

function flattenEntries(
  value: unknown,
  path = "",
  entries: Array<{ path: string; key: string; value: unknown }> = [],
): Array<{ path: string; key: string; value: unknown }> {
  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      flattenEntries(item, path ? `${path}.${index}` : String(index), entries);
    });
    return entries;
  }
  if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      const childPath = path ? `${path}.${key}` : key;
      if (child && typeof child === "object") {
        flattenEntries(child, childPath, entries);
      } else {
        entries.push({ path: childPath, key, value: child });
      }
    }
    return entries;
  }
  if (path) entries.push({ path, key: path.split(".").at(-1) ?? path, value });
  return entries;
}

function normalizePlaceholderToken(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function deriveTitle(data: Record<string, unknown>, collectionName: string): string {
  const nameField = data.name ?? data.Name ?? data.studentName ?? data.fullName ?? data.firstName;
  return nameField ? `${collectionName} - ${String(nameField)}` : collectionName;
}

function jobToSummary(job: any, collectionName: string): BulkJobSummary {
  const pct = job.totalRecords > 0
    ? Math.round(((job.processedRecords + job.failedRecords) / job.totalRecords) * 100)
    : 0;
  return {
    id: job.id,
    collectionId: job.collectionId,
    collectionName,
    intent: job.intent,
    status: job.status,
    totalRecords: job.totalRecords,
    processedRecords: job.processedRecords,
    failedRecords: job.failedRecords,
    progressPct: pct,
    errorMessage: job.errorMessage,
    startedAt: job.startedAt ? (job.startedAt as Date).toISOString() : null,
    completedAt: job.completedAt ? (job.completedAt as Date).toISOString() : null,
    createdAt: (job.createdAt as Date).toISOString(),
  };
}

