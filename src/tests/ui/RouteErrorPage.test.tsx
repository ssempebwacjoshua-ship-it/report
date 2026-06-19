import { render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { RouteErrorPage } from "../../pages/RouteErrorPage";

describe("RouteErrorPage", () => {
  it("shows lawyer-specific fallback branding on lawyer routes", async () => {
    const router = createMemoryRouter([
      {
        path: "/lawyers",
        errorElement: <RouteErrorPage />,
        children: [
          {
            path: "oops",
            loader: () => {
              throw new Response("Lawyer route failed", { status: 404 });
            },
            element: <div>Never rendered</div>,
          },
        ],
      },
    ], { initialEntries: ["/lawyers/oops"] });

    render(<RouterProvider router={router} />);

    expect(await screen.findByText(/smart pages for lawyers/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /go to lawyer dashboard/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /go to lawyer documents/i })).toBeInTheDocument();
  });
});
