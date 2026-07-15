import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { resolveNfcPublicCode } from "../client/nfcTagsClient";
import { SectionLoader } from "../components/SectionLoader";
import type { NfcResolveResponse } from "../shared/types/nfcTags";

export function NfcTapPage() {
  const { publicCode } = useParams<{ publicCode: string }>();
  const [result, setResult] = useState<NfcResolveResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!publicCode) return;
    void (async () => {
      try {
        const data = await resolveNfcPublicCode(publicCode);
        setResult(data);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not read NFC tag.");
      } finally {
        setLoading(false);
      }
    })();
  }, [publicCode]);

  if (loading) {
    return <SectionLoader message="Reading NFC tag..." />;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-sm">
        {/* Brand header */}
        <div className="mb-6 text-center">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-[#0B2F6B] text-2xl font-black text-white shadow-lg">
            S
          </div>
          <p className="mt-2 text-xs font-bold uppercase tracking-widest text-slate-400">SSAMENJ Technologies</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm text-center">
          {error && (
            <div className="py-4">
              <p className="text-4xl">⚠️</p>
              <p className="mt-3 text-lg font-black text-slate-950">Something went wrong</p>
              <p className="mt-1 text-sm text-slate-500">{error}</p>
            </div>
          )}

          {result && (
            <>
              {result.result === "UNKNOWN" && (
                <div className="py-4">
                  <p className="text-4xl">❓</p>
                  <p className="mt-3 text-lg font-black text-slate-950">Unknown NFC tag</p>
                  <p className="mt-1 text-sm text-slate-500">This tag is not registered in the system.</p>
                </div>
              )}

              {result.result === "UNASSIGNED" && (
                <div className="py-4">
                  <p className="text-4xl">🏷️</p>
                  <p className="mt-3 text-lg font-black text-slate-950">Tag ready</p>
                  <p className="mt-1 text-sm text-slate-500">This NFC tag is registered but has not been assigned to a student yet.</p>
                </div>
              )}

              {result.result === "DISABLED" && (
                <div className="py-4">
                  <p className="text-4xl">🚫</p>
                  <p className="mt-3 text-lg font-black text-slate-950">Tag disabled</p>
                  <p className="mt-1 text-sm text-slate-500">This NFC tag has been deactivated. Contact your school administrator.</p>
                </div>
              )}

              {result.result === "ASSIGNED" && !result.student && (
                <div className="py-4">
                  <p className="text-4xl">🔒</p>
                  <p className="mt-3 text-lg font-black text-slate-950">Tag is active</p>
                  <p className="mt-1 text-sm text-slate-500">This tag belongs to a registered student.</p>
                  <Link
                    to="/login"
                    className="mt-4 inline-block rounded-xl bg-[#0B2F6B] px-5 py-2.5 text-sm font-black text-white hover:bg-[#0d3880]"
                  >
                    Log in to view details
                  </Link>
                </div>
              )}

              {result.result === "ASSIGNED" && result.student && (
                <div className="py-4">
                  <p className="text-4xl">✅</p>
                  <p className="mt-3 text-lg font-black text-slate-950">{result.student.name}</p>
                  <p className="mt-0.5 text-sm text-slate-500">{result.student.admissionNumber}</p>
                  {(result.student.className ?? result.student.streamName) && (
                    <p className="mt-0.5 text-sm text-slate-400">
                      {[result.student.className, result.student.streamName].filter(Boolean).join(" · ")}
                    </p>
                  )}
                  <Link
                    to="/students"
                    className="mt-4 inline-block rounded-xl bg-[#0B2F6B] px-5 py-2.5 text-sm font-black text-white hover:bg-[#0d3880]"
                  >
                    Go to Students
                  </Link>
                </div>
              )}
            </>
          )}
        </div>

        <p className="mt-4 text-center text-[11px] text-slate-400">
          School Connect · NFC Tag System
        </p>
      </div>
    </div>
  );
}
