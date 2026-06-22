import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PromotionWorkspacePage } from "../../pages/PromotionWorkspacePage";

// Silence matchMedia
beforeEach(() => {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
});

const CONTEXT = {
  academicYears: [
    { id: "year-1", name: "2025/2026", isActive: true },
    { id: "year-2", name: "2026/2027", isActive: false },
  ],
  terms: [{ id: "term-1", name: "Term 3", isActive: true }],
  classes: [{ id: "class-s1", name: "Senior 1", code: "S1" }],
  streams: [{ id: "stream-a", name: "A", classId: "class-s1" }],
};

const PROMOTE_CANDIDATE = {
  studentId: "stu-1",
  studentName: "Alice Namusoke",
  admissionNumber: "ADM-001",
  enrollmentId: "enr-1",
  fromClassName: "Senior 1",
  fromClassCode: "S1",
  fromStreamName: "A",
  averageScore: 82.5,
  decision: "PROMOTE" as const,
  toClassName: "Senior 2",
  toClassCode: "S2",
};

const REPEAT_CANDIDATE = {
  studentId: "stu-2",
  studentName: "Bob Mugisha",
  admissionNumber: "ADM-002",
  enrollmentId: "enr-2",
  fromClassName: "Senior 1",
  fromClassCode: "S1",
  fromStreamName: "A",
  averageScore: 36.2,
  decision: "REPEAT" as const,
  toClassName: "Senior 1",
  toClassCode: "S1",
};

vi.mock("../../client/reportsClient", () => ({
  fetchReportContext: vi.fn(async () => CONTEXT),
}));

vi.mock("../../client/settingsClient", () => ({
  fetchSettings: vi.fn(async () => ({
    sections: {
      academic: {
        activeAcademicYear: "2025/2026",
        activeTerm: "Term 3",
        defaultAssessmentType: "EOT",
      },
    },
  })),
}));

const mockFetch = vi.fn();

beforeEach(() => {
  mockFetch.mockReset();
  mockFetch.mockImplementation(async (url: string) => {
    if (typeof url === "string" && url.includes("/batches")) {
      return { ok: true, text: async () => "[]" };
    }
    if (typeof url === "string" && url.includes("/preview")) {
      return { ok: true, text: async () => JSON.stringify({ candidates: [] }) };
    }
    if (typeof url === "string" && url.includes("/apply")) {
      return { ok: true, text: async () => JSON.stringify({ batchId: "batch-1", applied: 2, errors: [] }) };
    }
    return { ok: true, text: async () => "[]" };
  });
  // @ts-expect-error replace global fetch
  global.fetch = mockFetch;
  vi.spyOn(Storage.prototype, "getItem").mockReturnValue(null);
});

function renderPage() {
  return render(
    <MemoryRouter>
      <PromotionWorkspacePage />
    </MemoryRouter>,
  );
}

async function previewWith(candidates: unknown[]) {
  mockFetch.mockImplementation(async (url: string) => {
    if (url.includes("/batches")) return { ok: true, text: async () => "[]" };
    if (url.includes("/preview")) return { ok: true, text: async () => JSON.stringify({ candidates }) };
    if (url.includes("/apply")) return { ok: true, text: async () => JSON.stringify({ batchId: "b-1", applied: candidates.length, errors: [] }) };
    return { ok: true, text: async () => "[]" };
  });

  renderPage();
  // Wait for context to load — button is disabled until sourceYearId/termId are set
  await waitFor(() => expect(screen.getByRole("button", { name: /preview promotions/i })).not.toBeDisabled());
  fireEvent.click(screen.getByRole("button", { name: /preview promotions/i }));
  await waitFor(() => expect(screen.getByTestId("promotion-summary")).toBeInTheDocument());
}

