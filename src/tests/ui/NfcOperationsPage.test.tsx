import { MemoryRouter } from "react-router-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NfcOperationsPage } from "../../pages/NfcOperationsPage";
import type { NfcTag } from "../../shared/types/nfcTags";

const mockAssignNfcTag = vi.hoisted(() => vi.fn());
const mockStartReaderCredentialCapture = vi.hoisted(() => vi.fn());
const mockListNfcTags = vi.hoisted(() => vi.fn());
const mockFetchOfflineSyncStatus = vi.hoisted(() => vi.fn());
const mockFetchStudents = vi.hoisted(() => vi.fn());
const mockGetStudentWalletPinStatus = vi.hoisted(() => vi.fn());
const mockSetStudentWalletPin = vi.hoisted(() => vi.fn());

vi.mock("../../client/nfcTagsClient", () => ({
  assignNfcTag: mockAssignNfcTag,
  startReaderCredentialCapture: mockStartReaderCredentialCapture,
  confirmReaderCredentialCapture: vi.fn(),
  disableNfcTag: vi.fn(),
  enableNfcTag: vi.fn(),
  generateNfcTags: vi.fn(),
  getReaderCredentialCapture: vi.fn(),
  getNfcTagEvents: vi.fn(),
  listNfcTags: mockListNfcTags,
  transferReaderCredentialCapture: vi.fn(),
  unassignNfcTag: vi.fn(),
}));

vi.mock("../../client/nfcOfflineClient", () => ({
  fetchOfflineSyncStatus: mockFetchOfflineSyncStatus,
}));

vi.mock("../../client/studentsClient", () => ({
  fetchStudents: mockFetchStudents,
}));

vi.mock("../../client/studentCredentialsClient", () => ({
  getStudentWalletPinStatus: mockGetStudentWalletPinStatus,
  setStudentWalletPin: mockSetStudentWalletPin,
}));

