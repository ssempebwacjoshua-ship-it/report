import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DemoPage } from "../../pages/DemoPage";

const navigateMock = vi.hoisted(() => vi.fn());

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
  });

  it("Watch Demo buttons open the video modal without navigating to login", () => {
    render(<DemoPage />);

    const watchButtons = screen.getAllByRole("button", { name: /watch demo/i });
    expect(watchButtons.length).toBeGreaterThan(0);
    fireEvent.click(watchButtons[0]!);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it("Explore Report Lab is an anchor link that scrolls to #report-lab", () => {
    render(<DemoPage />);

    const link = screen.getByRole("link", { name: /explore report lab/i });
    expect(link).toHaveAttribute("href", "#report-lab");
  });

  it("Explore Smart Pages anchor in the hero scrolls to #smart-pages", () => {
    render(<DemoPage />);

    const link = screen.getByRole("link", { name: /^explore smart pages$/i });
    expect(link).toHaveAttribute("href", "#smart-pages");
  });

  it("Sign in buttons navigate to /login", () => {
    render(<DemoPage />);

    fireEvent.click(screen.getAllByRole("button", { name: /sign in/i })[0]!);
    expect(navigateMock).toHaveBeenCalledWith("/login");
  });

  it("navigation buttons route correctly", () => {
    render(<DemoPage />);

    fireEvent.click(screen.getByRole("button", { name: /features demo/i }));
    expect(navigateMock).toHaveBeenCalledWith("/features-demo");

    fireEvent.click(screen.getByRole("button", { name: /pricing/i }));
    expect(navigateMock).toHaveBeenCalledWith("/pricing");

    fireEvent.click(screen.getByRole("button", { name: /contact/i }));
    expect(navigateMock).toHaveBeenCalledWith("/contact");
  });

  it("no '10-minute' wording exists on the page", () => {
    render(<DemoPage />);

    expect(screen.queryByText(/10.minute/i)).toBeNull();
  });
});
