import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { StudentsPage } from "../../pages/StudentsPage";

vi.mock("../../client/reportsClient", () => ({
  fetchReportContext: vi.fn(),
}));

vi.mock("../../client/studentsClient", () => ({
  EMPTY_CONTACT_INPUT: {
    guardianName: "",
    relationship: "Parent",
    phone: "",
    email: "",
    preferredContactMethod: "PHONE",
    isPrimary: false,
    canReceiveReports: true,
    notes: "",
  },
  fetchStudents: vi.fn(),
  createStudent: vi.fn(),
  commitStudentImport: vi.fn(),
  createGuardianContact: vi.fn(),
  deleteGuardianContact: vi.fn(),
  fetchStudentImportJob: vi.fn(),
  previewStudentImport: vi.fn(),
  updateGuardianContact: vi.fn(),
}));

import { fetchReportContext } from "../../client/reportsClient";
import { commitStudentImport, fetchStudents, previewStudentImport } from "../../client/studentsClient";

const defaultContext = {
  school: { code: "SCU-PREVIEW" },
  academicYears: [{ id: "ay-1", name: "2025/2026", isActive: true }],
  terms: [{ id: "term-1", name: "Term 1", isActive: true }],
  classes: [{ id: "class-1", name: "S1" }],
  streams: [{ id: "stream-1", classId: "class-1", name: "A" }],
  subjects: [],
};

const defaultStudents = {
  students: [
    {
      id: "student-1",
      admissionNumber: "ADM-001",
      studentName: "Ada Lovelace",
      isActive: true,
      enrollmentStatus: "ACTIVE",
      className: "S1",
      classId: "class-1",
      streamName: "A",
      streamId: "stream-1",
      academicYearId: "ay-1",
      termId: "term-1",
      contactReadiness: "READY",
      contactSummary: "Ready",
      guardianContacts: [
        {
          id: "contact-1",
          guardianName: "Grace Hopper",
          relationship: "Mother",
          phone: "+256 700 000000",
          email: "grace@example.test",
          preferredContactMethod: "PHONE",
          isPrimary: true,
          canReceiveReports: true,
          notes: "",
        },
      ],
    },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(fetchReportContext).mockResolvedValue(defaultContext);
  vi.mocked(fetchStudents).mockResolvedValue(defaultStudents);
});

