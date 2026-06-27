import type { ReportPersonalizationSettings, SchoolProfileSettings } from "../../shared/types/settings";

export function getSchoolInitials(name: string) {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return "SC";
  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function getSchoolDisplayName(settings?: SchoolProfileSettings | null, fallback = "School Connect") {
  return settings?.schoolName?.trim() || fallback;
}

export function getSchoolBranding(settings?: SchoolProfileSettings | null, fallback = "School Connect") {
  const schoolName = getSchoolDisplayName(settings, fallback);
  return {
    schoolName,
    schoolCode: settings?.schoolCode?.trim() || "",
    initials: getSchoolInitials(schoolName),
    address: settings?.address?.trim() || "",
    phone: settings?.phone?.trim() || "",
    email: settings?.email?.trim() || "",
    website: settings?.website?.trim() || "",
    headTeacherName: settings?.headTeacherName?.trim() || "",
    reportFooterText: settings?.reportFooterText?.trim() || "",
    marksheetFooterText: settings?.marksheetFooterText?.trim() || "",
    logoUrl: settings?.logoUrl?.trim() || "",
  };
}

export function getReportBranding(
  school: SchoolProfileSettings | null | undefined,
  personalization: ReportPersonalizationSettings | null | undefined,
  fallback = "School Connect",
) {
  const base = getSchoolBranding(school, fallback);
  const branding = personalization?.branding;
  const schoolName = branding?.schoolNameOverride?.trim() || base.schoolName;

  return {
    ...base,
    schoolName,
    initials: getSchoolInitials(schoolName),
    address: branding?.address?.trim() || base.address,
    phone: branding?.phone?.trim() || base.phone,
    email: branding?.email?.trim() || base.email,
    website: branding?.website?.trim() || base.website,
    headTeacherName: branding?.headteacherName?.trim() || base.headTeacherName,
    reportFooterText: branding?.footerMessage?.trim() || base.reportFooterText,
    motto: branding?.motto?.trim() || "",
    primaryColor: branding?.primaryColor?.trim() || "#0f2a5e",
    secondaryColor: branding?.secondaryColor?.trim() || "#c9a227",
    logoUrl: branding?.logoUrl?.trim() || base.logoUrl,
    stampUrl: branding?.stampUrl?.trim() || "",
    headteacherSignatureUrl: branding?.headteacherSignatureUrl?.trim() || "",
    reportTitleOverride: personalization?.layout.reportTitleOverride?.trim() || "",
    templateStyle: personalization?.layout.templateStyle ?? "classic",
    showStudentPhoto: personalization?.layout.showStudentPhoto ?? false,
    showPosition: personalization?.layout.showPosition ?? false,
    showStreamPosition: personalization?.layout.showStreamPosition ?? false,
    showClassAverage: personalization?.layout.showClassAverage ?? true,
    showGradingScale: personalization?.layout.showGradingScale ?? true,
    showSubjectTeacherInitials: personalization?.layout.showSubjectTeacherInitials ?? false,
    showAttendance: personalization?.layout.showAttendance ?? false,
    showParentCommentBox: personalization?.layout.showParentCommentBox ?? true,
    showFeesBalance: personalization?.layout.showFeesBalance ?? false,
  };
}

