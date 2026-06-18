import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LawyerShell } from "../../components/lawyers/LawyerShell";
import { LawyerDashboardPage } from "../../pages/lawyers/LawyerDashboardPage";

const authMocks = vi.hoisted(() => ({
  useAuth: vi.fn(),
}));

const documentMocks = vi.hoisted(() => ({
  listDocuments: vi.fn(),
  createDocument: vi.fn(),
}));

vi.mock("../../contexts/AuthContext", () => authMocks);
vi.mock("../../client/documentIntelligenceClient", () => documentMocks);

describe("LawyerDashboardPage", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    authMocks.useAuth.mockReturnValue({
      user: { id: "user-1", name: "Jane Lawyer", email: "jane@example.com", role: "ADMIN_OPERATOR" },
      loading: false,
      logout: vi.fn(),
    });
    documentMocks.listDocuments.mockResolvedValue([]);
    documentMocks.createDocument.mockResolvedValue({ id: "doc-1" });
  });

  it("navigates to onboarding from the hero action", async () => {
    const router = createMemoryRouter([
      {
        path: "/lawyers",
        element: <LawyerShell />,
        children: [
          { path: "dashboard", element: <LawyerDashboardPage /> },
          { path: "onboarding", element: <div>Onboarding</div> },
          { path: "documents", element: <div>Documents</div> },
        ],
      },
    ], { initialEntries: ["/lawyers/dashboard"] });

    const user = userEvent.setup();
    render(<RouterProvider router={router} />);

    await screen.findByText(/built for ugandan legal practice/i);

    await user.click(screen.getByRole("link", { name: /start onboarding/i }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/lawyers/onboarding"));
  });

  it("navigates to documents from the hero action", async () => {
    const router = createMemoryRouter([
      {
        path: "/lawyers",
        element: <LawyerShell />,
        children: [
          { path: "dashboard", element: <LawyerDashboardPage /> },
          { path: "onboarding", element: <div>Onboarding</div> },
          { path: "documents", element: <div>Documents</div> },
        ],
      },
    ], { initialEntries: ["/lawyers/dashboard"] });

    const user = userEvent.setup();
    render(<RouterProvider router={router} />);

    await screen.findByText(/built for ugandan legal practice/i);

    await user.click(screen.getByRole("link", { name: /view documents/i }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/lawyers/documents"));
  });
});
