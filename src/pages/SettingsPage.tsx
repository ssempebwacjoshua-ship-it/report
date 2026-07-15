import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { readAzureOcr } from "../client/ocrClient";
import {
  fetchSettings,
  patchSettingsSection,
  SettingsClientError,
  type SettingsFieldErrors,
  uploadReportPersonalizationAsset,
} from "../client/settingsClient";
import { BrandedLoader } from "../components/BrandedLoader";
import { SchoolStructureSection } from "../components/settings/SchoolStructureSection";
import { SubscriptionSection } from "../components/settings/SubscriptionSection";
import { defaultSettingsSections, type SettingSection, type SettingsResponse, type SettingsSections } from "../shared/types/settings";

type TabId = SettingSection | "school-structure" | "subscription";
type Tab = { id: TabId; label: string };

const tabs: Tab[] = [
  { id: "school", label: "School Profile" },
  { id: "school-structure", label: "School Structure" },
  { id: "academic", label: "Academic Setup" },
  { id: "reports", label: "Reports" },
  { id: "reportPersonalization", label: "Report Personalisation" },
  { id: "marksheets", label: "Marksheets" },
  { id: "ocr", label: "OCR & Scan Import" },
  { id: "grading", label: "Grading Scale" },
  { id: "approval", label: "Approval & Safety" },
  { id: "appearance", label: "Appearance" },
  { id: "subscription", label: "Subscription" },
];

const fieldClass =
  "premium-control w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-400";
const labelClass = "grid gap-1 text-xs font-bold uppercase text-slate-500";

function setField<T, K extends keyof T>(value: T, key: K, next: T[K]): T {
  return { ...value, [key]: next };
}

