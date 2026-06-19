import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { GeminiScanPanel } from "../../components/imports/GeminiScanPanel";

vi.mock("../../client/importsClient", () => ({
  fetchScanOptions: vi.fn().mockResolvedValue({
    classes: [],
    streams: [],
    subjects: [],
    terms: [],
    examTypes: ["BOT", "MOT", "EOT"],
  }),
  fetchSmartPagesBalance: vi.fn().mockResolvedValue({ remainingPages: 5, trialClaimed: true }),
  extractMarksWithGeminiScan: vi.fn(),
  commitGeminiScanRows: vi.fn(),
}));

function renderPanel() {
  return render(
    <MemoryRouter>
      <GeminiScanPanel />
    </MemoryRouter>,
  );
}

// ── Balance display ────────────────────────────────────────────────────────────

describe("GeminiScanPanel billing UI — balance display", () => {
  it("shows pages remaining in the banner when balance is loaded", async () => {
    renderPanel();
    await waitFor(() => expect(screen.getByText(/5 pages remaining/i)).toBeInTheDocument());
  });

  it("shows a red balance label and Buy pages link when balance is zero", async () => {
    const importsClient = await import("../../client/importsClient");
    vi.mocked(importsClient.fetchSmartPagesBalance).mockResolvedValueOnce({
      remainingPages: 0,
      trialClaimed: true,
    });
    renderPanel();
    await waitFor(() => expect(screen.getByText(/0 pages remaining/i)).toBeInTheDocument());
    expect(screen.getAllByText(/buy pages/i).length).toBeGreaterThan(0);
  });

  it("shows 'no smart pages remaining' warning block when balance is zero", async () => {
    const importsClient = await import("../../client/importsClient");
    vi.mocked(importsClient.fetchSmartPagesBalance).mockResolvedValueOnce({
      remainingPages: 0,
      trialClaimed: true,
    });
    renderPanel();
    await waitFor(() =>
      expect(screen.getByText(/you have no smart pages remaining/i)).toBeInTheDocument(),
    );
    expect(screen.getByText(/digital csv\/xls import is free/i)).toBeInTheDocument();
  });

  it("does not show balance widget when balance fetch returns -1 (error)", async () => {
    const importsClient = await import("../../client/importsClient");
    vi.mocked(importsClient.fetchSmartPagesBalance).mockResolvedValueOnce({
      remainingPages: -1,
      trialClaimed: false,
    });
    renderPanel();
    // Wait for options to be attempted
    await waitFor(() => expect(screen.getByText(/smart marksheet import/i)).toBeInTheDocument());
    expect(screen.queryByText(/pages remaining/i)).not.toBeInTheDocument();
  });

  it("renders normally when balance fetch throws (graceful degradation)", async () => {
    const importsClient = await import("../../client/importsClient");
    vi.mocked(importsClient.fetchSmartPagesBalance).mockRejectedValueOnce(new Error("Network error"));
    renderPanel();
    await waitFor(() => expect(screen.getByText(/smart marksheet import/i)).toBeInTheDocument());
    // No crash, no balance shown
    expect(screen.queryByText(/pages remaining/i)).not.toBeInTheDocument();
  });
});

// ── Extract button disabled when no balance ────────────────────────────────────

describe("GeminiScanPanel billing UI — button disable", () => {
  it("Read Marksheet button is always disabled when no context is selected", async () => {
    renderPanel();
    await waitFor(() => expect(screen.getByText(/5 pages remaining/i)).toBeInTheDocument());
    expect(screen.getByRole("button", { name: /read marksheet/i })).toBeDisabled();
  });

  it("Read Marksheet button is disabled when balance is zero (no context)", async () => {
    const importsClient = await import("../../client/importsClient");
    vi.mocked(importsClient.fetchSmartPagesBalance).mockResolvedValueOnce({
      remainingPages: 0,
      trialClaimed: true,
    });
    renderPanel();
    await waitFor(() => expect(screen.getByText(/0 pages remaining/i)).toBeInTheDocument());
    expect(screen.getByRole("button", { name: /read marksheet/i })).toBeDisabled();
  });
});

// ── No-balance warning links to billing page ───────────────────────────────────

describe("GeminiScanPanel billing UI — billing page links", () => {
  it("Buy pages links point to /smart-pages/billing", async () => {
    const importsClient = await import("../../client/importsClient");
    vi.mocked(importsClient.fetchSmartPagesBalance).mockResolvedValueOnce({
      remainingPages: 0,
      trialClaimed: true,
    });
    renderPanel();
    await waitFor(() => expect(screen.getAllByRole("link", { name: /buy (more )?pages/i }).length).toBeGreaterThan(0));
    const links = screen.getAllByRole("link", { name: /buy (more )?pages/i });
    links.forEach((link) => {
      expect(link).toHaveAttribute("href", "/smart-pages/billing");
    });
  });
});
