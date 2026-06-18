import { useEffect, useRef, useState } from "react";
import { PrintableMarksheet } from "../components/marksheets/PrintableMarksheet";
import { Icon } from "../components/layout/Icon";
import {
  approveMarksheetBatch,
  commitMarksheetEntry,
  fetchMarksheetBatches,
  fetchMarksheetStudents,
  returnMarksheetBatch,
} from "../client/marksheetsClient";
import { dryRunMarksImport } from "../client/importsClient";
import { fetchReportContext } from "../client/reportsClient";
import { fetchSettings } from "../client/settingsClient";
import type { ImportPreview } from "../shared/types/imports";
import type { MarksheetBatch, MarksheetStudent } from "../shared/types/marksheets";
import type { ReportContext, ReportContextOption } from "../shared/types/reports";
import { defaultSettingsSections, type SettingsSections } from "../shared/types/settings";
import { getSchoolDisplayName } from "../components/layout/branding";

type Tab = "print" | "enter" | "review";

type MarksheetFilters = {
  classId: string;
  streamId: string;
  subjectId: string;
  termId: string;
  examType: "BOT" | "MOT" | "EOT";
};

type MarkEntry = {
  student: MarksheetStudent;
  marks: string;
  remarks: string;
};

const EXAM_OPTIONS: Array<{ value: "BOT" | "MOT" | "EOT"; label: string }> = [
  { value: "BOT", label: "BOT - Beginning of Term" },
  { value: "MOT", label: "MOT - Mid Term" },
  { value: "EOT", label: "EOT - End of Term" },
];

