import { useEffect, useState } from "react";
import { getApiBaseUrl } from "../../../client/apiBase";
import { fetchReportContext } from "../client/reportsClient";
import { fetchSettings } from "../../../client/settingsClient";
import type { ReportContextOption } from "../../../shared/types/reports";
import { formatUgandaSchoolYearLabel, nextUgandaSchoolYear } from "../../../shared/utils/ugandaYear";

const API_BASE = getApiBaseUrl();

type Candidate = {
  studentId: string;
  studentName: string;
  admissionNumber: string;
  enrollmentId: string;
  fromClassName: string;
  fromClassCode: string;
  fromStreamName: string;
  averageScore: number | null;
  decision: "PROMOTE" | "REPEAT" | "GRADUATE";
  toClassName: string | null;
  toClassCode: string | null;
};

type OverrideDecision = "PROMOTE" | "REPEAT" | "GRADUATE";

type BatchSummary = {
  id: string;
  status: "APPLIED" | "REVERSED";
  appliedAt: string;
  appliedByName: string | null;
  reversedAt: string | null;
  reversedByName: string | null;
  totalStudents: number;
  promoted: number;
  repeated: number;
  graduated: number;
  actions: Array<{
    studentName: string;
    decision: string;
    status: string;
    fromClassName: string;
    toClassName: string | null;
  }>;
};

async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const token = localStorage.getItem("sc_auth_token");
  return fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers ?? {}),
    },
  });
}

async function parseJson<T>(res: Response): Promise<T> {
  const text = await res.text();
  if (!res.ok) {
    const body = text ? (JSON.parse(text) as { error?: string; message?: string }) : {};
    throw new Error(body.error ?? body.message ?? `Request failed (${res.status})`);
  }
  return JSON.parse(text) as T;
}

const DECISION_LABELS: Record<OverrideDecision, string> = {
  PROMOTE: "Promote",
  REPEAT: "Repeat",
  GRADUATE: "Graduate",
};

const DECISION_COLORS: Record<OverrideDecision, string> = {
  PROMOTE: "bg-emerald-50 text-emerald-700 border-emerald-200",
  REPEAT: "bg-amber-50 text-amber-700 border-amber-200",
  GRADUATE: "bg-blue-50 text-blue-700 border-blue-200",
};

