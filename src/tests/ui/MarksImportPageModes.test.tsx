import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MarksImportPage } from "../../pages/MarksImportPage";

// Mock network clients so the page renders without hitting the API.
vi.mock("../../client/importsClient", () => ({
  dryRunMarksImport: vi.fn(),
  commitMarksImport: vi.fn(),
  extractMarksWithGeminiScan: vi.fn(),
  commitScanRows: vi.fn(),
  detectScanContext: vi.fn(),
  dryRunScanRows: vi.fn(),
  loadScanBatch: vi.fn(),
  lookupMarksheetContext: vi.fn(),
  uploadScanFile: vi.fn(),
}));
vi.mock("../../client/settingsClient", () => ({
  fetchSettings: vi.fn().mockResolvedValue({ sections: {} }),
}));

describe("MarksImportPage modes", () => {
  it("renders the existing digital CSV/Excel import UI by default", () => {
    render(<MarksImportPage />);
    expect(screen.getByText("Digital Marksheet")).toBeInTheDocument();
    expect(screen.getByText("Download CSV template")).toBeInTheDocument();
    expect(screen.getByText("Download Excel template")).toBeInTheDocument();
  });

  it("offers the Gemini scan pilot as an additional mode", () => {
    render(<MarksImportPage />);
    fireEvent.click(screen.getByText("Gemini Scan (Pilot)"));
    expect(screen.getByRole("button", { name: "Extract with Gemini" })).toBeInTheDocument();
    // Commit is honestly labelled as not yet available.
    expect(screen.getByText("Commit after review coming next")).toBeInTheDocument();
  });
});
