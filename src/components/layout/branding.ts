import type { SchoolProfileSettings } from "../../shared/types/settings";

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

