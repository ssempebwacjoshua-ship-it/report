import type { RouteObject } from "react-router-dom";
import { AppShell } from "../../components/layout/AppShell";
import { PermissionGuard } from "../../components/PermissionGuard";
import { CommunicationsPage } from "../../pages/CommunicationsPage";
import { DashboardPage } from "../../pages/DashboardPage";
import { RouteErrorPage } from "../../pages/RouteErrorPage";
import { SettingsPage } from "../../pages/SettingsPage";
import { StudentsPage } from "../../pages/StudentsPage";
import { nfcRoutes } from "./nfcRoutes";
import { reportsRoutes } from "./reportsRoutes";
import { RoleAwareRedirect } from "./routeHelpers";
import { smartPagesRoutes } from "./smartPagesRoutes";

export const protectedRoutes: RouteObject[] = [
  {
    path: "/",
    element: <AppShell />,
    errorElement: <RouteErrorPage />,
    children: [
      { index: true, element: <RoleAwareRedirect /> },
      { path: "dashboard", element: <PermissionGuard permission="app.admin"><DashboardPage /></PermissionGuard> },
      { path: "students", element: <PermissionGuard permission="app.admin"><StudentsPage /></PermissionGuard> },
      ...nfcRoutes,
      ...reportsRoutes,
      { path: "communications", element: <PermissionGuard permission="communications.view"><CommunicationsPage /></PermissionGuard> },
      { path: "settings", element: <PermissionGuard permission="app.admin"><SettingsPage /></PermissionGuard> },
      { path: "settings/report-personalisation", element: <PermissionGuard permission="app.admin"><SettingsPage /></PermissionGuard> },
      ...smartPagesRoutes,
    ],
  },
];
