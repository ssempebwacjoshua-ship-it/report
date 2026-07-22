import crypto from "node:crypto";

const TOKEN_SECRET = process.env.JWT_SECRET ?? "dev-secret-change-in-production";

export function sha256Hex(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }

  const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b));
  return `{${entries.map(([key, entryValue]) => `${JSON.stringify(key)}:${stableStringify(entryValue)}`).join(",")}}`;
}

export function buildReportSnapshotSignature(snapshot: unknown): string {
  return sha256Hex(stableStringify(snapshot));
}

export function buildReportVersionSignature(snapshot: unknown): string {
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) {
    return buildReportSnapshotSignature(snapshot);
  }

  const { issuedAt: _issuedAt, issuedByName: _issuedByName, ...versionSnapshot } = snapshot as Record<string, unknown>;
  return buildReportSnapshotSignature(versionSnapshot);
}

export type ReportLinkTokenInput = {
  reportId: string;
  snapshotSignature: string;
  schoolId: string;
  studentId: string;
  academicYear: string;
  term: string;
  assessmentType: string;
};

export function buildReportLinkToken(input: ReportLinkTokenInput): string {
  return crypto
    .createHmac("sha256", TOKEN_SECRET)
    .update([
      input.reportId,
      input.snapshotSignature,
      input.schoolId,
      input.studentId,
      input.academicYear,
      input.term,
      input.assessmentType,
    ].join("|"))
    .digest("hex");
}

export function getReportLinkExpiry(termEndDate?: string | null): Date | null {
  if (!termEndDate?.trim()) return null;
  const expiry = new Date(`${termEndDate.trim()}T23:59:59.999Z`);
  return Number.isNaN(expiry.getTime()) ? null : expiry;
}

export function isReportLinkExpired(expiresAt?: Date | string | null, now = new Date()): boolean {
  if (!expiresAt) return false;
  const expiry = expiresAt instanceof Date ? expiresAt : new Date(expiresAt);
  return Number.isFinite(expiry.getTime()) && expiry <= now;
}
