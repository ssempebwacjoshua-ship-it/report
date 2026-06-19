import { useCallback, useEffect, useState } from "react";
import {
  claimFreeTrial,
  fetchSmartPagesBillingConfig,
  fetchSmartPagesBillingSummary,
  prepareSmartPagesPayment,
  submitSmartPagesPaymentReceipt,
} from "../../client/smartPagesBillingClient";
import { SMART_PAGES_PACKAGES } from "../../shared/types/smartPages";
import type {
  SmartPageSummary,
  SmartPagesPackage,
  SmartPagesPackageCode,
  SmartPagesPaymentConfig,
  SmartPagesPaymentNetwork,
  SmartPagesPaymentRequest,
  SmartPagesSchoolLedgerRow,
} from "../../shared/types/smartPages";

const OPERATION_LABELS: Record<string, string> = {
  EXTRACT: "OCR Extraction",
  HIGH_ACCURACY_EXTRACT: "High Accuracy Extraction",
  GENERATE_DOCUMENT: "Document Generation",
  PUBLISH_DOCUMENT: "Document Publishing",
  TOP_UP: "Pages Top-up",
  REFUND: "Refund",
};

const PAYMENT_STATUS_STYLES: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-700",
  CONFIRMED: "bg-emerald-100 text-emerald-700",
  REJECTED: "bg-red-100 text-red-600",
};

function fmtUgx(ugx: number) {
  return ugx === 0 ? "Free" : `UGX ${ugx.toLocaleString()}`;
}

function friendlyError(e: unknown, fallback: string) {
  if (e instanceof TypeError) return fallback;
  return (e instanceof Error ? e.message : null) || fallback;
}

type BuyStep = "package" | "network" | "receipt" | "done";

