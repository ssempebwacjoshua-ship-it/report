import { type FormEvent, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { getApiBaseUrl } from "../client/apiBase";

const API_BASE = getApiBaseUrl();

export function TokenPasswordPage({ mode }: { mode: "setup" | "reset" }) {
  const [params] = useSearchParams();
  const token = useMemo(() => params.get("token") ?? "", [params]);
  const [schoolCode, setSchoolCode] = useState(() => params.get("schoolCode") ?? "");
  const [email, setEmail] = useState(() => params.get("email") ?? "");
  const [otp, setOtp] = useState(() => params.get("otp") ?? "");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const nextSchoolCode = params.get("schoolCode") ?? "";
    const nextEmail = params.get("email") ?? "";
    const nextOtp = params.get("otp") ?? "";
    if (nextSchoolCode) setSchoolCode(nextSchoolCode);
    if (nextEmail) setEmail(nextEmail);
    if (nextOtp) setOtp(nextOtp);
  }, [params]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      const setupWithLink = mode === "setup" && Boolean(token);
      const endpoint = mode === "setup"
        ? (setupWithLink ? "/api/auth/account-setup" : "/api/auth/account-setup-code")
        : "/api/auth/reset-password";
      const res = await fetch(`${API_BASE}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          mode === "setup"
            ? (setupWithLink
              ? { token, password }
              : { schoolCode, email, otp, password })
            : { schoolCode, email, otp, password },
        ),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "This link is invalid, expired, or already used.");
      }
      setSuccess(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "This link is invalid, expired, or already used.");
    } finally {
      setLoading(false);
    }
  }

  const title = mode === "setup" ? "Set up your account" : "Choose a new password";
  const resetModeDisabled = loading || success;
  const setupWithLink = mode === "setup" && Boolean(token);
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <form onSubmit={(e) => void submit(e)} className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-bold text-slate-900">{title}</h1>
        {mode === "setup" && setupWithLink ? (
          <p className="mt-2 text-sm text-slate-500">Use the link from your email or switch to the code flow below if you cannot open it.</p>
        ) : null}
        {mode === "setup" && !setupWithLink ? (
          <p className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">Enter your school code, email address, and 6-digit setup code from the invite email.</p>
        ) : null}
        {success ? <p className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">Password saved. You can sign in now.</p> : null}
        {error ? <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
        {mode === "reset" ? (
          <>
            <label className="mt-5 block text-sm font-semibold text-slate-700" htmlFor="schoolCode">School code</label>
            <input id="schoolCode" required className="input mt-2" value={schoolCode} onChange={(e) => setSchoolCode(e.target.value)} disabled={resetModeDisabled} />
            <label className="mt-4 block text-sm font-semibold text-slate-700" htmlFor="email">Email address</label>
            <input id="email" type="email" required className="input mt-2" value={email} onChange={(e) => setEmail(e.target.value)} disabled={resetModeDisabled} />
            <label className="mt-4 block text-sm font-semibold text-slate-700" htmlFor="otp">Reset code</label>
            <input id="otp" inputMode="numeric" autoComplete="one-time-code" required className="input mt-2 tracking-[0.3em]" value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 8))} disabled={resetModeDisabled} />
          </>
        ) : !setupWithLink ? (
          <>
            <label className="mt-5 block text-sm font-semibold text-slate-700" htmlFor="schoolCode">School code</label>
            <input id="schoolCode" required className="input mt-2" value={schoolCode} onChange={(e) => setSchoolCode(e.target.value)} disabled={loading || success} />
            <label className="mt-4 block text-sm font-semibold text-slate-700" htmlFor="email">Email address</label>
            <input id="email" type="email" required className="input mt-2" value={email} onChange={(e) => setEmail(e.target.value)} disabled={loading || success} />
            <label className="mt-4 block text-sm font-semibold text-slate-700" htmlFor="otp">Setup code</label>
            <input id="otp" inputMode="numeric" autoComplete="one-time-code" required className="input mt-2 tracking-[0.3em]" value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 8))} disabled={loading || success} />
          </>
        ) : null}
        <label className="mt-5 block text-sm font-semibold text-slate-700" htmlFor="password">New password</label>
        <input id="password" type="password" required minLength={10} className="input mt-2" value={password} onChange={(e) => setPassword(e.target.value)} disabled={mode === "setup" ? loading || success : resetModeDisabled} />
        <label className="mt-4 block text-sm font-semibold text-slate-700" htmlFor="confirm">Confirm password</label>
        <input id="confirm" type="password" required minLength={10} className="input mt-2" value={confirm} onChange={(e) => setConfirm(e.target.value)} disabled={mode === "setup" ? loading || success : resetModeDisabled} />
        <p className="mt-3 text-xs text-slate-500">Use at least 10 characters with letters and numbers.</p>
        <button type="submit" className="btn btn-primary mt-5 w-full py-3" disabled={mode === "setup" ? loading || success : resetModeDisabled}>{loading ? "Saving..." : "Save password"}</button>
      </form>
    </main>
  );
}
