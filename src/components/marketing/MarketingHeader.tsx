import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { buildWhatsAppUrl } from "../../config/contact";

const BOOK_DEMO_URL = buildWhatsAppUrl(
  "Hello SSAMENJ Technologies! I'd like to book a product demo for my organisation.",
);

// ── Nav data ──────────────────────────────────────────────────────────────────

type NavItem = { label: string; href: string; shortLabel?: string };

const PRODUCT_NAV: NavItem[] = [
  { label: "Report Lab",        href: "/products/report-lab" },
  { label: "Smart Pages",       href: "/products/smart-pages" },
  { label: "School Connect",    href: "/products/school-connect" },
  { label: "Legal Smart Pages", href: "/products/legal-smart-pages", shortLabel: "Legal Smart" },
  { label: "Kids Wallet",       href: "/products/kids-wallet" },
  { label: "NFC Wristbands",    href: "/products/nfc-wristbands",    shortLabel: "NFC Bands" },
];

const MAIN_NAV: NavItem[] = [
  { label: "Home",    href: "/" },
  { label: "Demos",   href: "/demos" },
  { label: "About",   href: "/about" },
  { label: "Contact", href: "/contact" },
];

// ── Icons ─────────────────────────────────────────────────────────────────────

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

// ── Logo ──────────────────────────────────────────────────────────────────────

