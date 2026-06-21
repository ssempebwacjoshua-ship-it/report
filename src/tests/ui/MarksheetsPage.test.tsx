import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { MarksheetsPage } from "../../pages/MarksheetsPage";
import { fetchReportContext } from "../../client/reportsClient";
import { formatUgandaSchoolYearLabel, nextUgandaSchoolYear } from "../../shared/utils/ugandaYear";

// Lightweight stand-in ? avoids pulling in qrcode.react in the test environment
vi.mock("../../components/marksheets/PrintableMarksheet", () => ({
  PrintableMarksheet: ({
    students,
  }: {
    students: Array<{ id: string; firstName: string; lastName: string }>;
  }) => (
    <div data-testid="printable-marksheet">
      {students.map((s) => (
        <span key={s.id} data-testid="marksheet-student-row">
          {s.firstName} {s.lastName}
        </span>
      ))}
    </div>
  ),
}));

vi.mock("../../client/reportsClient", () => ({
  fetchReportContext: vi.fn().mockResolvedValue({
    classes: [{ id: "cls-1", name: "S1" }],
    streams: [{ id: "str-1", name: "A", classId: "cls-1" }],
    subjects: [
      { id: "ENG", name: "English Language", code: "ENG" },
      { id: "MATH", name: "Mathematics", code: "MATH" },
      { id: "BIO", name: "Biology", code: "BIO" },
      { id: "CHEM", name: "Chemistry", code: "CHEM" },
      { id: "PHY", name: "Physics", code: "PHY" },
      { id: "GEO", name: "Geography", code: "GEO" },
      { id: "HIST", name: "History", code: "HIST" },
      { id: "CRE", name: "Christian Religious Education", code: "CRE" },
      { id: "AGR", name: "Agriculture", code: "AGR" },
      { id: "ENT", name: "Entrepreneurship", code: "ENT" },
      { id: "LIT", name: "Literature in English", code: "LIT" },
      { id: "KIS", name: "Kiswahili", code: "KIS" },
      { id: "ICT", name: "Computer Studies / ICT", code: "ICT" },
    ],
    terms: [{ id: "term-1", name: "Term 1", isActive: true }],
    academicYears: [{ id: "year-1", name: "2025/2026", isActive: true }],
    school: { name: "Test School", code: "TEST" },
  }),
}));

vi.mock("../../client/settingsClient", () => ({
  fetchSettings: vi.fn().mockResolvedValue({
    sections: {
      school: {
        schoolName: "Test School",
        address: "",
        phone: "",
        email: "",
        marksheetFooterText: "Blank means missing, not zero.",
        website: "",
        headTeacherName: "Head Teacher",
        reportFooterText: "",
        logoUrl: "",
      },
      academic: {
        activeAcademicYear: "2025/2026",
        activeTerm: "Term 1",
        defaultAssessmentType: "EOT",
        defaultExamType: "EOT",
      },
      marksheets: {
        printStyle: "rich_black",
        includeQrCode: true,
        includeHumanReadableMarksheetId: true,
        validMarkValues: "0-100, AB, EX",
      },
      reports: {
        showOverallPosition: false,
        showClassAverage: false,
        showGradeKey: false,
        showSchoolLogo: false,
        printDensity: "compact",
        signatureMode: "name_and_signature_line",
        defaultHmCommentTemplate: "",
        defaultClassTeacherCommentTemplate: "",
      },
    },
  }),
}));

vi.mock("../../client/marksheetsClient", () => ({
  fetchMarksheetStudents: vi.fn().mockResolvedValue({
    students: [
      { id: "s1", admissionNumber: "ADM-001", firstName: "Alice", lastName: "Smith" },
      { id: "s2", admissionNumber: "ADM-002", firstName: "Bob", lastName: "Jones" },
      { id: "s3", admissionNumber: "ADM-003", firstName: "Carol", lastName: "Williams" },
    ],
  }),
  fetchMarksheetBatches: vi.fn().mockResolvedValue({ batches: [] }),
  approveMarksheetBatch: vi.fn(),
  returnMarksheetBatch: vi.fn(),
  commitMarksheetEntry: vi.fn(),
}));

