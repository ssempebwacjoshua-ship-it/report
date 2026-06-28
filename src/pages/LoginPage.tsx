import { type FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { getApiBaseUrl } from "../client/apiBase";
import { getDefaultRouteForRole } from "../shared/permissions";

const IS_DEV = import.meta.env.DEV;
const API_BASE = getApiBaseUrl();

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [schoolCode, setSchoolCode] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const result = await login(email.trim(), password, schoolCode.trim());
      navigate(result?.isPlatformOwner ? "/owner" : getDefaultRouteForRole(result.role), { replace: true });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Login failed.");
    } finally {
      setLoading(false);
    }
  }

  function fillDemo() {
    setSchoolCode("SCU-PREVIEW");
    setEmail("admin@schoolconnect.test");
    setPassword("password123");
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-slate-100 to-blue-50 px-4 py-12">
      <div className="w-full max-w-[400px]">

        {/* Branding header */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600 shadow-lg shadow-blue-200">
            <svg viewBox="0 0 24 24" fill="none" className="h-7 w-7 text-white" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2 4 5v6c0 5 3.5 9 8 11 4.5-2 8-6 8-11V5z" />
              <path d="M9 12l2 2 4-5" />
            </svg>
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
            School Connect
          </h1>
          <p className="mt-1 text-sm font-medium text-slate-500">
            Reports &amp; Marks Management
          </p>
        </div>

        {/* Card */}
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl shadow-slate-200/60">
          <div className="border-b border-slate-100 bg-slate-50/60 px-6 py-4">
            <h2 className="text-base font-bold text-slate-800">Sign in to your account</h2>
            <p className="text-xs text-slate-500 mt-0.5">School staff access</p>
          </div>

          <form onSubmit={(e) => void handleSubmit(e)} className="px-6 py-5">
            {error ? (
              <div className="mb-5 flex gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
                <svg className="mt-0.5 h-4 w-4 shrink-0 text-red-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                <p className="text-sm text-red-700">{error}</p>
              </div>
            ) : null}

            <div className="grid gap-5">
              <div className="grid gap-2">
                <label htmlFor="schoolCode" className="text-sm font-semibold text-slate-700">
                  School code
                </label>
                <input
                  id="schoolCode"
                  type="text"
                  autoComplete="organization"
                  required
                  className="input uppercase"
                  placeholder="e.g. SCU-2025"
                  value={schoolCode}
                  onChange={(e) => setSchoolCode(e.target.value.toUpperCase())}
                  disabled={loading}
                />
              </div>

              <div className="grid gap-2">
                <label htmlFor="email" className="text-sm font-semibold text-slate-700">
                  Email address
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  className="input"
                  placeholder="you@school.ac.ug"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                />
              </div>

              <div className="grid gap-2">
                <label htmlFor="password" className="text-sm font-semibold text-slate-700">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  className="input"
                  placeholder="????????"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                />
              </div>

              <button
                type="submit"
                className="btn btn-primary mt-1 w-full py-3 text-base"
                disabled={loading}
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z" />
                    </svg>
                    Signing in?
                  </span>
                ) : "Sign in"}
              </button>
            </div>
          </form>
        </div>

        {/* Dev-only credential hint */}
        {IS_DEV ? (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
            <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-amber-700">
              Local demo credentials
            </p>
            <p className="font-mono text-xs text-amber-800">admin@schoolconnect.test</p>
            <p className="font-mono text-xs text-amber-800">password123</p>
            <button
              type="button"
              onClick={fillDemo}
              className="mt-2 text-xs font-semibold text-amber-700 underline underline-offset-2 hover:text-amber-900"
            >
              Fill in
            </button>
          </div>
        ) : null}

        <p className="mt-6 text-center text-xs text-slate-400">
          School Connect Reports ? Powered by {API_BASE.includes("localhost") ? "local server" : "cloud"}
        </p>
      </div>
    </div>
  );
}

