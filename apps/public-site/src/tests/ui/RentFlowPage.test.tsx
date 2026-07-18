import "@testing-library/jest-dom/vitest";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RentFlowPage } from "../../pages/RentFlowPage";
import { getSeoForPathname } from "../../config/seo";

const appRoot = resolve(__dirname, "../../..");

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
    expect(screen.getByRole("heading", { name: "Property and rental management software built for Uganda." })).toBeInTheDocument();
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

    expect(seo.title).toBe("RentFlow Property Management Software Uganda | SSAMENJ");
    expect(seo.description).toBe(
      "Manage rentals, tenants, bookings, rent payments, maintenance, and occupancy with SSAMENJ RentFlow, property management software built for Uganda.",
    );
    expect(seo.canonicalPath).toBe("/rentflow");
    expect(seo.structuredData).toBeDefined();

    expect(rentalsSeo.canonicalPath).toBe("/rentflow");
    expect(rentalsSeo.title).toBe(seo.title);
    expect(rentalsSeo.description).toBe(seo.description);
  });

  it("keeps RentFlow in the sitemap and leaves robots.txt permissive", () => {
    const sitemap = readFileSync(join(appRoot, "public/sitemap.xml"), "utf8");
    const robots = readFileSync(join(appRoot, "public/robots.txt"), "utf8");

    expect(sitemap).toContain("<loc>https://ssamenj.vercel.app/rentflow</loc>");
    expect(sitemap).not.toContain("localhost");
    expect(sitemap).not.toContain("/api/");
    expect(robots).toContain("Allow: /");
    expect(robots).toContain("Sitemap: https://ssamenj.vercel.app/sitemap.xml");
    expect(robots).not.toContain("Disallow: /rentflow");
  });
});
