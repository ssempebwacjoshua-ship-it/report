import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SupportWidget } from "../../components/support/SupportWidget";

const supportClientMocks = vi.hoisted(() => ({
  postSupportTelegram: vi.fn(),
}));

vi.mock("../../client/supportClient", () => supportClientMocks);

vi.mock("../../contexts/AuthContext", () => ({
  useAuth: () => ({
    user: {
      id: "user-1",
      schoolId: "school-1",
      name: "Test Admin",
      email: "admin@example.test",
      role: "ADMIN_OPERATOR",
    },
  }),
}));

vi.mock("../../components/layout/SettingsContext", () => ({
  useAppSettings: () => ({
    settings: {
      schoolCode: "SCU-PREVIEW",
      sections: {
        school: {
          schoolName: "Preview School",
          schoolCode: "SCU-PREVIEW",
        },
      },
    },
  }),
}));

describe("SupportWidget", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubEnv("VITE_SUPPORT_MODE", "telegram_form");
    supportClientMocks.postSupportTelegram.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("renders the support button for authenticated users", () => {
    render(
      <MemoryRouter initialEntries={["/students?classId=class-1"]}>
        <SupportWidget />
      </MemoryRouter>,
    );

    expect(screen.getByRole("button", { name: "Support" })).toBeInTheDocument();
  });

  it("posts the support form to the backend client with the current page url", async () => {
    render(
      <MemoryRouter initialEntries={["/students?classId=class-1"]}>
        <SupportWidget />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Support" }));
    fireEvent.change(screen.getByLabelText("Issue"), { target: { value: "Marks are not loading for one student." } });
    fireEvent.change(screen.getByLabelText("Contact"), { target: { value: "+256700000000" } });
    fireEvent.click(screen.getByRole("button", { name: "Send support request" }));

    await waitFor(() => expect(supportClientMocks.postSupportTelegram).toHaveBeenCalledTimes(1));
    expect(supportClientMocks.postSupportTelegram).toHaveBeenCalledWith(expect.objectContaining({
      contact: "+256700000000",
      pageUrl: expect.stringContaining("/students?classId=class-1"),
      message: expect.stringContaining("Marks are not loading for one student."),
    }));
    expect(screen.getByText(/Support request sent/i)).toBeInTheDocument();
  });
});
