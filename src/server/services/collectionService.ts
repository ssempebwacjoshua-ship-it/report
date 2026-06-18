import { randomUUID } from "node:crypto";
import { prisma } from "../db/prisma";
import { createNotification, executeWorkflows, upsertSearchIndex, removeSearchIndex } from "./documentOsService";

const db = prisma as any;

export interface CollectionSummary {
  id: string;
  name: string;
  type: string;
  recordCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CollectionDetail extends CollectionSummary {
  records: { id: string; data: Record<string, unknown>; sortOrder: number; createdAt: string }[];
  fields: string[];
}

// â”€â”€ CRUD â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function listCollections(creatorId: string): Promise<CollectionSummary[]> {
  const collections = await db.collection.findMany({
    where: { creatorId },
    orderBy: { updatedAt: "desc" },
    include: { _count: { select: { records: true } } },
  });

  return collections.map((c: any) => ({
    id: c.id,
    name: c.name,
    type: c.type,
    recordCount: c._count.records,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  }));
}

export async function createCollection(
  creatorId: string,
  name: string,
  type = "CUSTOM",
): Promise<CollectionSummary> {
  const c = await db.collection.create({
    data: { id: randomUUID(), creatorId, name: name.trim(), type },
  });
  await upsertSearchIndex(creatorId, "COLLECTION", c.id, c.name, `${c.name}\n${c.type}`, { type: c.type });
  return { id: c.id, name: c.name, type: c.type, recordCount: 0, createdAt: c.createdAt.toISOString(), updatedAt: c.updatedAt.toISOString() };
}

export async function getCollection(
  collectionId: string,
  creatorId: string,
): Promise<CollectionDetail | null> {
  const c = await db.collection.findFirst({
    where: { id: collectionId, creatorId },
    include: {
      records: { orderBy: { sortOrder: "asc" } },
      _count: { select: { records: true } },
    },
  });
  if (!c) return null;

  // Derive field names from union of all record keys
  const fields = deriveFields(c.records.map((r: any) => r.data as Record<string, unknown>));

  return {
    id: c.id,
    name: c.name,
    type: c.type,
    recordCount: c._count.records,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
    fields,
    records: c.records.map((r: any) => ({
      id: r.id,
      data: r.data as Record<string, unknown>,
      sortOrder: r.sortOrder,
      createdAt: r.createdAt.toISOString(),
    })),
  };
}

export async function updateCollection(
  collectionId: string,
  creatorId: string,
  patch: { name?: string; type?: string },
): Promise<void> {
  const c = await db.collection.findFirst({ where: { id: collectionId, creatorId } });
  if (!c) throw Object.assign(new Error("Collection not found."), { status: 404 });
  await db.collection.update({ where: { id: collectionId }, data: patch });
  await upsertSearchIndex(creatorId, "COLLECTION", collectionId, patch.name ?? c.name, `${patch.name ?? c.name}\n${patch.type ?? c.type}`, { type: patch.type ?? c.type });
}

export async function deleteCollection(collectionId: string, creatorId: string): Promise<void> {
  const c = await db.collection.findFirst({ where: { id: collectionId, creatorId } });
  if (!c) throw Object.assign(new Error("Collection not found."), { status: 404 });
  await db.collection.delete({ where: { id: collectionId } });
  await removeSearchIndex("COLLECTION", collectionId);
}

// â”€â”€ Records â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function addRecord(
  collectionId: string,
  creatorId: string,
  data: Record<string, unknown>,
): Promise<{ id: string }> {
  const c = await db.collection.findFirst({ where: { id: collectionId, creatorId } });
  if (!c) throw Object.assign(new Error("Collection not found."), { status: 404 });

  const maxOrder = await db.collectionRecord.aggregate({
    where: { collectionId },
    _max: { sortOrder: true },
  });
  const sortOrder = (maxOrder._max.sortOrder ?? -1) + 1;

  const record = await db.collectionRecord.create({
    data: { id: randomUUID(), collectionId, data, sortOrder },
  });
  await upsertSearchIndex(creatorId, "RECORD", record.id, c.name, JSON.stringify(data), { collectionId });
  await executeWorkflows(creatorId, "RECORD_ADDED", { collectionId, recordId: record.id, collectionName: c.name });
  return { id: record.id };
}

export async function deleteRecord(
  recordId: string,
  collectionId: string,
  creatorId: string,
): Promise<void> {
  const c = await db.collection.findFirst({ where: { id: collectionId, creatorId } });
  if (!c) throw Object.assign(new Error("Collection not found."), { status: 404 });
  await db.collectionRecord.deleteMany({ where: { id: recordId, collectionId } });
  await removeSearchIndex("RECORD", recordId);
}

// â”€â”€ CSV import â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export function parseCSV(content: string): Record<string, string>[] {
  const lines = content
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length < 2) return [];

  const headers = splitCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const values = splitCsvLine(line);
    return Object.fromEntries(headers.map((h, i) => [h, values[i] ?? ""]));
  });
}

function splitCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

export async function importCSVIntoCollection(
  collectionId: string,
  creatorId: string,
  csvContent: string,
): Promise<{ imported: number; skipped: number }> {
  const c = await db.collection.findFirst({ where: { id: collectionId, creatorId } });
  if (!c) throw Object.assign(new Error("Collection not found."), { status: 404 });

  const rows = parseCSV(csvContent);
  if (rows.length === 0) return { imported: 0, skipped: 0 };

  const maxOrder = await db.collectionRecord.aggregate({
    where: { collectionId },
    _max: { sortOrder: true },
  });
  let sortOrder = (maxOrder._max.sortOrder ?? -1) + 1;

  let imported = 0;
  let skipped = 0;

  for (const row of rows) {
    const nonEmpty = Object.values(row).some((v) => v !== "");
    if (!nonEmpty) { skipped++; continue; }
    const record = await db.collectionRecord.create({
      data: { id: randomUUID(), collectionId, data: row, sortOrder: sortOrder++ },
    });
    await upsertSearchIndex(creatorId, "RECORD", record.id, c.name, JSON.stringify(row), { collectionId });
    imported++;
  }

  if (imported > 0) {
    await createNotification(creatorId, "COLLECTION_IMPORTED", "Collection imported", `${imported} record${imported === 1 ? "" : "s"} were imported into ${c.name}.`);
    await executeWorkflows(creatorId, "COLLECTION_IMPORTED", { collectionId, collectionName: c.name, imported, skipped });
  }
  return { imported, skipped };
}

// â”€â”€ Utility â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function deriveFields(records: Record<string, unknown>[]): string[] {
  const keys = new Set<string>();
  for (const r of records) {
    for (const k of Object.keys(r)) keys.add(k);
  }
  return Array.from(keys);
}

