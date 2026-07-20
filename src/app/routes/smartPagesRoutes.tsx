import type { RouteObject } from "react-router-dom";
import { PermissionGuard } from "../../components/PermissionGuard";
import { AnalyticsPage } from "../../pages/smart-pages/AnalyticsPage";
import { AutomationsPage } from "../../pages/smart-pages/AutomationsPage";
import { BulkGeneratePage } from "../../pages/smart-pages/BulkGeneratePage";
import { BulkJobStatusPage } from "../../pages/smart-pages/BulkJobStatusPage";
import { CollectionDetailPage } from "../../pages/smart-pages/CollectionDetailPage";
import { CollectionsPage } from "../../pages/smart-pages/CollectionsPage";
import { DocumentEditorPage } from "../../pages/smart-pages/DocumentEditorPage";
import { NotificationsPage } from "../../pages/smart-pages/NotificationsPage";
import { PreferencesPage } from "../../pages/smart-pages/PreferencesPage";
import { SearchPage } from "../../pages/smart-pages/SearchPage";
import { SmartPagesBillingPage } from "../../pages/smart-pages/SmartPagesBillingPage";
import { SmartPagesPage } from "../../pages/smart-pages/SmartPagesPage";

export const smartPagesRoutes: RouteObject[] = [
  { path: "school/smart-pages", element: <PermissionGuard permission="app.admin"><SmartPagesPage /></PermissionGuard> },
  { path: "school/smart-pages/:id", element: <PermissionGuard permission="app.admin"><DocumentEditorPage /></PermissionGuard> },
  { path: "smart-pages", element: <PermissionGuard permission="app.admin"><SmartPagesPage /></PermissionGuard> },
  { path: "smart-pages/billing", element: <PermissionGuard permission="app.admin"><SmartPagesBillingPage /></PermissionGuard> },
  { path: "smart-pages/:id", element: <PermissionGuard permission="app.admin"><DocumentEditorPage /></PermissionGuard> },
  { path: "collections", element: <PermissionGuard permission="app.admin"><CollectionsPage /></PermissionGuard> },
  { path: "collections/:id", element: <PermissionGuard permission="app.admin"><CollectionDetailPage /></PermissionGuard> },
  { path: "collections/:id/bulk-generate", element: <PermissionGuard permission="app.admin"><BulkGeneratePage /></PermissionGuard> },
  { path: "bulk-jobs/:id", element: <PermissionGuard permission="app.admin"><BulkJobStatusPage /></PermissionGuard> },
  { path: "automations", element: <PermissionGuard permission="app.admin"><AutomationsPage /></PermissionGuard> },
  { path: "analytics", element: <PermissionGuard permission="app.admin"><AnalyticsPage /></PermissionGuard> },
  { path: "notifications", element: <PermissionGuard permission="app.admin"><NotificationsPage /></PermissionGuard> },
  { path: "preferences", element: <PermissionGuard permission="app.admin"><PreferencesPage /></PermissionGuard> },
  { path: "search", element: <PermissionGuard permission="app.admin"><SearchPage /></PermissionGuard> },
];