function SSAMENJLogo() {
  return (
    <a href="/" className="flex items-center gap-2.5 flex-shrink-0" style={{ textDecoration: "none" }}>
      <img src="/ssamenj-logo.png" alt="SSAMENJ Technologies" className="w-8 h-8 object-contain" />
      <div>
        <div className="text-[14px] font-extrabold leading-none tracking-tight" style={{ color: "#0B2F6B" }}>
          SSAMENJ
        </div>
        <div className="text-[9px] font-semibold leading-none mt-[3px] tracking-widest uppercase" style={{ color: "#0F5BD8" }}>
          Technologies
        </div>
      </div>
    </a>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function MarketingHeader() {
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const [hidden, setHidden] = useState(false);
  const lastScrollY = useRef(0);

  function isActive(href: string) {
    if (href === "/") return pathname === "/";
    return pathname === href || pathname.startsWith(href + "/");
  }

  // Scroll-hide / reveal
  useEffect(() => {
    function onScroll() {
      const current = window.scrollY;
      if (current < 20) {
        setHidden(false);
      } else if (current > lastScrollY.current && current > 80) {
        setHidden(true);
      } else if (current < lastScrollY.current) {
        setHidden(false);
      }
      lastScrollY.current = current;
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close drawer on route change
  useEffect(() => { setOpen(false); }, [pathname]);

  const navLinkStyle = (href: string) => ({
    color: isActive(href) ? "#0F5BD8" : "#0B0F19",
    background: isActive(href) ? "#EAF3FF" : "transparent",
    fontWeight: 700,
  });

  return (
    <header
      className="fixed top-0 inset-x-0 z-50"
      style={{
        background: "rgba(255,255,255,0.98)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        transform: hidden && !open ? "translateY(-100%)" : "translateY(0)",
        transition: "transform 250ms ease",
      }}
    >
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14 gap-2">

          {/* Logo */}
          <SSAMENJLogo />

          {/* Desktop nav — visible only on xl+ */}
          <nav
            className="hidden xl:flex items-center flex-1 min-w-0 mx-3"
            aria-label="Main navigation"
          >
            {/* Home */}
            <a
              href="/"
              className="px-2.5 py-1.5 text-[12px] rounded-lg whitespace-nowrap transition-colors hover:bg-[#F5F8FF]"
              style={navLinkStyle("/")}
            >
              Home
            </a>

            {/* Thin separator */}
            <div className="mx-2 w-px h-4 flex-shrink-0" style={{ background: "#D8E2F0" }} />

            {/* Product links */}
            {PRODUCT_NAV.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="px-2 py-1.5 text-[11.5px] rounded-lg whitespace-nowrap transition-colors hover:bg-[#F5F8FF] hover:text-[#0F5BD8]"
                style={navLinkStyle(item.href)}
              >
                {item.shortLabel ?? item.label}
              </a>
            ))}

            {/* Thin separator */}
            <div className="mx-2 w-px h-4 flex-shrink-0" style={{ background: "#D8E2F0" }} />

            {/* Company links */}
            {["Demos", "About", "Contact"].map((label) => {
              const href = `/${label.toLowerCase()}`;
              return (
                <a
                  key={href}
                  href={href}
                  className="px-2.5 py-1.5 text-[12px] rounded-lg whitespace-nowrap transition-colors hover:bg-[#F5F8FF] hover:text-[#0F5BD8]"
                  style={navLinkStyle(href)}
                >
                  {label}
                </a>
              );
            })}
          </nav>

          {/* Desktop CTA buttons — visible only on xl+ */}
          <div className="hidden xl:flex items-center gap-2 flex-shrink-0">
            <a
              href="/demos"
              className="px-3.5 py-1.5 text-[12px] font-bold rounded-lg transition-colors hover:bg-[#EAF3FF]"
              style={{ color: "#0F5BD8" }}
            >
              View Demos
            </a>
            <a
              href={BOOK_DEMO_URL}
              target="_blank"
              rel="noreferrer"
              className="px-3.5 py-1.5 text-[12px] font-bold text-white rounded-lg shadow-sm transition-all hover:opacity-90 active:scale-95"
              style={{ background: "#0F5BD8" }}
            >
              Book Demo
            </a>
          </div>

          {/* Hamburger — visible below xl */}
          <button
            className="xl:hidden p-2 rounded-lg"
            style={{ color: "#0B0F19" }}
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? "Close menu" : "Open menu"}
          >
            {open ? <XIcon /> : <MenuIcon />}
          </button>
        </div>
      </div>

      {/* Mobile / tablet drawer */}
      {open && (
        <div
          className="xl:hidden border-t"
          style={{ background: "white", borderColor: "#D8E2F0" }}
        >
          <div className="max-w-[1440px] mx-auto px-4 sm:px-6 py-3 space-y-0.5">

            {/* Home */}
            <a
              href="/"
              className="block px-3 py-2.5 text-sm rounded-lg"
              style={navLinkStyle("/")}
              onClick={() => setOpen(false)}
            >
              Home
            </a>

            {/* Products group */}
            <div className="pt-2 pb-1">
              <p className="px-3 text-[10px] font-black uppercase tracking-widest mb-1" style={{ color: "#94A3B8" }}>
                Products
              </p>
              {PRODUCT_NAV.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  className="block px-3 py-2.5 text-sm rounded-lg"
                  style={navLinkStyle(item.href)}
                  onClick={() => setOpen(false)}
                >
                  {item.label}
                </a>
              ))}
            </div>

            {/* Company */}
            <div className="pt-1 pb-1 border-t" style={{ borderColor: "#EAF3FF" }}>
              {["Demos", "About", "Contact"].map((label) => {
                const href = `/${label.toLowerCase()}`;
                return (
                  <a
                    key={href}
                    href={href}
                    className="block px-3 py-2.5 text-sm rounded-lg"
                    style={navLinkStyle(href)}
                    onClick={() => setOpen(false)}
                  >
                    {label}
                  </a>
                );
              })}
            </div>

            {/* CTA */}
            <div className="pt-3 pb-2 border-t" style={{ borderColor: "#EAF3FF" }}>
              <a
                href={BOOK_DEMO_URL}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-center w-full px-4 py-2.5 text-sm font-bold text-white rounded-xl"
                style={{ background: "#0F5BD8" }}
                onClick={() => setOpen(false)}
              >
                Book a Demo
              </a>
              <a
                href="/demos"
                className="flex items-center justify-center w-full mt-2 px-4 py-2.5 text-sm font-bold rounded-xl border"
                style={{ color: "#0F5BD8", borderColor: "#D8E2F0" }}
                onClick={() => setOpen(false)}
              >
                View Demos
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Faint blue gradient line */}
      <div
        aria-hidden="true"
        style={{
          height: "1px",
          background: "linear-gradient(to right, rgba(15,91,216,0.35), rgba(15,91,216,0.08), transparent)",
        }}
      />
    </header>
  );
}
