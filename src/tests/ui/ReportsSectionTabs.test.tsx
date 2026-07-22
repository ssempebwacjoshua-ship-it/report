import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { ReportsSectionTabs } from "../../components/reports/ReportsSectionTabs";

function renderTabs(pathname: string) {
  render(
    <MemoryRouter initialEntries={[pathname]}>
      <ReportsSectionTabs />
    </MemoryRouter>,
  );
}

describe("ReportsSectionTabs", () => {
  it("renders all reporting workflow links", () => {
    renderTabs("/reports");

    expect(screen.getByRole("link", { name: "Reports" })).toHaveAttribute("href", "/reports");
    expect(screen.getByRole("link", { name: "Marks Import" })).toHaveAttribute("href", "/imports/marks");
    expect(screen.getByRole("link", { name: "Marksheets" })).toHaveAttribute("href", "/marksheets");
    expect(screen.getByRole("link", { name: "Release" })).toHaveAttribute("href", "/reports/release");
    expect(screen.getByRole("link", { name: "Promotions" })).toHaveAttribute("href", "/promotions");
  });

  it.each([
    ["/reports", "Reports"],
    ["/imports/marks", "Marks Import"],
    ["/marksheets", "Marksheets"],
    ["/reports/release", "Release"],
    ["/promotions", "Promotions"],
  ])("marks %s as the active tab", (pathname, activeLabel) => {
    renderTabs(pathname);

    expect(screen.getByRole("link", { name: activeLabel })).toHaveAttribute("aria-current", "page");
  });
});
