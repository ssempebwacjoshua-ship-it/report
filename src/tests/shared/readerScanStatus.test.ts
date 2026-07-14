import { describe, expect, it } from "vitest";
import { countsAsReaderErrorStatus, isReviewOnlyReaderScanStatus } from "../../shared/utils/readerScanStatus";

describe("readerScanStatus", () => {
  it("treats review-only reader scan statuses as non-errors", () => {
    expect(isReviewOnlyReaderScanStatus("SESSION_CLOSED")).toBe(true);
    expect(isReviewOnlyReaderScanStatus("UNCLASSIFIED")).toBe(true);
    expect(countsAsReaderErrorStatus("SESSION_CLOSED")).toBe(false);
    expect(countsAsReaderErrorStatus("UNCLASSIFIED")).toBe(false);
  });

  it("still treats real scan failures as errors", () => {
    expect(countsAsReaderErrorStatus("UNKNOWN_CREDENTIAL")).toBe(true);
    expect(countsAsReaderErrorStatus("BLOCKED")).toBe(true);
    expect(countsAsReaderErrorStatus("PRESENT")).toBe(false);
    expect(countsAsReaderErrorStatus("SUCCESS")).toBe(false);
  });
});
