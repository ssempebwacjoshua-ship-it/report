import { randomUUID } from "node:crypto";
import type {
  CanExtractResult,
  ExtractionMode,
  SmartPageLedgerEntry,
  SmartPagePlan,
  SmartPageSummary,
  TopUpBundle,
} from "../../shared/types/smartPages";

// â”€â”€ Store interface â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export interface SmartPageStore {
  getPlan(schoolId: string): Promise<SmartPagePlan | null>;
  savePlan(plan: SmartPagePlan): Promise<void>;
  addLedgerEntry(entry: SmartPageLedgerEntry): Promise<void>;
  getLedgerByHash(schoolId: string, fileHash: string): Promise<SmartPageLedgerEntry | null>;
}

// â”€â”€ In-memory store (for tests and development) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export function createInMemorySmartPageStore(): SmartPageStore & {
  addLedgerEntry(entry: SmartPageLedgerEntry): Promise<void>;
} {
  const plans = new Map<string, SmartPagePlan>();
  const ledger: SmartPageLedgerEntry[] = [];

  return {
    async getPlan(schoolId) {
      return plans.get(schoolId) ?? null;
    },
    async savePlan(plan) {
      plans.set(plan.schoolId, plan);
    },
    async addLedgerEntry(entry) {
      ledger.push(entry);
    },
    async getLedgerByHash(schoolId, fileHash) {
      // Most-recent CHARGED entry for this school + hash
      for (let i = ledger.length - 1; i >= 0; i--) {
        const e = ledger[i]!;
        if (e.schoolId === schoolId && e.fileHash === fileHash && e.status === "CHARGED") {
          return e;
        }
      }
      return null;
    },
  };
}

// â”€â”€ Default Prisma-backed store (lazy to avoid import issues in tests) â”€â”€â”€â”€â”€â”€â”€â”€â”€

let _defaultStore: SmartPageStore | null = null;

function getDefaultStore(): SmartPageStore {
  if (_defaultStore) return _defaultStore;
  // Lazy-load to avoid Prisma import in test environments
  const { prisma } = require("../db/prisma") as { prisma: import("@prisma/client").PrismaClient };
  _defaultStore = createPrismaSmartPageStore(prisma);
  return _defaultStore;
}

function createPrismaSmartPageStore(prisma: import("@prisma/client").PrismaClient): SmartPageStore {
  return {
    async getPlan(schoolId) {
      try {
        const row = await (prisma as any).schoolSmartPagePlan.findUnique({ where: { schoolId } });
        return row ? prismaRowToPlan(row) : null;
      } catch {
        return null;
      }
    },
    async savePlan(plan) {
      try {
        await (prisma as any).schoolSmartPagePlan.upsert({
          where: { schoolId: plan.schoolId },
          update: {
            usedPages: plan.usedPages,
            topUpPages: plan.topUpPages,
            rolloverPages: plan.rolloverPages,
            status: plan.status,
          },
          create: {
            schoolId: plan.schoolId,
            planName: plan.planName,
            includedPages: plan.includedPages,
            billingCycle: plan.billingCycle,
            cycleStart: new Date(plan.cycleStart),
            cycleEnd: new Date(plan.cycleEnd),
            usedPages: plan.usedPages,
            topUpPages: plan.topUpPages,
            rolloverPages: plan.rolloverPages,
            status: plan.status,
            allowHighAccuracy: plan.allowHighAccuracy,
          },
        });
      } catch {
        /* best effort */
      }
    },
    async addLedgerEntry(entry) {
      try {
        await (prisma as any).smartPageLedger.create({
          data: {
            id: randomUUID(),
            schoolId: entry.schoolId,
            jobId: entry.jobId,
            fileHash: entry.fileHash,
            pagesCharged: entry.pagesCharged,
            action: entry.action,
            reason: entry.reason,
            provider: entry.provider,
            model: entry.model,
            extractionMode: entry.extractionMode,
            status: entry.status,
          },
        });
      } catch {
        /* best effort */
      }
    },
    async getLedgerByHash(schoolId, fileHash) {
      try {
        const row = await (prisma as any).smartPageLedger.findFirst({
          where: { schoolId, fileHash, status: "CHARGED" },
          orderBy: { createdAt: "desc" },
        });
        return row ? prismaLedgerToEntry(row) : null;
      } catch {
        return null;
      }
    },
  };
}

function prismaRowToPlan(row: Record<string, unknown>): SmartPagePlan {
  return {
    schoolId: row.schoolId as string,
    planName: row.planName as SmartPagePlan["planName"],
    includedPages: row.includedPages as number,
    billingCycle: "ACADEMIC_YEAR",
    cycleStart: (row.cycleStart as Date).toISOString(),
    cycleEnd: (row.cycleEnd as Date).toISOString(),
    usedPages: row.usedPages as number,
    topUpPages: row.topUpPages as number,
    rolloverPages: row.rolloverPages as number,
    status: row.status as SmartPagePlan["status"],
    allowHighAccuracy: row.allowHighAccuracy as boolean,
  };
}

