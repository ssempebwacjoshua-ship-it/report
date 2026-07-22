import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NfcGateOperationsPage } from "../../pages/NfcGateOperationsPage";

const mockFetchGateAdminDashboard = vi.hoisted(() => vi.fn());
const mockFetchStudentPassOuts = vi.hoisted(() => vi.fn());
const mockSearchStudentPassOutCandidates = vi.hoisted(() => vi.fn());
const mockCreateStudentPassOut = vi.hoisted(() => vi.fn());
const mockCancelStudentPassOut = vi.hoisted(() => vi.fn());
const mockFetchNfcVisitors = vi.hoisted(() => vi.fn());
const mockFetchNfcVisitorDetail = vi.hoisted(() => vi.fn());

vi.mock("../../client/studentCredentialsClient", () => ({
  cancelStudentPassOut: mockCancelStudentPassOut,
  createStudentPassOut: mockCreateStudentPassOut,
  fetchNfcGateAdminDashboard: mockFetchGateAdminDashboard,
  fetchNfcVisitorDetail: mockFetchNfcVisitorDetail,
  fetchNfcVisitors: mockFetchNfcVisitors,
  fetchStudentPassOuts: mockFetchStudentPassOuts,
  searchStudentPassOutCandidates: mockSearchStudentPassOutCandidates,
}));

function renderPage() {
  return render(
    <MemoryRouter>
      <NfcGateOperationsPage />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockFetchGateAdminDashboard.mockResolvedValue({
    summary: {
      activePassOuts: 2,
      studentsCurrentlyOut: 1,
      visitorsCurrentlyInside: 3,
      failedParentSms: 1,
    },
    activity: [
      {
        id: "movement:1",
        type: "PASS_OUT_CHECKOUT",
        occurredAt: "2026-07-18T08:30:00.000Z",
        summary: "Claire Nakibuuka",
        detail: "Checked out using an approved pass-out.",
        student: {
          id: "student-1",
          name: "Claire Nakibuuka",
          admissionNumber: "SCU-S1A-018",
          className: "Senior 1",
          streamName: "A",
        },
      },
    ],
  });
  mockFetchStudentPassOuts.mockResolvedValue({
    passOuts: [
      {
        id: "passout-1",
        schoolId: "school-1",
        studentId: "student-1",
        status: "APPROVED",
        reason: "Clinic visit",
        approvedAt: "2026-07-18T08:00:00.000Z",
        activeFrom: "2026-07-18T09:00:00.000Z",
        activeUntil: "2026-07-18T12:00:00.000Z",
        checkedOutAt: null,
        checkedInAt: null,
        cancelledAt: null,
        cancellationReason: null,
        createdByUserId: "user-1",
        approvedByUserId: "user-1",
        cancelledByUserId: null,
        checkoutMovementEventId: null,
        checkinMovementEventId: null,
        createdAt: "2026-07-18T08:00:00.000Z",
        updatedAt: "2026-07-18T08:00:00.000Z",
        student: {
          id: "student-1",
          studentName: "Claire Nakibuuka",
          admissionNumber: "SCU-S1A-018",
          className: "Senior 1",
          streamName: "A",
          studentType: "DAY",
          isActive: true,
        },
      },
    ],
  });
  mockSearchStudentPassOutCandidates.mockResolvedValue({
    students: [
      {
        id: "student-2",
        studentName: "Mike Ssempebwa",
        admissionNumber: "SCU-S1B-030",
        className: "Senior 1",
        streamName: "B",
        studentType: "DAY",
        isActive: true,
      },
    ],
  });
  mockCreateStudentPassOut.mockResolvedValue({ passOut: {} });
  mockCancelStudentPassOut.mockResolvedValue({ passOut: {} });
  mockFetchNfcVisitors.mockResolvedValue({
    visits: [
      {
        id: "visit-1",
        status: "CHECKED_IN",
        purpose: "Meeting bursar",
        hostName: "Bursar",
        checkedInAt: "2026-07-18T08:10:00.000Z",
        checkedOutAt: null,
        idDocumentImageUrl: "/api/private-uploads/visitors/id-document.webp",
        selfieImageUrl: "/api/private-uploads/visitors/selfie.webp",
        createdAt: "2026-07-18T08:10:00.000Z",
        updatedAt: "2026-07-18T08:10:00.000Z",
        visitor: {
          id: "visitor-1",
          fullName: "Mary Nakiwala",
          phone: "256700000001",
          idDocumentType: "Passport",
          idDocumentNumber: "P12345",
        },
      },
    ],
  });
  mockFetchNfcVisitorDetail.mockResolvedValue({
    visit: {
      id: "visit-1",
      status: "CHECKED_IN",
      purpose: "Meeting bursar",
      hostName: "Bursar",
      checkedInAt: "2026-07-18T08:10:00.000Z",
      checkedOutAt: null,
      idDocumentImageUrl: "/api/private-uploads/visitors/id-document.webp",
      selfieImageUrl: "/api/private-uploads/visitors/selfie.webp",
      createdAt: "2026-07-18T08:10:00.000Z",
      updatedAt: "2026-07-18T08:10:00.000Z",
      visitor: {
        id: "visitor-1",
        fullName: "Mary Nakiwala",
        phone: "256700000001",
        idDocumentType: "Passport",
        idDocumentNumber: "P12345",
      },
    },
  });
});

