import { MemoryRouter } from "react-router-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NfcWalletsPage } from "../../pages/NfcWalletsPage";
import type { NfcWalletDashboard } from "../../shared/types/studentCredentials";

const mockFetchNfcWallets = vi.hoisted(() => vi.fn());
const mockSetWalletPin = vi.hoisted(() => vi.fn());
const mockNavigate = vi.hoisted(() => vi.fn());

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock("../../client/studentCredentialsClient", () => ({
  fetchNfcWallets: mockFetchNfcWallets,
  setWalletPin: mockSetWalletPin,
}));

const dashboard: NfcWalletDashboard = {
  summary: {
    totalActiveWallets: 2,
    totalBalanceCents: 3650000,
    frozenWallets: 1,
    todayCanteenSpendCents: 420000,
  },
  wallets: [
    {
      student: {
        id: "student-1",
        name: "Claire Nakibuuka",
        admissionNumber: "SCU-S1A-018",
        className: "Senior 1",
        streamName: "A",
        photoUrl: null,
      },
      wallet: {
        id: "wallet-1",
        balanceCents: 2450000,
        status: "ACTIVE",
        frozenReason: null,
        pinSet: true,
        pinLockedUntil: null,
      },
      activeCredentialStatus: "ACTIVE",
      lastTransaction: null,
    },
  ],
};

describe("NfcWalletsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchNfcWallets.mockResolvedValue(dashboard);
  });

  it("shows the wallet tabs and a compact wallet summary list", async () => {
    render(
      <MemoryRouter>
        <NfcWalletsPage />
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByRole("heading", { name: "Wallets" })).toBeInTheDocument());
    expect(screen.getByRole("link", { name: "Wallets" })).toHaveAttribute("href", "/nfc/wallets");
    expect(screen.getByRole("link", { name: "Top Up" })).toHaveAttribute("href", "/nfc/wallets/top-up");
    expect(screen.getByRole("link", { name: "Transactions" })).toHaveAttribute("href", "/nfc/wallets/transactions");
    expect(screen.getByRole("link", { name: "Reconcile" })).toHaveAttribute("href", "/nfc/wallets/reconcile");
    expect(screen.getByText("Claire Nakibuuka")).toBeInTheDocument();
    expect(screen.getByText("SCU-S1A-018")).toBeInTheDocument();
    expect(screen.getAllByText("UGX 24,500").length).toBeGreaterThan(0);
  });

  it("uses a sticky wallet tab bar with the current shell-based offsets", async () => {
    render(
      <MemoryRouter>
        <NfcWalletsPage />
      </MemoryRouter>,
    );

    const tabsSticky = await screen.findByTestId("wallet-tabs-sticky");
    expect(tabsSticky).toHaveClass("sticky", "top-0", "z-30", "bg-slate-50");
    expect(tabsSticky).toHaveStyle({
      "--wallet-tabs-height": "44px",
      "--wallet-detail-sticky-top": "calc(var(--wallet-tabs-height) + var(--app-section-gap))",
      "--wallet-detail-max-height": "calc(100dvh - var(--app-topbar-height) - var(--wallet-tabs-height) - var(--app-section-gap) - var(--app-page-padding))",
    });
  });

  it("uses a desktop-only sticky wallet detail panel with bounded inner scrolling", async () => {
    render(
      <MemoryRouter>
        <NfcWalletsPage />
      </MemoryRouter>,
    );

    const detailPanel = await screen.findByTestId("wallet-detail-panel");
    const detailCard = screen.getByTestId("wallet-detail-card");
    expect(detailPanel).toHaveClass("self-start", "xl:sticky");
    expect(detailPanel).toHaveStyle({
      top: "var(--wallet-detail-sticky-top)",
      maxHeight: "var(--wallet-detail-max-height)",
    });
    expect(detailCard).toHaveClass("xl:max-h-[var(--wallet-detail-max-height)]", "xl:overflow-y-auto");
  });

  it("keeps Set PIN and Top Up actions clickable while preserving wallet detail content", async () => {
    render(
      <MemoryRouter>
        <NfcWalletsPage />
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByText("Claire Nakibuuka")).toBeInTheDocument());
    fireEvent.click(screen.getAllByRole("button", { name: /set pin|reset pin/i })[0]!);
    expect(screen.getByText(/reset wallet pin/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
    fireEvent.click(screen.getByRole("button", { name: /top up/i }));
    expect(mockNavigate).toHaveBeenCalledWith("/nfc/wallets/top-up?studentId=student-1");
    expect(screen.getByText(/wallet detail/i)).toBeInTheDocument();
    expect(screen.getByText(/wallet pin/i)).toBeInTheDocument();
  });
});
