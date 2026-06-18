import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { SettingsPage } from "../../pages/SettingsPage";
import { SettingsClientError, fetchSettings, patchSettingsSection } from "../../client/settingsClient";
import { defaultSettingsSections } from "../../shared/types/settings";
import type { SchoolStructureData } from "../../client/schoolStructureClient";
import { fetchSchoolStructure } from "../../client/schoolStructureClient";

vi.mock("../../client/settingsClient", () => ({
  fetchSettings: vi.fn(),
  patchSettingsSection: vi.fn(),
  SettingsClientError: class SettingsClientError extends Error {
    fieldErrors: Record<string, string[]> | null;

    status: number;

    constructor(message: string, status: number, fieldErrors: Record<string, string[]> | null = null) {
      super(message);
      this.name = "SettingsClientError";
      this.status = status;
      this.fieldErrors = fieldErrors;
    }
  },
}));

vi.mock("../../client/schoolStructureClient", () => ({
  fetchSchoolStructure: vi.fn(),
  updateSchoolStructure: vi.fn(),
  createSchoolStream: vi.fn(),
  deleteSchoolStream: vi.fn(),
}));

const MOCK_STRUCTURE: SchoolStructureData = {
  success: true,
  school: { id: "s1", code: "SCU-PREVIEW", name: "Preview School" },
  selectedSections: ["SECONDARY"],
  availableSections: [
    { code: "NURSERY", label: "Nursery / Pre-primary" },
    { code: "PRIMARY", label: "Primary" },
    { code: "SECONDARY", label: "Secondary" },
  ],
  canonicalClasses: [],
  streamsByClass: {},
  lockWarnings: {},
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(fetchSchoolStructure).mockResolvedValue(MOCK_STRUCTURE);
});

describe("SettingsPage", () => {
  it("shows the School Structure tab", async () => {
    vi.mocked(fetchSettings).mockResolvedValue({
      schoolCode: "SCU-PREVIEW",
      sections: defaultSettingsSections,
      updatedAt: null,
      updatedBy: null,
    });

    render(<SettingsPage />);

    expect(await screen.findByRole("button", { name: "School Structure" })).toBeInTheDocument();
  });

  it("clicking School Structure tab renders SchoolStructureSection", async () => {
    vi.mocked(fetchSettings).mockResolvedValue({
      schoolCode: "SCU-PREVIEW",
      sections: defaultSettingsSections,
      updatedAt: null,
      updatedBy: null,
    });

    render(<SettingsPage />);

    const tab = await screen.findByRole("button", { name: "School Structure" });
    fireEvent.click(tab);

    await waitFor(() => {
      expect(fetchSchoolStructure).toHaveBeenCalled();
    });
  });

  it("shows inline field errors for invalid school profile values", async () => {
    vi.mocked(fetchSettings).mockResolvedValue({
      schoolCode: "SCU-PREVIEW",
      sections: defaultSettingsSections,
      updatedAt: null,
      updatedBy: null,
    });
    vi.mocked(patchSettingsSection).mockRejectedValue(
      new SettingsClientError("Invalid request", 400, {
        email: ["Enter a valid email address or leave blank."],
      }),
    );

    render(<SettingsPage />);

    const emailInput = await screen.findByLabelText("Email");
    fireEvent.change(emailInput, { target: { value: "bad-email" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(patchSettingsSection).toHaveBeenCalled());
    expect(await screen.findByText("Enter a valid email address or leave blank.")).toBeInTheDocument();
    expect(screen.queryByText("Invalid request")).not.toBeInTheDocument();
  });
});

