import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { fetchSettings, patchSettingsSection } from "../client/settingsClient";
import {
  defaultSettingsSections,
  type SettingSection,
  type SettingsResponse,
  type SettingsSections,
} from "../shared/types/settings";

type Tab = { id: SettingSection; label: string };

const tabs: Tab[] = [
  { id: "school", label: "School Profile" },
  { id: "academic", label: "Academic Setup" },
  { id: "reports", label: "Reports" },
  { id: "marksheets", label: "Marksheets" },
  { id: "ocr", label: "OCR & Scan Import" },
  { id: "grading", label: "Grading Scale" },
  { id: "approval", label: "Approval & Safety" },
  { id: "appearance", label: "Appearance" },
];

const fieldClass =
  "premium-control w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-400";
const labelClass = "grid gap-1 text-xs font-bold uppercase text-slate-500";

function setField<T, K extends keyof T>(value: T, key: K, next: T[K]): T {
  return { ...value, [key]: next };
}

function SectionFrame({
  title,
  children,
  onSave,
  onReset,
  saving,
  saved,
  error,
}: {
  title: string;
  children: ReactNode;
  onSave: () => void;
  onReset: () => void;
  saving: boolean;
  saved: boolean;
  error: string;
}) {
  return (
    <section className="premium-card rounded-xl p-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-black text-slate-950">{title}</h2>
        <div className="flex flex-wrap items-center gap-2">
          {saved ? <span className="text-xs font-bold text-emerald-700">Saved</span> : null}
          <button type="button" className="btn btn-secondary" onClick={onReset} disabled={saving}>
            Reset to Defaults
          </button>
          <button type="button" className="btn btn-primary" onClick={onSave} disabled={saving}>
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
      {error ? <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}
      {children}
    </section>
  );
}

function BoolSelect({ value, onChange, disabled = false }: { value: boolean; onChange: (value: boolean) => void; disabled?: boolean }) {
  return (
    <select className={fieldClass} value={value ? "yes" : "no"} disabled={disabled} onChange={(e) => onChange(e.target.value === "yes")}>
      <option value="yes">Yes</option>
      <option value="no">No</option>
    </select>
  );
}

