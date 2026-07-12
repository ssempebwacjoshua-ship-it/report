import { type FormEvent, useState } from "react";
import { getApiBaseUrl } from "../client/apiBase";

const API_BASE = getApiBaseUrl();

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/api/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) throw new Error("Could not request a reset link.");
      setSent(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not request a reset link.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <form onSubmit={(e) => void submit(e)} className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-bold text-slate-900">Reset password</h1>
        <p className="mt-1 text-sm text-slate-500">Enter your account email and we will send reset instructions if the account exists.</p>
        {sent ? <p className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">If an account exists, a reset link has been sent.</p> : null}
        {error ? <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
        <label className="mt-5 block text-sm font-semibold text-slate-700" htmlFor="email">Email address</label>
        <input id="email" type="email" required className="input mt-2" value={email} onChange={(e) => setEmail(e.target.value)} disabled={loading || sent} />
        <button type="submit" className="btn btn-primary mt-5 w-full py-3" disabled={loading || sent}>{loading ? "Sending..." : "Send reset link"}</button>
      </form>
    </main>
  );
}

