import { describe, expect, it } from "vitest";
import {
  createInMemorySmartPageStore,
  createSmartPagesService,
  estimatePageCount,
  getDefaultExtractionMode,
} from "../../server/services/smartPagesService";
import type { SmartPagePlan } from "../../shared/types/smartPages";

function starterPlan(overrides: Partial<SmartPagePlan> = {}): SmartPagePlan {
  return {
    schoolId: "school-1",
    planName: "STARTER",
    includedPages: 2000,
    topUpPages: 0,
    usedPages: 0,
    rolloverPages: 0,
    billingCycle: "ACADEMIC_YEAR",
    cycleStart: "2026-01-01",
    cycleEnd: "2026-12-31",
    status: "ACTIVE",
    allowHighAccuracy: false,
    ...overrides,
  };
}

// ── 1. estimatePageCount ──────────────────────────────────────────────────────

describe("estimatePageCount", () => {
  it("returns 1 for image files", () => {
    expect(estimatePageCount("image/png")).toBe(1);
    expect(estimatePageCount("image/jpeg")).toBe(1);
    expect(estimatePageCount("image/webp")).toBe(1);
  });

  it("returns 1 for PDF files (conservative single-page estimate)", () => {
    expect(estimatePageCount("application/pdf")).toBe(1);
  });
});

// ── 2. getDefaultExtractionMode ────────────────────────────────────────────────

describe("getDefaultExtractionMode", () => {
  it("returns balanced as the default mode", () => {
    expect(getDefaultExtractionMode()).toBe("balanced");
  });
});

// ── 3–5. canExtract ───────────────────────────────────────────────────────────

describe("canExtract", () => {
  it("allows extraction when pages are available", async () => {
    const store = createInMemorySmartPageStore();
    await store.savePlan(starterPlan({ usedPages: 100 }));
    const svc = createSmartPagesService(store);
    const result = await svc.canExtract("school-1", 1);
    expect(result.allowed).toBe(true);
  });

  it("blocks extraction when usedPages >= includedPages + topUpPages", async () => {
    const store = createInMemorySmartPageStore();
    await store.savePlan(starterPlan({ usedPages: 2000, includedPages: 2000, topUpPages: 0 }));
    const svc = createSmartPagesService(store);
    const result = await svc.canExtract("school-1", 1);
    expect(result.allowed).toBe(false);
    expect(result.code).toBe("SMART_PAGES_EXHAUSTED");
  });

  it("allows extraction when school has no plan (unlimited fallback)", async () => {
    const store = createInMemorySmartPageStore();
    // No plan set
    const svc = createSmartPagesService(store);
    const result = await svc.canExtract("school-1", 1);
    expect(result.allowed).toBe(true);
  });
});

// ── 6. deductPages ────────────────────────────────────────────────────────────

describe("deductPages", () => {
  it("increases usedPages by pageCount", async () => {
    const store = createInMemorySmartPageStore();
    await store.savePlan(starterPlan({ usedPages: 50 }));
    const svc = createSmartPagesService(store);
    await svc.deductPages("school-1", {
      jobId: "job-1",
      fileHash: "hash-abc",
      pagesCharged: 1,
      extractionMode: "balanced",
      provider: "azure",
      model: "read-layout",
      reason: "extraction",
    });
    const summary = await svc.getSummary("school-1");
    expect(summary.usedPages).toBe(51);
  });

  it("creates a CHARGED ledger entry with provider/model/extractionMode/pagesCharged", async () => {
    const store = createInMemorySmartPageStore();
    await store.savePlan(starterPlan());
    const svc = createSmartPagesService(store);
    await svc.deductPages("school-1", {
      jobId: "job-2",
      fileHash: "hash-xyz",
      pagesCharged: 1,
      extractionMode: "balanced",
      provider: "azure",
      model: "read-layout",
      reason: "extraction",
    });
    const entry = await store.getLedgerByHash("school-1", "hash-xyz");
    expect(entry).not.toBeNull();
    expect(entry!.status).toBe("CHARGED");
    expect(entry!.extractionMode).toBe("balanced");
    expect(entry!.provider).toBe("azure");
    expect(entry!.model).toBe("read-layout");
    expect(entry!.pagesCharged).toBe(1);
  });
});

// ── 7. isDuplicateJob ────────────────────────────────────────────────────────

