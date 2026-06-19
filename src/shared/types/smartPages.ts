export type ExtractionMode = "economical" | "balanced" | "high_accuracy";

export type PlanName = "TRIAL" | "STARTER" | "STANDARD" | "SCHOOL_PRO" | "PRO" | "ENTERPRISE";

export type TopUpBundle = 20 | 100 | 500 | 1000;
export type SmartPagesPackageCode = "TRIAL" | "STARTER" | "STANDARD" | "SCHOOL_PRO";
export type SmartPagesPaymentNetwork = "AIRTEL" | "MTN";
export type SmartPagesPaymentStatus = "PENDING" | "CONFIRMED" | "REJECTED";
export type SmartPagesBillingOperation =
  | "EXTRACT"
  | "HIGH_ACCURACY_EXTRACT"
  | "GENERATE_DOCUMENT"
  | "PUBLISH_DOCUMENT"
  | "TOP_UP"
  | "REFUND";

export const SMART_PAGES_CREDIT_PRICE_UGX = 500;
export const SMART_PAGES_HIGH_ACCURACY_MULTIPLIER = 2;
export const SMART_PAGES_GENERATE_DOCUMENT_CREDITS_PER_PAGE = 1;
export const SMART_PAGES_PUBLISH_CREDITS_PER_DOCUMENT = 1;

export type SmartPagesPricingConfig = {
  creditPriceUgx: number;
  highAccuracyMultiplier: number;
  generateDocumentCreditsPerPage: number;
  publishCreditsPerDocument: number;
};

export type SmartPagesPackage = {
  code: SmartPagesPackageCode;
  name: string;
  credits: number;
  priceUgx: number;
};

export const SMART_PAGES_PACKAGES: SmartPagesPackage[] = [
  { code: "TRIAL", name: "Trial", credits: 10, priceUgx: 0 },
  { code: "STARTER", name: "Starter", credits: 100, priceUgx: 50_000 },
  { code: "STANDARD", name: "Standard", credits: 500, priceUgx: 225_000 },
  { code: "SCHOOL_PRO", name: "School Pro", credits: 1_000, priceUgx: 400_000 },
];

export const PLAN_INCLUDED_PAGES: Record<PlanName, number> = {
  TRIAL: 10,
  STARTER: 100,
  STANDARD: 500,
  SCHOOL_PRO: 1000,
  PRO: 1000,
  ENTERPRISE: 0,
};

export const TOP_UP_BUNDLES: TopUpBundle[] = [20, 100, 500, 1000];

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
  id?: string;
  schoolId: string;
  jobId: string;
  fileHash: string;
  pagesCharged: number;
  creditsCharged?: number;
  operation?: SmartPagesBillingOperation;
  pagesProcessed?: number;
  priceUgx?: number;
  action: SmartPageLedgerAction;
  reason: string;
  provider: string;
  model: string;
  extractionMode: ExtractionMode;
  status: SmartPageLedgerStatus;
  createdAt?: string;
  tokenUsage?: Record<string, unknown> | null;
  geminiCostEstimateUgx?: number | null;
  marginEstimateUgx?: number | null;
};

export type SmartPageSummary = {
  includedPages: number;
  topUpPages: number;
  usedPages: number;
  remainingPages: number;
  includedCredits: number;
  topUpCredits: number;
  usedCredits: number;
  remainingCredits: number;
  planName: PlanName | null;
  billingCycle: string;
  allowHighAccuracy: boolean;
};

export type SmartPagesSchoolLedgerRow = {
  id?: string;
  operation: SmartPagesBillingOperation;
  pagesProcessed: number;
  creditsUsed: number;
  creditsRemainingAfter?: number | null;
  priceUgx: number;
  status: SmartPageLedgerStatus;
  createdAt: string;
};

export type SmartPagesAdminLedgerRow = SmartPagesSchoolLedgerRow & {
  model: string;
  tokenUsage?: Record<string, unknown> | null;
  geminiCostEstimateUgx?: number | null;
  marginEstimateUgx?: number | null;
};

export type SmartPagesPaymentConfig = {
  networks: Array<{
    network: SmartPagesPaymentNetwork;
    label: string;
    merchantCode: string;
    merchantName: string;
  }>;
  packages: SmartPagesPackage[];
  pricing: SmartPagesPricingConfig;
};

export type SmartPagesPaymentRequest = {
  id: string;
  schoolId: string;
  schoolName?: string;
  packageCode: SmartPagesPackageCode;
  packageName: string;
  credits: number;
  amountUgx: number;
  network: SmartPagesPaymentNetwork;
  merchantCode: string;
  merchantName: string;
  paymentReference: string;
  transactionId?: string | null;
  payerPhone?: string | null;
  proofScreenshotUrl?: string | null;
  status: SmartPagesPaymentStatus;
  adminNotes?: string | null;
  createdAt: string;
  updatedAt?: string;
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
