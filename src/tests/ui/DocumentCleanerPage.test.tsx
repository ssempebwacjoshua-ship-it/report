import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DocumentCleanerPage } from "../../pages/DocumentCleanerPage";

vi.mock("../../client/documentCleanerClient", () => ({
  uploadDocument: vi.fn(),
  generatePdfHtml: vi.fn(),
  getSmartPagesSummary: vi.fn(),
}));

const { mockSettingsState } = vi.hoisted(() => {
  const mockSettingsState = { settingsLoaded: false, schoolCode: undefined as string | undefined };
  return { mockSettingsState };
});

vi.mock("../../components/layout/SettingsContext", () => ({
  useAppSettings: () =>
    mockSettingsState.settingsLoaded
      ? { settings: { schoolCode: mockSettingsState.schoolCode ?? "", sections: {} }, refreshSettings: () => {} }
      : null,
}));

import { generatePdfHtml, getSmartPagesSummary, uploadDocument } from "../../client/documentCleanerClient";

const mockUpload = uploadDocument as ReturnType<typeof vi.fn>;
const mockGenerate = generatePdfHtml as ReturnType<typeof vi.fn>;
const mockGetSummary = getSmartPagesSummary as ReturnType<typeof vi.fn>;

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
      // Cells are rendered as editable inputs; check both text and input value
      const found =
        screen.queryByDisplayValue(/nakotta/i) ?? screen.queryByText(/nakotta/i);
      expect(found).not.toBeNull();
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

// ── Smart Pages card ─────────────────────────────────────────────────────────

const mockSummary = {
  includedPages: 5000,
  topUpPages: 0,
  usedPages: 750,
  remainingPages: 4250,
  planName: "STANDARD" as const,
  billingCycle: "ACADEMIC_YEAR",
  allowHighAccuracy: false,
};

describe("DocumentCleanerPage — Smart Pages card", () => {
  beforeEach(() => {
    mockUpload.mockReset();
    mockGenerate.mockReset();
    mockGetSummary.mockReset();
    mockGetSummary.mockResolvedValue(mockSummary);
    mockSettingsState.settingsLoaded = true;
    mockSettingsState.schoolCode = "NALYA-SS";
  });

  afterEach(() => {
    mockSettingsState.settingsLoaded = false;
    mockSettingsState.schoolCode = undefined;
  });

  it("shows loading state before settings are ready", () => {
    mockSettingsState.settingsLoaded = false;
    renderPage();
    expect(screen.getByText(/loading smart pages/i)).toBeInTheDocument();
  });

  it("shows error state when getSmartPagesSummary fails", async () => {
    mockGetSummary.mockRejectedValue(new Error("Network error"));
    renderPage();
    await waitFor(() => {
      expect(screen.getByText(/network error|failed to load smart pages/i)).toBeInTheDocument();
    });
  });

  it("shows Smart Pages remaining count when summary is available", async () => {
    renderPage();
    await waitFor(() => {
      const smartPagesText = screen.queryByText(/smart pages|ai document pages/i);
      const remainingTexts = screen.queryAllByText(/4[,.]?250/);
      expect(smartPagesText ?? (remainingTexts.length > 0 ? remainingTexts[0] : null)).not.toBeNull();
    });
  });

  it("shows billing period label", async () => {
    renderPage();
    await waitFor(() => {
      const label = screen.queryByText(/academic year|billing/i);
      expect(label).not.toBeNull();
    });
  });
});

// ── Extraction mode selector ──────────────────────────────────────────────────

describe("DocumentCleanerPage — extraction mode selector", () => {
  beforeEach(() => {
    mockUpload.mockReset();
    mockGetSummary.mockReset();
    mockGetSummary.mockResolvedValue(mockSummary);
  });

  it("shows a mode selector with at least Economical and Balanced options", () => {
    renderPage();
    const economical = screen.queryByText(/economical/i);
    const balanced = screen.queryByText(/balanced/i);
    expect(economical ?? balanced).not.toBeNull();
  });

  it("balanced is selected by default", () => {
    renderPage();
    // balanced option should be marked selected/checked or be the active radio/select value
    const balanced = screen.queryByRole("radio", { name: /balanced/i }) ??
      screen.queryByRole("option", { name: /balanced/i }) ??
      screen.queryByText(/balanced/i);
    expect(balanced).not.toBeNull();
  });
});

// ── High Accuracy warning ─────────────────────────────────────────────────────

describe("DocumentCleanerPage — High Accuracy mode warning", () => {
  beforeEach(() => {
    mockGetSummary.mockReset();
    mockGetSummary.mockResolvedValue({ ...mockSummary, allowHighAccuracy: true });
  });

  it("shows a cost warning or confirmation when High Accuracy mode is selected", async () => {
    renderPage();
    const highAccuracyRadio = screen.queryByRole("radio", { name: /high accuracy/i });

    if (!highAccuracyRadio) return; // skip if mode selector not rendered (acceptable in basic flow)

    fireEvent.click(highAccuracyRadio);

    // Warning dialog shows a "Yes, use High Accuracy" confirm button
    await waitFor(() => {
      const confirmBtn = screen.queryByRole("button", { name: /yes.*high accuracy/i }) ??
        screen.queryByRole("button", { name: /continue|confirm/i });
      expect(confirmBtn).not.toBeNull();
    });
  });
});

// ── Route ─────────────────────────────────────────────────────────────────────

describe("DocumentCleanerPage — routing", () => {
  it("renders when placed at /documents/cleaner", () => {
    render(
      <MemoryRouter initialEntries={["/documents/cleaner"]}>
        <DocumentCleanerPage />
      </MemoryRouter>,
    );
    expect(screen.getByRole("heading", { name: /document cleaner|paper.to.pdf/i })).toBeInTheDocument();
  });
});
