import "@testing-library/jest-dom/vitest";
import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RentFlowPage } from "../../pages/RentFlowPage";
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

describe("RentFlow public website", () => {
  it("renders the RentFlow marketing page content", () => {
    render(<RentFlowPage />);

    expect(screen.getByText("SSAMENJ RentFlow")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Manage rentals, Airbnb rooms, shops, and apartments from one system." })).toBeInTheDocument();
    expect(screen.getAllByText("First month free — setup fee applies.")).toHaveLength(2);
    expect(screen.getByText("Bookings and tenants")).toBeInTheDocument();
    expect(screen.getAllByText("Owner statements")).toHaveLength(2);
  });

  it("exposes RentFlow SEO metadata and aliases rentals to rentflow", () => {
    const seo = getSeoForPathname("/rentflow");
    const rentalsSeo = getSeoForPathname("/rentals");

    expect(seo.title).toBe("SSAMENJ RentFlow - Rental and Property Management Software Uganda");
    expect(seo.description).toBe(
      "SSAMENJ RentFlow helps Uganda property owners manage Airbnb rooms, residential rentals, commercial shops, payments, deposits, maintenance, cleaning, and owner statements.",
    );
    expect(seo.canonicalPath).toBe("/rentflow");
    expect(seo.structuredData).toBeDefined();

    expect(rentalsSeo.canonicalPath).toBe("/rentflow");
    expect(rentalsSeo.title).toBe(seo.title);
    expect(rentalsSeo.description).toBe(seo.description);
  });
});
