import type { RouteObject } from "react-router-dom";
import { PermissionGuard } from "../../components/PermissionGuard";
import { MarksImportPage } from "../../pages/MarksImportPage";
import { MarksheetsPage } from "../../pages/MarksheetsPage";
import { PromotionWorkspacePage } from "../../pages/PromotionWorkspacePage";
import { ReleaseCenterPage } from "../../pages/ReleaseCenterPage";
import { ReportsPage } from "../../pages/ReportsPage";

export const reportsRoutes: RouteObject[] = [
  { path: "reports", element: <PermissionGuard permission="app.admin"><ReportsPage /></PermissionGuard> },
  { path: "reports/release", element: <PermissionGuard permission="app.admin"><ReleaseCenterPage /></PermissionGuard> },
  { path: "promotions", element: <PermissionGuard permission="app.admin"><PromotionWorkspacePage /></PermissionGuard> },
  { path: "imports/marks", element: <PermissionGuard permission="app.admin"><MarksImportPage /></PermissionGuard> },
  { path: "marksheets", element: <PermissionGuard permission="app.admin"><MarksheetsPage /></PermissionGuard> },
];
