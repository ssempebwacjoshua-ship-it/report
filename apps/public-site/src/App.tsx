import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { PublicLayout } from "./components/marketing/PublicLayout";
import { AboutPage } from "./pages/AboutPage";
import { ContactPage } from "./pages/ContactPage";
import { DemoPage } from "./pages/DemoPage";
import { DemosPage } from "./pages/DemosPage";
import { FeaturesDemoPage } from "./pages/FeaturesDemoPage";
import { NfcPage } from "./pages/NfcPage";
import { PricingPage } from "./pages/PricingPage";
import { ProductsPage } from "./pages/ProductsPage";
import { ReportLabPage } from "./pages/ReportLabPage";
import { RentFlowPage } from "./pages/RentFlowPage";
import { CashlessCanteenPage } from "./pages/CashlessCanteenPage";
import { SSAMENJHomePage } from "./pages/SSAMENJHomePage";
import { StayOsPage } from "./pages/StayOsPage";
import { SmartPagesPage } from "./pages/SmartPagesPage";
import { hasSystemSessionMarker, resolvePublicSiteSystemRedirect } from "./systemRedirect";

function SystemOwnershipRedirect() {
  const location = useLocation();
  const redirectTo = resolvePublicSiteSystemRedirect(location.pathname, hasSystemSessionMarker());
  return redirectTo ? <Navigate to={redirectTo} replace /> : null;
}

export default function App() {
  return (
    <>
      <SystemOwnershipRedirect />
      <Routes>
        <Route element={<PublicLayout />}>
          <Route index element={<SSAMENJHomePage />} />
          <Route path="/products" element={<ProductsPage />} />
          <Route path="/rentflow" element={<RentFlowPage />} />
          <Route path="/rentals" element={<RentFlowPage />} />
          <Route path="/cashless-canteen" element={<CashlessCanteenPage />} />
          <Route path="/stayos" element={<StayOsPage />} />
          <Route path="/report-lab" element={<ReportLabPage />} />
          <Route path="/smart-pages" element={<SmartPagesPage />} />
          <Route path="/nfc" element={<NfcPage />} />
          <Route path="/demos" element={<DemosPage />} />
          <Route path="/pricing" element={<PricingPage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/contact" element={<ContactPage />} />
          <Route path="/demo" element={<DemoPage />} />
          <Route path="/dem" element={<Navigate to="/demos" replace />} />
          <Route path="/features-demo" element={<FeaturesDemoPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </>
  );
}
