import { lazy, Suspense, type ComponentType } from "react";
import type { RouteObject } from "react-router-dom";
import { ContactPage } from "../../pages/ContactPage";
import { DemoPage } from "../../pages/DemoPage";
import { FeaturesDemoPage } from "../../pages/FeaturesDemoPage";
import { ForgotPasswordPage } from "../../pages/ForgotPasswordPage";
import { LoginPage } from "../../pages/LoginPage";
import { LogoutPage } from "../../pages/LogoutPage";
import { NfcTapPage } from "../../pages/NfcTapPage";
import { NfcTokenPage } from "../../pages/NfcTokenPage";
import { ParentReportPage } from "../../pages/ParentReportPage";
import { PricingPage } from "../../pages/PricingPage";
import { PwaLaunchPage } from "../../pages/PwaLaunchPage";
import { RouteErrorPage } from "../../pages/RouteErrorPage";
import { PublishedDocumentPage } from "../../pages/smart-pages/PublishedDocumentPage";
import { TokenPasswordPage } from "../../pages/TokenPasswordPage";
import { VerifyPage } from "../../pages/VerifyPage";
import { SectionLoader } from "../../components/SectionLoader";
import { PublicOnlyRoute } from "./routeHelpers";

const lawyerSmartPagesEnabled = import.meta.env.VITE_ENABLE_SMART_PAGES_LAWYERS === "true";
const LawyerShell = lazy(() => import("../../components/lawyers/LawyerShell").then((module) => ({ default: module.LawyerShell })));
const LawyerDashboardPage = lazy(() => import("../../pages/lawyers/LawyerDashboardPage").then((module) => ({ default: module.LawyerDashboardPage })));
const LawyerDocumentsPage = lazy(() => import("../../pages/lawyers/LawyerDocumentsPage").then((module) => ({ default: module.LawyerDocumentsPage })));
const LawyerDocumentEditorPage = lazy(() => import("../../pages/lawyers/LawyerDocumentEditorPage").then((module) => ({ default: module.LawyerDocumentEditorPage })));
const LawyerOnboardingPage = lazy(() => import("../../pages/lawyers/LawyerOnboardingPage").then((module) => ({ default: module.LawyerOnboardingPage })));

function lazyElement(Component: ComponentType) {
  return (
    <Suspense fallback={<SectionLoader message="Loading page..." />}>
      <Component />
    </Suspense>
  );
}

export const publicRoutes: RouteObject[] = [
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
  { path: "/r/:code", element: <ParentReportPage /> },
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
];
