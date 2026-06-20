import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, RouterProvider, createMemoryRouter } from "react-router-dom";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LawyerShell } from "../../components/lawyers/LawyerShell";
import { LawyerDocumentEditorPage } from "../../pages/lawyers/LawyerDocumentEditorPage";

const documentIntelligenceMocks = vi.hoisted(() => ({
  getDocument: vi.fn(),
  generateSchema: vi.fn(),
  applyPrompt: vi.fn(),
  createManualDocumentVersion: vi.fn(),
  requestLawyerDocumentEditPlan: vi.fn(),
  getVersionHistory: vi.fn(),
  updateExtractedKnowledge: vi.fn(),
  publishDocument: vi.fn(),
  downloadDocumentExport: vi.fn(),
  openPrintWindow: vi.fn(),
  retryDocumentExtraction: vi.fn(),
  restoreVersion: vi.fn(),
  uploadDocumentFile: vi.fn(),
}));

const documentOsMocks = vi.hoisted(() => ({
  listPreferences: vi.fn(),
}));

vi.mock("../../client/documentIntelligenceClient", () => documentIntelligenceMocks);
vi.mock("../../client/documentOsClient", () => documentOsMocks);
vi.mock("../../contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { name: "School Admin" },
    token: "token",
    loading: false,
    logout: vi.fn(),
  }),
}));

