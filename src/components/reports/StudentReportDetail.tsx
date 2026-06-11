import { useEffect, useMemo, useState } from "react";
import { GRADE_BANDS } from "../../shared/constants/grades";
import type { AssessmentFilter, StudentReportCard } from "../../shared/types/reports";

type Props = {
  card: StudentReportCard | null;
  assessmentType?: AssessmentFilter;
  showPositions?: boolean;
  onShowPositionsChange?: (showPositions: boolean) => void;
};

type ReportDraft = {
  classTeacherComment: string;
  headTeacherComment: string;
  conductNote: string;
  classTeacherName: string;
  headTeacherName: string;
  issueDate: string;
  showGradingKey: boolean;
  showPositions: boolean;
};

function ShieldIcon() {
  return (
    <svg
      viewBox="0 0 80 96"
      className="h-16 w-14 flex-shrink-0 print:h-9 print:w-8"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M40 4L8 16v28c0 22 14.4 42.4 32 48C57.6 86.4 72 66 72 44V16L40 4z"
        fill="rgba(255,255,255,0.12)"
        stroke="rgba(255,255,255,0.5)"
        strokeWidth="2"
      />
      <text
        x="40"
        y="58"
        textAnchor="middle"
        fontSize="18"
        fontWeight="bold"
        fill="white"
        fontFamily="Georgia, serif"
      >
        UHS
      </text>
    </svg>
  );
}

const GRADE_COLORS: Record<string, string> = {
  D1: "bg-emerald-100 text-emerald-800",
  D2: "bg-emerald-50 text-emerald-700",
  C3: "bg-blue-100 text-blue-800",
  C4: "bg-blue-50 text-blue-700",
  C5: "bg-sky-50 text-sky-700",
  C6: "bg-yellow-50 text-yellow-700",
  P7: "bg-orange-50 text-orange-700",
  P8: "bg-red-50 text-red-700",
  F9: "bg-red-100 text-red-800",
};

function GradeBadge({ grade }: { grade: string | null }) {
  if (!grade) return <span className="text-slate-400">-</span>;
  const color = GRADE_COLORS[grade] ?? "bg-slate-100 text-slate-700";
  return (
    <span className={`inline-block rounded px-1.5 py-0.5 text-xs font-bold ${color}`}>
      {grade}
    </span>
  );
}

const ASSESSMENT_LABELS: Record<AssessmentFilter, string> = {
  BOT: "BOT",
  MOT: "MOT",
  EOT: "EOT",
  TERM_SUMMARY: "Term Summary",
};

const CONTACT_LABELS = {
  READY: "Parent contact ready",
  NO_RECIPIENT: "No report recipient",
  MISSING_PHONE_EMAIL: "Missing phone/email",
};

const CONTACT_CLASSES = {
  READY: "bg-emerald-100 text-emerald-700 ring-emerald-200",
  NO_RECIPIENT: "bg-red-100 text-red-700 ring-red-200",
  MISSING_PHONE_EMAIL: "bg-amber-100 text-amber-700 ring-amber-200",
};

function buildDefaultDraft(card: StudentReportCard): ReportDraft {
  return {
    classTeacherComment: card.comments || "",
    headTeacherComment: "",
    conductNote: "",
    classTeacherName: "",
    headTeacherName: "Head Teacher",
    issueDate: new Date().toISOString().slice(0, 10),
    showGradingKey: true,
    showPositions: false,
  };
}

function formatDisplayDate(value: string) {
  const date = value ? new Date(`${value}T00:00:00`) : new Date();
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function EmptyComment() {
  return <span className="text-slate-400">-</span>;
}

export function StudentReportDetail({ card, assessmentType, showPositions, onShowPositionsChange }: Props) {
  if (!card) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm">
        Select a student card to open the full report.
      </section>
    );
  }

  return (
    <StudentReportDetailContent
      card={card}
      assessmentType={assessmentType}
      showPositions={showPositions}
      onShowPositionsChange={onShowPositionsChange}
    />
  );
}

