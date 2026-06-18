import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { ReleaseCenterPage } from "../../pages/ReleaseCenterPage";

vi.mock("../../client/releaseCenterClient", () => ({
  fetchReleaseStatus: vi.fn().mockResolvedValue({
    rows: [
      {
        studentId: "s1",
        admissionNumber: "ADM-1",
        studentName: "Ada Lovelace",
        reportReadiness: "READY",
        primaryContact: { guardianName: "Parent One", method: "SMS", contactValue: "+256700000000" },
        issuedReport: null,
        deliveryStatus: "READY_TO_SEND",
      },
      {
        studentId: "s2",
        admissionNumber: "ADM-2",
        studentName: "Grace Hopper",
        reportReadiness: "READY",
        primaryContact: null,
        issuedReport: null,
        deliveryStatus: "MISSING_CONTACT",
      },
    ],
    summary: {
      total: 2,
      finalized: 2,
      linksGenerated: 0,
      missingContacts: 1,
      readyToSend: 1,
      sentManually: 0,
      opened: 0,
      downloaded: 0,
      needsAttention: 1,
    },
    meta: { academicYear: "2025/2026", term: "Term 1", assessmentType: "EOT", schoolName: "Demo School" },
  }),
  issueBulk: vi.fn().mockResolvedValue({ issued: [], skipped: [] }),
  markSent: vi.fn(),
  markSentBulk: vi.fn(),
  revokeIssuedReport: vi.fn(),
  revokeBulk: vi.fn(),
}));

vi.mock("../../client/reportsClient", () => ({
  fetchReportContext: vi.fn().mockResolvedValue({ classes: [{ id: "class-1", name: "S1" }], streams: [], academicYears: [{ id: "ay-1", name: "2025/2026", isActive: true }], terms: [{ id: "term-1", name: "Term 1", isActive: true }] }),
}));

vi.mock("../../client/settingsClient", () => ({
  fetchSettings: vi.fn().mockResolvedValue({
    sections: { school: { schoolName: "Demo School" }, academic: { defaultAssessmentType: "EOT" } },
  }),
}));

describe("ReleaseCenterPage", () => {
  it("renders row selection and bulk controls", async () => {
    render(
      <MemoryRouter initialEntries={["/reports/release"]}>
        <ReleaseCenterPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText("Release Center")).toBeInTheDocument();
    expect(screen.getByText("Issue links for selected")).toBeInTheDocument();
    expect(screen.getByText("Select all visible rows")).toBeInTheDocument();
    await waitFor(() => expect(screen.getAllByRole("checkbox").length).toBeGreaterThan(0));
  });
});

