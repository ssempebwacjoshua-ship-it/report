import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DocumentEditorPage } from "../../pages/smart-pages/DocumentEditorPage";

const documentIntelligenceMocks = vi.hoisted(() => ({
  getDocument: vi.fn(),
  generateSchema: vi.fn(),
  applyPrompt: vi.fn(),
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

describe("Lawyer Smart Pages editor", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    documentIntelligenceMocks.getVersionHistory.mockResolvedValue([]);
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
});

