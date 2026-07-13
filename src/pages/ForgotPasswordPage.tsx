import { type FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { getApiBaseUrl } from "../client/apiBase";

const API_BASE = getApiBaseUrl();

export function ForgotPasswordPage() {
  const [schoolCode, setSchoolCode] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/api/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ schoolCode, email }),
      });
      if (!res.ok) throw new Error("Could not request a reset code.");
      const data = await res.json().catch(() => ({}));
      setSent(true);
      setCooldownSeconds(typeof data.cooldownSeconds === "number" ? data.cooldownSeconds : 0);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not request a reset code.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <form onSubmit={(e) => void submit(e)} className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-bold text-slate-900">Reset password</h1>
        <p className="mt-1 text-sm text-slate-500">Enter your school code and account email. If the account exists, we will send a reset code and a link to the reset page.</p>
        {sent ? (
          <div className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">
            <p>If an account exists, we sent a reset code and link.</p>
            {cooldownSeconds > 0 ? <p className="mt-1 text-xs text-emerald-600">Please wait about {cooldownSeconds} seconds before requesting another code.</p> : null}
            <Link className="mt-2 inline-flex font-semibold text-emerald-800 underline underline-offset-2" to={`/reset-password?schoolCode=${encodeURIComponent(schoolCode)}&email=${encodeURIComponent(email)}`}>
              Open the reset page
            </Link>
          </div>
        ) : null}
        {error ? <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
        <label className="mt-5 block text-sm font-semibold text-slate-700" htmlFor="schoolCode">School code</label>
        <input id="schoolCode" required className="input mt-2" value={schoolCode} onChange={(e) => setSchoolCode(e.target.value)} disabled={loading} />
        <label className="mt-5 block text-sm font-semibold text-slate-700" htmlFor="email">Email address</label>
        <input id="email" type="email" required className="input mt-2" value={email} onChange={(e) => setEmail(e.target.value)} disabled={loading} />
        <button type="submit" className="btn btn-primary mt-5 w-full py-3" disabled={loading}>{loading ? "Sending..." : sent ? "Send another code" : "Send reset code"}</button>
      </form>
    </main>
  );
}
