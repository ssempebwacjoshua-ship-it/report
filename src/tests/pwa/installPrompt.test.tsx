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

// Simulate Android Chrome UA so the banner is eligible to show
function mockAndroidChrome() {
  vi.stubGlobal("navigator", {
    ...navigator,
    userAgent:
      "Mozilla/5.0 (Linux; Android 10; Pixel 4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Mobile Safari/537.36",
  });
}

const DISMISSED_KEY = "sc_pwa_dismissed_v3";
const INSTALLED_KEY = "sc_pwa_installed";

beforeEach(() => {
  localStorage.clear();
  mockMatchMedia(false);
  mockAndroidChrome();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("InstallPrompt", () => {
  it("renders nothing by default (no beforeinstallprompt, not iOS)", () => {
    const { container } = render(<InstallPrompt />);
    // Before the 4-second fallback fires, nothing visible
    expect(container.firstChild).toBeNull();
  });

  it("shows the install banner when beforeinstallprompt fires", async () => {
    render(<InstallPrompt />);
    await act(async () => {
      window.dispatchEvent(makeInstallEvent());
    });
    expect(screen.getByText("Install Smart Pages")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /install app/i })).toBeInTheDocument();
  });

  it("stores a dismissal timestamp and hides when Maybe Later is clicked", async () => {
    render(<InstallPrompt />);
    await act(async () => {
      window.dispatchEvent(makeInstallEvent());
    });

    const before = Date.now();
    fireEvent.click(screen.getByRole("button", { name: /maybe later/i }));

    const stored = localStorage.getItem(DISMISSED_KEY);
    expect(stored).not.toBeNull();
    expect(Number(stored)).toBeGreaterThanOrEqual(before);
    expect(screen.queryByText("Install Smart Pages")).not.toBeInTheDocument();
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
    expect(screen.queryByText("Install Smart Pages")).not.toBeInTheDocument();
  });

  it("stays hidden when dismissed within the last 3 days", async () => {
    localStorage.setItem(DISMISSED_KEY, String(Date.now()));
    const { container } = render(<InstallPrompt />);
    await act(async () => {
      window.dispatchEvent(makeInstallEvent());
    });
    expect(container.firstChild).toBeNull();
  });

  it("shows again when previous dismissal was more than 3 days ago", async () => {
    const fourDaysAgo = Date.now() - 4 * 24 * 60 * 60 * 1000;
    localStorage.setItem(DISMISSED_KEY, String(fourDaysAgo));
    render(<InstallPrompt />);
    await act(async () => {
      window.dispatchEvent(makeInstallEvent());
    });
    expect(screen.getByText("Install Smart Pages")).toBeInTheDocument();
  });

  it("stays hidden when already installed", async () => {
    localStorage.setItem(INSTALLED_KEY, "true");
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
    expect(screen.getByText("Install Smart Pages")).toBeInTheDocument();

    await act(async () => {
      window.dispatchEvent(new Event("appinstalled"));
    });
    expect(localStorage.getItem(INSTALLED_KEY)).toBe("true");
    expect(screen.queryByText("Install Smart Pages")).not.toBeInTheDocument();
  });
});

