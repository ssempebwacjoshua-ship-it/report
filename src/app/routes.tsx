import { createBrowserRouter, Navigate } from "react-router-dom";
import { AppShell } from "../components/layout/AppShell";
import { DashboardPage } from "../pages/DashboardPage";
import { ReportsPage } from "../pages/ReportsPage";
import { MarksImportPage } from "../pages/MarksImportPage";
import { StudentsPage } from "../pages/StudentsPage";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <AppShell />,
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      { path: "dashboard", element: <DashboardPage /> },
      { path: "students", element: <StudentsPage /> },
      { path: "reports", element: <ReportsPage /> },
      { path: "imports/marks", element: <MarksImportPage /> },
    ],
  },
]);
