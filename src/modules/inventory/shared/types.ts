export type InventoryDashboardSummary = {
  itemsTracked: number;
  lowStock: number;
  reportingToday: number;
  itemsBroughtToday: number;
  adjustmentsToday: number;
};

export type InventoryItemSummary = {
  id: string;
  name: string;
  category: string;
  unit: string;
  minimumStock: number;
  active: boolean;
  onHandQuantity: number;
  lowStock: boolean;
  updatedAt: string;
};

export type InventoryMovementView = {
  id: string;
  itemId: string;
  itemName: string;
  type: "RECEIVED" | "ISSUED" | "ADJUSTED" | "STUDENT_BROUGHT";
  quantity: number;
  source: string;
  notes: string | null;
  createdAt: string;
  studentName: string | null;
  recordedByUserId: string;
};

export type InventoryStudentOption = {
  id: string;
  admissionNumber: string;
  studentName: string;
  className: string | null;
  streamName: string | null;
};

export type StudentReportingItemView = {
  itemId: string;
  itemName: string;
  quantity: number;
  recordedAt: string;
  recordedByName: string;
};

export type StudentReportingRecordView = {
  id: string;
  studentId: string;
  studentName: string;
  admissionNumber: string;
  status: "REPORTED" | "PENDING";
  reportedAt: string;
  termId: string | null;
  items: StudentReportingItemView[];
};

export type InventoryReconciliationIssue = {
  itemId: string;
  itemName: string;
  currentQuantity: number;
  minimumStock: number;
  difference: number;
  status: "LOW_STOCK";
};

export type InventoryOverviewResponse = {
  summary: InventoryDashboardSummary;
  items: InventoryItemSummary[];
  recentMovements: InventoryMovementView[];
  lowStockItems: InventoryItemSummary[];
  reportingToday: StudentReportingRecordView[];
  reconciliationIssues: InventoryReconciliationIssue[];
};

export type InventoryItemsResponse = {
  items: InventoryItemSummary[];
};

export type InventoryMovementsResponse = {
  movements: InventoryMovementView[];
};

export type InventoryReportingContextResponse = {
  students: InventoryStudentOption[];
  recentRecords: StudentReportingRecordView[];
};

export type InventoryReconciliationResponse = {
  summary: InventoryDashboardSummary;
  issues: InventoryReconciliationIssue[];
};
