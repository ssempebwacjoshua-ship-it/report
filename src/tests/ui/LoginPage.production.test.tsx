import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { LoginPage } from "../../pages/LoginPage";
const navigateMock = vi.hoisted(() => vi.fn());

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

vi.mock("../../contexts/AuthContext", () => ({
  useAuth: () => ({ login: vi.fn() }),
}));

vi.mock("../../shared/runtimeMode", () => ({
  isDemoRuntime: () => false,
}));

describe("LoginPage production mode", () => {
  it("does not show local demo credentials", () => {
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    );

    expect(screen.queryByText(/local demo credentials/i)).not.toBeInTheDocument();
    expect(screen.queryByText("admin@schoolconnect.test")).not.toBeInTheDocument();
    expect(screen.queryByText("password123")).not.toBeInTheDocument();
  });
});
