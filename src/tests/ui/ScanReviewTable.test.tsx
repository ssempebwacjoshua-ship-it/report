import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ScanReviewTable } from "../../components/imports/ScanReviewTable";
import type { GeometryDebugInfo, ScanImportRow } from "../../shared/types/imports";

function geometry(overrides: Partial<GeometryDebugInfo> = {}): GeometryDebugInfo {
  return {
    imageWidth: 800,
    imageHeight: 1100,
    detectionMethod: "detected",
    geometryConfidence: 0.9,
    tableRect: { left: 30, right: 770, top: 200, bottom: 1040 },
    writtenMarkCol: { x: 410, w: 90 },
    splitMarkCol: { x: 500, w: 84 },
    dataRowCount: 26,
    writtenCropRect: { x: 418, y: 250, w: 70, h: 24 },
    warnings: [],
    ...overrides,
  };
}

function baseRow(overrides: Partial<ScanImportRow> = {}): ScanImportRow {
  return {
    rowNumber: 1,
    admissionNumber: "S1A-001",
    studentName: "Kampala Ssempebwa",
    writtenMark: "",
    splitMark: "",
    extractedMark: "",
    suggestedMark: "",
    confidence: 0,
    remarks: "",
    ocrProvider: "Azure OCR",
    geometryDebug: geometry(),
    statusReason: "",
    status: "MISSING",
    validationErrors: [],
    operatorCorrection: "",
    ...overrides,
  };
}

describe("ScanReviewTable fallback crop debug", () => {
  it("shows when a fallback recrop was used and which strategy was selected", () => {
    const row = baseRow({
      geometryDebug: geometry({
        fallbackCropUsed: true,
        fallbackStrategy: "center-inner",
        cropQualityReason: "Prominent horizontal lines (row border contamination)",
      }),
    });

    render(<ScanReviewTable rows={[row]} providerInfo={{ providerReachable: true }} />);

    expect(screen.getByText(/center-inner/i)).toBeInTheDocument();
    expect(screen.getByText(/row border contamination/i)).toBeInTheDocument();
  });

  it("shows the manual-entry message (not 'OCR unavailable') when no crop could be isolated", () => {
    const row = baseRow({
      statusReason: "Could not isolate the handwritten mark. Please enter mark manually.",
      geometryDebug: geometry({
        fallbackCropUsed: true,
        cropQualityReason: "Crop mostly dark (border or solid region)",
      }),
    });

    render(<ScanReviewTable rows={[row]} providerInfo={{ providerReachable: true }} />);

    expect(
      screen.getAllByText(/could not isolate the handwritten mark/i).length,
    ).toBeGreaterThan(0);
    expect(screen.queryByText(/OCR temporarily unavailable/i)).not.toBeInTheDocument();
  });

  it("shows the crop-alignment failure message and never 'OCR unavailable' for a crop failure", () => {
    const row = baseRow({
      statusReason: "Crop alignment failed. Could not isolate the handwritten mark. Please enter mark manually.",
      geometryDebug: geometry({
        fallbackCropUsed: true,
        cropQualityReason: "Crop mostly dark (border or solid region)",
        cropRejectionReason: "written: Crop mostly dark (border or solid region)",
      }),
    });

    render(<ScanReviewTable rows={[row]} providerInfo={{ providerReachable: true }} />);

    expect(screen.getAllByText(/crop alignment failed/i).length).toBeGreaterThan(0);
    expect(screen.queryByText(/OCR temporarily unavailable/i)).not.toBeInTheDocument();
  });

  it("renders the original candidate crop thumbnail alongside the selected crop", () => {
    const row = baseRow({
      writtenCropDataUrl: "data:image/jpeg;base64,SELECTED",
      originalWrittenCropDataUrl: "data:image/jpeg;base64,ORIGINAL",
      geometryDebug: geometry({ fallbackCropUsed: true, fallbackStrategy: "shift-down" }),
    });

    render(<ScanReviewTable rows={[row]} providerInfo={{ providerReachable: true }} />);

    const original = screen.getByAltText(/original candidate crop/i) as HTMLImageElement;
    expect(original.src).toContain("ORIGINAL");
  });
});
