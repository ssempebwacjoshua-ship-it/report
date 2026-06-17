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

describe("DocumentEditorPage — Smart Pages flow", () => {
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

    await waitFor(() => expect(screen.getByRole("button", { name: /preview/i })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /preview/i }));
    const generateButton = screen.getByRole("button", { name: /looks good, generate document/i });
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

    await waitFor(() => expect(screen.getByRole("button", { name: /actions/i })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /actions/i }));
    const printButton = screen.getAllByRole("button", { name: /print \/ pdf/i }).at(-1);
    expect(printButton).toBeTruthy();
    fireEvent.click(printButton!);

    await waitFor(() => expect(screen.getByText(/print window was blocked/i)).toBeInTheDocument());
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

    await waitFor(() => expect(screen.getByRole("button", { name: /actions/i })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /actions/i }));
    const publishMenuButton = screen.getAllByRole("button", { name: /^publish$/i }).at(-1);
    expect(publishMenuButton).toBeTruthy();
    fireEvent.click(publishMenuButton!);

    const publishButton = await waitFor(() => screen.getAllByRole("button", { name: /^publish$/i }).at(-1));
    expect(publishButton).toBeTruthy();
    fireEvent.click(publishButton!);
    fireEvent.click(publishButton!);

    expect(documentIntelligenceMocks.publishDocument).toHaveBeenCalledTimes(1);

    publish.resolve({ token: "tok-1234", url: "https://example.com/p/tok-1234" });

    await waitFor(() => expect(screen.getAllByText(/token: tok-1234/i)).toHaveLength(3));
    expect(screen.getAllByText("https://example.com/p/tok-1234")).toHaveLength(2);
  });
});
