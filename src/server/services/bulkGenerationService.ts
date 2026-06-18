import { randomUUID } from "node:crypto";
import { prisma } from "../db/prisma";
import { generateBulkTemplate } from "./documentGeminiService";
import { createNotification, executeWorkflows, preferenceMap, upsertSearchIndex } from "./documentOsService";

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

// â”€â”€ Create job â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

// â”€â”€ Process a single job â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

      const doc = await db.smartDocument.create({
        data: {
          id: randomUUID(),
          creatorId: job.creatorId,
          title: docTitle,
          extractedKnowledge: { source: "bulk_generation", jobId, recordId: record.id },
          status: "PUBLISHED",
        },
      });

      const version = await db.documentVersion.create({
        data: {
          id: randomUUID(),
          documentId: doc.id,
          instruction: job.intent,
          schema: filledSchema as any,
          componentTree: (filledSchema.components ?? []) as any,
        },
      });

      await db.smartDocument.update({
        where: { id: doc.id },
        data: { activeVersionId: version.id },
      });

      const token = randomUUID().replace(/-/g, "").slice(0, 16);
      await db.publishedDocument.create({
        data: { id: randomUUID(), documentId: doc.id, token },
      });
      await upsertSearchIndex(job.creatorId, "DOCUMENT", doc.id, docTitle, [
        docTitle,
        job.intent,
        JSON.stringify(record.data),
      ].join("\n"), { status: "PUBLISHED", jobId, recordId: record.id });
      await upsertSearchIndex(job.creatorId, "VERSION", version.id, docTitle, JSON.stringify(filledSchema), { documentId: doc.id });
      await upsertSearchIndex(job.creatorId, "PUBLISHED_PAGE", doc.id, docTitle, docTitle, { token, documentId: doc.id });

      await db.bulkJobOutput.updateMany({
        where: { jobId, recordId: record.id },
        data: { documentId: doc.id, publishToken: token, status: "DONE" },
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

// â”€â”€ Polling worker â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

// â”€â”€ List jobs â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

// â”€â”€ Utilities â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function fillTemplate(templateJson: string, data: Record<string, unknown>): string {
  return templateJson.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
    const val = data[key];
    return val !== undefined && val !== null ? String(val) : "";
  });
}

function deriveTitle(data: Record<string, unknown>, collectionName: string): string {
  const nameField = data.name ?? data.Name ?? data.studentName ?? data.fullName ?? data.firstName;
  return nameField ? `${collectionName} â€” ${String(nameField)}` : collectionName;
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

