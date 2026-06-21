import { Outlet } from "react-router-dom";
import { MarketingHeader } from "./MarketingHeader";
import { MarketingFooter } from "./MarketingFooter";
import { FloatingWhatsAppButton } from "./FloatingWhatsAppButton";

export function PublicLayout() {
  return (
    <>
      <MarketingHeader />
      <Outlet />
      <MarketingFooter />
      <FloatingWhatsAppButton />
    </>
  );
}
