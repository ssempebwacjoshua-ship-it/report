export type PlanCode =
  | "REPORT_LAB_500"
  | "REPORT_LAB_1000"
  | "REPORT_LAB_1500"
  | "REPORT_LAB_2000"
  | "REPORT_LAB_CUSTOM";

export type ReportLabPlan = {
  code: PlanCode;
  name: string;
  studentLimit: number | null;
  setupFeeUgx: number | null;
  annualLicenseUgx: number | null;
  billingCycle: "YEAR";
  features: string[];
  addOns: string[];
};

export const REPORT_LAB_PLAN_FEATURES = [
  "Marks upload/import",
  "Report generation",
  "Print and download reports",
  "Parent report links",
  "Release Center",
  "QR/reference verification",
  "School branding",
  "Basic support",
];

export const REPORT_LAB_ADD_ONS = [
  "SMS/WhatsApp delivery costs",
  "Custom report template",
  "Website/parent portal integration",
  "Onsite training",
  "Data migration",
  "Dedicated support package",
];

export const REPORT_LAB_PLANS: ReportLabPlan[] = [
  {
    code: "REPORT_LAB_500",
    name: "Up to 500 Students",
    studentLimit: 500,
    setupFeeUgx: 500_000,
    annualLicenseUgx: 300_000,
    billingCycle: "YEAR",
    features: REPORT_LAB_PLAN_FEATURES,
    addOns: REPORT_LAB_ADD_ONS,
  },
  {
    code: "REPORT_LAB_1000",
    name: "Up to 1,000 Students",
    studentLimit: 1000,
    setupFeeUgx: 500_000,
    annualLicenseUgx: 600_000,
    billingCycle: "YEAR",
    features: REPORT_LAB_PLAN_FEATURES,
    addOns: REPORT_LAB_ADD_ONS,
  },
  {
    code: "REPORT_LAB_1500",
    name: "Up to 1,500 Students",
    studentLimit: 1500,
    setupFeeUgx: 1_000_000,
    annualLicenseUgx: 900_000,
    billingCycle: "YEAR",
    features: REPORT_LAB_PLAN_FEATURES,
    addOns: REPORT_LAB_ADD_ONS,
  },
  {
    code: "REPORT_LAB_2000",
    name: "Up to 2,000 Students",
    studentLimit: 2000,
    setupFeeUgx: 1_000_000,
    annualLicenseUgx: 1_200_000,
    billingCycle: "YEAR",
    features: REPORT_LAB_PLAN_FEATURES,
    addOns: REPORT_LAB_ADD_ONS,
  },
  {
    code: "REPORT_LAB_CUSTOM",
    name: "2,000+ Students",
    studentLimit: null,
    setupFeeUgx: null,
    annualLicenseUgx: null,
    billingCycle: "YEAR",
    features: REPORT_LAB_PLAN_FEATURES,
    addOns: REPORT_LAB_ADD_ONS,
  },
];

export function getPlanByCode(code: string): ReportLabPlan | null {
  return REPORT_LAB_PLANS.find((p) => p.code === code) ?? null;
}

export function formatUgx(amount: number): string {
  return `UGX ${amount.toLocaleString("en-UG")}`;
}

