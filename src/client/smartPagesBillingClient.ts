import { getApiBaseUrl, makeRequestHeaders, parseApiError } from "./apiBase";
import type {
  SmartPageSummary,
  SmartPagesPaymentConfig,
  SmartPagesPaymentNetwork,
  SmartPagesPackageCode,
  SmartPagesPaymentRequest,
  SmartPagesSchoolLedgerRow,
} from "../shared/types/smartPages";

const API_BASE = getApiBaseUrl();

async function json<T>(res: Response, fallback: string): Promise<T> {
  if (!res.ok) throw new Error(await parseApiError(res, fallback));
  return res.json() as Promise<T>;
}

export async function fetchSmartPagesBillingConfig(): Promise<SmartPagesPaymentConfig> {
  const res = await fetch(`${API_BASE}/api/smart-pages/billing/config`, { headers: makeRequestHeaders() });
  return json(res, "Could not load Smart Pages billing config");
}

export async function fetchSmartPagesBillingSummary(): Promise<{
  summary: SmartPageSummary;
  ledger: SmartPagesSchoolLedgerRow[];
  payments: SmartPagesPaymentRequest[];
}> {
  const res = await fetch(`${API_BASE}/api/smart-pages/billing/summary`, { headers: makeRequestHeaders() });
  return json(res, "Could not load Smart Pages billing");
}

export async function prepareSmartPagesPayment(input: {
  packageCode: SmartPagesPackageCode;
  network: SmartPagesPaymentNetwork;
  amountUgx: number;
}): Promise<SmartPagesPaymentRequest> {
  const res = await fetch(`${API_BASE}/api/smart-pages/billing/payments`, {
    method: "POST",
    headers: makeRequestHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(input),
  });
  const data = await json<{ payment: SmartPagesPaymentRequest }>(res, "Could not prepare Smart Pages payment");
  return data.payment;
}

export async function claimFreeTrial(): Promise<{ summary: SmartPageSummary }> {
  const res = await fetch(`${API_BASE}/api/smart-pages/billing/claim-trial`, {
    method: "POST",
    headers: makeRequestHeaders({ "Content-Type": "application/json" }),
  });
  return json(res, "Could not claim free trial");
}

export async function submitSmartPagesPaymentReceipt(
  paymentId: string,
  input: {
    packageCode: SmartPagesPackageCode;
    network: SmartPagesPaymentNetwork;
    amountUgx: number;
    transactionId: string;
    payerPhone?: string;
    proofScreenshotUrl?: string;
  },
): Promise<SmartPagesPaymentRequest> {
  const res = await fetch(`${API_BASE}/api/smart-pages/billing/payments/${encodeURIComponent(paymentId)}/receipt`, {
    method: "PATCH",
    headers: makeRequestHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(input),
  });
  const data = await json<{ payment: SmartPagesPaymentRequest }>(res, "Could not submit Smart Pages payment receipt");
  return data.payment;
}
