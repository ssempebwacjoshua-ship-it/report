import { createBrowserRouter, Navigate } from "react-router-dom";
import { AppShell } from "../components/layout/AppShell";
import { OwnerShell } from "../components/layout/OwnerShell";
import { DashboardPage } from "../pages/DashboardPage";
import { ReleaseCenterPage } from "../pages/ReleaseCenterPage";
import { ReportsPage } from "../pages/ReportsPage";
import { MarksImportPage } from "../pages/MarksImportPage";
import { MarksheetsPage } from "../pages/MarksheetsPage";
import { StudentsPage } from "../pages/StudentsPage";
import { SettingsPage } from "../pages/SettingsPage";
import { LoginPage } from "../pages/LoginPage";
import { LogoutPage } from "../pages/LogoutPage";
import { DemoPage } from "../pages/DemoPage";
import { PricingPage } from "../pages/PricingPage";
import { ContactPage } from "../pages/ContactPage";
import { ParentReportPage } from "../pages/ParentReportPage";
import { VerifyPage } from "../pages/VerifyPage";
import { OwnerDashboardPage } from "../pages/owner/OwnerDashboardPage";
import { OwnerSchoolsPage } from "../pages/owner/OwnerSchoolsPage";
import { OwnerUsersPage } from "../pages/owner/OwnerUsersPage";
import { SmartPagesPage } from "../pages/smart-pages/SmartPagesPage";
import { DocumentEditorPage } from "../pages/smart-pages/DocumentEditorPage";
import { PublishedDocumentPage } from "../pages/smart-pages/PublishedDocumentPage";
import { CollectionsPage } from "../pages/smart-pages/CollectionsPage";
import { CollectionDetailPage } from "../pages/smart-pages/CollectionDetailPage";
import { BulkGeneratePage } from "../pages/smart-pages/BulkGeneratePage";
import { BulkJobStatusPage } from "../pages/smart-pages/BulkJobStatusPage";
import { AutomationsPage } from "../pages/smart-pages/AutomationsPage";
import { AnalyticsPage } from "../pages/smart-pages/AnalyticsPage";
import { NotificationsPage } from "../pages/smart-pages/NotificationsPage";
import { PreferencesPage } from "../pages/smart-pages/PreferencesPage";
import { SearchPage } from "../pages/smart-pages/SearchPage";

export const router = createBrowserRouter([
  // Public routes ? no AppShell, no auth
  { path: "/demo", element: <DemoPage /> },
  { path: "/pricing", element: <PricingPage /> },
  { path: "/contact", element: <ContactPage /> },
  { path: "/login", element: <LoginPage /> },
  { path: "/logout", element: <LogoutPage /> },
  { path: "/parent/r/:token", element: <ParentReportPage /> },
  { path: "/verify/:code", element: <VerifyPage /> },
  { path: "/p/:token", element: <PublishedDocumentPage /> },

  // Platform owner console ? wrapped in OwnerShell (owner guard inside)
  {
    path: "/owner",
    element: <OwnerShell />,
    children: [
      { index: true, element: <OwnerDashboardPage /> },
      { path: "schools", element: <OwnerSchoolsPage /> },
      { path: "users", element: <OwnerUsersPage /> },
    ],
  },

  // Admin routes ? wrapped in AppShell (auth guard inside)
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
      { path: "smart-pages", element: <SmartPagesPage /> },
      { path: "smart-pages/:id", element: <DocumentEditorPage /> },
      { path: "collections", element: <CollectionsPage /> },
      { path: "collections/:id", element: <CollectionDetailPage /> },
      { path: "collections/:id/bulk-generate", element: <BulkGeneratePage /> },
      { path: "bulk-jobs/:id", element: <BulkJobStatusPage /> },
      { path: "automations", element: <AutomationsPage /> },
      { path: "analytics", element: <AnalyticsPage /> },
      { path: "notifications", element: <NotificationsPage /> },
      { path: "preferences", element: <PreferencesPage /> },
      { path: "search", element: <SearchPage /> },
    ],
  },
]);

