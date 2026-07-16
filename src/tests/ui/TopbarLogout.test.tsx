import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Topbar } from "../../components/layout/Topbar";

const logoutMock = vi.fn();
const authState = vi.hoisted(() => ({
  user: { name: "Test Admin", role: "ADMIN_OPERATOR" } as null | { name: string; role: "ADMIN_OPERATOR" | "SECURITY" | "CANTEEN" | "CASHIER" },
}));

vi.mock("../../contexts/AuthContext", () => ({
  useAuth: () => ({ user: authState.user, logout: logoutMock }),
}));

vi.mock("../../hooks/useConnectivityStatus", () => ({
  useConnectivityStatus: () => ({
    state: "ONLINE",
    pendingCount: 0,
    isOffline: false,
    isOfflineReady: false,
    refreshPendingCount: vi.fn(),
    triggerSync: vi.fn(),
  }),
}));

function mockDisplayMode(standalone: boolean) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: query === "(display-mode: standalone)" ? standalone : false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

describe("Topbar navigation + logout", () => {
  beforeEach(() => {
    logoutMock.mockReset();
    mockDisplayMode(false);
  });

  it("renders the product switcher", () => {
    authState.user = { name: "Test Admin", role: "ADMIN_OPERATOR" };
    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <Topbar onMenuClick={() => {}} />
      </MemoryRouter>,
    );

    expect(screen.getByRole("button", { name: /report lab/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /smart pages/i })).toBeInTheDocument();
  });

  it("renders a visible logout button and calls logout on click", async () => {
    authState.user = { name: "Test Admin", role: "ADMIN_OPERATOR" };
    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <Topbar onMenuClick={() => {}} />
      </MemoryRouter>,
    );

    const logoutButton = screen.getByRole("button", { name: /sign out/i });
    expect(logoutButton).toBeInTheDocument();
    await userEvent.click(logoutButton);
    expect(logoutMock).toHaveBeenCalled();
  });

  it("renders the menu button for mobile navigation", () => {
    authState.user = { name: "Test Admin", role: "ADMIN_OPERATOR" };
    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <Topbar onMenuClick={() => {}} />
      </MemoryRouter>,
    );
    expect(screen.getByRole("button", { name: /open navigation/i })).toBeInTheDocument();
  });

  it("hides Smart Pages from security staff", () => {
    authState.user = { name: "Gate Security", role: "SECURITY" };
    render(
      <MemoryRouter initialEntries={["/nfc/gate"]}>
        <Topbar onMenuClick={() => {}} />
      </MemoryRouter>,
    );

    expect(screen.getByRole("button", { name: /nfc/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /smart pages/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /report lab/i })).not.toBeInTheDocument();
  });

  it("hides logout for standalone gate installs", () => {
    authState.user = { name: "Gate Security", role: "SECURITY" };
    mockDisplayMode(true);

    render(
      <MemoryRouter initialEntries={["/nfc/gate"]}>
        <Topbar onMenuClick={() => {}} />
      </MemoryRouter>,
    );

    expect(screen.queryByRole("button", { name: /sign out/i })).not.toBeInTheDocument();
  });

  it("hides logout for standalone canteen installs", () => {
    authState.user = { name: "Cashier", role: "CANTEEN" };
    mockDisplayMode(true);

    render(
      <MemoryRouter initialEntries={["/nfc/canteen"]}>
        <Topbar onMenuClick={() => {}} />
      </MemoryRouter>,
    );

    expect(screen.queryByRole("button", { name: /sign out/i })).not.toBeInTheDocument();
  });
});
