import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { Sidebar } from "../../components/layout/Sidebar";
import { SettingsProvider } from "../../components/layout/SettingsContext";

vi.mock("../../contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { name: "Test Admin", role: "ADMIN_OPERATOR" },
    token: "tok",
    loading: false,
    login: vi.fn(),
    logout: vi.fn(),
  }),
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
  it("shows the Report Lab workflow links", async () => {
    renderSidebar("/reports");

    await waitFor(() => expect(screen.getByText("REPORT LAB")).toBeInTheDocument());
    expect(screen.getByRole("link", { name: /dashboard/i })).toHaveAttribute("href", "/dashboard");
    expect(screen.getByRole("link", { name: /students/i })).toHaveAttribute("href", "/students");
    expect(screen.getByRole("link", { name: /marks import/i })).toHaveAttribute("href", "/imports/marks");
    expect(screen.getByRole("link", { name: /marksheets/i })).toHaveAttribute("href", "/marksheets");
    expect(screen.getByRole("link", { name: /^reports$/i })).toHaveAttribute("href", "/reports");
    expect(screen.getByRole("link", { name: /release center/i })).toHaveAttribute("href", "/reports/release");
    expect(screen.getByRole("link", { name: /academic setup/i })).toHaveAttribute("href", "/settings");
    expect(screen.queryByRole("button", { name: /report lab/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/smart pages/i)).not.toBeInTheDocument();
  });

  it("shows the Smart Pages workflow links without a fake dropdown group", async () => {
    renderSidebar("/smart-pages");

    await waitFor(() => expect(screen.getByText("SMART PAGES")).toBeInTheDocument());
    expect(screen.getByRole("link", { name: /dashboard/i })).toHaveAttribute("href", "/dashboard");
    expect(screen.getByRole("link", { name: /document history/i })).toHaveAttribute(
      "href",
      "/smart-pages",
    );
    expect(screen.getByRole("link", { name: /templates/i })).toHaveAttribute("href", "/collections");
    expect(screen.getByRole("link", { name: /^settings$/i })).toHaveAttribute("href", "/preferences");
    expect(screen.queryByRole("button", { name: /smart pages/i })).not.toBeInTheDocument();
  });

  it("hides labels when collapsed but keeps icon buttons", async () => {
    renderSidebar("/dashboard", true);

    await waitFor(() => expect(screen.getByTitle("Dashboard")).toBeInTheDocument());
    expect(screen.queryByText("Dashboard")).not.toBeInTheDocument();
    expect(screen.getByTitle("Dashboard")).toBeInTheDocument();
    expect(screen.getByLabelText("Expand sidebar")).toBeInTheDocument();
  });

  it("does not render dead hrefs", async () => {
    renderSidebar("/dashboard");

    await waitFor(() => expect(screen.getByRole("link", { name: /dashboard/i })).toBeInTheDocument());
    expect(document.querySelectorAll('a[href="#"]').length).toBe(0);
  });
});