function StudentReportDetailContent({
  card,
  assessmentType,
  showPositions,
  onShowPositionsChange,
}: {
  card: StudentReportCard;
  assessmentType?: AssessmentFilter;
  showPositions?: boolean;
  onShowPositionsChange?: (showPositions: boolean) => void;
}) {
  const defaultDraft = useMemo(() => buildDefaultDraft(card), [card]);
  const [draft, setDraft] = useState<ReportDraft>(defaultDraft);
  const [isEditing, setIsEditing] = useState(false);
  const [draftState, setDraftState] = useState<"idle" | "saved" | "ready">("idle");

  useEffect(() => {
    setDraft(defaultDraft);
    setDraftState("idle");
    setIsEditing(false);
  }, [defaultDraft]);

  const effectiveType: AssessmentFilter = assessmentType ?? "TERM_SUMMARY";
  const isSingle = effectiveType === "BOT" || effectiveType === "MOT" || effectiveType === "EOT";
  const isTermSummary = !isSingle;
  const issueDate = formatDisplayDate(draft.issueDate);
  const visibleShowPositions = showPositions ?? draft.showPositions;

  const updateDraft = <K extends keyof ReportDraft>(key: K, value: ReportDraft[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
    setDraftState("idle");
  };

  function updateShowPositions(nextValue: boolean) {
    updateDraft("showPositions", nextValue);
    onShowPositionsChange?.(nextValue);
  }

  return (
    <section className="report-print-area min-w-0">
      <div className="no-print mb-4 flex flex-wrap justify-end gap-2">
        <button
          type="button"
          onClick={() => setIsEditing((open) => !open)}
          className="btn btn-secondary"
        >
          HM Edit
        </button>
        <button type="button" onClick={() => window.print()} className="btn btn-primary">
          Print / Save PDF
        </button>
      </div>

      {isEditing ? (
        <div className="no-print mb-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Head Teacher Report Edit</h3>
              <p className="mt-1 text-xs text-slate-500">
                Marks, grades, averages, and rankings are calculated from finalized marks and cannot be edited here.
              </p>
            </div>
            {draftState !== "idle" ? (
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
                {draftState === "ready" ? "Marked ready" : "Draft saved"}
              </span>
            ) : null}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-1 text-xs font-semibold text-slate-600 md:col-span-2">
              Class Teacher Comment
              <textarea
                value={draft.classTeacherComment}
                onChange={(event) => updateDraft("classTeacherComment", event.target.value)}
                className="min-h-20 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-normal text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </label>
            <label className="space-y-1 text-xs font-semibold text-slate-600 md:col-span-2">
              Head Teacher Comment
              <textarea
                value={draft.headTeacherComment}
                onChange={(event) => updateDraft("headTeacherComment", event.target.value)}
                className="min-h-20 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-normal text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </label>
            <label className="space-y-1 text-xs font-semibold text-slate-600 md:col-span-2">
              Conduct / Progression Note
              <textarea
                value={draft.conductNote}
                onChange={(event) => updateDraft("conductNote", event.target.value)}
                className="min-h-16 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-normal text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </label>
            <label className="space-y-1 text-xs font-semibold text-slate-600">
              Class Teacher Name
              <input
                value={draft.classTeacherName}
                onChange={(event) => updateDraft("classTeacherName", event.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-normal text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </label>
            <label className="space-y-1 text-xs font-semibold text-slate-600">
              Head Teacher Name
              <input
                value={draft.headTeacherName}
                onChange={(event) => updateDraft("headTeacherName", event.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-normal text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </label>
            <label className="space-y-1 text-xs font-semibold text-slate-600">
              Issue Date
              <input
                type="date"
                value={draft.issueDate}
                onChange={(event) => updateDraft("issueDate", event.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-normal text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </label>
            <div className="grid content-end gap-2 text-sm text-slate-700">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={draft.showGradingKey}
                  onChange={(event) => updateDraft("showGradingKey", event.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                Show grading key
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={visibleShowPositions}
                  onChange={(event) => updateShowPositions(event.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                Show positions
              </label>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap justify-end gap-2">
            <button type="button" className="btn btn-secondary" onClick={() => setDraft(defaultDraft)}>
              Reset Changes
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                setDraftState("saved");
              }}
            >
              Save Draft
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => setIsEditing(false)}>
              Preview Report
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                setDraftState("ready");
                setIsEditing(false);
              }}
            >
              Approve / Mark Ready
            </button>
          </div>
        </div>
      ) : null}

      <div className="no-print mb-4 rounded-2xl border border-blue-100 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-wide text-blue-600">Selected child details</p>
            <h2 className="mt-1 text-xl font-black text-slate-950">{card.studentName}</h2>
            <p className="mt-1 text-sm font-semibold text-slate-500">
              {card.admissionNumber} • {card.className} / {card.streamName}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-black text-emerald-700 ring-1 ring-emerald-200">
              Active enrollment
            </span>
            <span
              className={`rounded-full px-3 py-1 text-xs font-black ring-1 ${
                card.readiness === "READY"
                  ? "bg-blue-100 text-blue-700 ring-blue-200"
                  : "bg-amber-100 text-amber-700 ring-amber-200"
              }`}
            >
              {card.readiness.replaceAll("_", " ")}
            </span>
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {[
            ["Academic Year", card.academicYear],
            ["Term", card.term],
            ["Assessment", ASSESSMENT_LABELS[effectiveType]],
            ["Average / Grade", `${card.average ?? "-"} / ${card.grade ?? "-"}`],
          ].map(([label, value]) => (
            <div key={label} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p>
              <p className="mt-1 text-sm font-black text-slate-950">{value}</p>
            </div>
          ))}
          {visibleShowPositions ? (
            <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-3">
              <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">Overall Position</p>
              <p className="mt-1 text-sm font-black text-emerald-900">
                {card.overallPosition != null ? `#${card.overallPosition}` : "-"}
              </p>
            </div>
          ) : null}
          <div className="rounded-xl border border-slate-100 bg-slate-50 p-3 md:col-span-2 xl:col-span-3">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Parent / Guardian Contacts</p>
            <p className="mt-1 text-sm font-semibold text-slate-700">{card.contactSummary}</p>
            <span className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-xs font-black ring-1 ${CONTACT_CLASSES[card.contactReadiness]}`}>
              {CONTACT_LABELS[card.contactReadiness]}
            </span>
          </div>
        </div>
      </div>

      <div className="report-card-sheet mx-auto max-w-4xl overflow-hidden rounded-2xl bg-white shadow-[0_4px_24px_rgba(0,0,0,0.12)] ring-1 ring-slate-200">
        <div className="report-header-bg bg-[#0f2a5e] px-8 py-6 text-white print:px-5 print:py-2">
          <div className="flex items-center gap-5 print:gap-3">
            <ShieldIcon />
            <div className="flex-1 text-center">
              <h1 className="text-2xl font-bold tracking-wide print:text-base">
                Uganda High School
              </h1>
              <p className="mt-0.5 text-sm font-medium uppercase tracking-widest text-blue-200 print:text-[8px]">
                Student Academic Report
              </p>
            </div>
            <div className="w-28 flex-shrink-0 text-right text-xs leading-relaxed text-blue-200 print:text-[8px] print:leading-tight">
              <div className="font-semibold text-white">{card.academicYear}</div>
              <div>{card.term}</div>
            </div>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-2 border-t border-blue-800 pt-4 text-center text-xs text-blue-100 print:mt-2 print:pt-2 print:text-[8px]">
            <div>
              <span className="font-semibold text-white">Assessment:</span> {ASSESSMENT_LABELS[effectiveType]}
            </div>
            <div>
              <span className="font-semibold text-white">Issue Date:</span> {issueDate}
            </div>
          </div>
        </div>

        <div className="report-gold-line h-1 bg-[#c9a227]" />

        <div className="px-8 py-6 print:px-5 print:py-3">
          <div className="mb-6 rounded-xl border border-slate-200 bg-slate-50 p-4 print:mb-2 print:p-2">
            <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm md:grid-cols-3 print:gap-y-0.5 print:text-[9px]">
              <div>
                <span className="font-semibold text-slate-600">Full Name: </span>
                <span className="font-medium text-slate-900">{card.studentName}</span>
              </div>
              <div>
                <span className="font-semibold text-slate-600">Adm. No.: </span>
                <span className="font-mono font-medium text-slate-900">{card.admissionNumber}</span>
              </div>
              <div>
                <span className="font-semibold text-slate-600">Class: </span>
                <span className="text-slate-900">{card.className}</span>
              </div>
              <div>
                <span className="font-semibold text-slate-600">Stream: </span>
                <span className="text-slate-900">{card.streamName}</span>
              </div>
              <div className="md:col-span-2">
                <span className="font-semibold text-slate-600">Subjects: </span>
                <span className="text-slate-900">{card.totalSubjects}</span>
              </div>
            </div>
          </div>

          <div
            className={`report-summary-cards mb-6 grid gap-3 text-center print:mb-2 print:gap-1.5 ${
              visibleShowPositions ? "grid-cols-3" : "grid-cols-2"
            }`}
          >
            <div className="report-summary-card rounded-xl bg-blue-600 p-4 text-white print:p-2">
              <b className="block text-3xl font-bold tabular-nums print:text-lg">
                {card.average ?? "-"}
              </b>
              <span className="mt-1 block text-xs font-semibold uppercase tracking-wider text-blue-100 print:mt-0.5 print:text-[8px]">
                Average
              </span>
            </div>
            <div className="report-summary-card rounded-xl bg-[#4c1d95] p-4 text-white print:p-2">
              <b className="block text-3xl font-bold print:text-lg">{card.grade ?? "-"}</b>
              <span className="mt-1 block text-xs font-semibold uppercase tracking-wider text-purple-200 print:mt-0.5 print:text-[8px]">
                Grade
              </span>
            </div>
            {visibleShowPositions ? (
              <div className="report-summary-card rounded-xl bg-emerald-600 p-4 text-white print:p-2">
                <b className="block text-3xl font-bold tabular-nums print:text-lg">
                  {card.overallPosition != null ? `#${card.overallPosition}` : "-"}
                </b>
                <span className="mt-1 block text-xs font-semibold uppercase tracking-wider text-emerald-100 print:mt-0.5 print:text-[8px]">
                  Overall Position
                </span>
              </div>
            ) : null}
          </div>

          <div className="mb-6 overflow-x-auto rounded-xl border border-slate-200 print:mb-2 print:overflow-visible">
            {isTermSummary ? (
              <table className="report-table w-full min-w-[720px] border-collapse text-sm">
                <thead>
                  <tr className="report-table-header bg-[#0f2a5e] text-left text-xs font-semibold uppercase tracking-wide text-white">
                    <th className="p-3 text-center">No.</th>
                    <th className="p-3">Subject</th>
                    <th className="p-3 text-center">BOT</th>
                    <th className="p-3 text-center">MOT</th>
                    <th className="p-3 text-center">EOT</th>
                    <th className="p-3 text-center">Total</th>
                    <th className="p-3 text-center">Average</th>
                    <th className="p-3 text-center">Grade</th>
                  </tr>
                </thead>
                <tbody>
                  {card.subjects.map((subject, index) => (
                    <tr
                      key={subject.subjectId}
                      className={`border-b border-slate-100 ${index % 2 === 1 ? "bg-slate-50" : "bg-white"}`}
                    >
                      <td className="p-3 text-center text-xs text-slate-400">{index + 1}</td>
                      <td className="p-3 font-semibold text-slate-900">{subject.subjectName}</td>
                      <td className="p-3 text-center text-slate-700">{subject.botMarks ?? "-"}</td>
                      <td className="p-3 text-center text-slate-700">{subject.motMarks ?? "-"}</td>
                      <td className="p-3 text-center text-slate-700">{subject.eotMarks ?? "-"}</td>
                      <td className="p-3 text-center font-medium text-slate-800">{subject.total ?? "-"}</td>
                      <td className="p-3 text-center font-medium text-slate-800">{subject.average ?? "-"}</td>
                      <td className="p-3 text-center">
                        <GradeBadge grade={subject.grade} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <table className="report-table w-full min-w-[400px] border-collapse text-sm">
                <thead>
                  <tr className="report-table-header bg-[#0f2a5e] text-left text-xs font-semibold uppercase tracking-wide text-white">
                    <th className="p-3 text-center">No.</th>
                    <th className="p-3">Subject</th>
                    <th className="p-3 text-center">{effectiveType}</th>
                    <th className="p-3 text-center">Grade</th>
                  </tr>
                </thead>
                <tbody>
                  {card.subjects.map((subject, index) => {
                    const singleMark =
                      effectiveType === "BOT"
                        ? subject.botMarks
                        : effectiveType === "MOT"
                          ? subject.motMarks
                          : subject.eotMarks;

                    return (
                      <tr
                        key={subject.subjectId}
                        className={`border-b border-slate-100 ${index % 2 === 1 ? "bg-slate-50" : "bg-white"}`}
                      >
                        <td className="p-3 text-center text-xs text-slate-400">{index + 1}</td>
                        <td className="p-3 font-semibold text-slate-900">{subject.subjectName}</td>
                        <td className="p-3 text-center text-slate-700">{singleMark ?? "-"}</td>
                        <td className="p-3 text-center">
                          <GradeBadge grade={subject.grade} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {draft.showGradingKey ? (
            <div className="mb-6 rounded-xl border border-slate-200 bg-slate-50 p-4 print:mb-2 print:p-2">
              <h3 className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-400 print:mb-1 print:text-[8px]">
                Grading Key
              </h3>
              <div className="grid grid-cols-3 gap-2 text-xs sm:grid-cols-5 print:flex print:flex-wrap print:gap-1">
                {GRADE_BANDS.map((band, index) => {
                  const prevBand = index > 0 ? GRADE_BANDS[index - 1] : null;
                  const max = prevBand ? prevBand.min - 1 : 100;
                  return (
                    <div
                      key={band.grade}
                      className="flex items-center gap-2 rounded-lg bg-white px-3 py-2 shadow-sm ring-1 ring-slate-100 print:gap-1 print:px-2 print:py-0.5 print:shadow-none print:ring-0"
                    >
                      <GradeBadge grade={band.grade} />
                      <span className="text-slate-600">
                        {band.min}-{max}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}

          <div className="report-comments mb-6 print:mb-2">
            <h3 className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-400 print:mb-1 print:text-[8px]">
              Comments &amp; Signatures
            </h3>
            <div className="grid gap-4 sm:grid-cols-3 print:gap-2">
              <div className="rounded-xl border border-slate-200 p-4 print:p-2">
                <p className="mb-2 text-xs font-bold text-slate-600 print:mb-1 print:text-[8px]">
                  Class Teacher's Comment
                </p>
                <div className="mb-4 min-h-[56px] rounded-lg border border-dashed border-slate-200 bg-slate-50 p-2 text-xs italic text-slate-500 print:mb-1.5 print:min-h-0 print:p-1">
                  {draft.classTeacherComment ? draft.classTeacherComment : <EmptyComment />}
                </div>
                <SignatureLines name={draft.classTeacherName} date={issueDate} />
              </div>
              <div className="rounded-xl border border-slate-200 p-4 print:p-2">
                <p className="mb-2 text-xs font-bold text-slate-600 print:mb-1 print:text-[8px]">
                  Head Teacher's Comment
                </p>
                <div className="mb-4 min-h-[56px] rounded-lg border border-dashed border-slate-200 bg-slate-50 p-2 text-xs italic text-slate-500 print:mb-1.5 print:min-h-0 print:p-1">
                  {draft.headTeacherComment ? draft.headTeacherComment : <EmptyComment />}
                </div>
                <SignatureLines name={draft.headTeacherName} date={issueDate} />
              </div>
              <div className="rounded-xl border border-slate-200 p-4 print:p-2">
                <p className="mb-2 text-xs font-bold text-slate-600 print:mb-1 print:text-[8px]">
                  Conduct / Progression
                </p>
                <div className="mb-4 min-h-[56px] rounded-lg border border-dashed border-slate-200 bg-slate-50 p-2 text-xs italic text-slate-500 print:mb-1.5 print:min-h-0 print:p-1">
                  {draft.conductNote ? draft.conductNote : <EmptyComment />}
                </div>
                <SignatureLines name="" date={issueDate} />
              </div>
            </div>
          </div>

          <div className="report-footer border-t border-slate-200 pt-4 text-center text-xs text-slate-400 print:pt-2">
            <p className="font-medium text-slate-500">
              This report was generated by School Connect Reports First.
            </p>
            <p className="mt-1 print:mt-0">
              Generated: {issueDate}&nbsp;&nbsp;|&nbsp;&nbsp;Verification: SC-REPORT-PREVIEW
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function SignatureLines({ name, date }: { name: string; date: string }) {
  return (
    <div className="space-y-3 text-xs text-slate-500 print:space-y-1">
      <div className="flex items-end gap-2">
        <span className="w-10 flex-shrink-0 print:text-[8px]">Name:</span>
        <div className="min-h-5 flex-1 border-b border-slate-300 text-slate-700">{name}</div>
      </div>
      <div className="flex items-end gap-2">
        <span className="w-10 flex-shrink-0 print:text-[8px]">Sign:</span>
        <div className="flex-1 border-b border-slate-300" />
      </div>
      <div className="flex items-end gap-2">
        <span className="w-10 flex-shrink-0 print:text-[8px]">Date:</span>
        <div className="min-h-5 flex-1 border-b border-slate-300 text-slate-700">{date}</div>
      </div>
    </div>
  );
}
