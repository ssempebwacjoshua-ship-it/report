import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SettingsProvider, useAppSettings } from "../../components/layout/SettingsContext";
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

function Probe() {
  const settingsState = useAppSettings();
  if (!settingsState) return null;
  return (
    <div>
      <p data-testid="loading">{String(settingsState.loading)}</p>
      <p data-testid="error">{settingsState.error ?? ""}</p>
      <p data-testid="school-code">{settingsState.settings?.schoolCode ?? ""}</p>
      <button type="button" onClick={() => void settingsState.refreshSettings()}>
        Refresh
      </button>
    </div>
  );
}

describe("SettingsContext", () => {
  beforeEach(() => {
    mockFetchSettings.mockReset();
    authState.user = null;
    authState.token = null;
    authState.loading = false;
  });

  it("exposes loading, error, and retry state when the first load fails", async () => {
    authState.user = { id: "u1", name: "Test Admin", role: "ADMIN_OPERATOR" };
    authState.token = "tok";
    mockFetchSettings
      .mockRejectedValueOnce(new Error("temporary network issue"))
      .mockRejectedValueOnce(new Error("temporary network issue"))
      .mockResolvedValueOnce(makeSettings());

    render(
      <SettingsProvider>
        <Probe />
      </SettingsProvider>,
    );

    expect(screen.getByTestId("loading")).toHaveTextContent("true");
    await waitFor(() => expect(screen.getByTestId("loading")).toHaveTextContent("false"));
    expect(screen.getByTestId("loading")).toHaveTextContent("false");
    expect(screen.getByTestId("error")).toHaveTextContent("temporary network issue");

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
    });

    await waitFor(() => expect(screen.getByTestId("school-code")).toHaveTextContent("SCU-PREVIEW"));
    expect(screen.getByTestId("error")).toHaveTextContent("");
  });

  it("refetches settings when auth token changes", async () => {
    authState.user = { id: "u1", name: "Test Admin", role: "ADMIN_OPERATOR" };
    authState.token = "tok-1";
    mockFetchSettings.mockResolvedValue(makeSettings());

    const view = render(
      <SettingsProvider>
        <Probe />
      </SettingsProvider>,
    );

    await waitFor(() => expect(mockFetchSettings).toHaveBeenCalledTimes(1));

    authState.token = "tok-2";
    view.rerender(
      <SettingsProvider>
        <Probe />
      </SettingsProvider>,
    );

    await waitFor(() => expect(mockFetchSettings).toHaveBeenCalledTimes(2));
  });
});

