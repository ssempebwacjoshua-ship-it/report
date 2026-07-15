import { useEffect, useMemo, useRef, useState } from "react";
import { BrandedLoader } from "../components/BrandedLoader";
import { NfcSectionTabs } from "../components/nfc/NfcSectionTabs";
import {
  amendStudentCredential,
  deactivateStudentCredential,
  reactivateStudentCredential,
  fetchStudentCredentials,
  issueStudentCredential,
  scanStudentCredential,
} from "../client/studentCredentialsClient";
import { fetchStudents } from "../client/studentsClient";
import type { CredentialStatus, StudentCredential, StudentCredentialScanResult } from "../shared/types/studentCredentials";
import type { StudentListItem } from "../shared/types/students";

const inputClass = "premium-control h-10 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 outline-none focus:border-blue-400 focus:bg-white";

function studentLabel(student: StudentListItem) {
  return `${student.studentName} - ${student.admissionNumber} - ${student.className}/${student.streamName}`;
}

function statusTone(status: CredentialStatus | StudentCredentialScanResult["status"]) {
  if (status === "ACTIVE") return "bg-emerald-100 text-emerald-700";
  if (status === "DEACTIVATED") return "bg-amber-100 text-amber-800";
  if (status === "STUDENT_INACTIVE") return "bg-red-100 text-red-700";
  return "bg-slate-100 text-slate-700";
}

function formatStudentSummary(credential: StudentCredential) {
  return `${credential.student.admissionNumber} - ${credential.student.className ?? "No class"} / ${credential.student.streamName ?? "No stream"}`;
}

