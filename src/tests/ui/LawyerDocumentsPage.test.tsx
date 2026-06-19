import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LawyerShell } from "../../components/lawyers/LawyerShell";
import { LawyerDocumentsPage } from "../../pages/lawyers/LawyerDocumentsPage";

const authMocks = vi.hoisted(() => ({
  useAuth: vi.fn(),
}));

const documentMocks = vi.hoisted(() => ({
  createDocument: vi.fn(),
  listDocuments: vi.fn(),
}));

vi.mock("../../contexts/AuthContext", () => authMocks);
vi.mock("../../client/documentIntelligenceClient", () => documentMocks);

describe("LawyerDocumentsPage", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    authMocks.useAuth.mockReturnValue({
      user: { id: "user-1", name: "School Admin", email: "jane@example.com", role: "ADMIN_OPERATOR" },
      loading: false,
      logout: vi.fn(),
    });
    documentMocks.listDocuments.mockResolvedValue([]);
    documentMocks.createDocument.mockResolvedValue({ id: "doc-1" });
  });

  it("opens the editor with a template query when a template card is used", async () => {
    const router = createMemoryRouter([
      {
        path: "/lawyers",
        element: <LawyerShell />,
        children: [
          { path: "documents", element: <LawyerDocumentsPage /> },
          { path: "documents/:id", element: <div>Editor</div> },
        ],
      },
    ], { initialEntries: ["/lawyers/documents"] });

    const user = userEvent.setup();
    render(<RouterProvider router={router} />);

    await screen.findByRole("heading", { name: /choose a lawyer template/i });
    expect(screen.queryByText(/school admin/i)).not.toBeInTheDocument();
    expect(screen.getByText(/legal admin/i)).toBeInTheDocument();
    expect(screen.getByText(/generated documents are drafts and must be reviewed/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /use client intake summary/i })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /use legal notice \/ demand letter/i }));

    await waitFor(() => expect(documentMocks.createDocument).toHaveBeenCalledWith("Legal Notice / Demand Letter"));
    await waitFor(() => expect(router.state.location.pathname).toBe("/lawyers/documents/doc-1"));
    expect(router.state.location.search).toBe("?template=legal-notice-demand-letter");
  });

  it("creates a blank legal document from the primary action", async () => {
    const router = createMemoryRouter([
      {
        path: "/lawyers",
        element: <LawyerShell />,
        children: [
          { path: "documents", element: <LawyerDocumentsPage /> },
          { path: "documents/:id", element: <div>Editor</div> },
        ],
      },
    ], { initialEntries: ["/lawyers/documents"] });

    const user = userEvent.setup();
    render(<RouterProvider router={router} />);

    await screen.findByRole("heading", { name: /^documents$/i });
    await user.click(screen.getByRole("button", { name: /new legal document/i }));

    await waitFor(() => expect(documentMocks.createDocument).toHaveBeenCalledWith("Untitled Legal Draft"));
    await waitFor(() => expect(router.state.location.pathname).toBe("/lawyers/documents/doc-1"));
  });
});