function firstFieldError(fieldErrors: SettingsFieldErrors | undefined, field: string) {
  return fieldErrors?.[field]?.[0] ?? "";
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

function resolveInitialTab(pathname: string): TabId {
  if (pathname.includes("report-personalisation")) return "reportPersonalization";
  return "school";
}

export function SettingsPage() {
  const [activeTab, setActiveTab] = useState<TabId>(() =>
    resolveInitialTab(typeof window !== "undefined" ? window.location.pathname : ""),
  );
  const [settings, setSettings] = useState<SettingsResponse | null>(null);
  const [draft, setDraft] = useState<SettingsSections>(defaultSettingsSections);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<SettingSection | null>(null);
  const [saved, setSaved] = useState<SettingSection | null>(null);
  const [errors, setErrors] = useState<Partial<Record<SettingSection, string>>>({});
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<SettingSection, SettingsFieldErrors>>>({});
  const [ocrUrl, setOcrUrl] = useState("");
  const [ocrResult, setOcrResult] = useState<{ provider: string; text: string; lines: string[] } | null>(null);
  const [ocrError, setOcrError] = useState("");
  const [ocrLoading, setOcrLoading] = useState(false);
  const [uploadingAsset, setUploadingAsset] = useState<null | "logo" | "stamp" | "signature">(null);
  const [uploadNotice, setUploadNotice] = useState("");

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
    setFieldErrors((current) => {
      if (!current[section]) return current;
      const next = { ...current };
      delete next[section];
      return next;
    });
  }

  function updateSchoolField<K extends keyof SettingsSections["school"]>(field: K, next: SettingsSections["school"][K]) {
    setDraft((current) => ({
      ...current,
      school: { ...current.school, [field]: next },
    }));
    setSaved(null);
  }

  async function saveSection(section: SettingSection) {
    setSaving(section);
    setSaved(null);
    setErrors((current) => ({ ...current, [section]: "" }));
    setFieldErrors((current) => {
      if (!current[section]) return current;
      const next = { ...current };
      delete next[section];
      return next;
    });
    try {
      const loaded = await patchSettingsSection(section, draft[section]);
      setSettings(loaded);
      setDraft(loaded.sections);
      setSaved(section);
    } catch (error) {
      if (error instanceof SettingsClientError && error.fieldErrors) {
        const firstFieldMessage = Object.values(error.fieldErrors).flat().find(Boolean) ?? error.message;
        setErrors((current) => ({ ...current, [section]: firstFieldMessage }));
        setFieldErrors((current) => ({ ...current, [section]: error.fieldErrors ?? {} }));
        return;
      }
      setErrors((current) => ({ ...current, [section]: error instanceof Error ? error.message : "Save failed" }));
    } finally {
      setSaving(null);
    }
  }

  function resetSection(section: SettingSection) {
    if (section === "school" && settings) {
      updateSection("school", {
        ...defaultSettingsSections.school,
        schoolName: settings.sections.school.schoolName,
        schoolCode: settings.sections.school.schoolCode,
      });
      return;
    }
    updateSection(section, defaultSettingsSections[section] as SettingsSections[typeof section]);
  }

  async function handleAssetUpload(assetType: "logo" | "stamp" | "signature", file: File) {
    setUploadingAsset(assetType);
    setUploadNotice("");
    try {
      const result = await uploadReportPersonalizationAsset(assetType, file);
      const nextBranding = {
        ...draft.reportPersonalization.branding,
        ...(assetType === "logo" ? { logoUrl: result.assetUrl } : {}),
        ...(assetType === "stamp" ? { stampUrl: result.assetUrl } : {}),
        ...(assetType === "signature" ? { headteacherSignatureUrl: result.assetUrl } : {}),
      };
      const nextSection = {
        ...draft.reportPersonalization,
        branding: nextBranding,
      };
      const loaded = await patchSettingsSection("reportPersonalization", nextSection);
      setSettings(loaded);
      setDraft(loaded.sections);
      setSaved("reportPersonalization");
      setUploadNotice(`${assetType} uploaded successfully.`);
    } catch (error) {
      setUploadNotice(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setUploadingAsset(null);
    }
  }

  const activeLabel = useMemo(() => tabs.find((tab) => tab.id === activeTab)?.label ?? "Settings", [activeTab]);

  async function runOcrTest() {
    setOcrLoading(true);
    setOcrError("");
    setOcrResult(null);
    try {
      const token = localStorage.getItem("sc_auth_token");
      const result = await readAzureOcr(ocrUrl.trim(), token);
      setOcrResult(result);
    } catch (error) {
      setOcrError(error instanceof Error ? error.message : "OCR failed");
    } finally {
      setOcrLoading(false);
    }
  }

  if (loading) {
    return <BrandedLoader message="Loading settings..." />;
  }

  return (
    <main className="grid gap-4">
      <header className="page-header">
        <p className="text-xs font-bold uppercase tracking-wide text-blue-600">Settings</p>
        <h1 className="text-xl font-bold tracking-tight text-slate-950 sm:text-2xl">School Connect Reports Lab</h1>
        <p className="mt-1 text-sm text-slate-600">Saved settings apply to reports, marksheets, scan import, grading, and approval controls.</p>
      </header>

      <div className="tab-tray no-print flex max-w-full flex-nowrap overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`tab-button shrink-0 whitespace-nowrap ${activeTab === tab.id ? "tab-button-active" : ""}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "school-structure" ? (
        <SchoolStructureSection />
      ) : activeTab === "subscription" ? (
        <SubscriptionSection />
      ) : (
        <SectionFrame
          title={activeLabel}
          onSave={() => saveSection(activeTab as SettingSection)}
          onReset={() => resetSection(activeTab as SettingSection)}
          saving={saving === activeTab}
          saved={saved === activeTab}
          error={errors[activeTab as SettingSection] ?? ""}
        >
          {activeTab === "school" && (
            <SchoolSection value={draft.school} fieldErrors={fieldErrors.school ?? {}} onFieldChange={updateSchoolField} />
          )}
          {activeTab === "academic" && <AcademicSection value={draft.academic} onChange={(value) => updateSection("academic", value)} />}
          {activeTab === "reports" && <ReportsSection value={draft.reports} onChange={(value) => updateSection("reports", value)} />}
          {activeTab === "reportPersonalization" && (
            <ReportPersonalizationSection
              value={draft.reportPersonalization}
              onChange={(value) => updateSection("reportPersonalization", value)}
              onUpload={handleAssetUpload}
              uploadingAsset={uploadingAsset}
              uploadNotice={uploadNotice}
            />
          )}
          {activeTab === "marksheets" && <MarksheetsSection value={draft.marksheets} onChange={(value) => updateSection("marksheets", value)} />}
          {activeTab === "ocr" && (
            <div className="grid gap-4">
              <OcrSection value={draft.ocr} onChange={(value) => updateSection("ocr", value)} />
              <section className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <h3 className="text-sm font-bold text-slate-950">OCR test panel</h3>
                <p className="mt-1 text-xs text-slate-500">Paste a public image or document URL and extract text through the Railway backend.</p>
                <div className="mt-3 grid gap-2">
                  <input
                    className={fieldClass}
                    value={ocrUrl}
                    onChange={(e) => setOcrUrl(e.target.value)}
                    placeholder="https://example.com/image-or-pdf.jpg"
                  />
                  <div className="flex flex-wrap gap-2">
                    <button type="button" className="btn btn-primary" onClick={() => void runOcrTest()} disabled={ocrLoading || !ocrUrl.trim()}>
                      {ocrLoading ? "Extracting..." : "Extract Text"}
                    </button>
                  </div>
                  {ocrError ? <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{ocrError}</div> : null}
                  {ocrResult ? (
                    <div className="grid gap-2">
                      <div className="rounded-lg border border-slate-200 bg-white p-3">
                        <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Extracted text</p>
                        <pre className="mt-2 whitespace-pre-wrap text-sm text-slate-800">{ocrResult.text || "(no text returned)"}</pre>
                      </div>
                      <div className="rounded-lg border border-slate-200 bg-white p-3">
                        <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Lines</p>
                        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
                          {ocrResult.lines.map((line, index) => (
                            <li key={`${index}-${line}`}>{line}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  ) : null}
                </div>
              </section>
            </div>
          )}
          {activeTab === "grading" && <GradingSection value={draft.grading} onChange={(value) => updateSection("grading", value)} />}
          {activeTab === "approval" && <ApprovalSection value={draft.approval} onChange={(value) => updateSection("approval", value)} />}
          {activeTab === "appearance" && <AppearanceSection value={draft.appearance} onChange={(value) => updateSection("appearance", value)} />}
        </SectionFrame>
      )}
    </main>
  );
}

function SchoolSection({
  value,
  fieldErrors,
  onFieldChange,
}: {
  value: SettingsSections["school"];
  fieldErrors: SettingsFieldErrors;
  onFieldChange: <K extends keyof SettingsSections["school"]>(field: K, next: SettingsSections["school"][K]) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-2">
      <label className={labelClass}>
        School name
        <input className={fieldClass} value={value.schoolName} onChange={(e) => onFieldChange("schoolName", e.target.value)} />
        {firstFieldError(fieldErrors, "schoolName") ? <span className="text-xs font-medium text-red-600">{firstFieldError(fieldErrors, "schoolName")}</span> : null}
      </label>
      <label className={labelClass}>
        School code
        <input className={fieldClass} value={value.schoolCode} onChange={(e) => onFieldChange("schoolCode", e.target.value)} />
        {firstFieldError(fieldErrors, "schoolCode") ? <span className="text-xs font-medium text-red-600">{firstFieldError(fieldErrors, "schoolCode")}</span> : null}
      </label>
      <label className={`${labelClass} col-span-2`}>
        Address
        <input className={fieldClass} value={value.address} onChange={(e) => onFieldChange("address", e.target.value)} />
      </label>
      <label className={labelClass}>
        Phone
        <input className={fieldClass} value={value.phone} onChange={(e) => onFieldChange("phone", e.target.value)} />
      </label>
      <label className={labelClass}>
        Email
        <input className={fieldClass} value={value.email} onChange={(e) => onFieldChange("email", e.target.value)} />
      </label>
      <label className={labelClass}>
        Website
        <input className={fieldClass} value={value.website} onChange={(e) => onFieldChange("website", e.target.value)} />
      </label>
      <label className={labelClass}>
        Head Teacher name
        <input className={fieldClass} value={value.headTeacherName} onChange={(e) => onFieldChange("headTeacherName", e.target.value)} />
      </label>
      <label className={`${labelClass} col-span-2`}>
        Report footer text
        <textarea className={fieldClass} value={value.reportFooterText} onChange={(e) => onFieldChange("reportFooterText", e.target.value)} />
      </label>
      <label className={`${labelClass} col-span-2`}>
        Marksheet footer text
        <textarea className={fieldClass} value={value.marksheetFooterText} onChange={(e) => onFieldChange("marksheetFooterText", e.target.value)} />
      </label>
      <label className={`${labelClass} col-span-2`}>
        Logo URL
        <input className={fieldClass} value={value.logoUrl} onChange={(e) => onFieldChange("logoUrl", e.target.value)} />
      </label>
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
    <div className="grid grid-cols-2 gap-3 md:grid-cols-2">
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
    <div className="grid grid-cols-2 gap-3 md:grid-cols-2">
      <label className={labelClass}>Show overall position<BoolSelect value={value.showOverallPosition} onChange={(v) => onChange(setField(value, "showOverallPosition", v))} /></label>
      <label className={labelClass}>Show class average<BoolSelect value={value.showClassAverage} onChange={(v) => onChange(setField(value, "showClassAverage", v))} /></label>
      <label className={labelClass}>Show grade key<BoolSelect value={value.showGradeKey} onChange={(v) => onChange(setField(value, "showGradeKey", v))} /></label>
      <label className={labelClass}>Show school logo<BoolSelect value={value.showSchoolLogo} onChange={(v) => onChange(setField(value, "showSchoolLogo", v))} /></label>
      <label className={labelClass}>Report print density<select className={fieldClass} value={value.printDensity} onChange={(e) => onChange(setField(value, "printDensity", e.target.value as typeof value.printDensity))}><option value="compact">Compact</option><option value="standard">Standard</option></select></label>
      <label className={labelClass}>Report signature mode<select className={fieldClass} value={value.signatureMode} onChange={(e) => onChange(setField(value, "signatureMode", e.target.value as typeof value.signatureMode))}><option value="name_only">Head Teacher name only</option><option value="name_and_signature_line">Head Teacher name + signature line</option></select></label>
      <label className={`${labelClass} col-span-2`}>Default HM comment template<textarea className={fieldClass} value={value.defaultHmCommentTemplate} onChange={(e) => onChange(setField(value, "defaultHmCommentTemplate", e.target.value))} /></label>
      <label className={`${labelClass} col-span-2`}>Default class teacher comment template<textarea className={fieldClass} value={value.defaultClassTeacherCommentTemplate} onChange={(e) => onChange(setField(value, "defaultClassTeacherCommentTemplate", e.target.value))} /></label>
    </div>
  );
}

function ReportPersonalizationSection({
  value,
  onChange,
  onUpload,
  uploadingAsset,
  uploadNotice,
}: {
  value: SettingsSections["reportPersonalization"];
  onChange: (value: SettingsSections["reportPersonalization"]) => void;
  onUpload: (assetType: "logo" | "stamp" | "signature", file: File) => Promise<void>;
  uploadingAsset: null | "logo" | "stamp" | "signature";
  uploadNotice: string;
}) {
  const updateBranding = <K extends keyof SettingsSections["reportPersonalization"]["branding"]>(
    key: K,
    next: SettingsSections["reportPersonalization"]["branding"][K],
  ) => onChange({ ...value, branding: { ...value.branding, [key]: next } });

  const updateLayout = <K extends keyof SettingsSections["reportPersonalization"]["layout"]>(
    key: K,
    next: SettingsSections["reportPersonalization"]["layout"][K],
  ) => onChange({ ...value, layout: { ...value.layout, [key]: next } });

  function updateBand(index: number, patch: Partial<SettingsSections["reportPersonalization"]["gradingScheme"][number]>) {
    onChange({
      ...value,
      gradingScheme: value.gradingScheme.map((band, i) => (i === index ? { ...band, ...patch } : band)),
    });
  }

  function addBand() {
    onChange({
      ...value,
      gradingScheme: [
        ...value.gradingScheme,
        {
          sortOrder: value.gradingScheme.length,
          name: "New band",
          minScore: 0,
          maxScore: 0,
          grade: "D1",
          points: undefined,
          remark: "",
        },
      ],
    });
  }

  function removeBand(index: number) {
    onChange({ ...value, gradingScheme: value.gradingScheme.filter((_, i) => i !== index).map((band, i) => ({ ...band, sortOrder: i })) });
  }

  function updateComment(index: number, patch: Partial<SettingsSections["reportPersonalization"]["commentBank"][number]>) {
    onChange({
      ...value,
      commentBank: value.commentBank.map((comment, i) => (i === index ? { ...comment, ...patch } : comment)),
    });
  }

  function addComment() {
    onChange({
      ...value,
      commentBank: [
        ...value.commentBank,
        { sortOrder: value.commentBank.length, type: "classTeacher", comment: "", active: true },
      ],
    });
  }

  function removeComment(index: number) {
    onChange({ ...value, commentBank: value.commentBank.filter((_, i) => i !== index).map((comment, i) => ({ ...comment, sortOrder: i })) });
  }

  return (
    <div className="grid gap-4">
      {uploadNotice ? <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-700">{uploadNotice}</div> : null}
      <section className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <h3 className="text-sm font-bold text-slate-950">School branding</h3>
        <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-2">
          <label className={labelClass}>School name override<input className={fieldClass} value={value.branding.schoolNameOverride} onChange={(e) => updateBranding("schoolNameOverride", e.target.value)} /></label>
          <label className={labelClass}>Motto<input className={fieldClass} value={value.branding.motto} onChange={(e) => updateBranding("motto", e.target.value)} /></label>
          <label className={`${labelClass} col-span-2`}>Address<input className={fieldClass} value={value.branding.address} onChange={(e) => updateBranding("address", e.target.value)} /></label>
          <label className={labelClass}>Phone<input className={fieldClass} value={value.branding.phone} onChange={(e) => updateBranding("phone", e.target.value)} /></label>
          <label className={labelClass}>Email<input className={fieldClass} value={value.branding.email} onChange={(e) => updateBranding("email", e.target.value)} /></label>
          <label className={labelClass}>Website<input className={fieldClass} value={value.branding.website} onChange={(e) => updateBranding("website", e.target.value)} /></label>
          <label className={labelClass}>Head teacher name<input className={fieldClass} value={value.branding.headteacherName} onChange={(e) => updateBranding("headteacherName", e.target.value)} /></label>
          <label className={labelClass}>Primary color<input type="color" className={fieldClass} value={value.branding.primaryColor} onChange={(e) => updateBranding("primaryColor", e.target.value)} /></label>
          <label className={labelClass}>Secondary color<input type="color" className={fieldClass} value={value.branding.secondaryColor} onChange={(e) => updateBranding("secondaryColor", e.target.value)} /></label>
          <label className={`${labelClass} col-span-2`}>Footer message<textarea className={fieldClass} value={value.branding.footerMessage} onChange={(e) => updateBranding("footerMessage", e.target.value)} /></label>
          <label className={`${labelClass} col-span-2`}>Logo URL<input className={fieldClass} value={value.branding.logoUrl} onChange={(e) => updateBranding("logoUrl", e.target.value)} /></label>
          <label className={`${labelClass} col-span-2`}>Stamp URL<input className={fieldClass} value={value.branding.stampUrl} onChange={(e) => updateBranding("stampUrl", e.target.value)} /></label>
          <label className={`${labelClass} col-span-2`}>Headteacher signature URL<input className={fieldClass} value={value.branding.headteacherSignatureUrl} onChange={(e) => updateBranding("headteacherSignatureUrl", e.target.value)} /></label>
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          {[
            { label: "Logo", assetType: "logo" as const },
            { label: "Stamp", assetType: "stamp" as const },
            { label: "Signature", assetType: "signature" as const },
          ].map((asset) => (
            <label key={asset.assetType} className="grid gap-1 text-xs font-bold uppercase text-slate-500">
              {asset.label} upload
              <input
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/webp"
                className="premium-control w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none"
                disabled={uploadingAsset === asset.assetType}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void onUpload(asset.assetType, file);
                }}
              />
            </label>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <h3 className="text-sm font-bold text-slate-950">Report layout</h3>
        <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-2">
          <label className={labelClass}>Template style<select className={fieldClass} value={value.layout.templateStyle} onChange={(e) => updateLayout("templateStyle", e.target.value as typeof value.layout.templateStyle)}><option value="classic">Classic</option><option value="modern">Modern</option><option value="compact">Compact</option><option value="detailed">Detailed</option></select></label>
          <label className={labelClass}>Report title override<input className={fieldClass} value={value.layout.reportTitleOverride} onChange={(e) => updateLayout("reportTitleOverride", e.target.value)} /></label>
          <label className={labelClass}>Show student passport photo<BoolSelect value={value.layout.showStudentPhoto} onChange={(v) => updateLayout("showStudentPhoto", v)} /></label>
          <label className={labelClass}>Show position<BoolSelect value={value.layout.showPosition} onChange={(v) => updateLayout("showPosition", v)} /></label>
          <label className={labelClass}>Show stream position<BoolSelect value={value.layout.showStreamPosition} onChange={(v) => updateLayout("showStreamPosition", v)} /></label>
          <label className={labelClass}>Show attendance<BoolSelect value={value.layout.showAttendance} onChange={(v) => updateLayout("showAttendance", v)} /></label>
          <label className={labelClass}>Show grading scale<BoolSelect value={value.layout.showGradingScale} onChange={(v) => updateLayout("showGradingScale", v)} /></label>
          <label className={labelClass}>Show class average<BoolSelect value={value.layout.showClassAverage} onChange={(v) => updateLayout("showClassAverage", v)} /></label>
          <label className={labelClass}>Show parent comment box<BoolSelect value={value.layout.showParentCommentBox} onChange={(v) => updateLayout("showParentCommentBox", v)} /></label>
          <label className={labelClass}>Show subject teacher initials<BoolSelect value={value.layout.showSubjectTeacherInitials} onChange={(v) => updateLayout("showSubjectTeacherInitials", v)} /></label>
          <label className={labelClass}>Show fees balance<BoolSelect value={value.layout.showFeesBalance} onChange={(v) => updateLayout("showFeesBalance", v)} /></label>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-bold text-slate-950">Grading scheme editor</h3>
          <button type="button" className="btn btn-secondary" onClick={addBand}>Add band</button>
        </div>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[860px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-white text-left text-xs uppercase text-slate-500">
                <th className="p-2">Order</th>
                <th className="p-2">Name</th>
                <th className="p-2">Min</th>
                <th className="p-2">Max</th>
                <th className="p-2">Grade</th>
                <th className="p-2">Points</th>
                <th className="p-2">Remark</th>
                <th className="p-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {value.gradingScheme.map((band, index) => (
                <tr key={`${band.sortOrder}-${index}`} className="border-b border-slate-100">
                  <td className="p-2"><input type="number" className={fieldClass} value={band.sortOrder} onChange={(e) => updateBand(index, { sortOrder: Number(e.target.value) })} /></td>
                  <td className="p-2"><input className={fieldClass} value={band.name} onChange={(e) => updateBand(index, { name: e.target.value })} /></td>
                  <td className="p-2"><input type="number" className={fieldClass} value={band.minScore} onChange={(e) => updateBand(index, { minScore: Number(e.target.value) })} /></td>
                  <td className="p-2"><input type="number" className={fieldClass} value={band.maxScore} onChange={(e) => updateBand(index, { maxScore: Number(e.target.value) })} /></td>
                  <td className="p-2"><input className={fieldClass} value={band.grade} onChange={(e) => updateBand(index, { grade: e.target.value })} /></td>
                  <td className="p-2"><input type="number" className={fieldClass} value={band.points ?? ""} onChange={(e) => updateBand(index, { points: e.target.value ? Number(e.target.value) : undefined })} /></td>
                  <td className="p-2"><input className={fieldClass} value={band.remark} onChange={(e) => updateBand(index, { remark: e.target.value })} /></td>
                  <td className="p-2"><button type="button" className="btn btn-danger-light" onClick={() => removeBand(index)}>Delete</button></td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-xs text-slate-500">The server validates ranges, coverage, and overlaps when saved.</p>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-bold text-slate-950">Comment bank</h3>
          <button type="button" className="btn btn-secondary" onClick={addComment}>Add comment</button>
        </div>
        <div className="mt-3 grid gap-3">
          {value.commentBank.map((comment, index) => (
            <div key={`${comment.sortOrder}-${index}`} className="rounded-lg border border-slate-200 bg-white p-3">
              <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                <label className={labelClass}>Order<input type="number" className={fieldClass} value={comment.sortOrder} onChange={(e) => updateComment(index, { sortOrder: Number(e.target.value) })} /></label>
                <label className={labelClass}>Type<select className={fieldClass} value={comment.type} onChange={(e) => updateComment(index, { type: e.target.value as typeof comment.type })}><option value="classTeacher">Class Teacher</option><option value="headteacher">Head Teacher</option><option value="subject">Subject</option><option value="conduct">Conduct</option><option value="attendance">Attendance</option></select></label>
                <label className={labelClass}>Band<select className={fieldClass} value={comment.performanceBand ?? ""} onChange={(e) => updateComment(index, { performanceBand: (e.target.value || undefined) as typeof comment.performanceBand })}><option value="">Any</option><option value="excellent">Excellent</option><option value="good">Good</option><option value="average">Average</option><option value="weak">Weak</option><option value="poor">Poor</option></select></label>
                <label className={labelClass}>Active<BoolSelect value={comment.active} onChange={(v) => updateComment(index, { active: v })} /></label>
              </div>
              <label className={`${labelClass} mt-2`}>
                Comment text
                <textarea className={fieldClass} value={comment.comment} onChange={(e) => updateComment(index, { comment: e.target.value })} />
              </label>
              <div className="mt-2 flex justify-end">
                <button type="button" className="btn btn-danger-light" onClick={() => removeComment(index)}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function MarksheetsSection({ value, onChange }: { value: SettingsSections["marksheets"]; onChange: (value: SettingsSections["marksheets"]) => void }) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-2">
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
    <div className="grid grid-cols-2 gap-3 md:grid-cols-2">
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
    onChange({ grades: value.grades.map((grade, i) => (i === index ? { ...grade, ...patch } : grade)) });
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
    <div className="grid grid-cols-2 gap-3 md:grid-cols-2">
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
    <div className="grid grid-cols-2 gap-3 md:grid-cols-2">
      <label className={labelClass}>App density<select className={fieldClass} value={value.appDensity} onChange={(e) => onChange(setField(value, "appDensity", e.target.value as typeof value.appDensity))}><option value="compact">Compact</option><option value="comfortable">Comfortable</option></select></label>
      <label className={labelClass}>Sidebar width<select className={fieldClass} value={value.sidebarWidth} onChange={(e) => onChange(setField(value, "sidebarWidth", e.target.value as typeof value.sidebarWidth))}><option value="compact">Compact</option><option value="standard">Standard</option><option value="wide">Wide</option></select></label>
      <label className={labelClass}>Print style<select className={fieldClass} value={value.printStyle} onChange={(e) => onChange(setField(value, "printStyle", e.target.value as typeof value.printStyle))}><option value="rich_black">Rich black</option><option value="standard">Standard</option></select></label>
      <label className={labelClass}>Font size<select className={fieldClass} value={value.fontSize} onChange={(e) => onChange(setField(value, "fontSize", e.target.value as typeof value.fontSize))}><option value="small">Small</option><option value="standard">Standard</option><option value="large">Large</option></select></label>
    </div>
  );
}
