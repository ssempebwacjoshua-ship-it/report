import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { InventoryItemsPage } from "../../pages/InventoryItemsPage";
import { InventoryPage } from "../../pages/InventoryPage";
import { InventoryReportingPage } from "../../pages/InventoryReportingPage";

vi.mock("../../client/inventoryClient", () => ({
  fetchInventoryOverview: vi.fn(async () => ({
    summary: {
      itemsTracked: 8,
      lowStock: 2,
      reportingToday: 3,
      requirementsReceived: 7,
      reconciliationIssues: 1,
    },
    items: [],
    recentMovements: [],
    lowStockItems: [],
    reportingToday: [],
    reconciliationIssues: [],
  })),
  fetchInventoryItems: vi.fn(async () => ({
    items: [
      {
        id: "item-1",
        name: "Soap",
        category: "Hygiene",
        unit: "bar",
        minimumStock: 4,
        active: true,
        onHandQuantity: 6,
        lowStock: false,
        updatedAt: new Date().toISOString(),
      },
    ],
  })),
  createInventoryItem: vi.fn(async () => ({ item: { id: "item-2" } })),
  recordInventoryMovement: vi.fn(async () => ({ movement: { id: "move-1" } })),
  fetchInventoryReportingContext: vi.fn(async () => ({
    students: [
      {
        id: "student-1",
        admissionNumber: "A-001",
        studentName: "Ada Lovelace",
        className: "Senior 1",
        streamName: "A",
      },
    ],
    requirements: [
      {
        id: "req-1",
        itemId: "item-1",
        itemName: "Soap",
        requiredQuantity: 1,
        classId: null,
        className: null,
        termId: null,
        termName: null,
        active: true,
      },
    ],
    recentRecords: [],
  })),
  saveReportingRequirement: vi.fn(async () => ({ ok: true })),
  saveStudentReportingRecord: vi.fn(async () => ({ record: { id: "record-1" } })),
  archiveInventoryItem: vi.fn(async () => ({ ok: true })),
  fetchInventoryReconciliation: vi.fn(async () => ({
    summary: { itemsTracked: 0, lowStock: 0, reportingToday: 0, requirementsReceived: 0, reconciliationIssues: 0 },
    issues: [],
  })),
}));

function renderWithRouter(node: React.ReactNode, route = "/inventory") {
  return render(<MemoryRouter initialEntries={[route]}>{node}</MemoryRouter>);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("Inventory module pages", () => {
  it("shows the inventory dashboard row content on the overview page", async () => {
    renderWithRouter(<InventoryPage />);

    expect(await screen.findByText("Stock and reporting-day operations")).toBeInTheDocument();
    expect(screen.getByText("Items tracked")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open items" })).toHaveAttribute("href", "/inventory/items");
  });

  it("allows an admin to add an item", async () => {
    const client = await import("../../client/inventoryClient");
    renderWithRouter(<InventoryItemsPage />, "/inventory/items");

    fireEvent.change(await screen.findByLabelText("Item name"), { target: { value: "Rice" } });
    fireEvent.change(screen.getByLabelText("Category"), { target: { value: "Food" } });
    fireEvent.change(screen.getByLabelText("Unit"), { target: { value: "kg" } });
    fireEvent.change(screen.getByLabelText("Minimum stock"), { target: { value: "10" } });
    fireEvent.click(screen.getByRole("button", { name: "Add item" }));

    await waitFor(() => expect(vi.mocked(client.createInventoryItem)).toHaveBeenCalledWith({
      name: "Rice",
      category: "Food",
      unit: "kg",
      minimumStock: 10,
    }));
  });

  it("allows an admin to record stock received", async () => {
    const client = await import("../../client/inventoryClient");
    renderWithRouter(<InventoryItemsPage />, "/inventory/items");

    fireEvent.change(await screen.findByLabelText("Receive item"), { target: { value: "item-1" } });
    fireEvent.change(screen.getByLabelText("Receive quantity"), { target: { value: "5" } });
    fireEvent.change(screen.getByLabelText("Receive source"), { target: { value: "Supplier delivery" } });
    fireEvent.click(screen.getByRole("button", { name: "Record stock received" }));

    await waitFor(() => expect(vi.mocked(client.recordInventoryMovement)).toHaveBeenCalledWith("receive", expect.objectContaining({
      itemId: "item-1",
      quantity: 5,
      source: "Supplier delivery",
    })));
  });

  it("allows an admin to record student reporting-day brought items", async () => {
    const client = await import("../../client/inventoryClient");
    renderWithRouter(<InventoryReportingPage />, "/inventory/reporting");

    const studentSelect = await screen.findByLabelText("Student");
    await waitFor(() => expect((studentSelect as HTMLSelectElement).value).toBe("student-1"));
    fireEvent.change(screen.getByLabelText("Soap brought quantity"), { target: { value: "1" } });
    fireEvent.click(screen.getByRole("button", { name: "Save registration" }));

    await waitFor(() => expect(vi.mocked(client.saveStudentReportingRecord)).toHaveBeenCalledWith({
      studentId: "student-1",
      items: [{ itemId: "item-1", expectedQuantity: 1, broughtQuantity: 1 }],
    }));
  });
});