describe("PromotionWorkspacePage — preview split view", () => {
  it("shows promoted students in the Promote column after preview", async () => {
    await previewWith([PROMOTE_CANDIDATE, REPEAT_CANDIDATE]);
    expect(screen.getByTestId("promote-column")).toHaveTextContent("Alice Namusoke");
  });

  it("shows failed/repeating students in the Repeat column after preview", async () => {
    await previewWith([PROMOTE_CANDIDATE, REPEAT_CANDIDATE]);
    expect(screen.getByTestId("repeat-column")).toHaveTextContent("Bob Mugisha");
    expect(screen.getByTestId("repeat-column")).toHaveTextContent("36.2%");
  });

  it("repeat column shows threshold reason for each failed student", async () => {
    await previewWith([REPEAT_CANDIDATE]);
    expect(screen.getByTestId("repeat-column")).toHaveTextContent(/below.*40%/i);
  });

  it("summary cards show correct promote and repeat counts", async () => {
    const twoPromote = [
      PROMOTE_CANDIDATE,
      { ...PROMOTE_CANDIDATE, studentId: "stu-1b", studentName: "Alice 2", admissionNumber: "ADM-1b" },
    ];
    await previewWith([...twoPromote, REPEAT_CANDIDATE]);
    expect(screen.getByTestId("promote-count").textContent).toBe("2");
    expect(screen.getByTestId("repeat-count").textContent).toBe("1");
  });

  it("failed students are visible before any batch is applied", async () => {
    await previewWith([REPEAT_CANDIDATE]);
    expect(screen.getByTestId("repeat-column")).toHaveTextContent("Bob Mugisha");
    // History is still showing the empty state
    expect(screen.getByTestId("history-empty-state")).toBeInTheDocument();
  });

  it("overriding a student decision moves them to the other column", async () => {
    await previewWith([PROMOTE_CANDIDATE]);
    expect(screen.getByTestId("promote-column")).toHaveTextContent("Alice Namusoke");

    const overrideSelect = screen.getByDisplayValue("Promote");
    fireEvent.change(overrideSelect, { target: { value: "REPEAT" } });

    await waitFor(() => expect(screen.getByTestId("repeat-column")).toHaveTextContent("Alice Namusoke"));
    expect(screen.getByTestId("promote-column")).not.toHaveTextContent("Alice Namusoke");
  });
});

describe("PromotionWorkspacePage — Apply button disabled reason", () => {
  it("shows disabled reason when target term is not selected", async () => {
    await previewWith([PROMOTE_CANDIDATE]);
    await waitFor(() => expect(screen.getByTestId("apply-disabled-reason")).toBeInTheDocument());
    expect(screen.getByTestId("apply-disabled-reason")).toHaveTextContent(/select a target term/i);
  });

  it("Apply button is disabled when target term is missing", async () => {
    await previewWith([PROMOTE_CANDIDATE]);
    const applyBtn = screen.getByRole("button", { name: /apply promotions/i });
    expect(applyBtn).toBeDisabled();
  });

  it("Apply button is enabled once target term is selected", async () => {
    await previewWith([PROMOTE_CANDIDATE]);

    const termSelect = screen.getByDisplayValue(/target term/i);
    fireEvent.change(termSelect, { target: { value: "term-1" } });

    await waitFor(() => expect(screen.getByRole("button", { name: /apply promotions/i })).not.toBeDisabled());
    expect(screen.queryByTestId("apply-disabled-reason")).toBeNull();
  });
});

describe("PromotionWorkspacePage — promotion history", () => {
  it("shows clearer empty state when no batches exist yet", async () => {
    renderPage();
    await waitFor(() => expect(screen.getByTestId("history-empty-state")).toBeInTheDocument());
    expect(screen.getByTestId("history-empty-state")).toHaveTextContent(/no promotion batches have been applied yet/i);
    expect(screen.getByTestId("history-empty-state")).toHaveTextContent(/promotion preview/i);
  });

  it("shows promoted and repeated counts in history after a batch", async () => {
    const batch = [
      {
        id: "batch-1",
        status: "APPLIED",
        appliedAt: new Date().toISOString(),
        appliedByName: "Admin User",
        reversedAt: null,
        reversedByName: null,
        totalStudents: 3,
        promoted: 2,
        repeated: 1,
        graduated: 0,
        actions: [
          { id: "a-1", studentName: "Alice N.", decision: "PROMOTE", status: "APPLIED", fromClassName: "S1", toClassName: "S2" },
          { id: "a-2", studentName: "Bob M.", decision: "PROMOTE", status: "APPLIED", fromClassName: "S1", toClassName: "S2" },
          { id: "a-3", studentName: "Carol W.", decision: "REPEAT", status: "APPLIED", fromClassName: "S1", toClassName: "S1" },
        ],
      },
    ];

    mockFetch.mockImplementation(async (url: string) => {
      if (url.includes("/batches")) return { ok: true, text: async () => JSON.stringify(batch) };
      return { ok: true, text: async () => "{}" };
    });

    renderPage();
    await waitFor(() => expect(screen.getByText(/3 students/i)).toBeInTheDocument());
    expect(screen.getByText(/2 promoted/i)).toBeInTheDocument();
    expect(screen.getByText(/1 repeat/i)).toBeInTheDocument();
  });

  it("history batch detail shows repeat students when expanded", async () => {
    const batch = [
      {
        id: "batch-1",
        status: "APPLIED",
        appliedAt: new Date().toISOString(),
        appliedByName: "Admin",
        reversedAt: null,
        reversedByName: null,
        totalStudents: 2,
        promoted: 1,
        repeated: 1,
        graduated: 0,
        actions: [
          { id: "a-1", studentName: "Alice N.", decision: "PROMOTE", status: "APPLIED", fromClassName: "S1", toClassName: "S2" },
          { id: "a-2", studentName: "Bob M.", decision: "REPEAT", status: "APPLIED", fromClassName: "S1", toClassName: null },
        ],
      },
    ];

    mockFetch.mockImplementation(async (url: string) => {
      if (url.includes("/batches")) return { ok: true, text: async () => JSON.stringify(batch) };
      return { ok: true, text: async () => "{}" };
    });

    renderPage();
    await waitFor(() => expect(screen.getByRole("button", { name: /show details/i })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /show details/i }));

    await waitFor(() => expect(screen.getByText(/repeat \/ failed/i)).toBeInTheDocument());
    expect(screen.getByText("Alice N.")).toBeInTheDocument();
    expect(screen.getByText("Bob M.")).toBeInTheDocument();
  });
});

