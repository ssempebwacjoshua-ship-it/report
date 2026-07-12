import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LoginPage } from "../../pages/LoginPage";

const navigateMock = vi.hoisted(() => vi.fn());
const loginMock = vi.hoisted(() => vi.fn());

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

vi.mock("../../contexts/AuthContext", () => ({
  useAuth: () => ({ login: loginMock }),
}));

describe("LoginPage", () => {
  beforeEach(() => {
    navigateMock.mockReset();
    loginMock.mockReset();
  });

  it.each([
    ["ADMIN_OPERATOR", "/dashboard"],
    ["SECURITY", "/nfc/gate"],
    ["GATE_SECURITY", "/nfc/gate"],
  ] as const)("redirects %s users to %s", async (role, expectedPath) => {
    loginMock.mockResolvedValueOnce({
      id: "user-1",
      schoolId: "school-1",
      name: "Gate Security",
      email: "gate@test.com",
      role,
      isPlatformOwner: false,
    });

    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    );

    await user.type(screen.getByLabelText(/school code/i), "SCU-PREVIEW");
    await user.type(screen.getByLabelText(/email address/i), "gate@test.com");
    await user.type(screen.getByLabelText(/password/i), "password123");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    expect(loginMock).toHaveBeenCalledWith("gate@test.com", "password123", "SCU-PREVIEW");
    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith(expectedPath, { replace: true }));
  });

  it("submits school code as uppercase trimmed code", async () => {
    loginMock.mockResolvedValueOnce({
      id: "user-1",
      schoolId: "school-1",
      name: "Admin",
      email: "admin@test.com",
      role: "ADMIN_OPERATOR",
      isPlatformOwner: false,
    });

    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    );

    await user.type(screen.getByLabelText(/school code/i), "scu-preview");
    await user.type(screen.getByLabelText(/email address/i), "admin@test.com");
    await user.type(screen.getByLabelText(/password/i), "password123");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    expect(loginMock).toHaveBeenCalledWith("admin@test.com", "password123", "SCU-PREVIEW");
  });
});
