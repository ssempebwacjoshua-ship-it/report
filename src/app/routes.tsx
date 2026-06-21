import { createBrowserRouter } from "react-router-dom";
import { AppShell } from "../components/layout/AppShell";
import { lazy, Suspense, type ComponentType } from "react";
import { OwnerShell } from "../components/layout/OwnerShell";
import { DashboardPage } from "../pages/DashboardPage";
import { ReleaseCenterPage } from "../pages/ReleaseCenterPage";
import { ReportsPage } from "../pages/ReportsPage";
import { MarksImportPage } from "../pages/MarksImportPage";
import { MarksheetsPage } from "../pages/MarksheetsPage";
import { StudentsPage } from "../pages/StudentsPage";
import { StudentCredentialsPage } from "../pages/StudentCredentialsPage";
import { SettingsPage } from "../pages/SettingsPage";
import { LoginPage } from "../pages/LoginPage";
import { LogoutPage } from "../pages/LogoutPage";
import { DemoPage } from "../pages/DemoPage";
import { FeaturesDemoPage } from "../pages/FeaturesDemoPage";
import { PricingPage } from "../pages/PricingPage";
import { ContactPage } from "../pages/ContactPage";
import { SSAMENJHomePage } from "../pages/SSAMENJHomePage";
import { DemosPage } from "../pages/DemosPage";
import { ProductsPage } from "../pages/ProductsPage";
import { AboutPage } from "../pages/AboutPage";
import { PublicLayout } from "../components/marketing/PublicLayout";
import { ParentReportPage } from "../pages/ParentReportPage";
import { VerifyPage } from "../pages/VerifyPage";
import { NfcAttendancePage } from "../pages/NfcAttendancePage";
import { NfcWalletsPage } from "../pages/NfcWalletsPage";
import { NfcCanteenChargePage } from "../pages/NfcCanteenChargePage";
import { NfcGateSecurityPage } from "../pages/NfcGateSecurityPage";
import { NfcTokenPage } from "../pages/NfcTokenPage";
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
  // ── SSAMENJ public website ── shared header/footer via PublicLayout
  {
    element: <PublicLayout />,
    children: [
      { path: "/",         element: <SSAMENJHomePage /> },
      { path: "/products", element: <ProductsPage /> },
      { path: "/demos",    element: <DemosPage /> },
      { path: "/about",    element: <AboutPage /> },
      { path: "/contact",  element: <ContactPage /> },
      { path: "/pricing",  element: <PricingPage /> },
    ],
  },

  // ── Preserved legacy / app public routes (own layout) ──
  { path: "/dem",           element: <DemoPage /> },          // Report Lab demo — DO NOT REMOVE
  { path: "/demo",          element: <DemoPage /> },          // Legacy landing page — keep working
  { path: "/features-demo", element: <FeaturesDemoPage /> },
  { path: "/login", element: <LoginPage /> },
  { path: "/logout", element: <LogoutPage /> },
  { path: "/parent/r/:token", element: <ParentReportPage /> },
  { path: "/verify/:code", element: <VerifyPage /> },
  { path: "/nfc/t/:token", element: <NfcTokenPage /> },
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

  // Platform owner console ? wrapped in OwnerShell (owner guard inside)
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

  // ── Authenticated app routes ── (AppShell handles auth guard internally)
  {
    path: "/",
    element: <AppShell />,
    errorElement: <RouteErrorPage />,
    children: [
      // No index route here — "/" is now the public SSAMENJ homepage above.
      // Authenticated users land on /dashboard directly after login.
      { path: "dashboard", element: <DashboardPage /> },
      { path: "students", element: <StudentsPage /> },
      { path: "student-credentials", element: <StudentCredentialsPage /> },
      { path: "nfc-attendance", element: <NfcAttendancePage /> },
      { path: "nfc-wallets", element: <NfcWalletsPage /> },
      { path: "canteen-charge", element: <NfcCanteenChargePage /> },
      { path: "canteen/nfc/:token", element: <NfcCanteenChargePage /> },
      { path: "gate-security", element: <NfcGateSecurityPage /> },
      { path: "gate/nfc/:token", element: <NfcGateSecurityPage /> },
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
]);

