import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { Sidebar } from "../../components/layout/Sidebar";
import { SettingsProvider } from "../../components/layout/SettingsContext";

vi.mock("../../contexts/AuthContext", () => ({
  useAuth: () => ({ user: { name: "Test Admin", role: "ADMIN_OPERATOR" }, token: "tok", loading: false, login: vi.fn(), logout: vi.fn() }),
}));

vi.mock("../../client/settingsClient", () => ({
  fetchSettings: vi.fn().mockResolvedValue({
    schoolCode: "GVS",
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
      grading: { grades: [] },
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

function renderSidebar(pathname = "/dashboard", collapsed = false) {
  return render(
    <MemoryRouter initialEntries={[pathname]}>
      <SettingsProvider>
        <Sidebar open onClose={() => {}} collapsed={collapsed} onToggleCollapsed={() => {}} width={248} />
      </SettingsProvider>
    </MemoryRouter>,
  );
}

describe("Sidebar navigation", () => {
  it("renders nav links and active state for the current route", async () => {
    renderSidebar("/reports");

    await waitFor(() => expect(screen.getByRole("button", { name: "Report Lab" })).toBeInTheDocument());
    expect(screen.getByText("Reports").closest("a")).toHaveClass("bg-white/12");
    expect(screen.getByText("Students").closest("a")).toHaveAttribute("href", "/students");
    expect(screen.getByText("Preferences / Academic Setup").closest("a")).toHaveAttribute("href", "/settings");
  });

  it("keeps Smart Pages grouped and opens it for smart pages routes", async () => {
    renderSidebar("/analytics");

    await waitFor(() => expect(screen.getByRole("button", { name: "Smart Pages" })).toBeInTheDocument());
    expect(screen.getByText("Analytics").closest("a")).toHaveClass("bg-white/12");
    expect(screen.getByText("Paper to PDF").closest("a")).toHaveAttribute("href", "/documents/cleaner");
  });

  it("hides labels when collapsed but keeps icon buttons", async () => {
    renderSidebar("/dashboard", true);

    await waitFor(() => expect(screen.getByTitle("Dashboard")).toBeInTheDocument());
    expect(screen.queryByText("Dashboard")).not.toBeInTheDocument();
    expect(screen.getByTitle("Dashboard")).toBeInTheDocument();
    expect(screen.getByLabelText("Expand sidebar")).toBeInTheDocument();
  });

  it("has a Paper to PDF nav link pointing to /documents/cleaner", async () => {
    renderSidebar("/documents/cleaner");
    await waitFor(() => expect(screen.getByText("Paper to PDF")).toBeInTheDocument());
    expect(screen.getByText("Paper to PDF").closest("a")).toHaveAttribute("href", "/documents/cleaner");
  });
});
