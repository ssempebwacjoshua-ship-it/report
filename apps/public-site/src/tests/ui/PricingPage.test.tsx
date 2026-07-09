import "@testing-library/jest-dom/vitest";
import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PricingPage } from "../../pages/PricingPage";

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    Link: ({ to, children, ...props }: { to: string; children: ReactNode }) => (
      <a href={to} {...props}>
        {children}
      </a>
    ),
  };
});

function readWhatsAppMessage(href: string) {
  return new URL(href).searchParams.get("text") ?? "";
}

describe("PricingPage annual licence pricing", () => {
  it("renders annual licence cards and year-one checkout breakdowns", () => {
    render(<PricingPage />);

    expect(
      screen.getByRole("heading", { name: "Annual school licence for School Connect Report Lab & Smart Pages." }),
    ).toBeInTheDocument();
    expect(screen.getByText("Annual Plans")).toBeInTheDocument();
    expect(screen.getAllByText("ANNUAL LICENCE")).toHaveLength(4);
    expect(screen.getAllByText("Most Popular")).toHaveLength(1);

    expect(screen.getAllByText("Standard: UGX 800,000")).toHaveLength(2);
    expect(screen.getAllByText("Launch Offer: UGX 500,000")).toHaveLength(2);
    expect(screen.getAllByText("Standard: UGX 1,500,000")).toHaveLength(2);
    expect(screen.getAllByText("Launch Offer: UGX 1,000,000")).toHaveLength(2);

    const getStartedLinks = screen.getAllByRole("link", { name: "Get Started" });
    expect(getStartedLinks).toHaveLength(4);

    const firstPlan = readWhatsAppMessage(getStartedLinks[0]?.getAttribute("href") ?? "");
    expect(firstPlan).toContain("Annual Licence: UGX 900,000");
    expect(firstPlan).toContain("One-Time Setup Fee: UGX 500,000\nLaunch Setup Saving: UGX 300,000");
    expect(firstPlan).toContain("First Year Total: UGX 1,400,000");

    const popularPlan = readWhatsAppMessage(getStartedLinks[1]?.getAttribute("href") ?? "");
    expect(popularPlan).toContain("Annual Licence: UGX 1,800,000");
    expect(popularPlan).toContain("One-Time Setup Fee: UGX 500,000\nLaunch Setup Saving: UGX 300,000");
    expect(popularPlan).toContain("First Year Total: UGX 2,300,000");
  });
});



