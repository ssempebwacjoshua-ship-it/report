import { randomUUID } from "node:crypto";
import type {
  CanExtractResult,
  ExtractionMode,
  SmartPagesBillingOperation,
  SmartPageLedgerEntry,
  SmartPagePlan,
  SmartPageSummary,
  SmartPagesPaymentConfig,
  SmartPagesPaymentNetwork,
  SmartPagesPackageCode,
  SmartPagesPricingConfig,
  TopUpBundle,
} from "../../shared/types/smartPages";
import {
  SMART_PAGES_CREDIT_PRICE_UGX,
  SMART_PAGES_GENERATE_DOCUMENT_CREDITS_PER_PAGE,
  SMART_PAGES_HIGH_ACCURACY_MULTIPLIER,
  SMART_PAGES_PACKAGES,
  SMART_PAGES_PUBLISH_CREDITS_PER_DOCUMENT,
} from "../../shared/types/smartPages";

// Credits granted when a school first touches Smart Pages (Trial plan).
const TRIAL_PLAN_CREDITS = 10;

// ── Store interface ────────────────────────────────────────────────────────────

export interface SmartPageStore {
  getPlan(schoolId: string): Promise<SmartPagePlan | null>;
  /** Must throw on failure — callers depend on success to mean persisted. */
  savePlan(plan: SmartPagePlan): Promise<void>;
  /** Must throw on failure — a swallowed ledger write means invisible credit loss. */
  addLedgerEntry(entry: SmartPageLedgerEntry): Promise<void>;
  /**
   * Atomically verify remaining credits >= creditsToDeduct, increment usedPages,
   * and create the ledger entry. Must throw (and roll back any DB writes) if:
   * - no plan exists
   * - remaining credits < creditsToDeduct
   * - any DB write fails
   */
  atomicDeduct(
    schoolId: string,
    creditsToDeduct: number,
    entry: SmartPageLedgerEntry,
  ): Promise<void>;
  getLedgerByHash(schoolId: string, fileHash: string): Promise<SmartPageLedgerEntry | null>;
  listLedger?(schoolId: string, limit?: number): Promise<SmartPageLedgerEntry[]>;
}

// ── In-memory store (for tests and development) ────────────────────────────────

export function createInMemorySmartPageStore(): SmartPageStore {
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
    async atomicDeduct(schoolId, creditsToDeduct, entry) {
      const plan = plans.get(schoolId);
      if (!plan) {
        throw Object.assign(
          new Error("No billing plan found. Please contact support."),
          { code: "SMART_PAGES_BILLING_NOT_INITIALIZED", status: 402 },
        );
      }
      const total = plan.includedPages + plan.topUpPages + plan.rolloverPages;
      const remaining = total - plan.usedPages;
      if (remaining < creditsToDeduct) {
        throw Object.assign(
          new Error(
            `Insufficient credits. Need ${creditsToDeduct}, have ${remaining}. Buy credits to continue.`,
          ),
          { code: "SMART_PAGES_EXHAUSTED", status: 402 },
        );
      }
      // Both writes succeed or neither does (single-threaded in-memory = effectively atomic).
      plans.set(schoolId, { ...plan, usedPages: plan.usedPages + creditsToDeduct });
      ledger.push(entry);
    },
    async getLedgerByHash(schoolId, fileHash) {
      for (let i = ledger.length - 1; i >= 0; i--) {
        const e = ledger[i]!;
        if (e.schoolId === schoolId && e.fileHash === fileHash && e.status === "CHARGED") {
          return e;
        }
      }
      return null;
    },
    async listLedger(schoolId, limit = 50) {
      return ledger.filter((entry) => entry.schoolId === schoolId).slice(-limit).reverse();
    },
  };
}

// ── Default Prisma-backed store (lazy to avoid import issues in tests) ─────────

let _defaultStore: SmartPageStore | null = null;

