import { describe, expect, it } from "vitest";
import { buildParentReportReleaseMessage, formatTermLabel } from "../../../../shared/reportReleaseMessage";

describe("report release parent messages", () => {
  it("uses parent-safe school report wording without internal assessment types", () => {
    const message = buildParentReportReleaseMessage({
      studentName: "Gabriel Lule",
      termName: "Term 1",
      schoolName: "ST JULIAN SS WAKISO",
      reportLink: "https://reports.schoolconnect.example/r/secure-token",
    });

    expect(message).toBe(`Dear Parent, Gabriel Lule's Term 1 school report from ST JULIAN SS WAKISO is ready.

Please open the secure link below to view, print, or download the report:
https://reports.schoolconnect.example/r/secure-token`);
    expect(message).not.toContain("TERM_SUMMARY");
    expect(message).not.toContain("marks");
    expect(message).not.toContain("grades");
  });

  it("normalizes human term labels", () => {
    expect(formatTermLabel("term 2")).toBe("Term 2");
    expect(formatTermLabel("3")).toBe("Term 3");
    expect(formatTermLabel("Term 1 (TERM_SUMMARY)")).toBe("Term 1");
    expect(formatTermLabel("TERM_SUMMARY")).toBe("current term");
  });
});

