import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ReleaseCenterPage } from "../../pages/ReleaseCenterPage";
import type { ReleaseFilters, ReleaseStatusResponse } from "../../client/releaseCenterClient";

const mockFetchReleaseStatus = vi.fn<[ReleaseFilters], Promise<ReleaseStatusResponse>>();
const mockIssueBulk = vi.fn();
const mockMarkSent = vi.fn();
const mockMarkSentBulk = vi.fn();
const mockRevokeIssuedReport = vi.fn();
const mockRevokeBulk = vi.fn();
const mockSendReportReleasesBulk = vi.fn();
const mockFetchReportContext = vi.fn();
const mockFetchSettings = vi.fn();

vi.mock("../../client/releaseCenterClient", () => ({
  fetchReleaseStatus: (filters: ReleaseFilters) => mockFetchReleaseStatus(filters),
  issueBulk: (...args: unknown[]) => mockIssueBulk(...args),
  markSent: (...args: unknown[]) => mockMarkSent(...args),
  markSentBulk: (...args: unknown[]) => mockMarkSentBulk(...args),
  revokeIssuedReport: (...args: unknown[]) => mockRevokeIssuedReport(...args),
  revokeBulk: (...args: unknown[]) => mockRevokeBulk(...args),
  sendReportReleasesBulk: (...args: unknown[]) => mockSendReportReleasesBulk(...args),
}));

vi.mock("../../../../client/reportsClient", () => ({
  fetchReportContext: () => mockFetchReportContext(),
}));

vi.mock("../../../../client/settingsClient", () => ({
  fetchSettings: () => mockFetchSettings(),
}));

function buildRow(overrides: Record<string, unknown> = {}) {
  return {
    studentId: "student-1",
    admissionNumber: "ADM-1",
    studentName: "Ada Lovelace",
    reportReadiness: "READY",
    primaryContact: { guardianName: "Parent One", method: "SMS", contactValue: "+256700000000" },
    isExpired: false,
    issuedReport: null,
    deliveryStatus: "READY_TO_SEND",
    ...overrides,
  };
}

function buildStatusResponse(rows: Array<Record<string, unknown>>): ReleaseStatusResponse {
  return {
    rows: rows as ReleaseStatusResponse["rows"],
    summary: {
      total: rows.length,
      finalized: rows.filter((row) => ["READY", "MISSING_MARKS"].includes(String(row.reportReadiness))).length,
      linksGenerated: rows.filter((row) =>
        ["LINK_GENERATED", "READY_TO_SEND", "SENT_MANUALLY", "OPENED", "DOWNLOADED"].includes(String(row.deliveryStatus)),
      ).length,
      missingContacts: rows.filter((row) => !row.primaryContact).length,
      readyToSend: rows.filter((row) => row.deliveryStatus === "READY_TO_SEND").length,
      sentManually: rows.filter((row) => row.deliveryStatus === "SENT_MANUALLY").length,
      opened: rows.filter((row) => row.deliveryStatus === "OPENED").length,
      downloaded: rows.filter((row) => row.deliveryStatus === "DOWNLOADED").length,
      expired: rows.filter((row) => row.isExpired).length,
      needsAttention: rows.filter((row) =>
        ["NOT_FINALIZED", "MISSING_CONTACT", "REVOKED"].includes(String(row.deliveryStatus)) || Boolean(row.isExpired),
      ).length,
    },
    meta: {
      academicYear: "2025/2026",
      term: "Term 1",
      assessmentType: "TERM_SUMMARY",
      schoolName: "Demo School",
    },
  };
}

async function renderPage() {
  render(
    <MemoryRouter initialEntries={["/reports/release"]}>
      <ReleaseCenterPage />
    </MemoryRouter>,
  );

  await screen.findByText("Release Center");
  await waitFor(() => expect(mockFetchReleaseStatus).toHaveBeenCalled(), { timeout: 4000 });
}

function getDesktopRow(studentName: string) {
  const rowLabel = screen.getAllByText(studentName).find((node) => node.closest("tr"));
  expect(rowLabel).toBeTruthy();
  return rowLabel!.closest("tr") as HTMLTableRowElement;
}

