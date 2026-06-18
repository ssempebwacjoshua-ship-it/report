import { fireEvent, render, screen } from "@testing-library/react";
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
    render(<PricingPage />);

    expect(screen.getByText("Simple packages for smart schools.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /request report lab pricing/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /request smart pages pricing/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /request bundle pricing/i })).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole("button", { name: /watch demo/i })[0]!);
    expect(navigateMock).toHaveBeenCalledWith("/demo");

    fireEvent.click(screen.getByRole("button", { name: /contact/i }));
    expect(navigateMock).toHaveBeenCalledWith("/contact");

    fireEvent.click(screen.getAllByRole("button", { name: /^sign in$/i })[0]!);
    expect(navigateMock).toHaveBeenCalledWith("/login");
  });
});
