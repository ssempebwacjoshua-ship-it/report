import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GeminiScanPanel } from "../../components/imports/GeminiScanPanel";
import { commitGeminiScanRows, extractMarksWithGeminiScan, fetchScanOptions } from "../../client/importsClient";
import type { GeminiCommitResponse, GeminiScanExtractResponse, ScanOptions } from "../../shared/types/imports";

vi.mock("../../client/importsClient", () => ({
  extractMarksWithGeminiScan: vi.fn(),
  fetchScanOptions: vi.fn(),
  commitGeminiScanRows: vi.fn(),
}));

const mockExtract = vi.mocked(extractMarksWithGeminiScan);
const mockFetchOptions = vi.mocked(fetchScanOptions);
const mockCommit = vi.mocked(commitGeminiScanRows);

const OPTIONS: ScanOptions = {
  success: true,
  classes: [{ id: "class-1", name: "Senior 1", code: "S1" }],
  streams: [],
  subjects: [{ id: "subject-1", name: "Mathematics", code: "MATH" }],
  terms: [{ id: "term-1", name: "2025/2026 — Term 1", isActive: true }],
  examTypes: ["BOT", "MOT", "EOT"],
};

const RESPONSE: GeminiScanExtractResponse = {
  success: true,
  jobId: "job-xyz",
  count: 3,
  summary: {
    totalRows: 3,
    readyRows: 1,
    reviewRows: 1,
    blockedRows: 1,
    missingMarkRows: 1,
    invalidMarkRows: 0,
    unmatchedStudentRows: 1,
    duplicateStudentRows: 0,
  },
  rows: [
    {
      rowNumber: 1, extractedStudentId: "SC2026-00001", extractedStudentName: "Alice Nantongo",
      matchedStudentId: "db-1", matchedStudentName: "Alice Nantongo", mark: "82",
      confidenceScore: 0.95, status: "READY", issues: [], raw: {},
    },
    {
      rowNumber: 2, extractedStudentId: "SC2026-00094", extractedStudentName: "Faith Mukulu",
      matchedStudentId: "db-2", matchedStudentName: "Faith Mukulu", mark: "",
      confidenceScore: 0, status: "REVIEW_REQUIRED", issues: ["Missing mark"], raw: {},
    },
    {
      rowNumber: 3, extractedStudentId: "SC2026-99999", extractedStudentName: "Ghost Student",
      matchedStudentId: null, matchedStudentName: null, mark: "50",
      confidenceScore: 0, status: "BLOCKED", issues: ["Student not found in selected class/stream"], raw: {},
    },
  ],
};

// 4-row fixture: READY, missing mark, blocked, name mismatch (all with UUID-style matchedStudentIds).
const RESPONSE_WITH_MISMATCH: GeminiScanExtractResponse = {
  success: true,
  jobId: "job-mismatch",
  count: 4,
  summary: {
    totalRows: 4,
    readyRows: 1,
    reviewRows: 2,
    blockedRows: 1,
    missingMarkRows: 1,
    invalidMarkRows: 0,
    unmatchedStudentRows: 1,
    duplicateStudentRows: 0,
  },
  rows: [
    {
      rowNumber: 1, extractedStudentId: "SC2026-00001", extractedStudentName: "Alice Nantongo",
      matchedStudentId: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeee01", matchedStudentName: "Alice Nantongo",
      mark: "82", confidenceScore: 0.95, status: "READY", issues: [], raw: {},
    },
    {
      rowNumber: 2, extractedStudentId: "SC2026-00094", extractedStudentName: "Faith Mukulu",
      matchedStudentId: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeee02", matchedStudentName: "Faith Mukulu",
      mark: "", confidenceScore: 0, status: "REVIEW_REQUIRED", issues: ["Missing mark"], raw: {},
    },
    {
      rowNumber: 3, extractedStudentId: "SC2026-99999", extractedStudentName: "Ghost Student",
      matchedStudentId: null, matchedStudentName: null, mark: "50",
      confidenceScore: 0, status: "BLOCKED", issues: ["Student not found in selected class/stream"], raw: {},
    },
    {
      rowNumber: 4, extractedStudentId: "SC2026-00200", extractedStudentName: "Faith Ayebazibwe",
      matchedStudentId: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeee04", matchedStudentName: "Faith Ayebare",
      mark: "75", confidenceScore: 0.6, status: "REVIEW_REQUIRED", issues: ["Name mismatch"], raw: {},
    },
  ],
};

