import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CommunicationsPage } from "../../pages/CommunicationsPage";

vi.mock("../../client/communicationsClient", () => ({
  fetchCommunicationCampaigns: vi.fn(),
  createCommunicationCampaign: vi.fn(),
  previewCommunicationRecipients: vi.fn(),
  sendCommunication: vi.fn(),
}));

vi.mock("../../client/reportsClient", () => ({
  fetchReportContext: vi.fn(),
}));

vi.mock("../../client/studentsClient", () => ({
  fetchStudents: vi.fn(),
}));

vi.mock("../../client/staffUsersClient", () => ({
  fetchStaffUsers: vi.fn(),
}));

import { createCommunicationCampaign, fetchCommunicationCampaigns, previewCommunicationRecipients, sendCommunication } from "../../client/communicationsClient";
import { fetchReportContext } from "../../client/reportsClient";
import { fetchStudents } from "../../client/studentsClient";
import { fetchStaffUsers } from "../../client/staffUsersClient";

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(fetchCommunicationCampaigns).mockResolvedValue({
    campaigns: [
      {
        id: "campaign-1",
        title: "Parent Notice",
        type: "ANNOUNCEMENT",
        status: "DRAFT",
        priority: "NORMAL",
        contentVersion: 1,
        createdAt: "2026-07-01T00:00:00.000Z",
        updatedAt: "2026-07-01T00:00:00.000Z",
        _count: { recipients: 0, deliveries: 0 },
        contents: [{ subject: "Notice", body: "Hello parents", shortBody: null }],
      },
    ],
    summary: [{ status: "DRAFT", _count: { status: 1 } }],
  });
  vi.mocked(fetchReportContext).mockResolvedValue({
    school: { id: "school-1", code: "SCU", name: "Buloba High School" },
    academicYears: [{ id: "ay-1", name: "2025/2026", isActive: true }],
    terms: [{ id: "term-1", name: "Term 1", isActive: true }],
    classes: [{ id: "class-1", name: "Senior 1" }],
    streams: [{ id: "stream-1", name: "A", classId: "class-1" }],
    subjects: [],
  });
  vi.mocked(fetchStudents).mockResolvedValue({
    students: [
      {
        id: "student-1",
        admissionNumber: "AUD-001",
        studentName: "Ada Lovelace",
        attendanceProfile: "DAY_SCHOLAR",
        studentType: "DAY",
        isActive: true,
        enrollmentStatus: "ACTIVE",
        className: "Senior 1",
        classId: "class-1",
        streamName: "A",
        streamId: "stream-1",
        academicYearId: "ay-1",
        termId: "term-1",
        contactReadiness: "READY",
        contactSummary: "Ready",
        guardianContacts: [
          {
            id: "contact-1",
            guardianName: "Grace Hopper",
            relationship: "Mother",
            phone: "0774549869",
            email: "grace@example.test",
            preferredContactMethod: "PHONE",
            isPrimary: true,
            canReceiveReports: true,
            notes: "",
          },
        ],
      },
    ],
  });
  vi.mocked(fetchStaffUsers).mockResolvedValue({ users: [] });
  vi.mocked(previewCommunicationRecipients).mockResolvedValue({
    preview: {
      audienceType: "ALL_PARENTS_GUARDIANS",
      matchedStudentsCount: 1,
      rawContactsCount: 1,
      eligibleRecipientsCount: 0,
      missingContactsCount: 1,
      duplicateContactsRemovedCount: 0,
      excludedRecipientsCount: 1,
      optedOutRecipientsCount: 0,
      bouncedRecipientsCount: 0,
      invalidRecipientsCount: 1,
      channel: "WHATSAPP",
      page: 1,
      pageSize: 10,
      totalPages: 1,
      totalRecipients: 1,
      recipients: [
        {
          id: "guardian:contact-1",
          source: "guardian",
          studentId: "student-1",
          studentName: "Ada Lovelace",
          className: "Senior 1",
          streamName: "A",
          contactName: "Grace Hopper",
          relationship: "Mother",
          phone: null,
          email: "grace@example.test",
          channelAvailability: { whatsapp: false, sms: false, email: true },
          selectedChannel: "WHATSAPP",
          eligibilityStatus: "MISSING_PHONE",
          exclusionReason: "Missing phone number.",
          dedupeKey: "guardian:contact-1",
          contactRole: "MOTHER",
        },
      ],
    },
  });
  vi.mocked(sendCommunication).mockResolvedValue({ ok: true, result: { submitted: 0, failed: 0, skippedDuplicate: 0 } });
  vi.mocked(createCommunicationCampaign).mockResolvedValue({
    campaign: {
      id: "campaign-2",
      title: "Parent Notice",
      type: "ANNOUNCEMENT",
      status: "DRAFT",
      priority: "NORMAL",
      contentVersion: 1,
      createdAt: "2026-07-01T00:00:00.000Z",
      updatedAt: "2026-07-01T00:00:00.000Z",
      _count: { recipients: 0, deliveries: 0 },
      contents: [{ subject: "Notice", body: "Hello parents", shortBody: null }],
    },
  });
});

