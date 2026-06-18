import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LawyerOnboardingPage } from "../../pages/lawyers/LawyerOnboardingPage";

const mocks = vi.hoisted(() => ({
  listPreferences: vi.fn(),
  savePreference: vi.fn(),
}));

vi.mock("../../client/documentOsClient", () => mocks);

describe("LawyerOnboardingPage", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.listPreferences.mockResolvedValue([]);
    mocks.savePreference.mockResolvedValue({ id: "pref-1", key: "lawyer.profile", value: {}, updatedAt: new Date().toISOString() });
  });

  it("loads and saves lawyer preferences", async () => {
    render(
      <MemoryRouter initialEntries={["/lawyers/onboarding"]}>
        <Routes>
          <Route path="/lawyers/onboarding" element={<LawyerOnboardingPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByText(/lawyer onboarding/i)).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText(/lawyer name/i), { target: { value: "Jane Lawyer" } });
    fireEvent.change(screen.getByLabelText(/firm name/i), { target: { value: "Acacia Legal" } });
    fireEvent.click(screen.getByRole("button", { name: "Contracts" }));
    fireEvent.click(screen.getByRole("button", { name: /save lawyer profile/i }));

    await waitFor(() => expect(mocks.savePreference).toHaveBeenCalledWith("lawyer.profile", expect.objectContaining({ name: "Jane Lawyer" })));
    expect(mocks.savePreference).toHaveBeenCalledWith("lawyer.firm", expect.objectContaining({ name: "Acacia Legal" }));
    expect(mocks.savePreference).toHaveBeenCalledWith("lawyer.practiceAreas", expect.arrayContaining(["Contracts"]));
  });
});

