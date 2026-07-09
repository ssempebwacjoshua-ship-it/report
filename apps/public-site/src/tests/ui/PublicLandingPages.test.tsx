import "@testing-library/jest-dom/vitest";
import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CashlessCanteenPage } from "../../pages/CashlessCanteenPage";
import { StayOsPage } from "../../pages/StayOsPage";
import { getSeoForPathname } from "../../config/seo";

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

describe("Public keyword landing pages", () => {
  it("renders the cashless canteen landing page and SEO metadata", () => {
    render(<CashlessCanteenPage />);

    expect(screen.getByRole("heading", { name: "Cashless school canteen payments that stay easy for staff and clear for administrators." })).toBeInTheDocument();
    expect(screen.getByText("Cashless Canteen FAQ")).toBeInTheDocument();
    expect(screen.getAllByText("Request quotation").length).toBeGreaterThanOrEqual(1);

    const seo = getSeoForPathname("/cashless-canteen");
    expect(seo.title).toBe("Cashless School Canteen Uganda | Kids Wallet by SSAMENJ");
    expect(seo.canonicalPath).toBe("/cashless-canteen");
    expect(seo.structuredData).toBeDefined();
  });

  it("renders the StayOS landing page and SEO metadata", () => {
    render(<StayOsPage />);

    expect(screen.getByRole("heading", { name: "StayOS for rentals, short stays, and mixed property portfolios." })).toBeInTheDocument();
    expect(screen.getByText("StayOS FAQ")).toBeInTheDocument();
    expect(screen.getAllByText("Book a walkthrough").length).toBeGreaterThanOrEqual(1);

    const seo = getSeoForPathname("/stayos");
    expect(seo.title).toBe("StayOS | Property Operations Software by SSAMENJ");
    expect(seo.canonicalPath).toBe("/stayos");
    expect(seo.structuredData).toBeDefined();
  });
});
