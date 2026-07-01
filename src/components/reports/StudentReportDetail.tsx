import { useEffect, useMemo, useState } from "react";
import type { AssessmentFilter, StudentReportCard } from "../../shared/types/reports";
import type { GradingScaleSettings, ReportPersonalizationSettings, ReportSettings, SchoolProfileSettings } from "../../shared/types/settings";
import { defaultSettingsSections } from "../../shared/types/settings";
import { PassportPhotoAvatar } from "../students/PassportPhotoAvatar";
import { getReportBranding } from "../layout/branding";
import type { ReportComments } from "../../shared/utils/reportComments";
import { sanitizeReportCardForRender, sanitizeReportComments, sanitizeReportPersonalizationForReport, sanitizeSchoolSettingsForReport } from "../../shared/utils/reportContentLimits";
import { generateRemarks } from "../../shared/utils/remarksEngine";
import { formatUgandaSchoolYearLabel } from "../../shared/utils/ugandaYear";

type Props = {
  card: StudentReportCard | null;
  assessmentType?: AssessmentFilter;
  showPositions?: boolean;
  schoolSettings?: SchoolProfileSettings;
  reportSettings?: ReportSettings;
  personalization?: ReportPersonalizationSettings;
  grading?: GradingScaleSettings;
  classAverage?: number | null;
  editOpen?: boolean;
  onEditOpenChange?: (open: boolean) => void;
  initialComments?: ReportComments;
};

type ReportDraft = {
  classTeacherComment: string;
  headTeacherComment: string;
  conductNote: string;
  classTeacherName: string;
  headTeacherName: string;
  issueDate: string;
  showGradingKey: boolean;
};

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

function buildDefaultDraft(
  card: StudentReportCard,
  school: SchoolProfileSettings,
  reports: ReportSettings,
): ReportDraft {
  const ctTemplate = card.comments || reports.defaultClassTeacherCommentTemplate;
  const htTemplate = reports.defaultHmCommentTemplate;
  const autoRemarks = !ctTemplate && !htTemplate ? generateRemarks(card.average) : null;
  return {
    classTeacherComment: ctTemplate || autoRemarks?.classTeacherComment || "",
    headTeacherComment: htTemplate || autoRemarks?.headTeacherComment || "",
    conductNote: "",
    classTeacherName: "",
    headTeacherName: school.headTeacherName || "Head Teacher",
    issueDate: new Date().toISOString().slice(0, 10),
    showGradingKey: reports.showGradeKey,
  };
}

function formatDisplayDate(value: string) {
  const date = value ? new Date(`${value}T00:00:00`) : new Date();
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function reportLayoutMode(card: StudentReportCard, type: AssessmentFilter) {
  const commentLoad = `${card.comments ?? ""} ${card.progressionText ?? ""}`.length;
  const denseThreshold = type === "TERM_SUMMARY" ? 14 : 18;
  if (card.subjects.length > denseThreshold || commentLoad > 220) return "compact";
  return "standard";
}

export function StudentReportDetail({
  card,
  assessmentType,
  showPositions,
  schoolSettings,
  reportSettings,
  personalization,
  grading,
  classAverage,
  editOpen,
  onEditOpenChange,
  initialComments,
}: Props) {
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
      schoolSettings={schoolSettings}
      reportSettings={reportSettings}
      personalization={personalization}
      grading={grading}
      classAverage={classAverage}
      editOpen={editOpen}
      onEditOpenChange={onEditOpenChange}
      initialComments={initialComments}
    />
  );
}

