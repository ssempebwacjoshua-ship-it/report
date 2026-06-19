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

vi.mock("../../client/documentIntelligenceClient", () => documentIntelligenceMocks);

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/smart-pages/doc-1"]}>
      <Routes>
        <Route path="/smart-pages/:id" element={<DocumentEditorPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

const extractedKnowledge = {
  documentType: "report",
  domain: "school",
  title: "Sample Smart Page",
  suggestedDocumentType: "report",
  sections: [{ heading: "Intro", content: "Hello world" }],
  tables: [],
  statistics: [],
  entities: [],
  people: [],
  dates: [],
  handwrittenNotes: [],
  keyFacts: [],
  unclearItems: [],
  rawText: "Hello world",
};

describe("DocumentEditorPage ? Smart Pages flow", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    documentIntelligenceMocks.getVersionHistory.mockResolvedValue([]);
  });

  it("keeps generate single-shot and refreshes versions after generation", async () => {
    const gen = deferred<{ versionId: string; schema: { theme: { primaryColor: string } }; componentTree: unknown[] }>();

    documentIntelligenceMocks.getDocument
      .mockResolvedValueOnce({
        id: "doc-1",
        title: "Sample Smart Page",
        status: "DRAFT",
        extractionStatus: "READY",
        extractionError: null,
        domain: "school",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        versionCount: 0,
        hasSourceFiles: true,
        extractedKnowledge,
        activeVersion: null,
        latestSourceFile: { id: "source-1", status: "READY" },
      })
      .mockResolvedValueOnce({
        id: "doc-1",
        title: "Sample Smart Page",
        status: "DRAFT",
        extractionStatus: "READY",
        extractionError: null,
        domain: "school",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        versionCount: 1,
        hasSourceFiles: true,
        extractedKnowledge,
        activeVersion: {
          id: "version-1",
          instruction: "Generate a professional document from the reviewed extraction. Preserve all tables and key facts.",
          schema: { theme: { primaryColor: "#2563eb" }, components: [] },
          componentTree: [],
          renderSettings: {},
          createdAt: new Date().toISOString(),
        },
        latestSourceFile: { id: "source-1", status: "READY" },
      });

    documentIntelligenceMocks.generateSchema.mockReturnValue(gen.promise);

    renderPage();

    const generateButton = await screen.findByRole("button", { name: /generate document from extraction/i });
    fireEvent.click(generateButton);
    fireEvent.click(generateButton);

    expect(documentIntelligenceMocks.generateSchema).toHaveBeenCalledTimes(1);

    gen.resolve({
      versionId: "version-1",
      schema: { theme: { primaryColor: "#2563eb" } },
      componentTree: [],
    });

    await waitFor(() => expect(screen.getByText(/done! your document is ready/i)).toBeInTheDocument());
    expect(documentIntelligenceMocks.getVersionHistory).toHaveBeenCalledTimes(1);
  });

  it("uses applyPrompt when an active version already exists", async () => {
    documentIntelligenceMocks.getDocument.mockResolvedValue({
      id: "doc-1",
      title: "Sample Smart Page",
      status: "DRAFT",
      extractionStatus: "READY",
      extractionError: null,
      domain: "school",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      versionCount: 1,
      hasSourceFiles: true,
      extractedKnowledge,
      activeVersion: {
        id: "version-1",
        instruction: "Initial",
        schema: { theme: { primaryColor: "#2563eb" }, components: [] },
        componentTree: [],
        renderSettings: {},
        createdAt: new Date().toISOString(),
      },
      latestSourceFile: { id: "source-1", status: "READY" },
    });
    documentIntelligenceMocks.applyPrompt.mockResolvedValue({
      versionId: "version-2",
      schema: { theme: { primaryColor: "#2563eb" } },
      componentTree: [],
    });

    renderPage();

    await waitFor(() => expect(screen.getAllByRole("button", { name: /show actions/i }).length).toBeGreaterThan(0));
    fireEvent.click(screen.getAllByRole("button", { name: /show actions/i })[0]);
    const promptInput = screen.getByPlaceholderText(/edit the document/i);
    fireEvent.change(promptInput, { target: { value: "Make it more formal" } });
    fireEvent.keyDown(promptInput, { key: "Enter", code: "Enter" });

    await waitFor(() => expect(documentIntelligenceMocks.applyPrompt).toHaveBeenCalledWith("doc-1", "Make it more formal"));
    expect(documentIntelligenceMocks.generateSchema).not.toHaveBeenCalled();
  });

  it.each([
    [
      "Clean & Rebuild Document",
      "Recreate the parsed school document as a clean professional document",
    ],
    [
      "Extract to Table",
      "Convert the parsed rows, lists, and tables into structured table data",
    ],
    [
      "Letter to Parents",
      "Turn the parsed notes or instructions into a letter to parents or guardians",
    ],
  ])("uses the %s template and sends the right generation prompt", async (buttonName, promptFragment) => {
    documentIntelligenceMocks.getDocument
      .mockResolvedValueOnce({
        id: "doc-1",
        title: "Sample Smart Page",
        status: "DRAFT",
        extractionStatus: "READY",
        extractionError: null,
        domain: "school",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        versionCount: 0,
        hasSourceFiles: true,
        extractedKnowledge,
        activeVersion: null,
        latestSourceFile: { id: "source-1", status: "READY" },
      })
      .mockResolvedValueOnce({
        id: "doc-1",
        title: "Sample Smart Page",
        status: "DRAFT",
        extractionStatus: "READY",
        extractionError: null,
        domain: "school",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        versionCount: 1,
        hasSourceFiles: true,
        extractedKnowledge,
        activeVersion: {
          id: "version-1",
          instruction: promptFragment,
          schema: { theme: { primaryColor: "#2563eb" }, components: [] },
          componentTree: [],
          renderSettings: {},
          createdAt: new Date().toISOString(),
        },
        latestSourceFile: { id: "source-1", status: "READY" },
      });
    documentIntelligenceMocks.generateSchema.mockResolvedValue({
      versionId: "version-1",
      schema: { theme: { primaryColor: "#2563eb" }, components: [] },
      componentTree: [],
    });

    renderPage();

    await waitFor(() => expect(screen.getByText(/what would you like to create/i)).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: buttonName }));

    await waitFor(() => expect(documentIntelligenceMocks.generateSchema).toHaveBeenCalledTimes(1));
    expect(documentIntelligenceMocks.generateSchema.mock.calls[0][1]).toContain(promptFragment);
    await waitFor(() => expect(screen.getByText(/done! your document is ready/i)).toBeInTheDocument());
  });

  it("does not render lawyer or legal template names in the school Smart Pages picker", async () => {
    documentIntelligenceMocks.getDocument.mockResolvedValue({
      id: "doc-1",
      title: "Sample Smart Page",
      status: "DRAFT",
      extractionStatus: "READY",
      extractionError: null,
      domain: "school",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      versionCount: 0,
      hasSourceFiles: true,
      extractedKnowledge,
      activeVersion: null,
      latestSourceFile: { id: "source-1", status: "READY" },
    });

    renderPage();

    await waitFor(() => expect(screen.getByText(/what would you like to create/i)).toBeInTheDocument());
    expect(screen.queryByText(/legal notice/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/affidavit/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/contract/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/client intake/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/case brief/i)).not.toBeInTheDocument();
  });

  it("hides publish and print actions until a version exists", async () => {
    documentIntelligenceMocks.getDocument.mockResolvedValue({
      id: "doc-1",
      title: "Sample Smart Page",
      status: "DRAFT",
      extractionStatus: "READY",
      extractionError: null,
      domain: "school",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      versionCount: 0,
      hasSourceFiles: true,
      extractedKnowledge,
      activeVersion: null,
      latestSourceFile: { id: "source-1", status: "READY" },
    });

    renderPage();

    await waitFor(() => expect(screen.getByText(/generate document from extraction/i)).toBeInTheDocument());
    expect(screen.getAllByRole("button", { name: /show actions/i }).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /publish secure link/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /^print$/i })).toBeDisabled();
  });

  it("shows export actions and starts the requested download for active smart pages", async () => {
    documentIntelligenceMocks.getDocument.mockResolvedValue({
      id: "doc-1",
      title: "Sample Smart Page",
      status: "DRAFT",
      extractionStatus: "READY",
      extractionError: null,
      domain: "school",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      versionCount: 1,
      hasSourceFiles: true,
      extractedKnowledge,
      activeVersion: {
        id: "version-1",
        instruction: "Generate a professional document from the reviewed extraction. Preserve all tables and key facts.",
        schema: { theme: { primaryColor: "#2563eb" }, components: [] },
        componentTree: [],
        renderSettings: {},
        createdAt: new Date().toISOString(),
      },
      latestSourceFile: { id: "source-1", status: "READY" },
    });
    documentIntelligenceMocks.downloadDocumentExport.mockResolvedValue(undefined);

    renderPage();

    await waitFor(() => expect(screen.getAllByRole("button", { name: /show actions/i }).length).toBeGreaterThan(0));
    fireEvent.click(screen.getAllByRole("button", { name: /show actions/i })[0]);

    expect(screen.getAllByRole("button", { name: /^print$/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: /download pdf/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: /download docx/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: /export markdown/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: /export schema/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: /publish secure link/i }).length).toBeGreaterThan(0);

    fireEvent.click(screen.getAllByRole("button", { name: /download pdf/i })[0]);

    await waitFor(() => expect(documentIntelligenceMocks.downloadDocumentExport).toHaveBeenCalledWith("doc-1", "pdf"));
  });

  it("shows a visible print error in chat", async () => {
    documentIntelligenceMocks.getDocument.mockResolvedValue({
      id: "doc-1",
      title: "Sample Smart Page",
      status: "DRAFT",
      extractionStatus: "READY",
      extractionError: null,
      domain: "school",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      versionCount: 1,
      hasSourceFiles: true,
      extractedKnowledge,
      activeVersion: {
        id: "version-1",
        instruction: "Generate a professional document from the reviewed extraction. Preserve all tables and key facts.",
        schema: { theme: { primaryColor: "#2563eb" }, components: [] },
        componentTree: [],
        renderSettings: {},
        createdAt: new Date().toISOString(),
      },
      latestSourceFile: { id: "source-1", status: "READY" },
    });
    documentIntelligenceMocks.openPrintWindow.mockRejectedValue(new Error("Print window was blocked by the browser. Please allow pop-ups and try again."));

    renderPage();

    await waitFor(() => expect(screen.getAllByRole("button", { name: /show actions/i }).length).toBeGreaterThan(0));
    fireEvent.click(screen.getAllByRole("button", { name: /show actions/i })[0]);
    const printButton = screen.getAllByRole("button", { name: /^print$/i }).at(-1);
    expect(printButton).toBeTruthy();
    fireEvent.click(printButton!);

    await waitFor(() => expect(screen.getByText(/print window was blocked/i)).toBeInTheDocument());
  });

  it("offers a high-accuracy retry when extraction confidence is low", async () => {
    documentIntelligenceMocks.getDocument.mockResolvedValue({
      id: "doc-1",
      title: "Sample Smart Page",
      status: "DRAFT",
      extractionStatus: "READY",
      extractionError: null,
      domain: "school",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      versionCount: 0,
      hasSourceFiles: true,
      extractedKnowledge: {
        ...extractedKnowledge,
        confidence: 0.32,
        handwritingDifficulty: "high",
        needsReview: true,
        recommendedNextStep: "high_accuracy_retry",
        reviewWarning: "Some handwriting was difficult to read. Review the extracted text or try high accuracy extraction.",
      },
      activeVersion: null,
      latestSourceFile: { id: "source-1", status: "READY" },
    });
    documentIntelligenceMocks.retryDocumentExtraction.mockResolvedValue({ sourceFileId: "source-1", status: "PROCESSING" });

    renderPage();

    await waitFor(() => expect(screen.getByText(/some handwriting was difficult to read/i)).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /re-extract with high accuracy/i }));

    await waitFor(() => expect(documentIntelligenceMocks.retryDocumentExtraction).toHaveBeenCalledWith("doc-1", "source-1", { highAccuracy: true }));
  });

  it("publishes once and exposes the token clearly", async () => {
    const publish = deferred<{ token: string; url: string }>();

    documentIntelligenceMocks.getDocument.mockResolvedValue({
      id: "doc-1",
      title: "Sample Smart Page",
      status: "DRAFT",
      extractionStatus: "READY",
      extractionError: null,
      domain: "school",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      versionCount: 1,
      hasSourceFiles: true,
      extractedKnowledge,
      activeVersion: {
        id: "version-1",
        instruction: "Generate a professional document from the reviewed extraction. Preserve all tables and key facts.",
        schema: { theme: { primaryColor: "#2563eb" }, components: [] },
        componentTree: [],
        renderSettings: {},
        createdAt: new Date().toISOString(),
      },
      latestSourceFile: { id: "source-1", status: "READY" },
    });
    documentIntelligenceMocks.publishDocument.mockReturnValue(publish.promise);
    documentIntelligenceMocks.getVersionHistory.mockResolvedValue([{ id: "version-1", instruction: "Initial", parentId: null, createdAt: new Date().toISOString() }]);

    renderPage();

    await waitFor(() => expect(screen.getAllByRole("button", { name: /show actions/i }).length).toBeGreaterThan(0));
    fireEvent.click(screen.getAllByRole("button", { name: /show actions/i })[0]);
    const publishMenuButton = screen.getAllByRole("button", { name: /publish secure link/i }).at(-1);
    expect(publishMenuButton).toBeTruthy();
    fireEvent.click(publishMenuButton!);

    const publishButton = await waitFor(() => screen.getByRole("button", { name: /^publish$/i }));
    expect(publishButton).toBeTruthy();
    fireEvent.click(publishButton!);
    fireEvent.click(publishButton!);

    expect(documentIntelligenceMocks.publishDocument).toHaveBeenCalledTimes(1);

    publish.resolve({ token: "tok-1234", url: "https://example.com/p/tok-1234" });

    await waitFor(() => expect(screen.getAllByText(/token: tok-1234/i).length).toBeGreaterThan(0));
    expect(screen.getAllByText("https://example.com/p/tok-1234").length).toBeGreaterThan(0);
  });
});

