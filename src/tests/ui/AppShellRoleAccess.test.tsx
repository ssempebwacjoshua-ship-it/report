import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppShell } from "../../components/layout/AppShell";
import { PermissionGuard } from "../../components/PermissionGuard";
import { defaultSettingsSections, type SettingsResponse } from "../../shared/types/settings";

const authState = vi.hoisted(() => ({
  user: null as null | { id: string; schoolId: string; name: string; role: "ADMIN_OPERATOR" | "SECURITY" | "GATE_SECURITY" | "CANTEEN" | "CASHIER" },
  token: null as string | null,
  loading: false,
}));

const mockFetchSettings = vi.hoisted(() => vi.fn());

vi.mock("../../contexts/AuthContext", () => ({
  useAuth: () => ({
    user: authState.user,
    token: authState.token,
    loading: authState.loading,
    login: vi.fn(),
    logout: vi.fn(),
  }),
}));

vi.mock("../../client/settingsClient", () => ({
  fetchSettings: mockFetchSettings,
}));

function makeSettings(): SettingsResponse {
  return {
    schoolCode: "SCU-PREVIEW",
    sections: defaultSettingsSections,
    updatedAt: null,
    updatedBy: null,
  };
}

function renderShell(initialPath: string) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route element={<AppShell />}>
          <Route
            path="/smart-pages"
            element={
              <PermissionGuard permission="app.admin">
                <div>Smart Pages Content</div>
              </PermissionGuard>
            }
          />
          <Route path="/nfc/gate" element={<div>Gate Content</div>} />
          <Route path="/gate/nfc/:token" element={<div>Gate Content</div>} />
          <Route path="/nfc/canteen" element={<div>Canteen Content</div>} />
          <Route path="/nfc/wallets/top-up" element={<div>Wallet Top-Up</div>} />
          <Route path="/nfc/wallets/transactions" element={<div>Transactions Content</div>} />
          <Route path="/nfc/canteen/reconciliation" element={<div>Sync Content</div>} />
          <Route path="/dashboard" element={<div>Dashboard Content</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe("AppShell role access", () => {
  beforeEach(() => {
    mockFetchSettings.mockReset();
    authState.user = null;
    authState.token = null;
    authState.loading = false;
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation(() => ({
        matches: false,
        media: "",
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
    HTMLElement.prototype.scrollIntoView = vi.fn();
    window.location.hash = "";
  });

  it("sends SECURITY users straight to gate without loading settings", async () => {
    authState.user = { id: "u1", schoolId: "school-1", name: "Gate Security", role: "SECURITY" };
    authState.token = "tok";

    renderShell("/smart-pages");

    await waitFor(() => expect(screen.getByText("Gate Content")).toBeInTheDocument());
    expect(screen.getByLabelText(/dedicated role navigation/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Scan" })).toHaveAttribute("href", "/nfc/gate#gate-scan");
    expect(screen.getByRole("link", { name: "Pass-outs" })).toHaveAttribute("href", "/nfc/gate#gate-pass-outs");
    expect(mockFetchSettings).not.toHaveBeenCalled();
    expect(screen.queryByText("Smart Pages Content")).not.toBeInTheDocument();
  });

  it("updates the dedicated gate bottom nav active section when clicked", async () => {
    authState.user = { id: "u1", schoolId: "school-1", name: "Gate Security", role: "SECURITY" };
    authState.token = "tok";

    renderShell("/nfc/gate");

    await waitFor(() => expect(screen.getByText("Gate Content")).toBeInTheDocument());
    const scanLink = screen.getByRole("link", { name: "Scan" });
    const passOutsLink = screen.getByRole("link", { name: "Pass-outs" });

    expect(scanLink).toHaveClass("bg-blue-50");
    fireEvent.click(passOutsLink);

    await waitFor(() => expect(passOutsLink).toHaveClass("bg-blue-50"));
    expect(scanLink).not.toHaveClass("bg-blue-50");
  });

  it("renders the new gate UI route for NFC token links", async () => {
    authState.user = { id: "u1", schoolId: "school-1", name: "Gate Security", role: "SECURITY" };
    authState.token = "tok";

    renderShell("/gate/nfc/token-1");

    await waitFor(() => expect(screen.getByText("Gate Content")).toBeInTheDocument());
    expect(mockFetchSettings).not.toHaveBeenCalled();
  });

  it("shows dedicated bottom nav for Cashier/Canteen users", async () => {
    authState.user = { id: "u1", schoolId: "school-1", name: "Cashier User", role: "CASHIER" };
    authState.token = "tok";

    renderShell("/smart-pages");

    await waitFor(() => expect(screen.getByText("Canteen Content")).toBeInTheDocument());
    expect(screen.getByLabelText(/dedicated role navigation/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Charge" })).toHaveAttribute("href", "/nfc/canteen#canteen-charge");
    expect(screen.getByRole("link", { name: "Wallet" })).toHaveAttribute("href", "/nfc/wallets/top-up");
    expect(screen.getByRole("link", { name: "Transactions" })).toHaveAttribute("href", "/nfc/wallets/transactions");
    expect(screen.getByRole("link", { name: "Sync" })).toHaveAttribute("href", "/nfc/canteen/reconciliation");
  });

  it("still loads settings for ADMIN_OPERATOR users on Smart Pages", async () => {
    authState.user = { id: "u1", schoolId: "school-1", name: "Admin User", role: "ADMIN_OPERATOR" };
    authState.token = "tok";
    mockFetchSettings.mockResolvedValue(makeSettings());

    renderShell("/smart-pages");

    await waitFor(() => expect(mockFetchSettings).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByText("Smart Pages Content")).toBeInTheDocument());
    expect(screen.queryByLabelText(/dedicated role navigation/i)).not.toBeInTheDocument();
  });
});
