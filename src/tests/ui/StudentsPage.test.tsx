import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { StudentsPage } from "../../pages/StudentsPage";

vi.mock("../../client/reportsClient", () => ({
  fetchReportContext: vi.fn().mockResolvedValue({
    school: { code: "SCU-PREVIEW" },
    classes: [{ id: "class-1", name: "S1" }],
    streams: [{ id: "stream-1", classId: "class-1", name: "A" }],
  }),
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
  fetchStudents: vi.fn().mockResolvedValue({
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
  }),
  createStudent: vi.fn(),
  commitStudentImport: vi.fn(),
  createGuardianContact: vi.fn(),
  deleteGuardianContact: vi.fn(),
  previewStudentImport: vi.fn(),
  updateGuardianContact: vi.fn(),
}));

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
    expect(screen.getByRole("button", { name: "Import Students" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View Report" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Add Contact" }).length).toBeGreaterThan(0);
    await user.click(screen.getAllByText("Ada Lovelace")[0]);
    expect(screen.getAllByText("Ada Lovelace").length).toBeGreaterThan(0);
  });
});
