import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ScanUploadPanel } from "../../components/imports/ScanUploadPanel";
import {
  dryRunScanRows,
  loadScanBatch,
} from "../../client/importsClient";

vi.mock("../../client/importsClient", () => ({
  commitScanRows: vi.fn(),
  detectScanContext: vi.fn(),
  dryRunScanRows: vi.fn(),
  loadScanBatch: vi.fn(),
  lookupMarksheetContext: vi.fn(),
  uploadScanFile: vi.fn(),
}));

const context = {
  marksheetId: "MS-2026-SEN1-A-MATH-EOT-TE",
  className: "Senior 1 A",
  streamName: "A",
  subjectName: "Mathematics",
  termName: "Term 1",
  examType: "EOT",
  academicYear: "2025/2026",
};

const rows = [
  {
    rowNumber: 1,
    admissionNumber: "S1A-001",
    studentName: "Kampala Ssempebwa",
    writtenMark: "",
    splitMark: "",
    extractedMark: "",
    suggestedMark: "",
    confidence: 0,
    remarks: "",
    status: "MISSING" as const,
    validationErrors: [],
    operatorCorrection: "",
    statusReason: "Needs entry.",
    debugRawOcr: { written: "", split: "", splitZones: ["", "", ""] },
    debugCropImages: { written: "data:image/jpeg;base64,a", split: "data:image/jpeg;base64,b", splitZones: [] },
  },
];

describe("ScanUploadPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    window.history.replaceState({}, "", "/imports/marks");
  });

  it("restores current extraction and keeps review/debug visible after reload", async () => {
    sessionStorage.setItem("scan_batchId", "batch-1");
    vi.mocked(loadScanBatch).mockResolvedValue({
      batchId: "batch-1",
      scanBatchId: "batch-1",
      parseStatus: "PARSED",
      message: "Scan processed.",
      rows,
      context,
      resolvedContext: context,
      recognizedMarksheetId: null,
      normalizedMarksheetId: context.marksheetId,
      selectedMarksheetId: context.marksheetId,
      contextSource: "selected-context",
      contextWarning: "Marksheet context resolved from selected context.",
      fileName: "scan.jpg",
      configuredProvider: "paddleocr",
      activeProvider: "manual",
      providerUrl: "",
      providerReachable: false,
      fallbackReason: "OCR provider unavailable; manual entry mode.",
      createdAt: new Date().toISOString(),
    });

    render(<ScanUploadPanel />);

    expect(await screen.findByText("Operator Entry & Review")).toBeInTheDocument();
    expect(screen.getByText("Scan Batch Summary")).toBeInTheDocument();
    expect(screen.getAllByText("batch-1").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Marksheet context resolved from selected context.").length).toBeGreaterThan(0);
    expect(screen.getByText("Show extraction debug")).toBeInTheDocument();
    expect(screen.getByText("Kampala Ssempebwa")).toBeInTheDocument();
  });

  it("dry-run preserves operator corrections and does not clear rows", async () => {
    sessionStorage.setItem("scan_batchId", "batch-1");
    vi.mocked(loadScanBatch).mockResolvedValue({
      batchId: "batch-1",
      parseStatus: "PARSED",
      message: "Scan processed.",
      rows,
      context,
      resolvedContext: context,
      contextSource: "selected-context",
      contextWarning: "Marksheet context resolved from selected context.",
      fileName: "scan.jpg",
      createdAt: new Date().toISOString(),
    });
    vi.mocked(dryRunScanRows).mockResolvedValue({
      status: "DRY_RUN",
      totalRows: 1,
      validRows: 1,
      missingRows: 0,
      reviewRows: 0,
      invalidRows: 0,
      rows: [{ ...rows[0]!, status: "VALID", operatorCorrection: "" }],
    });

    render(<ScanUploadPanel />);

    const input = await screen.findByLabelText("Operator mark for Kampala Ssempebwa");
    fireEvent.change(input, { target: { value: "76" } });
    fireEvent.click(screen.getByText("Dry-run (operator review)"));

    await waitFor(() => expect(dryRunScanRows).toHaveBeenCalled());
    expect(screen.getByDisplayValue("76")).toBeInTheDocument();
    expect(screen.getByText("Kampala Ssempebwa")).toBeInTheDocument();
    expect(screen.getByText(/1 rows checked/)).toBeInTheDocument();
  });
});