describe("StudentsPage", () => {
  it("renders the student list, aligned actions, and selected profile", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <StudentsPage />
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getAllByText("Ada Lovelace").length).toBeGreaterThan(0));
    expect(screen.getByRole("button", { name: "Add Student" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "CSV Template" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "XLSX Template" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Import Batch" }).length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: "View Report" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Add Contact" }).length).toBeGreaterThan(0);
    await user.click(screen.getAllByText("Ada Lovelace")[0]);
    expect(screen.getAllByText("Ada Lovelace").length).toBeGreaterThan(0);
  });

  it("shows row-level import errors and still allows committing valid rows", async () => {
    const user = userEvent.setup();
    vi.mocked(previewStudentImport).mockResolvedValueOnce({
      status: "PREVIEW",
      totalRows: 2,
      validRows: 1,
      invalidRows: 1,
      duplicateRows: 0,
      createRows: 1,
      updateRows: 0,
      mode: "CREATE_ONLY",
      warnings: [],
      rows: [
        {
          rowNumber: 2,
          raw: { admissionNumber: "ADM-010", fullName: "Good Student", gender: "Female", className: "Senior 1", streamName: "A" },
          isValid: true,
          errors: [],
          action: "create",
          existingStudentId: null,
          generatedAdmissionNumber: null,
          classId: "class-1",
          streamId: "stream-1",
        },
        {
          rowNumber: 3,
          raw: { admissionNumber: "ADM-011", fullName: "", gender: "Male", className: "Senior 1", streamName: "A" },
          isValid: false,
          errors: ["Full name is required."],
          action: "invalid",
          existingStudentId: null,
          generatedAdmissionNumber: null,
          classId: "class-1",
          streamId: "stream-1",
        },
      ],
    });
    vi.mocked(commitStudentImport).mockResolvedValueOnce({
      jobId: "job-1",
      status: "QUEUED",
      totalRows: 2,
      validRows: 1,
      invalidRows: 1,
      duplicateRows: 0,
      warnings: [],
    });

    const { container } = render(
      <MemoryRouter>
        <StudentsPage />
      </MemoryRouter>,
    );

    await user.click(screen.getAllByRole("button", { name: "Import Batch" })[0]);
    const file = new File(["admissionNumber,fullName,gender,class,stream\nADM-010,Good Student,Female,Senior 1,A"], "students.csv", { type: "text/csv" });
    const input = container.querySelector('input[type="file"]');
    expect(input).toBeInstanceOf(HTMLInputElement);
    await user.upload(input as HTMLInputElement, file);
    await user.click(screen.getByRole("button", { name: "Preview" }));

    await waitFor(() => expect(screen.getByText("Rows needing attention")).toBeInTheDocument());
    expect(screen.getByText(/Full name is required/)).toBeInTheDocument();
    const commit = screen.getByRole("button", { name: "Commit" });
    expect(commit).toBeEnabled();
    await user.click(commit);
    expect(commitStudentImport).toHaveBeenCalledTimes(1);
  });

  it("does not hard-block file preview when active year and term are missing", async () => {
    const user = userEvent.setup();
    vi.mocked(fetchReportContext).mockResolvedValueOnce({
      ...defaultContext,
      academicYears: [{ id: "ay-2", name: "2026/2027", isActive: false }],
      terms: [{ id: "term-2", name: "Term 2", isActive: false }],
    });
    vi.mocked(previewStudentImport).mockResolvedValueOnce({
      status: "PREVIEW",
      totalRows: 1,
      validRows: 1,
      invalidRows: 0,
      duplicateRows: 0,
      createRows: 1,
      updateRows: 0,
      mode: "CREATE_ONLY",
      warnings: ["No active academic year/term is set. Import will use the latest available setup: 2026/2027 / Term 2."],
      rows: [
        {
          rowNumber: 2,
          raw: { admissionNumber: "ADM-020", fullName: "Fallback Student", gender: "Female", className: "Senior 1", streamName: "A" },
          isValid: true,
          errors: [],
          action: "create",
          existingStudentId: null,
          generatedAdmissionNumber: null,
          classId: "class-1",
          streamId: "stream-1",
        },
      ],
    });

    const { container } = render(
      <MemoryRouter>
        <StudentsPage />
      </MemoryRouter>,
    );

    await user.click(screen.getAllByRole("button", { name: "Import Batch" })[0]);
    const file = new File(["admissionNumber,fullName,gender,class,stream\nADM-020,Fallback Student,Female,Senior 1,A"], "students.csv", { type: "text/csv" });
    const input = container.querySelector('input[type="file"]');
    expect(input).toBeInstanceOf(HTMLInputElement);
    await user.upload(input as HTMLInputElement, file);

    const previewButton = screen.getByRole("button", { name: "Preview" });
    expect(previewButton).toBeEnabled();
    await user.click(previewButton);

    await waitFor(() => expect(previewStudentImport).toHaveBeenCalledTimes(1));
    expect(screen.getByText(/latest available setup/i)).toBeInTheDocument();
  });

  it("uses polished separators and shows 'Not provided' for missing contact details", async () => {
    vi.mocked(fetchStudents).mockResolvedValueOnce({
      students: [
        {
          ...defaultStudents.students[0],
          guardianContacts: [
            {
              id: "contact-2",
              guardianName: "Jane Guardian",
              relationship: "Aunt",
              phone: "",
              email: "",
              preferredContactMethod: "EMAIL",
              isPrimary: false,
              canReceiveReports: true,
              notes: "",
            },
          ],
        },
      ],
    });

    render(
      <MemoryRouter>
        <StudentsPage />
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getAllByText("Ada Lovelace").length).toBeGreaterThan(0));
    expect(screen.getByText("Aunt • EMAIL")).toBeInTheDocument();
    expect(screen.getByText("Phone: Not provided")).toBeInTheDocument();
    expect(screen.getByText("Email: Not provided")).toBeInTheDocument();
    expect(screen.queryByText(/\s\?\s/)).not.toBeInTheDocument();
  });
});