function getDefaultStore(): SmartPageStore {
  if (_defaultStore) return _defaultStore;
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
      // No silent catch — callers must know if the plan failed to persist.
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
    },

    async addLedgerEntry(entry) {
      // No silent catch — a swallowed ledger write means invisible credit loss.
      await (prisma as any).smartPageLedger.create({
        data: buildLedgerData(entry),
      });
    },

    async atomicDeduct(schoolId, creditsToDeduct, entry) {
      await (prisma as any).$transaction(async (tx: any) => {
        const row = await tx.schoolSmartPagePlan.findUnique({ where: { schoolId } });
        if (!row) {
          throw Object.assign(
            new Error("No billing plan found. Please contact support."),
            { code: "SMART_PAGES_BILLING_NOT_INITIALIZED", status: 402 },
          );
        }
        const plan = prismaRowToPlan(row);
        const total = plan.includedPages + plan.topUpPages + plan.rolloverPages;
        const remaining = total - plan.usedPages;
        if (remaining < creditsToDeduct) {
          throw Object.assign(
            new Error(
              `Insufficient credits. Need ${creditsToDeduct}, have ${remaining}. Buy credits to continue.`,
            ),
            { code: "SMART_PAGES_EXHAUSTED", status: 402 },
          );
        }
        await tx.schoolSmartPagePlan.update({
          where: { schoolId },
          data: { usedPages: plan.usedPages + creditsToDeduct },
        });
        await tx.smartPageLedger.create({ data: buildLedgerData(entry) });
      });
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

    async listLedger(schoolId, limit = 50) {
      try {
        const rows = await (prisma as any).smartPageLedger.findMany({
          where: { schoolId },
          orderBy: { createdAt: "desc" },
          take: limit,
        });
        return rows.map((row: Record<string, unknown>) => prismaLedgerToEntry(row));
      } catch {
        return [];
      }
    },
  };
}

function buildLedgerData(entry: SmartPageLedgerEntry) {
  return {
    id: randomUUID(),
    schoolId: entry.schoolId,
    jobId: entry.jobId,
    fileHash: entry.fileHash,
    pagesCharged: entry.pagesCharged,
    creditsCharged: entry.creditsCharged ?? entry.pagesCharged,
    operation: entry.operation ?? entry.action,
    pagesProcessed: entry.pagesProcessed ?? entry.pagesCharged,
    priceUgx: entry.priceUgx ?? calculatePriceUgx(entry.creditsCharged ?? entry.pagesCharged),
    action: entry.action,
    reason: entry.reason,
    provider: entry.provider,
    model: entry.model,
    extractionMode: entry.extractionMode,
    status: entry.status,
    tokenUsage: (entry.tokenUsage ?? null) as any,
    geminiCostEstimateUgx: entry.geminiCostEstimateUgx ?? null,
    marginEstimateUgx: entry.marginEstimateUgx ?? null,
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
    creditsCharged: (row.creditsCharged as number | undefined) ?? (row.pagesCharged as number),
    operation: (row.operation as SmartPagesBillingOperation | undefined) ?? (row.action as SmartPagesBillingOperation),
    pagesProcessed: (row.pagesProcessed as number | undefined) ?? (row.pagesCharged as number),
    priceUgx: (row.priceUgx as number | undefined) ?? calculatePriceUgx(row.pagesCharged as number),
    action: row.action as SmartPageLedgerEntry["action"],
    reason: row.reason as string,
    provider: row.provider as string,
    model: row.model as string,
    extractionMode: row.extractionMode as ExtractionMode,
    status: row.status as SmartPageLedgerEntry["status"],
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : undefined,
    tokenUsage: (row.tokenUsage as Record<string, unknown> | null | undefined) ?? null,
    geminiCostEstimateUgx: (row.geminiCostEstimateUgx as number | null | undefined) ?? null,
    marginEstimateUgx: (row.marginEstimateUgx as number | null | undefined) ?? null,
  };
}

