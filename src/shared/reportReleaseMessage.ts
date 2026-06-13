export type ReportReleaseMessageInput = {
  studentName: string;
  termName: string;
  schoolName: string;
  reportLink: string;
};

function formatPossessiveName(name: string) {
  const trimmed = name.trim();
  if (!trimmed) return "Your child's";
  return `${trimmed}${trimmed.endsWith("s") ? "'" : "'s"}`;
}

export function formatTermLabel(termName: string) {
  const trimmed = termName
    .replace(/\b(?:BOT|MOT|EOT|TERM_SUMMARY)\b/gi, "")
    .replace(/[()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const match = trimmed.match(/^term\s*([1-3])$/i) ?? trimmed.match(/^([1-3])$/);
  if (match) return `Term ${match[1]}`;
  return trimmed || "current term";
}

export function buildParentReportReleaseMessage({
  studentName,
  termName,
  schoolName,
  reportLink,
}: ReportReleaseMessageInput) {
  const possessiveStudentName = formatPossessiveName(studentName);
  const termLabel = formatTermLabel(termName);
  const displaySchoolName = schoolName.trim() || "the school";

  return `Dear Parent, ${possessiveStudentName} ${termLabel} school report from ${displaySchoolName} is ready.

Please open the secure link below to view, print, or download the report:
${reportLink}`;
}
