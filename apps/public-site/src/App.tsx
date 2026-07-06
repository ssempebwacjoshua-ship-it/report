import { Navigate, Route, Routes } from "react-router-dom";
import { PublicLayout } from "./components/marketing/PublicLayout";
import { AboutPage } from "./pages/AboutPage";
import { ContactPage } from "./pages/ContactPage";
import { DemoPage } from "./pages/DemoPage";
import { DemosPage } from "./pages/DemosPage";
import { FeaturesDemoPage } from "./pages/FeaturesDemoPage";
import { NfcPage } from "./pages/NfcPage";
import { PricingPage } from "./pages/PricingPage";
import { ProductsPage } from "./pages/ProductsPage";
import { SSAMENJHomePage } from "./pages/SSAMENJHomePage";

export default function App() {
  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route index element={<SSAMENJHomePage />} />
        <Route path="/products" element={<ProductsPage />} />
        <Route path="/report-lab" element={<Navigate to="/products#report-lab" replace />} />
        <Route path="/smart-pages" element={<Navigate to="/products#smart-pages" replace />} />
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
  );
}