// All-READY response used for commit flow tests.
const RESPONSE_ALL_READY: GeminiScanExtractResponse = {
  success: true,
  jobId: "job-ready",
  count: 2,
  summary: {
    totalRows: 2,
    readyRows: 2,
    reviewRows: 0,
    blockedRows: 0,
    missingMarkRows: 0,
    invalidMarkRows: 0,
    unmatchedStudentRows: 0,
    duplicateStudentRows: 0,
  },
  rows: [
    {
      rowNumber: 1, extractedStudentId: "SC2026-00001", extractedStudentName: "Alice Nantongo",
      matchedStudentId: "aaaaaaaa-0000-0000-0000-000000000011", matchedStudentName: "Alice Nantongo",
      mark: "82", confidenceScore: 0.95, status: "READY", issues: [], raw: {},
    },
    {
      rowNumber: 2, extractedStudentId: "SC2026-00094", extractedStudentName: "Faith Mukulu",
      matchedStudentId: "aaaaaaaa-0000-0000-0000-000000000012", matchedStudentName: "Faith Mukulu",
      mark: "65", confidenceScore: 0.9, status: "READY", issues: [], raw: {},
    },
  ],
};

const COMMIT_SUCCESS: GeminiCommitResponse = {
  success: true,
  committedRows: 2,
  finalizedRows: 2,
  reportsReady: true,
  skippedRows: 0,
  batchId: "job-ready",
  message: "2 marks saved and ready for reports.",
  schoolCode: "SCU-PREVIEW",
  academicYearId: "year-1",
  classId: "class-1",
  streamId: null,
  termId: "term-1",
  subjectId: "subject-1",
  assessmentType: "BOT",
};

function renderPanel() {
  return render(
    <MemoryRouter>
      <GeminiScanPanel />
    </MemoryRouter>,
  );
}

// Waits for options to load, then fills all required fields with dropdown selections.
async function fillContextAndFile() {
  const classSelect = await screen.findByLabelText("Class");
  fireEvent.change(classSelect, { target: { value: "class-1" } });
  fireEvent.change(screen.getByLabelText("Subject"), { target: { value: "subject-1" } });
  fireEvent.change(screen.getByLabelText("Term"), { target: { value: "term-1" } });
  const file = new File(["bytes"], "marks.jpg", { type: "image/jpeg" });
  fireEvent.change(screen.getByLabelText("Marksheet image"), { target: { files: [file] } });
}

