import { render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PwaLaunchPage } from "../../pages/PwaLaunchPage";

const authState = vi.hoisted(() => ({
  user: null as null | { role: "SECURITY" | "CANTEEN" | "ADMIN_OPERATOR" },
  token: null as string | null,
  loading: false,
}));

vi.mock("../../contexts/AuthContext", () => ({
  useAuth: () => authState,
}));

function renderLaunchPage() {
  const router = createMemoryRouter([
    { path: "/pwa-launch", element: <PwaLaunchPage /> },
    { path: "/login", element: <div>Login Page</div> },
    { path: "/nfc/gate", element: <div>Gate App</div> },
    { path: "/nfc/canteen", element: <div>Canteen App</div> },
    { path: "/dashboard", element: <div>Dashboard App</div> },
  ], {
    initialEntries: ["/pwa-launch"],
  });

  render(<RouterProvider router={router} />);
}

describe("PwaLaunchPage", () => {
  beforeEach(() => {
    window.localStorage.clear();
    authState.user = null;
    authState.token = null;
    authState.loading = false;
  });

  it("shows a loader while restoring an installed session", () => {
    authState.user = { role: "SECURITY" };
    authState.token = "tok";
    authState.loading = true;

    renderLaunchPage();

    expect(screen.getByLabelText(/opening installed workspace/i)).toBeInTheDocument();
  });

  it("redirects expired sessions to login", async () => {
    renderLaunchPage();
    expect(await screen.findByText("Login Page")).toBeInTheDocument();
  });

  it("opens the remembered gate workspace", async () => {
    authState.user = { role: "SECURITY" };
    authState.token = "tok";
    window.localStorage.setItem("sc_pwa_launch_path", "/nfc/gate");

    renderLaunchPage();
    expect(await screen.findByText("Gate App")).toBeInTheDocument();
  });

  it("opens the remembered canteen workspace", async () => {
    authState.user = { role: "CANTEEN" };
    authState.token = "tok";
    window.localStorage.setItem("sc_pwa_launch_path", "/nfc/canteen");

    renderLaunchPage();
    expect(await screen.findByText("Canteen App")).toBeInTheDocument();
  });
});
