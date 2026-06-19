import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { SmartPagesBillingPage } from "../../pages/smart-pages/SmartPagesBillingPage";
import { SmartPagesPage } from "../../pages/smart-pages/SmartPagesPage";

// ---- mocks ---------------------------------------------------------------

vi.mock("../../contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { name: "Test User", role: "SCHOOL_ADMIN" },
    token: "tok",
    loading: false,
    login: vi.fn(),
    logout: vi.fn(),
  }),
}));

// Data is inlined in the factory to avoid vi.mock hoisting / TDZ issues.
vi.mock("../../client/smartPagesBillingClient", () => ({
  fetchSmartPagesBillingSummary: vi.fn().mockResolvedValue({
    summary: {
      includedCredits: 20,
      topUpCredits: 0,
      usedCredits: 5,
      remainingCredits: 15,
      includedPages: 20,
      topUpPages: 0,
      usedPages: 5,
      remainingPages: 15,
      planName: "TRIAL",
      billingCycle: "ACADEMIC_YEAR",
      allowHighAccuracy: false,
    },
    ledger: [
      {
        id: "led-1",
        operation: "EXTRACT",
        pagesProcessed: 2,
        creditsUsed: 2,
        creditsRemainingAfter: 15,
        priceUgx: 1000,
        status: "CHARGED",
        createdAt: "2026-06-01T10:00:00Z",
      },
    ],
    payments: [
      {
        id: "pay-1",
        schoolId: "school-1",
        packageCode: "STARTER",
        packageName: "Starter",
        credits: 100,
        amountUgx: 50000,
        network: "MTN",
        merchantCode: "98642335",
        merchantName: "School Connect",
        paymentReference: "REF001",
        status: "PENDING",
        createdAt: "2026-06-10T09:00:00Z",
      },
    ],
  }),
  fetchSmartPagesBillingConfig: vi.fn().mockResolvedValue({
    networks: [
      { network: "AIRTEL", label: "Airtel Money", merchantCode: "7097959", merchantName: "School Connect" },
      { network: "MTN", label: "MTN Mobile Money", merchantCode: "98642335", merchantName: "School Connect" },
    ],
    packages: [
      { code: "TRIAL", name: "Trial", credits: 10, priceUgx: 0 },
      { code: "STARTER", name: "Starter", credits: 100, priceUgx: 50000 },
      { code: "STANDARD", name: "Standard", credits: 500, priceUgx: 225000 },
      { code: "SCHOOL_PRO", name: "School Pro", credits: 1000, priceUgx: 400000 },
    ],
    pricing: {
      creditPriceUgx: 500,
      highAccuracyMultiplier: 2,
      generateDocumentCreditsPerPage: 1,
      publishCreditsPerDocument: 1,
    },
  }),
  prepareSmartPagesPayment: vi.fn().mockResolvedValue({
    id: "pay-new",
    schoolId: "school-1",
    packageCode: "STARTER",
    packageName: "Starter",
    credits: 100,
    amountUgx: 50000,
    network: "MTN",
    merchantCode: "98642335",
    merchantName: "School Connect",
    paymentReference: "REF-ABC123",
    status: "PENDING",
    createdAt: "2026-06-19T10:00:00Z",
  }),
  submitSmartPagesPaymentReceipt: vi.fn().mockResolvedValue({
    id: "pay-new",
    status: "PENDING",
  }),
}));

vi.mock("../../client/documentIntelligenceClient", () => ({
  listDocuments: vi.fn().mockResolvedValue([]),
  createDocument: vi.fn(),
}));

// -------------------------------------------------------------------------

function renderBillingPage() {
  return render(
    <MemoryRouter initialEntries={["/smart-pages/billing"]}>
      <SmartPagesBillingPage />
    </MemoryRouter>,
  );
}

function renderSmartPagesPage() {
  return render(
    <MemoryRouter initialEntries={["/smart-pages"]}>
      <SmartPagesPage />
    </MemoryRouter>,
  );
}

