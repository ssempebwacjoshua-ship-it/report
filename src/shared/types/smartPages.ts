export type ExtractionMode = "economical" | "balanced" | "high_accuracy";

export type PlanName = "STARTER" | "STANDARD" | "PRO" | "ENTERPRISE";

export type TopUpBundle = 500 | 1000 | 5000 | 10000;

export const PLAN_INCLUDED_PAGES: Record<PlanName, number> = {
  STARTER: 2000,
  STANDARD: 5000,
  PRO: 15000,
  ENTERPRISE: 0, // configurable per contract
};

export const TOP_UP_BUNDLES: TopUpBundle[] = [500, 1000, 5000, 10000];

export type SmartPagePlanStatus = "ACTIVE" | "EXPIRED" | "SUSPENDED";

export type SmartPagePlan = {
  schoolId: string;
  planName: PlanName;
  includedPages: number;
  billingCycle: "ACADEMIC_YEAR";
  cycleStart: string;
  cycleEnd: string;
  usedPages: number;
  topUpPages: number;
  rolloverPages: number;
  status: SmartPagePlanStatus;
  allowHighAccuracy: boolean;
};

export type SmartPageLedgerAction = "EXTRACT" | "TOP_UP" | "REFUND";
export type SmartPageLedgerStatus = "CHARGED" | "REFUNDED" | "FAILED";

export type SmartPageLedgerEntry = {
  schoolId: string;
  jobId: string;
  fileHash: string;
  pagesCharged: number;
  action: SmartPageLedgerAction;
  reason: string;
  provider: string;
  model: string;
  extractionMode: ExtractionMode;
  status: SmartPageLedgerStatus;
};

export type SmartPageSummary = {
  includedPages: number;
  topUpPages: number;
  usedPages: number;
  remainingPages: number;
  planName: PlanName | null;
  billingCycle: string;
  allowHighAccuracy: boolean;
};

export type SmartPageErrorCode =
  | "SMART_PAGES_EXHAUSTED"
  | "DOCUMENT_PAGE_ESTIMATE_FAILED"
  | "DUPLICATE_DOCUMENT_JOB"
  | "EXTRACTION_PROVIDER_UNAVAILABLE"
  | "HIGH_ACCURACY_NOT_ALLOWED"
  | "DOCUMENT_EXTRACTION_FAILED";

export type CanExtractResult =
  | { allowed: true }
  | { allowed: false; code: SmartPageErrorCode; message: string };