describe("GeminiScanPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchOptions.mockResolvedValue(OPTIONS);
  });

  it("disables 'Read Marksheet' until required context + image exist", async () => {
    renderPanel();
    const button = screen.getByRole("button", { name: "Read Marksheet" });
    expect(button).toBeDisabled();
    await fillContextAndFile();
    expect(button).toBeEnabled();
  });

  it("shows the loading state during extraction", async () => {
    let resolve!: (v: GeminiScanExtractResponse) => void;
    mockExtract.mockReturnValue(new Promise((r) => { resolve = r; }));
    renderPanel();
    await fillContextAndFile();
    fireEvent.click(screen.getByRole("button", { name: "Read Marksheet" }));
    expect(await screen.findByText("Extracting marks from image...")).toBeInTheDocument();
    resolve(RESPONSE);
    await waitFor(() => expect(screen.queryByText("Extracting marks from image...")).not.toBeInTheDocument());
  });

  it("renders summary cards and highlights review and missing-mark rows", async () => {
    mockExtract.mockResolvedValue(RESPONSE);
    renderPanel();
    await fillContextAndFile();
    fireEvent.click(screen.getByRole("button", { name: "Read Marksheet" }));

    expect(await screen.findByTestId("summary-totalRows")).toHaveTextContent("3");
    expect(screen.getByTestId("summary-reviewRows")).toHaveTextContent("1");
    expect(screen.getByTestId("summary-missingMarkRows")).toHaveTextContent("1");
    expect(screen.getByTestId("summary-unmatchedStudentRows")).toHaveTextContent("1");

    const reviewRow = screen.getByTestId("gemini-row-2");
    expect(reviewRow).toHaveAttribute("data-status", "REVIEW_REQUIRED");
    expect(reviewRow.className).toMatch(/amber/);
    const blockedRow = screen.getByTestId("gemini-row-3");
    expect(blockedRow.className).toMatch(/red/);

    const markInput = screen.getByLabelText("Mark for row 2") as HTMLInputElement;
    expect(markInput.className).toMatch(/border-red-400/);
  });

  it("shows a clean network error message when fetch fails", async () => {
    mockExtract.mockRejectedValueOnce(new Error("Failed to fetch"));
    renderPanel();
    await fillContextAndFile();
    fireEvent.click(screen.getByRole("button", { name: "Read Marksheet" }));
    expect(await screen.findByText(/Could not reach the extraction server/i)).toBeInTheDocument();
  });

  it("shows a clean timeout error message when the request times out", async () => {
    mockExtract.mockRejectedValueOnce(new Error("Request timeout exceeded"));
    renderPanel();
    await fillContextAndFile();
    fireEvent.click(screen.getByRole("button", { name: "Read Marksheet" }));
    expect(await screen.findByText(/took too long to process/i)).toBeInTheDocument();
  });

  it("keeps the commit button disabled while blocked/review rows exist", async () => {
    mockExtract.mockResolvedValue(RESPONSE);
    renderPanel();
    await fillContextAndFile();
    fireEvent.click(screen.getByRole("button", { name: "Read Marksheet" }));

    const commit = await screen.findByRole("button", { name: "Save Reviewed Marks" });
    expect(commit).toBeDisabled();
    fireEvent.click(screen.getByLabelText(/reviewed every flagged row/i));
    expect(commit).toBeDisabled();
  });
});

describe("GeminiScanPanel — matched student display", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchOptions.mockResolvedValue(OPTIONS);
    mockExtract.mockResolvedValue(RESPONSE_WITH_MISMATCH);
  });

  it("does not display internal UUIDs in the review table", async () => {
    renderPanel();
    await fillContextAndFile();
    fireEvent.click(screen.getByRole("button", { name: "Read Marksheet" }));
    await screen.findByTestId("gemini-row-1");
    // Internal DB UUID must not appear anywhere in the document.
    expect(screen.queryByText("aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeee01")).not.toBeInTheDocument();
    expect(screen.queryByText("aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeee04")).not.toBeInTheDocument();
  });

  it("shows matched student name and admission number in the Matched Student cell", async () => {
    renderPanel();
    await fillContextAndFile();
    fireEvent.click(screen.getByRole("button", { name: "Read Marksheet" }));
    const cell = await screen.findByTestId("matched-student-4");
    // Matched DB name for row 4
    expect(cell).toHaveTextContent("Faith Ayebare");
    // Extracted admission number displayed in the matched cell
    expect(cell).toHaveTextContent("SC2026-00200");
  });
});

