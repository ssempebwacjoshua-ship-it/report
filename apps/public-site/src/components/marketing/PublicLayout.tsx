import { useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { FloatingWhatsAppButton } from "./FloatingWhatsAppButton";
import { MarketingFooter } from "./MarketingFooter";
import { MarketingHeader } from "./MarketingHeader";

function HashScroller() {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    if (hash) {
      const id = hash.slice(1);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const element = document.getElementById(id);
          if (element) element.scrollIntoView({ behavior: "smooth" });
        });
      });
    } else {
      window.scrollTo(0, 0);
    }
  }, [pathname, hash]);

  return null;
}

export function PublicLayout() {
  return (
    <>
      <HashScroller />
      <MarketingHeader />
      <div style={{ paddingTop: "40px" }}>
        <Outlet />
      </div>
      <MarketingFooter />
      <FloatingWhatsAppButton />
    </>
  );
}