describe("CommunicationsPage", () => {
  it("renders the audience controls and disables send when there are no eligible recipients", async () => {
    render(
      <MemoryRouter>
        <CommunicationsPage />
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByText("Audience")).toBeInTheDocument());
    await waitFor(() => expect(screen.getByText("Preview recipients")).toBeInTheDocument());
    await waitFor(() => expect(screen.getByText(/Missing phone number/i)).toBeInTheDocument());
    expect(screen.getByText("Audience type")).toBeInTheDocument();
    expect(screen.queryByText("Selected students")).not.toBeInTheDocument();
    const buttons = screen.getAllByRole("button", { name: "Confirm send" });
    expect(buttons[0]).toBeDisabled();
  });

  it("shows dry-run mode clearly after a communication send", async () => {
    const user = userEvent.setup();
    vi.spyOn(window, "confirm").mockReturnValue(true);
    vi.mocked(fetchCommunicationCampaigns).mockResolvedValue({
      campaigns: [
        {
          id: "campaign-1",
          title: "Parent Notice",
          type: "ANNOUNCEMENT",
          status: "APPROVED",
          priority: "NORMAL",
          contentVersion: 1,
          createdAt: "2026-07-01T00:00:00.000Z",
          updatedAt: "2026-07-01T00:00:00.000Z",
          _count: { recipients: 1, deliveries: 0 },
          contents: [{ subject: "Notice", body: "Hello parents", shortBody: null }],
        },
      ],
      summary: [{ status: "APPROVED", _count: { status: 1 } }],
    });
    vi.mocked(previewCommunicationRecipients).mockResolvedValue({
      preview: {
        audienceType: "ALL_PARENTS_GUARDIANS",
        matchedStudentsCount: 1,
        rawContactsCount: 1,
        eligibleRecipientsCount: 1,
        missingContactsCount: 0,
        duplicateContactsRemovedCount: 0,
        excludedRecipientsCount: 0,
        optedOutRecipientsCount: 0,
        bouncedRecipientsCount: 0,
        invalidRecipientsCount: 0,
        channel: "WHATSAPP",
        page: 1,
        pageSize: 10,
        totalPages: 1,
        totalRecipients: 1,
        recipients: [
          {
            id: "guardian:contact-1",
            source: "guardian",
            studentId: "student-1",
            studentName: "Ada Lovelace",
            className: "Senior 1",
            streamName: "A",
            contactName: "Grace Hopper",
            relationship: "Mother",
            phone: "+256774549869",
            email: "grace@example.test",
            channelAvailability: { whatsapp: true, sms: true, email: true },
            selectedChannel: "WHATSAPP",
            eligibilityStatus: "ELIGIBLE",
            exclusionReason: null,
            dedupeKey: "guardian:contact-1",
            contactRole: "MOTHER",
          },
        ],
      },
    });
    vi.mocked(sendCommunication).mockResolvedValue({
      ok: true,
      result: { submitted: 1, failed: 0, skippedDuplicate: 0, dryRun: true },
    });

    render(
      <MemoryRouter>
        <CommunicationsPage />
      </MemoryRouter>,
    );

    await user.click(await screen.findByRole("button", { name: "Preview" }));
    await waitFor(() => expect(screen.getByText(/1 eligible/i)).toBeInTheDocument());
    const sendButtons = screen.getAllByRole("button", { name: "Confirm send" });
    await user.click(sendButtons.find((button) => !button.hasAttribute("disabled"))!);

    await waitFor(() => expect(screen.getByText(/Dry-run only: no provider message was sent/i)).toBeInTheDocument());
  });
});
