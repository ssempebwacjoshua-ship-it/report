import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { InventoryItemsPage } from "../../pages/InventoryItemsPage";
import { InventoryPage } from "../../pages/InventoryPage";
import { InventoryReportingPage } from "../../pages/InventoryReportingPage";

const reportingRecordsState = vi.hoisted(() => ({
  recentRecords: [] as Array<{
    id: string;
    studentId: string;
    studentName: string;
    admissionNumber: string;
    status: "REPORTED";
    reportedAt: string;
    termId: null;
    items: Array<{
      itemId: string;
      itemName: string;
      quantity: number;
      recordedAt: string;
      recordedByName: string;
    }>;
  }>,
}));

const fetchInventoryReportingContextMock = vi.hoisted(() => vi.fn(async (search = "") => {
  const students = [
    {
      id: "student-1",
      admissionNumber: "A-001",
      studentName: "Ada Lovelace",
      className: "Senior 1",
      streamName: "A",
    },
    {
      id: "student-2",
      admissionNumber: "B-002",
      studentName: "Grace Hopper",
      className: "Senior 2",
      streamName: "B",
    },
  ];
  const normalized = search.trim().toLowerCase();
  return {
    students: normalized
      ? students.filter((student) =>
          student.studentName.toLowerCase().includes(normalized)
          || student.admissionNumber.toLowerCase().includes(normalized),
        )
      : students,
    recentRecords: reportingRecordsState.recentRecords,
  };
}));

