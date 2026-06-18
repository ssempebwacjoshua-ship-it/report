import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppShell } from "../../components/layout/AppShell";
import { defaultSettingsSections, type SettingsResponse } from "../../shared/types/settings";

const authState = vi.hoisted(() => ({
  user: null as null | { id: string; name: string; role: "ADMIN_OPERATOR" },
  token: null as string | null,
  loading: false,
}));

const mockFetchSettings = vi.hoisted(() => vi.fn());

vi.mock("../../contexts/AuthContext", () => ({
  useAuth: () => ({
    user: authState.user,
    token: authState.token,
    loading: authState.loading,
    login: vi.fn(),
    logout: vi.fn(),
  }),
}));

vi.mock("../../client/settingsClient", () => ({
  fetchSettings: mockFetchSettings,
}));

function makeSettings(): SettingsResponse {
  return {
    schoolCode: "SCU-PREVIEW",
    sections: defaultSettingsSections,
    updatedAt: null,
    updatedBy: null,
  };
}

function renderShell() {
  return render(
    <MemoryRouter initialEntries={["/dashboard"]}>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/dashboard" element={<div>Dashboard Content</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe("AppShell workspace loading", () => {
  beforeEach(() => {
    mockFetchSettings.mockReset();
    authState.user = null;
    authState.token = null;
    authState.loading = false;
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation(() => ({
        matches: false,
        media: "",
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  });

  it("shows auth loading while auth is loading", () => {
    authState.loading = true;

    renderShell();

    expect(screen.getByText("Loading...")).toBeInTheDocument();
    expect(mockFetchSettings).not.toHaveBeenCalled();
  });

  it("shows workspace loading and hides the sidebar until settings are ready", async () => {
    authState.user = { id: "u1", name: "Test Admin", role: "ADMIN_OPERATOR" };
    authState.token = "tok";

    let resolveSettings!: (value: SettingsResponse) => void;
    mockFetchSettings.mockReturnValueOnce(
      new Promise<SettingsResponse>((resolve) => {
        resolveSettings = resolve;
      }),
    );

    renderShell();

    expect(await screen.findByText("Loading school workspace...")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Report Lab" })).not.toBeInTheDocument();

    await act(async () => {
      resolveSettings(makeSettings());
    });

    await waitFor(() => expect(screen.getByRole("button", { name: "Report Lab" })).toBeInTheDocument());
    expect(screen.getByText("Dashboard Content")).toBeInTheDocument();
  });

  it("shows a retry state when settings load fails and recovers after retry", async () => {
    authState.user = { id: "u1", name: "Test Admin", role: "ADMIN_OPERATOR" };
    authState.token = "tok";
    mockFetchSettings
      .mockRejectedValueOnce(new Error("temporary network issue"))
      .mockRejectedValueOnce(new Error("temporary network issue"))
      .mockResolvedValueOnce(makeSettings());

    renderShell();

    expect(await screen.findByText("Could not load school workspace.")).toBeInTheDocument();
    expect(screen.getByText("temporary network issue")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Retry" }));

    await waitFor(() => expect(screen.getByRole("button", { name: "Report Lab" })).toBeInTheDocument());
    expect(mockFetchSettings).toHaveBeenCalledTimes(3);
  });
});

