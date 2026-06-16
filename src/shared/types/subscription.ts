export type SubscriptionBillingCycle = "YEAR";
export type SubscriptionStatus = "ACTIVE" | "EXPIRED" | "SUSPENDED" | "PENDING";
export type InvoiceStatus = "UNPAID" | "PAID" | "CANCELLED";

export type SubscriptionInvoice = {
  id: string;
  setupFeeUgx: number;
  amountUgx: number;
  totalUgx: number;
  status: InvoiceStatus;
  paidAt: string | null;
  notes: string | null;
  createdAt: string;
};

export type SchoolSubscription = {
  id: string;
  planCode: string;
  billingCycle: SubscriptionBillingCycle;
  studentLimit: number | null;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  status: SubscriptionStatus;
  latestInvoice: SubscriptionInvoice | null;
};

export type SubscriptionResponse = {
  subscription: SchoolSubscription | null;
};

export type AssignSubscriptionInput = {
  planCode: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  status?: SubscriptionStatus;
  invoice: {
    setupFeeUgx: number;
    amountUgx: number;
    totalUgx: number;
    status: InvoiceStatus;
    notes?: string;
  };
};
