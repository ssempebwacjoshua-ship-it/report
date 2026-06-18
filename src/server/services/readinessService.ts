import type { ReportReadiness } from "../../shared/types/reports";

export function emptyReasonForReadiness(readiness: ReportReadiness): string | null {
  switch (readiness) {
    case "NO_ACTIVE_TERM":
      return "No active term is configured for the selected school and academic year.";
    case "NO_STUDENTS":
      return "No enrolled students found for this class and stream. Reports can only be issued for enrolled students.";
    case "NO_SUBJECTS":
      return "No active O-Level subjects are configured for this school.";
    case "NO_FINALIZED_MARKS":
      return "Students and subjects exist, but no finalized marks match the selected filters.";
    case "MISSING_MARKS":
      return "Report data exists, but some required subject marks are missing.";
    case "READY":
      return null;
  }
}

