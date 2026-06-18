import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { Topbar } from "../../components/layout/Topbar";

const logoutMock = vi.fn();

vi.mock("../../contexts/AuthContext", () => ({
  useAuth: () => ({ user: { name: "Test Admin" }, logout: logoutMock }),
}));

describe("Topbar navigation + logout", () => {
  it("renders the product switcher", () => {
    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <Topbar onMenuClick={() => {}} sidebarCollapsed={false} />
      </MemoryRouter>,
    );

    expect(screen.getByRole("button", { name: /report lab/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /smart pages/i })).toBeInTheDocument();
  });

  it("renders a visible logout button and calls logout on click", async () => {
    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <Topbar onMenuClick={() => {}} sidebarCollapsed={false} />
      </MemoryRouter>,
    );
    const logoutButton = screen.getByRole("button", { name: /sign out/i });
    expect(logoutButton).toBeInTheDocument();
    await userEvent.click(logoutButton);
    expect(logoutMock).toHaveBeenCalled();
  });

  it("renders the menu button for mobile navigation", () => {
    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <Topbar onMenuClick={() => {}} sidebarCollapsed={false} />
      </MemoryRouter>,
    );
    expect(screen.getByRole("button", { name: /open navigation/i })).toBeInTheDocument();
  });
});
