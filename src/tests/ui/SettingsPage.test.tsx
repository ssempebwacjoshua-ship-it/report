import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SettingsPage } from "../../pages/SettingsPage";
import { SettingsClientError, fetchSettings, patchSettingsSection } from "../../client/settingsClient";
import { defaultSettingsSections } from "../../shared/types/settings";

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

describe("SettingsPage", () => {
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