const SAMPLE_TAGS: NfcTag[] = [
  {
    id: "tag-1",
    schoolId: "school-1",
    batchId: null,
    publicCode: "PUBLICCODE-ASSIGNED-001",
    physicalUid: null,
    tagMode: "TEXT",
    label: "Tag 48048b9f",
    type: "STUDENT",
    purpose: "ATTENDANCE",
    status: "ASSIGNED",
    studentId: "student-1",
    student: {
      id: "student-1",
      name: "Claire Nakibuuka With A Very Long Display Name For Layout",
      admissionNumber: "SCU-S1A-018",
      className: "Senior 1",
      streamName: "A",
    },
    writtenUrl: "https://ssamenj.vercel.app/nfc/t/PUBLICCODE-ASSIGNED-001",
    writtenPayload: "SCNFC:PUBLICCODE-ASSIGNED-001-WITH-A-LONG-PAYLOAD-VALUE",
    issuedAt: "2026-07-10T08:00:00.000Z",
    writtenAt: "2026-07-10T09:00:00.000Z",
    verifiedAt: null,
    assignedAt: "2026-07-10T09:10:00.000Z",
    lastSeenAt: "2026-07-12T07:30:00.000Z",
    tapCount: 12,
    createdAt: "2026-07-10T08:00:00.000Z",
    updatedAt: "2026-07-12T07:30:00.000Z",
  },
  {
    id: "tag-2",
    schoolId: "school-1",
    batchId: null,
    publicCode: "PUBLICCODE-UNASSIGNED-002",
    physicalUid: null,
    tagMode: "URL",
    label: null,
    type: "STUDENT",
    purpose: "ATTENDANCE",
    status: "UNASSIGNED",
    studentId: null,
    student: null,
    writtenUrl: null,
    writtenPayload: null,
    issuedAt: "2026-07-10T08:10:00.000Z",
    writtenAt: null,
    verifiedAt: null,
    assignedAt: null,
    lastSeenAt: null,
    tapCount: 0,
    createdAt: "2026-07-10T08:10:00.000Z",
    updatedAt: "2026-07-12T07:30:00.000Z",
  },
  {
    id: "tag-3",
    schoolId: "school-1",
    batchId: null,
    publicCode: "PUBLICCODE-DISABLED-003",
    physicalUid: null,
    tagMode: "UID",
    label: "Dorm wristband",
    type: "STUDENT",
    purpose: "ATTENDANCE",
    status: "DISABLED",
    studentId: null,
    student: null,
    writtenUrl: null,
    writtenPayload: null,
    issuedAt: "2026-07-10T08:20:00.000Z",
    writtenAt: null,
    verifiedAt: null,
    assignedAt: null,
    lastSeenAt: null,
    tapCount: 2,
    createdAt: "2026-07-10T08:20:00.000Z",
    updatedAt: "2026-07-12T07:30:00.000Z",
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  mockListNfcTags.mockResolvedValue({ tags: SAMPLE_TAGS, total: SAMPLE_TAGS.length });
  mockFetchOfflineSyncStatus.mockResolvedValue({
    providerReachable: true,
    lastSyncAt: "2026-07-12T08:00:00.000Z",
    pendingCount: 0,
    stale: false,
    devices: [],
  });
  mockFetchStudents.mockResolvedValue({
    students: [
      {
        id: "student-1",
        studentName: "Claire Nakibuuka With A Very Long Display Name For Layout",
        admissionNumber: "SCU-S1A-018",
        className: "Senior 1",
        streamName: "A",
        isActive: true,
        enrollmentStatus: "ACTIVE",
        classId: "class-1",
        streamId: "stream-1",
        academicYearId: "year-1",
        termId: "term-1",
        contactReadiness: "READY",
        contactSummary: "Ready",
        guardianContacts: [],
      },
      {
        id: "student-2",
        studentName: "Mike Ssempebwa",
        admissionNumber: "SCU-S1B-030",
        className: "Senior 1",
        streamName: "B",
        isActive: true,
        enrollmentStatus: "ACTIVE",
        classId: "class-1",
        streamId: "stream-2",
        academicYearId: "year-1",
        termId: "term-1",
        contactReadiness: "READY",
        contactSummary: "Ready",
        guardianContacts: [],
      },
    ],
  });
  mockGetStudentWalletPinStatus.mockResolvedValue({
    pinSet: true,
    locked: false,
    pinLockedUntil: null,
    pinFailedAttempts: 0,
  });
  mockSetStudentWalletPin.mockResolvedValue({
    walletId: "wallet-1",
    studentId: "student-1",
    pinSet: true,
    pinLocked: false,
    pinLockedUntil: null,
  });
  mockAssignNfcTag.mockResolvedValue({
    ...SAMPLE_TAGS[1],
    status: "ASSIGNED",
    studentId: "student-2",
    student: {
      id: "student-2",
      name: "Mike Ssempebwa",
      admissionNumber: "SCU-S1B-030",
      className: "Senior 1",
      streamName: "B",
    },
    assignedAt: "2026-07-12T08:30:00.000Z",
  });
  mockStartReaderCredentialCapture.mockResolvedValue({
    captureId: "capture-1",
    tagId: "tag-1",
    studentId: "student-1",
    deviceId: "device-1",
    deviceLabel: "Main Entrance Reader",
    createdAt: "2026-07-12T08:30:00.000Z",
    expiresAt: "2026-07-12T08:35:00.000Z",
    confirmedAt: null,
    status: "PENDING",
    preview: null,
    tag: {
      id: "tag-1",
      publicCode: "PUBLICCODE-ASSIGNED-001",
      label: "Tag 48048b9f",
      student: {
        id: "student-1",
        name: "Claire Nakibuuka With A Very Long Display Name For Layout",
        admissionNumber: "SCU-S1A-018",
      },
    },
  });
});

function renderPage() {
  return render(
    <MemoryRouter>
      <NfcOperationsPage />
    </MemoryRouter>,
  );
}

