import { createBrowserRouter, Navigate } from "react-router-dom";
import { AppShell } from "../components/layout/AppShell";
import { lazy, Suspense, type ComponentType, type ReactNode } from "react";
import { OwnerShell } from "../components/layout/OwnerShell";
import { useAuth } from "../contexts/AuthContext";
import { getDefaultRouteForRole } from "../shared/permissions";
import { DashboardPage } from "../pages/DashboardPage";
import { ReleaseCenterPage } from "../pages/ReleaseCenterPage";
import { CommunicationsPage } from "../pages/CommunicationsPage";
import { ReportsPage } from "../pages/ReportsPage";
import { MarksImportPage } from "../pages/MarksImportPage";
import { MarksheetsPage } from "../pages/MarksheetsPage";
import { StudentsPage } from "../pages/StudentsPage";
import { StudentCredentialsPage } from "../pages/StudentCredentialsPage";
import { SettingsPage } from "../pages/SettingsPage";
import { LoginPage } from "../pages/LoginPage";
import { ForgotPasswordPage } from "../pages/ForgotPasswordPage";
import { TokenPasswordPage } from "../pages/TokenPasswordPage";
import { LogoutPage } from "../pages/LogoutPage";
import { PwaLaunchPage } from "../pages/PwaLaunchPage";
import { DemoPage } from "../pages/DemoPage";
import { FeaturesDemoPage } from "../pages/FeaturesDemoPage";
import { PricingPage } from "../pages/PricingPage";
import { ContactPage } from "../pages/ContactPage";
import { ParentReportPage } from "../pages/ParentReportPage";
import { VerifyPage } from "../pages/VerifyPage";
import { NfcAttendancePage } from "../pages/NfcAttendancePage";
import { NfcOfflinePage } from "../pages/NfcOfflinePage";
import { NfcWalletsPage } from "../pages/NfcWalletsPage";
import { NfcWalletTopUpPage } from "../pages/NfcWalletTopUpPage";
import { StudentWalletPage } from "../pages/StudentWalletPage";
import { StudentWalletTopUpPage } from "../pages/StudentWalletTopUpPage";
import { NfcCanteenTransactionsPage } from "../pages/NfcCanteenTransactionsPage";
import { NfcCanteenChargePage } from "../pages/NfcCanteenChargePage";
import { NfcCanteenReconciliationPage } from "../pages/NfcCanteenReconciliationPage";
import { NfcSettingsPage } from "../pages/NfcSettingsPage";
import { NfcFeeHoldsPage } from "../pages/NfcFeeHoldsPage";
import { NfcGateOperationsPage } from "../pages/NfcGateOperationsPage";
import { NfcGateSecurityPage } from "../pages/NfcGateSecurityPage";
import { NfcTokenPage } from "../pages/NfcTokenPage";
import { NfcOperationsPage } from "../pages/NfcOperationsPage";
import { NfcBulkIssuingPage } from "../pages/NfcBulkIssuingPage";
import { NfcBulkAllocationPage } from "../pages/NfcBulkAllocationPage";
import { StaffUsersPage } from "../pages/StaffUsersPage";
import { NfcTapPage } from "../pages/NfcTapPage";
import { OwnerDashboardPage } from "../pages/owner/OwnerDashboardPage";
import { OwnerReaderDetailPage, OwnerReaderManagementPage } from "../pages/owner/OwnerReaderManagementPage";
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
import { PermissionGuard } from "../components/PermissionGuard";
import { SectionLoader } from "../components/SectionLoader";

const routerBasename = import.meta.env.BASE_URL.replace(/\/$/, "") || "/";
const lawyerSmartPagesEnabled = import.meta.env.VITE_ENABLE_SMART_PAGES_LAWYERS === "true";
const LawyerShell = lazy(() => import("../components/lawyers/LawyerShell").then((module) => ({ default: module.LawyerShell })));
const LawyerDashboardPage = lazy(() => import("../pages/lawyers/LawyerDashboardPage").then((module) => ({ default: module.LawyerDashboardPage })));
const LawyerDocumentsPage = lazy(() => import("../pages/lawyers/LawyerDocumentsPage").then((module) => ({ default: module.LawyerDocumentsPage })));
const LawyerDocumentEditorPage = lazy(() => import("../pages/lawyers/LawyerDocumentEditorPage").then((module) => ({ default: module.LawyerDocumentEditorPage })));
const LawyerOnboardingPage = lazy(() => import("../pages/lawyers/LawyerOnboardingPage").then((module) => ({ default: module.LawyerOnboardingPage })));