function prismaLedgerToEntry(row: Record<string, unknown>): SmartPageLedgerEntry {
  return {
    schoolId: row.schoolId as string,
    jobId: row.jobId as string,
    fileHash: row.fileHash as string,
    pagesCharged: row.pagesCharged as number,
    action: row.action as SmartPageLedgerEntry["action"],
    reason: row.reason as string,
    provider: row.provider as string,
    model: row.model as string,
    extractionMode: row.extractionMode as ExtractionMode,
    status: row.status as SmartPageLedgerEntry["status"],
  };
}

// â”€â”€ Service factory â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export interface DeductPagesInput {
  jobId: string;
  fileHash: string;
  pagesCharged: number;
  extractionMode: ExtractionMode;
  provider: string;
  model: string;
  reason: string;
}

export function createSmartPagesService(store: SmartPageStore) {
  return {
    async getSummary(schoolId: string): Promise<SmartPageSummary> {
      const plan = await store.getPlan(schoolId);
      if (!plan) {
        return {
          includedPages: 0,
          topUpPages: 0,
          usedPages: 0,
          remainingPages: Infinity,
          planName: null,
          billingCycle: "ACADEMIC_YEAR",
          allowHighAccuracy: false,
        };
      }
      const total = plan.includedPages + plan.topUpPages + plan.rolloverPages;
      return {
        includedPages: plan.includedPages,
        topUpPages: plan.topUpPages,
        usedPages: plan.usedPages,
        remainingPages: Math.max(0, total - plan.usedPages),
        planName: plan.planName,
        billingCycle: plan.billingCycle,
        allowHighAccuracy: plan.allowHighAccuracy,
      };
    },

    async canExtract(schoolId: string, pageCount: number): Promise<CanExtractResult> {
      const plan = await store.getPlan(schoolId);
      if (!plan) return { allowed: true }; // no plan = unlimited (grace period)

      const total = plan.includedPages + plan.topUpPages + plan.rolloverPages;
      const remaining = total - plan.usedPages;
      if (remaining < pageCount) {
        return {
          allowed: false,
          code: "SMART_PAGES_EXHAUSTED",
          message: `You have used all ${total} Smart Pages. Buy top-up pages to continue extracting.`,
        };
      }
      return { allowed: true };
    },

    async deductPages(schoolId: string, input: DeductPagesInput): Promise<void> {
      const plan = await store.getPlan(schoolId);
      if (plan) {
        const updated: SmartPagePlan = { ...plan, usedPages: plan.usedPages + input.pagesCharged };
        await store.savePlan(updated);
      }
      await store.addLedgerEntry({
        schoolId,
        jobId: input.jobId,
        fileHash: input.fileHash,
        pagesCharged: input.pagesCharged,
        action: "EXTRACT",
        reason: input.reason,
        provider: input.provider,
        model: input.model,
        extractionMode: input.extractionMode,
        status: "CHARGED",
      });
    },

    async isDuplicateJob(schoolId: string, fileHash: string): Promise<boolean> {
      const entry = await store.getLedgerByHash(schoolId, fileHash);
      return entry !== null;
    },

    async addTopUp(schoolId: string, bundle: TopUpBundle): Promise<void> {
      const plan = await store.getPlan(schoolId);
      if (!plan) return;
      await store.savePlan({ ...plan, topUpPages: plan.topUpPages + bundle });
    },

    async isHighAccuracyAllowed(schoolId: string): Promise<boolean> {
      const plan = await store.getPlan(schoolId);
      return plan?.allowHighAccuracy ?? false;
    },
  };
}

// â”€â”€ Pure utility functions (exported at module level) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export function estimatePageCount(_mimeType: string): number {
  // Both images and PDFs count as 1 page for estimation.
  // Actual multi-page PDF counting requires full parse â€” charge on extraction.
  return 1;
}

export function getDefaultExtractionMode(): ExtractionMode {
  return "balanced";
}

// â”€â”€ Module-level API backed by Prisma (used by routes) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function canExtract(schoolId: string, pageCount: number): Promise<CanExtractResult> {
  return createSmartPagesService(getDefaultStore()).canExtract(schoolId, pageCount);
}

export async function deductPages(schoolId: string, input: DeductPagesInput): Promise<void> {
  return createSmartPagesService(getDefaultStore()).deductPages(schoolId, input);
}

export async function isDuplicateJob(schoolId: string, fileHash: string): Promise<boolean> {
  return createSmartPagesService(getDefaultStore()).isDuplicateJob(schoolId, fileHash);
}

export async function isHighAccuracyAllowed(schoolId: string): Promise<boolean> {
  return createSmartPagesService(getDefaultStore()).isHighAccuracyAllowed(schoolId);
}

export async function getSummary(schoolId: string): Promise<SmartPageSummary> {
  return createSmartPagesService(getDefaultStore()).getSummary(schoolId);
}

export async function addTopUp(schoolId: string, bundle: TopUpBundle): Promise<void> {
  return createSmartPagesService(getDefaultStore()).addTopUp(schoolId, bundle);
}