function StudentReportDetailContent({
  card,
  assessmentType,
  showPositions,
  schoolSettings,
  reportSettings,
  personalization,
  grading,
  classAverage,
  editOpen,
  onEditOpenChange,
  initialComments,
}: {
  card: StudentReportCard;
  assessmentType?: AssessmentFilter;
  showPositions?: boolean;
  schoolSettings?: SchoolProfileSettings;
  reportSettings?: ReportSettings;
  personalization?: ReportPersonalizationSettings;
  grading?: GradingScaleSettings;
  classAverage?: number | null;
  editOpen?: boolean;
  onEditOpenChange?: (open: boolean) => void;
  initialComments?: ReportComments;
  }) {
  const sanitizedCard = sanitizeReportCardForRender(card);
  const school = sanitizeSchoolSettingsForReport(schoolSettings ?? defaultSettingsSections.school);
  const reports = reportSettings ?? defaultSettingsSections.reports;
  const personalizationSettings = sanitizeReportPersonalizationForReport(personalization ?? defaultSettingsSections.reportPersonalization);
  const scale = grading ?? defaultSettingsSections.grading;
  const branding = getReportBranding(school, personalizationSettings);
  const defaultDraft = useMemo(() => {
    if (initialComments) {
      const safeComments = sanitizeReportComments(initialComments);
      return {
        classTeacherComment: safeComments.classTeacherComment,
        headTeacherComment: safeComments.headTeacherComment,
        conductNote: safeComments.conductNote,
        classTeacherName: safeComments.classTeacherName,
        headTeacherName: safeComments.headTeacherName || school.headTeacherName || "Head Teacher",
        issueDate: safeComments.issueDate || new Date().toISOString().slice(0, 10),
        showGradingKey: personalizationSettings.layout.showGradingScale ?? reports.showGradeKey,
      };
    }
    return sanitizeReportComments(buildDefaultDraft(sanitizedCard, school, reports));
  }, [sanitizedCard, school, reports, personalizationSettings, initialComments]);
  const [draft, setDraft] = useState<ReportDraft>(defaultDraft);
  const [isEditing, setIsEditing] = useState(false);
  const [draftState, setDraftState] = useState<"idle" | "saved" | "ready">("idle");
  const editing = editOpen ?? isEditing;
  const setEditingOpen = onEditOpenChange ?? setIsEditing;

  useEffect(() => {
    setDraft(defaultDraft);
    setDraftState("idle");
    setEditingOpen(false);
  }, [defaultDraft]);

  const effectiveType: AssessmentFilter = assessmentType ?? "TERM_SUMMARY";
  const isSingle = effectiveType === "BOT" || effectiveType === "MOT" || effectiveType === "EOT";
  const isTermSummary = !isSingle;
  const issueDate = formatDisplayDate(draft.issueDate);
  const visibleShowPositions = Boolean(showPositions || personalizationSettings.layout.showPosition);
  const visibleStreamPosition = Boolean(personalizationSettings.layout.showStreamPosition);
  const visibleClassAverage = Boolean(personalizationSettings.layout.showClassAverage && reports.showClassAverage);
  const visibleGradingScale = Boolean(draft.showGradingKey && personalizationSettings.layout.showGradingScale);
  const showStudentPhoto = Boolean(personalizationSettings.layout.showStudentPhoto);
  const showParentCommentBox = Boolean(personalizationSettings.layout.showParentCommentBox);
  const showAttendance = Boolean(personalizationSettings.layout.showAttendance);
  const showFeesBalance = Boolean(personalizationSettings.layout.showFeesBalance);
  const layoutMode = reportLayoutMode(sanitizedCard, effectiveType);

  const updateDraft = <K extends keyof ReportDraft>(key: K, value: ReportDraft[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
    setDraftState("idle");
  };

  // Conduct / Progression — conductNote takes priority; fall back to promotion record
  const conductContent = draft.conductNote || sanitizedCard.progressionText || "";
  const showConductCard = Boolean(conductContent);

  return (
    <section
      className={`report-print-area report-print-page min-w-0 report-density-${reports.printDensity} report-layout-${layoutMode}`}
      data-report-page-target="a4-single"
      data-report-layout={layoutMode}
      data-report-assessment={effectiveType}
    >
      {editing ? (
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
              {sanitizedCard.progressionText && !draft.conductNote ? (
                <span className="mt-1 block text-xs text-slate-400">
                  Auto-filled from promotion record: &ldquo;{sanitizedCard.progressionText}&rdquo;
                </span>
              ) : null}
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
              <span className="text-xs font-semibold text-slate-500">Grade key and positions are controlled in Settings.</span>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="btn btn-secondary text-xs"
                title="Fill remarks from score band only when both comment fields are empty"
                onClick={() => {
                  const remarks = generateRemarks(sanitizedCard.average);
                  if (!remarks) return;
                  setDraft((current) => ({
                    ...current,
                    classTeacherComment: current.classTeacherComment || remarks.classTeacherComment,
                    headTeacherComment: current.headTeacherComment || remarks.headTeacherComment,
                  }));
                  setDraftState("idle");
                }}
              >
                Auto-generate remarks
              </button>
              <button
                type="button"
                className="btn btn-secondary text-xs"
                title="Replace current comments with auto-generated remarks based on the student's score band"
                onClick={() => {
                  const remarks = generateRemarks(sanitizedCard.average);
                  if (!remarks) return;
                  setDraft((current) => ({
                    ...current,
                    classTeacherComment: remarks.classTeacherComment,
                    headTeacherComment: remarks.headTeacherComment,
                  }));
                  setDraftState("idle");
                }}
              >
                Regenerate remarks
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
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
              <button type="button" className="btn btn-secondary" onClick={() => setEditingOpen(false)}>
                Preview Report
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  setDraftState("ready");
                  setEditingOpen(false);
                }}
              >
                Approve / Mark Ready
              </button>
            </div>
          </div>
        </div>
      ) : null}


      <div className="report-card-sheet mx-auto max-w-4xl overflow-hidden rounded-[1.35rem] bg-white shadow-[0_18px_45px_rgba(15,42,94,0.16)] ring-1 ring-slate-200">
        <div
          className="report-header-bg px-8 py-5 text-white print:px-4 print:py-2"
          style={{ background: branding.primaryColor }}
        >
          <div className="flex items-center gap-5 print:gap-2">
            {reports.showSchoolLogo ? (
              branding.logoUrl ? (
                <img src={branding.logoUrl} alt={`${branding.schoolName} logo`} className="h-14 w-14 flex-shrink-0 rounded-2xl object-contain ring-1 ring-white/25 print:h-8 print:w-8" />
              ) : (
                <div className="grid h-14 w-14 flex-shrink-0 place-items-center rounded-2xl bg-white/10 text-xl font-black text-white ring-1 ring-white/20 print:h-8 print:w-8 print:text-sm">{branding.initials}</div>
              )
            ) : (
              <div className="h-14 w-14 flex-shrink-0 print:h-8 print:w-8" />
            )}
            <div className="flex-1 text-center">
              <h1 className="text-3xl font-black uppercase tracking-[0.16em] print:text-sm print:tracking-[0.12em]">
                {branding.reportTitleOverride || branding.schoolName}
              </h1>
              {branding.motto ? <p className="mt-0.5 text-xs font-semibold text-blue-100 print:text-[7px]">{branding.motto}</p> : null}
              {branding.address || branding.phone || branding.email || branding.website ? (
                <p className="mt-0.5 text-xs font-medium text-blue-100 print:text-[7px]">
                  {[branding.address, branding.phone, branding.email, branding.website].filter(Boolean).join(" | ")}
                </p>
              ) : null}
              <p className="mt-1 text-xs font-bold uppercase tracking-[0.24em] text-blue-100 print:mt-0.5 print:text-[7px]">
                Student Academic Report
              </p>
            </div>
            <div className="w-28 flex-shrink-0 rounded-xl bg-white/10 px-3 py-2 text-right text-xs leading-relaxed text-blue-100 ring-1 ring-white/10 print:w-20 print:px-1.5 print:py-1 print:text-[7px] print:leading-tight">
              <div className="text-[10px] font-bold uppercase tracking-wider text-blue-200 print:text-[6px]">Academic Year</div>
              <div className="font-bold text-white">{formatUgandaSchoolYearLabel(sanitizedCard.academicYear)}</div>
              <div className="text-blue-100">{sanitizedCard.term}</div>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2 border-t border-white/15 pt-3 text-center text-xs text-blue-100 print:mt-1 print:pt-1 print:text-[7px]">
            <div>
              <span className="font-semibold text-white">Assessment:</span> {ASSESSMENT_LABELS[effectiveType]}
            </div>
            <div>
              <span className="font-semibold text-white">Date:</span> {issueDate}
            </div>
          </div>
        </div>

        <div className="report-gold-line h-1" style={{ background: branding.secondaryColor }} />

        <div className="px-8 py-5 print:px-4 print:py-2">
          <div className="report-student-profile mb-4 rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-4 shadow-sm print:mb-1 print:p-2 print:shadow-none">
            <div className={`grid items-center gap-4 ${showStudentPhoto ? "lg:grid-cols-[minmax(0,1fr)_8rem]" : ""}`}>
              <div>
                <p className="mb-3 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 print:mb-1 print:text-[6px]">Student Profile</p>
                <div className="grid grid-cols-2 gap-x-5 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-4 print:grid-cols-4 print:gap-y-0.5 print:text-[8px]">
                <div className="min-w-0">
                  <span className="block text-[10px] font-bold uppercase tracking-wide text-slate-500 print:text-[6px]">Full Name</span>
                  <span className="block truncate font-bold text-slate-950">{sanitizedCard.studentName}</span>
                </div>
                <div className="min-w-0">
                  <span className="block text-[10px] font-bold uppercase tracking-wide text-slate-500 print:text-[6px]">Admission No.</span>
                  <span className="block truncate font-mono font-semibold text-slate-950">{sanitizedCard.admissionNumber}</span>
                </div>
                <div className="min-w-0">
                  <span className="block text-[10px] font-bold uppercase tracking-wide text-slate-500 print:text-[6px]">Class</span>
                  <span className="block truncate font-semibold text-slate-950">{sanitizedCard.className}</span>
                </div>
                <div className="min-w-0">
                  <span className="block text-[10px] font-bold uppercase tracking-wide text-slate-500 print:text-[6px]">Stream</span>
                  <span className="block truncate font-semibold text-slate-950">{sanitizedCard.streamName}</span>
                </div>
                </div>
              </div>
              {showStudentPhoto ? (
                <div className="report-passport-frame justify-self-center rounded-2xl border border-slate-300 bg-white p-2 text-center shadow-sm print:p-1 print:shadow-none">
                  <div className="overflow-hidden rounded-xl">
                    <PassportPhotoAvatar
                      name={sanitizedCard.studentName}
                      src={sanitizedCard.passportPhotoUrl}
                      alt={`${sanitizedCard.studentName} passport`}
                      className="h-24 w-24 rounded-xl print:h-16 print:w-16"
                    />
                  </div>
                  <div className="mt-1 text-[9px] font-bold uppercase tracking-wider text-slate-400 print:hidden">Passport Photo</div>
                </div>
              ) : null}
            </div>
          </div>

          <div
            className={`report-summary-cards mb-4 grid gap-2 text-center print:mb-1 print:gap-1 ${
              [visibleShowPositions, visibleStreamPosition, visibleClassAverage].filter(Boolean).length >= 2
                ? "grid-cols-4"
                : [visibleShowPositions, visibleStreamPosition, visibleClassAverage].filter(Boolean).length === 1
                  ? "grid-cols-3"
                  : "grid-cols-2"
            }`}
          >
            <div className="report-summary-card rounded-xl bg-blue-600 px-4 py-3 text-white shadow-sm print:p-1.5 print:shadow-none">
              <b className="block text-2xl font-black tabular-nums leading-none print:text-sm">
                {sanitizedCard.average ?? "-"}
              </b>
              <span className="mt-1 block text-[10px] font-bold uppercase tracking-[0.16em] text-blue-100 print:mt-0.5 print:text-[7px]">
                Average
              </span>
            </div>
            <div className="report-summary-card rounded-xl bg-[#4c1d95] px-4 py-3 text-white shadow-sm print:p-1.5 print:shadow-none">
              <b className="block text-2xl font-black leading-none print:text-sm">{sanitizedCard.grade ?? "-"}</b>
              <span className="mt-1 block text-[10px] font-bold uppercase tracking-[0.16em] text-purple-200 print:mt-0.5 print:text-[7px]">
                Grade
              </span>
            </div>
            {visibleShowPositions ? (
              <div className="report-summary-card rounded-xl bg-emerald-600 px-4 py-3 text-white shadow-sm print:p-1.5 print:shadow-none">
                <b className="block text-2xl font-black tabular-nums leading-none print:text-sm">
                  {sanitizedCard.overallPosition != null ? `#${sanitizedCard.overallPosition}` : "-"}
                </b>
                <span className="mt-1 block text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-100 print:mt-0.5 print:text-[7px]">
                  Overall Position
                </span>
              </div>
            ) : null}
            {visibleStreamPosition ? (
              <div className="report-summary-card rounded-xl bg-cyan-700 px-4 py-3 text-white shadow-sm print:p-1.5 print:shadow-none">
                <b className="block text-2xl font-black tabular-nums leading-none print:text-sm">
                  {sanitizedCard.overallPosition != null ? `#${sanitizedCard.overallPosition}` : "-"}
                </b>
                <span className="mt-1 block text-[10px] font-bold uppercase tracking-[0.16em] text-cyan-100 print:mt-0.5 print:text-[7px]">
                  Stream Position
                </span>
              </div>
            ) : null}
            {visibleClassAverage ? (
              <div className="report-summary-card rounded-xl bg-slate-700 px-4 py-3 text-white shadow-sm print:p-1.5 print:shadow-none">
                <b className="block text-2xl font-black tabular-nums leading-none print:text-sm">
                  {classAverage ?? "-"}
                </b>
                <span className="mt-1 block text-[10px] font-bold uppercase tracking-[0.16em] text-slate-200 print:mt-0.5 print:text-[7px]">
                  Class Average
                </span>
              </div>
            ) : null}
          </div>

          <div className="mb-4 overflow-x-auto rounded-xl border border-slate-200 shadow-sm print:mb-1 print:overflow-visible print:shadow-none">
            {isTermSummary ? (
              <table className={`report-table w-full min-w-[720px] border-collapse text-[13px] print:text-[8px] ${layoutMode === "compact" ? "report-table-compact" : ""}`}>
                <thead>
                  <tr className="report-table-header bg-[#0f2a5e] text-left text-[10px] font-black uppercase tracking-[0.14em] text-white print:text-[7px]">
                    <th className="px-3 py-2 text-center">No.</th>
                    <th className="px-3 py-2">Subject</th>
                    <th className="px-3 py-2 text-center">BOT</th>
                    <th className="px-3 py-2 text-center">MOT</th>
                    <th className="px-3 py-2 text-center">EOT</th>
                    <th className="px-3 py-2 text-center">Total</th>
                    <th className="px-3 py-2 text-center">Average</th>
                    <th className="px-3 py-2 text-center">Grade</th>
                  </tr>
                </thead>
                <tbody>
                  {sanitizedCard.subjects.map((subject, index) => (
                    <tr
                      key={subject.subjectId}
                      className={`border-b border-slate-100 ${index % 2 === 1 ? "bg-slate-50/80" : "bg-white"}`}
                    >
                      <td className="px-3 py-2 text-center text-xs font-medium text-slate-400">{index + 1}</td>
                      <td className="px-3 py-2 font-semibold text-slate-900">{subject.subjectName}</td>
                      <td className="px-3 py-2 text-center text-slate-700">{subject.botMarks ?? "-"}</td>
                      <td className="px-3 py-2 text-center text-slate-700">{subject.motMarks ?? "-"}</td>
                      <td className="px-3 py-2 text-center text-slate-700">{subject.eotMarks ?? "-"}</td>
                      <td className="px-3 py-2 text-center font-semibold text-slate-800">{subject.total ?? "-"}</td>
                      <td className="px-3 py-2 text-center font-semibold text-slate-800">{subject.average ?? "-"}</td>
                      <td className="px-3 py-2 text-center">
                        <GradeBadge grade={subject.grade} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <table className={`report-table w-full min-w-[400px] border-collapse text-[13px] print:text-[8px] ${layoutMode === "compact" ? "report-table-compact" : ""}`}>
                <thead>
                  <tr className="report-table-header bg-[#0f2a5e] text-left text-[10px] font-black uppercase tracking-[0.14em] text-white print:text-[7px]">
                    <th className="px-3 py-2 text-center">No.</th>
                    <th className="px-3 py-2">Subject</th>
                    <th className="px-3 py-2 text-center">{effectiveType}</th>
                    <th className="px-3 py-2 text-center">Grade</th>
                  </tr>
                </thead>
                <tbody>
                  {sanitizedCard.subjects.map((subject, index) => {
                    const singleMark =
                      effectiveType === "BOT"
                        ? subject.botMarks
                        : effectiveType === "MOT"
                          ? subject.motMarks
                          : subject.eotMarks;

                    return (
                      <tr
                        key={subject.subjectId}
                        className={`border-b border-slate-100 ${index % 2 === 1 ? "bg-slate-50/80" : "bg-white"}`}
                      >
                        <td className="px-3 py-2 text-center text-xs font-medium text-slate-400">{index + 1}</td>
                        <td className="px-3 py-2 font-semibold text-slate-900">{subject.subjectName}</td>
                        <td className="px-3 py-2 text-center text-slate-700">{singleMark ?? "-"}</td>
                        <td className="px-3 py-2 text-center">
                          <GradeBadge grade={subject.grade} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {visibleGradingScale ? (
            <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-3 print:mb-1 print:p-2">
              <h3 className="mb-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 print:mb-1 print:text-[7px]">
                Grading Key
              </h3>
              <div className="grid grid-cols-3 gap-1.5 text-[11px] sm:grid-cols-5 print:flex print:flex-wrap print:gap-1">
                {scale.grades.map((band) => {
                  return (
                    <div
                      key={band.label}
                      className="flex items-center gap-1.5 rounded-md bg-white px-2 py-1.5 ring-1 ring-slate-100 print:gap-1 print:px-1.5 print:py-0.5 print:ring-0"
                    >
                      <GradeBadge grade={band.label} />
                      <span className="font-medium text-slate-600">
                        {band.minScore}-{band.maxScore}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}

          <div className="report-comments mb-5 print:mb-1">
            <h3 className="mb-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 print:mb-1 print:text-[7px]">
              Comments
            </h3>
            <div className={`grid gap-3 print:gap-1 ${showConductCard ? "sm:grid-cols-3 print:grid-cols-3" : "sm:grid-cols-2 print:grid-cols-2"}`}>
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm print:p-1.5 print:shadow-none">
                <p className="mb-2 text-xs font-black uppercase tracking-wide text-slate-700 print:mb-1 print:text-[7px]">
                  Class Teacher&apos;s Comment
                </p>
                <div className="mb-3 min-h-[54px] whitespace-pre-line break-words border-b border-slate-200 pb-2 text-xs leading-5 text-slate-600 print:mb-1 print:min-h-0 print:p-1">
                  {draft.classTeacherComment || <span className="text-slate-300">—</span>}
                </div>
                {draft.classTeacherName ? (
                  <p className="text-xs text-slate-500 print:text-[7px]">
                    <span className="font-semibold">Name:</span> {draft.classTeacherName}
                  </p>
                ) : null}
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm print:p-1.5 print:shadow-none">
                <p className="mb-2 text-xs font-black uppercase tracking-wide text-slate-700 print:mb-1 print:text-[7px]">
                  Head Teacher&apos;s Comment
                </p>
                <div className="mb-3 min-h-[54px] whitespace-pre-line break-words border-b border-slate-200 pb-2 text-xs leading-5 text-slate-600 print:mb-1 print:min-h-0 print:p-1">
                  {draft.headTeacherComment || <span className="text-slate-300">—</span>}
                </div>
                {draft.headTeacherName ? (
                  <p className="text-xs text-slate-500 print:text-[7px]">
                    <span className="font-semibold">Name:</span> {draft.headTeacherName}
                  </p>
                ) : null}
              </div>
              {showConductCard ? (
                <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm print:p-1.5 print:shadow-none">
                  <p className="mb-2 text-xs font-black uppercase tracking-wide text-slate-700 print:mb-1 print:text-[7px]">
                    Conduct / Progression
                  </p>
                  <div className="min-h-[54px] whitespace-pre-line break-words border-b border-slate-200 pb-2 text-xs leading-5 text-slate-600 print:min-h-0 print:p-1">
                    {conductContent}
                  </div>
                </div>
              ) : null}
            </div>
            {showParentCommentBox || showAttendance || showFeesBalance ? (
              <div className="mt-3 grid gap-3 sm:grid-cols-3 print:mt-1 print:gap-1">
                {showParentCommentBox ? (
                  <div className="rounded-xl border border-slate-200 bg-white p-4 print:p-1.5">
                    <p className="mb-2 text-xs font-black uppercase tracking-wide text-slate-700 print:mb-1 print:text-[7px]">Parent Comment</p>
                    <div className="min-h-[40px] border-b border-slate-200 pb-2 text-xs text-slate-400 print:min-h-0 print:p-1">
                      For parent feedback and acknowledgement.
                    </div>
                  </div>
                ) : null}
                {showAttendance ? (
                  <div className="rounded-xl border border-slate-200 bg-white p-4 print:p-1.5">
                    <p className="mb-2 text-xs font-black uppercase tracking-wide text-slate-700 print:mb-1 print:text-[7px]">Attendance</p>
                    <div className="text-xs text-slate-500 print:text-[7px]">Attendance summary not recorded.</div>
                  </div>
                ) : null}
                {showFeesBalance ? (
                  <div className="rounded-xl border border-slate-200 bg-white p-4 print:p-1.5">
                    <p className="mb-2 text-xs font-black uppercase tracking-wide text-slate-700 print:mb-1 print:text-[7px]">Fees Balance</p>
                    <div className="text-xs text-slate-500 print:text-[7px]">Fees balance is not available in this report.</div>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="report-signature-panel mb-4 grid gap-4 border-t border-slate-200 pt-4 text-xs text-slate-600 sm:grid-cols-3 print:mb-1 print:gap-2 print:pt-2 print:text-[7px]">
            <div>
              <div className="mb-2 h-8 border-b border-slate-300 print:h-5" />
              <p className="font-bold uppercase tracking-wide text-slate-500">Class Teacher</p>
              <p className="text-slate-400">{draft.classTeacherName || "Name / Signature"}</p>
            </div>
            <div>
              <div className="mb-2 h-8 border-b border-slate-300 print:h-5" />
              <p className="font-bold uppercase tracking-wide text-slate-500">Head Teacher</p>
              <p className="text-slate-400">{draft.headTeacherName || branding.headteacherName || "Name / Signature"}</p>
            </div>
            <div>
              <div className="mb-2 h-8 border-b border-slate-300 print:h-5" />
              <p className="font-bold uppercase tracking-wide text-slate-500">Date Issued</p>
              <p className="text-slate-400">{issueDate}</p>
            </div>
          </div>

          <div className="report-footer border-t border-slate-200 pt-3 text-center text-[11px] text-slate-400 print:pt-1 print:text-[7px]">
            <p className="font-semibold text-slate-500">
              {branding.reportFooterText || school.reportFooterText}
            </p>
            {branding.stampUrl || branding.headteacherSignatureUrl ? (
              <div className="mt-3 flex items-end justify-between gap-4 text-left print:mt-1">
                <div className="min-h-12 flex-1 rounded-xl border border-dashed border-slate-200 bg-white p-3 text-xs text-slate-500">
                  {branding.headteacherName}
                  <div className="mt-1 text-[10px] text-slate-400">Head Teacher</div>
                </div>
                {branding.headteacherSignatureUrl ? (
                  <img src={branding.headteacherSignatureUrl} alt="Head teacher signature" className="h-12 w-auto object-contain print:h-8" />
                ) : null}
                {branding.stampUrl ? (
                  <img src={branding.stampUrl} alt="School stamp" className="h-12 w-12 object-contain print:h-8 print:w-8" />
                ) : null}
              </div>
            ) : null}
            <p className="mt-1 font-medium print:mt-0">
              Verification Code: SC-REPORT-PREVIEW
            </p>
            <p className="mt-0.5 text-slate-300 print:mt-0">
              Generated securely by School Connect
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