function lazyElement(Component: ComponentType) {
  return (
    <Suspense fallback={<SectionLoader message="Loading page..." />}>
      <Component />
    </Suspense>
  );
}

function RoleAwareRedirect() {
  const { user } = useAuth();
  return <Navigate to={getDefaultRouteForRole(user?.role)} replace />;
}

function PublicOnlyRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <SectionLoader message="Loading SSAMENJ..." />;
  }

  if (user) {
    return <Navigate to={user.isPlatformOwner ? "/owner" : getDefaultRouteForRole(user.role)} replace />;
  }

  return <>{children}</>;
}

export const router = createBrowserRouter([
  // Public routes — no AppShell, no auth
  { path: "/demo", element: <PublicOnlyRoute><DemoPage /></PublicOnlyRoute> },
  { path: "/features-demo", element: <PublicOnlyRoute><FeaturesDemoPage /></PublicOnlyRoute> },
  { path: "/pricing", element: <PublicOnlyRoute><PricingPage /></PublicOnlyRoute> },
  { path: "/contact", element: <PublicOnlyRoute><ContactPage /></PublicOnlyRoute> },
  { path: "/login", element: <PublicOnlyRoute><LoginPage /></PublicOnlyRoute> },
  { path: "/pwa-launch", element: <PwaLaunchPage /> },
  { path: "/forgot-password", element: <ForgotPasswordPage /> },
  { path: "/reset-password", element: <TokenPasswordPage mode="reset" /> },
  { path: "/account/setup", element: <TokenPasswordPage mode="setup" /> },
  { path: "/logout", element: <LogoutPage /> },
  { path: "/parent/r/:token", element: <ParentReportPage /> },
  { path: "/verify/:code", element: <VerifyPage /> },
  { path: "/nfc/t/:token", element: <NfcTokenPage /> },
  { path: "/t/:publicCode", element: <NfcTapPage /> },
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
      { path: "readers", element: <OwnerReaderManagementPage /> },
      { path: "readers/:readerId", element: <OwnerReaderDetailPage /> },
      { path: "users", element: <OwnerUsersPage /> },
    ],
  },

  // Authenticated app routes — AppShell handles auth guard internally
  {
    path: "/",
    element: <AppShell />,
    errorElement: <RouteErrorPage />,
    children: [
      { index: true, element: <RoleAwareRedirect /> },
      { path: "dashboard", element: <PermissionGuard permission="app.admin"><DashboardPage /></PermissionGuard> },
      { path: "students", element: <PermissionGuard permission="app.admin"><StudentsPage /></PermissionGuard> },
      // ── NFC routes — canonical paths ──────────────────────────────────────────
      { path: "nfc/wristbands", element: <PermissionGuard permission="nfc.tags.manage"><NfcOperationsPage /></PermissionGuard> },
      { path: "nfc/wristbands/register", element: <PermissionGuard permission="nfc.tags.manage"><StudentCredentialsPage /></PermissionGuard> },
      { path: "nfc/wristbands/bulk-issue", element: <PermissionGuard permission="nfc.tags.manage"><NfcBulkIssuingPage /></PermissionGuard> },
      { path: "nfc/wristbands/bulk-allocate", element: <PermissionGuard permission="nfc.tags.manage"><NfcBulkAllocationPage /></PermissionGuard> },
      { path: "nfc/attendance", element: <PermissionGuard permission="nfc.devices.manage"><NfcAttendancePage /></PermissionGuard> },
      { path: "nfc/wallets", element: <PermissionGuard permission="nfc.wallets.pin.manage"><NfcWalletsPage /></PermissionGuard> },
      { path: "nfc/wallets/top-up", element: <PermissionGuard permission="nfc.wallets.topup"><NfcWalletTopUpPage /></PermissionGuard> },
      { path: "nfc/wallets/transactions", element: <PermissionGuard permission="nfc.canteen.transactions.view"><NfcCanteenTransactionsPage /></PermissionGuard> },
      { path: "nfc/wallets/reconcile", element: <PermissionGuard permission="nfc.canteen.reconciliation.view"><NfcCanteenReconciliationPage /></PermissionGuard> },
      { path: "students/:studentId/wallet", element: <PermissionGuard permission="nfc.canteen.transactions.view"><StudentWalletPage /></PermissionGuard> },
      { path: "students/:studentId/wallet/top-up", element: <PermissionGuard permission="nfc.wallets.topup"><StudentWalletTopUpPage /></PermissionGuard> },
      { path: "nfc/canteen", element: <PermissionGuard permission="nfc.canteen.charge"><NfcCanteenChargePage /></PermissionGuard> },
      { path: "nfc/settings", element: <PermissionGuard permission="app.admin"><NfcSettingsPage /></PermissionGuard> },
      { path: "nfc/fee-holds", element: <PermissionGuard permission="nfc.fee-holds.manage"><NfcFeeHoldsPage /></PermissionGuard> },
      { path: "nfc/gate", element: <PermissionGuard permission="nfc.gate.view"><NfcGateSecurityPage /></PermissionGuard> },
      { path: "nfc/gate-admin", element: <PermissionGuard permission="app.admin"><NfcGateOperationsPage /></PermissionGuard> },
      { path: "nfc/staff-users", element: <PermissionGuard permission="staff.manage"><StaffUsersPage /></PermissionGuard> },
      { path: "nfc/offline", element: <PermissionGuard permission="nfc.devices.manage"><NfcOfflinePage /></PermissionGuard> },
      // ── NFC routes — legacy redirects ─────────────────────────────────────────
      { path: "student-credentials", element: <Navigate to="/nfc/wristbands/register" replace /> },
      { path: "nfc-tags", element: <Navigate to="/nfc/wristbands" replace /> },
      { path: "nfc/bulk-issuing", element: <Navigate to="/nfc/wristbands/bulk-issue" replace /> },
      { path: "nfc/bulk-allocation", element: <Navigate to="/nfc/wristbands/bulk-allocate" replace /> },
      { path: "nfc-attendance", element: <Navigate to="/nfc/attendance" replace /> },
      { path: "nfc-wallets", element: <Navigate to="/nfc/wallets" replace /> },
      { path: "nfc/canteen/transactions", element: <Navigate to="/nfc/wallets/transactions" replace /> },
      { path: "nfc/canteen/reconciliation", element: <Navigate to="/nfc/wallets/reconcile" replace /> },
      { path: "canteen-charge", element: <Navigate to="/nfc/canteen" replace /> },
      { path: "gate-security", element: <Navigate to="/nfc/gate" replace /> },
      { path: "canteen/nfc/:token", element: <PermissionGuard permission="nfc.canteen.charge"><NfcCanteenChargePage /></PermissionGuard> },
      { path: "gate/nfc/:token", element: <PermissionGuard permission="nfc.gate.scan"><NfcGateSecurityPage /></PermissionGuard> },
      { path: "reports", element: <PermissionGuard permission="app.admin"><ReportsPage /></PermissionGuard> },
      { path: "reports/release", element: <PermissionGuard permission="app.admin"><ReleaseCenterPage /></PermissionGuard> },
      { path: "communications", element: <PermissionGuard permission="communications.view"><CommunicationsPage /></PermissionGuard> },
      { path: "promotions", element: <PermissionGuard permission="app.admin"><PromotionWorkspacePage /></PermissionGuard> },
      { path: "imports/marks", element: <PermissionGuard permission="app.admin"><MarksImportPage /></PermissionGuard> },
      { path: "marksheets", element: <PermissionGuard permission="app.admin"><MarksheetsPage /></PermissionGuard> },
      { path: "settings", element: <PermissionGuard permission="app.admin"><SettingsPage /></PermissionGuard> },
      { path: "settings/report-personalisation", element: <PermissionGuard permission="app.admin"><SettingsPage /></PermissionGuard> },
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
    ],
  },
], {
  basename: routerBasename,
});