function envNumber(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function getSmartPagesPricingConfig(): SmartPagesPricingConfig {
  return {
    creditPriceUgx: envNumber("SMART_PAGES_CREDIT_PRICE_UGX", SMART_PAGES_CREDIT_PRICE_UGX),
    highAccuracyMultiplier: envNumber("SMART_PAGES_HIGH_ACCURACY_MULTIPLIER", SMART_PAGES_HIGH_ACCURACY_MULTIPLIER),
    generateDocumentCreditsPerPage: envNumber("SMART_PAGES_GENERATE_DOCUMENT_CREDITS_PER_PAGE", SMART_PAGES_GENERATE_DOCUMENT_CREDITS_PER_PAGE),
    publishCreditsPerDocument: envNumber("SMART_PAGES_PUBLISH_CREDITS_PER_DOCUMENT", SMART_PAGES_PUBLISH_CREDITS_PER_DOCUMENT),
  };
}

export function getSmartPagesPaymentConfig(): SmartPagesPaymentConfig {
  return {
    pricing: getSmartPagesPricingConfig(),
    packages: SMART_PAGES_PACKAGES,
    networks: [
      {
        network: "AIRTEL",
        label: "Pay using Airtel Money",
        merchantCode: process.env.SMART_PAGES_AIRTEL_MERCHANT_CODE?.trim() || "7097959",
        merchantName: process.env.SMART_PAGES_AIRTEL_MERCHANT_NAME?.trim() || "",
      },
      {
        network: "MTN",
        label: "Pay using MTN MoMo",
        merchantCode: process.env.SMART_PAGES_MTN_MERCHANT_CODE?.trim() || "98642335",
        merchantName: process.env.SMART_PAGES_MTN_MERCHANT_NAME?.trim() || "",
      },
    ],
  };
}

export function getSmartPagesPackage(packageCode: SmartPagesPackageCode) {
  return SMART_PAGES_PACKAGES.find((pkg) => pkg.code === packageCode) ?? null;
}

export function getPaymentNetworkConfig(network: SmartPagesPaymentNetwork) {
  return getSmartPagesPaymentConfig().networks.find((item) => item.network === network) ?? null;
}

export function calculatePriceUgx(credits: number): number {
  return Math.max(0, credits) * getSmartPagesPricingConfig().creditPriceUgx;
}

export function calculateExtractionCredits(pagesProcessed: number, mode: ExtractionMode): number {
  const pages = Math.max(1, Math.ceil(pagesProcessed));
  const multiplier = mode === "high_accuracy" ? getSmartPagesPricingConfig().highAccuracyMultiplier : 1;
  return pages * multiplier;
}

export function calculateGenerateDocumentCredits(outputPages: number): number {
  return Math.max(1, Math.ceil(outputPages)) * getSmartPagesPricingConfig().generateDocumentCreditsPerPage;
}

export function calculatePublishCredits(): number {
  return getSmartPagesPricingConfig().publishCreditsPerDocument;
}

export function estimateGeminiCostUgx(tokenUsage: unknown): number {
  if (!tokenUsage || typeof tokenUsage !== "object") return 0;
  const usage = tokenUsage as Record<string, unknown>;
  const totalTokens = Number(usage.totalTokenCount ?? usage.totalTokens ?? 0);
  if (!Number.isFinite(totalTokens) || totalTokens <= 0) return 0;
  const costPer1kTokensUgx = envNumber("SMART_PAGES_GEMINI_COST_ESTIMATE_UGX_PER_1K_TOKENS", 0);
  return Math.round((totalTokens / 1000) * costPer1kTokensUgx);
}

// ── Trial plan provisioning ────────────────────────────────────────────────────

function buildTrialPlan(schoolId: string): SmartPagePlan {
  const now = new Date();
  const cycleEnd = new Date(now);
  cycleEnd.setFullYear(cycleEnd.getFullYear() + 1);
  return {
    schoolId,
    planName: "TRIAL",
    // usedPages stores the count of credits consumed (1 credit = 1 normal-extraction page).
    includedPages: TRIAL_PLAN_CREDITS,
    billingCycle: "ACADEMIC_YEAR",
    cycleStart: now.toISOString(),
    cycleEnd: cycleEnd.toISOString(),
    usedPages: 0,
    topUpPages: 0,
    rolloverPages: 0,
    status: "ACTIVE",
    allowHighAccuracy: false,
  };
}

// ── Service factory ────────────────────────────────────────────────────────────

export interface DeductPagesInput {
  jobId: string;
  fileHash: string;
  pagesCharged: number;
  creditsCharged?: number;
  operation?: SmartPagesBillingOperation;
  pagesProcessed?: number;
  priceUgx?: number;
  extractionMode: ExtractionMode;
  provider: string;
  model: string;
  reason: string;
  tokenUsage?: Record<string, unknown> | null;
  geminiCostEstimateUgx?: number | null;
  marginEstimateUgx?: number | null;
}

export function createSmartPagesService(store: SmartPageStore) {
  async function ensurePlan(schoolId: string): Promise<SmartPagePlan> {
    const existing = await store.getPlan(schoolId);
    if (existing) return existing;
    // Auto-provision a 10-credit trial plan on first Smart Pages access.
    const trial = buildTrialPlan(schoolId);
    await store.savePlan(trial); // throws on failure — no silent catch
    return trial;
  }

  return {
    async getSummary(schoolId: string): Promise<SmartPageSummary> {
      const plan = await store.getPlan(schoolId);
      if (!plan) {
        return {
          includedPages: 0,
          topUpPages: 0,
          usedPages: 0,
          remainingPages: 0,
          includedCredits: 0,
          topUpCredits: 0,
          usedCredits: 0,
          remainingCredits: 0,
          planName: null,
          billingCycle: "ACADEMIC_YEAR",
          allowHighAccuracy: false,
          trialClaimed: false,
        };
      }
      const total = plan.includedPages + plan.topUpPages + plan.rolloverPages;
      const remaining = Math.max(0, total - plan.usedPages);
      return {
        includedPages: plan.includedPages,
        topUpPages: plan.topUpPages,
        // usedPages on SmartPagePlan stores consumed credit-units, not physical pages.
        usedPages: plan.usedPages,
        remainingPages: remaining,
        includedCredits: plan.includedPages,
        topUpCredits: plan.topUpPages + plan.rolloverPages,
        usedCredits: plan.usedPages,
        remainingCredits: remaining,
        planName: plan.planName,
        billingCycle: plan.billingCycle,
        allowHighAccuracy: plan.allowHighAccuracy,
        trialClaimed: true,
      };
    },

    /**
     * Explicitly claim the 10-page free trial for this workspace.
     * Throws with code TRIAL_ALREADY_CLAIMED (409) if any plan already exists.
     */
    async claimTrial(schoolId: string): Promise<SmartPageSummary> {
      const existing = await store.getPlan(schoolId);
      if (existing) {
        throw Object.assign(
          new Error("Trial has already been claimed for this workspace."),
          { code: "TRIAL_ALREADY_CLAIMED", status: 409 },
        );
      }
      const trial = buildTrialPlan(schoolId);
      await store.savePlan(trial);
      return this.getSummary(schoolId);
    },

    /**
     * Check whether the school has at least `creditsNeeded` credits remaining.
     * If no plan exists, a 10-credit trial plan is auto-provisioned.
     * Never returns `{ allowed: true }` for a school with zero credits.
     */
    async canUseCredits(schoolId: string, creditsNeeded: number): Promise<CanExtractResult> {
      const plan = await ensurePlan(schoolId);
      const total = plan.includedPages + plan.topUpPages + plan.rolloverPages;
      const remaining = total - plan.usedPages;
      if (remaining < creditsNeeded) {
        return {
          allowed: false,
          code: "SMART_PAGES_EXHAUSTED",
          message: `You have used all ${total} Smart Page credits. Buy credits to continue.`,
        };
      }
      return { allowed: true };
    },

    /** @deprecated Use canUseCredits — parameter name was misleading (it took credits, not pages). */
    async canExtract(schoolId: string, creditsNeeded: number): Promise<CanExtractResult> {
      return this.canUseCredits(schoolId, creditsNeeded);
    },

    /**
     * Atomically verify remaining credits and deduct them together with the ledger
     * entry. Throws if credits are insufficient or if any write fails.
     */
    async deductPages(schoolId: string, input: DeductPagesInput): Promise<void> {
      const creditsCharged = input.creditsCharged ?? input.pagesCharged;
      const priceUgx = input.priceUgx ?? calculatePriceUgx(creditsCharged);
      const entry: SmartPageLedgerEntry = {
        schoolId,
        jobId: input.jobId,
        fileHash: input.fileHash,
        pagesCharged: input.pagesCharged,
        creditsCharged,
        operation: input.operation ?? (input.extractionMode === "high_accuracy" ? "HIGH_ACCURACY_EXTRACT" : "EXTRACT"),
        pagesProcessed: input.pagesProcessed ?? input.pagesCharged,
        priceUgx,
        action: "EXTRACT",
        reason: input.reason,
        provider: input.provider,
        model: input.model,
        extractionMode: input.extractionMode,
        status: "CHARGED",
        tokenUsage: input.tokenUsage ?? null,
        geminiCostEstimateUgx: input.geminiCostEstimateUgx ?? null,
        marginEstimateUgx:
          input.marginEstimateUgx ??
          (input.geminiCostEstimateUgx != null ? priceUgx - input.geminiCostEstimateUgx : null),
      };
      await store.atomicDeduct(schoolId, creditsCharged, entry);
    },

    async isDuplicateJob(schoolId: string, fileHash: string): Promise<boolean> {
      const entry = await store.getLedgerByHash(schoolId, fileHash);
      return entry !== null;
    },

    async addTopUp(schoolId: string, bundle: TopUpBundle): Promise<void> {
      const plan = await store.getPlan(schoolId);
      if (!plan) {
        // Payment confirmed but school somehow has no plan — provision trial and add top-up.
        const trial = buildTrialPlan(schoolId);
        await store.savePlan({ ...trial, topUpPages: bundle });
        return;
      }
      await store.savePlan({ ...plan, topUpPages: plan.topUpPages + bundle });
    },

    async getLedger(schoolId: string, limit = 50): Promise<SmartPageLedgerEntry[]> {
      return store.listLedger ? store.listLedger(schoolId, limit) : [];
    },

    async isHighAccuracyAllowed(schoolId: string): Promise<boolean> {
      const plan = await store.getPlan(schoolId);
      return plan?.allowHighAccuracy ?? false;
    },
  };
}

// ── Pure utility functions (exported at module level) ─────────────────────────

export function estimatePageCount(_mimeType: string): number {
  return 1;
}

export function getDefaultExtractionMode(): ExtractionMode {
  return "balanced";
}

// ── Module-level API backed by Prisma (used by routes) ───────────────────────

export async function canUseCredits(schoolId: string, creditsNeeded: number): Promise<CanExtractResult> {
  return createSmartPagesService(getDefaultStore()).canUseCredits(schoolId, creditsNeeded);
}

/** @deprecated Use canUseCredits */
export async function canExtract(schoolId: string, creditsNeeded: number): Promise<CanExtractResult> {
  return canUseCredits(schoolId, creditsNeeded);
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

export async function claimTrial(schoolId: string): Promise<SmartPageSummary> {
  return createSmartPagesService(getDefaultStore()).claimTrial(schoolId);
}

export async function addTopUp(schoolId: string, bundle: TopUpBundle): Promise<void> {
  return createSmartPagesService(getDefaultStore()).addTopUp(schoolId, bundle);
}

export async function getLedger(schoolId: string, limit = 50): Promise<SmartPageLedgerEntry[]> {
  return createSmartPagesService(getDefaultStore()).getLedger(schoolId, limit);
}
