import { MemoryRouter } from "react-router-dom";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NfcWalletsPage } from "../../pages/NfcWalletsPage";
import type { NfcWalletDashboard } from "../../shared/types/studentCredentials";

const mockFetchNfcWallets = vi.hoisted(() => vi.fn());
const mockSetWalletPin = vi.hoisted(() => vi.fn());

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
});
