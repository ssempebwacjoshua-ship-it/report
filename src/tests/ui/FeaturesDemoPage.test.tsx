import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FeaturesDemoPage } from "../../pages/FeaturesDemoPage";

const navigateMock = vi.hoisted(() => vi.fn());

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...actual, useNavigate: () => navigateMock };
});

function renderPage() {
  return render(
    <MemoryRouter>
      <FeaturesDemoPage />
    </MemoryRouter>,
  );
}

describe("FeaturesDemoPage", () => {
  beforeEach(() => {
    navigateMock.mockReset();
  });

  it("renders the public features demo hub with the playable video", () => {
    renderPage();

    expect(screen.getByRole("heading", { name: /features demo/i, level: 1 })).toBeInTheDocument();
    expect(screen.getByText(/watch focused demos of school connect report lab/i)).toBeInTheDocument();
    const iframe = screen.getByTitle(/school connect features demo/i);
    expect(iframe).toHaveAttribute("src", expect.stringContaining("jZrp-jOhjwo"));
  });

  it("renders the demo playlist cards", () => {
    renderPage();

    expect(screen.getAllByText(/report lab demo/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/smart pages demo/i).length).toBeGreaterThan(0);
    expect(screen.queryByText(/full system walkthrough/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/parent report links/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/owner console/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/printing & downloading/i)).not.toBeInTheDocument();
  });

  it("updates the main video when a playable card is selected", () => {
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: /report lab demo/i }));
    expect(screen.getByTitle(/school connect features demo - report lab demo/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /smart pages demo/i }));
    expect(screen.getByTitle(/school connect features demo - smart pages demo/i)).toBeInTheDocument();
    expect(screen.getByTitle(/school connect features demo - smart pages demo/i)).toHaveAttribute(
      "src",
      expect.stringContaining("F2kWYFQujK4"),
    );
    fireEvent.click(screen.getByRole("button", { name: /report lab demo/i }));
    expect(screen.getByTitle(/school connect features demo - report lab demo/i)).toHaveAttribute(
      "src",
      expect.stringContaining("jZrp-jOhjwo"),
    );
  });

  it("does not render placeholder cards", () => {
    renderPage();

    expect(screen.queryByText(/video coming soon/i)).not.toBeInTheDocument();
  });

  it("navigates to the expected public routes", () => {
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: /back to main demo/i }));
    expect(navigateMock).toHaveBeenCalledWith("/demo");

    fireEvent.click(screen.getByRole("button", { name: /open report lab/i }));
    expect(navigateMock).toHaveBeenCalledWith("/demo#report-lab");

    fireEvent.click(screen.getByRole("button", { name: /open smart pages/i }));
    expect(navigateMock).toHaveBeenCalledWith("/demo#smart-pages");
  });
});
