import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppShell } from "../../components/layout/AppShell";
import { useConnectivityStatus } from "../../hooks/useConnectivityStatus";
import { defaultSettingsSections, type SettingsResponse } from "../../shared/types/settings";

const authState = vi.hoisted(() => ({
  user: null as null | { id: string; name: string; role: "ADMIN_OPERATOR"; schoolId: string },
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

function ConnectivityConsumerPage() {
  const { state } = useConnectivityStatus("school-1", "device-1", "gate");
  return <div>Consumer state: {state}</div>;
}

function renderShell(initialEntries: string[] = ["/dashboard"]) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/dashboard" element={<div>Dashboard Content</div>} />
          <Route path="/smart-pages" element={<div>Smart Pages Content</div>} />
          <Route path="/nfc/gate" element={<ConnectivityConsumerPage />} />
          <Route path="/nfc/wristbands" element={<ConnectivityConsumerPage />} />
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

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("shows auth loading while auth is loading", () => {
    authState.loading = true;

    renderShell();

    expect(screen.getByText("Loading...")).toBeInTheDocument();
    expect(mockFetchSettings).not.toHaveBeenCalled();
  });

  it("shows workspace loading and hides the sidebar until settings are ready", async () => {
    authState.user = { id: "u1", name: "Test Admin", role: "ADMIN_OPERATOR", schoolId: "school-1" };
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
    authState.user = { id: "u1", name: "Test Admin", role: "ADMIN_OPERATOR", schoolId: "school-1" };
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

  it("shares one heartbeat coordinator between Topbar and an NFC consumer page", async () => {
    vi.useFakeTimers();
    authState.user = { id: "u1", name: "Test Admin", role: "ADMIN_OPERATOR", schoolId: "school-1" };
    authState.token = "tok";
    mockFetchSettings.mockResolvedValue(makeSettings());

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/health/ping")) {
        return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      if (url.includes("/api/nfc/offline/sync")) {
        return new Response(JSON.stringify({ batchId: "batch-1", results: [] }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      throw new Error(`Unexpected fetch ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    renderShell(["/nfc/gate"]);

    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByText(/Consumer state:/)).toBeInTheDocument();
    expect(fetchMock.mock.calls.filter(([input]) => String(input).includes("/api/health/ping")).length).toBe(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(12000);
    });

    expect(fetchMock.mock.calls.filter(([input]) => String(input).includes("/api/health/ping")).length).toBe(2);
  });

  it("keeps navigation responsive across repeated route changes", async () => {
    authState.user = { id: "u1", name: "Test Admin", role: "ADMIN_OPERATOR", schoolId: "school-1" };
    authState.token = "tok";
    mockFetchSettings.mockResolvedValue(makeSettings());
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "Content-Type": "application/json" } })));

    renderShell();

    await screen.findByText("Dashboard Content");

    for (let index = 0; index < 18; index += 1) {
      fireEvent.click(screen.getByRole("button", { name: "Smart Pages" }));
      await waitFor(() => expect(screen.getByText("Smart Pages Content")).toBeInTheDocument());

      fireEvent.click(screen.getByRole("button", { name: "NFC" }));
      await waitFor(() => expect(screen.getByText(/Consumer state:/)).toBeInTheDocument());

      fireEvent.click(screen.getByRole("button", { name: "Report Lab" }));
      await waitFor(() => expect(screen.getByText("Dashboard Content")).toBeInTheDocument());
    }

    expect(screen.getByRole("button", { name: "Smart Pages" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "NFC" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Report Lab" })).toBeEnabled();
  });

  it("closes the mobile sidebar and restores body overflow after route navigation", async () => {
    authState.user = { id: "u1", name: "Test Admin", role: "ADMIN_OPERATOR", schoolId: "school-1" };
    authState.token = "tok";
    mockFetchSettings.mockResolvedValue(makeSettings());
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "Content-Type": "application/json" } })));

    renderShell();

    await screen.findByText("Dashboard Content");

    fireEvent.click(screen.getByRole("button", { name: "Open navigation" }));
    await waitFor(() => expect(document.body.style.overflow).toBe("hidden"));

    fireEvent.click(screen.getByRole("link", { name: /reports/i }));

    await waitFor(() => expect(document.body.style.overflow).toBe(""));
  });
});
