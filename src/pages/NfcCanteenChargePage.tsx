import { useRef, useState } from "react";
import { WifiOffRegular } from "@fluentui/react-icons";
import { NfcScanPanel } from "../components/nfc/NfcScanPanel";
import { useNfcScanner, type ScanResult } from "../hooks/useNfcScanner";
import { useConnectivityStatus } from "../hooks/useConnectivityStatus";
import { useAuth } from "../contexts/AuthContext";
import { chargeNfcCanteen, resolveWalletStudent } from "../client/studentCredentialsClient";
import { resolveOfflineNfcScan } from "../offline/offlineResolver";
import { queueCanteenCharge, getSnapshotMeta, getAvailableOfflineBalance } from "../offline/offlineStore";
import { isSnapshotValid, isCanteenOfflineEnabled } from "../offline/offlineStatus";
import type { NfcCanteenChargeResult, NfcWalletStudentResolution } from "../shared/types/studentCredentials";

const inputClass =
  "premium-control h-12 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 outline-none focus:border-blue-400 focus:bg-white";

function money(cents: number) {
  return `UGX ${Math.round(cents / 100).toLocaleString()}`;
}

function chargeBlockedMessage(reason?: string) {
  switch (reason) {
    case "insufficient balance": return "Insufficient wallet balance";
    case "wallet frozen": return "Wallet is frozen";
    case "lost or deactivated wristband": return "Wristband is lost or deactivated";
    case "unknown token": return "Tag not found";
    case "inactive student": return "Student is inactive";
    default: return reason ?? "Charge blocked";
  }
}

function getDeviceId(): string {
  const key = "schoolconnect_nfc_device_id";
  let id = localStorage.getItem(key);
  if (!id) { id = crypto.randomUUID(); localStorage.setItem(key, id); }
  return id;
}

type Phase = "setup" | "pin" | "done";

type PendingCharge = {
  tokenOrUid: string;
  idempotencyKey?: string;
  deviceId?: string;
  student: NfcWalletStudentResolution;
};

type OfflinePendingCharge = {
  tokenOrUid: string;
  studentId: string;
  walletId: string | null;
  studentName: string;
  admissionNumber: string;
  className?: string | null;
  balanceCents: number;
  availableBalanceCents: number;
  tagId?: string | null;
};

