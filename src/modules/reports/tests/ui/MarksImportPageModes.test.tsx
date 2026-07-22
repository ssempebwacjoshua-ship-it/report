import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { MarksImportPage } from "../../pages/MarksImportPage";
import type { ScanOptions } from "../../../../shared/types/imports";

// Mock network clients so the page renders without hitting the API.
vi.mock("../../client/importsClient", () => ({
  dryRunMarksImport: vi.fn(),
  commitMarksImport: vi.fn(),
  commitGeminiScanRows: vi.fn(),
  extractMarksWithGeminiScan: vi.fn(),
  fetchScanOptions: vi.fn().mockResolvedValue({
    success: true,
    classes: [{ id: "c1", name: "Senior 1", code: "S1" }],
    streams: [],
    subjects: [{ id: "s1", name: "Mathematics", code: "MATH" }],
    terms: [{ id: "t1", name: "2025/2026 ? Term 1", isActive: true }],
    examTypes: ["BOT", "MOT", "EOT"],
  } satisfies ScanOptions),
  fetchSmartPagesBalance: vi.fn().mockResolvedValue({ remainingPages: 10, trialClaimed: true }),
  commitScanRows: vi.fn(),
  detectScanContext: vi.fn(),
  dryRunScanRows: vi.fn(),
  loadScanBatch: vi.fn(),
  lookupMarksheetContext: vi.fn(),
  uploadScanFile: vi.fn(),
}));
vi.mock("../../../../client/settingsClient", () => ({
  fetchSettings: vi.fn().mockResolvedValue({ sections: {} }),
}));

describe("MarksImportPage modes", () => {
  it("renders the existing digital CSV/Excel import UI by default", () => {
    render(<MemoryRouter><MarksImportPage /></MemoryRouter>);
    expect(screen.getByText("Digital Marksheet")).toBeInTheDocument();
    expect(screen.getByText("Smart Marksheet Import")).toBeInTheDocument();
    expect(screen.queryByText("Scanned Handwritten Marksheet")).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /marksheet/i }).length).toBe(2);
    expect(screen.getByText("Download CSV template")).toBeInTheDocument();
    expect(screen.getByText("Download Excel template")).toBeInTheDocument();
  });

  it("offers Smart Marksheet Import as an additional mode", () => {
    render(<MemoryRouter><MarksImportPage /></MemoryRouter>);
    fireEvent.click(screen.getByText("Smart Marksheet Import"));
    expect(screen.getByRole("button", { name: "Read Marksheet" })).toBeInTheDocument();
    // Save Reviewed Marks is always visible (but disabled until commit is wired).
    expect(screen.getByRole("button", { name: "Save Reviewed Marks" })).toBeInTheDocument();
  });
});

