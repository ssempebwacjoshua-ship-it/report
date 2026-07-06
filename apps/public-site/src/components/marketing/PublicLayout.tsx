import { useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { FloatingWhatsAppButton } from "./FloatingWhatsAppButton";
import { MarketingFooter } from "./MarketingFooter";
import { MarketingHeader } from "./MarketingHeader";
import { Seo } from "./Seo";
import { getSeoForPathname } from "../../config/seo";

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
  const { pathname } = useLocation();
  const seo = getSeoForPathname(pathname);

  return (
    <>
      <Seo {...seo} />
      <HashScroller />
      <MarketingHeader />
      <div style={{ paddingTop: "42px" }}>
        <Outlet />
      </div>
      <MarketingFooter />
      <FloatingWhatsAppButton />
    </>
  );
}
