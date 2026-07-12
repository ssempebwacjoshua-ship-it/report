import { MemoryRouter } from "react-router-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { StudentCredentialsPage } from "../../pages/StudentCredentialsPage";
import type { StudentCredential } from "../../shared/types/studentCredentials";
import type { StudentListItem } from "../../shared/types/students";

const state = vi.hoisted(() => ({
  credentials: [] as StudentCredential[],
  students: [] as StudentListItem[],
}));

vi.mock("../../client/studentCredentialsClient", () => ({
  fetchStudentCredentials: vi.fn(async () => ({ credentials: state.credentials })),
  issueStudentCredential: vi.fn(),
  deactivateStudentCredential: vi.fn(),
  scanStudentCredential: vi.fn(),
}));

vi.mock("../../client/studentsClient", () => ({
  fetchStudents: vi.fn(async () => ({ students: state.students })),
}));

function student(overrides: Partial<StudentListItem> = {}): StudentListItem {
  return {
    id: "student-a",
    admissionNumber: "A-001",
    studentName: "Ada Lovelace",
    isActive: true,
    enrollmentStatus: "ACTIVE",
    className: "Senior 1",
    classId: "class-a",
    streamName: "A",
    streamId: "stream-a",
    academicYearId: "year-a",
    termId: "term-a",
    contactReadiness: "READY",
    contactSummary: "Ready",
    guardianContacts: [],
    ...overrides,
  };
}

function credential(overrides: Partial<StudentCredential> = {}): StudentCredential {
  return {
    id: "credential-a",
    type: "NFC_WRISTBAND",
    credentialUID: "AB12",
    status: "ACTIVE",
    issuedAt: "2026-06-21T08:00:00.000Z",
    deactivatedAt: null,
    deactivatedReason: null,
    student: {
      id: "student-a",
      name: "Ada Lovelace",
      admissionNumber: "A-001",
      className: "Senior 1",
      streamName: "A",
      isActive: true,
    },
    ...overrides,
  };
}

describe("StudentCredentialsPage", () => {
  beforeEach(() => {
    state.students = [student()];
    state.credentials = [credential()];
  });

  it("disables issuing when the selected student already has an active NFC wristband", async () => {
    render(
      <MemoryRouter>
        <StudentCredentialsPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText(/student already has active nfc wristband ab12/i)).toBeInTheDocument();
    });

    fireEvent.change(screen.getByPlaceholderText("Tap wristband"), { target: { value: "CD34" } });

    expect(screen.getByText(/deactivate \/ mark lost first/i)).toBeInTheDocument();
    expect(screen.getByText("AB12")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /issue wristband/i })).toBeDisabled();
  });
});