describe("GeminiScanPanel — row resolution", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchOptions.mockResolvedValue(OPTIONS);
    mockExtract.mockResolvedValue(RESPONSE_WITH_MISMATCH);
  });

  async function extractAndWait() {
    renderPanel();
    await fillContextAndFile();
    fireEvent.click(screen.getByRole("button", { name: "Read Marksheet" }));
    await screen.findByTestId("gemini-row-1");
  }

  it("'Use enrolled name' sets row to READY and removes Name mismatch issue", async () => {
    await extractAndWait();
    const btn = screen.getByRole("button", { name: "Use enrolled name for row 4" });
    fireEvent.click(btn);
    await waitFor(() => {
      const row = screen.getByTestId("gemini-row-4");
      expect(row).toHaveAttribute("data-status", "READY");
    });
    // The Name mismatch chip must be gone
    expect(screen.queryByText("Name mismatch")).not.toBeInTheDocument();
    // The enrolled name must now appear as the extracted name in the row
    expect(screen.getByTestId("gemini-row-4")).toHaveTextContent("Faith Ayebare");
  });

  it("'Apply mark' with empty mark input leaves row unchanged", async () => {
    await extractAndWait();
    const markInput = screen.getByLabelText("Mark for row 2") as HTMLInputElement;
    // Ensure the input is empty
    expect(markInput.value).toBe("");
    const applyBtn = screen.getByRole("button", { name: "Apply mark for row 2" });
    fireEvent.click(applyBtn);
    // Row must still be REVIEW_REQUIRED
    expect(screen.getByTestId("gemini-row-2")).toHaveAttribute("data-status", "REVIEW_REQUIRED");
  });

  it("'Apply mark' with a valid mark resolves the row to READY", async () => {
    await extractAndWait();
    const markInput = screen.getByLabelText("Mark for row 2") as HTMLInputElement;
    fireEvent.change(markInput, { target: { value: "78" } });
    const applyBtn = screen.getByRole("button", { name: "Apply mark for row 2" });
    fireEvent.click(applyBtn);
    await waitFor(() => {
      expect(screen.getByTestId("gemini-row-2")).toHaveAttribute("data-status", "READY");
    });
    // Missing mark chip must be gone
    expect(screen.queryByText("Missing mark")).not.toBeInTheDocument();
  });

  it("'Save Reviewed Marks' is disabled until all rows are READY", async () => {
    await extractAndWait();
    const saveBtn = screen.getByRole("button", { name: "Save Reviewed Marks" });
    expect(saveBtn).toBeDisabled();
    // Tick the review-confirmed checkbox — blocked rows still prevent enabling.
    fireEvent.click(screen.getByLabelText(/reviewed every flagged row/i));
    expect(saveBtn).toBeDisabled();
  });
});

describe("GeminiScanPanel — commit flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchOptions.mockResolvedValue(OPTIONS);
    mockExtract.mockResolvedValue(RESPONSE_ALL_READY);
  });

  async function extractAllReadyAndCheck() {
    renderPanel();
    await fillContextAndFile();
    fireEvent.click(screen.getByRole("button", { name: "Read Marksheet" }));
    await screen.findByTestId("gemini-row-1");
  }

  it("enables Save Reviewed Marks only when all rows are READY and checkbox is checked", async () => {
    await extractAllReadyAndCheck();
    const saveBtn = screen.getByRole("button", { name: "Save Reviewed Marks" });
    // All rows READY but checkbox not yet ticked.
    expect(saveBtn).toBeDisabled();
    fireEvent.click(screen.getByLabelText(/reviewed every flagged row/i));
    expect(saveBtn).toBeEnabled();
  });

  it("calls commitGeminiScanRows with the jobId and reviewed rows", async () => {
    mockCommit.mockResolvedValueOnce(COMMIT_SUCCESS);
    await extractAllReadyAndCheck();
    fireEvent.click(screen.getByLabelText(/reviewed every flagged row/i));
    fireEvent.click(screen.getByRole("button", { name: "Save Reviewed Marks" }));
    await waitFor(() => expect(mockCommit).toHaveBeenCalledTimes(1));
    const [jobId, rows] = mockCommit.mock.calls[0];
    expect(jobId).toBe("job-ready");
    expect(rows).toHaveLength(2);
  });

  it("shows success message and 'Go to Reports' after successful commit", async () => {
    mockCommit.mockResolvedValueOnce(COMMIT_SUCCESS);
    await extractAllReadyAndCheck();
    fireEvent.click(screen.getByLabelText(/reviewed every flagged row/i));
    fireEvent.click(screen.getByRole("button", { name: "Save Reviewed Marks" }));
    expect(await screen.findByText(/2 marks saved and ready for reports/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go to Reports" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save Reviewed Marks" })).not.toBeInTheDocument();
  });

  it("'Go to Reports' link includes classId, termId, and assessmentType as URL params", async () => {
    mockCommit.mockResolvedValueOnce(COMMIT_SUCCESS);
    await extractAllReadyAndCheck();
    fireEvent.click(screen.getByLabelText(/reviewed every flagged row/i));
    fireEvent.click(screen.getByRole("button", { name: "Save Reviewed Marks" }));
    const link = await screen.findByRole("link", { name: "Go to Reports" });
    const href = link.getAttribute("href") ?? "";
    expect(href).toContain("schoolCode=SCU-PREVIEW");
    expect(href).toContain("classId=class-1");
    expect(href).toContain("termId=term-1");
    expect(href).toContain("assessmentType=BOT");
    expect(href).toContain("academicYearId=year-1");
  });
});