describe("PromotionWorkspacePage — mixed batch: some promote, some repeat", () => {
  it("confirm dialog shows breakdown of promote + repeat counts", async () => {
    await previewWith([PROMOTE_CANDIDATE, REPEAT_CANDIDATE]);

    const termSelect = screen.getByDisplayValue(/target term/i);
    fireEvent.change(termSelect, { target: { value: "term-1" } });

    await waitFor(() => expect(screen.getByRole("button", { name: /apply promotions/i })).not.toBeDisabled());
    fireEvent.click(screen.getByRole("button", { name: /apply promotions/i }));

    await waitFor(() => expect(screen.getByRole("button", { name: /confirm.*apply/i })).toBeInTheDocument());
    expect(screen.getByText(/1 will be promoted/i)).toBeInTheDocument();
    expect(screen.getByText(/1 will repeat/i)).toBeInTheDocument();
  });

  it("both PROMOTE and REPEAT decisions are sent to the apply endpoint", async () => {
    let capturedBody: Record<string, unknown> = {};

    mockFetch.mockImplementation(async (url: string, opts?: RequestInit) => {
      if (url.includes("/batches")) return { ok: true, text: async () => "[]" };
      if (url.includes("/preview"))
        return { ok: true, text: async () => JSON.stringify({ candidates: [PROMOTE_CANDIDATE, REPEAT_CANDIDATE] }) };
      if (url.includes("/apply")) {
        capturedBody = JSON.parse((opts?.body as string) ?? "{}") as Record<string, unknown>;
        return { ok: true, text: async () => JSON.stringify({ batchId: "b-1", applied: 2, errors: [] }) };
      }
      return { ok: true, text: async () => "[]" };
    });

    renderPage();
    await waitFor(() => expect(screen.getByRole("button", { name: /preview promotions/i })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /preview promotions/i }));
    await waitFor(() => expect(screen.getByTestId("promotion-summary")).toBeInTheDocument());

    const termSelect = screen.getByDisplayValue(/target term/i);
    fireEvent.change(termSelect, { target: { value: "term-1" } });

    await waitFor(() => expect(screen.getByRole("button", { name: /apply promotions/i })).not.toBeDisabled());
    fireEvent.click(screen.getByRole("button", { name: /apply promotions/i }));

    await waitFor(() => expect(screen.getByRole("button", { name: /confirm.*apply/i })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /confirm.*apply/i }));

    await waitFor(() => expect(screen.getByText(/promotions applied/i)).toBeInTheDocument());

    const decisions = capturedBody.decisions as Array<{ studentId: string; decision: string }>;
    expect(decisions).toContainEqual(expect.objectContaining({ studentId: "stu-1", decision: "PROMOTE" }));
    expect(decisions).toContainEqual(expect.objectContaining({ studentId: "stu-2", decision: "REPEAT" }));
  });
});
