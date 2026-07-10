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
  it("renders the RentFlow marketing page content and visual sections", () => {
    render(<RentFlowPage />);

    expect(screen.getByText("SSAMENJ RentFlow")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Manage rentals, Airbnb rooms, shops, and apartments from one system." })).toBeInTheDocument();
    expect(screen.getByText("Portfolio dashboard")).toBeInTheDocument();
    expect(screen.getAllByText("Occupancy")).toHaveLength(1);
    expect(screen.getAllByText("Bookings today")).toHaveLength(1);
    expect(screen.getAllByText("Payments collected")).toHaveLength(1);
    expect(screen.getAllByText("Pending balances")).toHaveLength(2);
    expect(screen.getAllByText("Cleaning tasks")).toHaveLength(1);
    expect(screen.getByText("Checkout balance")).toBeInTheDocument();
    expect(screen.getAllByText("Today's bookings")).toHaveLength(2);
    expect(screen.getByRole("heading", { name: "Built for phone-first property operations." })).toBeInTheDocument();
    expect(screen.getAllByText("Launch offer").length).toBeGreaterThanOrEqual(5);
    expect(screen.getByText("Starter")).toBeInTheDocument();
    expect(screen.getByText("Standard")).toBeInTheDocument();
    expect(screen.getByText("Growth")).toBeInTheDocument();
    expect(screen.getByText("Business")).toBeInTheDocument();
    expect(screen.getByText("Enterprise")).toBeInTheDocument();
    expect(
      screen.getByText("Wi-Fi smart lights and sockets are optional installation add-ons, quoted separately."),
    ).toBeInTheDocument();
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
