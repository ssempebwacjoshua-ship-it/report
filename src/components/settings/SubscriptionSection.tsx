import { useEffect, useState } from "react";
import { fetchSubscription } from "../../client/subscriptionClient";
import type { SchoolSubscription, SubscriptionInvoice } from "../../shared/types/subscription";
import { getPlanByCode, formatUgx, REPORT_LAB_PLAN_FEATURES, REPORT_LAB_ADD_ONS } from "../../shared/constants/subscriptionPlans";

const STATUS_STYLES: Record<string, string> = {
  ACTIVE: "bg-emerald-50 text-emerald-700 border-emerald-200",
  EXPIRED: "bg-red-50 text-red-700 border-red-200",
  SUSPENDED: "bg-orange-50 text-orange-700 border-orange-200",
  PENDING: "bg-yellow-50 text-yellow-700 border-yellow-200",
};

const INVOICE_STATUS_STYLES: Record<string, string> = {
  PAID: "bg-emerald-50 text-emerald-700 border-emerald-200",
  UNPAID: "bg-yellow-50 text-yellow-800 border-yellow-200",
  CANCELLED: "bg-slate-50 text-slate-500 border-slate-200",
};

function StatusBadge({ status, styleMap }: { status: string; styleMap: Record<string, string> }) {
  const cls = styleMap[status] ?? "bg-slate-50 text-slate-600 border-slate-200";
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-bold ${cls}`}>
      {status}
    </span>
  );
}

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-slate-100 py-2.5 last:border-b-0">
      <span className="text-xs font-bold uppercase tracking-wide text-slate-500 shrink-0">{label}</span>
      <span className="text-right text-sm text-slate-900">{children}</span>
    </div>
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-UG", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function ActiveSubscriptionView({
  sub,
  invoice,
}: {
  sub: SchoolSubscription;
  invoice: SubscriptionInvoice | null;
}) {
  const plan = getPlanByCode(sub.planCode);

  return (
    <div className="grid gap-4">
      {/* Plan overview card */}
      <section className="premium-card rounded-xl p-4">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-blue-600">Active Plan</p>
            <h3 className="text-lg font-black text-slate-950">{plan?.name ?? sub.planCode}</h3>
          </div>
          <StatusBadge status={sub.status} styleMap={STATUS_STYLES} />
        </div>

        <div className="divide-y divide-slate-100">
          <InfoRow label="Student band">{plan?.name ?? sub.planCode}</InfoRow>
          <InfoRow label="Annual License">
            {plan?.annualLicenseUgx != null ? (
              <span>{formatUgx(plan.annualLicenseUgx)}<span className="text-xs text-slate-500">/year</span></span>
            ) : (
              "Quoted"
            )}
          </InfoRow>
          <InfoRow label="Setup Fee">
            {plan?.setupFeeUgx != null ? (
              <span>{formatUgx(plan.setupFeeUgx)} <span className="text-xs text-slate-500">one-time payment</span></span>
            ) : (
              "Quoted"
            )}
          </InfoRow>
          <InfoRow label="Billing cycle">Yearly Subscription</InfoRow>
          <InfoRow label="Renewal date">{formatDate(sub.currentPeriodEnd)}</InfoRow>
          {sub.studentLimit != null && (
            <InfoRow label="Student limit">{sub.studentLimit.toLocaleString()} students</InfoRow>
          )}
        </div>
      </section>

      {/* Latest invoice */}
      {invoice && (
        <section className="premium-card rounded-xl p-4">
          <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Latest Invoice</p>
            <StatusBadge status={invoice.status} styleMap={INVOICE_STATUS_STYLES} />
          </div>
          <div className="divide-y divide-slate-100">
            <InfoRow label="Setup Fee ? one-time payment">{formatUgx(invoice.setupFeeUgx)}</InfoRow>
            <InfoRow label="Yearly Subscription">{formatUgx(invoice.amountUgx)}</InfoRow>
            <InfoRow label="Total">
              <span className="font-bold">{formatUgx(invoice.totalUgx)}</span>
            </InfoRow>
            {invoice.paidAt && (
              <InfoRow label="Paid on">{formatDate(invoice.paidAt)}</InfoRow>
            )}
            {invoice.notes && (
              <InfoRow label="Notes">{invoice.notes}</InfoRow>
            )}
          </div>
        </section>
      )}

      {/* Features */}
      <section className="premium-card rounded-xl p-4">
        <p className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-500">Included in all plans</p>
        <ul className="grid gap-1.5 sm:grid-cols-2">
          {REPORT_LAB_PLAN_FEATURES.map((f) => (
            <li key={f} className="flex items-center gap-2 text-sm text-slate-700">
              <span className="text-emerald-600 shrink-0">✓</span>{f}
            </li>
          ))}
        </ul>
        <p className="mt-4 mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">Add-ons (quoted separately)</p>
        <ul className="grid gap-1 sm:grid-cols-2">
          {REPORT_LAB_ADD_ONS.map((a) => (
            <li key={a} className="text-xs text-slate-500">{a}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}

export function SubscriptionSection() {
  const [loading, setLoading] = useState(true);
  const [sub, setSub] = useState<SchoolSubscription | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchSubscription()
      .then((data) => setSub(data.subscription))
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="premium-card rounded-xl p-5 text-sm text-slate-600">
        Loading subscription...
      </div>
    );
  }

  if (error) {
    return (
      <div className="premium-card rounded-xl p-5">
        <p className="text-sm font-bold text-red-700">Could not load subscription</p>
        <p className="mt-1 text-xs text-slate-600">{error}</p>
      </div>
    );
  }

  if (!sub) {
    return (
      <div className="premium-card rounded-xl p-5">
        <p className="text-xs font-bold uppercase tracking-wide text-slate-400">No Active Subscription</p>
        <p className="mt-2 text-sm text-slate-600">
          No subscription has been assigned to this school yet. Contact support to activate your annual plan.
        </p>
        <div className="mt-4 grid gap-2">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Available plans</p>
          {[
            { label: "Up to 500 Students", setup: "UGX 500,000", annual: "UGX 300,000/year" },
            { label: "Up to 1,000 Students", setup: "UGX 500,000", annual: "UGX 600,000/year" },
            { label: "Up to 1,500 Students", setup: "UGX 1,000,000", annual: "UGX 900,000/year" },
            { label: "Up to 2,000 Students", setup: "UGX 1,000,000", annual: "UGX 1,200,000/year" },
            { label: "2,000+ Students", setup: "Quoted", annual: "Quoted" },
          ].map((p) => (
            <div key={p.label} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
              <p className="text-sm font-bold text-slate-900">{p.label}</p>
              <p className="text-xs text-slate-500">
                Setup Fee: {p.setup} ? Annual License: {p.annual}
              </p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return <ActiveSubscriptionView sub={sub} invoice={sub.latestInvoice} />;
}