describe("isDuplicateJob", () => {
  it("returns true when same fileHash already has a CHARGED entry", async () => {
    const store = createInMemorySmartPageStore();
    await store.savePlan(starterPlan());
    const svc = createSmartPagesService(store);
    await svc.deductPages("school-1", {
      jobId: "job-3",
      fileHash: "dup-hash",
      pagesCharged: 1,
      extractionMode: "balanced",
      provider: "azure",
      model: "read-layout",
      reason: "extraction",
    });
    expect(await svc.isDuplicateJob("school-1", "dup-hash")).toBe(true);
  });

  it("returns false when same fileHash has only FAILED entries", async () => {
    const store = createInMemorySmartPageStore();
    await store.addLedgerEntry({
      schoolId: "school-1",
      jobId: "job-4",
      fileHash: "fail-hash",
      pagesCharged: 0,
      extractionMode: "balanced",
      provider: "azure",
      model: "read-layout",
      action: "EXTRACT",
      reason: "provider failure",
      status: "FAILED",
    });
    const svc = createSmartPagesService(store);
    expect(await svc.isDuplicateJob("school-1", "fail-hash")).toBe(false);
  });

  it("returns false for a different fileHash", async () => {
    const store = createInMemorySmartPageStore();
    await store.savePlan(starterPlan());
    const svc = createSmartPagesService(store);
    await svc.deductPages("school-1", {
      jobId: "job-5",
      fileHash: "hash-A",
      pagesCharged: 1,
      extractionMode: "balanced",
      provider: "azure",
      model: "read-layout",
      reason: "extraction",
    });
    expect(await svc.isDuplicateJob("school-1", "hash-B")).toBe(false);
  });
});

// ── 8. addTopUp ──────────────────────────────────────────────────────────────

describe("addTopUp", () => {
  it("increases topUpPages by bundle size and remaining pages accordingly", async () => {
    const store = createInMemorySmartPageStore();
    await store.savePlan(starterPlan({ includedPages: 2000, topUpPages: 0, usedPages: 2000 }));
    const svc = createSmartPagesService(store);

    const before = await svc.getSummary("school-1");
    expect(before.remainingPages).toBe(0);

    await svc.addTopUp("school-1", 1000);

    const after = await svc.getSummary("school-1");
    expect(after.topUpPages).toBe(1000);
    expect(after.remainingPages).toBe(1000);
  });
});

// ── 9–10. isHighAccuracyAllowed ───────────────────────────────────────────────

describe("isHighAccuracyAllowed", () => {
  it("returns false for STARTER plan", async () => {
    const store = createInMemorySmartPageStore();
    await store.savePlan(starterPlan({ planName: "STARTER", allowHighAccuracy: false }));
    const svc = createSmartPagesService(store);
    expect(await svc.isHighAccuracyAllowed("school-1")).toBe(false);
  });

  it("returns false for STANDARD plan", async () => {
    const store = createInMemorySmartPageStore();
    await store.savePlan(starterPlan({ planName: "STANDARD", allowHighAccuracy: false }));
    const svc = createSmartPagesService(store);
    expect(await svc.isHighAccuracyAllowed("school-1")).toBe(false);
  });

  it("returns true for PRO plan", async () => {
    const store = createInMemorySmartPageStore();
    await store.savePlan(starterPlan({ planName: "PRO", allowHighAccuracy: true }));
    const svc = createSmartPagesService(store);
    expect(await svc.isHighAccuracyAllowed("school-1")).toBe(true);
  });

  it("returns true for ENTERPRISE plan", async () => {
    const store = createInMemorySmartPageStore();
    await store.savePlan(starterPlan({ planName: "ENTERPRISE", allowHighAccuracy: true }));
    const svc = createSmartPagesService(store);
    expect(await svc.isHighAccuracyAllowed("school-1")).toBe(true);
  });

  it("returns false when no plan exists", async () => {
    const store = createInMemorySmartPageStore();
    const svc = createSmartPagesService(store);
    expect(await svc.isHighAccuracyAllowed("school-1")).toBe(false);
  });
});

// ── 11. Provider failure does not charge pages ────────────────────────────────

describe("provider failure handling", () => {
  it("recording a FAILED ledger entry does not increment usedPages", async () => {
    const store = createInMemorySmartPageStore();
    await store.savePlan(starterPlan({ usedPages: 10 }));
    // Record failure directly ? route would call this when extraction throws
    await store.addLedgerEntry({
      schoolId: "school-1",
      jobId: "job-fail",
      fileHash: "fail-xyz",
      pagesCharged: 0,
      extractionMode: "balanced",
      provider: "azure",
      model: "read-layout",
      action: "EXTRACT",
      reason: "provider error",
      status: "FAILED",
    });
    const svc = createSmartPagesService(store);
    const summary = await svc.getSummary("school-1");
    expect(summary.usedPages).toBe(10); // unchanged ? FAILED entries don't charge
  });
});

