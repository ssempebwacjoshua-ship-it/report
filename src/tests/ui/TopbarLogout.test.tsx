import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { Topbar } from "../../components/layout/Topbar";

const logoutMock = vi.fn();

vi.mock("../../contexts/AuthContext", () => ({
  useAuth: () => ({ user: { name: "Test Admin" }, logout: logoutMock }),
}));

describe("Topbar (mobile nav + logout)", () => {
  it("renders a visible logout button and calls logout on click", async () => {
    render(
      <MemoryRouter>
        <Topbar onMenuClick={() => {}} sidebarCollapsed={false} />
      </MemoryRouter>
    );
    const logoutButton = screen.getByRole("button", { name: /sign out/i });
    expect(logoutButton).toBeInTheDocument();
    await userEvent.click(logoutButton);
    expect(logoutMock).toHaveBeenCalled();
  });

  it("renders the menu button for mobile navigation", () => {
    render(
      <MemoryRouter>
        <Topbar onMenuClick={() => {}} sidebarCollapsed={false} />
      </MemoryRouter>
    );
    expect(screen.getByRole("button", { name: /open navigation/i })).toBeInTheDocument();
  });
});
