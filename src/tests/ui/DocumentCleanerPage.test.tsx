import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DocumentCleanerPage } from "../../pages/DocumentCleanerPage";

vi.mock("../../client/documentCleanerClient", () => ({
  uploadDocument: vi.fn(),
  generatePdfHtml: vi.fn(),
}));

import { generatePdfHtml, uploadDocument } from "../../client/documentCleanerClient";

const mockUpload = uploadDocument as ReturnType<typeof vi.fn>;
const mockGenerate = generatePdfHtml as ReturnType<typeof vi.fn>;

const mockDraft = {
  draftId: "draft-001",
  imagePreviewUrl: "data:image/png;base64,abc",
  document: {
    documentType: "table" as const,
    title: "LIST OF EXAMINERS 2026",
    schoolName: "NALYA SS",
    academicYear: "2026",
    term: "TERM 1",
    columns: ["NO", "TEACHER'S NAME", "SUBJECT", "LEVEL"],
    rows: [
      { cells: ["1", "NAKOTTA LAWRENCE", "Physics", "A Level"], confidence: 0.92 },
      { cells: ["2", "NAKAZZI SARAH", "Mathematics", "O Level"], confidence: 0.55 },
    ],
    uncertainCells: [
      { rowIndex: 1, columnIndex: 1, reason: "low handwriting confidence" },
    ],
  },
};

function renderPage() {
  return render(
    <MemoryRouter>
      <DocumentCleanerPage />
    </MemoryRouter>,
  );
}

describe("DocumentCleanerPage — initial state", () => {
  beforeEach(() => {
    mockUpload.mockReset();
    mockGenerate.mockReset();
  });

  it("renders the page heading", () => {
    renderPage();
    expect(screen.getByRole("heading", { name: /document cleaner|paper.to.pdf/i })).toBeInTheDocument();
  });

  it("shows an upload area on initial load", () => {
    renderPage();
    // Should have either a file input or drag-and-drop area
    const fileInput = document.querySelector("input[type='file']");
    const uploadArea = screen.queryByText(/upload|drag|drop|choose/i);
    expect(fileInput ?? uploadArea).not.toBeNull();
  });

  it("does not show editable table before upload", () => {
    renderPage();
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("does not show Generate PDF button before upload", () => {
    renderPage();
    const btn = screen.queryByRole("button", { name: /generate.*pdf|download.*pdf/i });
    expect(btn).toBeNull();
  });
});

describe("DocumentCleanerPage — after successful upload", () => {
  beforeEach(() => {
    mockUpload.mockReset();
    mockGenerate.mockReset();
    mockUpload.mockResolvedValue(mockDraft);
  });

  async function uploadFakeFile() {
    renderPage();
    const fileInput = document.querySelector("input[type='file']") as HTMLInputElement;
    const file = new File(["fake-png"], "doc.png", { type: "image/png" });
    fireEvent.change(fileInput, { target: { files: [file] } });
    await waitFor(() => expect(mockUpload).toHaveBeenCalled());
  }

  it("shows the editable table after upload", async () => {
    await uploadFakeFile();
    await waitFor(() => expect(screen.getByRole("table")).toBeInTheDocument());
  });

  it("shows column headers from extracted document", async () => {
    await uploadFakeFile();
    await waitFor(() => {
      expect(screen.getByText(/teacher'?s name/i)).toBeInTheDocument();
    });
  });

  it("renders row data in the editable table", async () => {
    await uploadFakeFile();
    await waitFor(() => {
      expect(screen.getByText(/nakotta/i)).toBeInTheDocument();
    });
  });

  it("highlights uncertain cells for review", async () => {
    await uploadFakeFile();
    await waitFor(() => {
      // Low-confidence row (rowIndex 1) should show a warning indicator
      const warning = document.querySelector("[data-uncertain]") ??
        document.querySelector(".uncertain") ??
        screen.queryByTitle(/review|uncertain|low confidence/i);
      expect(warning).not.toBeNull();
    });
  });

  it("shows Generate PDF button after extraction", async () => {
    await uploadFakeFile();
    await waitFor(() => {
      const btn = screen.queryByRole("button", { name: /generate.*pdf|download.*pdf|generate clean/i });
      expect(btn).not.toBeNull();
    });
  });

  it("shows image preview after upload", async () => {
    await uploadFakeFile();
    await waitFor(() => {
      const img = screen.queryByRole("img");
      expect(img).not.toBeNull();
    });
  });
});

describe("DocumentCleanerPage — editable fields", () => {
  beforeEach(() => {
    mockUpload.mockResolvedValue(mockDraft);
  });

  async function uploadAndWait() {
    renderPage();
    const fileInput = document.querySelector("input[type='file']") as HTMLInputElement;
    const file = new File(["fake-png"], "doc.png", { type: "image/png" });
    fireEvent.change(fileInput, { target: { files: [file] } });
    await waitFor(() => screen.getByRole("table"));
  }

  it("allows editing the document title", async () => {
    await uploadAndWait();
    const titleInput = screen.getByDisplayValue(/list of examiners/i);
    fireEvent.change(titleInput, { target: { value: "UPDATED TITLE" } });
    expect((titleInput as HTMLInputElement).value).toBe("UPDATED TITLE");
  });
});
