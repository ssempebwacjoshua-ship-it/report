import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { buildWhatsAppUrl } from "../../config/contact";

function SSAMENJLogo() {
  return (
    <a href="/" className="flex items-center gap-2.5 flex-shrink-0" style={{ textDecoration: "none" }}>
      <img src="/ssamenj-logo.png" alt="SSAMENJ Technologies" className="w-9 h-9 object-contain" />
      <div>
        <div className="text-[15px] font-extrabold leading-none tracking-tight" style={{ color: "#0B2F6B" }}>
          SSAMENJ
        </div>
        <div className="text-[10px] font-semibold leading-none mt-[3px] tracking-widest uppercase" style={{ color: "#0F5BD8" }}>
          Technologies
        </div>
      </div>
    </a>
  );
}

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

const NAV = [
  { label: "Home",     href: "/" },
  { label: "Products", href: "/products" },
  { label: "Demos",    href: "/demos" },
  { label: "About",    href: "/about" },
  { label: "Contact",  href: "/contact" },
];

export function MarketingHeader() {
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const [hidden, setHidden] = useState(false);
  const lastScrollY = useRef(0);

  const bookDemoUrl = buildWhatsAppUrl(
    "Hello SSAMENJ Technologies! I'd like to book a product demo for my organisation.",
  );

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

  // Close mobile menu on route change
  useEffect(() => { setOpen(false); }, [pathname]);

  return (
    <header
      className="fixed top-0 inset-x-0 z-50"
      style={{
        background: "rgba(255,255,255,0.97)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        transform: hidden && !open ? "translateY(-100%)" : "translateY(0)",
        transition: "transform 250ms ease",
      }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <SSAMENJLogo />

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-0.5" aria-label="Main navigation">
            {NAV.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="px-3.5 py-2 text-sm font-medium rounded-lg transition-colors"
                style={{
                  color:      isActive(link.href) ? "#0F5BD8" : "#374151",
                  background: isActive(link.href) ? "#EAF3FF"  : "transparent",
                }}
              >
                {link.label}
              </a>
            ))}
          </nav>

          {/* Desktop CTAs */}
          <div className="hidden md:flex items-center gap-2">
            <a
              href="/demos"
              className="px-3.5 py-2 text-sm font-semibold rounded-lg transition-colors hover:bg-[#EAF3FF]"
              style={{ color: "#0F5BD8" }}
            >
              View Demos
            </a>
            <a
              href={bookDemoUrl}
              target="_blank"
              rel="noreferrer"
              className="px-4 py-2 text-sm font-semibold text-white rounded-lg shadow-sm transition-all hover:opacity-90 active:scale-95"
              style={{ background: "#0F5BD8" }}
            >
              Book Demo
            </a>
          </div>

          {/* Mobile burger */}
          <button
            className="md:hidden p-2 rounded-lg transition-colors"
            style={{ color: "#0B2F6B" }}
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? "Close menu" : "Open menu"}
          >
            {open ? <XIcon /> : <MenuIcon />}
          </button>
        </div>
      </div>

      {/* Mobile drawer */}
      {open && (
        <div className="md:hidden border-t py-2 px-4" style={{ background: "white", borderColor: "#D8E2F0" }}>
          {NAV.map((link) => (
            <a
              key={link.label}
              href={link.href}
              className="block px-3 py-2.5 text-sm font-medium rounded-lg mb-0.5 transition-colors"
              style={{
                color:      isActive(link.href) ? "#0F5BD8" : "#374151",
                background: isActive(link.href) ? "#EAF3FF"  : "transparent",
              }}
              onClick={() => setOpen(false)}
            >
              {link.label}
            </a>
          ))}
          <div className="pt-3 pb-2 mt-2 border-t" style={{ borderColor: "#EAF3FF" }}>
            <a
              href={bookDemoUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-center w-full px-4 py-2.5 text-sm font-semibold text-white rounded-lg"
              style={{ background: "#0F5BD8" }}
            >
              Book a Demo
            </a>
          </div>
        </div>
      )}

      {/* Gradient accent line */}
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
