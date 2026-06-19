import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, RouterProvider, createMemoryRouter } from "react-router-dom";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LawyerShell } from "../../components/lawyers/LawyerShell";
import { DocumentEditorPage } from "../../pages/smart-pages/DocumentEditorPage";

const documentIntelligenceMocks = vi.hoisted(() => ({
  getDocument: vi.fn(),
  generateSchema: vi.fn(),
  applyPrompt: vi.fn(),
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
    user: { name: "Lawyer User" },
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
    documentOsMocks.listPreferences.mockResolvedValue([
      { id: "pref-1", key: "lawyer.firm", value: { name: "Acacia Legal", contact: "+256 700 000000" }, updatedAt: new Date().toISOString() },
      { id: "pref-2", key: "lawyer.profile", value: { name: "Jane Lawyer", location: "Kampala" }, updatedAt: new Date().toISOString() },
    ]);
  });

  it("shows lawyer templates and sends a legal prompt from the selected template", async () => {
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
    documentIntelligenceMocks.generateSchema.mockResolvedValue({ versionId: "version-1", schema: { theme: { primaryColor: "#2563eb" }, components: [] }, componentTree: [] });

    render(
      <MemoryRouter initialEntries={["/lawyers/documents/doc-1"]}>
        <Routes>
          <Route path="/lawyers/documents/:id" element={<DocumentEditorPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByText(/what would you like to create from this legal material/i)).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /legal notice \/ demand letter/i }));

    await waitFor(() => expect(documentIntelligenceMocks.generateSchema).toHaveBeenCalledTimes(1));
    expect(documentIntelligenceMocks.generateSchema.mock.calls[0][1]).toContain("Template ID: legal-notice-demand-letter");
    expect(documentIntelligenceMocks.generateSchema.mock.calls[0][1]).toContain("Acacia Legal");
  });

  it("auto-generates a first lawyer draft when opened from a template query", async () => {
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
          <Route path="/lawyers/documents/:id" element={<DocumentEditorPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => expect(documentIntelligenceMocks.generateSchema).toHaveBeenCalledTimes(1));
    expect(documentIntelligenceMocks.generateSchema.mock.calls[0][1]).toContain("Template ID: legal-notice-demand-letter");
    expect(documentIntelligenceMocks.generateSchema.mock.calls[0][1]).toContain("Template Name: Legal Notice / Demand Letter");
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
          <Route path="/lawyers/documents/:id" element={<DocumentEditorPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getAllByText(/ai generation is not configured in this environment/i).length).toBeGreaterThan(0));
    expect(screen.queryByText(/GEMINI_API_KEY is not configured/i)).not.toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: /manual document draft/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /generate legal draft/i })).toBeDisabled();
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
          <Route path="/lawyers/documents/:id" element={<DocumentEditorPage />} />
        </Routes>
      </MemoryRouter>,
    );

    const draft = await screen.findByRole("textbox", { name: /manual document draft/i });
    expect((draft as HTMLTextAreaElement).value).toContain("Template: Legal Notice / Demand Letter");
    expect((draft as HTMLTextAreaElement).value).toContain("Parties:");
    expect(screen.queryByText(/Generating\.\.\./i)).not.toBeInTheDocument();
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
          { path: "documents/:id", element: <DocumentEditorPage /> },
        ],
      },
    ], { initialEntries: ["/lawyers/documents/doc-5"] });

    const user = userEvent.setup();
    render(<RouterProvider router={router} />);

    await waitFor(() => expect(screen.getByRole("textbox", { name: /manual document draft/i })).toBeInTheDocument());
    await user.click(screen.getAllByRole("button", { name: /show actions/i })[0]);
    await user.click(screen.getByRole("button", { name: /make it more formal/i }));

    await waitFor(() => expect(documentIntelligenceMocks.requestLawyerDocumentEditPlan).toHaveBeenCalledWith(
      "doc-5",
      "Make it more formal",
      expect.stringContaining("Client wants a demand letter."),
    ));
    await waitFor(() => expect(screen.getByText(/applied 1 change/i)).toBeInTheDocument());
    expect(screen.queryByText(/GEMINI_API_KEY is not configured/i)).not.toBeInTheDocument();
  });
});

