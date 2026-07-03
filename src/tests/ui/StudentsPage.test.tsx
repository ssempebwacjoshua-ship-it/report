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
  deleteStudentPassportPhoto: vi.fn(),
  fetchStudentImportJob: vi.fn(),
  previewStudentImport: vi.fn(),
  updateGuardianContact: vi.fn(),
  uploadStudentPassportPhoto: vi.fn(),
}));

import { fetchReportContext } from "../../client/reportsClient";
import { commitStudentImport, createStudent, fetchStudents, previewStudentImport, uploadStudentPassportPhoto } from "../../client/studentsClient";

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

  it("refreshes the selected student after passport photo upload", async () => {
    const user = userEvent.setup();
    vi.mocked(uploadStudentPassportPhoto).mockResolvedValueOnce({
      passportPhotoUrl: "https://res.cloudinary.com/demo/image/upload/v1/school-connect/students/student-1/passport.webp",
      passportPhotoUpdatedAt: "2026-06-27T00:00:00.000Z",
    });
    vi.mocked(fetchStudents)
      .mockResolvedValueOnce(defaultStudents)
      .mockResolvedValueOnce({
        students: [{
          ...defaultStudents.students[0],
          passportPhotoUrl: "https://res.cloudinary.com/demo/image/upload/v1/school-connect/students/student-1/passport.webp",
          passportPhotoUpdatedAt: "2026-06-27T00:00:00.000Z",
        }],
      });

    const { container } = render(
      <MemoryRouter>
        <StudentsPage />
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getAllByText("Ada Lovelace").length).toBeGreaterThan(0));
    const input = container.querySelector('input[type="file"][accept*="image"]');
    expect(input).toBeInstanceOf(HTMLInputElement);
    await user.upload(input as HTMLInputElement, new File(["photo"], "passport.jpg", { type: "image/jpeg" }));

    await waitFor(() => expect(uploadStudentPassportPhoto).toHaveBeenCalledWith("student-1", expect.any(File)));
    await waitFor(() => expect(fetchStudents).toHaveBeenCalledTimes(2));
  }, 15000);

  it("creates a student with a default class and stream and uploads an optional passport photo", async () => {
    const user = userEvent.setup();
    const passportPhoto = new File(["photo"], "passport.jpg", { type: "image/jpeg" });
    vi.mocked(createStudent).mockResolvedValueOnce({
      student: { id: "student-new" },
      admissionNumber: "ADM-002",
    });
    vi.mocked(uploadStudentPassportPhoto).mockResolvedValueOnce({
      passportPhotoUrl: "https://res.cloudinary.com/demo/image/upload/v1/school-connect/students/student-new/passport.webp",
      passportPhotoUpdatedAt: "2026-06-28T00:00:00.000Z",
    });
    vi.mocked(fetchStudents)
      .mockResolvedValueOnce(defaultStudents)
      .mockResolvedValueOnce(defaultStudents);

    const { container } = render(
      <MemoryRouter>
        <StudentsPage />
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getAllByText("Ada Lovelace").length).toBeGreaterThan(0));
    await user.click(screen.getByRole("button", { name: "Add Student" }));
    await user.type(screen.getByPlaceholderText("Full name"), "New Student");
    const photoInput = container.querySelector('input[type="file"][accept*="image"]');
    expect(photoInput).toBeInstanceOf(HTMLInputElement);
    await user.upload(photoInput as HTMLInputElement, passportPhoto);
    await user.click(screen.getByRole("button", { name: "Create" }));

    await waitFor(() => expect(createStudent).toHaveBeenCalledTimes(1));
    expect(createStudent).toHaveBeenCalledWith(expect.objectContaining({
      fullName: "New Student",
      classId: "class-1",
      streamId: "stream-1",
      isActive: true,
    }));
    expect(uploadStudentPassportPhoto).toHaveBeenCalledWith("student-new", passportPhoto);
    expect(fetchStudents).toHaveBeenCalledTimes(2);
  });
});