export function SmartPagesBillingPage() {
  const [summary, setSummary] = useState<SmartPageSummary | null>(null);
  const [ledger, setLedger] = useState<SmartPagesSchoolLedgerRow[]>([]);
  const [payments, setPayments] = useState<SmartPagesPaymentRequest[]>([]);
  const [config, setConfig] = useState<SmartPagesPaymentConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  // Claim trial state
  const [claiming, setClaiming] = useState(false);
  const [claimError, setClaimError] = useState("");

  // Buy credits flow state
  const [buyStep, setBuyStep] = useState<BuyStep | null>(null);
  const [selectedPackage, setSelectedPackage] = useState<SmartPagesPackage | null>(null);
  const [selectedNetwork, setSelectedNetwork] = useState<SmartPagesPaymentNetwork | null>(null);
  const [activePayment, setActivePayment] = useState<SmartPagesPaymentRequest | null>(null);
  const [transactionId, setTransactionId] = useState("");
  const [payerPhone, setPayerPhone] = useState("");
  const [prepareBusy, setPrepareBusy] = useState(false);
  const [submitBusy, setSubmitBusy] = useState(false);
  const [buyError, setBuyError] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    setLoadError("");
    Promise.all([fetchSmartPagesBillingSummary(), fetchSmartPagesBillingConfig()])
      .then(([billingData, configData]) => {
        setSummary(billingData.summary);
        setLedger(billingData.ledger);
        setPayments(billingData.payments);
        setConfig(configData);
      })
      .catch((e: unknown) =>
        setLoadError(friendlyError(e, "Could not load billing information. Please try again."))
      )
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleClaimTrial() {
    setClaiming(true);
    setClaimError("");
    try {
      const data = await claimFreeTrial();
      setSummary(data.summary);
    } catch (e) {
      setClaimError(friendlyError(e, "Could not claim free trial. Please try again."));
    } finally {
      setClaiming(false);
    }
  }

  function openBuyFlow() {
    setSelectedPackage(null);
    setSelectedNetwork(null);
    setActivePayment(null);
    setTransactionId("");
    setPayerPhone("");
    setBuyError("");
    setBuyStep("package");
  }

  function closeBuyFlow() {
    setBuyStep(null);
    setActivePayment(null);
    setBuyError("");
  }

  async function handlePrepare() {
    if (!selectedPackage || !selectedNetwork) return;
    setPrepareBusy(true);
    setBuyError("");
    try {
      const payment = await prepareSmartPagesPayment({
        packageCode: selectedPackage.code,
        network: selectedNetwork,
        amountUgx: selectedPackage.priceUgx,
      });
      setActivePayment(payment);
      setBuyStep("receipt");
    } catch (e) {
      setBuyError(friendlyError(e, "Could not prepare payment. Please try again."));
    } finally {
      setPrepareBusy(false);
    }
  }

  async function handleSubmitReceipt() {
    if (!activePayment || !selectedPackage || !selectedNetwork) return;
    if (!transactionId.trim()) {
      setBuyError("Please enter the transaction ID from your Mobile Money message.");
      return;
    }
    setSubmitBusy(true);
    setBuyError("");
    try {
      await submitSmartPagesPaymentReceipt(activePayment.id, {
        packageCode: selectedPackage.code,
        network: selectedNetwork,
        amountUgx: selectedPackage.priceUgx,
        transactionId: transactionId.trim(),
        payerPhone: payerPhone.trim() || undefined,
      });
      setBuyStep("done");
      load();
    } catch (e) {
      setBuyError(friendlyError(e, "Could not submit payment. Please check your details and try again."));
    } finally {
      setSubmitBusy(false);
    }
  }

  function getMerchantCode(network: SmartPagesPaymentNetwork): string {
    const entry = config?.networks.find((n) => n.network === network);
    if (entry?.merchantCode) return entry.merchantCode;
    return network === "AIRTEL" ? "7097959" : "98642335";
  }

  function getMerchantName(network: SmartPagesPaymentNetwork): string {
    const entry = config?.networks.find((n) => n.network === network);
    return entry?.merchantName || "School Connect";
  }

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="text-sm text-slate-500">Loading billing...</p>
      </div>
    );
  }

  const trialClaimed = summary?.trialClaimed ?? false;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Page heading */}
      <div>
        <h1 className="text-xl font-black text-slate-950">Billing</h1>
        <p className="mt-0.5 text-sm text-slate-500">
          Manage your Smart Pages and payment history.
        </p>
      </div>

      {loadError ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3">
          <p className="text-sm text-red-700">{loadError}</p>
          <button
            type="button"
            onClick={load}
            className="mt-2 text-sm font-semibold text-red-600 underline underline-offset-2"
          >
            Try again
          </button>
        </div>
      ) : null}

      {/* No plan — prompt to claim trial */}
      {summary && !trialClaimed ? (
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3">
          <p className="text-sm font-semibold text-blue-800">
            Claim your 10 free pages to start.
          </p>
          <p className="mt-0.5 text-xs text-blue-600">
            Use the Trial card below to claim your free trial — no payment needed.
          </p>
        </div>
      ) : null}

      {/* Pages balance card */}
      {summary ? (
        <div className="premium-card rounded-2xl p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-blue-600">Smart Pages</p>
              <p className="mt-1 text-3xl font-black text-slate-950">
                {summary.remainingPages.toLocaleString()}
              </p>
              <p className="mt-1 text-sm text-slate-500">pages remaining</p>
            </div>
            <button
              type="button"
              className="btn btn-primary shrink-0"
              onClick={openBuyFlow}
            >
              Buy Pages
            </button>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-3 border-t border-slate-100 pt-4">
            <div>
              <p className="text-xs text-slate-500">Included</p>
              <p className="mt-0.5 font-bold text-slate-800">
                {summary.includedPages.toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Purchased</p>
              <p className="mt-0.5 font-bold text-slate-800">
                {summary.topUpPages.toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Used</p>
              <p className="mt-0.5 font-bold text-slate-800">{summary.usedPages.toLocaleString()}</p>
            </div>
          </div>
          <p className="mt-3 text-xs text-slate-400">
            Smart Pages are used to process, generate, and publish documents.
          </p>
        </div>
      ) : null}

      {/* Page Packages */}
      <div>
        <h2 className="mb-3 text-sm font-black uppercase tracking-wide text-slate-700">Page Packages</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {SMART_PAGES_PACKAGES.map((pkg) => {
            const isTrial = pkg.priceUgx === 0;
            return (
              <div key={pkg.code} className="premium-card flex flex-col rounded-xl p-4">
                <p className="font-bold text-slate-900">{pkg.name}</p>
                {isTrial ? (
                  <>
                    <p className="mt-1 text-2xl font-black text-emerald-700">
                      {pkg.credits.toLocaleString()}{" "}
                      <span className="ml-1 text-base font-semibold text-emerald-600">free pages</span>
                    </p>
                    <p className="mt-2 text-sm font-bold text-emerald-700">Free</p>
                    <p className="mt-0.5 text-xs text-slate-500">One-time free trial — no payment needed</p>
                    <div className="mt-auto pt-3">
                      {trialClaimed ? (
                        <button
                          type="button"
                          disabled
                          className="w-full cursor-not-allowed rounded-lg border border-slate-200 bg-slate-50 py-1.5 text-xs font-bold text-slate-400"
                        >
                          Trial already claimed
                        </button>
                      ) : (
                        <>
                          <button
                            type="button"
                            disabled={claiming}
                            className="w-full rounded-lg border border-emerald-300 bg-emerald-50 py-1.5 text-xs font-bold text-emerald-700 hover:bg-emerald-100 disabled:opacity-60"
                            onClick={() => void handleClaimTrial()}
                          >
                            {claiming ? "Claiming..." : "Claim free trial"}
                          </button>
                          {claimError ? (
                            <p className="mt-1 text-xs text-red-600">{claimError}</p>
                          ) : null}
                        </>
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <p className="mt-1 text-2xl font-black text-slate-950">
                      {pkg.credits.toLocaleString()}{" "}
                      <span className="ml-1 text-base font-semibold text-slate-600">pages</span>
                    </p>
                    <p className="mt-2 text-sm font-bold text-blue-700">{fmtUgx(pkg.priceUgx)}</p>
                    <div className="mt-auto pt-3">
                      <button
                        type="button"
                        className="w-full rounded-lg border border-blue-200 bg-blue-50 py-1.5 text-xs font-bold text-blue-700 hover:bg-blue-100"
                        onClick={() => {
                          setSelectedPackage(pkg);
                          setBuyStep("network");
                        }}
                      >
                        Buy {pkg.name}
                      </button>
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
        <p className="mt-3 text-xs text-slate-500">
          1 page = 1 Smart Pages credit. High-accuracy handwriting uses 2 credits per page.
        </p>
        <div className="mt-2 rounded-lg bg-slate-50 px-4 py-3 text-xs text-slate-600 space-y-1">
          <p><span className="font-semibold">Normal extraction</span> — 1 credit per page</p>
          <p><span className="font-semibold">High-accuracy (handwriting)</span> — 2 credits per page</p>
          <p><span className="font-semibold">Generate editable document</span> — +1 credit per output page</p>
          <p><span className="font-semibold">Publish secure link / PDF</span> — +1 credit per document</p>
        </div>
      </div>

      {/* Recent payments */}
      <div>
        <h2 className="mb-3 text-sm font-black uppercase tracking-wide text-slate-700">Recent Payments</h2>
        {payments.length === 0 ? (
          <div className="rounded-xl border border-slate-100 bg-white py-8 text-center">
            <p className="text-sm text-slate-400">No payment records yet.</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-slate-100 bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="px-4 py-2.5 text-left text-xs font-bold text-slate-500">Package</th>
                  <th className="px-4 py-2.5 text-left text-xs font-bold text-slate-500">Network</th>
                  <th className="px-4 py-2.5 text-right text-xs font-bold text-slate-500">Pages</th>
                  <th className="px-4 py-2.5 text-right text-xs font-bold text-slate-500">Amount</th>
                  <th className="px-4 py-2.5 text-left text-xs font-bold text-slate-500">Status</th>
                  <th className="px-4 py-2.5 text-left text-xs font-bold text-slate-500">Date</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id} className="border-b border-slate-50 last:border-0">
                    <td className="px-4 py-2.5 font-medium text-slate-800">{p.packageName}</td>
                    <td className="px-4 py-2.5 text-slate-600">{p.network}</td>
                    <td className="px-4 py-2.5 text-right font-medium text-slate-800">
                      {p.credits.toLocaleString()}
                    </td>
                    <td className="px-4 py-2.5 text-right text-slate-600">
                      {fmtUgx(p.amountUgx)}
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          PAYMENT_STATUS_STYLES[p.status] ?? "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {p.status.charAt(0) + p.status.slice(1).toLowerCase()}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-slate-500">
                      {new Date(p.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Recent page usage */}
      <div>
        <h2 className="mb-3 text-sm font-black uppercase tracking-wide text-slate-700">Recent Page Usage</h2>
        {ledger.length === 0 ? (
          <div className="rounded-xl border border-slate-100 bg-white py-8 text-center">
            <p className="text-sm text-slate-400">No page usage recorded yet.</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-slate-100 bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="px-4 py-2.5 text-left text-xs font-bold text-slate-500">Operation</th>
                  <th className="px-4 py-2.5 text-right text-xs font-bold text-slate-500">Pages</th>
                  <th className="px-4 py-2.5 text-right text-xs font-bold text-slate-500">Pages used</th>
                  <th className="px-4 py-2.5 text-right text-xs font-bold text-slate-500">Balance after</th>
                  <th className="px-4 py-2.5 text-left text-xs font-bold text-slate-500">Date</th>
                </tr>
              </thead>
              <tbody>
                {ledger.map((row, i) => (
                  <tr key={row.id ?? i} className="border-b border-slate-50 last:border-0">
                    <td className="px-4 py-2.5 font-medium text-slate-800">
                      {OPERATION_LABELS[row.operation] ?? row.operation}
                    </td>
                    <td className="px-4 py-2.5 text-right text-slate-600">{row.pagesProcessed}</td>
                    <td className="px-4 py-2.5 text-right font-medium text-slate-800">
                      {row.creditsUsed}
                    </td>
                    <td className="px-4 py-2.5 text-right text-slate-500">
                      {row.creditsRemainingAfter != null ? row.creditsRemainingAfter.toLocaleString() : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-slate-500">
                      {new Date(row.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Buy Pages modal */}
      {buyStep ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/60 p-4 sm:items-center">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
            {/* Step: select package */}
            {buyStep === "package" && (
              <div className="p-5">
                <h2 className="text-base font-black text-slate-900">Buy Pages</h2>
                <p className="mt-1 text-sm text-slate-500">Choose a page package.</p>
                <div className="mt-4 grid gap-3">
                  {SMART_PAGES_PACKAGES.filter((p) => p.priceUgx > 0).map((pkg) => (
                    <button
                      key={pkg.code}
                      type="button"
                      onClick={() => {
                        setSelectedPackage(pkg);
                        setBuyStep("network");
                      }}
                      className={`flex items-center justify-between rounded-xl border px-4 py-3 text-left transition hover:border-blue-300 hover:bg-blue-50 ${
                        selectedPackage?.code === pkg.code
                          ? "border-blue-500 bg-blue-50"
                          : "border-slate-200"
                      }`}
                    >
                      <div>
                        <p className="font-bold text-slate-900">{pkg.name}</p>
                        <p className="text-sm font-semibold text-slate-700">
                          {pkg.credits.toLocaleString()}{" "}pages
                        </p>
                      </div>
                      <p className="shrink-0 font-bold text-blue-700">{fmtUgx(pkg.priceUgx)}</p>
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  className="mt-4 w-full rounded-lg border border-slate-200 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                  onClick={closeBuyFlow}
                >
                  Cancel
                </button>
              </div>
            )}

            {/* Step: select network + payment instructions */}
            {buyStep === "network" && selectedPackage && (
              <div className="p-5">
                <button
                  type="button"
                  className="mb-1 text-xs font-semibold text-slate-400 hover:text-slate-600"
                  onClick={() => setBuyStep("package")}
                >
                  ← Back
                </button>
                <h2 className="text-base font-black text-slate-900">Pay via Mobile Money</h2>
                <p className="mt-1 text-sm text-slate-500">
                  {selectedPackage.credits.toLocaleString()} pages · {fmtUgx(selectedPackage.priceUgx)}
                </p>
                <p className="mt-3 text-sm font-semibold text-slate-700">Select your network</p>
                <div className="mt-2 grid grid-cols-2 gap-3">
                  {(["AIRTEL", "MTN"] as SmartPagesPaymentNetwork[]).map((network) => (
                    <button
                      key={network}
                      type="button"
                      onClick={() => setSelectedNetwork(network)}
                      className={`rounded-xl border py-4 text-sm font-bold transition ${
                        selectedNetwork === network
                          ? "border-blue-500 bg-blue-50 text-blue-700"
                          : "border-slate-200 text-slate-700 hover:border-blue-200 hover:bg-blue-50"
                      }`}
                    >
                      {network === "AIRTEL" ? "Airtel Money" : "MTN Mobile Money"}
                    </button>
                  ))}
                </div>

                {selectedNetwork && (
                  <div className="mt-4 rounded-xl bg-slate-50 p-4">
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                      {selectedNetwork === "AIRTEL" ? "Airtel" : "MTN"} Merchant Code
                    </p>
                    <p className="mt-1 text-2xl font-black tracking-wider text-slate-900">
                      {getMerchantCode(selectedNetwork)}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">{getMerchantName(selectedNetwork)}</p>
                    <ol className="mt-3 space-y-1 text-xs text-slate-600">
                      <li>1. Open your Mobile Money app or dial *185# (Airtel) or *165# (MTN)</li>
                      <li>2. Select "Pay Merchant" / "Pay Bill"</li>
                      <li>3. Enter merchant code: <span className="font-bold">{getMerchantCode(selectedNetwork)}</span></li>
                      <li>4. Enter amount: <span className="font-bold">UGX {selectedPackage.priceUgx.toLocaleString()}</span></li>
                      <li>5. Confirm and note your transaction ID</li>
                    </ol>
                  </div>
                )}

                {buyError ? (
                  <p className="mt-3 text-sm text-red-600">{buyError}</p>
                ) : null}

                <div className="mt-4 flex gap-2">
                  <button
                    type="button"
                    className="flex-1 rounded-lg border border-slate-200 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                    onClick={closeBuyFlow}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary flex-1"
                    disabled={!selectedNetwork || prepareBusy}
                    onClick={() => void handlePrepare()}
                  >
                    {prepareBusy ? "Preparing..." : "I have paid →"}
                  </button>
                </div>
              </div>
            )}

            {/* Step: enter transaction ID */}
            {buyStep === "receipt" && activePayment && selectedPackage && (
              <div className="p-5">
                <button
                  type="button"
                  className="mb-1 text-xs font-semibold text-slate-400 hover:text-slate-600"
                  onClick={() => setBuyStep("network")}
                >
                  ← Back
                </button>
                <h2 className="text-base font-black text-slate-900">Enter Transaction ID</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Enter the transaction ID from your Mobile Money confirmation message.
                </p>

                <div className="mt-4 space-y-3">
                  <div>
                    <label className="mb-1 block text-xs font-bold text-slate-700">
                      Transaction ID <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. MP230600001234"
                      value={transactionId}
                      onChange={(e) => setTransactionId(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-400"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-bold text-slate-700">
                      Payer Phone Number <span className="text-slate-400">(optional)</span>
                    </label>
                    <input
                      type="tel"
                      placeholder="e.g. 0700123456"
                      value={payerPhone}
                      onChange={(e) => setPayerPhone(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-400"
                    />
                  </div>
                </div>

                <div className="mt-3 rounded-lg bg-slate-50 px-3 py-2.5 text-xs text-slate-500">
                  Ref: <span className="font-mono font-bold">{activePayment.paymentReference}</span>
                </div>

                {buyError ? (
                  <p className="mt-3 text-sm text-red-600">{buyError}</p>
                ) : null}

                <div className="mt-4 flex gap-2">
                  <button
                    type="button"
                    className="flex-1 rounded-lg border border-slate-200 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                    onClick={closeBuyFlow}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary flex-1"
                    disabled={submitBusy}
                    onClick={() => void handleSubmitReceipt()}
                  >
                    {submitBusy ? "Submitting..." : "Submit Payment"}
                  </button>
                </div>
              </div>
            )}

            {/* Step: done — pending, not paid */}
            {buyStep === "done" && (
              <div className="p-6 text-center">
                <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full bg-amber-100">
                  <svg viewBox="0 0 24 24" className="h-6 w-6 text-amber-600" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 8v4m0 4h.01" />
                  </svg>
                </div>
                <h2 className="text-base font-black text-slate-900">Payment Submitted</h2>
                <p className="mt-2 text-sm text-slate-500">
                  Your pages will be added after admin confirmation. This usually takes 1–2 business hours.
                </p>
                <p className="mt-1.5 text-xs text-amber-600 font-medium">
                  Status: Pending — pages not added yet.
                </p>
                <button
                  type="button"
                  className="btn btn-primary mt-5 w-full"
                  onClick={closeBuyFlow}
                >
                  Done
                </button>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
