import type { RouteObject } from "react-router-dom";
import { PermissionGuard } from "../../components/PermissionGuard";
import { InventoryItemsPage } from "../../modules/inventory/pages/InventoryItemsPage";
import { InventoryPage } from "../../modules/inventory/pages/InventoryPage";
import { InventoryReconciliationPage } from "../../modules/inventory/pages/InventoryReconciliationPage";
import { InventoryReportingPage } from "../../modules/inventory/pages/InventoryReportingPage";

export const inventoryRoutes: RouteObject[] = [
  { path: "inventory", element: <PermissionGuard permission="app.admin"><InventoryPage /></PermissionGuard> },
  { path: "inventory/items", element: <PermissionGuard permission="app.admin"><InventoryItemsPage /></PermissionGuard> },
  { path: "inventory/reporting", element: <PermissionGuard permission="app.admin"><InventoryReportingPage /></PermissionGuard> },
  { path: "inventory/reconciliation", element: <PermissionGuard permission="app.admin"><InventoryReconciliationPage /></PermissionGuard> },
];
