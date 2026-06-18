import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PricingPage } from "../../pages/PricingPage";

const navigateMock = vi.hoisted(() => vi.fn());

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

describe("PricingPage", () => {
  beforeEach(() => {
    navigateMock.mockReset();
  });

  it("renders the pricing packages and routes public actions", () => {
    render(
      <MemoryRouter initialEntries={["/pricing"]}>
        <PricingPage />
      </MemoryRouter>,
    );

    expect(screen.getByText("Simple packages for smart schools.")).toBeInTheDocument();
    expect(screen.getAllByText("Recommended")).toHaveLength(1);
    expect(screen.getByRole("link", { name: /request report lab pricing/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /request smart pages pricing/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /request bundle pricing/i })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /^sign in$/i })).toHaveLength(1);

    expect(screen.getByRole("button", { name: /^pricing$/i })).toHaveAttribute("aria-current", "page");

    fireEvent.click(screen.getAllByRole("button", { name: /watch demo/i })[0]!);
    expect(navigateMock).toHaveBeenCalledWith("/demo");

    fireEvent.click(screen.getByRole("button", { name: /contact/i }));
    expect(navigateMock).toHaveBeenCalledWith("/contact");

    fireEvent.click(screen.getAllByRole("button", { name: /^sign in$/i })[0]!);
    expect(navigateMock).toHaveBeenCalledWith("/login");
  });
});