describe("ReleaseCenterPage", () => {
  beforeEach(() => {
    mockFetchReportContext.mockResolvedValue({
      classes: [{ id: "class-1", name: "S1" }],
      streams: [],
      academicYears: [{ id: "ay-1", name: "2025/2026", isActive: true }],
      terms: [{ id: "term-1", name: "Term 1", isActive: true }],
    });
    mockFetchSettings.mockResolvedValue({
      sections: { school: { schoolName: "Demo School" }, academic: { defaultAssessmentType: "TERM_SUMMARY" } },
    });
    mockIssueBulk.mockResolvedValue({ issued: [], skipped: [] });
    mockMarkSent.mockResolvedValue(undefined);
    mockMarkSentBulk.mockResolvedValue({ updated: 0, skipped: [] });
    mockRevokeIssuedReport.mockResolvedValue(undefined);
    mockRevokeBulk.mockResolvedValue({ updated: 0, skipped: [] });
    mockSendReportReleasesBulk.mockResolvedValue({
      preview: {
        totalSelected: 1,
        issuableLinks: 1,
        missingContacts: 0,
        alreadySent: 0,
        estimatedSmsSegments: 1,
        estimatedSmsCredits: 1,
      },
      submitted: 0,
      failed: 0,
      skippedDuplicate: 0,
      missingContact: 0,
      alreadySent: 0,
      skipped: [],
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("shows Issue link for a READY row without a previous report", async () => {
    mockFetchReleaseStatus.mockResolvedValue(buildStatusResponse([buildRow()]));

    await renderPage();

    const row = getDesktopRow("Ada Lovelace");
    expect(within(row).getByRole("button", { name: "Issue link" })).toBeEnabled();
  });

  it("shows bulk send controls and previews selected report delivery counts", async () => {
    mockFetchReleaseStatus.mockResolvedValue(buildStatusResponse([buildRow()]));

    await renderPage();

    expect(screen.getByRole("heading", { name: "Send reports to parents" })).toBeInTheDocument();
    const row = getDesktopRow("Ada Lovelace");
    fireEvent.click(within(row).getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Preview send" }));

    await waitFor(() => expect(mockSendReportReleasesBulk).toHaveBeenCalledWith(expect.objectContaining({
      channel: "SMS",
      confirm: false,
      previewOnly: true,
      studentIds: ["student-1"],
    })));
    expect(await screen.findByText(/Total selected:/i)).toBeInTheDocument();
    expect(screen.getByText(/SMS credits:/i)).toBeInTheDocument();
  });

  it("shows provider setup errors from report release send", async () => {
    mockFetchReleaseStatus.mockResolvedValue(buildStatusResponse([buildRow()]));
    mockSendReportReleasesBulk
      .mockResolvedValueOnce({
        preview: {
          totalSelected: 1,
          issuableLinks: 1,
          missingContacts: 0,
          alreadySent: 0,
          estimatedSmsSegments: 1,
          estimatedSmsCredits: 1,
        },
        submitted: 0,
        failed: 0,
        skippedDuplicate: 0,
        missingContact: 0,
        alreadySent: 0,
        skipped: [],
      })
      .mockRejectedValueOnce(new Error("SMS_PROVIDER_DISABLED, SMS_API_KEY_MISSING"));
    vi.spyOn(window, "confirm").mockReturnValue(true);

    await renderPage();

    const row = getDesktopRow("Ada Lovelace");
    fireEvent.click(within(row).getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Preview send" }));
    await screen.findByText(/SMS credits:/i);
    fireEvent.click(screen.getByRole("button", { name: "Send reports to parents" }));

    expect(await screen.findByText("SMS_PROVIDER_DISABLED, SMS_API_KEY_MISSING")).toBeInTheDocument();
    expect(screen.queryByText("Could not send report links")).not.toBeInTheDocument();
  });

  it("shows enabled Reissue for a READY row with a revoked report", async () => {
    mockFetchReleaseStatus.mockResolvedValue(buildStatusResponse([
      buildRow({
        issuedReport: {
          id: "issued-1",
          referenceCode: "REF-1",
          status: "REVOKED",
          issuedAt: "2026-07-12T08:00:00.000Z",
          expiresAt: "2026-07-13T08:00:00.000Z",
          issuedByName: "Admin",
          viewedAt: null,
          lastViewedAt: null,
          openCount: 0,
          downloadedAt: null,
          lastDownloadedAt: null,
          downloadCount: 0,
          sentAt: null,
          revokedAt: "2026-07-12T09:00:00.000Z",
          revokeReason: "Recalled",
        },
        deliveryStatus: "REVOKED",
      }),
    ]));

    await renderPage();

    const row = getDesktopRow("Ada Lovelace");
    expect(within(row).getByRole("button", { name: "Reissue" })).toBeEnabled();
  });

  it("shows enabled Reissue for a READY row with a superseded report", async () => {
    mockFetchReleaseStatus.mockResolvedValue(buildStatusResponse([
      buildRow({
        issuedReport: {
          id: "issued-1",
          referenceCode: "REF-1",
          status: "SUPERSEDED",
          issuedAt: "2026-07-12T08:00:00.000Z",
          expiresAt: "2026-07-13T08:00:00.000Z",
          issuedByName: "Admin",
          viewedAt: null,
          lastViewedAt: null,
          openCount: 0,
          downloadedAt: null,
          lastDownloadedAt: null,
          downloadCount: 0,
          sentAt: null,
          revokedAt: null,
          revokeReason: null,
        },
        deliveryStatus: "SUPERSEDED",
      }),
    ]));

    await renderPage();

    const row = getDesktopRow("Ada Lovelace");
    expect(within(row).getByRole("button", { name: "Reissue" })).toBeEnabled();
  });

  it("shows enabled Reissue for an expired issued link", async () => {
    mockFetchReleaseStatus.mockResolvedValue(buildStatusResponse([
      buildRow({
        isExpired: true,
        deliveryStatus: "NOT_ISSUED",
        issuedReport: {
          id: "issued-1",
          referenceCode: "REF-1",
          status: "ISSUED",
          issuedAt: "2026-07-10T08:00:00.000Z",
          expiresAt: "2026-07-11T08:00:00.000Z",
          issuedByName: "Admin",
          viewedAt: null,
          lastViewedAt: null,
          openCount: 0,
          downloadedAt: null,
          lastDownloadedAt: null,
          downloadCount: 0,
          sentAt: null,
          revokedAt: null,
          revokeReason: null,
        },
      }),
    ]));

    await renderPage();

    const row = getDesktopRow("Ada Lovelace");
    expect(within(row).getByRole("button", { name: "Reissue" })).toBeEnabled();
  });

  it("blocks NO_FINALIZED_MARKS rows and shows the reason", async () => {
    mockFetchReleaseStatus.mockImplementation(async ({ assessmentType }) => {
      if (assessmentType === "EOT") return buildStatusResponse([]);
      return buildStatusResponse([
        buildRow({
          reportReadiness: "NO_FINALIZED_MARKS",
          deliveryStatus: "NOT_FINALIZED",
        }),
      ]);
    });

    await renderPage();

    expect(screen.getAllByText("No finalized EOT marks").length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: "Issue link" })).not.toBeInTheDocument();
  });

  it("counts revoked, superseded, and expired rows as ready for bulk issuing", async () => {
    mockFetchReleaseStatus.mockResolvedValue(buildStatusResponse([
      buildRow({ studentId: "student-1", studentName: "Ada Lovelace", issuedReport: null, deliveryStatus: "READY_TO_SEND" }),
      buildRow({
        studentId: "student-2",
        studentName: "Grace Hopper",
        issuedReport: {
          id: "issued-2",
          referenceCode: "REF-2",
          status: "REVOKED",
          issuedAt: "2026-07-12T08:00:00.000Z",
          expiresAt: "2026-07-13T08:00:00.000Z",
          issuedByName: "Admin",
          viewedAt: null,
          lastViewedAt: null,
          openCount: 0,
          downloadedAt: null,
          lastDownloadedAt: null,
          downloadCount: 0,
          sentAt: null,
          revokedAt: "2026-07-12T09:00:00.000Z",
          revokeReason: "Recalled",
        },
        deliveryStatus: "REVOKED",
      }),
      buildRow({
        studentId: "student-3",
        studentName: "Katherine Johnson",
        issuedReport: {
          id: "issued-3",
          referenceCode: "REF-3",
          status: "SUPERSEDED",
          issuedAt: "2026-07-12T08:00:00.000Z",
          expiresAt: "2026-07-13T08:00:00.000Z",
          issuedByName: "Admin",
          viewedAt: null,
          lastViewedAt: null,
          openCount: 0,
          downloadedAt: null,
          lastDownloadedAt: null,
          downloadCount: 0,
          sentAt: null,
          revokedAt: null,
          revokeReason: null,
        },
        deliveryStatus: "SUPERSEDED",
      }),
      buildRow({
        studentId: "student-4",
        studentName: "Dorothy Vaughan",
        isExpired: true,
        deliveryStatus: "NOT_ISSUED",
        issuedReport: {
          id: "issued-4",
          referenceCode: "REF-4",
          status: "ISSUED",
          issuedAt: "2026-07-10T08:00:00.000Z",
          expiresAt: "2026-07-11T08:00:00.000Z",
          issuedByName: "Admin",
          viewedAt: null,
          lastViewedAt: null,
          openCount: 0,
          downloadedAt: null,
          lastDownloadedAt: null,
          downloadCount: 0,
          sentAt: null,
          revokedAt: null,
          revokeReason: null,
        },
      }),
    ]));

    await renderPage();

    expect(screen.getByRole("button", { name: "Issue links for all ready (4)" })).toBeEnabled();
  });

  it("shows subscription errors for bulk selected issuing and clears the busy state", async () => {
    mockFetchReleaseStatus.mockResolvedValue(buildStatusResponse([buildRow()]));
    mockIssueBulk.mockRejectedValue(new Error("An active subscription is required for this operation."));

    await renderPage();

    const row = getDesktopRow("Ada Lovelace");
    const rowCheckbox = within(row).getByRole("checkbox");
    fireEvent.click(rowCheckbox);
    fireEvent.click(screen.getByRole("button", { name: "Issue links for selected" }));

    await waitFor(() => expect(screen.getByText("An active subscription is required for this operation.")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Issue links for selected" })).toBeEnabled();
  });

  it("shows assessment mismatch guidance without changing the selected assessment", async () => {
    mockFetchReleaseStatus.mockImplementation(async ({ assessmentType }) => {
      if (assessmentType === "EOT") {
        return buildStatusResponse([buildRow({ deliveryStatus: "READY_TO_SEND" })]);
      }

      return buildStatusResponse([
        buildRow({
          reportReadiness: "NO_FINALIZED_MARKS",
          deliveryStatus: "NOT_FINALIZED",
        }),
      ]);
    });

    await renderPage();

    expect(
      screen.getByText("No issuable reports were found for TERM_SUMMARY. EOT has finalized reports. Select EOT to issue those links."),
    ).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Assessment" })).toHaveValue("TERM_SUMMARY");
  });

  it("renders only one Issue or Reissue button per row", async () => {
    mockFetchReleaseStatus.mockResolvedValue(buildStatusResponse([
      buildRow({
        issuedReport: {
          id: "issued-1",
          referenceCode: "REF-1",
          status: "REVOKED",
          issuedAt: "2026-07-12T08:00:00.000Z",
          expiresAt: "2026-07-13T08:00:00.000Z",
          issuedByName: "Admin",
          viewedAt: null,
          lastViewedAt: null,
          openCount: 0,
          downloadedAt: null,
          lastDownloadedAt: null,
          downloadCount: 0,
          sentAt: null,
          revokedAt: "2026-07-12T09:00:00.000Z",
          revokeReason: "Recalled",
        },
        deliveryStatus: "REVOKED",
      }),
    ]));

    await renderPage();

    const row = getDesktopRow("Ada Lovelace");
    expect(within(row).getAllByRole("button", { name: /Issue link|Reissue/ })).toHaveLength(1);
  });

  it("stores selected bulk-issued links in state so the row shows a working link action", async () => {
    mockFetchReleaseStatus.mockResolvedValue(buildStatusResponse([buildRow()]));
    mockIssueBulk.mockResolvedValue({
      issued: [{
        studentId: "student-1",
        studentName: "Ada Lovelace",
        referenceCode: "20260719-ABC123",
        publicShortCode: "SHORT1234",
        parentLink: "https://schools.ssamenj.online/r/SHORT1234",
        parentAccessToken: null,
        issuedReportId: "issued-1",
      }],
      skipped: [],
    });

    await renderPage();

    const row = getDesktopRow("Ada Lovelace");
    fireEvent.click(within(row).getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Issue links for selected" }));

    await waitFor(() => expect(within(getDesktopRow("Ada Lovelace")).getByRole("button", { name: "Copy link" })).toBeInTheDocument());
  });
});
