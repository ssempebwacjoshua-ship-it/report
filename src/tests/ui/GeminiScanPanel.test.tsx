import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GeminiScanPanel } from "../../components/imports/GeminiScanPanel";
import { extractMarksWithGeminiScan, fetchScanOptions } from "../../client/importsClient";
import type { GeminiScanExtractResponse, ScanOptions } from "../../shared/types/imports";

vi.mock("../../client/importsClient", () => ({
  extractMarksWithGeminiScan: vi.fn(),
  fetchScanOptions: vi.fn(),
}));

const mockExtract = vi.mocked(extractMarksWithGeminiScan);
const mockFetchOptions = vi.mocked(fetchScanOptions);

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
    render(<GeminiScanPanel />);
    const button = screen.getByRole("button", { name: "Read Marksheet" });
    expect(button).toBeDisabled();
    await fillContextAndFile();
    expect(button).toBeEnabled();
  });

  it("shows the loading state during extraction", async () => {
    let resolve!: (v: GeminiScanExtractResponse) => void;
    mockExtract.mockReturnValue(new Promise((r) => { resolve = r; }));
    render(<GeminiScanPanel />);
    await fillContextAndFile();
    fireEvent.click(screen.getByRole("button", { name: "Read Marksheet" }));
    expect(await screen.findByText("Extracting marks from image...")).toBeInTheDocument();
    resolve(RESPONSE);
    await waitFor(() => expect(screen.queryByText("Extracting marks from image...")).not.toBeInTheDocument());
  });

  it("renders summary cards and highlights review and missing-mark rows", async () => {
    mockExtract.mockResolvedValue(RESPONSE);
    render(<GeminiScanPanel />);
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
    render(<GeminiScanPanel />);
    await fillContextAndFile();
    fireEvent.click(screen.getByRole("button", { name: "Read Marksheet" }));
    expect(await screen.findByText(/Could not reach the extraction server/i)).toBeInTheDocument();
  });

  it("shows a clean timeout error message when the request times out", async () => {
    mockExtract.mockRejectedValueOnce(new Error("Request timeout exceeded"));
    render(<GeminiScanPanel />);
    await fillContextAndFile();
    fireEvent.click(screen.getByRole("button", { name: "Read Marksheet" }));
    expect(await screen.findByText(/took too long to process/i)).toBeInTheDocument();
  });

  it("keeps the commit button disabled while blocked/review rows exist", async () => {
    mockExtract.mockResolvedValue(RESPONSE);
    render(<GeminiScanPanel />);
    await fillContextAndFile();
    fireEvent.click(screen.getByRole("button", { name: "Read Marksheet" }));

    const commit = await screen.findByRole("button", { name: "Commit after review coming next" });
    expect(commit).toBeDisabled();
    fireEvent.click(screen.getByLabelText(/reviewed every flagged row/i));
    expect(commit).toBeDisabled();
  });
});
