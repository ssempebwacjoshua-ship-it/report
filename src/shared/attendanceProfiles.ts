export type AttendanceProfile = "DAY_SCHOLAR" | "BOARDER";
export type LegacyStudentType = "DAY" | "BOARDING";

export const ATTENDANCE_PROFILE_OPTIONS: AttendanceProfile[] = ["DAY_SCHOLAR", "BOARDER"];

export const ATTENDANCE_PROFILE_LABELS: Record<AttendanceProfile, string> = {
  DAY_SCHOLAR: "Day Scholar",
  BOARDER: "Boarder",
};

export const ATTENDANCE_PROFILE_FILTER_OPTIONS = ["ALL", "DAY_SCHOLAR", "BOARDER"] as const;
export type AttendanceProfileFilter = (typeof ATTENDANCE_PROFILE_FILTER_OPTIONS)[number];

export function attendanceProfileToLegacyStudentType(profile: AttendanceProfile): LegacyStudentType {
  return profile === "BOARDER" ? "BOARDING" : "DAY";
}

export function attendanceProfileToShortLabel(profile: AttendanceProfile): "DAY" | "BOARDING" {
  return attendanceProfileToLegacyStudentType(profile);
}

export function resolveAttendanceProfile(input: {
  attendanceProfile?: string | null;
  studentType?: string | null;
}): AttendanceProfile {
  if (input.attendanceProfile === "BOARDER" || input.attendanceProfile === "DAY_SCHOLAR") {
    return input.attendanceProfile;
  }
  if (input.studentType === "BOARDING") return "BOARDER";
  return "DAY_SCHOLAR";
}

export function parseAttendanceProfile(value: string | null | undefined): AttendanceProfile | null {
  if (!value) return null;
  const normalized = value.trim().toUpperCase().replace(/[\s-]+/g, "_");
  if (normalized === "DAY" || normalized === "DAY_SCHOLAR" || normalized === "DAYSCHOLAR") return "DAY_SCHOLAR";
  if (normalized === "BOARDING" || normalized === "BOARDER") return "BOARDER";
  return null;
}

export function formatAttendanceProfileFilter(value: AttendanceProfileFilter): string {
  if (value === "ALL") return "All";
  return ATTENDANCE_PROFILE_LABELS[value];
}