export function SettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingSection>("school");
  const [settings, setSettings] = useState<SettingsResponse | null>(null);
  const [draft, setDraft] = useState<SettingsSections>(defaultSettingsSections);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<SettingSection | null>(null);
  const [saved, setSaved] = useState<SettingSection | null>(null);
  const [errors, setErrors] = useState<Partial<Record<SettingSection, string>>>({});

  useEffect(() => {
    fetchSettings()
      .then((loaded) => {
        setSettings(loaded);
        setDraft(loaded.sections);
      })
      .catch((error: Error) => setErrors({ school: error.message }))
      .finally(() => setLoading(false));
  }, []);

  function updateSection<K extends SettingSection>(section: K, value: SettingsSections[K]) {
    setDraft((current) => ({ ...current, [section]: value }));
    setSaved(null);
    setErrors((current) => ({ ...current, [section]: "" }));
  }

  async function saveSection(section: SettingSection) {
    setSaving(section);
    setSaved(null);
    setErrors((current) => ({ ...current, [section]: "" }));
    try {
      const loaded = await patchSettingsSection(section, draft[section]);
      setSettings(loaded);
      setDraft(loaded.sections);
      setSaved(section);
    } catch (error) {
      setErrors((current) => ({ ...current, [section]: error instanceof Error ? error.message : "Save failed" }));
    } finally {
      setSaving(null);
    }
  }

  function resetSection(section: SettingSection) {
    const defaults = { ...defaultSettingsSections[section] };
    if (section === "school" && settings) {
      updateSection("school", {
        ...defaultSettingsSections.school,
        schoolName: settings.sections.school.schoolName,
        schoolCode: settings.sections.school.schoolCode,
      });
      return;
    }
    updateSection(section, defaults as SettingsSections[typeof section]);
  }

  const activeLabel = useMemo(() => tabs.find((tab) => tab.id === activeTab)?.label ?? "Settings", [activeTab]);

  if (loading) {
    return <main className="grid gap-4"><div className="premium-card rounded-xl p-5 text-sm text-slate-600">Loading settings...</div></main>;
  }

  return (
    <main className="grid gap-4">
      <header className="page-header">
        <p className="text-xs font-bold uppercase tracking-wide text-blue-600">Settings</p>
        <h1 className="text-2xl font-bold tracking-tight text-slate-950">School Connect Reports Lab</h1>
        <p className="mt-1 text-sm text-slate-600">Saved settings apply to reports, marksheets, scan import, grading, and approval controls.</p>
      </header>

      <div className="tab-tray no-print flex max-w-full flex-wrap">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`tab-button ${activeTab === tab.id ? "tab-button-active" : ""}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <SectionFrame
        title={activeLabel}
        onSave={() => saveSection(activeTab)}
        onReset={() => resetSection(activeTab)}
        saving={saving === activeTab}
        saved={saved === activeTab}
        error={errors[activeTab] ?? ""}
      >
        {activeTab === "school" && <SchoolSection value={draft.school} onChange={(value) => updateSection("school", value)} />}
        {activeTab === "academic" && <AcademicSection value={draft.academic} onChange={(value) => updateSection("academic", value)} />}
        {activeTab === "reports" && <ReportsSection value={draft.reports} onChange={(value) => updateSection("reports", value)} />}
        {activeTab === "marksheets" && <MarksheetsSection value={draft.marksheets} onChange={(value) => updateSection("marksheets", value)} />}
        {activeTab === "ocr" && <OcrSection value={draft.ocr} onChange={(value) => updateSection("ocr", value)} />}
        {activeTab === "grading" && <GradingSection value={draft.grading} onChange={(value) => updateSection("grading", value)} />}
        {activeTab === "approval" && <ApprovalSection value={draft.approval} onChange={(value) => updateSection("approval", value)} />}
        {activeTab === "appearance" && <AppearanceSection value={draft.appearance} onChange={(value) => updateSection("appearance", value)} />}
      </SectionFrame>
    </main>
  );
}

function SchoolSection({ value, onChange }: { value: SettingsSections["school"]; onChange: (value: SettingsSections["school"]) => void }) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <label className={labelClass}>School name<input className={fieldClass} value={value.schoolName} onChange={(e) => onChange(setField(value, "schoolName", e.target.value))} /></label>
      <label className={labelClass}>School code<input className={fieldClass} value={value.schoolCode} onChange={(e) => onChange(setField(value, "schoolCode", e.target.value))} /></label>
      <label className={`${labelClass} md:col-span-2`}>Address<input className={fieldClass} value={value.address} onChange={(e) => onChange(setField(value, "address", e.target.value))} /></label>
      <label className={labelClass}>Phone<input className={fieldClass} value={value.phone} onChange={(e) => onChange(setField(value, "phone", e.target.value))} /></label>
      <label className={labelClass}>Email<input className={fieldClass} value={value.email} onChange={(e) => onChange(setField(value, "email", e.target.value))} /></label>
      <label className={labelClass}>Website<input className={fieldClass} value={value.website} onChange={(e) => onChange(setField(value, "website", e.target.value))} /></label>
      <label className={labelClass}>Head Teacher name<input className={fieldClass} value={value.headTeacherName} onChange={(e) => onChange(setField(value, "headTeacherName", e.target.value))} /></label>
      <label className={`${labelClass} md:col-span-2`}>Report footer text<textarea className={fieldClass} value={value.reportFooterText} onChange={(e) => onChange(setField(value, "reportFooterText", e.target.value))} /></label>
      <label className={`${labelClass} md:col-span-2`}>Marksheet footer text<textarea className={fieldClass} value={value.marksheetFooterText} onChange={(e) => onChange(setField(value, "marksheetFooterText", e.target.value))} /></label>
      <label className={`${labelClass} md:col-span-2`}>Logo URL<input className={fieldClass} value={value.logoUrl} onChange={(e) => onChange(setField(value, "logoUrl", e.target.value))} /></label>
    </div>
  );
}

function AcademicSection({ value, onChange }: { value: SettingsSections["academic"]; onChange: (value: SettingsSections["academic"]) => void }) {
  const toggleSupported = (assessment: SettingsSections["academic"]["supportedAssessmentTypes"][number]) => {
    const next = value.supportedAssessmentTypes.includes(assessment)
      ? value.supportedAssessmentTypes.filter((item) => item !== assessment)
      : [...value.supportedAssessmentTypes, assessment];
    onChange({ ...value, supportedAssessmentTypes: next });
  };
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <label className={labelClass}>Active academic year<input className={fieldClass} value={value.activeAcademicYear} onChange={(e) => onChange(setField(value, "activeAcademicYear", e.target.value))} /></label>
      <label className={labelClass}>Active term<input className={fieldClass} value={value.activeTerm} onChange={(e) => onChange(setField(value, "activeTerm", e.target.value))} /></label>
      <label className={labelClass}>Default assessment<select className={fieldClass} value={value.defaultAssessmentType} onChange={(e) => onChange(setField(value, "defaultAssessmentType", e.target.value as typeof value.defaultAssessmentType))}>{["BOT", "MOT", "EOT", "TERM_SUMMARY"].map((item) => <option key={item} value={item}>{item === "TERM_SUMMARY" ? "Term Summary" : item}</option>)}</select></label>
      <div className={labelClass}>Supported assessment types<div className="flex flex-wrap gap-2">{["BOT", "MOT", "EOT", "TERM_SUMMARY"].map((item) => <label key={item} className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs normal-case text-slate-700"><input type="checkbox" checked={value.supportedAssessmentTypes.includes(item as never)} onChange={() => toggleSupported(item as never)} />{item === "TERM_SUMMARY" ? "Term Summary" : item}</label>)}</div></div>
      <label className={labelClass}>Term start date<input type="date" className={fieldClass} value={value.termStartDate} onChange={(e) => onChange(setField(value, "termStartDate", e.target.value))} /></label>
      <label className={labelClass}>Term end date<input type="date" className={fieldClass} value={value.termEndDate} onChange={(e) => onChange(setField(value, "termEndDate", e.target.value))} /></label>
    </div>
  );
}

function ReportsSection({ value, onChange }: { value: SettingsSections["reports"]; onChange: (value: SettingsSections["reports"]) => void }) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <label className={labelClass}>Show overall position<BoolSelect value={value.showOverallPosition} onChange={(v) => onChange(setField(value, "showOverallPosition", v))} /></label>
      <label className={labelClass}>Show class average<BoolSelect value={value.showClassAverage} onChange={(v) => onChange(setField(value, "showClassAverage", v))} /></label>
      <label className={labelClass}>Show grade key<BoolSelect value={value.showGradeKey} onChange={(v) => onChange(setField(value, "showGradeKey", v))} /></label>
      <label className={labelClass}>Show school logo<BoolSelect value={value.showSchoolLogo} onChange={(v) => onChange(setField(value, "showSchoolLogo", v))} /></label>
      <label className={labelClass}>Report print density<select className={fieldClass} value={value.printDensity} onChange={(e) => onChange(setField(value, "printDensity", e.target.value as typeof value.printDensity))}><option value="compact">Compact</option><option value="standard">Standard</option></select></label>
      <label className={labelClass}>Report signature mode<select className={fieldClass} value={value.signatureMode} onChange={(e) => onChange(setField(value, "signatureMode", e.target.value as typeof value.signatureMode))}><option value="name_only">Head Teacher name only</option><option value="name_and_signature_line">Head Teacher name + signature line</option></select></label>
      <label className={`${labelClass} md:col-span-2`}>Default HM comment template<textarea className={fieldClass} value={value.defaultHmCommentTemplate} onChange={(e) => onChange(setField(value, "defaultHmCommentTemplate", e.target.value))} /></label>
      <label className={`${labelClass} md:col-span-2`}>Default class teacher comment template<textarea className={fieldClass} value={value.defaultClassTeacherCommentTemplate} onChange={(e) => onChange(setField(value, "defaultClassTeacherCommentTemplate", e.target.value))} /></label>
    </div>
  );
}

function MarksheetsSection({ value, onChange }: { value: SettingsSections["marksheets"]; onChange: (value: SettingsSections["marksheets"]) => void }) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <label className={labelClass}>Print style<select className={fieldClass} value={value.printStyle} onChange={(e) => onChange(setField(value, "printStyle", e.target.value as typeof value.printStyle))}><option value="rich_black">Rich black</option><option value="standard">Standard</option></select></label>
      <label className={labelClass}>Include QR code<BoolSelect value={value.includeQrCode} onChange={(v) => onChange(setField(value, "includeQrCode", v))} /></label>
      <label className={labelClass}>Include human-readable Marksheet ID<BoolSelect value={value.includeHumanReadableMarksheetId} onChange={(v) => onChange(setField(value, "includeHumanReadableMarksheetId", v))} /></label>
      <label className={labelClass}>One-page target<BoolSelect value={value.onePageTarget} onChange={(v) => onChange(setField(value, "onePageTarget", v))} /></label>
      <label className={labelClass}>Valid mark values<input className={fieldClass} value={value.validMarkValues} disabled readOnly /></label>
      <label className={labelClass}>Blank means<input className={fieldClass} value="Missing, not zero" disabled readOnly /></label>
      <label className={labelClass}>Repeat table header on continuation pages<BoolSelect value={value.repeatTableHeaderOnContinuationPages} disabled onChange={() => {}} /></label>
      <label className={labelClass}>Signatures only on final page<BoolSelect value={value.signaturesOnlyOnFinalPage} disabled onChange={() => {}} /></label>
    </div>
  );
}

function OcrSection({ value, onChange }: { value: SettingsSections["ocr"]; onChange: (value: SettingsSections["ocr"]) => void }) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <label className={labelClass}>OCR provider<select className={fieldClass} value={value.provider} onChange={(e) => onChange(setField(value, "provider", e.target.value as typeof value.provider))}>{["paddleocr", "textract", "googlevision", "tesseract", "manual"].map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
      <label className={labelClass}>PaddleOCR URL<input className={fieldClass} value={value.paddleOcrUrl} onChange={(e) => onChange(setField(value, "paddleOcrUrl", e.target.value))} /></label>
      <label className={labelClass}>AWS region for Textract<input className={fieldClass} value={value.awsRegion} onChange={(e) => onChange(setField(value, "awsRegion", e.target.value))} /></label>
      <label className={labelClass}>OCR debug mode<BoolSelect value={value.debugMode} onChange={(v) => onChange(setField(value, "debugMode", v))} /></label>
      <label className={labelClass}>Minimum OCR confidence<input type="number" min="0" max="1" step="0.01" className={fieldClass} value={value.minimumConfidenceForSuggestion} onChange={(e) => onChange(setField(value, "minimumConfidenceForSuggestion", Number(e.target.value)))} /></label>
      <label className={labelClass}>Use split mark as primary source<BoolSelect value={value.useSplitMarkAsPrimarySource} disabled onChange={() => {}} /></label>
      <label className={labelClass}>Use written mark as confirmation<BoolSelect value={value.useWrittenMarkAsConfirmation} disabled onChange={() => {}} /></label>
      <label className={labelClass}>OCR remarks<BoolSelect value={value.ocrRemarks} disabled onChange={() => {}} /></label>
      <label className={labelClass}>Accept OCR suggestions automatically<BoolSelect value={value.acceptOcrSuggestionsAutomatically} disabled onChange={() => {}} /></label>
      <label className={labelClass}>Require operator review before commit<BoolSelect value={value.requireOperatorReviewBeforeCommit} disabled onChange={() => {}} /></label>
    </div>
  );
}

function GradingSection({ value, onChange }: { value: SettingsSections["grading"]; onChange: (value: SettingsSections["grading"]) => void }) {
  function updateGrade(index: number, patch: Partial<SettingsSections["grading"]["grades"][number]>) {
    const grades = value.grades.map((grade, i) => (i === index ? { ...grade, ...patch } : grade));
    onChange({ grades });
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] border-collapse text-sm">
        <thead><tr className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase text-slate-500"><th className="p-2">Grade</th><th className="p-2">Min score</th><th className="p-2">Max score</th><th className="p-2">Descriptor</th></tr></thead>
        <tbody>
          {value.grades.map((grade, index) => (
            <tr key={grade.label} className="border-b border-slate-100">
              <td className="p-2 font-black">{grade.label}</td>
              <td className="p-2"><input type="number" className={fieldClass} value={grade.minScore} onChange={(e) => updateGrade(index, { minScore: Number(e.target.value) })} /></td>
              <td className="p-2"><input type="number" className={fieldClass} value={grade.maxScore} onChange={(e) => updateGrade(index, { maxScore: Number(e.target.value) })} /></td>
              <td className="p-2"><input className={fieldClass} value={grade.descriptor} onChange={(e) => updateGrade(index, { descriptor: e.target.value })} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ApprovalSection({ value, onChange }: { value: SettingsSections["approval"]; onChange: (value: SettingsSections["approval"]) => void }) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <label className={labelClass}>Require dry-run before commit<BoolSelect value={value.requireDryRunBeforeCommit} onChange={(v) => onChange(setField(value, "requireDryRunBeforeCommit", v))} /></label>
      <label className={labelClass}>Protect committed marks from editing<BoolSelect value={value.protectCommittedMarksFromEditing} onChange={(v) => onChange(setField(value, "protectCommittedMarksFromEditing", v))} /></label>
      <label className={labelClass}>Require HM finalization before report print/release<BoolSelect value={value.requireHmFinalizationBeforeReportPrintRelease} onChange={(v) => onChange(setField(value, "requireHmFinalizationBeforeReportPrintRelease", v))} /></label>
      <label className={labelClass}>Allow HM to edit comments<BoolSelect value={value.allowHmToEditComments} onChange={(v) => onChange(setField(value, "allowHmToEditComments", v))} /></label>
      <label className={labelClass}>Allow HM to edit raw marks<BoolSelect value={value.allowHmToEditRawMarks} disabled onChange={() => {}} /></label>
      <label className={labelClass}>Reopen finalized reports requires reason<BoolSelect value={value.reopenFinalizedReportsRequiresReason} onChange={(v) => onChange(setField(value, "reopenFinalizedReportsRequiresReason", v))} /></label>
      <label className={labelClass}>Keep audit trail<BoolSelect value={value.keepAuditTrail} onChange={(v) => onChange(setField(value, "keepAuditTrail", v))} /></label>
    </div>
  );
}

function AppearanceSection({ value, onChange }: { value: SettingsSections["appearance"]; onChange: (value: SettingsSections["appearance"]) => void }) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <label className={labelClass}>App density<select className={fieldClass} value={value.appDensity} onChange={(e) => onChange(setField(value, "appDensity", e.target.value as typeof value.appDensity))}><option value="compact">Compact</option><option value="comfortable">Comfortable</option></select></label>
      <label className={labelClass}>Sidebar width<select className={fieldClass} value={value.sidebarWidth} onChange={(e) => onChange(setField(value, "sidebarWidth", e.target.value as typeof value.sidebarWidth))}><option value="compact">Compact</option><option value="standard">Standard</option><option value="wide">Wide</option></select></label>
      <label className={labelClass}>Print style<select className={fieldClass} value={value.printStyle} onChange={(e) => onChange(setField(value, "printStyle", e.target.value as typeof value.printStyle))}><option value="rich_black">Rich black</option><option value="standard">Standard</option></select></label>
      <label className={labelClass}>Font size<select className={fieldClass} value={value.fontSize} onChange={(e) => onChange(setField(value, "fontSize", e.target.value as typeof value.fontSize))}><option value="small">Small</option><option value="standard">Standard</option><option value="large">Large</option></select></label>
    </div>
  );
}
