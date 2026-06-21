import { createBrowserRouter, Navigate } from "react-router-dom";
import { AppShell } from "../components/layout/AppShell";
import { lazy, Suspense, type ComponentType } from "react";
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
import { FeaturesDemoPage } from "../pages/FeaturesDemoPage";
import { PricingPage } from "../pages/PricingPage";
import { ContactPage } from "../pages/ContactPage";
import { ParentReportPage } from "../pages/ParentReportPage";
import { VerifyPage } from "../pages/VerifyPage";
import { OwnerDashboardPage } from "../pages/owner/OwnerDashboardPage";
import { OwnerSchoolsPage } from "../pages/owner/OwnerSchoolsPage";
import { OwnerUsersPage } from "../pages/owner/OwnerUsersPage";
import { SmartPagesPage } from "../pages/smart-pages/SmartPagesPage";
import { SmartPagesBillingPage } from "../pages/smart-pages/SmartPagesBillingPage";
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
import { RouteErrorPage } from "../pages/RouteErrorPage";
import { PromotionWorkspacePage } from "../pages/PromotionWorkspacePage";

const lawyerSmartPagesEnabled = import.meta.env.VITE_ENABLE_SMART_PAGES_LAWYERS === "true";
const LawyerShell = lazy(() => import("../components/lawyers/LawyerShell").then((module) => ({ default: module.LawyerShell })));
const LawyerDashboardPage = lazy(() => import("../pages/lawyers/LawyerDashboardPage").then((module) => ({ default: module.LawyerDashboardPage })));
const LawyerDocumentsPage = lazy(() => import("../pages/lawyers/LawyerDocumentsPage").then((module) => ({ default: module.LawyerDocumentsPage })));
const LawyerDocumentEditorPage = lazy(() => import("../pages/lawyers/LawyerDocumentEditorPage").then((module) => ({ default: module.LawyerDocumentEditorPage })));
const LawyerOnboardingPage = lazy(() => import("../pages/lawyers/LawyerOnboardingPage").then((module) => ({ default: module.LawyerOnboardingPage })));

function lazyElement(Component: ComponentType) {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-slate-500">Loading...</div>}>
      <Component />
    </Suspense>
  );
}

export const router = createBrowserRouter([
  {
    path: "/",
    element: <DemoPage />,
  },
  {
    element: <AppShell />,
    errorElement: <RouteErrorPage />,
    children: [
      { path: "dashboard", element: <DashboardPage /> },
      { path: "students", element: <StudentsPage /> },
      { path: "student-credentials", element: <Navigate to="/demos" replace /> },
      { path: "reports", element: <ReportsPage /> },
      { path: "reports/release", element: <ReleaseCenterPage /> },
      { path: "promotions", element: <PromotionWorkspacePage /> },
      { path: "imports/marks", element: <MarksImportPage /> },
      { path: "marksheets", element: <MarksheetsPage /> },
      { path: "settings", element: <SettingsPage /> },
      { path: "school/smart-pages", element: <SmartPagesPage /> },
      { path: "school/smart-pages/:id", element: <DocumentEditorPage /> },
      { path: "smart-pages", element: <SmartPagesPage /> },
      { path: "smart-pages/billing", element: <SmartPagesBillingPage /> },
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
  { path: "/demos", element: <FeaturesDemoPage /> },
  { path: "/demo", element: <Navigate to="/demos" replace /> },
  { path: "/dem", element: <Navigate to="/demos" replace /> },
  { path: "/pricing", element: <PricingPage /> },
  { path: "/contact", element: <ContactPage /> },
  { path: "/login", element: <LoginPage /> },
  { path: "/logout", element: <LogoutPage /> },
  { path: "/parent/r/:token", element: <ParentReportPage /> },
  { path: "/verify/:code", element: <VerifyPage /> },
  { path: "/p/:token", element: <PublishedDocumentPage /> },
  ...(lawyerSmartPagesEnabled ? [{
    path: "/lawyers",
    element: lazyElement(LawyerShell),
    errorElement: <RouteErrorPage />,
    children: [
      { index: true, element: lazyElement(LawyerDashboardPage) },
      { path: "dashboard", element: lazyElement(LawyerDashboardPage) },
      { path: "smart-pages", element: lazyElement(LawyerDocumentsPage) },
      { path: "smart-pages/:id", element: lazyElement(LawyerDocumentEditorPage) },
      { path: "documents", element: lazyElement(LawyerDocumentsPage) },
      { path: "documents/:id", element: lazyElement(LawyerDocumentEditorPage) },
      { path: "onboarding", element: lazyElement(LawyerOnboardingPage) },
      { path: "settings", element: lazyElement(LawyerOnboardingPage) },
    ],
  }] : []),
  {
    path: "/owner",
    element: <OwnerShell />,
    errorElement: <RouteErrorPage />,
    children: [
      { index: true, element: <OwnerDashboardPage /> },
      { path: "schools", element: <OwnerSchoolsPage /> },
      { path: "users", element: <OwnerUsersPage /> },
    ],
  },
]);
