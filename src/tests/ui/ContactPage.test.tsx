import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { ContactPage } from "../../pages/ContactPage";

const navigateMock = vi.hoisted(() => vi.fn());

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

describe("ContactPage", () => {
  beforeEach(() => {
    navigateMock.mockReset();
  });

  it("shows the contact options and generates a mailto request from the form", () => {
    render(<ContactPage />);

    expect(screen.getByText(/let'?s help your school work smarter\./i)).toBeInTheDocument();
    expect(screen.getByText("Book a school demo")).toBeInTheDocument();
    expect(screen.getByText("Ask about pricing")).toBeInTheDocument();
    expect(screen.getByText("Setup support")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("School name"), { target: { value: "Sunrise Academy" } });

    const demoLink = screen.getByRole("link", { name: /request a demo/i });
    expect(demoLink).toHaveAttribute("href", expect.stringContaining("mailto:REPLACE_WITH_BUSINESS_EMAIL"));
    expect(demoLink).toHaveAttribute("href", expect.stringContaining("Sunrise%20Academy"));

    fireEvent.click(screen.getByRole("button", { name: /watch walkthrough/i }));
    expect(navigateMock).toHaveBeenCalledWith("/demo");

    fireEvent.click(screen.getAllByRole("button", { name: /^pricing$/i })[0]!);
    expect(navigateMock).toHaveBeenCalledWith("/pricing");

    fireEvent.click(screen.getAllByRole("button", { name: /^sign in$/i })[0]!);
    expect(navigateMock).toHaveBeenCalledWith("/login");
  });
});
