import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { SchoolStructureSection } from "../../components/settings/SchoolStructureSection";
import {
  fetchSchoolStructure,
  updateSchoolStructure,
  createSchoolStream,
  deleteSchoolStream,
} from "../../client/schoolStructureClient";
import type { SchoolStructureData } from "../../client/schoolStructureClient";

vi.mock("../../client/schoolStructureClient", () => ({
  fetchSchoolStructure: vi.fn(),
  updateSchoolStructure: vi.fn(),
  createSchoolStream: vi.fn(),
  deleteSchoolStream: vi.fn(),
}));

const MOCK_DATA: SchoolStructureData = {
  success: true,
  school: { id: "s1", code: "SCU-PREVIEW", name: "Preview School" },
  selectedSections: ["SECONDARY"],
  availableSections: [
    { code: "NURSERY", label: "Nursery / Pre-primary" },
    { code: "PRIMARY", label: "Primary" },
    { code: "SECONDARY", label: "Secondary" },
  ],
  canonicalClasses: [
    {
      id: "class-s1",
      name: "Senior 1",
      code: "S1",
      level: 20,
      section: "SECONDARY",
      streams: [
        { id: "stream-a", name: "A", code: "A" },
        { id: "stream-b", name: "B", code: "B" },
      ],
    },
    {
      id: "class-s2",
      name: "Senior 2",
      code: "S2",
      level: 21,
      section: "SECONDARY",
      streams: [],
    },
  ],
  streamsByClass: {
    "class-s1": [
      { id: "stream-a", name: "A", code: "A" },
      { id: "stream-b", name: "B", code: "B" },
    ],
  },
  lockWarnings: {},
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("SchoolStructureSection", () => {
  it("shows loading state before data arrives", () => {
    vi.mocked(fetchSchoolStructure).mockReturnValue(new Promise(() => {}));
    render(<SchoolStructureSection />);
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it("shows section checkboxes after load", async () => {
    vi.mocked(fetchSchoolStructure).mockResolvedValue(MOCK_DATA);
    render(<SchoolStructureSection />);

    expect(await screen.findByText("Nursery / Pre-primary")).toBeInTheDocument();
    expect(screen.getAllByText("Primary").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Secondary").length).toBeGreaterThan(0);
  });

  it("shows canonical class names", async () => {
    vi.mocked(fetchSchoolStructure).mockResolvedValue(MOCK_DATA);
    render(<SchoolStructureSection />);

    expect(await screen.findByText("Senior 1")).toBeInTheDocument();
    expect(screen.getByText("Senior 2")).toBeInTheDocument();
  });

  it("shows stream names under their class", async () => {
    vi.mocked(fetchSchoolStructure).mockResolvedValue(MOCK_DATA);
    render(<SchoolStructureSection />);

    await screen.findByText("Senior 1");
    expect(screen.getByText("A")).toBeInTheDocument();
    expect(screen.getByText("B")).toBeInTheDocument();
  });

  it("shows 'No streams yet' for classes without streams", async () => {
    vi.mocked(fetchSchoolStructure).mockResolvedValue(MOCK_DATA);
    render(<SchoolStructureSection />);

    await screen.findByText("Senior 2");
    const noStreams = screen.getAllByText("No streams yet");
    expect(noStreams.length).toBeGreaterThan(0);
  });

  it("shows error message when load fails", async () => {
    vi.mocked(fetchSchoolStructure).mockRejectedValue(new Error("Network error"));
    render(<SchoolStructureSection />);

    expect(await screen.findByText("Network error")).toBeInTheDocument();
  });

  it("shows Save Changes button", async () => {
    vi.mocked(fetchSchoolStructure).mockResolvedValue(MOCK_DATA);
    render(<SchoolStructureSection />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /save changes/i })).toBeInTheDocument();
    });
  });

  it("shows locked badge when a section has data", async () => {
    const lockedData: SchoolStructureData = {
      ...MOCK_DATA,
      lockWarnings: {
        SECONDARY:
          "Secondary has 8 enrolment(s) and 0 mark(s) and cannot be removed without platform-owner approval.",
      },
    };
    vi.mocked(fetchSchoolStructure).mockResolvedValue(lockedData);
    render(<SchoolStructureSection />);

    expect(await screen.findByText("locked")).toBeInTheDocument();
  });
});
