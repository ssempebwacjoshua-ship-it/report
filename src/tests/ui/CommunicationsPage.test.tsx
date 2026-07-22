import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CommunicationsPage } from "../../pages/CommunicationsPage";

const authState = {
  user: { id: "user-1", schoolId: "school-1", name: "Admin", email: "admin@example.test", role: "ADMIN_OPERATOR" as const },
};

vi.mock("../../contexts/AuthContext", () => ({
  useAuth: () => authState,
}));

vi.mock("../../client/communicationsClient", () => ({
  fetchCommunicationCampaigns: vi.fn(),
  fetchCommunicationTemplates: vi.fn(),
  createCommunicationCampaign: vi.fn(),
  previewCommunicationRecipients: vi.fn(),
  requestCommunicationCampaignApproval: vi.fn(),
  approveCommunicationCampaign: vi.fn(),
  saveCommunicationTemplate: vi.fn(),
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

import {
  approveCommunicationCampaign,
  createCommunicationCampaign,
  fetchCommunicationCampaigns,
  fetchCommunicationTemplates,
  previewCommunicationRecipients,
  requestCommunicationCampaignApproval,
  saveCommunicationTemplate,
  sendCommunication,
} from "../../client/communicationsClient";
import { fetchReportContext } from "../../client/reportsClient";
import { fetchStudents } from "../../client/studentsClient";
import { fetchStaffUsers } from "../../client/staffUsersClient";

function buildCampaign(status: string) {
  return {
    id: "campaign-1",
    title: "Parent Notice",
    type: "ANNOUNCEMENT",
    status,
    priority: "NORMAL",
    contentVersion: 1,
    createdAt: "2026-07-01T00:00:00.000Z",
    updatedAt: "2026-07-01T00:00:00.000Z",
    _count: { recipients: 3, deliveries: 0 },
    contents: [{ subject: "Notice", body: "Hello parents", shortBody: null }],
  };
}

function buildTemplate() {
  return {
    id: "template-1",
    channel: "SMS" as const,
    communicationType: "ANNOUNCEMENT",
    name: "sms-announcement-default",
    providerTemplateName: null,
    providerTemplateId: null,
    languageCode: "en",
    status: "APPROVED" as const,
    content: "Hello {{guardianName}}, {{schoolName}}: {{communicationTitle}}. {{message}}",
    variables: ["guardianName", "schoolName", "communicationTitle", "message"],
    createdAt: "2026-07-01T00:00:00.000Z",
    updatedAt: "2026-07-01T00:00:00.000Z",
  };
}

function buildPreview(eligibleRecipientsCount: number, channel: "WHATSAPP" | "SMS" = "WHATSAPP") {
  return {
    preview: {
      audienceType: "ALL_PARENTS_GUARDIANS",
      matchedStudentsCount: 3,
      rawContactsCount: 3,
      eligibleRecipientsCount,
      missingContactsCount: 0,
      duplicateContactsRemovedCount: 0,
      excludedRecipientsCount: Math.max(0, 3 - eligibleRecipientsCount),
      optedOutRecipientsCount: 0,
      bouncedRecipientsCount: 0,
      invalidRecipientsCount: 0,
      channel,
      page: 1,
      pageSize: 10,
      totalPages: 1,
      totalRecipients: 3,
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
          phone: "0774549869",
          email: "grace@example.test",
          channelAvailability: { whatsapp: true, sms: true, email: true },
          selectedChannel: channel,
          eligibilityStatus: eligibleRecipientsCount > 0 ? "ELIGIBLE" : "MISSING_PHONE",
          exclusionReason: eligibleRecipientsCount > 0 ? null : "Missing phone number.",
          dedupeKey: "guardian:contact-1",
          contactRole: "MOTHER",
        },
      ],
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  authState.user = { id: "user-1", schoolId: "school-1", name: "Admin", email: "admin@example.test", role: "ADMIN_OPERATOR" };
  vi.stubGlobal("confirm", vi.fn(() => true));
  vi.mocked(fetchCommunicationCampaigns).mockResolvedValue({
    campaigns: [buildCampaign("DRAFT")],
    summary: [{ status: "DRAFT", _count: { status: 1 } }],
  });
  vi.mocked(fetchCommunicationTemplates).mockResolvedValue({ templates: [] });
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
  vi.mocked(previewCommunicationRecipients).mockResolvedValue(buildPreview(1));
  vi.mocked(sendCommunication).mockResolvedValue({ ok: true, result: { submitted: 1, failed: 0, skippedDuplicate: 0 } });
  vi.mocked(requestCommunicationCampaignApproval).mockResolvedValue({
    ok: true,
    duplicate: false,
    campaign: buildCampaign("APPROVAL_PENDING"),
    validation: {
      channel: "WHATSAPP",
      recipientCount: 3,
      validRecipientCount: 1,
      invalidRecipientCount: 2,
      segmentCount: 0,
      estimatedBillableUnits: 1,
      estimatedProviderCostMinor: null,
      estimatedProviderCostCurrency: null,
      estimatedProviderCostNote: "Channel pricing varies by provider configuration.",
    },
  });
  vi.mocked(approveCommunicationCampaign).mockResolvedValue({ ok: true });
  vi.mocked(createCommunicationCampaign).mockResolvedValue({
    campaign: buildCampaign("DRAFT"),
  });
  vi.mocked(saveCommunicationTemplate).mockResolvedValue({ template: buildTemplate() });
});

describe("CommunicationsPage", () => {
  it("renders the audience controls and disables send when the campaign is not approved", async () => {
    render(
      <MemoryRouter>
        <CommunicationsPage />
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByText("Audience")).toBeInTheDocument());
    await waitFor(() => expect(screen.getByText("Preview recipients")).toBeInTheDocument());
    const buttons = screen.getAllByRole("button", { name: "Confirm send" });
    expect(buttons[0]).toBeDisabled();
  });

  it("shows Approve only for approval-pending campaigns and approved users, then refreshes after approval", async () => {
    vi.mocked(fetchCommunicationCampaigns)
      .mockResolvedValueOnce({
        campaigns: [buildCampaign("APPROVAL_PENDING")],
        summary: [{ status: "APPROVAL_PENDING", _count: { status: 1 } }],
      })
      .mockResolvedValueOnce({
        campaigns: [buildCampaign("APPROVED")],
        summary: [{ status: "APPROVED", _count: { status: 1 } }],
      });

    render(
      <MemoryRouter>
        <CommunicationsPage />
      </MemoryRouter>,
    );

    const approveButton = await screen.findByRole("button", { name: "Approve" });
    fireEvent.click(approveButton);

    await waitFor(() => expect(approveCommunicationCampaign).toHaveBeenCalledWith("campaign-1"));
    const confirmMessage = vi.mocked(confirm).mock.calls[0]?.[0];
    expect(confirmMessage).toContain("Recipient count: 3");
    expect(confirmMessage).toContain("Segment count: 1");
    expect(confirmMessage).toContain("Estimated cost:");
    await waitFor(() => expect(fetchCommunicationCampaigns).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.getByText("Campaign approved: Parent Notice")).toBeInTheDocument());
  });

  it("shows Submit for approval for drafts and refreshes after submission", async () => {
    vi.mocked(fetchCommunicationCampaigns)
      .mockResolvedValueOnce({
        campaigns: [buildCampaign("DRAFT")],
        summary: [{ status: "DRAFT", _count: { status: 1 } }],
      })
      .mockResolvedValueOnce({
        campaigns: [buildCampaign("APPROVAL_PENDING")],
        summary: [{ status: "APPROVAL_PENDING", _count: { status: 1 } }],
      });

    render(
      <MemoryRouter>
        <CommunicationsPage />
      </MemoryRouter>,
    );

    const submitButton = await screen.findByRole("button", { name: "Submit for approval" });
    fireEvent.click(submitButton);

    await waitFor(() => expect(requestCommunicationCampaignApproval).toHaveBeenCalledWith("campaign-1"));
    const confirmMessage = vi.mocked(confirm).mock.calls[0]?.[0];
    expect(confirmMessage).toContain("Recipient count: 3");
    expect(confirmMessage).toContain("Estimated cost:");
    await waitFor(() => expect(fetchCommunicationCampaigns).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.getByText("Campaign submitted for approval: Parent Notice (1 valid recipient)")).toBeInTheDocument());
  });

  it("prevents duplicate approval submissions while approval is in flight", async () => {
    vi.mocked(fetchCommunicationCampaigns).mockResolvedValue({
      campaigns: [buildCampaign("APPROVAL_PENDING")],
      summary: [{ status: "APPROVAL_PENDING", _count: { status: 1 } }],
    });
    let resolveApproval: ((value: { ok: true }) => void) | undefined;
    vi.mocked(approveCommunicationCampaign).mockImplementation(() => new Promise((resolve) => {
      resolveApproval = resolve;
    }));

    render(
      <MemoryRouter>
        <CommunicationsPage />
      </MemoryRouter>,
    );

    const approveButton = await screen.findByRole("button", { name: "Approve" });
    fireEvent.click(approveButton);

    await waitFor(() => expect(screen.getByRole("button", { name: "Approving..." })).toBeDisabled());
    expect(screen.queryByRole("button", { name: "Approve" })).not.toBeInTheDocument();
    resolveApproval?.({ ok: true });
    await waitFor(() => expect(approveCommunicationCampaign).toHaveBeenCalledTimes(1));
  });

  it("prevents duplicate submit-for-approval actions while submission is in flight", async () => {
    let resolveSubmit: ((value: Awaited<ReturnType<typeof requestCommunicationCampaignApproval>>) => void) | undefined;
    vi.mocked(requestCommunicationCampaignApproval).mockImplementation(() => new Promise((resolve) => {
      resolveSubmit = resolve;
    }));

    render(
      <MemoryRouter>
        <CommunicationsPage />
      </MemoryRouter>,
    );

    const submitButton = await screen.findByRole("button", { name: "Submit for approval" });
    fireEvent.click(submitButton);

    await waitFor(() => expect(screen.getByRole("button", { name: "Submitting..." })).toBeDisabled());
    resolveSubmit?.({
      ok: true,
      duplicate: false,
      campaign: buildCampaign("APPROVAL_PENDING"),
      validation: {
        channel: "WHATSAPP",
        recipientCount: 3,
        validRecipientCount: 1,
        invalidRecipientCount: 2,
        segmentCount: 0,
        estimatedBillableUnits: 1,
        estimatedProviderCostMinor: null,
        estimatedProviderCostCurrency: null,
        estimatedProviderCostNote: "Channel pricing varies by provider configuration.",
      },
    });
    await waitFor(() => expect(requestCommunicationCampaignApproval).toHaveBeenCalledTimes(1));
  });

  it("hides Approve when the current user lacks communications.approve", async () => {
    authState.user = { id: "user-2", schoolId: "school-1", name: "Teacher", email: "teacher@example.test", role: "TEACHER" };
    vi.mocked(fetchCommunicationCampaigns).mockResolvedValue({
      campaigns: [buildCampaign("APPROVAL_PENDING")],
      summary: [{ status: "APPROVAL_PENDING", _count: { status: 1 } }],
    });

    render(
      <MemoryRouter>
        <CommunicationsPage />
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByText("Parent Notice")).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: "Approve" })).not.toBeInTheDocument();
  });

  it("shows backend-safe approval errors with request references", async () => {
    vi.mocked(fetchCommunicationCampaigns).mockResolvedValue({
      campaigns: [buildCampaign("APPROVAL_PENDING")],
      summary: [{ status: "APPROVAL_PENDING", _count: { status: 1 } }],
    });
    vi.mocked(approveCommunicationCampaign).mockRejectedValue(new Error("Approval failed (ref: req-approve-1)"));

    render(
      <MemoryRouter>
        <CommunicationsPage />
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByRole("button", { name: "Approve" }));

    await waitFor(() => expect(screen.getByText("Approval failed (ref: req-approve-1)")).toBeInTheDocument());
  });

  it("shows a Templates tab to admins and saves the default SMS announcement template", async () => {
    vi.mocked(fetchCommunicationTemplates)
      .mockResolvedValueOnce({ templates: [] })
      .mockResolvedValueOnce({ templates: [buildTemplate()] });

    render(
      <MemoryRouter>
        <CommunicationsPage />
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByRole("button", { name: "Templates" }));
    await waitFor(() => expect(screen.getByText("Set default SMS template")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Save template" }));

    await waitFor(() => expect(saveCommunicationTemplate).toHaveBeenCalledWith(expect.objectContaining({
      channel: "SMS",
      communicationType: "ANNOUNCEMENT",
      name: "sms-announcement-default",
      status: "APPROVED",
      content: "Hello {{guardianName}}, {{schoolName}}: {{communicationTitle}}. {{message}}",
    })));
    await waitFor(() => expect(screen.getByText("Template saved: SMS + ANNOUNCEMENT")).toBeInTheDocument());
    await waitFor(() => expect(screen.getByText("sms-announcement-default")).toBeInTheDocument());
  });

  it("hides template management from users without communications.templates.manage", async () => {
    authState.user = { id: "user-2", schoolId: "school-1", name: "Teacher", email: "teacher@example.test", role: "TEACHER" };

    render(
      <MemoryRouter>
        <CommunicationsPage />
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByText("Audience")).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: "Templates" })).not.toBeInTheDocument();
    expect(fetchCommunicationTemplates).not.toHaveBeenCalled();
  });

  it("turns missing approved template send errors into a Templates tab action", async () => {
    vi.mocked(fetchCommunicationCampaigns).mockResolvedValue({
      campaigns: [buildCampaign("APPROVED")],
      summary: [{ status: "APPROVED", _count: { status: 1 } }],
    });
    vi.mocked(sendCommunication).mockRejectedValue(new Error("An approved communication template is required before live sending."));

    render(
      <MemoryRouter>
        <CommunicationsPage />
      </MemoryRouter>,
    );

    fireEvent.change(await screen.findByLabelText("Channel"), { target: { value: "SMS" } });
    let sendButton: HTMLElement | undefined;
    await waitFor(() => {
      const sendButtons = screen.getAllByRole("button", { name: "Confirm send" });
      sendButton = sendButtons.find((button) => !button.hasAttribute("disabled"));
      expect(sendButton).toBeDefined();
    });
    if (!sendButton) throw new Error("Expected an enabled Confirm send button.");
    fireEvent.click(sendButton);

    await waitFor(() => expect(screen.getByText("Missing approved template for SMS + ANNOUNCEMENT. Open Templates tab and approve one.")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Open Templates" }));
    await waitFor(() => expect(screen.getByText("Set default SMS template")).toBeInTheDocument());
  });

  it("shows normal send completion copy without a dry-run banner after a communication send", async () => {
    const user = userEvent.setup();
    vi.mocked(fetchCommunicationCampaigns)
      .mockResolvedValueOnce({
        campaigns: [buildCampaign("APPROVED")],
        summary: [{ status: "APPROVED", _count: { status: 1 } }],
      })
      .mockResolvedValueOnce({
        campaigns: [buildCampaign("SENDING")],
        summary: [{ status: "SENDING", _count: { status: 1 } }],
      });
    vi.mocked(previewCommunicationRecipients).mockResolvedValue(buildPreview(1));
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
    const sendButton = sendButtons.find((button) => !button.hasAttribute("disabled"));
    expect(sendButton).toBeDefined();
    if (!sendButton) {
      throw new Error("Expected an enabled Confirm send button.");
    }
    await user.click(sendButton);

    await waitFor(() => expect(screen.getByText("Submitted 1; failed 0; duplicates skipped 0.")).toBeInTheDocument());
    expect(screen.queryByText(/Dry-run only: no provider message was sent/i)).not.toBeInTheDocument();
  });

  it("reaches approved send flow end-to-end with mocked client actions", async () => {
    vi.mocked(fetchCommunicationCampaigns)
      .mockResolvedValueOnce({
        campaigns: [buildCampaign("DRAFT")],
        summary: [{ status: "DRAFT", _count: { status: 1 } }],
      })
      .mockResolvedValueOnce({
        campaigns: [buildCampaign("APPROVAL_PENDING")],
        summary: [{ status: "APPROVAL_PENDING", _count: { status: 1 } }],
      })
      .mockResolvedValueOnce({
        campaigns: [buildCampaign("APPROVED")],
        summary: [{ status: "APPROVED", _count: { status: 1 } }],
      })
      .mockResolvedValueOnce({
        campaigns: [buildCampaign("SENDING")],
        summary: [{ status: "SENDING", _count: { status: 1 } }],
      });

    render(
      <MemoryRouter>
        <CommunicationsPage />
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByRole("button", { name: "Submit for approval" }));
    await waitFor(() => expect(requestCommunicationCampaignApproval).toHaveBeenCalledWith("campaign-1"));

    fireEvent.click(await screen.findByRole("button", { name: "Approve" }));
    await waitFor(() => expect(approveCommunicationCampaign).toHaveBeenCalledWith("campaign-1"));

    fireEvent.click((await screen.findAllByRole("button", { name: "Preview" }))[0]);
    const sendButtons = await screen.findAllByRole("button", { name: "Confirm send" });
    const sendButton = sendButtons.find((button) => !button.hasAttribute("disabled"));
    expect(sendButton).toBeDefined();
    if (!sendButton) {
      throw new Error("Expected an enabled Confirm send button.");
    }
    fireEvent.click(sendButton);

    await waitFor(() => expect(sendCommunication).toHaveBeenCalledWith("campaign-1", expect.objectContaining({
      channel: "SMS",
      confirm: true,
    })));
    await waitFor(() => expect(screen.getByText("Submitted 1; failed 0; duplicates skipped 0.")).toBeInTheDocument());
  });
});