vi.mock("../../client/importsClient", () => ({
  dryRunMarksImport: vi.fn(),
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

function renderPage() {
  render(
    <MemoryRouter>
      <MarksheetsPage />
    </MemoryRouter>,
  );
}

async function loadStudents() {
  renderPage();

  // Wait for context to load ? "S1" appears as an option in the Class select
  await waitFor(() => expect(screen.getByRole("option", { name: "S1" })).toBeInTheDocument());

  // Filter selects in DOM order: Class(0), Stream(1), Subject(2), Term(3), ExamType(4)
  const selects = screen.getAllByRole("combobox");
  fireEvent.change(selects[0]!, { target: { value: "cls-1" } });
  fireEvent.change(selects[1]!, { target: { value: "str-1" } });

  // Wait for the student checklist to appear (checkbox aria-label is unique to the checklist)
  await waitFor(() => expect(screen.getByLabelText("Select Alice Smith")).toBeInTheDocument());
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("MarksheetsPage Print tab ? filter returns multiple students", () => {
  it("shows all 3 students in the checklist when class and stream are selected", async () => {
    await loadStudents();
    // Verify all three checkboxes (unique per student in the checklist)
    expect(screen.getByLabelText("Select Alice Smith")).toBeInTheDocument();
    expect(screen.getByLabelText("Select Bob Jones")).toBeInTheDocument();
    expect(screen.getByLabelText("Select Carol Williams")).toBeInTheDocument();
  });

  it("shows a per-student checkbox for each student", async () => {
    await loadStudents();
    expect(screen.getByLabelText("Select Alice Smith")).toBeInTheDocument();
    expect(screen.getByLabelText("Select Bob Jones")).toBeInTheDocument();
    expect(screen.getByLabelText("Select Carol Williams")).toBeInTheDocument();
  });

  it("shows a select-all checkbox in the table header", async () => {
    await loadStudents();
    expect(screen.getByLabelText("Select all students")).toBeInTheDocument();
  });

  it("renders subject options after the school context loads", async () => {
    await loadStudents();
    expect(screen.getByRole("option", { name: "Mathematics" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Biology" })).toBeInTheDocument();
  });

  it("keeps the subject list when class and stream change", async () => {
    await loadStudents();
    const selects = screen.getAllByRole("combobox");
    const subjectSelect = selects[2] as HTMLSelectElement;
    const initialOptionCount = subjectSelect.options.length;

    fireEvent.change(selects[0]!, { target: { value: "cls-1" } });
    fireEvent.change(selects[1]!, { target: { value: "str-1" } });

    expect(subjectSelect.options.length).toBe(initialOptionCount);
    expect(screen.getByRole("option", { name: "Mathematics" })).toBeInTheDocument();
  });
});

describe("MarksheetsPage Print tab ? print-page DOM elements", () => {
  it("renders exactly one PrintableMarksheet inside the print-only container", async () => {
    await loadStudents();
    const printOnly = document.querySelector(".print-only");
    expect(printOnly).not.toBeNull();
    expect(
      printOnly!.querySelectorAll("[data-testid='printable-marksheet']"),
    ).toHaveLength(1);
  });

  it("print-only marksheet contains all 3 student rows when nothing is selected", async () => {
    await loadStudents();
    const printOnly = document.querySelector(".print-only");
    expect(
      printOnly!.querySelectorAll("[data-testid='marksheet-student-row']"),
    ).toHaveLength(3);
  });
});

describe("MarksheetsPage Print tab ? student selection", () => {
  it("Select All button selects all students", async () => {
    await loadStudents();
    fireEvent.click(screen.getByRole("button", { name: /select all/i }));

    const studentCheckboxes = screen
      .getAllByRole("checkbox")
      .filter((c) => c.getAttribute("aria-label") !== "Select all students");
    expect(studentCheckboxes.every((c) => (c as HTMLInputElement).checked)).toBe(true);
  });

  it("Clear button resets all selections", async () => {
    await loadStudents();
    fireEvent.click(screen.getByRole("button", { name: /select all/i }));
    fireEvent.click(screen.getByRole("button", { name: /^clear$/i }));

    const studentCheckboxes = screen
      .getAllByRole("checkbox")
      .filter((c) => c.getAttribute("aria-label") !== "Select all students");
    expect(studentCheckboxes.every((c) => !(c as HTMLInputElement).checked)).toBe(true);
  });

  it("selecting 2 students shows selected count in status text", async () => {
    await loadStudents();
    fireEvent.click(screen.getByLabelText("Select Alice Smith"));
    fireEvent.click(screen.getByLabelText("Select Bob Jones"));

    expect(screen.getByText(/2 of 3 selected/)).toBeInTheDocument();
  });

  it("selecting 2 students passes exactly 2 student rows to the print-only marksheet", async () => {
    await loadStudents();
    fireEvent.click(screen.getByLabelText("Select Alice Smith"));
    fireEvent.click(screen.getByLabelText("Select Bob Jones"));

    const printOnly = document.querySelector(".print-only");
    expect(
      printOnly!.querySelectorAll("[data-testid='marksheet-student-row']"),
    ).toHaveLength(2);
  });

  it("clearing selection after Select All restores all 3 rows in the print-only marksheet", async () => {
    await loadStudents();
    fireEvent.click(screen.getByRole("button", { name: /select all/i }));
    let printOnly = document.querySelector(".print-only");
    expect(
      printOnly!.querySelectorAll("[data-testid='marksheet-student-row']"),
    ).toHaveLength(3);

    fireEvent.click(screen.getByRole("button", { name: /^clear$/i }));
    printOnly = document.querySelector(".print-only");
    expect(
      printOnly!.querySelectorAll("[data-testid='marksheet-student-row']"),
    ).toHaveLength(3);
  });
});

describe("MarksheetsPage subject empty state", () => {
  it("shows a preparation message when no classes or subjects exist", async () => {
    vi.mocked(fetchReportContext).mockResolvedValueOnce({
      school: { code: "SCU-PREVIEW" },
      academicYears: [{ id: "year-1", name: "2025/2026", isActive: true }],
      terms: [{ id: "term-1", name: "Term 1", isActive: true }],
      classes: [],
      streams: [],
      subjects: [],
    });

    renderPage();

    expect(
      await screen.findByText(/Your school classes are still being prepared\./i),
    ).toBeInTheDocument();
  });

  it("shows automatic preparation copy when classes exist but subjects are not visible yet", async () => {
    vi.mocked(fetchReportContext).mockResolvedValueOnce({
      school: { code: "SCU-PREVIEW" },
      academicYears: [{ id: "year-1", name: "2025/2026", isActive: true }],
      terms: [{ id: "term-1", name: "Term 1", isActive: true }],
      classes: [{ id: "class-1", name: "S1" }],
      streams: [{ id: "stream-1", name: "A", classId: "class-1" }],
      subjects: [],
    });

    renderPage();

    expect(
      await screen.findByText(/Subjects are being prepared automatically\. Refresh in a moment\./i),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Settings > School Structure/i)).not.toBeInTheDocument();
  });
});

describe("MarksheetsPage Print tab ? print button label", () => {
  it("shows 'Print All' when no students are selected", async () => {
    await loadStudents();
    expect(screen.getByRole("button", { name: /print all/i })).toBeInTheDocument();
  });

  it("shows 'Print N Selected' when students are selected", async () => {
    await loadStudents();
    fireEvent.click(screen.getByLabelText("Select Alice Smith"));
    fireEvent.click(screen.getByLabelText("Select Bob Jones"));
    expect(screen.getByRole("button", { name: /print 2 selected/i })).toBeInTheDocument();
  });

  it("calls window.print() when the print button is clicked", async () => {
    const printSpy = vi.spyOn(window, "print").mockImplementation(() => {});
    await loadStudents();
    fireEvent.click(screen.getByRole("button", { name: /print all/i }));
    expect(printSpy).toHaveBeenCalledTimes(1);
    printSpy.mockRestore();
  });
});

describe("formatUgandaSchoolYearLabel", () => {
  it("extracts ending year from slash-separated year names", () => {
    expect(formatUgandaSchoolYearLabel("2025/2026")).toBe("2026");
    expect(formatUgandaSchoolYearLabel("2026/2027")).toBe("2027");
  });

  it("returns the plain year unchanged when there is no slash", () => {
    expect(formatUgandaSchoolYearLabel("2026")).toBe("2026");
  });

  it("trims whitespace from the result", () => {
    expect(formatUgandaSchoolYearLabel(" 2025/2026 ")).toBe("2026");
    expect(formatUgandaSchoolYearLabel("2025/ 2026 ")).toBe("2026");
  });
});

describe("nextUgandaSchoolYear", () => {
  it("returns the year after the Uganda label for a plain year", () => {
    expect(nextUgandaSchoolYear("2026")).toBe(2027);
  });

  it("returns the year after the ending year for a slash-separated name", () => {
    expect(nextUgandaSchoolYear("2025/2026")).toBe(2027);
    expect(nextUgandaSchoolYear("2026/2027")).toBe(2028);
  });

  it("promotion target year defaults to next year from source year", () => {
    expect(nextUgandaSchoolYear("2026")).toBe(2027);
  });
});

