import { MemoryRouter } from "react-router-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NfcBulkIssuingPage } from "../../pages/NfcBulkIssuingPage";
import type { NfcTag, NfcTagBatchSummary } from "../../shared/types/nfcTags";

const state = vi.hoisted(() => ({
  batches: [] as NfcTagBatchSummary[],
  inventory: [] as NfcTag[],
}));

vi.mock("../../client/nfcTagsClient", () => ({
  bulkImportUids: vi.fn(),
  createUrlTagBatch: vi.fn(),
  listTagBatches: vi.fn(async () => ({ batches: state.batches, total: state.batches.length })),
  listTagInventory: vi.fn(async () => ({ tags: state.inventory, total: state.inventory.length })),
}));

function batch(overrides: Partial<NfcTagBatchSummary> = {}): NfcTagBatchSummary {
  return {
    id: "batch-1",
    name: "Senior 1 East Wing",
    tagMode: "UID",
    quantity: 24,
    status: "ACTIVE",
    createdAt: "2026-07-15T08:00:00.000Z",
    updatedAt: "2026-07-15T08:00:00.000Z",
    totalTags: 24,
    written: 0,
    verified: 0,
    unallocated: 20,
    assigned: 4,
    disabled: 0,
    lost: 1,
    ...overrides,
  };
}

function tag(overrides: Partial<NfcTag> = {}): NfcTag {
  return {
    id: "tag-1",
    schoolId: "school-1",
    batchId: "batch-1",
    publicCode: "PUB-001122",
    physicalUid: "04AABBCCDD",
    tagMode: "UID",
    label: "Dorm Block A",
    type: "STUDENT",
    purpose: "ATTENDANCE",
    status: "ASSIGNED",
    studentId: "student-1",
    student: {
      id: "student-1",
      name: "Lydia Achieng",
      admissionNumber: "S1A-012",
      className: "Senior 1",
      streamName: "A",
    },
    writtenUrl: null,
    writtenPayload: null,
    issuedAt: null,
    writtenAt: null,
    verifiedAt: null,
    assignedAt: "2026-07-15T08:15:00.000Z",
    lastSeenAt: null,
    tapCount: 0,
    createdAt: "2026-07-15T08:00:00.000Z",
    updatedAt: "2026-07-15T08:15:00.000Z",
    ...overrides,
  };
}

describe("NfcBulkIssuingPage", () => {
  beforeEach(() => {
    state.batches = [batch()];
    state.inventory = [tag()];
  });

  it("renders batch summary content with mobile-friendly card actions", async () => {
    render(
      <MemoryRouter initialEntries={["/nfc/wristbands/bulk-issue"]}>
        <NfcBulkIssuingPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getAllByText("Senior 1 East Wing").length).toBeGreaterThan(0);
    });

    expect(screen.getAllByText(/unallocated/i).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: /view batch/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: /export csv/i }).length).toBeGreaterThan(0);
  });

  it("shows inventory details after opening a batch drill-down", async () => {
    render(
      <MemoryRouter initialEntries={["/nfc/wristbands/bulk-issue"]}>
        <NfcBulkIssuingPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getAllByRole("button", { name: /view batch/i }).length).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getAllByRole("button", { name: /view batch/i })[0]);

    await waitFor(() => {
      expect(screen.getAllByText(/lydia achieng/i).length).toBeGreaterThan(0);
    });

    expect(screen.getAllByRole("option", { name: "All" }).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/assigned to/i).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: /^close$/i }).length).toBeGreaterThan(0);
  });
});
