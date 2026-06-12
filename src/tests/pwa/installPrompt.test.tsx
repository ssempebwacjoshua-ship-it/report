import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { InstallPrompt } from "../../components/pwa/InstallPrompt";

beforeEach(() => {
  localStorage.clear();
  window.matchMedia =
    window.matchMedia ||
    (vi.fn().mockReturnValue({ matches: false, addListener: vi.fn(), removeListener: vi.fn() }) as never);
  vi.spyOn(window, "matchMedia").mockReturnValue({
    matches: false,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  } as never);
});

describe("InstallPrompt", () => {
  it("renders nothing by default (no beforeinstallprompt, not iOS)", () => {
    const { container } = render(<InstallPrompt />);
    expect(container.firstChild).toBeNull();
  });

  it("shows the install button after beforeinstallprompt fires", async () => {
    render(<InstallPrompt />);
    const event = new Event("beforeinstallprompt");
    Object.assign(event, { prompt: vi.fn(), userChoice: Promise.resolve({ outcome: "accepted" }) });
    window.dispatchEvent(event);
    expect(await screen.findByText("Install app")).toBeInTheDocument();
  });

  it("stays hidden when previously dismissed", () => {
    localStorage.setItem("school-connect-install-dismissed", "true");
    const { container } = render(<InstallPrompt />);
    const event = new Event("beforeinstallprompt");
    Object.assign(event, { prompt: vi.fn(), userChoice: Promise.resolve({ outcome: "accepted" }) });
    window.dispatchEvent(event);
    expect(container.firstChild).toBeNull();
  });
});