export function NfcCanteenChargePage() {
  const { user } = useAuth();
  const deviceId = useRef(getDeviceId()).current;

  const { isOfflineReady, pendingCount } = useConnectivityStatus(user?.schoolId, deviceId);

  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [phase, setPhase] = useState<Phase>("setup");
  const [pending, setPending] = useState<PendingCharge | null>(null);
  const [offlinePending, setOfflinePending] = useState<OfflinePendingCharge | null>(null);
  const [pin, setPin] = useState("");
  const [chargeLoading, setChargeLoading] = useState(false);
  const [chargeError, setChargeError] = useState("");
  const [result, setResult] = useState<NfcCanteenChargeResult | null>(null);
  const [offlineResult, setOfflineResult] = useState<{ ok: boolean; reason?: string; balanceCents?: number } | null>(null);

  const amountRef = useRef(amount);
  amountRef.current = amount;
  const descRef = useRef(description);
  descRef.current = description;

  const handleScan = async ({ tokenOrUid, idempotencyKey, deviceId: scanDeviceId }: ScanResult) => {
    const amountUgx = Number(amountRef.current);
    if (!amountUgx || amountUgx <= 0) throw new Error("Enter an amount before scanning.");
    const amountCents = Math.round(amountUgx * 100);

    if (isOfflineReady) {
      if (!user?.schoolId) return;

      const canteen = await isCanteenOfflineEnabled();
      if (!canteen) throw new Error("Offline canteen charging is not enabled for this school.");
      const valid = await isSnapshotValid();
      if (!valid) throw new Error("Offline snapshot has expired. Request a new one from the Offline page.");

      const resolve = await resolveOfflineNfcScan(user.schoolId, tokenOrUid);
      if (!resolve.found) throw new Error("Tag not recognised in offline snapshot.");
      if (resolve.blocked) throw new Error(resolve.reason ?? "Tag is blocked.");
      if (!resolve.student) throw new Error("No student linked to this tag.");

      const wallet = resolve.wallet;
      if (!wallet) throw new Error("No wallet found for this student.");
      if (wallet.status === "FROZEN") throw new Error("Wallet is frozen.");

      const available = await getAvailableOfflineBalance(user.schoolId, scanDeviceId ?? deviceId, resolve.student.id, wallet.balanceCents);
      if (available < amountCents) throw new Error(`Insufficient offline balance (${money(available)} available).`);

      setOfflinePending({
        tokenOrUid,
        studentId: resolve.student.id,
        walletId: null,
        studentName: `${resolve.student.firstName} ${resolve.student.lastName}`.trim(),
        admissionNumber: resolve.student.admissionNumber,
        className: resolve.student.className,
        balanceCents: wallet.balanceCents,
        availableBalanceCents: available,
        tagId: resolve.tag?.id ?? null,
      });
      setChargeError("");
      setPhase("pin");
    } else {
      const studentData = await resolveWalletStudent({ tokenOrUid });
      setPending({ tokenOrUid, idempotencyKey, deviceId: scanDeviceId, student: studentData });
      setPin("");
      setChargeError("");
      setPhase("pin");
    }
  };

  const scanner = useNfcScanner({ onScan: handleScan });

  async function submitCharge() {
    if (isOfflineReady) {
      if (!offlinePending || !user?.schoolId) return;
      const amountUgx = Number(amount);
      if (!amountUgx || amountUgx <= 0) { setChargeError("Invalid amount."); return; }
      const amountCents = Math.round(amountUgx * 100);
      setChargeLoading(true);
      setChargeError("");
      try {
        const meta = await getSnapshotMeta();
        const chargedAt = new Date().toISOString();
        await queueCanteenCharge({
          schoolId: user.schoolId,
          deviceId,
          snapshotId: meta?.snapshotId ?? "unknown",
          studentId: offlinePending.studentId,
          walletId: offlinePending.walletId,
          payload: {
            actionType: "CANTEEN_CHARGE",
            tokenOrUid: offlinePending.tokenOrUid,
            studentId: offlinePending.studentId,
            walletId: offlinePending.walletId,
            tagId: offlinePending.tagId,
            amountCents,
            description: descRef.current || null,
            cashierUserId: user.schoolId,
            chargedAt,
          },
        });
        setOfflineResult({ ok: true, balanceCents: offlinePending.availableBalanceCents - amountCents });
        setPhase("done");
        setAmount("");
        setDescription("");
      } catch (e) {
        setChargeError(e instanceof Error ? e.message : "Charge failed.");
      } finally {
        setPin("");
        setChargeLoading(false);
      }
      return;
    }

    if (!pending || !pin) return;
    const amountUgx = Number(amount);
    if (!amountUgx || amountUgx <= 0) { setChargeError("Invalid amount."); return; }
    setChargeLoading(true);
    setChargeError("");
    try {
      const data = await chargeNfcCanteen({
        tokenOrUid: pending.tokenOrUid,
        amountCents: Math.round(amountUgx * 100),
        pin,
        description: description || undefined,
        idempotencyKey: pending.idempotencyKey,
        deviceId: pending.deviceId,
      });
      setResult(data);
      setPhase("done");
      if (data.ok) {
        setAmount("");
        setDescription("");
      }
    } catch (e) {
      setChargeError(e instanceof Error ? e.message : "Charge failed.");
    } finally {
      setPin("");
      setChargeLoading(false);
    }
  }

  function reset() {
    setPhase("setup");
    setPending(null);
    setOfflinePending(null);
    setPin("");
    setChargeError("");
    setResult(null);
    setOfflineResult(null);
    scanner.stopScanner();
  }

  return (
    <main className="grid gap-5">
      <header className="page-header">
        <p className="text-xs font-bold uppercase tracking-wide text-blue-600">NFC Operations</p>
        <h1 className="text-xl font-bold text-slate-950 sm:text-2xl">Canteen Charge</h1>
      </header>

      {isOfflineReady && (
        <div className="flex items-center gap-3 rounded-xl border border-orange-200 bg-orange-50 p-3">
          <WifiOffRegular className="h-5 w-5 text-orange-600 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-orange-800">Offline Mode — Charges Queued</p>
            <p className="text-xs text-orange-600">Charges are stored locally. {pendingCount > 0 ? `${pendingCount} pending sync.` : "PIN not verified offline — will validate at sync."}</p>
          </div>
        </div>
      )}

      <section className="grid gap-4 lg:grid-cols-[380px_minmax(0,1fr)]">
        <div className="flex flex-col gap-4">
          <div className="premium-card rounded-xl p-4 grid gap-3">
            <label className="grid gap-1 text-xs font-bold uppercase text-slate-500">
              Amount (UGX)
              <input
                className={`${inputClass} text-lg font-bold`}
                inputMode="numeric"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="e.g. 2000"
                disabled={phase !== "setup"}
              />
            </label>
            <label className="grid gap-1 text-xs font-bold uppercase text-slate-500">
              Item / description
              <input
                className={inputClass}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Lunch"
                disabled={phase !== "setup"}
              />
            </label>
            {phase === "setup" && !Number(amount) && (
              <p className="text-xs text-amber-600">Enter an amount, then scan the student tag.</p>
            )}
          </div>

          {phase === "setup" && (
            <NfcScanPanel
              state={scanner.state}
              error={scanner.error}
              isOnline={scanner.isOnline}
              isWebNfcAvailable={scanner.isWebNfcAvailable}
              onStart={scanner.startScanner}
              onStop={scanner.stopScanner}
              onManualSubmit={scanner.submitManual}
              scanLabel="Scan Student Tag"
            />
          )}

          {/* Online PIN phase */}
          {phase === "pin" && !isOfflineReady && pending && (
            <div className="premium-card rounded-xl p-4 grid gap-4">
              <div className="rounded-xl border border-blue-100 bg-blue-50 p-3">
                <p className="text-xs font-bold uppercase text-blue-600">Student identified</p>
                <p className="mt-1 font-bold text-slate-950">{pending.student.student?.name ?? "Unknown"}</p>
                {pending.student.student && (
                  <p className="text-xs text-slate-600">
                    {pending.student.student.admissionNumber} · {pending.student.student.className ?? "No class"}
                  </p>
                )}
                {pending.student.wallet && (
                  <p className="mt-1 text-sm font-bold text-slate-900">
                    Balance: {money(pending.student.wallet.balanceCents)}
                    {pending.student.wallet.status === "FROZEN" && (
                      <span className="ml-2 text-xs font-normal text-red-600">(frozen)</span>
                    )}
                  </p>
                )}
                {pending.student.wallet && !pending.student.wallet.pinSet && (
                  <p className="mt-1 text-xs font-bold text-amber-700">Wallet PIN: Not set</p>
                )}
              </div>

              {pending.student.wallet?.pinSet === false ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 grid gap-3">
                  <p className="text-sm font-bold text-amber-800">
                    Wallet PIN is not set. Set a PIN before canteen spending.
                  </p>
                  <p className="text-xs text-amber-700">
                    Ask an administrator to set a PIN on the{" "}
                    <a href="/nfc/wallets" className="underline font-bold">NFC Wallets</a> page before charging this student.
                  </p>
                  <button type="button" className="self-start rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50" onClick={reset}>
                    Cancel
                  </button>
                </div>
              ) : (
                <>
                  <div className="grid gap-2">
                    <label className="text-xs font-bold uppercase text-slate-500">Student enters PIN</label>
                    <input
                      type="password"
                      inputMode="numeric"
                      maxLength={6}
                      className={`${inputClass} text-center text-xl tracking-widest`}
                      value={pin}
                      onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      placeholder="••••"
                      // eslint-disable-next-line jsx-a11y/no-autofocus
                      autoFocus
                      autoComplete="off"
                    />
                  </div>
                  {chargeError && (
                    <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{chargeError}</div>
                  )}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="flex-1 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-400 transition-colors"
                      disabled={pin.length < 4 || chargeLoading}
                      onClick={() => void submitCharge()}
                    >
                      {chargeLoading ? "Processing…" : `Charge ${money(Math.round(Number(amount) * 100))}`}
                    </button>
                    <button type="button" className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50" onClick={reset}>
                      Cancel
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Offline confirm phase (no PIN — validated at sync) */}
          {phase === "pin" && isOfflineReady && offlinePending && (
            <div className="premium-card rounded-xl p-4 grid gap-4">
              <div className="rounded-xl border border-orange-100 bg-orange-50 p-3">
                <p className="text-xs font-bold uppercase text-orange-600">Offline — Student identified</p>
                <p className="mt-1 font-bold text-slate-950">{offlinePending.studentName}</p>
                <p className="text-xs text-slate-600">{offlinePending.admissionNumber} · {offlinePending.className ?? "No class"}</p>
                <p className="mt-1 text-sm font-bold text-slate-900">Available: {money(offlinePending.availableBalanceCents)}</p>
              </div>
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700">
                Offline mode: PIN will be validated when connection is restored.
              </div>
              {chargeError && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{chargeError}</div>
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  className="flex-1 rounded-xl bg-orange-600 px-4 py-3 text-sm font-bold text-white hover:bg-orange-700 disabled:bg-slate-200 disabled:text-slate-400 transition-colors"
                  disabled={chargeLoading}
                  onClick={() => void submitCharge()}
                >
                  {chargeLoading ? "Queuing…" : `Queue Charge ${money(Math.round(Number(amount) * 100))}`}
                </button>
                <button type="button" className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50" onClick={reset}>
                  Cancel
                </button>
              </div>
            </div>
          )}

          {phase === "done" && (
            <button type="button" className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50" onClick={reset}>
              New charge
            </button>
          )}
        </div>

        {/* Right: result panel */}
        <aside className="premium-card rounded-xl p-4">
          <h2 className="text-base font-bold text-slate-950">Charge result</h2>
          {offlineResult ? (
            <div className="mt-3 grid gap-3 text-sm">
              <div className={`rounded-xl border p-4 font-bold text-base ${offlineResult.ok ? "border-orange-200 bg-orange-50 text-orange-700" : "border-red-200 bg-red-50 text-red-700"}`}>
                {offlineResult.ok ? "Queued for sync" : chargeBlockedMessage(offlineResult.reason)}
              </div>
              {offlineResult.ok && offlinePending && (
                <>
                  <p className="font-bold text-slate-950">{offlinePending.studentName} · {offlinePending.admissionNumber}</p>
                  <p className="text-slate-700">Est. remaining: {money(offlineResult.balanceCents ?? 0)}</p>
                  <p className="text-xs text-slate-500">Actual deduction happens on sync.</p>
                </>
              )}
            </div>
          ) : result ? (
            <div className="mt-3 grid gap-3 text-sm">
              <div className={`rounded-xl border p-4 font-bold text-base ${result.ok ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-700"}`}>
                {result.ok ? "Charge successful" : chargeBlockedMessage(result.reason)}
              </div>
              {!result.ok && result.reason === "insufficient balance" && (
                <p className="text-xs text-red-600">
                  The student wallet does not have enough canteen credit.{" "}
                  <a href="/nfc/wallets/top-up" className="underline">Add credit</a> on the Wallet Top-Up page.
                </p>
              )}
              {result.student && (
                <p className="font-bold text-slate-950">{result.student.name} · {result.student.admissionNumber}</p>
              )}
              {result.student && (
                <p className="text-slate-600 text-xs">{result.student.className ?? "No class"} / {result.student.streamName ?? "No stream"}</p>
              )}
              {result.wallet && (
                <p className="text-slate-700">Balance: {money(result.wallet.balanceCents)} · {result.wallet.status}</p>
              )}
              {result.transaction && (
                <p className="text-slate-700">
                  Charged: {money(Math.abs(result.transaction.amountCents))}
                  {result.transaction.description ? ` · ${result.transaction.description}` : ""}
                </p>
              )}
            </div>
          ) : (
            <p className="mt-3 text-sm text-slate-500">
              {phase === "setup" && "Enter an amount, then tap the student's NFC tag."}
              {phase === "pin" && (isOfflineReady ? "Review and confirm the offline charge." : "Waiting for PIN entry…")}
            </p>
          )}
        </aside>
      </section>
    </main>
  );
}
