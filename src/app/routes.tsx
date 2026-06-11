import { createBrowserRouter, Navigate } from "react-router-dom";
import { AppShell } from "../components/layout/AppShell";
import { DashboardPage } from "../pages/DashboardPage";
import { ReportsPage } from "../pages/ReportsPage";
import { MarksImportPage } from "../pages/MarksImportPage";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <AppShell />,
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      { path: "dashboard", element: <DashboardPage /> },
      { path: "reports", element: <ReportsPage /> },
      { path: "imports/marks", element: <MarksImportPage /> },
    ],
  },
]);
