import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ScanUploadPanel } from "../../components/imports/ScanUploadPanel";
import {
  detectScanContext,
  dryRunScanRows,
  loadScanBatch,
  uploadScanFile,
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

const sheetIdMessage = "Could not read the marksheet ID from the top-right corner. Please upload a clearer image or enter the sheet ID manually.";
const removedProviderPattern = new RegExp(["paddle" + "ocr", "tesser" + "act", "tex" + "tract", "google" + "vision", "fallback"].join("|"), "i");

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
      configuredProvider: "azure",
      activeProvider: "azure",
      providerReachable: true,
      fallbackReason: "",
      createdAt: new Date().toISOString(),
    });

    render(<ScanUploadPanel />);

    expect(await screen.findByText("Operator Entry & Review")).toBeInTheDocument();
    expect(screen.getByText("Scan Batch Summary")).toBeInTheDocument();
    expect(screen.getAllByText("batch-1").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Marksheet context resolved from selected context.").length).toBeGreaterThan(0);
    expect(screen.getByText("Show extraction debug")).toBeInTheDocument();
    expect(screen.getByText("Kampala Ssempebwa")).toBeInTheDocument();
    expect(screen.getAllByText(/Azure OCR|Azure/).length).toBeGreaterThan(0);
    expect(screen.queryByText(removedProviderPattern)).not.toBeInTheDocument();
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
    expect(await screen.findByText(/1 rows checked/)).toBeInTheDocument();
  });

  it("shows scan debug for failed extraction with no rows", async () => {
    sessionStorage.setItem("scan_batchId", "batch-failed");
    vi.mocked(loadScanBatch).mockResolvedValue({
      batchId: "batch-failed",
      scanBatchId: "batch-failed",
      parseStatus: "FAILED",
      message: "No active students found for class \"Senior 1 A\" stream \"B\".",
      rows: [],
      context: { ...context, streamName: "B" },
      resolvedContext: { ...context, streamName: "B" },
      recognizedMarksheetId: "MS-2026-SENI-B-MATH-EOT-TE",
      normalizedRecognizedId: "MS-2026-SEN1-B-MATH-EOT-TE",
      normalizedMarksheetId: "MS-2026-SEN1-B-MATH-EOT-TE",
      selectedMarksheetId: "MS-2026-SEN1-B-MATH-EOT-TE",
      matchedMarksheetId: "MS-2026-SEN1-B-MATH-EOT-TE",
      matchConfidence: 0.9,
      matchSource: "header",
      contextSource: "recognized-id",
      contextWarning: "",
      fileName: "scan.jpg",
      configuredProvider: "azure",
      activeProvider: "azure",
      providerReachable: true,
      fallbackReason: "",
      marksheetIdDebug: {
        rawHeaderText: "Marksheet ID: MS-2026-SENI-B-MATH-EOT-TE",
        normalizedCandidates: ["MS-2026-SEN1-B-MATH-EOT-TE"],
        topRightCropPath: "tmp/ocr-debug/latest/marksheet-id-topright-crop.jpg",
        expandedTopRightCropPath: "tmp/ocr-debug/latest/marksheet-id-topright-expanded-crop.jpg",
        headerCropPath: "tmp/ocr-debug/latest/marksheet-id-header-crop.jpg",
        debugJsonPath: "tmp/ocr-debug/latest/marksheet-id-detection.json",
      },
      createdAt: new Date().toISOString(),
    });

    render(<ScanUploadPanel />);

    expect(await screen.findByText("Extraction failed")).toBeInTheDocument();
    expect(screen.getByText("Show scan debug")).toBeInTheDocument();
    expect(screen.getByText("No rows loaded yet.")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Show scan debug"));

    expect(screen.getByText("Raw ID OCR")).toBeInTheDocument();
    expect(screen.getAllByText("MS-2026-SEN1-B-MATH-EOT-TE").length).toBeGreaterThan(0);
    expect(screen.getByText("Top-right crop:")).toBeInTheDocument();
  });

  it("auto-extracts after recognized Marksheet ID and shows scan context source", async () => {
    vi.mocked(detectScanContext).mockResolvedValue({
      detected: {
        ...context,
        overallConfidence: 1,
        source: "HEADER_OCR",
        partial: false,
        message: "Context resolved.",
      },
      detectionStatus: "DETECTED",
      message: "Context resolved.",
      recognizedMarksheetId: "MS-2026-SENI-A-MATH-EOT-TE",
      normalizedMarksheetId: context.marksheetId,
      rawRecognizedId: "MS-2026-SENI-A-MATH-EOT-TE",
      normalizedRecognizedId: context.marksheetId,
      matchedMarksheetId: context.marksheetId,
      matchConfidence: 0.93,
      matchSource: "header",
      resolvedContext: context,
      contextSource: "recognized-id",
      contextWarning: "",
    });
    vi.mocked(uploadScanFile).mockResolvedValue({
      batchId: "batch-auto",
      scanBatchId: "batch-auto",
      parseStatus: "PARSED",
      message: "Scan processed.",
      rows,
      recognizedMarksheetId: "MS-2026-SENI-A-MATH-EOT-TE",
      normalizedMarksheetId: context.marksheetId,
      rawRecognizedId: "MS-2026-SENI-A-MATH-EOT-TE",
      normalizedRecognizedId: context.marksheetId,
      matchedMarksheetId: context.marksheetId,
      matchConfidence: 0.93,
      matchSource: "header",
      resolvedContext: context,
      contextSource: "recognized-id",
      contextWarning: "",
      configuredProvider: "azure",
      activeProvider: "azure",
      providerReachable: true,
    });

    render(<ScanUploadPanel />);

    const file = new File(["scan"], "marksheet.png", { type: "image/png" });
    const input = screen.getByLabelText(/Choose a scanned marksheet/i);
    fireEvent.change(input, { target: { files: [file] } });

    expect(await screen.findByText("Operator Entry & Review")).toBeInTheDocument();
    expect(uploadScanFile).toHaveBeenCalled();
    expect(screen.getByText("Context source: Auto-detected from scan")).toBeInTheDocument();
    expect(screen.getAllByText("Auto-detected from scan").length).toBeGreaterThan(0);
    expect(screen.getAllByText(context.marksheetId).length).toBeGreaterThan(0);
    expect(screen.queryByText(removedProviderPattern)).not.toBeInTheDocument();
  });

  it("shows structured top-right sheet ID fallback message", async () => {
    vi.mocked(detectScanContext).mockRejectedValue(new Error(sheetIdMessage));

    render(<ScanUploadPanel />);

    const file = new File(["scan"], "marksheet.png", { type: "image/png" });
    const input = screen.getByLabelText(/Choose a scanned marksheet/i);
    fireEvent.change(input, { target: { files: [file] } });

    expect(await screen.findByText(sheetIdMessage)).toBeInTheDocument();
    expect(screen.getByText(/Enter the printed Marksheet ID/i)).toBeInTheDocument();
    expect(screen.queryByText(/Unexpected error/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/^Server error$/i)).not.toBeInTheDocument();
  });
});
