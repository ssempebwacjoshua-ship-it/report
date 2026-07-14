const REVIEW_ONLY_SCAN_STATUSES = new Set(["SESSION_CLOSED", "UNCLASSIFIED"]);

export function isReviewOnlyReaderScanStatus(status: string | null | undefined) {
  if (!status) return false;
  return REVIEW_ONLY_SCAN_STATUSES.has(status);
}

export function countsAsReaderErrorStatus(status: string | null | undefined) {
  if (!status) return false;
  if (status === "SUCCESS" || status === "PRESENT") return false;
  if (isReviewOnlyReaderScanStatus(status)) return false;
  return true;
}
