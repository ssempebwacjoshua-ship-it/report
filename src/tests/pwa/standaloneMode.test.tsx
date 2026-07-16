import { act, render, screen, waitFor } from "@testing-library/react";
import { BrowserRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildAppUrl,
  getDedicatedWorkspaceHomeForRole,
  getDedicatedWorkspaceKindForRole,
  normalizeDedicatedPwaLaunchPath,
} from "../../pwa/standaloneMode";
import { useDedicatedPwaNavigationGuard } from "../../pwa/useDedicatedPwaNavigationGuard";

function DedicatedHarness({ role }: { role: "SECURITY" | "CANTEEN" }) {
  useDedicatedPwaNavigationGuard(role);
  const location = useLocation();
  return <div>Current route: {location.pathname}</div>;
}

function mockDisplayMode(standalone: boolean) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: query === "(display-mode: standalone)" ? standalone : false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

function renderHarness(role: "SECURITY" | "CANTEEN") {
  return render(
    <BrowserRouter>
      <Routes>
        <Route path="*" element={<DedicatedHarness role={role} />} />
      </Routes>
    </BrowserRouter>,
  );
}

describe("standalone PWA navigation guard", () => {
  beforeEach(() => {
    mockDisplayMode(true);
    window.history.replaceState({}, "", "/nfc/gate");
  });

  it("maps dedicated roles to their operational home routes", () => {
    expect(getDedicatedWorkspaceHomeForRole("SECURITY")).toBe("/nfc/gate");
    expect(getDedicatedWorkspaceHomeForRole("CANTEEN")).toBe("/nfc/canteen");
    expect(getDedicatedWorkspaceKindForRole("SECURITY")).toBe("gate");
    expect(getDedicatedWorkspaceKindForRole("CANTEEN")).toBe("canteen");
    expect(normalizeDedicatedPwaLaunchPath("/gate/nfc/token-1")).toBe("/nfc/gate");
    expect(normalizeDedicatedPwaLaunchPath("/nfc/wallets/transactions")).toBe("/nfc/canteen");
  });

  it("builds app URLs under the report-lab basename", () => {
    expect(buildAppUrl("/nfc/gate")).toContain("/report-lab/nfc/gate");
  });

  it("recovers standalone gate launches back to the main gate route", async () => {
    window.history.replaceState({}, "", "/gate/nfc/token-1");

    renderHarness("SECURITY");

    await waitFor(() => expect(screen.getByText("Current route: /nfc/gate")).toBeInTheDocument());
  });

  it("traps browser back inside the standalone gate workspace", async () => {
    window.history.replaceState({}, "", "/pwa-launch");
    window.history.pushState({}, "", "/nfc/gate");

    renderHarness("SECURITY");
    await waitFor(() => expect(screen.getByText("Current route: /nfc/gate")).toBeInTheDocument());

    await act(async () => {
      window.history.back();
      window.dispatchEvent(new PopStateEvent("popstate"));
    });

    await waitFor(() => expect(screen.getByText("Current route: /nfc/gate")).toBeInTheDocument());
  });
});
