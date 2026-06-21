import { useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { MarketingHeader } from "./MarketingHeader";
import { MarketingFooter } from "./MarketingFooter";
import { FloatingWhatsAppButton } from "./FloatingWhatsAppButton";

function HashScroller() {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    if (hash) {
      const id = hash.slice(1);
      // Double rAF: first frame commits the new page's DOM, second lets paint finish
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const el = document.getElementById(id);
          if (el) el.scrollIntoView({ behavior: "smooth" });
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
      <Outlet />
      <MarketingFooter />
      <FloatingWhatsAppButton />
    </>
  );
}
