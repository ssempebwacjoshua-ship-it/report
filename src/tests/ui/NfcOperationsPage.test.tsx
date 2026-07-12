import { MemoryRouter } from "react-router-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NfcOperationsPage } from "../../pages/NfcOperationsPage";
import type { NfcTag } from "../../shared/types/nfcTags";

const mockListNfcTags = vi.hoisted(() => vi.fn());
const mockFetchOfflineSyncStatus = vi.hoisted(() => vi.fn());
const mockFetchStudents = vi.hoisted(() => vi.fn());
const mockGetStudentWalletPinStatus = vi.hoisted(() => vi.fn());

vi.mock("../../client/nfcTagsClient", () => ({
  assignNfcTag: vi.fn(),
  confirmReaderCredentialCapture: vi.fn(),
  disableNfcTag: vi.fn(),
  enableNfcTag: vi.fn(),
  generateNfcTags: vi.fn(),
  getReaderCredentialCapture: vi.fn(),
  getNfcTagEvents: vi.fn(),
  listNfcTags: mockListNfcTags,
  startReaderCredentialCapture: vi.fn(),
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
  setStudentWalletPin: vi.fn(),
}));

beforeEach(() => {
  mockListNfcTags.mockResolvedValue({ tags: SAMPLE_TAGS, total: SAMPLE_TAGS.length });
  mockFetchOfflineSyncStatus.mockResolvedValue({
    providerReachable: true,
    lastSyncAt: "2026-07-12T08:00:00.000Z",
    pendingCount: 0,
    stale: false,
  });
  mockFetchStudents.mockResolvedValue({
    students: [
      {
        id: "student-1",
        name: "Claire Nakibuuka With A Very Long Display Name For Layout",
        admissionNumber: "SCU-S1A-018",
        className: "Senior 1",
        streamName: "A",
        status: "ACTIVE",
      },
    ],
    total: 1,
  });
  mockGetStudentWalletPinStatus.mockResolvedValue({
    hasPin: true,
    canSetPin: true,
    canResetPin: true,
    maskedPin: "12••",
    updatedAt: "2026-07-12T08:05:00.000Z",
  });
});

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

function renderPage() {
  return render(
    <MemoryRouter>
      <NfcOperationsPage />
    </MemoryRouter>,
  );
}

describe("NfcOperationsPage compact table layout", () => {
  it("renders the compact NFC tags table with all row actions available", async () => {
    renderPage();

    await waitFor(() => expect(screen.getByRole("heading", { name: "NFC Tags" })).toBeInTheDocument());

    expect(screen.getByText("Generate new tags")).toBeInTheDocument();
    expect(screen.getByText("Filter:")).toBeInTheDocument();

    const table = document.querySelector("table.table-fixed");
    expect(table).not.toBeNull();

    expect(screen.getAllByRole("button", { name: "More" }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: "Unassign" }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: "Assign" }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: /Link reader/i }).length).toBeGreaterThan(0);

    fireEvent.click(screen.getAllByRole("button", { name: "More" })[0]);
    expect(screen.getAllByRole("button", { name: /Copy Payload/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: /Copy URL/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: /Wallet PIN/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: /Events/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: /Disable/i }).length).toBeGreaterThan(0);

    expect(screen.getAllByText("Claire Nakibuuka With A Very Long Display Name For Layout").length).toBeGreaterThan(0);
    expect(screen.getAllByText("SCNFC:PUBLICCODE-ASSIGNED-001-WITH-A-LONG-PAYLOAD-VALUE").length).toBeGreaterThan(0);
  });
});
