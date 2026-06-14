import { createBrowserRouter, Navigate } from "react-router-dom";
import { AppShell } from "../components/layout/AppShell";
import { DashboardPage } from "../pages/DashboardPage";
import { ReleaseCenterPage } from "../pages/ReleaseCenterPage";
import { ReportsPage } from "../pages/ReportsPage";
import { MarksImportPage } from "../pages/MarksImportPage";
import { MarksheetsPage } from "../pages/MarksheetsPage";
import { StudentsPage } from "../pages/StudentsPage";
import { SettingsPage } from "../pages/SettingsPage";
import { LoginPage } from "../pages/LoginPage";
import { LogoutPage } from "../pages/LogoutPage";
import { ParentReportPage } from "../pages/ParentReportPage";
import { VerifyPage } from "../pages/VerifyPage";
import { DocumentCleanerPage } from "../pages/DocumentCleanerPage";

export const router = createBrowserRouter([
  // Public routes — no AppShell, no auth
  { path: "/login", element: <LoginPage /> },
  { path: "/logout", element: <LogoutPage /> },
  { path: "/parent/r/:token", element: <ParentReportPage /> },
  { path: "/verify/:code", element: <VerifyPage /> },

  // Admin routes — wrapped in AppShell (auth guard inside)
  {
    path: "/",
    element: <AppShell />,
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      { path: "dashboard", element: <DashboardPage /> },
      { path: "students", element: <StudentsPage /> },
      { path: "reports", element: <ReportsPage /> },
      { path: "reports/release", element: <ReleaseCenterPage /> },
      { path: "imports/marks", element: <MarksImportPage /> },
      { path: "marksheets", element: <MarksheetsPage /> },
      { path: "settings", element: <SettingsPage /> },
      { path: "documents/cleaner", element: <DocumentCleanerPage /> },
    ],
  },
]);