export function PromotionWorkspacePage() {
  const [context, setContext] = useState<{
    academicYears: ReportContextOption[];
    terms: ReportContextOption[];
    classes: ReportContextOption[];
    streams: ReportContextOption[];
  } | null>(null);

  const [sourceYearId, setSourceYearId] = useState("");
  const [sourceTermId, setSourceTermId] = useState("");
  const [assessmentType, setAssessmentType] = useState<"BOT" | "MOT" | "EOT" | "TERM_SUMMARY">("EOT");

  const [classId, setClassId] = useState("");
  const [streamId, setStreamId] = useState("");
  const [scoreThreshold, setScoreThreshold] = useState(40);
  const [targetTermId, setTargetTermId] = useState("");

  // Compute target year automatically from source year name
  const sourceYear = context?.academicYears.find((y) => y.id === sourceYearId);
  const sourceYearLabel = sourceYear ? formatUgandaSchoolYearLabel(sourceYear.name) : "";
  const nextYearNumber = sourceYearLabel ? String(nextUgandaSchoolYear(sourceYear!.name)) : "";
  const targetYear = context?.academicYears.find((y) => formatUgandaSchoolYearLabel(y.name) === nextYearNumber);
  const computedTargetYearId = targetYear?.id ?? "";

  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [overrides, setOverrides] = useState<Record<string, OverrideDecision>>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const [previewing, setPreviewing] = useState(false);
  const [applying, setApplying] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState("");
  const [applyResult, setApplyResult] = useState<{ batchId: string; applied: number; errors: string[] } | null>(null);

  const [batches, setBatches] = useState<BatchSummary[]>([]);
  const [loadingBatches, setLoadingBatches] = useState(false);
  const [reversingId, setReversingId] = useState<string | null>(null);
  const [reverseResult, setReverseResult] = useState<{ reversed: number; blocked: Array<{ studentName: string; reason: string }> } | null>(null);

  useEffect(() => {
    Promise.all([fetchReportContext(), fetchSettings()])
      .then(([ctx, settings]) => {
        setContext(ctx);
        const activeYear =
          ctx.academicYears.find((y) => y.name === settings.sections.academic.activeAcademicYear) ??
          ctx.academicYears.find((y) => y.isActive) ??
          ctx.academicYears[0];
        const activeTerm =
          ctx.terms.find((t) => t.name === settings.sections.academic.activeTerm) ??
          ctx.terms.find((t) => t.isActive) ??
          ctx.terms[0];
        setSourceYearId(activeYear?.id ?? "");
        setSourceTermId(activeTerm?.id ?? "");
        setClassId(ctx.classes[0]?.id ?? "");
      })
      .catch((err: Error) => setError(err.message));
  }, []);

  useEffect(() => {
    if (!applying && !previewing) loadBatches();
  }, [applying, previewing]);

  async function loadBatches() {
    setLoadingBatches(true);
    try {
      const res = await authFetch(`${API_BASE}/api/promotions/batches`);
      const data = await parseJson<BatchSummary[]>(res);
      setBatches(data);
    } catch {
      // non-fatal
    } finally {
      setLoadingBatches(false);
    }
  }

  async function handlePreview() {
    if (!sourceYearId || !sourceTermId) return;
    setPreviewing(true);
    setError("");
    setCandidates([]);
    setSelected(new Set());
    setOverrides({});
    setApplyResult(null);
    try {
      const res = await authFetch(`${API_BASE}/api/promotions/preview`, {
        method: "POST",
        body: JSON.stringify({
          academicYearId: sourceYearId,
          termId: sourceTermId,
          assessmentType,
          classId: classId || undefined,
          streamId: streamId || undefined,
          scoreThreshold,
        }),
      });
      const data = await parseJson<{ candidates: Candidate[] }>(res);
      setCandidates(data.candidates);
      setSelected(new Set(data.candidates.map((c) => c.studentId)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Preview failed.");
    } finally {
      setPreviewing(false);
    }
  }

  function effectiveDecision(c: Candidate): OverrideDecision {
    return overrides[c.studentId] ?? c.decision;
  }

  const selectedCandidates = candidates.filter((c) => selected.has(c.studentId));

  async function handleApply() {
    if (!computedTargetYearId || !targetTermId || selectedCandidates.length === 0) return;
    setApplying(true);
    setError("");
    setApplyResult(null);
    setConfirming(false);
    try {
      const res = await authFetch(`${API_BASE}/api/promotions/apply`, {
        method: "POST",
        body: JSON.stringify({
          academicYearId: sourceYearId,
          termId: sourceTermId,
          assessmentType,
          classId: classId || undefined,
          streamId: streamId || undefined,
          scoreThreshold,
          targetAcademicYearId: computedTargetYearId,
          targetTermId,
          decisions: selectedCandidates.map((c) => ({
            studentId: c.studentId,
            enrollmentId: c.enrollmentId,
            fromClassName: c.fromClassName,
            fromClassCode: c.fromClassCode,
            fromStreamName: c.fromStreamName,
            toClassCode: effectiveDecision(c) === "PROMOTE" ? c.toClassCode : effectiveDecision(c) === "REPEAT" ? c.fromClassCode : null,
            decision: effectiveDecision(c),
            averageScore: c.averageScore,
            studentName: c.studentName,
          })),
        }),
      });
      const result = await parseJson<{ batchId: string; applied: number; errors: string[] }>(res);
      setApplyResult(result);
      setCandidates([]);
      setSelected(new Set());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Apply failed.");
    } finally {
      setApplying(false);
    }
  }

  async function handleReverse(batchId: string) {
    setReversingId(batchId);
    setReverseResult(null);
    setError("");
    try {
      const res = await authFetch(`${API_BASE}/api/promotions/batches/${batchId}/reverse`, { method: "POST" });
      const result = await parseJson<{ reversed: number; blocked: Array<{ studentName: string; reason: string }> }>(res);
      setReverseResult(result);
      await loadBatches();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reversal failed.");
    } finally {
      setReversingId(null);
    }
  }

  const filteredStreams = context?.streams.filter((s) => !classId || s.classId === classId) ?? [];

  return (
    <main className="grid gap-6">
      <header className="page-header flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-blue-600">Student Management</p>
          <h1 className="text-xl font-bold tracking-tight text-slate-950 sm:text-2xl">Promotion Workspace</h1>
          <p className="mt-1 text-sm text-slate-600">
            Review end-of-year performance and move students to the next class for the new academic year.
          </p>
        </div>
      </header>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {/* Filters */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-sm font-bold text-slate-900">Source: select the term to promote from</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <label className="space-y-1 text-xs font-semibold text-slate-600">
            Academic Year
            <select
              value={sourceYearId}
              onChange={(e) => setSourceYearId(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-normal text-slate-800 outline-none focus:border-blue-500"
            >
              <option value="">— select year —</option>
              {context?.academicYears.map((y) => (
                <option key={y.id} value={y.id}>{formatUgandaSchoolYearLabel(y.name)}</option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-xs font-semibold text-slate-600">
            Term
            <select
              value={sourceTermId}
              onChange={(e) => setSourceTermId(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-normal text-slate-800 outline-none focus:border-blue-500"
            >
              <option value="">— select term —</option>
              {context?.terms.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-xs font-semibold text-slate-600">
            Assessment Type
            <select
              value={assessmentType}
              onChange={(e) => setAssessmentType(e.target.value as typeof assessmentType)}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-normal text-slate-800 outline-none focus:border-blue-500"
            >
              <option value="EOT">EOT</option>
              <option value="TERM_SUMMARY">Term Summary</option>
              <option value="BOT">BOT</option>
              <option value="MOT">MOT</option>
            </select>
          </label>
          <label className="space-y-1 text-xs font-semibold text-slate-600">
            Class (optional — leave blank for all)
            <select
              value={classId}
              onChange={(e) => { setClassId(e.target.value); setStreamId(""); }}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-normal text-slate-800 outline-none focus:border-blue-500"
            >
              <option value="">— all classes —</option>
              {context?.classes.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-xs font-semibold text-slate-600">
            Stream (optional)
            <select
              value={streamId}
              onChange={(e) => setStreamId(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-normal text-slate-800 outline-none focus:border-blue-500"
            >
              <option value="">— all streams —</option>
              {filteredStreams.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-xs font-semibold text-slate-600">
            Promotion threshold (average ≥)
            <input
              type="number"
              min={0}
              max={100}
              value={scoreThreshold}
              onChange={(e) => setScoreThreshold(Number(e.target.value))}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-normal text-slate-800 outline-none focus:border-blue-500"
            />
          </label>
        </div>
        <div className="mt-4">
          <button
            type="button"
            className="btn btn-primary"
            disabled={!sourceYearId || !sourceTermId || previewing}
            onClick={() => void handlePreview()}
          >
            {previewing ? "Generating preview..." : "Preview promotions"}
          </button>
        </div>
      </section>

      {/* Candidates table */}
      {candidates.length > 0 ? (
        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
            <h2 className="text-sm font-bold text-slate-900">
              {candidates.length} student{candidates.length !== 1 ? "s" : ""} found
            </h2>
            <div className="flex gap-2 text-xs">
              <button
                type="button"
                className="rounded-lg border border-slate-200 px-3 py-1.5 font-semibold text-slate-600 hover:bg-slate-50"
                onClick={() => setSelected(new Set(candidates.map((c) => c.studentId)))}
              >
                Select all
              </button>
              <button
                type="button"
                className="rounded-lg border border-slate-200 px-3 py-1.5 font-semibold text-slate-600 hover:bg-slate-50"
                onClick={() => setSelected(new Set())}
              >
                Deselect all
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3 w-8"></th>
                  <th className="px-4 py-3">Student</th>
                  <th className="px-4 py-3">Current Class</th>
                  <th className="px-4 py-3 text-right">Average</th>
                  <th className="px-4 py-3">Decision</th>
                  <th className="px-4 py-3">Next Class</th>
                </tr>
              </thead>
              <tbody>
                {candidates.map((c) => {
                  const dec = effectiveDecision(c);
                  return (
                    <tr key={c.studentId} className="border-b border-slate-50 hover:bg-slate-50/50">
                      <td className="px-4 py-2">
                        <input
                          type="checkbox"
                          checked={selected.has(c.studentId)}
                          onChange={(e) => {
                            const next = new Set(selected);
                            if (e.target.checked) next.add(c.studentId);
                            else next.delete(c.studentId);
                            setSelected(next);
                          }}
                          className="h-4 w-4 rounded border-slate-300"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <div className="font-semibold text-slate-900">{c.studentName}</div>
                        <div className="font-mono text-xs text-slate-400">{c.admissionNumber}</div>
                      </td>
                      <td className="px-4 py-2 text-slate-700">{c.fromClassName} / {c.fromStreamName}</td>
                      <td className="px-4 py-2 text-right font-mono font-medium text-slate-800">
                        {c.averageScore != null ? c.averageScore.toFixed(1) : "—"}
                      </td>
                      <td className="px-4 py-2">
                        <select
                          value={dec}
                          onChange={(e) =>
                            setOverrides((prev) => ({ ...prev, [c.studentId]: e.target.value as OverrideDecision }))
                          }
                          className={`rounded-lg border px-2 py-1 text-xs font-bold outline-none ${DECISION_COLORS[dec]}`}
                        >
                          <option value="PROMOTE">{DECISION_LABELS.PROMOTE}</option>
                          <option value="REPEAT">{DECISION_LABELS.REPEAT}</option>
                          <option value="GRADUATE">{DECISION_LABELS.GRADUATE}</option>
                        </select>
                      </td>
                      <td className="px-4 py-2 text-slate-600">
                        {dec === "GRADUATE"
                          ? <span className="text-blue-600 font-semibold">Graduate</span>
                          : dec === "REPEAT"
                            ? <span className="text-amber-700">{c.fromClassName} (repeat)</span>
                            : c.toClassName ?? "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Target year (auto-computed) + target term selection */}
          <div className="border-t border-slate-100 p-5">
            <h3 className="mb-3 text-sm font-bold text-slate-900">Promote into which academic year / term?</h3>
            <div className="flex flex-wrap items-center gap-3">
              <span className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                Target year: <strong>{nextYearNumber || "—"}</strong>
              </span>
              <select
                value={targetTermId}
                onChange={(e) => setTargetTermId(e.target.value)}
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-500"
              >
                <option value="">— target term —</option>
                {context?.terms.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>

            {!confirming ? (
              <button
                type="button"
                className="btn btn-primary mt-4"
                disabled={selected.size === 0 || !computedTargetYearId || !targetTermId || applying}
                onClick={() => setConfirming(true)}
              >
                Apply promotions ({selected.size} student{selected.size !== 1 ? "s" : ""})
              </button>
            ) : (
              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
                <p className="text-sm font-semibold text-amber-800">
                  This action will move {selected.size} selected student{selected.size !== 1 ? "s" : ""} to the next class for the selected academic year.
                </p>
                <p className="mt-1 text-xs text-amber-700">Previous enrollments will be marked completed. New enrollments will be created in the target year/term.</p>
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={applying}
                    onClick={() => void handleApply()}
                  >
                    {applying ? "Applying..." : "Confirm — Apply promotions"}
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    disabled={applying}
                    onClick={() => setConfirming(false)}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>
      ) : null}

      {/* Apply result */}
      {applyResult ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm">
          <p className="text-sm font-semibold text-emerald-800">
            Promotions applied: {applyResult.applied} student{applyResult.applied !== 1 ? "s" : ""} moved successfully.
          </p>
          {applyResult.errors.length > 0 ? (
            <ul className="mt-2 list-disc pl-5 text-xs text-amber-700">
              {applyResult.errors.map((e, i) => <li key={i}>{e}</li>)}
            </ul>
          ) : null}
          <button type="button" className="mt-2 text-xs text-emerald-600 underline" onClick={() => setApplyResult(null)}>
            Dismiss
          </button>
        </div>
      ) : null}

      {/* Reversal result */}
      {reverseResult ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold text-slate-900">
            Reversal complete: {reverseResult.reversed} student{reverseResult.reversed !== 1 ? "s" : ""} restored.
          </p>
          {reverseResult.blocked.length > 0 ? (
            <div className="mt-2">
              <p className="text-xs font-semibold text-red-700">Blocked ({reverseResult.blocked.length} student{reverseResult.blocked.length !== 1 ? "s" : ""}):</p>
              <ul className="mt-1 list-disc pl-5 text-xs text-red-600">
                {reverseResult.blocked.map((b, i) => (
                  <li key={i}><strong>{b.studentName}:</strong> {b.reason}</li>
                ))}
              </ul>
            </div>
          ) : null}
          <button type="button" className="mt-2 text-xs text-slate-500 underline" onClick={() => setReverseResult(null)}>
            Dismiss
          </button>
        </div>
      ) : null}

      {/* Promotion history */}
      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h2 className="text-sm font-bold text-slate-900">Promotion history</h2>
          <button type="button" className="text-xs text-blue-600 hover:underline" onClick={() => void loadBatches()}>
            Refresh
          </button>
        </div>
        {loadingBatches ? (
          <p className="px-5 py-6 text-sm text-slate-400">Loading...</p>
        ) : batches.length === 0 ? (
          <p className="px-5 py-6 text-sm text-slate-400">No promotion batches yet.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {batches.map((b) => (
              <div key={b.id} className="px-5 py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                          b.status === "APPLIED" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {b.status}
                      </span>
                      <span className="text-sm font-semibold text-slate-800">
                        {b.totalStudents} student{b.totalStudents !== 1 ? "s" : ""}
                      </span>
                      <span className="text-xs text-slate-400">
                        Applied {new Date(b.appliedAt).toLocaleDateString("en-GB")}
                        {b.appliedByName ? ` by ${b.appliedByName}` : ""}
                      </span>
                    </div>
                    <div className="mt-1 flex gap-3 text-xs text-slate-500">
                      <span className="text-emerald-600">↑ {b.promoted} promoted</span>
                      <span className="text-amber-600">↺ {b.repeated} repeat</span>
                      <span className="text-blue-600">✓ {b.graduated} graduated</span>
                    </div>
                  </div>
                  {b.status === "APPLIED" ? (
                    <button
                      type="button"
                      className="btn btn-secondary text-xs"
                      disabled={reversingId === b.id}
                      onClick={() => void handleReverse(b.id)}
                    >
                      {reversingId === b.id ? "Reversing..." : "Reverse promotion batch"}
                    </button>
                  ) : (
                    <span className="text-xs text-slate-400">
                      Reversed {b.reversedAt ? new Date(b.reversedAt).toLocaleDateString("en-GB") : ""}
                      {b.reversedByName ? ` by ${b.reversedByName}` : ""}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