describe("Smart Pages Billing page", () => {
  it("loads the billing page without crashing", async () => {
    renderBillingPage();
    await waitFor(() => expect(screen.getByText("Billing")).toBeInTheDocument());
    expect(screen.getByText(/credits remaining/i)).toBeInTheDocument();
  });

  it("shows credit balance, packages, recent payments, and usage history", async () => {
    renderBillingPage();
    await waitFor(() => expect(screen.getByText(/credits remaining/i)).toBeInTheDocument());

    // packages — multiple elements expected since packages appear in both grid and modal
    expect(screen.getAllByText("Starter").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Standard").length).toBeGreaterThan(0);
    expect(screen.getAllByText("School Pro").length).toBeGreaterThan(0);

    // recent payments table
    expect(screen.getByRole("columnheader", { name: /status/i })).toBeInTheDocument();
    expect(screen.getByText("Pending")).toBeInTheDocument();

    // usage history
    expect(screen.getByText("OCR Extraction")).toBeInTheDocument();
  });

  it("does NOT render 'token', 'internal', 'provider cost', or 'margin' text", async () => {
    renderBillingPage();
    await waitFor(() => expect(screen.getByText("Billing")).toBeInTheDocument());

    const body = document.body.textContent ?? "";
    expect(body).not.toMatch(/\btoken\b/i);
    expect(body).not.toMatch(/\binternal\b/i);
    expect(body).not.toMatch(/provider cost/i);
    expect(body).not.toMatch(/\bmargin\b/i);
    expect(body).not.toMatch(/gemini cost/i);
  });

  it("school users cannot see provider cost, margin, or model token info columns", async () => {
    renderBillingPage();
    await waitFor(() => expect(screen.getByText("Recent Credit Usage")).toBeInTheDocument());

    // Admin-only columns must not appear
    expect(screen.queryByText(/provider cost/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/margin/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/gemini cost/i)).not.toBeInTheDocument();
  });

  it("shows a friendly error with a retry button when billing API fails", async () => {
    const billingClient = await import("../../client/smartPagesBillingClient");
    vi.mocked(billingClient.fetchSmartPagesBillingSummary).mockRejectedValueOnce(
      new TypeError("Failed to fetch"),
    );

    renderBillingPage();
    await waitFor(() =>
      expect(screen.getByText(/Could not load billing information/i)).toBeInTheDocument(),
    );
    expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument();
    expect(screen.queryByText("Failed to fetch")).not.toBeInTheDocument();
  });

  it("shows Mobile Money merchant codes in Buy Credits flow", async () => {
    const user = userEvent.setup();
    renderBillingPage();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /buy credits/i })).toBeInTheDocument(),
    );

    await user.click(screen.getByRole("button", { name: /buy credits/i }));
    expect(screen.getByText(/choose a credit package/i)).toBeInTheDocument();

    // Click the modal's Starter package card (accessible name includes "Starter 100 credits")
    await user.click(screen.getByRole("button", { name: /^starter/i }));
    expect(screen.getByText(/select your network/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /MTN Mobile Money/i }));
    // Merchant code appears twice (heading + instruction list) — just confirm presence
    expect(screen.getAllByText("98642335").length).toBeGreaterThan(0);
  });
});

describe("Smart Pages main page — school user view", () => {
  it("does NOT render the words 'token' or 'internal'", async () => {
    renderSmartPagesPage();
    await waitFor(() =>
      expect(screen.getByText(/smart page credits are used/i)).toBeInTheDocument(),
    );

    const body = document.body.textContent ?? "";
    expect(body).not.toMatch(/\btoken\b/i);
    expect(body).not.toMatch(/\binternal\b/i);
  });

  it("shows the correct credit description text", async () => {
    renderSmartPagesPage();
    await waitFor(() =>
      expect(
        screen.getByText(/smart page credits are used to process, generate, and publish documents/i),
      ).toBeInTheDocument(),
    );
  });

  it("shows a friendly error and retry button when document load fails", async () => {
    const docClient = await import("../../client/documentIntelligenceClient");
    vi.mocked(docClient.listDocuments).mockRejectedValueOnce(new TypeError("Failed to fetch"));

    renderSmartPagesPage();
    await waitFor(() =>
      expect(screen.getByText(/could not load documents/i)).toBeInTheDocument(),
    );
    expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument();
    expect(screen.queryByText("Failed to fetch")).not.toBeInTheDocument();
  });
});
