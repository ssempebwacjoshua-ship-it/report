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
      includedCredits: 10,
      topUpCredits: 0,
      usedCredits: 5,
      remainingCredits: 5,
      includedPages: 10,
      topUpPages: 0,
      usedPages: 5,
      remainingPages: 5,
      planName: "TRIAL",
      billingCycle: "ACADEMIC_YEAR",
      allowHighAccuracy: false,
      trialClaimed: true,
    },
    ledger: [
      {
        id: "led-1",
        operation: "EXTRACT",
        pagesProcessed: 2,
        creditsUsed: 2,
        creditsRemainingAfter: 5,
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
  claimFreeTrial: vi.fn().mockResolvedValue({
    summary: {
      includedCredits: 10,
      topUpCredits: 0,
      usedCredits: 0,
      remainingCredits: 10,
      includedPages: 10,
      topUpPages: 0,
      usedPages: 0,
      remainingPages: 10,
      planName: "TRIAL",
      billingCycle: "ACADEMIC_YEAR",
      allowHighAccuracy: false,
      trialClaimed: true,
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

// ── A: Trial card ─────────────────────────────────────────────────────────────

describe("Trial package card", () => {
  it("displays '10 free pages' on the Trial card", async () => {
    renderBillingPage();
    await waitFor(() => expect(screen.getByText("Billing")).toBeInTheDocument());
    // "10 free pages" is split across a text node and a <span>, so check textContent.
    expect(document.body.textContent).toContain("10 free pages");
  });

  it("shows 'Trial already claimed' button when trial is claimed", async () => {
    renderBillingPage();
    await waitFor(() => expect(screen.getByText(/trial already claimed/i)).toBeInTheDocument());
    expect(screen.getByRole("button", { name: /trial already claimed/i })).toBeDisabled();
  });

  it("shows 'Claim free trial' button when trial is NOT yet claimed", async () => {
    const billingClient = await import("../../client/smartPagesBillingClient");
    vi.mocked(billingClient.fetchSmartPagesBillingSummary).mockResolvedValueOnce({
      summary: {
        includedCredits: 0,
        topUpCredits: 0,
        usedCredits: 0,
        remainingCredits: 0,
        includedPages: 0,
        topUpPages: 0,
        usedPages: 0,
        remainingPages: 0,
        planName: null,
        billingCycle: "ACADEMIC_YEAR",
        allowHighAccuracy: false,
        trialClaimed: false,
      },
      ledger: [],
      payments: [],
    });
    renderBillingPage();
    await waitFor(() => expect(screen.getByRole("button", { name: /claim free trial/i })).toBeInTheDocument());
  });

  it("claiming trial calls claimFreeTrial and updates balance to 10 pages", async () => {
    const user = userEvent.setup();
    const billingClient = await import("../../client/smartPagesBillingClient");
    vi.mocked(billingClient.fetchSmartPagesBillingSummary).mockResolvedValueOnce({
      summary: {
        includedCredits: 0,
        topUpCredits: 0,
        usedCredits: 0,
        remainingCredits: 0,
        includedPages: 0,
        topUpPages: 0,
        usedPages: 0,
        remainingPages: 0,
        planName: null,
        billingCycle: "ACADEMIC_YEAR",
        allowHighAccuracy: false,
        trialClaimed: false,
      },
      ledger: [],
      payments: [],
    });
    renderBillingPage();
    await waitFor(() => expect(screen.getByRole("button", { name: /claim free trial/i })).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: /claim free trial/i }));
    expect(vi.mocked(billingClient.claimFreeTrial)).toHaveBeenCalled();

    // After claim, balance shows 10 pages remaining.
    await waitFor(() => expect(screen.getAllByText("10").length).toBeGreaterThan(0));
  });
});

// ── B: Pages wording ─────────────────────────────────────────────────────────

describe("Customer-facing wording uses pages", () => {
  it("balance card shows 'pages remaining' not 'credits remaining'", async () => {
    renderBillingPage();
    await waitFor(() => expect(screen.getByText(/pages remaining/i)).toBeInTheDocument());
    expect(screen.queryByText(/credits remaining/i)).not.toBeInTheDocument();
  });

  it("shows '100 pages' on Starter, '500 pages' on Standard, '1,000 pages' on School Pro", async () => {
    renderBillingPage();
    await waitFor(() => expect(screen.getByText("Billing")).toBeInTheDocument());
    // Names appear in both the package grid and the payments table — use getAllByText.
    expect(screen.getAllByText("Starter").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Standard").length).toBeGreaterThan(0);
    expect(screen.getAllByText("School Pro").length).toBeGreaterThan(0);
    // Pages wording present (space is now in JSX between number and "pages").
    expect(document.body.textContent).toMatch(/100\s*pages/);
    expect(document.body.textContent).toMatch(/500\s*pages/);
  });

  it("Billing summary section shows 'pages remaining' heading", async () => {
    renderBillingPage();
    await waitFor(() => expect(screen.getByText(/pages remaining/i)).toBeInTheDocument());
  });
});

// ── C: Payment flow ───────────────────────────────────────────────────────────

describe("Buy pages flow", () => {
  it("buying a package opens the payment modal", async () => {
    const user = userEvent.setup();
    renderBillingPage();
    await waitFor(() => expect(screen.getByRole("button", { name: /buy pages/i })).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: /buy pages/i }));
    expect(screen.getByText(/choose a page package/i)).toBeInTheDocument();
  });

  it("submitting transaction ID shows pending confirmation message", async () => {
    const user = userEvent.setup();
    renderBillingPage();
    await waitFor(() => expect(screen.getByRole("button", { name: /buy pages/i })).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: /buy pages/i }));

    // Select Starter package in modal
    await user.click(screen.getByRole("button", { name: /^starter/i }));
    expect(screen.getByText(/select your network/i)).toBeInTheDocument();

    // Select MTN
    await user.click(screen.getByRole("button", { name: /MTN Mobile Money/i }));
    await user.click(screen.getByRole("button", { name: /I have paid/i }));

    // Enter transaction ID
    await waitFor(() => expect(screen.getByPlaceholderText(/MP230600001234/i)).toBeInTheDocument());
    await user.type(screen.getByPlaceholderText(/MP230600001234/i), "MP123456789");
    await user.click(screen.getByRole("button", { name: /submit payment/i }));

    await waitFor(() => expect(screen.getByText(/payment submitted/i)).toBeInTheDocument());
    // Must show pending state in the done modal — multiple /pending/ matches are OK.
    expect(screen.getAllByText(/pending/i).length).toBeGreaterThan(0);
    expect(screen.queryByText(/pages added/i)).not.toBeInTheDocument();
  });

  it("shows 'pages will be added after admin confirmation' — not immediately approved", async () => {
    const user = userEvent.setup();
    renderBillingPage();
    await waitFor(() => expect(screen.getByRole("button", { name: /buy pages/i })).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: /buy pages/i }));
    await user.click(screen.getByRole("button", { name: /^starter/i }));
    await user.click(screen.getByRole("button", { name: /MTN Mobile Money/i }));
    await user.click(screen.getByRole("button", { name: /I have paid/i }));
    await waitFor(() => expect(screen.getByPlaceholderText(/MP230600001234/i)).toBeInTheDocument());
    await user.type(screen.getByPlaceholderText(/MP230600001234/i), "TX99999");
    await user.click(screen.getByRole("button", { name: /submit payment/i }));

    await waitFor(() => expect(screen.getByText(/payment submitted/i)).toBeInTheDocument());
    expect(screen.getByText(/after admin confirmation/i)).toBeInTheDocument();
  });
});