export function StudentCredentialsPage() {
  const issueInputRef = useRef<HTMLInputElement | null>(null);
  const scanInputRef = useRef<HTMLInputElement | null>(null);
  const [students, setStudents] = useState<StudentListItem[]>([]);
  const [credentials, setCredentials] = useState<StudentCredential[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [issueUID, setIssueUID] = useState("");
  const [scanUID, setScanUID] = useState("");
  const [scanResult, setScanResult] = useState<StudentCredentialScanResult | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<CredentialStatus | "">("");
  const [deactivationReason, setDeactivationReason] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [amendTarget, setAmendTarget] = useState<StudentCredential | null>(null);
  const [amendStudentId, setAmendStudentId] = useState("");
  const [amendUID, setAmendUID] = useState("");
  const [amendReason, setAmendReason] = useState("");
  const [amendLoading, setAmendLoading] = useState(false);

  // Re-enable modal
  const [reactivateTarget, setReactivateTarget] = useState<StudentCredential | null>(null);
  const [reactivateReason, setReactivateReason] = useState("");
  const [reactivateLoading, setReactivateLoading] = useState(false);

  const activeStudents = useMemo(() => students.filter((student) => student.isActive), [students]);
  const selectedActiveCredential = useMemo(
    () => credentials.find((credential) => credential.student.id === selectedStudentId && credential.status === "ACTIVE") ?? null,
    [credentials, selectedStudentId],
  );

  async function loadCredentials() {
    const result = await fetchStudentCredentials({ search, status });
    setCredentials(result.credentials);
  }

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([fetchStudents({ isActive: "true" }), fetchStudentCredentials()])
      .then(([studentResult, credentialResult]) => {
        if (cancelled) return;
        setStudents(studentResult.students);
        setCredentials(credentialResult.credentials);
        setSelectedStudentId(studentResult.students[0]?.id ?? "");
      })
      .catch((caught: Error) => setError(caught.message))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadCredentials().catch((caught: Error) => setError(caught.message));
    }, 250);
    return () => clearTimeout(timer);
  }, [search, status]);

  useEffect(() => {
    issueInputRef.current?.focus();
  }, []);

  async function handleIssue() {
    setError("");
    setNotice("");

    if (!selectedStudentId) {
      setError("Select a student first.");
      return;
    }

    if (selectedActiveCredential) {
      setError("Student already has an active NFC wristband. Deactivate or mark it lost before issuing another.");
      return;
    }

    try {
      const result = await issueStudentCredential({ studentId: selectedStudentId, credentialUID: issueUID });
      setIssueUID("");
      setNotice("NFC wristband registered.");
      setCredentials((current) => [result.credential, ...current.filter((c) => c.id !== result.credential.id)]);
      issueInputRef.current?.focus();

      try {
        await loadCredentials();
      } catch {
        setError("Wristband registered, but the list could not refresh. Reload the page.");
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not register NFC wristband");
    }
  }

  async function handleScan() {
    setError("");
    setNotice("");
    try {
      const result = await scanStudentCredential(scanUID);
      setScanResult(result);
      setScanUID("");
      scanInputRef.current?.focus();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not scan NFC wristband");
    }
  }

  function openAmend(credential: StudentCredential) {
    setAmendTarget(credential);
    setAmendStudentId(credential.student.id);
    setAmendUID(credential.credentialUID);
    setAmendReason("");
    setError("");
    setNotice("");
  }

  function closeAmend() {
    setAmendTarget(null);
    setAmendStudentId("");
    setAmendUID("");
    setAmendReason("");
  }

  async function handleAmend() {
    if (!amendTarget) return;
    setAmendLoading(true);
    setError("");
    setNotice("");
    try {
      const result = await amendStudentCredential(amendTarget.id, {
        studentId: amendStudentId !== amendTarget.student.id ? amendStudentId : undefined,
        credentialUID: amendUID !== amendTarget.credentialUID ? amendUID : undefined,
        reason: amendReason,
      });
      setCredentials((current) =>
        current.map((c) => (c.id === result.credential.id ? result.credential : c)),
      );
      setNotice("NFC wristband amended.");
      closeAmend();

      try {
        await loadCredentials();
      } catch {
        setError("Wristband amended, but the list could not refresh. Reload the page.");
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not amend NFC wristband");
    } finally {
      setAmendLoading(false);
    }
  }

  async function handleDeactivate(credentialId: string) {
    setError("");
    setNotice("");
    try {
      const reason = deactivationReason[credentialId] ?? "";
      await deactivateStudentCredential(credentialId, reason);
      setDeactivationReason((current) => ({ ...current, [credentialId]: "" }));
      setNotice("NFC wristband deactivated.");
      await loadCredentials();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not deactivate NFC wristband");
    }
  }

  async function handleReactivate() {
    if (!reactivateTarget || !reactivateReason.trim()) return;
    setError("");
    setNotice("");
    setReactivateLoading(true);
    try {
      await reactivateStudentCredential(reactivateTarget.id, reactivateReason.trim());
      setNotice("NFC wristband re-enabled.");
      setReactivateTarget(null);
      setReactivateReason("");
      await loadCredentials();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not re-enable NFC wristband");
    } finally {
      setReactivateLoading(false);
    }
  }

  if (loading && credentials.length === 0 && students.length === 0) {
    return <BrandedLoader message="Loading wristbands..." />;
  }

  return (
    <main className="grid gap-5">
      <header className="page-header flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-blue-600">Wristbands</p>
          <h1 className="text-xl font-bold tracking-tight text-slate-950 sm:text-2xl">Register wristbands</h1>
          <p className="mt-1 text-sm text-slate-500">Register, verify, and deactivate student wristband identifiers.</p>
        </div>
      </header>

      <NfcSectionTabs
        tabs={[
          { to: "/nfc/wristbands", label: "Wristbands" },
          { to: "/nfc/wristbands/register", label: "Register" },
          { to: "/nfc/wristbands/bulk-issue", label: "Bulk Issue" },
        ]}
      />

      {error ? <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}
      {notice ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{notice}</div> : null}

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="premium-card rounded-xl p-4">
          <div className="mb-3">
            <h2 className="text-base font-bold text-slate-950">Register Wristband</h2>
            <p className="mt-1 text-sm text-slate-500">Keep the UID input focused, then tap a wristband on the USB NFC reader.</p>
          </div>
          <div className="grid gap-3">
            <label className="grid gap-1 text-xs font-bold uppercase text-slate-500">
              Student
              <select className={inputClass} value={selectedStudentId} onChange={(event) => setSelectedStudentId(event.target.value)}>
                <option value="">Select student</option>
                {activeStudents.map((student) => (
                  <option key={student.id} value={student.id}>
                    {studentLabel(student)}
                  </option>
                ))}
              </select>
            </label>
            {selectedActiveCredential ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                <p className="font-bold">Student already has active NFC wristband {selectedActiveCredential.credentialUID}.</p>
                <p className="mt-1">Deactivate / Mark Lost first.</p>
              </div>
            ) : null}
            <label className="grid gap-1 text-xs font-bold uppercase text-slate-500">
              Wristband UID
              <input
                ref={issueInputRef}
                className={`${inputClass} font-mono uppercase`}
                value={issueUID}
                onChange={(event) => setIssueUID(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") void handleIssue();
                }}
                placeholder="Tap wristband"
              />
            </label>
            <button
              type="button"
              className="btn btn-primary w-full justify-center sm:w-auto sm:justify-self-start"
              onClick={() => void handleIssue()}
              disabled={!selectedStudentId || !issueUID.trim() || Boolean(selectedActiveCredential)}
            >
              Issue Wristband
            </button>
          </div>
        </div>

        <div className="premium-card rounded-xl p-4">
          <div className="mb-3">
            <h2 className="text-base font-bold text-slate-950">Scan Test</h2>
            <p className="mt-1 text-sm text-slate-500">Use this to verify a wristband without marking attendance or wallet activity.</p>
          </div>
          <label className="grid gap-1 text-xs font-bold uppercase text-slate-500">
            Tap NFC wristband
            <input
              ref={scanInputRef}
              className={`${inputClass} h-14 text-lg font-bold uppercase tracking-wide`}
              value={scanUID}
              onChange={(event) => setScanUID(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") void handleScan();
              }}
              placeholder="Tap NFC wristband"
            />
          </label>
          <button type="button" className="btn btn-secondary mt-3 w-full justify-center sm:w-auto" onClick={() => void handleScan()} disabled={!scanUID.trim()}>
            Verify
          </button>
          {scanResult ? (
            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-bold ${statusTone(scanResult.status)}`}>{scanResult.status.replace("_", " ")}</span>
              {scanResult.student ? (
                <div className="mt-3 grid gap-1 text-sm">
                  <p className="font-bold text-slate-950">{scanResult.student.name}</p>
                  <p className="text-slate-600">{scanResult.student.admissionNumber}</p>
                  <p className="text-slate-600">
                    {scanResult.student.className ?? "No class"} / {scanResult.student.streamName ?? "No stream"}
                  </p>
                </div>
              ) : (
                <p className="mt-3 text-sm text-slate-600">
                  {scanResult.status === "NOT_FOUND" ? "Wristband is not registered." : "Wristband is not active."}
                </p>
              )}
            </div>
          ) : null}
        </div>
      </section>

      <section className="premium-card rounded-xl p-4">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-950">Wristband List</h2>
            <p className="mt-1 text-sm text-slate-500">{loading ? "Loading wristbands..." : `${credentials.length} wristbands found`}</p>
          </div>
          <div className="grid gap-2 sm:grid-cols-[220px_160px]">
            <input className={inputClass} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search student or UID" />
            <select className={inputClass} value={status} onChange={(event) => setStatus(event.target.value as CredentialStatus | "")}>
              <option value="">All statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="DEACTIVATED">Deactivated</option>
            </select>
          </div>
        </div>

        <div className="grid gap-3 md:hidden">
          {credentials.map((credential) => (
            <article key={credential.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-slate-950">{credential.student.name}</p>
                  <p className="mt-1 text-xs text-slate-500">{formatStudentSummary(credential)}</p>
                </div>
                <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-bold ${statusTone(credential.status)}`}>{credential.status}</span>
              </div>
              <div className="mt-3 space-y-2 text-sm">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">UID</p>
                  <p className="break-all font-mono font-bold text-slate-800">{credential.credentialUID}</p>
                </div>
                {credential.nfcUrl ? (
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Tag URL</p>
                    <p className="break-all font-mono text-xs text-slate-500">{credential.nfcUrl}</p>
                  </div>
                ) : null}
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Issued</p>
                  <p className="mt-1 text-sm text-slate-700">{new Date(credential.issuedAt).toLocaleDateString()}</p>
                </div>
                {credential.deactivatedReason ? (
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Reason</p>
                    <p className="mt-1 text-sm text-slate-700">{credential.deactivatedReason}</p>
                  </div>
                ) : null}
              </div>
              <div className="mt-4 grid gap-2">
                {credential.status === "ACTIVE" ? (
                  <>
                    <input
                      className={inputClass}
                      value={deactivationReason[credential.id] ?? ""}
                      onChange={(event) => setDeactivationReason((current) => ({ ...current, [credential.id]: event.target.value }))}
                      placeholder="Reason required"
                    />
                    <div className="grid gap-2 sm:grid-cols-2">
                      <button type="button" className="btn btn-danger-light w-full justify-center" onClick={() => void handleDeactivate(credential.id)}>
                        Deactivate
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary w-full justify-center text-xs"
                        onClick={() => openAmend(credential)}
                      >
                        Amend
                      </button>
                    </div>
                  </>
                ) : credential.status === "DEACTIVATED" ? (
                  <button
                    type="button"
                    className="rounded-lg border border-emerald-300 px-3 py-2 text-sm font-bold text-emerald-700 transition-colors hover:bg-emerald-50"
                    onClick={() => { setReactivateTarget(credential); setReactivateReason(""); }}
                  >
                    Re-enable
                  </button>
                ) : (
                  <span className="text-xs text-slate-500">No action</span>
                )}
              </div>
            </article>
          ))}
          {credentials.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white px-3 py-6 text-center text-sm text-slate-500">
              No NFC wristbands found.
            </div>
          ) : null}
        </div>

        <div className="hidden overflow-x-auto md:block">
          <table className="w-full min-w-[780px] border-separate border-spacing-y-2 text-left text-sm">
            <thead className="text-xs font-bold uppercase text-slate-500">
              <tr>
                <th className="px-3 py-2">Student</th>
                <th className="px-3 py-2">UID</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Issued</th>
                <th className="px-3 py-2">Deactivate</th>
              </tr>
            </thead>
            <tbody>
              {credentials.map((credential) => (
                <tr key={credential.id} className="bg-white shadow-sm">
                  <td className="rounded-l-xl border-y border-l border-slate-200 px-3 py-3">
                    <p className="font-bold text-slate-950">{credential.student.name}</p>
                    <p className="text-xs text-slate-500">
                      {formatStudentSummary(credential)}
                    </p>
                  </td>
                  <td className="border-y border-slate-200 px-3 py-3">
                    <p className="font-mono font-bold text-slate-800">{credential.credentialUID}</p>
                    {credential.nfcUrl ? <p className="mt-1 break-all font-mono text-xs text-slate-500">Tag URL: {credential.nfcUrl}</p> : null}
                  </td>
                  <td className="border-y border-slate-200 px-3 py-3">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-bold ${statusTone(credential.status)}`}>{credential.status}</span>
                    {credential.deactivatedReason ? <p className="mt-1 text-xs text-slate-500">{credential.deactivatedReason}</p> : null}
                  </td>
                  <td className="border-y border-slate-200 px-3 py-3 text-slate-600">{new Date(credential.issuedAt).toLocaleDateString()}</td>
                  <td className="rounded-r-xl border-y border-r border-slate-200 px-3 py-3">
                    {credential.status === "ACTIVE" ? (
                      <div className="grid gap-2">
                        <div className="flex min-w-[260px] gap-2">
                          <input
                            className={inputClass}
                            value={deactivationReason[credential.id] ?? ""}
                            onChange={(event) => setDeactivationReason((current) => ({ ...current, [credential.id]: event.target.value }))}
                            placeholder="Reason required"
                          />
                          <button type="button" className="btn btn-danger-light" onClick={() => void handleDeactivate(credential.id)}>
                            Deactivate
                          </button>
                        </div>
                        <button
                          type="button"
                          className="btn btn-secondary justify-self-start text-xs"
                          onClick={() => openAmend(credential)}
                        >
                          Amend
                        </button>
                      </div>
                    ) : credential.status === "DEACTIVATED" ? (
                      <button
                        type="button"
                        className="rounded-lg border border-emerald-300 px-3 py-1.5 text-xs font-bold text-emerald-700 hover:bg-emerald-50 transition-colors"
                        onClick={() => { setReactivateTarget(credential); setReactivateReason(""); }}
                      >
                        Re-enable
                      </button>
                    ) : (
                      <span className="text-xs text-slate-500">No action</span>
                    )}
                  </td>
                </tr>
              ))}
              {credentials.length === 0 ? (
                <tr>
                  <td className="rounded-xl border border-slate-200 bg-white px-3 py-6 text-center text-sm text-slate-500" colSpan={5}>
                    No NFC wristbands found.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
      {amendTarget ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[calc(100vh-2rem)] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="text-base font-bold text-slate-950">Amend NFC Wristband</h2>
            <p className="mt-1 text-sm text-slate-500">
              Current UID: <span className="font-mono font-bold text-slate-800">{amendTarget.credentialUID}</span>
              {" · "}
              {amendTarget.student.name}
            </p>

            {error ? (
              <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
            ) : null}

            <div className="mt-4 grid gap-3">
              <label className="grid gap-1 text-xs font-bold uppercase text-slate-500">
                Student
                <select
                  className={inputClass}
                  value={amendStudentId}
                  onChange={(event) => setAmendStudentId(event.target.value)}
                >
                  {activeStudents.map((student) => (
                    <option key={student.id} value={student.id}>
                      {studentLabel(student)}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-1 text-xs font-bold uppercase text-slate-500">
                Wristband UID
                <input
                  className={`${inputClass} font-mono uppercase`}
                  value={amendUID}
                  onChange={(event) => setAmendUID(event.target.value)}
                  placeholder="Wristband UID"
                />
              </label>

              <label className="grid gap-1 text-xs font-bold uppercase text-slate-500">
                Amendment reason
                <input
                  className={inputClass}
                  value={amendReason}
                  onChange={(event) => setAmendReason(event.target.value)}
                  placeholder="Required"
                />
              </label>
            </div>

            <div className="mt-5 grid gap-2 sm:flex">
              <button
                type="button"
                className="btn btn-primary w-full justify-center sm:w-auto"
                onClick={() => void handleAmend()}
                disabled={amendLoading || !amendReason.trim()}
              >
                {amendLoading ? "Saving…" : "Save"}
              </button>
              <button type="button" className="btn btn-secondary w-full justify-center sm:w-auto" onClick={closeAmend} disabled={amendLoading}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Re-enable modal */}
      {reactivateTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => { setReactivateTarget(null); setReactivateReason(""); }}>
          <div className="max-h-[calc(100vh-2rem)] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-black text-slate-950">Re-enable NFC wristband</h2>
            <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
              <p className="font-bold text-slate-900 font-mono">{reactivateTarget.credentialUID}</p>
              <p className="mt-1 text-slate-700">
                Student: <span className="font-semibold">{reactivateTarget.student.name}</span> · {reactivateTarget.student.admissionNumber}
              </p>
              {reactivateTarget.deactivatedReason && (
                <p className="mt-1 text-xs text-slate-500">Previously deactivated: {reactivateTarget.deactivatedReason}</p>
              )}
            </div>
            <label className="mt-4 grid gap-1.5 text-xs font-bold uppercase text-slate-500">
              Reason (required)
              <textarea
                className="premium-control min-h-[80px] resize-none rounded-xl text-sm"
                value={reactivateReason}
                onChange={(e) => setReactivateReason(e.target.value)}
                placeholder="e.g. Card found and verified in good condition"
                autoFocus
              />
            </label>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => void handleReactivate()}
                disabled={reactivateLoading || !reactivateReason.trim()}
                className="btn btn-primary flex-1 rounded-xl py-2.5 text-sm font-black"
              >
                {reactivateLoading ? "Enabling…" : "Re-enable wristband"}
              </button>
              <button
                type="button"
                onClick={() => { setReactivateTarget(null); setReactivateReason(""); }}
                className="btn btn-secondary flex-1 rounded-xl py-2.5 text-sm font-bold"
                disabled={reactivateLoading}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
