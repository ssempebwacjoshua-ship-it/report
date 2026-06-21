import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { buildWhatsAppUrl } from "../../config/contact";

const BOOK_DEMO_URL = buildWhatsAppUrl(
  "Hello SSAMENJ Technologies! I'd like to book a product demo for my organisation.",
);

type NavItem = { label: string; href: string; shortLabel?: string };

const PRODUCT_NAV: NavItem[] = [
  { label: "Report Lab",        href: "/products#report-lab" },
  { label: "Smart Pages",       href: "/products#smart-pages" },
  { label: "School Connect",    href: "/products#school-connect" },
  { label: "Legal Smart Pages", href: "/products#legal-smart-pages", shortLabel: "Legal Smart" },
  { label: "Kids Wallet",       href: "/products#kids-wallet" },
  { label: "NFC Wristbands",    href: "/products#nfc-bands",         shortLabel: "NFC Bands" },
];

function MenuIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="w-5 h-5" aria-hidden="true">
      <path d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="w-5 h-5" aria-hidden="true">
      <path d="m5 5 14 14M19 5 5 19" />
    </svg>
  );
}

export function MarketingHeader() {
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const [hidden, setHidden] = useState(false);
  const lastScrollY = useRef(0);

  function isActive(href: string) {
    const path = href.split("#")[0] || "/";
    if (path === "/") return pathname === "/";
    return pathname === path || pathname.startsWith(path + "/");
  }

  useEffect(() => {
    function onScroll() {
      const current = window.scrollY;
      if (current < 20) setHidden(false);
      else if (current > lastScrollY.current && current > 80) setHidden(true);
      else if (current < lastScrollY.current) setHidden(false);
      lastScrollY.current = current;
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => { setOpen(false); }, [pathname]);

  const linkStyle = (href: string): React.CSSProperties => ({
    color:      isActive(href) ? "#0F5BD8" : "#0B0F19",
    background: isActive(href) ? "#EAF3FF"  : "transparent",
    fontWeight: 700,
  });

  return (
    <header
      className="fixed top-0 inset-x-0 z-50"
      style={{
        background: "rgba(255,255,255,0.98)",
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
        transform: hidden && !open ? "translateY(-100%)" : "translateY(0)",
        transition: "transform 250ms ease",
      }}
    >
      {/* Nav bar — 46px tall */}
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-2" style={{ height: "46px" }}>

          {/* Logo */}
          <a href="/" className="flex items-center gap-1.5 flex-shrink-0" style={{ textDecoration: "none" }}>
            <img src="/ssamenj-logo.png" alt="SSAMENJ Technologies" style={{ width: "26px", height: "26px", objectFit: "contain" }} />
            <div>
              <div style={{ fontSize: "12px", fontWeight: 800, lineHeight: 1, letterSpacing: "-0.01em", color: "#0B2F6B" }}>
                SSAMENJ
              </div>
              <div style={{ fontSize: "7.5px", fontWeight: 600, lineHeight: 1, marginTop: "2px", letterSpacing: "0.14em", textTransform: "uppercase", color: "#0F5BD8" }}>
                Technologies
              </div>
            </div>
          </a>

          {/* Desktop nav — xl+ only */}
          <nav className="hidden xl:flex items-center flex-1 min-w-0 mx-3 gap-0" aria-label="Main navigation">
            <a
              href="/"
              className="px-2.5 py-1 rounded-lg whitespace-nowrap transition-colors hover:bg-[#F5F8FF]"
              style={{ ...linkStyle("/"), fontSize: "13px" }}
            >
              Home
            </a>
            <div className="mx-2 w-px h-3 flex-shrink-0" style={{ background: "#D8E2F0" }} />
            {PRODUCT_NAV.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="px-2 py-1 rounded-lg whitespace-nowrap transition-colors hover:bg-[#F5F8FF] hover:text-[#0F5BD8]"
                style={{ ...linkStyle(item.href), fontSize: "12px" }}
              >
                {item.shortLabel ?? item.label}
              </a>
            ))}
            <div className="mx-2 w-px h-3 flex-shrink-0" style={{ background: "#D8E2F0" }} />
            {(["Demos", "About", "Contact"] as const).map((label) => {
              const href = `/${label.toLowerCase()}`;
              return (
                <a
                  key={href}
                  href={href}
                  className="px-2.5 py-1 rounded-lg whitespace-nowrap transition-colors hover:bg-[#F5F8FF] hover:text-[#0F5BD8]"
                  style={{ ...linkStyle(href), fontSize: "13px" }}
                >
                  {label}
                </a>
              );
            })}
          </nav>

          {/* Desktop CTAs — xl+ only */}
          <div className="hidden xl:flex items-center gap-2 flex-shrink-0">
            <a
              href="/demos"
              className="px-3 py-1.5 rounded-lg text-[12px] font-bold transition-colors hover:bg-[#EAF3FF] whitespace-nowrap"
              style={{ color: "#0F5BD8" }}
            >
              View Demos
            </a>
            <a
              href={BOOK_DEMO_URL}
              target="_blank"
              rel="noreferrer"
              className="px-3 py-1.5 text-[12px] font-bold text-white rounded-lg shadow-sm transition-all hover:opacity-90 active:scale-95 whitespace-nowrap"
              style={{ background: "#0F5BD8" }}
            >
              Book Demo
            </a>
          </div>

          {/* Hamburger — below xl */}
          <button
            className="xl:hidden p-1.5 rounded-lg"
            style={{ color: "#0B0F19" }}
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? "Close menu" : "Open menu"}
          >
            {open ? <XIcon /> : <MenuIcon />}
          </button>
        </div>
      </div>

      {/* Mobile/tablet drawer */}
      {open && (
        <div className="xl:hidden border-t" style={{ background: "white", borderColor: "#EAF3FF" }}>
          <div className="max-w-[1440px] mx-auto px-4 sm:px-6 py-3 space-y-0.5">
            <a href="/" className="block px-3 py-2.5 text-sm rounded-lg" style={linkStyle("/")} onClick={() => setOpen(false)}>Home</a>
            <div className="pt-2 pb-1">
              <p className="px-3 text-[10px] font-black uppercase tracking-widest mb-1" style={{ color: "#94A3B8" }}>Products</p>
              {PRODUCT_NAV.map((item) => (
                <a key={item.href} href={item.href} className="block px-3 py-2.5 text-sm rounded-lg" style={linkStyle(item.href)} onClick={() => setOpen(false)}>
                  {item.label}
                </a>
              ))}
            </div>
            <div className="pt-1 border-t" style={{ borderColor: "#EAF3FF" }}>
              {(["Demos", "About", "Contact"] as const).map((label) => {
                const href = `/${label.toLowerCase()}`;
                return (
                  <a key={href} href={href} className="block px-3 py-2.5 text-sm rounded-lg" style={linkStyle(href)} onClick={() => setOpen(false)}>
                    {label}
                  </a>
                );
              })}
            </div>
            <div className="pt-3 pb-2 border-t space-y-2" style={{ borderColor: "#EAF3FF" }}>
              <a href={BOOK_DEMO_URL} target="_blank" rel="noreferrer" className="flex items-center justify-center w-full px-4 py-2.5 text-sm font-bold text-white rounded-xl" style={{ background: "#0F5BD8" }} onClick={() => setOpen(false)}>
                Book a Demo
              </a>
              <a href="/demos" className="flex items-center justify-center w-full px-4 py-2.5 text-sm font-bold rounded-xl border" style={{ color: "#0F5BD8", borderColor: "#D8E2F0" }} onClick={() => setOpen(false)}>
                View Demos
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Accent line — 2px, richer blue, fades right */}
      <div
        aria-hidden="true"
        style={{
          height: "2px",
          background: "linear-gradient(to right, #0F5BD8 0%, rgba(15,91,216,0.45) 40%, rgba(15,91,216,0.12) 70%, transparent 100%)",
        }}
      />
    </header>
  );
}