describe("NfcGateOperationsPage", () => {
  it("shows gate admin summaries and keeps pass-outs off the wristbands page", async () => {
    renderPage();

    await waitFor(() => expect(screen.getByRole("heading", { name: "Gate Operations" })).toBeInTheDocument());
    expect(screen.getByRole("link", { name: "Security Scan" })).toHaveAttribute("href", "/nfc/gate");
    expect(screen.getByRole("button", { name: "Student Pass-outs" })).toBeInTheDocument();
  });

  it("creates a pass-out from the dedicated gate operations page", async () => {
    renderPage();
    await waitFor(() => expect(screen.getByRole("heading", { name: "Gate Operations" })).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText("Student search"), { target: { value: "Mike" } });
    fireEvent.click(await screen.findByText("Mike Ssempebwa"));
    fireEvent.change(screen.getByLabelText("Reason"), { target: { value: "Clinic review" } });
    fireEvent.change(screen.getByLabelText("Active from"), { target: { value: "2026-07-18T10:00" } });
    fireEvent.change(screen.getByLabelText("Active until"), { target: { value: "2026-07-18T12:30" } });
    fireEvent.click(screen.getByRole("button", { name: "Approve pass-out" }));

    await waitFor(() => expect(mockCreateStudentPassOut).toHaveBeenCalled());
    expect(await screen.findByText(/pass-out approved for mike ssempebwa/i)).toBeInTheDocument();
  });

  it("shows visitor details in the visitors tab", async () => {
    renderPage();
    await waitFor(() => expect(screen.getByRole("heading", { name: "Gate Operations" })).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "Visitors" }));
    fireEvent.click((await screen.findAllByRole("button")).find((button) => button.textContent?.includes("Mary Nakiwala")) as HTMLButtonElement);

    await waitFor(() => expect(mockFetchNfcVisitorDetail).toHaveBeenCalledWith("visit-1"));
    expect(await screen.findByText(/phone: 256700000001/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open ID/passport image" })).toHaveAttribute("href", "/api/private-uploads/visitors/id-document.webp");
  });

  it("shows gate activity entries in the activity tab", async () => {
    renderPage();
    await waitFor(() => expect(screen.getByRole("heading", { name: "Gate Operations" })).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "Gate Activity" }));

    expect(await screen.findByText("PASS OUT CHECKOUT")).toBeInTheDocument();
    expect(screen.getByText("Claire Nakibuuka")).toBeInTheDocument();
  });
});
