import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PreferencesPage } from "../../pages/smart-pages/PreferencesPage";

const mocks = vi.hoisted(() => ({
  listPreferences: vi.fn(),
  savePreference: vi.fn(),
}));

vi.mock("../../client/documentOsClient", () => mocks);

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/smart-pages/preferences"]}>
      <Routes>
        <Route path="/smart-pages/preferences" element={<PreferencesPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("PreferencesPage — school Smart Pages", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.savePreference.mockResolvedValue({
      id: "pref-1",
      key: "defaultTone",
      value: "Formal",
      updatedAt: new Date().toISOString(),
    });
  });

  it("does not render any key starting with LAWYER.", async () => {
    mocks.listPreferences.mockResolvedValue([
      { id: "p1", key: "primaryColor", value: "#2563eb", updatedAt: new Date().toISOString() },
      { id: "p2", key: "defaultTone", value: "Formal", updatedAt: new Date().toISOString() },
      // These must be absent even if the API returned them
      { id: "p3", key: "lawyer.firm", value: { name: "Acacia Legal" }, updatedAt: new Date().toISOString() },
      { id: "p4", key: "LAWYER.PROFILE", value: { name: "Jane" }, updatedAt: new Date().toISOString() },
    ]);

    renderPage();

    await waitFor(() => expect(screen.getByText("primaryColor")).toBeInTheDocument());
    expect(screen.queryByText(/lawyer\./i)).not.toBeInTheDocument();
    expect(screen.queryByText(/LAWYER/)).not.toBeInTheDocument();
  });

  it("passes scope=school to the listPreferences call", async () => {
    mocks.listPreferences.mockResolvedValue([]);
    renderPage();
    await waitFor(() =>
      expect(mocks.listPreferences).toHaveBeenCalledWith("school", {
        authMode: "school",
      }),
    );
  });

  it("does not display [object Object] for object-valued preferences", async () => {
    mocks.listPreferences.mockResolvedValue([
      {
        id: "p5",
        key: "someObjectPref",
        value: { nested: "value", count: 42 },
        updatedAt: new Date().toISOString(),
      },
    ]);

    renderPage();

    await waitFor(() => expect(screen.getByText("someObjectPref")).toBeInTheDocument());
    expect(screen.queryByText("[object Object]")).not.toBeInTheDocument();
    expect(screen.getByText(/nested.*value/i) ?? screen.queryByText(/"nested"/)).toBeTruthy();
  });

  it("shows only school-oriented keys in the key dropdown", () => {
    mocks.listPreferences.mockResolvedValue([]);
    renderPage();

    const select = screen.getByRole("combobox");
    const options = Array.from(select.querySelectorAll("option")).map((o) => o.value);
    expect(options.some((o) => o.toLowerCase().startsWith("lawyer."))).toBe(false);
    expect(options).toContain("primaryColor");
    expect(options).toContain("defaultTone");
    expect(options).toContain("defaultLanguage");
    expect(options).toContain("defaultPaperSize");
  });

  it("renders saved school preferences without lawyer keys", async () => {
    mocks.listPreferences.mockResolvedValue([
      { id: "p6", key: "defaultLanguage", value: "French", updatedAt: new Date().toISOString() },
      { id: "p7", key: "defaultPaperSize", value: "A4", updatedAt: new Date().toISOString() },
    ]);

    renderPage();

    await waitFor(() => expect(screen.getByText("defaultLanguage")).toBeInTheDocument());
    expect(screen.getByText("French")).toBeInTheDocument();
    expect(screen.getByText("A4")).toBeInTheDocument();
    expect(screen.queryByText(/lawyer/i)).not.toBeInTheDocument();
  });
});