describe("NfcOperationsPage wristband grid layout", () => {
  it("renders the compact wristband grid with all row actions available", async () => {
    renderPage();

    await waitFor(() => expect(screen.getByRole("heading", { name: "Wristbands" })).toBeInTheDocument());

    expect(screen.getByRole("link", { name: "Wristbands" })).toHaveAttribute("href", "/nfc/wristbands");
    expect(screen.getByRole("link", { name: "Register" })).toHaveAttribute("href", "/nfc/wristbands/register");
    expect(screen.getByRole("link", { name: "Bulk Issue" })).toHaveAttribute("href", "/nfc/wristbands/bulk-issue");

    const cards = document.querySelectorAll(".rounded-2xl.border.border-slate-200.bg-white.p-4.shadow-sm");
    expect(cards.length).toBeGreaterThanOrEqual(2);

    expect(screen.getAllByRole("button", { name: "Open actions" }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: "Assign" }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: /Link reader/i }).length).toBeGreaterThan(0);

    fireEvent.click(screen.getAllByRole("button", { name: "Open actions" })[0]);
    expect(screen.getAllByRole("button", { name: /Copy Payload/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: /Copy URL/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: /Wallet PIN/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: /Events/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: /Disable/i }).length).toBeGreaterThan(0);

    expect(screen.getAllByText("Claire Nakibuuka With A Very Long Display Name For Layout").length).toBeGreaterThan(0);
    expect(screen.getAllByText("SCNFC:PUBLICCODE-ASSIGNED-001-WITH-A-LONG-PAYLOAD-VALUE").length).toBeGreaterThan(0);
    expect(screen.getAllByText("No student assigned").length).toBeGreaterThan(0);
  });

  it("opens the wallet PIN modal, saves a PIN, and clears stale modal state on close", async () => {
    renderPage();

    await waitFor(() => expect(screen.getByRole("heading", { name: "Wristbands" })).toBeInTheDocument());

    fireEvent.click(screen.getAllByRole("button", { name: "Open actions" })[0]);
    fireEvent.click(screen.getByRole("button", { name: "Wallet PIN" }));

    expect(await screen.findByText("Reset wallet PIN")).toBeInTheDocument();
    expect(mockGetStudentWalletPinStatus).toHaveBeenCalledWith("student-1");

    fireEvent.change(screen.getByLabelText("New PIN (4–6 digits)"), { target: { value: "1234" } });
    fireEvent.change(screen.getByLabelText("Confirm PIN"), { target: { value: "1234" } });
    fireEvent.change(screen.getByLabelText("Reason"), { target: { value: "Initial setup" } });

    fireEvent.click(screen.getByRole("button", { name: "Reset PIN" }));

    await waitFor(() => expect(mockSetStudentWalletPin).toHaveBeenCalledWith("student-1", { pin: "1234", reason: "Initial setup" }));
    expect(screen.getByText("PIN reset successfully.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Close" }));

    await waitFor(() => expect(screen.queryByText("PIN reset successfully.")).not.toBeInTheDocument());
    expect(screen.queryByDisplayValue("1234")).not.toBeInTheDocument();
  });

  it("shows a safe error when the wallet PIN API fails", async () => {
    mockSetStudentWalletPin.mockRejectedValueOnce(new Error("Could not set wallet PIN"));

    renderPage();

    await waitFor(() => expect(screen.getByRole("heading", { name: "Wristbands" })).toBeInTheDocument());

    fireEvent.click(screen.getAllByRole("button", { name: "Open actions" })[0]);
    fireEvent.click(screen.getByRole("button", { name: "Wallet PIN" }));

    fireEvent.change(await screen.findByLabelText("New PIN (4–6 digits)"), { target: { value: "1234" } });
    fireEvent.change(screen.getByLabelText("Confirm PIN"), { target: { value: "1234" } });
    fireEvent.change(screen.getByLabelText("Reason"), { target: { value: "Initial setup" } });

    fireEvent.click(screen.getByRole("button", { name: "Reset PIN" }));

    expect(await screen.findByText("Could not set wallet PIN")).toBeInTheDocument();
  });

  it("filters assignable students by trimmed case-insensitive name, admission number, and class/stream", async () => {
    renderPage();

    await waitFor(() => expect(screen.getByRole("heading", { name: "Wristbands" })).toBeInTheDocument());

    fireEvent.click(screen.getAllByRole("button", { name: "Assign" })[0]);

    const searchInput = await screen.findByLabelText("Search student");

    fireEvent.change(searchInput, { target: { value: "  mike  " } });
    expect(await screen.findByRole("button", { name: /Mike Ssempebwa/i })).toBeInTheDocument();

    fireEvent.change(searchInput, { target: { value: "SCU-S1A-018" } });
    expect(await screen.findByRole("button", { name: /Claire Nakibuuka With A Very Long Display Name For Layout/i })).toBeInTheDocument();

    fireEvent.change(searchInput, { target: { value: "senior 1 b" } });
    expect(await screen.findByRole("button", { name: /Mike Ssempebwa/i })).toBeInTheDocument();
  });

  it("shows an empty assign-search state and assigns the selected student", async () => {
    renderPage();

    await waitFor(() => expect(screen.getByRole("heading", { name: "Wristbands" })).toBeInTheDocument());

    fireEvent.click(screen.getAllByRole("button", { name: "Assign" })[0]);

    const searchInput = await screen.findByLabelText("Search student");

    fireEvent.change(searchInput, { target: { value: "zzz" } });
    expect(await screen.findByText("No students match your search.")).toBeInTheDocument();

    fireEvent.change(searchInput, { target: { value: "mike" } });
    fireEvent.click(await screen.findByRole("button", { name: /Mike Ssempebwa/i }));
    fireEvent.click(screen.getByRole("button", { name: "Assign to selected student" }));

    await waitFor(() => expect(mockAssignNfcTag).toHaveBeenCalledWith("tag-2", "student-2"));
    expect(screen.getByText("Tag assigned successfully")).toBeInTheDocument();
    expect(screen.getByText("Student: Mike Ssempebwa")).toBeInTheDocument();
  });

  it("opens the link reader modal from the link reader button", async () => {
    mockFetchOfflineSyncStatus.mockResolvedValueOnce({
      providerReachable: true,
      lastSyncAt: "2026-07-12T08:00:00.000Z",
      pendingCount: 0,
      stale: false,
      devices: [
        {
          id: "device-1",
          name: "Attendance Gate 01",
          deviceKey: "attendance-gate-01",
          location: "Main Entrance",
          locationName: "Main Entrance",
          mode: "ATTENDANCE",
          status: "ACTIVE",
          isActive: true,
          lastSeenAt: "2026-07-12T08:00:00.000Z",
        },
      ],
    });

    renderPage();

    await waitFor(() => expect(screen.getAllByRole("button", { name: /Link reader/i }).length).toBeGreaterThan(0));

    fireEvent.click(screen.getAllByRole("button", { name: /Link reader/i })[0]);

    expect(await screen.findByText("Link reader credential")).toBeInTheDocument();
    expect(screen.getByText(/Preserve the written/)).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /Main Entrance/ })).toBeInTheDocument();
  });

  it("lists a commissioned gate reader when it has location-aware attendance metadata", async () => {
    mockFetchOfflineSyncStatus.mockResolvedValueOnce({
      providerReachable: true,
      lastSyncAt: "2026-07-12T08:00:00.000Z",
      pendingCount: 0,
      stale: false,
      devices: [
        {
          id: "device-1",
          name: "Attendance Gate 01",
          deviceKey: "attendance-gate-01",
          location: "Main Entrance",
          locationName: "Main Entrance",
          locationType: "GATE",
          attendanceMode: "GATE_ATTENDANCE",
          mode: "GATE",
          status: "ACTIVE",
          isActive: true,
          lastSeenAt: "2026-07-12T08:00:00.000Z",
        },
      ],
    });

    renderPage();

    await waitFor(() => expect(screen.getByRole("heading", { name: "Wristbands" })).toBeInTheDocument());

    fireEvent.click(screen.getAllByRole("button", { name: /Link reader/i })[0]);

    expect(await screen.findByRole("option", { name: /Main Entrance/ })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /No active attendance readers found/i })).not.toBeInTheDocument();
  });
});
