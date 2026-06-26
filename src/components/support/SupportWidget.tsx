import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useLocation } from "react-router-dom";
import { postSupportTelegram } from "../../client/supportClient";
import { useAuth } from "../../contexts/AuthContext";
import { useAppSettings } from "../layout/SettingsContext";

function supportModeEnabled() {
  return String(import.meta.env.VITE_SUPPORT_MODE ?? "").trim().toLowerCase() === "telegram_form";
}

export function SupportWidget() {
  const { user } = useAuth();
  const settingsState = useAppSettings();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [contact, setContact] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "sent" | "error">("idle");
  const [error, setError] = useState("");

  const pageUrl = useMemo(() => {
    const path = `${location.pathname}${location.search}${location.hash}`;
    return new URL(path || "/", window.location.origin).toString();
  }, [location.hash, location.pathname, location.search]);

  useEffect(() => {
    if (!open) {
      setStatus("idle");
      setError("");
    }
  }, [open]);

  if (!supportModeEnabled() || !user) {
    return null;
  }

  const schoolName = settingsState?.settings?.sections.school.schoolName?.trim() || "Your school";
  const schoolCode = settingsState?.settings?.sections.school.schoolCode?.trim() || "";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status === "submitting") return;

    setStatus("submitting");
    setError("");
    try {
      const contextPrefix = [
        schoolCode ? `School code: ${schoolCode}` : "",
        user.name ? `User: ${user.name}` : "",
        user.email ? `Email: ${user.email}` : "",
        user.role ? `Role: ${user.role}` : "",
      ].filter(Boolean).join("\n");

      await postSupportTelegram({
        message: contextPrefix ? `${contextPrefix}\n\n${message.trim()}` : message.trim(),
        contact: contact.trim(),
        pageUrl,
      });
      setStatus("sent");
      setMessage("");
      setContact("");
    } catch (caught) {
      setStatus("error");
      setError(caught instanceof Error ? caught.message : "Could not send your support request.");
    }
  }

  return (
    <>
      <button
        type="button"
        className="fixed bottom-[calc(1rem+env(safe-area-inset-bottom,0px))] right-4 z-40 rounded-full bg-slate-950 px-4 py-2 text-sm font-bold text-white shadow-lg transition hover:bg-slate-800"
        onClick={() => setOpen(true)}
      >
        Support
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-end justify-end bg-slate-950/30 p-4 sm:items-end">
          <div className="w-full max-w-sm rounded-3xl border border-slate-200 bg-white p-4 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-slate-950">Support</h2>
                <p className="mt-1 text-xs text-slate-500">
                  Send a quick issue report to our support desk on Telegram.
                </p>
              </div>
              <button
                type="button"
                className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600"
                onClick={() => setOpen(false)}
              >
                Close
              </button>
            </div>

            <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
              <p className="font-semibold text-slate-800">{schoolName}</p>
              <p>{user.name} • {user.role}</p>
            </div>

            <form className="mt-4 grid gap-3" onSubmit={(event) => void handleSubmit(event)}>
              <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Issue
                <textarea
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  rows={4}
                  maxLength={2000}
                  className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-400"
                  placeholder="Tell us what went wrong and what you were trying to do."
                  required
                />
              </label>

              <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Contact
                <input
                  value={contact}
                  onChange={(event) => setContact(event.target.value)}
                  className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-400"
                  placeholder="Optional phone or email"
                />
              </label>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                <p className="font-semibold text-slate-800">Current page</p>
                <p className="break-all">{pageUrl}</p>
              </div>

              {status === "sent" ? (
                <p className="rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                  Support request sent. We will follow up as soon as possible.
                </p>
              ) : null}
              {status === "error" ? (
                <p className="rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {error}
                </p>
              ) : null}

              <div className="flex items-center justify-end gap-2">
                <button type="button" className="btn btn-secondary" onClick={() => setOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={status === "submitting" || message.trim().length === 0}>
                  {status === "submitting" ? "Sending..." : "Send support request"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