describe("Lawyer Smart Pages editor", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    documentIntelligenceMocks.getVersionHistory.mockResolvedValue([]);
    documentIntelligenceMocks.requestLawyerDocumentEditPlan.mockResolvedValue({
      summary: "Made the draft more professional.",
      operations: [
        { type: "replace_text", oldText: "Client wants a demand letter.", newText: "Client requests a formal demand letter." },
      ],
      warnings: [],
    });
    documentIntelligenceMocks.updateExtractedKnowledge.mockResolvedValue({
      documentType: "legal draft",
      domain: "legal",
      title: "Demand letter draft",
      suggestedDocumentType: "legal draft",
      sections: [{ heading: "Draft text", content: "Muwanga & Co. Advocates" }],
      tables: [],
      statistics: [],
      entities: [],
      people: [],
      dates: [],
      handwrittenNotes: [],
      keyFacts: ["Muwanga & Co. Advocates"],
      unclearItems: [],
      rawText: "Muwanga & Co. Advocates",
      confidence: 1,
      handwritingDifficulty: "low",
      needsReview: true,
      recommendedNextStep: "review",
    });
    documentIntelligenceMocks.createManualDocumentVersion.mockResolvedValue({
      versionId: "version-manual",
      schema: { theme: { primaryColor: "#007FFF" }, components: [] },
      componentTree: [],
    });
    documentOsMocks.listPreferences.mockResolvedValue([
      { id: "pref-1", key: "lawyer.firm", value: { name: "Acacia Legal", contact: "+256 700 000000" }, updatedAt: new Date().toISOString() },
      { id: "pref-2", key: "lawyer.profile", value: { name: "Jane Lawyer", location: "Kampala" }, updatedAt: new Date().toISOString() },
    ]);
  });

  it("calls listPreferences with authMode creator to use sp_creator_token exclusively", async () => {
    documentIntelligenceMocks.getDocument.mockResolvedValue({
      id: "doc-pref",
      title: "Pref test doc",
      status: "DRAFT",
      extractionStatus: "PENDING",
      extractionError: null,
      domain: "legal",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      versionCount: 0,
      hasSourceFiles: false,
      extractedKnowledge: null,
      activeVersion: null,
      latestSourceFile: null,
    });

    render(
      <MemoryRouter initialEntries={["/lawyers/documents/doc-pref"]}>
        <Routes>
          <Route path="/lawyers/documents/:id" element={<LawyerDocumentEditorPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() =>
      expect(documentOsMocks.listPreferences).toHaveBeenCalledWith("lawyer", { authMode: "creator" }),
    );
  });

  it("shows a starter lawyer draft when a template is opened", async () => {
    documentIntelligenceMocks.getDocument.mockResolvedValue({
      id: "doc-1",
      title: "Client notes",
      status: "DRAFT",
      extractionStatus: "READY",
      extractionError: null,
      domain: "legal",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      versionCount: 0,
      hasSourceFiles: true,
      extractedKnowledge: {
        documentType: "legal note",
        domain: "legal",
        title: "Client notes",
        suggestedDocumentType: "legal note",
        sections: [{ heading: "Facts", content: "Client wants a demand letter." }],
        tables: [],
        statistics: [],
        entities: [],
        people: [],
        dates: [],
        handwrittenNotes: [],
        keyFacts: [],
        unclearItems: [],
        rawText: "Client wants a demand letter.",
      },
      activeVersion: null,
      latestSourceFile: { id: "source-1", status: "READY" },
    });
    render(
      <MemoryRouter initialEntries={["/lawyers/documents/doc-1?template=legal-notice-demand-letter"]}>
        <Routes>
          <Route path="/lawyers/documents/:id" element={<LawyerDocumentEditorPage />} />
        </Routes>
      </MemoryRouter>,
    );

    const draft = await screen.findByRole("textbox", { name: /manual document draft/i });
    expect((draft as HTMLTextAreaElement).value).toContain("Muwanga & Co. Advocates");
    expect((draft as HTMLTextAreaElement).value).toContain("Pearl Office Supplies Ltd");
    expect((draft as HTMLTextAreaElement).value).toContain("Kato Builders Ltd");
    expect((draft as HTMLTextAreaElement).value).toContain("UGX 12,500,000");
    expect((draft as HTMLTextAreaElement).value).toContain("7 days");
    expect((draft as HTMLTextAreaElement).value).toContain("Counsel Daniel Muwanga");
    expect(documentIntelligenceMocks.generateSchema).not.toHaveBeenCalled();
  });

  it("opens a first lawyer draft from a template query without requiring Gemini", async () => {
    documentIntelligenceMocks.getDocument.mockResolvedValue({
      id: "doc-2",
      title: "Template draft",
      status: "DRAFT",
      extractionStatus: "PENDING",
      extractionError: null,
      domain: "legal",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      versionCount: 0,
      hasSourceFiles: false,
      extractedKnowledge: null,
      activeVersion: null,
      latestSourceFile: null,
    });
    documentIntelligenceMocks.generateSchema.mockResolvedValue({ versionId: "version-2", schema: { theme: { primaryColor: "#2563eb" }, components: [] }, componentTree: [] });

    render(
      <MemoryRouter initialEntries={["/lawyers/documents/doc-2?template=legal-notice-demand-letter"]}>
        <Routes>
          <Route path="/lawyers/documents/:id" element={<LawyerDocumentEditorPage />} />
        </Routes>
      </MemoryRouter>,
    );

    const draft = await screen.findByRole("textbox", { name: /manual document draft/i });
    expect((draft as HTMLTextAreaElement).value).toContain("Muwanga & Co. Advocates");
    expect((draft as HTMLTextAreaElement).value).toContain("Re: Legal Notice / Demand Letter");
    expect((draft as HTMLTextAreaElement).value).toContain("Pearl Office Supplies Ltd");
    expect(documentIntelligenceMocks.generateSchema).not.toHaveBeenCalled();
  });

  it("shows a manual draft workspace and a friendly AI notice when Gemini is unavailable", async () => {
    documentIntelligenceMocks.getDocument.mockResolvedValue({
      id: "doc-3",
      title: "Offline draft",
      status: "DRAFT",
      extractionStatus: "FAILED",
      extractionError: "GEMINI_API_KEY is not configured.",
      domain: "legal",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      versionCount: 0,
      hasSourceFiles: true,
      extractedKnowledge: null,
      activeVersion: null,
      latestSourceFile: { id: "source-3", status: "FAILED", extractionError: "GEMINI_API_KEY is not configured." },
    });

    render(
      <MemoryRouter initialEntries={["/lawyers/documents/doc-3"]}>
        <Routes>
          <Route path="/lawyers/documents/:id" element={<LawyerDocumentEditorPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getAllByText(/ai actions are disabled because gemini is not configured in this environment/i).length).toBeGreaterThan(0));
    expect(screen.queryByText(/GEMINI_API_KEY is not configured/i)).not.toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: /manual document draft/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /create draft/i })).toBeEnabled();
    expect(screen.queryByText(/school admin/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Generating\.\.\./i)).not.toBeInTheDocument();
  });

  it("seeds a lawyer template outline when Gemini is unavailable", async () => {
    documentIntelligenceMocks.getDocument.mockResolvedValue({
      id: "doc-4",
      title: "Demand letter draft",
      status: "DRAFT",
      extractionStatus: "PENDING",
      extractionError: null,
      domain: "legal",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      versionCount: 0,
      hasSourceFiles: false,
      extractedKnowledge: null,
      activeVersion: null,
      latestSourceFile: null,
    });
    documentIntelligenceMocks.generateSchema.mockRejectedValue(new Error("GEMINI_API_KEY is not configured."));
    documentIntelligenceMocks.applyPrompt.mockRejectedValue(new Error("GEMINI_API_KEY is not configured."));

    render(
      <MemoryRouter initialEntries={["/lawyers/documents/doc-4?template=legal-notice-demand-letter"]}>
        <Routes>
          <Route path="/lawyers/documents/:id" element={<LawyerDocumentEditorPage />} />
        </Routes>
      </MemoryRouter>,
    );

    const draft = await screen.findByRole("textbox", { name: /manual document draft/i });
    expect((draft as HTMLTextAreaElement).value).toContain("Parties:");
    expect((draft as HTMLTextAreaElement).value).toContain("Muwanga & Co. Advocates");
    expect(screen.queryByText(/Generating\.\.\./i)).not.toBeInTheDocument();
  });

  it("creates an active lawyer version without Gemini when Create draft is pressed", async () => {
    documentIntelligenceMocks.getDocument
      .mockResolvedValueOnce({
        id: "doc-6",
        title: "Demand letter draft",
        status: "DRAFT",
        extractionStatus: "PENDING",
        extractionError: null,
        domain: "legal",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        versionCount: 0,
        hasSourceFiles: false,
        extractedKnowledge: null,
        activeVersion: null,
        latestSourceFile: null,
      })
      .mockResolvedValueOnce({
        id: "doc-6",
        title: "Demand letter draft",
        status: "DRAFT",
        extractionStatus: "READY",
        extractionError: null,
        domain: "legal",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        versionCount: 0,
        hasSourceFiles: false,
        extractedKnowledge: {
          documentType: "legal draft",
          domain: "legal",
          title: "Demand letter draft",
          suggestedDocumentType: "legal draft",
          sections: [{ heading: "Draft text", content: "Muwanga & Co. Advocates" }],
          tables: [],
          statistics: [],
          entities: [],
          people: [],
          dates: [],
          handwrittenNotes: [],
          keyFacts: ["Muwanga & Co. Advocates"],
          unclearItems: [],
          rawText: "Muwanga & Co. Advocates",
          confidence: 1,
          handwritingDifficulty: "low",
          needsReview: true,
          recommendedNextStep: "review",
        },
        activeVersion: null,
        latestSourceFile: null,
      })
      .mockResolvedValueOnce({
        id: "doc-6",
        title: "Demand letter draft",
        status: "DRAFT",
        extractionStatus: "READY",
        extractionError: null,
        domain: "legal",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        versionCount: 1,
        hasSourceFiles: false,
        extractedKnowledge: {
          documentType: "legal draft",
          domain: "legal",
          title: "Demand letter draft",
          suggestedDocumentType: "legal draft",
          sections: [{ heading: "Draft text", content: "Muwanga & Co. Advocates" }],
          tables: [],
          statistics: [],
          entities: [],
          people: [],
          dates: [],
          handwrittenNotes: [],
          keyFacts: ["Muwanga & Co. Advocates"],
          unclearItems: [],
          rawText: "Muwanga & Co. Advocates",
          confidence: 1,
          handwritingDifficulty: "low",
          needsReview: true,
          recommendedNextStep: "review",
        },
        activeVersion: {
          id: "version-manual",
          instruction: "Manual lawyer draft",
          schema: { theme: { primaryColor: "#007FFF", fontFamily: "Inter", pageSize: "A4", orientation: "PORTRAIT" }, components: [] },
          componentTree: [],
          createdAt: new Date().toISOString(),
        },
        latestSourceFile: null,
      });

    render(
      <MemoryRouter initialEntries={["/lawyers/documents/doc-6?template=legal-notice-demand-letter"]}>
        <Routes>
          <Route path="/lawyers/documents/:id" element={<LawyerDocumentEditorPage />} />
        </Routes>
      </MemoryRouter>,
    );

    const draft = await screen.findByRole("textbox", { name: /manual document draft/i });
    await userEvent.click(screen.getByRole("button", { name: /create draft/i }));

    await waitFor(() => expect(documentIntelligenceMocks.createManualDocumentVersion).toHaveBeenCalledWith(
      "doc-6",
      expect.objectContaining({
        draft: expect.stringContaining("Muwanga & Co. Advocates"),
        title: "Demand letter draft",
      }),
      { authMode: "creator" },
    ));
    await waitFor(() => expect(screen.getByRole("button", { name: /print/i })).toBeEnabled());
    await waitFor(() => expect(screen.getAllByRole("button", { name: /publish secure link/i })[0]).toBeEnabled());
    expect((draft as HTMLTextAreaElement).value).toContain("Muwanga & Co. Advocates");
    expect(screen.queryByText(/GEMINI_API_KEY is not configured/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/School Admin/i)).not.toBeInTheDocument();
  });

  it("applies lawyer smart actions only after real document patches are produced", async () => {
    documentIntelligenceMocks.getDocument.mockResolvedValue({
      id: "doc-5",
      title: "Client notes",
      status: "DRAFT",
      extractionStatus: "READY",
      extractionError: null,
      domain: "legal",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      versionCount: 1,
      hasSourceFiles: true,
      extractedKnowledge: {
        documentType: "legal note",
        domain: "legal",
        title: "Client notes",
        suggestedDocumentType: "legal note",
        sections: [{ heading: "Facts", content: "Client wants a demand letter." }],
        tables: [],
        statistics: [],
        entities: [],
        people: [],
        dates: [],
        handwrittenNotes: [],
        keyFacts: [],
        unclearItems: [],
        rawText: "Client wants a demand letter.",
      },
      activeVersion: {
        id: "version-1",
        instruction: "Initial version",
        schema: { theme: { primaryColor: "#2563eb", fontFamily: "system-ui", pageSize: "A4", orientation: "PORTRAIT" }, components: [] },
        componentTree: [],
        createdAt: new Date().toISOString(),
      },
      latestSourceFile: { id: "source-1", status: "READY" },
    });
    documentIntelligenceMocks.updateExtractedKnowledge.mockResolvedValue({
      documentType: "document",
      domain: "legal",
      title: "Client notes",
      suggestedDocumentType: "document",
      sections: [{ heading: "Manual text", content: "Client requests a formal demand letter." }],
      tables: [],
      statistics: [],
      entities: [],
      unclearItems: [],
      rawText: "Client requests a formal demand letter.",
    });

    const router = createMemoryRouter([
      {
        path: "/lawyers",
        element: <LawyerShell />,
        children: [
          { path: "documents/:id", element: <LawyerDocumentEditorPage /> },
        ],
      },
    ], { initialEntries: ["/lawyers/documents/doc-5"] });

    const user = userEvent.setup();
    render(<RouterProvider router={router} />);

    await waitFor(() => expect(screen.getByRole("textbox", { name: /manual document draft/i })).toBeInTheDocument());
    await user.click(screen.getAllByRole("button", { name: /show actions/i })[0]);
    await user.click(screen.getByRole("button", { name: /restructure the draft/i }));

    await waitFor(() => expect(documentIntelligenceMocks.requestLawyerDocumentEditPlan).toHaveBeenCalledWith(
      "doc-5",
      "Restructure the draft",
      expect.stringContaining("Client wants a demand letter."),
    ));
    await waitFor(() => expect(screen.getByText(/applied 1 edit/i)).toBeInTheDocument());
    expect(screen.queryByText(/GEMINI_API_KEY is not configured/i)).not.toBeInTheDocument();
  });
});

