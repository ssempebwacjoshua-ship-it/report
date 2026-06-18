import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DemoPage } from "../../pages/DemoPage";

const authState = vi.hoisted(() => ({
  user: null as null | { name: string; role: "ADMIN_OPERATOR" },
}));
const navigateMock = vi.hoisted(() => vi.fn());

vi.mock("../../contexts/AuthContext", () => ({
  useAuth: () => ({ user: authState.user, loading: false }),
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

describe("DemoPage", () => {
  beforeEach(() => {
    navigateMock.mockReset();
    authState.user = null;
  });

  it("routes public CTAs to the real login flow", () => {
    render(<DemoPage />);

    fireEvent.click(screen.getAllByRole("button", { name: /launch demo/i })[0]!);
    expect(navigateMock).toHaveBeenCalledWith("/login");

    fireEvent.click(screen.getByRole("button", { name: /pricing/i }));
    expect(navigateMock).toHaveBeenCalledWith("/pricing");

    fireEvent.click(screen.getByRole("button", { name: /contact/i }));
    expect(navigateMock).toHaveBeenCalledWith("/contact");

    fireEvent.click(screen.getAllByRole("button", { name: /explore report lab/i })[0]!);
    expect(navigateMock).toHaveBeenCalledWith("/login");

    fireEvent.click(screen.getAllByRole("button", { name: /^explore smart pages$/i })[0]!);
    expect(navigateMock).toHaveBeenCalledWith("/login");
  });

  it("sends signed-in users straight to Smart Pages", () => {
    authState.user = { name: "Test Admin", role: "ADMIN_OPERATOR" };

    render(<DemoPage />);

    fireEvent.click(screen.getAllByRole("button", { name: /^explore smart pages$/i })[0]!);
    expect(navigateMock).toHaveBeenCalledWith("/smart-pages");

    fireEvent.click(screen.getAllByRole("button", { name: /explore report lab/i })[0]!);
    expect(navigateMock).toHaveBeenCalledWith("/dashboard");
  });
});