function csvCell(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function buildCsv(
  entries: MarkEntry[],
  ctx: { className: string; streamName: string; subjectName: string; termName: string; examType: string },
): string {
  const header = "admissionNumber,studentName,class,stream,subject,term,examType,marks,comments";
  const rows = entries
    .filter((e) => {
      const v = e.marks.trim().toUpperCase();
      return v !== "" && v !== "AB" && v !== "EX";
    })
    .map((e) => {
      const name = `${e.student.firstName} ${e.student.lastName}`;
      return [
        csvCell(e.student.admissionNumber),
        csvCell(name),
        csvCell(ctx.className),
        csvCell(ctx.streamName),
        csvCell(ctx.subjectName),
        csvCell(ctx.termName),
        csvCell(ctx.examType),
        csvCell(e.marks.trim()),
        csvCell(e.remarks.trim()),
      ].join(",");
    });
  if (rows.length === 0) return "";
  return [header, ...rows].join("\n");
}

function findOption(opts: ReportContextOption[], id: string): ReportContextOption | undefined {
  return opts.find((o) => o.id === id);
}

// ── Context Selector ──────────────────────────────────────────────────────────

type ContextSelectorProps = {
  ctx: ReportContext | null;
  filters: MarksheetFilters;
  subjectsLoading: boolean;
  subjectOptions: ReportContextOption[];
  onChange: (filters: MarksheetFilters) => void;
};

function ContextSelector({ ctx, filters, subjectsLoading, subjectOptions, onChange }: ContextSelectorProps) {
  const filteredStreams = filters.classId
    ? (ctx?.streams ?? []).filter((s) => !s.classId || s.classId === filters.classId)
    : (ctx?.streams ?? []);

  function set(key: keyof MarksheetFilters, value: string) {
    const next = { ...filters, [key]: value };
    if (key === "classId") next.streamId = "";
    onChange(next as MarksheetFilters);
  }

  const selectClass = "premium-control w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none";

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-5">
      <div>
        <label className="mb-1 block text-xs font-semibold text-slate-500 uppercase tracking-wide">Class</label>
        <select className={selectClass} value={filters.classId} onChange={(e) => set("classId", e.target.value)}>
          <option value="">Select...</option>
          {(ctx?.classes ?? []).map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-1 block text-xs font-semibold text-slate-500 uppercase tracking-wide">Stream</label>
        <select className={selectClass} value={filters.streamId} onChange={(e) => set("streamId", e.target.value)} disabled={!filters.classId}>
          <option value="">Select...</option>
          {filteredStreams.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-1 block text-xs font-semibold text-slate-500 uppercase tracking-wide">Subject</label>
        <select
          className={selectClass}
          value={filters.subjectId}
          onChange={(e) => set("subjectId", e.target.value)}
          disabled={subjectsLoading || subjectOptions.length === 0}
        >
          {subjectsLoading ? (
            <option value="">Loading subjects...</option>
          ) : subjectOptions.length === 0 ? (
            <option value="">No subjects found</option>
          ) : (
            <>
              <option value="">Select...</option>
              {subjectOptions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </>
          )}
        </select>
        {!subjectsLoading && subjectOptions.length === 0 ? (
          <p className="mt-1 text-xs text-amber-700">
            No subjects found. Add subjects in Settings &gt; School Structure.
          </p>
        ) : null}
      </div>
      <div>
        <label className="mb-1 block text-xs font-semibold text-slate-500 uppercase tracking-wide">Term</label>
        <select className={selectClass} value={filters.termId} onChange={(e) => set("termId", e.target.value)}>
          <option value="">Select...</option>
          {(ctx?.terms ?? []).map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-1 block text-xs font-semibold text-slate-500 uppercase tracking-wide">Exam Type</label>
        <select className={selectClass} value={filters.examType} onChange={(e) => set("examType", e.target.value as "BOT" | "MOT" | "EOT")}>
          {EXAM_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>
    </div>
  );
}

// ── Print Tab ─────────────────────────────────────────────────────────────────

type PrintTabProps = {
  ctx: ReportContext | null;
  settings: SettingsSections;
  filters: MarksheetFilters;
  students: MarksheetStudent[];
  loadingStudents: boolean;
  subjectsLoading: boolean;
  subjectOptions: ReportContextOption[];
  onChange: (filters: MarksheetFilters) => void;
};

function PrintTab({
  ctx,
  settings,
  filters,
  students,
  loadingStudents,
  subjectsLoading,
  subjectOptions,
  onChange,
}: PrintTabProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    setSelectedIds(new Set());
  }, [filters.classId, filters.streamId]);

  // Subject is optional for printing - a blank roster is still useful
  const ready = !!(filters.classId && filters.streamId && filters.termId);
  const schoolName = getSchoolDisplayName(settings.school, ctx?.school?.name ?? "");
  const academicYear =
    settings.academic.activeAcademicYear ||
    ctx?.academicYears.find((y) => y.isActive)?.name ||
    (ctx?.academicYears[0]?.name ?? "");
  const termName = findOption(ctx?.terms ?? [], filters.termId)?.name ?? "";
  const className = findOption(ctx?.classes ?? [], filters.classId)?.name ?? "";
  const streamName = findOption(ctx?.streams ?? [], filters.streamId)?.name ?? "";
  const subjectName = findOption(ctx?.subjects ?? [], filters.subjectId)?.name ?? "";

  const marksheetsToPrint =
    selectedIds.size > 0 ? students.filter((s) => selectedIds.has(s.id)) : students;

  const allSelected = students.length > 0 && selectedIds.size === students.length;

  function toggleStudent(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAll() {
    setSelectedIds(new Set(students.map((s) => s.id)));
  }

  function clearSelection() {
    setSelectedIds(new Set());
  }

  const commonMarksheetProps = {
    schoolName,
    schoolAddress: settings.school.address,
    schoolPhone: settings.school.phone,
    schoolEmail: settings.school.email,
    footerText: settings.school.marksheetFooterText,
    academicYear,
    termName,
    className,
    streamName,
    subjectName,
    examType: filters.examType,
    printStyle: settings.marksheets.printStyle,
    includeQrCode: settings.marksheets.includeQrCode,
    includeHumanReadableMarksheetId: settings.marksheets.includeHumanReadableMarksheetId,
    validMarkValues: settings.marksheets.validMarkValues,
  };

  return (
    <div>
      <div className="no-print premium-card mb-6 rounded-2xl p-5">
        <h2 className="mb-4 text-sm font-bold uppercase tracking-wide text-slate-500">Select Marksheet Context</h2>
        <ContextSelector
          ctx={ctx}
          filters={filters}
          subjectsLoading={subjectsLoading}
          subjectOptions={subjectOptions}
          onChange={onChange}
        />
      </div>

      {ready && (
        <div>
          {/* ── Student selection + print controls (screen only) ── */}
          <div className="no-print premium-card mb-4 rounded-2xl p-4">
            <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-slate-500">
                {loadingStudents
                  ? "Loading students..."
                  : selectedIds.size > 0
                    ? `${selectedIds.size} of ${students.length} selected - ${selectedIds.size} marksheet${selectedIds.size !== 1 ? "s" : ""} will print`
                    : `${students.length} student${students.length !== 1 ? "s" : ""} - all ${students.length} marksheets will print`}
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="btn btn-secondary text-xs"
                  onClick={selectAll}
                  disabled={loadingStudents || students.length === 0 || allSelected}
                >
                  Select All
                </button>
                <button
                  type="button"
                  className="btn btn-secondary text-xs"
                  onClick={clearSelection}
                  disabled={selectedIds.size === 0}
                >
                  Clear
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => window.print()}
                  disabled={loadingStudents || students.length === 0}
                >
                  <Icon name="file" className="h-4 w-4" />
                  {selectedIds.size > 0 ? `Print ${selectedIds.size} Selected` : "Print All"}
                </button>
              </div>
            </div>

            {!loadingStudents && students.length > 0 && (
              <div className="overflow-hidden rounded-xl border border-slate-200">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50">
                      <th className="w-8 border-b border-slate-200 px-3 py-2 text-center">
                        <input
                          type="checkbox"
                          aria-label="Select all students"
                          checked={allSelected}
                          onChange={() => (allSelected ? clearSelection() : selectAll())}
                        />
                      </th>
                      <th className="w-10 border-b border-slate-200 px-3 py-2 text-left text-xs font-semibold text-slate-500">#</th>
                      <th className="border-b border-slate-200 px-3 py-2 text-left text-xs font-semibold text-slate-500">Adm. No.</th>
                      <th className="border-b border-slate-200 px-3 py-2 text-left text-xs font-semibold text-slate-500">Student Name</th>
                    </tr>
                  </thead>
                  <tbody>
                    {students.map((student, index) => {
                      const checked = selectedIds.has(student.id);
                      return (
                        <tr
                          key={student.id}
                          className={`cursor-pointer transition-colors ${
                            checked ? "bg-blue-50" : index % 2 === 0 ? "bg-white" : "bg-slate-50/50"
                          } hover:bg-blue-50/70`}
                          onClick={() => toggleStudent(student.id)}
                        >
                          <td className="px-3 py-2 text-center">
                            <input
                              type="checkbox"
                              aria-label={`Select ${student.firstName} ${student.lastName}`}
                              checked={checked}
                              onChange={() => toggleStudent(student.id)}
                              onClick={(e) => e.stopPropagation()}
                            />
                          </td>
                          <td className="px-3 py-2 text-xs text-slate-400">{index + 1}</td>
                          <td className="px-3 py-2 font-mono text-xs text-slate-600">{student.admissionNumber}</td>
                          <td className="px-3 py-2 font-medium text-slate-800">
                            {student.firstName} {student.lastName}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {!loadingStudents && students.length === 0 && (
              <p className="py-2 text-sm text-slate-400">No students found for this class and stream.</p>
            )}
          </div>

          {/* ── Screen preview - no-print ── */}
          <div className="marksheet-card-wrapper no-print premium-card rounded-2xl p-4 sm:p-6">
            <PrintableMarksheet {...commonMarksheetProps} students={students} />
          </div>

          {/* ── Print-only: one marksheet per class/stream/subject/exam ── */}
          <div className="print-only">
            <PrintableMarksheet {...commonMarksheetProps} students={marksheetsToPrint} />
          </div>
        </div>
      )}

      {!ready && (
        <div className="no-print rounded-2xl border-2 border-dashed border-slate-200 py-16 text-center text-slate-400">
          <Icon name="clipboard" className="mx-auto mb-3 h-10 w-10 opacity-30" />
          <p className="text-sm font-medium">Select class, stream, and term to preview the marksheet.</p>
        </div>
      )}
    </div>
  );
}

// ── Enter Marks Tab ───────────────────────────────────────────────────────────

type EnterTabProps = {
  ctx: ReportContext | null;
  filters: MarksheetFilters;
  students: MarksheetStudent[];
  loadingStudents: boolean;
  subjectsLoading: boolean;
  subjectOptions: ReportContextOption[];
  onChange: (filters: MarksheetFilters) => void;
};

function validateMark(value: string): { ok: boolean; message?: string } {
  const v = value.trim().toUpperCase();
  if (v === "" || v === "AB" || v === "EX") return { ok: true };
  const num = Number(v);
  if (!Number.isNaN(num) && Number.isInteger(num) && num >= 0 && num <= 100) return { ok: true };
  return { ok: false, message: "Enter 0-100, AB, EX, or leave blank" };
}

function EnterTab({
  ctx,
  filters,
  students,
  loadingStudents,
  subjectsLoading,
  subjectOptions,
  onChange,
}: EnterTabProps) {
  const [entries, setEntries] = useState<MarkEntry[]>([]);
  const [dryResult, setDryResult] = useState<ImportPreview | null>(null);
  const [committed, setCommitted] = useState<ImportPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const prevStudentKey = useRef("");

  const className = findOption(ctx?.classes ?? [], filters.classId)?.name ?? "";
  const streamName = findOption(ctx?.streams ?? [], filters.streamId)?.name ?? "";
  const subjectName = findOption(ctx?.subjects ?? [], filters.subjectId)?.name ?? "";
  const termName = findOption(ctx?.terms ?? [], filters.termId)?.name ?? "";

  useEffect(() => {
    const key = students.map((s) => s.id).join(",");
    if (key === prevStudentKey.current) return;
    prevStudentKey.current = key;
    setEntries(students.map((s) => ({ student: s, marks: "", remarks: "" })));
    setDryResult(null);
    setCommitted(null);
    setError("");
  }, [students]);

  function updateEntry(index: number, field: "marks" | "remarks", value: string) {
    setEntries((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
    setDryResult(null);
    setCommitted(null);
  }

  const csvText = buildCsv(entries, { className, streamName, subjectName, termName, examType: filters.examType });
  const marksEntered = entries.filter((e) => e.marks.trim() !== "").length;
  const validationErrors = entries.filter((e) => !validateMark(e.marks).ok);
  const hasValidationErrors = validationErrors.length > 0;

  async function handleDryRun() {
    if (!csvText) {
      setError("Enter at least one mark before running dry run.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const result = await dryRunMarksImport(csvText);
      setDryResult(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Dry run failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleCommit() {
    if (!csvText) return;
    setError("");
    setLoading(true);
    try {
      const result = await commitMarksheetEntry(csvText, {
        className,
        streamName,
        subjectName,
        termName,
        examType: filters.examType,
        operatorName: "Operator",
        studentsCount: students.length,
        marksEntered,
      });
      setCommitted(result);
      setDryResult(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Commit failed");
    } finally {
      setLoading(false);
    }
  }

  const ready = !!(filters.classId && filters.streamId && filters.subjectId && filters.termId);

  if (!ready) {
    return (
      <div>
        <div className="premium-card mb-6 rounded-2xl p-5">
          <h2 className="mb-4 text-sm font-bold uppercase tracking-wide text-slate-500">Select Marksheet Context</h2>
          <ContextSelector
            ctx={ctx}
            filters={filters}
            subjectsLoading={subjectsLoading}
            subjectOptions={subjectOptions}
            onChange={onChange}
          />
        </div>
        <div className="rounded-2xl border-2 border-dashed border-slate-200 py-16 text-center text-slate-400">
          <Icon name="clipboard" className="mx-auto mb-3 h-10 w-10 opacity-30" />
          <p className="text-sm font-medium">Select all context fields to load the student list.</p>
        </div>
      </div>
    );
  }

  if (committed) {
    return (
      <div>
        <div className="premium-card mb-6 rounded-2xl p-5">
          <h2 className="mb-4 text-sm font-bold uppercase tracking-wide text-slate-500">Select Marksheet Context</h2>
          <ContextSelector
            ctx={ctx}
            filters={filters}
            subjectsLoading={subjectsLoading}
            subjectOptions={subjectOptions}
            onChange={onChange}
          />
        </div>
        <div className="flex flex-col items-center gap-4 rounded-2xl border-2 border-green-200 bg-green-50 py-12">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100">
            <Icon name="check" className="h-8 w-8 text-green-600" />
          </div>
          <div className="text-center">
            <p className="text-lg font-bold text-green-800">Marks Committed Successfully</p>
            <p className="mt-1 text-sm text-green-700">
              {committed.validRows} mark{committed.validRows !== 1 ? "s" : ""} saved for {subjectName} - {termName} - {filters.examType}
            </p>
            {committed.batchId && (
              <p className="mt-1 font-mono text-xs text-green-600">Batch: {committed.batchId}</p>
            )}
            <p className="mt-2 text-sm text-slate-500">The batch is now visible in HM Review for approval.</p>
          </div>
          <button
            type="button"
            className="btn btn-secondary mt-2"
            onClick={() => {
              setCommitted(null);
              setEntries(students.map((s) => ({ student: s, marks: "", remarks: "" })));
              setDryResult(null);
            }}
          >
            Enter More Marks
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="premium-card mb-6 rounded-2xl p-5">
        <h2 className="mb-4 text-sm font-bold uppercase tracking-wide text-slate-500">Select Marksheet Context</h2>
        <ContextSelector
          ctx={ctx}
          filters={filters}
          subjectsLoading={subjectsLoading}
          subjectOptions={subjectOptions}
          onChange={onChange}
        />
      </div>

      {loadingStudents ? (
        <div className="py-12 text-center text-slate-400">Loading students...</div>
      ) : students.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-slate-200 py-12 text-center text-slate-400">
          <p className="text-sm font-medium">No students enrolled for this class and stream.</p>
        </div>
      ) : (
        <div>
          {/* Entry table */}
          <div className="premium-card mb-4 overflow-hidden rounded-2xl">
            <div className="border-b border-slate-100 px-5 py-3 flex items-center justify-between">
              <div>
                <p className="font-semibold text-slate-800">
                  {className} - {streamName} - {subjectName} - {termName} - {filters.examType}
                </p>
                <p className="mt-0.5 text-xs text-slate-500">
                  {students.length} students - {marksEntered} marks entered
                  {hasValidationErrors ? ` - ${validationErrors.length} invalid` : ""}
                </p>
              </div>
              {hasValidationErrors && (
                <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700">
                  {validationErrors.length} invalid
                </span>
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50">
                    <th className="w-10 border-b border-slate-200 px-3 py-2.5 text-center text-xs font-semibold text-slate-500">No.</th>
                    <th className="border-b border-slate-200 px-3 py-2.5 text-left text-xs font-semibold text-slate-500">Adm. No.</th>
                    <th className="border-b border-slate-200 px-3 py-2.5 text-left text-xs font-semibold text-slate-500">Student Name</th>
                    <th className="w-32 border-b border-slate-200 px-3 py-2.5 text-center text-xs font-semibold text-slate-500">Mark</th>
                    <th className="border-b border-slate-200 px-3 py-2.5 text-left text-xs font-semibold text-slate-500">Remarks</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry, index) => {
                    const validation = validateMark(entry.marks);
                    const isAbsent = entry.marks.trim().toUpperCase() === "AB";
                    const isExempt = entry.marks.trim().toUpperCase() === "EX";
                    return (
                      <tr key={entry.student.id} className={index % 2 === 0 ? "bg-white" : "bg-slate-50/50"}>
                        <td className="px-3 py-2 text-center text-xs text-slate-400">{index + 1}</td>
                        <td className="px-3 py-2 font-mono text-xs text-slate-600">{entry.student.admissionNumber}</td>
                        <td className="px-3 py-2 font-medium text-slate-800">
                          {entry.student.firstName} {entry.student.lastName}
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="text"
                            value={entry.marks}
                            maxLength={3}
                            placeholder="-"
                            onChange={(e) => updateEntry(index, "marks", e.target.value)}
                            className={`premium-control w-full rounded-lg border px-2.5 py-1.5 text-center text-sm font-semibold uppercase focus:outline-none ${
                              !validation.ok
                                ? "border-red-300 bg-red-50 text-red-700 focus:ring-2 focus:ring-red-200"
                                : isAbsent
                                ? "border-amber-300 bg-amber-50 text-amber-700"
                                : isExempt
                                ? "border-purple-300 bg-purple-50 text-purple-700"
                                : "border-slate-200"
                            }`}
                          />
                          {!validation.ok && (
                            <p className="mt-0.5 text-center text-[10px] text-red-600">{validation.message}</p>
                          )}
                          {isAbsent && <p className="mt-0.5 text-center text-[10px] text-amber-600">Not submitted</p>}
                          {isExempt && <p className="mt-0.5 text-center text-[10px] text-purple-600">Not submitted</p>}
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="text"
                            value={entry.remarks}
                            placeholder="optional"
                            onChange={(e) => updateEntry(index, "remarks", e.target.value)}
                            className="premium-control w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm focus:outline-none"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
          )}

          {/* Dry run results */}
          {dryResult && (
            <div
              className={`mb-4 rounded-xl border px-4 py-3 ${
                dryResult.status === "FAILED" || dryResult.invalidRows > 0
                  ? "border-red-200 bg-red-50"
                  : "border-green-200 bg-green-50"
              }`}
            >
              <p className={`mb-1 font-semibold ${dryResult.invalidRows > 0 ? "text-red-700" : "text-green-700"}`}>
                Dry Run: {dryResult.validRows} valid - {dryResult.invalidRows} invalid - {dryResult.totalRows} total
              </p>
              {dryResult.rows
                .filter((r) => !r.isValid)
                .map((r) => (
                  <p key={r.rowNumber} className="text-xs text-red-600">
                    Row {r.rowNumber}: {r.errors.join("; ")}
                  </p>
                ))}
              {dryResult.invalidRows === 0 && (
                <p className="text-sm text-green-600">All rows are valid. You can now commit the marks.</p>
              )}
            </div>
          )}

          {/* Action buttons */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleDryRun}
              disabled={loading || !csvText || hasValidationErrors}
            >
              {loading ? "Running..." : "Dry Run"}
            </button>
            <button
              type="button"
              className="btn btn-success"
              onClick={handleCommit}
              disabled={loading || !csvText || hasValidationErrors || !dryResult || dryResult.invalidRows > 0}
            >
              {loading ? "Committing..." : "Commit Marks"}
            </button>
            <p className="ml-auto text-xs text-slate-400">
              AB / EX entries are noted on the physical sheet but not submitted to the system.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ── HM Review Tab ─────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  PENDING_REVIEW: { label: "Pending Review", dot: "bg-amber-400", text: "text-amber-700", bg: "bg-amber-50 border-amber-200" },
  APPROVED: { label: "Approved", dot: "bg-green-500", text: "text-green-700", bg: "bg-green-50 border-green-200" },
  RETURNED: { label: "Returned for Correction", dot: "bg-red-500", text: "text-red-700", bg: "bg-red-50 border-red-200" },
};

function HmReviewTab() {
  const [batches, setBatches] = useState<MarksheetBatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [returnNotes, setReturnNotes] = useState<Record<string, string>>({});
  const [showReturn, setShowReturn] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const data = await fetchMarksheetBatches();
      setBatches(data.batches);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load batches");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleApprove(batchId: string) {
    setActionLoading(batchId);
    try {
      await approveMarksheetBatch(batchId, "");
      setBatches((prev) =>
        prev.map((b) => (b.id === batchId ? { ...b, approvalStatus: "APPROVED", hmNote: null } : b)),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Approval failed");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleReturn(batchId: string) {
    const note = returnNotes[batchId]?.trim() ?? "";
    if (!note) {
      setError("A reason is required when returning marks.");
      return;
    }
    setActionLoading(batchId);
    setError("");
    try {
      await returnMarksheetBatch(batchId, note);
      setBatches((prev) =>
        prev.map((b) => (b.id === batchId ? { ...b, approvalStatus: "RETURNED", hmNote: note } : b)),
      );
      setShowReturn(null);
      setReturnNotes((prev) => ({ ...prev, [batchId]: "" }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Return failed");
    } finally {
      setActionLoading(null);
    }
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  }

  function batchTitle(batch: MarksheetBatch): string {
    const c = batch.parsedContext;
    if (c) return `${c.className} - ${c.streamName} - ${c.subjectName} - ${c.examType}`;
    return batch.summary ?? `Batch ${batch.id.slice(0, 8)}`;
  }

  function batchMeta(batch: MarksheetBatch): string {
    const c = batch.parsedContext;
    if (c) {
      return `${c.termName} - ${c.marksEntered} of ${c.studentsCount} marks entered - by ${c.operatorName}`;
    }
    return `${batch.marksCount} marks`;
  }

  if (loading) return <div className="py-16 text-center text-slate-400">Loading batches...</div>;

  return (
    <div>
      {error && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {batches.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-slate-200 py-16 text-center text-slate-400">
          <Icon name="clipboard" className="mx-auto mb-3 h-10 w-10 opacity-30" />
          <p className="text-sm font-medium">No committed batches yet.</p>
          <p className="mt-1 text-xs">Marks submitted via the Enter Marks tab will appear here.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {batches.map((batch) => {
            const cfg = STATUS_CONFIG[batch.approvalStatus];
            const isActing = actionLoading === batch.id;
            const isPending = batch.approvalStatus === "PENDING_REVIEW";
            const isReturned = batch.approvalStatus === "RETURNED";
            const showingReturn = showReturn === batch.id;

            return (
              <div key={batch.id} className={`premium-card rounded-2xl border p-5 ${isPending || isReturned ? "" : "opacity-75"}`}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${cfg.bg} ${cfg.text}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
                        {cfg.label}
                      </span>
                      {batch.source === "marksheet" && (
                        <span className="rounded-full bg-blue-50 border border-blue-200 px-2.5 py-0.5 text-xs font-semibold text-blue-700">
                          Marksheet
                        </span>
                      )}
                    </div>
                    <p className="mt-2 font-semibold text-slate-800">{batchTitle(batch)}</p>
                    <p className="mt-0.5 text-xs text-slate-500">{batchMeta(batch)}</p>
                    <p className="mt-0.5 text-xs text-slate-400">{formatDate(batch.createdAt)}</p>
                    {batch.hmNote && (
                      <div className={`mt-2 rounded-lg border px-3 py-2 text-xs ${cfg.bg} ${cfg.text}`}>
                        <span className="font-semibold">Note: </span>{batch.hmNote}
                      </div>
                    )}
                  </div>

                  {(isPending || isReturned) && (
                    <div className="flex shrink-0 flex-col items-stretch gap-2 sm:items-end">
                      <button
                        type="button"
                        className="btn btn-success"
                        onClick={() => handleApprove(batch.id)}
                        disabled={isActing}
                      >
                        {isActing && !showingReturn ? "Approving..." : "Approve"}
                      </button>
                      <button
                        type="button"
                        className="btn btn-danger-light"
                        onClick={() => setShowReturn(showingReturn ? null : batch.id)}
                        disabled={isActing}
                      >
                        Return for Correction
                      </button>
                    </div>
                  )}
                </div>

                {showingReturn && (
                  <div className="mt-3 border-t border-slate-100 pt-3">
                    <label className="mb-1.5 block text-xs font-semibold text-slate-600">
                      Reason for returning (required)
                    </label>
                    <textarea
                      className="premium-control w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none"
                      rows={2}
                      placeholder="e.g. Marks for row 4 appear incorrect - please verify and resubmit."
                      value={returnNotes[batch.id] ?? ""}
                      onChange={(e) => setReturnNotes((prev) => ({ ...prev, [batch.id]: e.target.value }))}
                    />
                    <div className="mt-2 flex gap-2">
                      <button
                        type="button"
                        className="btn btn-danger-light"
                        onClick={() => handleReturn(batch.id)}
                        disabled={isActing || !(returnNotes[batch.id]?.trim())}
                      >
                        {isActing ? "Returning..." : "Confirm Return"}
                      </button>
                      <button type="button" className="btn btn-secondary" onClick={() => setShowReturn(null)}>
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

const EMPTY_FILTERS: MarksheetFilters = {
  classId: "",
  streamId: "",
  subjectId: "",
  termId: "",
  examType: "EOT",
};

export function MarksheetsPage() {
  const [tab, setTab] = useState<Tab>("print");
  const [ctx, setCtx] = useState<ReportContext | null>(null);
  const [settings, setSettings] = useState<SettingsSections>(defaultSettingsSections);
  const [filters, setFilters] = useState<MarksheetFilters>(EMPTY_FILTERS);
  const [students, setStudents] = useState<MarksheetStudent[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [contextLoading, setContextLoading] = useState(true);

  useEffect(() => {
    setContextLoading(true);
    Promise.all([fetchReportContext(), fetchSettings()])
      .then(([data, loadedSettings]) => {
        setCtx(data);
        setSettings(loadedSettings.sections);
        const activeTerm =
          data.terms.find((t) => t.name === loadedSettings.sections.academic.activeTerm) ??
          data.terms.find((t) => t.isActive) ??
          data.terms[0];
        if (activeTerm) setFilters((prev) => ({ ...prev, termId: activeTerm.id }));
        if (loadedSettings.sections.academic.defaultAssessmentType !== "TERM_SUMMARY") {
          setFilters((prev) => ({
            ...prev,
            examType: loadedSettings.sections.academic.defaultAssessmentType as "BOT" | "MOT" | "EOT",
          }));
        }
      })
      .catch(() => {})
      .finally(() => setContextLoading(false));
  }, []);

  const subjectOptions = ctx?.subjects ?? [];

  useEffect(() => {
    if (!filters.classId || !filters.streamId) {
      setStudents([]);
      return;
    }
    setLoadingStudents(true);
    fetchMarksheetStudents(filters.classId, filters.streamId)
      .then((data) => setStudents(data.students))
      .catch(() => setStudents([]))
      .finally(() => setLoadingStudents(false));
  }, [filters.classId, filters.streamId]);

  const tabs: Array<{ id: Tab; label: string }> = [
    { id: "print", label: "Print Sheet" },
    { id: "enter", label: "Enter Marks" },
    { id: "review", label: "HM Review" },
  ];

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-6xl px-4 py-4 sm:px-6">
        {/* Page header */}
        <div className="page-header mb-6">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-200">
              <Icon name="clipboard" className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Marksheets</h1>
              <p className="text-sm text-slate-500">Print handwritten templates - Enter marks - HM approval</p>
            </div>
          </div>
        </div>

        {/* Tab bar */}
        <div className="tab-tray mb-6 no-print">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`tab-button ${tab === t.id ? "tab-button-active" : ""}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {tab === "print" && (
          <PrintTab
            ctx={ctx}
            settings={settings}
            filters={filters}
            students={students}
            loadingStudents={loadingStudents}
            subjectsLoading={contextLoading}
            subjectOptions={subjectOptions}
            onChange={setFilters}
          />
        )}
        {tab === "enter" && (
          <EnterTab
            ctx={ctx}
            filters={filters}
            students={students}
            loadingStudents={loadingStudents}
            subjectsLoading={contextLoading}
            subjectOptions={subjectOptions}
            onChange={setFilters}
          />
        )}
        {tab === "review" && <HmReviewTab />}
      </div>
    </main>
  );
}
