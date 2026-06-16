import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { act } from "@testing-library/react";
import { InstallPrompt } from "../../components/pwa/InstallPrompt";

function mockMatchMedia(standalone: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockImplementation((query: string) => ({
      matches: query === "(display-mode: standalone)" ? standalone : false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  );
}

function makeInstallEvent() {
  const e = new Event("beforeinstallprompt");
  Object.assign(e, {
    prompt: vi.fn().mockResolvedValue(undefined),
    userChoice: Promise.resolve({ outcome: "accepted" }),
  });
  return e;
}

beforeEach(() => {
  localStorage.clear();
  mockMatchMedia(false);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("InstallPrompt", () => {
  it("renders nothing by default (no beforeinstallprompt, not iOS)", () => {
    const { container } = render(<InstallPrompt />);
    expect(container.firstChild).toBeNull();
  });

  it("shows the install banner when beforeinstallprompt fires", async () => {
    render(<InstallPrompt />);
    await act(async () => {
      window.dispatchEvent(makeInstallEvent());
    });
    expect(screen.getByText("Install School Connect Reports")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /install app/i })).toBeInTheDocument();
  });

  it("stores a timestamp dismissal and hides when Not now is clicked", async () => {
    render(<InstallPrompt />);
    await act(async () => {
      window.dispatchEvent(makeInstallEvent());
    });

    const before = Date.now();
    fireEvent.click(screen.getByRole("button", { name: /not now/i }));

    const stored = localStorage.getItem("sc_reports_pwa_install_dismissed");
    expect(stored).not.toBeNull();
    expect(Number(stored)).toBeGreaterThanOrEqual(before);
    expect(screen.queryByText("Install School Connect Reports")).not.toBeInTheDocument();
  });

  it("calls prompt() when Install app is clicked", async () => {
    const mockPrompt = vi.fn().mockResolvedValue(undefined);
    render(<InstallPrompt />);

    const e = new Event("beforeinstallprompt");
    Object.assign(e, { prompt: mockPrompt, userChoice: Promise.resolve({ outcome: "accepted" }) });
    await act(async () => {
      window.dispatchEvent(e);
    });

    fireEvent.click(screen.getByRole("button", { name: /install app/i }));
    expect(mockPrompt).toHaveBeenCalledTimes(1);
  });

  it("does not show when already in standalone mode", async () => {
    mockMatchMedia(true);
    render(<InstallPrompt />);
    await act(async () => {
      window.dispatchEvent(makeInstallEvent());
    });
    expect(screen.queryByText("Install School Connect Reports")).not.toBeInTheDocument();
  });

  it("stays hidden when dismissed within the last 7 days", async () => {
    localStorage.setItem("sc_reports_pwa_install_dismissed", String(Date.now()));
    const { container } = render(<InstallPrompt />);
    await act(async () => {
      window.dispatchEvent(makeInstallEvent());
    });
    expect(container.firstChild).toBeNull();
  });

  it("shows again when previous dismissal was more than 7 days ago", async () => {
    const eightDaysAgo = Date.now() - 8 * 24 * 60 * 60 * 1000;
    localStorage.setItem("sc_reports_pwa_install_dismissed", String(eightDaysAgo));
    render(<InstallPrompt />);
    await act(async () => {
      window.dispatchEvent(makeInstallEvent());
    });
    expect(screen.getByText("Install School Connect Reports")).toBeInTheDocument();
  });

  it("stays hidden when appinstalled key is set", async () => {
    localStorage.setItem("sc_reports_pwa_install_installed", "true");
    const { container } = render(<InstallPrompt />);
    await act(async () => {
      window.dispatchEvent(makeInstallEvent());
    });
    expect(container.firstChild).toBeNull();
  });

  it("hides and stores installed key when appinstalled fires", async () => {
    render(<InstallPrompt />);
    await act(async () => {
      window.dispatchEvent(makeInstallEvent());
    });
    expect(screen.getByText("Install School Connect Reports")).toBeInTheDocument();

    await act(async () => {
      window.dispatchEvent(new Event("appinstalled"));
    });
    expect(localStorage.getItem("sc_reports_pwa_install_installed")).toBe("true");
    expect(screen.queryByText("Install School Connect Reports")).not.toBeInTheDocument();
  });
});