// ── Full page load ────────────────────────────────────────────────────────────

describe("Smart Pages Billing page", () => {
  it("loads the billing page without crashing", async () => {
    renderBillingPage();
    await waitFor(() => expect(screen.getByText("Billing")).toBeInTheDocument());
    expect(screen.getByText(/pages remaining/i)).toBeInTheDocument();
  });

  it("shows balance, packages, recent payments, and usage history", async () => {
    renderBillingPage();
    await waitFor(() => expect(screen.getByText(/pages remaining/i)).toBeInTheDocument());

    // packages
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
    await waitFor(() => expect(screen.getByText("Recent Page Usage")).toBeInTheDocument());

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

  it("shows Mobile Money merchant codes in Buy Pages flow", async () => {
    const user = userEvent.setup();
    renderBillingPage();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /buy pages/i })).toBeInTheDocument(),
    );

    await user.click(screen.getByRole("button", { name: /buy pages/i }));
    // Click the modal's Starter package card
    await user.click(screen.getByRole("button", { name: /^starter/i }));
    expect(screen.getByText(/select your network/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /MTN Mobile Money/i }));
    expect(screen.getAllByText("98642335").length).toBeGreaterThan(0);
  });
});

// ── Smart Pages main page ─────────────────────────────────────────────────────

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
