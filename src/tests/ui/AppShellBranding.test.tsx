import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { Sidebar } from "../../components/layout/Sidebar";
import { SettingsProvider } from "../../components/layout/SettingsContext";

vi.mock("../../contexts/AuthContext", () => ({
  useAuth: () => ({ user: { name: "Test Admin", role: "ADMIN_OPERATOR" }, token: "tok", loading: false, login: vi.fn(), logout: vi.fn() }),
}));

vi.mock("../../client/settingsClient", () => ({
  fetchSettings: vi.fn().mockResolvedValue({
    schoolCode: "SCU-PREVIEW",
    sections: {
      school: {
        schoolName: "Green Valley School",
        schoolCode: "GVS",
        address: "",
        phone: "",
        email: "",
        website: "",
        headTeacherName: "Head Teacher",
        reportFooterText: "",
        marksheetFooterText: "",
        logoUrl: "",
      },
      academic: {
        activeAcademicYear: "",
        activeTerm: "",
        defaultAssessmentType: "EOT",
        supportedAssessmentTypes: ["BOT", "MOT", "EOT", "TERM_SUMMARY"],
        termStartDate: "",
        termEndDate: "",
      },
      reports: {
        showOverallPosition: false,
        showClassAverage: true,
        showGradeKey: true,
        showSchoolLogo: true,
        printDensity: "standard",
        signatureMode: "name_and_signature_line",
        defaultHmCommentTemplate: "",
        defaultClassTeacherCommentTemplate: "",
      },
      marksheets: {
        printStyle: "rich_black",
        includeQrCode: true,
        includeHumanReadableMarksheetId: true,
        validMarkValues: "0-100, AB, EX",
        blankMeans: "missing",
        onePageTarget: true,
        repeatTableHeaderOnContinuationPages: true,
        signaturesOnlyOnFinalPage: true,
      },
      ocr: {
        provider: "manual",
        paddleOcrUrl: "http://127.0.0.1:8003",
        awsRegion: "us-east-1",
        debugMode: false,
        minimumConfidenceForSuggestion: 0.7,
        useSplitMarkAsPrimarySource: true,
        useWrittenMarkAsConfirmation: true,
        ocrRemarks: false,
        acceptOcrSuggestionsAutomatically: false,
        requireOperatorReviewBeforeCommit: true,
      },
      grading: {
        grades: [],
      },
      approval: {
        requireDryRunBeforeCommit: true,
        protectCommittedMarksFromEditing: true,
        requireHmFinalizationBeforeReportPrintRelease: false,
        allowHmToEditComments: true,
        allowHmToEditRawMarks: false,
        reopenFinalizedReportsRequiresReason: true,
        keepAuditTrail: true,
      },
      appearance: {
        appDensity: "comfortable",
        sidebarWidth: "standard",
        printStyle: "rich_black",
        fontSize: "standard",
      },
    },
    updatedAt: null,
    updatedBy: null,
  }),
}));

function renderShell() {
  return render(
    <MemoryRouter>
      <SettingsProvider>
        <Sidebar open onClose={() => {}} collapsed={false} onToggleCollapsed={() => {}} width={248} />
      </SettingsProvider>
    </MemoryRouter>,
  );
}

describe("App shell branding", () => {
  it("renders the saved school name in the sidebar without the topbar branding", async () => {
    renderShell();

    await waitFor(() => expect(screen.getAllByText("Green Valley School").length).toBeGreaterThan(0));
    expect(screen.queryByText("Uganda High School")).not.toBeInTheDocument();
    expect(screen.queryByText("UHS")).not.toBeInTheDocument();
  });
});