vi.mock("../../client/inventoryClient", () => ({
  fetchInventoryOverview: vi.fn(async () => ({
    summary: {
      itemsTracked: 8,
      lowStock: 2,
      itemsBroughtToday: 7,
      itemsIssuedToday: 4,
      reconciliationIssues: 1,
    },
    items: [],
    recentMovements: [{
      id: "move-1",
      itemId: "item-1",
      itemName: "Soap",
      type: "ISSUED",
      quantity: 2,
      purpose: "Dormitory hygiene",
      notes: "Ref dorm-1",
      createdAt: "2026-07-23T10:00:00.000Z",
      studentName: null,
      recipientName: "Matron",
      recipientType: "Staff",
      recordedByName: "Admin User",
    }],
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
  fetchInventoryReportingContext: fetchInventoryReportingContextMock,
  saveStudentReportingRecord: vi.fn(async (input: { studentId: string; items: Array<{ itemId: string; quantity: number }> }) => {
    const student = input.studentId === "student-2"
      ? { studentName: "Grace Hopper", admissionNumber: "B-002" }
      : { studentName: "Ada Lovelace", admissionNumber: "A-001" };
    reportingRecordsState.recentRecords = [{
      id: "record-1",
      studentId: input.studentId,
      studentName: student.studentName,
      admissionNumber: student.admissionNumber,
      status: "REPORTED",
      reportedAt: "2026-07-23T10:00:00.000Z",
      termId: null,
      items: input.items.map((item) => ({
        itemId: item.itemId,
        itemName: item.itemId === "item-1" ? "Soap" : "Unknown",
        quantity: item.quantity,
        recordedAt: "2026-07-23T10:00:00.000Z",
        recordedByName: "Admin User",
      })),
    }];
    return { record: { id: "record-1" } };
  }),
  archiveInventoryItem: vi.fn(async () => ({ ok: true })),
  fetchInventoryReconciliation: vi.fn(async () => ({
    summary: { itemsTracked: 0, lowStock: 0, itemsBroughtToday: 0, itemsIssuedToday: 0, reconciliationIssues: 0 },
    issues: [],
  })),
}));

function renderWithRouter(node: React.ReactNode, route = "/inventory") {
  return render(<MemoryRouter initialEntries={[route]}>{node}</MemoryRouter>);
}

beforeEach(() => {
  vi.clearAllMocks();
  reportingRecordsState.recentRecords = [];
});

describe("Inventory module pages", () => {
  it("shows the inventory dashboard row content on the overview page", async () => {
    renderWithRouter(<InventoryPage />);

    expect(await screen.findByText("Stock and reporting-day operations")).toBeInTheDocument();
    expect(screen.getByText("Items tracked")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open items" })).toHaveAttribute("href", "/inventory/items");
    expect(screen.getByRole("cell", { name: "Matron (Staff)" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "Dormitory hygiene" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "Admin User" })).toBeInTheDocument();
    expect(screen.getByText("No low-stock alerts right now.")).toBeInTheDocument();
    expect(screen.getByText("No reporting-day registrations recorded yet.")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Open reporting day" }).length).toBeGreaterThan(0);
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
    await waitFor(() => expect(screen.getByLabelText("Item name")).toHaveValue(""));
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
    await waitFor(() => expect(screen.getByLabelText("Receive item")).toHaveValue(""));
  });

  it("allows an admin to save a taken-out stock record", async () => {
    const client = await import("../../client/inventoryClient");
    renderWithRouter(<InventoryItemsPage />, "/inventory/items");

    fireEvent.change(await screen.findByLabelText("Issue item"), { target: { value: "item-1" } });
    fireEvent.change(screen.getByLabelText("Issue quantity"), { target: { value: "2" } });
    fireEvent.change(screen.getByLabelText("Recipient name"), { target: { value: "Kitchen team" } });
    fireEvent.change(screen.getByLabelText("Recipient type"), { target: { value: "Kitchen" } });
    fireEvent.change(screen.getByLabelText("Issue purpose"), { target: { value: "Lunch service" } });
    fireEvent.change(screen.getByLabelText("Issue notes"), { target: { value: "Midday meal" } });
    fireEvent.click(screen.getByRole("button", { name: "Save taken-out record" }));

    await waitFor(() => expect(vi.mocked(client.recordInventoryMovement)).toHaveBeenCalledWith("issue", {
      itemId: "item-1",
      quantity: 2,
      recipientName: "Kitchen team",
      recipientType: "Kitchen",
      source: "Lunch service",
      notes: "Midday meal",
    }));
    await waitFor(() => expect(screen.getByLabelText("Issue item")).toHaveValue(""));
  });

  it("allows an admin to record student reporting-day brought items", async () => {
    const client = await import("../../client/inventoryClient");
    renderWithRouter(<InventoryReportingPage />, "/inventory/reporting");

    const studentSelect = await screen.findByLabelText("Select student");
    await waitFor(() => expect((studentSelect as HTMLSelectElement).value).toBe("student-1"));
    expect(screen.getByLabelText("Select item brought")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Select item brought"), { target: { value: "item-1" } });
    fireEvent.change(screen.getByLabelText("Quantity"), { target: { value: "1" } });
    fireEvent.click(screen.getByRole("button", { name: "Save item brought" }));

    await waitFor(() => expect(vi.mocked(client.saveStudentReportingRecord)).toHaveBeenCalledWith({
      studentId: "student-1",
      items: [{ itemId: "item-1", quantity: 1 }],
    }));
    await waitFor(() => expect(screen.getByLabelText("Select item brought")).toHaveValue(""));
    expect(await screen.findByRole("cell", { name: "Soap" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "Admin User" })).toBeInTheDocument();
  });

  it("allows an admin to search students before recording reporting-day items", async () => {
    renderWithRouter(<InventoryReportingPage />, "/inventory/reporting");

    await screen.findByLabelText("Select student");
    fireEvent.change(screen.getByLabelText("Search student"), { target: { value: "Grace" } });
    fireEvent.click(screen.getByRole("button", { name: "Search" }));

    await waitFor(() => expect(fetchInventoryReportingContextMock).toHaveBeenLastCalledWith("Grace"));
    await waitFor(() => expect(screen.getByRole("option", { name: "Grace Hopper (B-002)" })).toBeInTheDocument());
    expect(screen.queryByRole("option", { name: "Ada Lovelace (A-001)" })).not.toBeInTheDocument();
  });

  it("shows inventory items as the dropdown source when recording items brought", async () => {
    renderWithRouter(<InventoryReportingPage />, "/inventory/reporting");

    const itemSelect = await screen.findByLabelText("Select item brought");
    expect(screen.getAllByRole("option", { name: "Soap" }).length).toBeGreaterThan(0);
    expect(itemSelect).toBeInTheDocument();
    expect(screen.queryByText(/expected quantity/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/partial/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/missing/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/complete/i)).not.toBeInTheDocument();
  });

  it("shows the add-item-first guidance when no inventory item names exist", async () => {
    const client = await import("../../client/inventoryClient");
    vi.mocked(client.fetchInventoryItems).mockResolvedValueOnce({ items: [] });

    renderWithRouter(<InventoryReportingPage />, "/inventory/reporting");

    expect(await screen.findByText("Add item names first")).toBeInTheDocument();
    expect(screen.getByText("Add item names first, such as ream, soap, toilet paper, books.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Add item" })).toHaveAttribute("href", "/inventory/items");
  });
});
