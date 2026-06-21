import { useState } from "react";
import { buildWhatsAppUrl } from "../../config/contact";

function SSAMENJLogo() {
  return (
    <a href="/" className="flex items-center gap-2.5 flex-shrink-0" style={{ textDecoration: "none" }}>
      <div
        className="w-9 h-9 rounded-xl flex items-center justify-center shadow-sm"
        style={{ background: "linear-gradient(135deg, #0F5BD8 0%, #0B2F6B 100%)" }}
      >
        <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5" aria-hidden="true">
          <path d="M12 3 4.5 7.5v9L12 21l7.5-4.5v-9L12 3Z" fill="white" fillOpacity="0.2" />
          <path d="M12 3 4.5 7.5l7.5 4.5 7.5-4.5L12 3Z" fill="white" fillOpacity="0.6" />
          <path d="M12 12v9" stroke="white" strokeWidth="1.5" strokeOpacity="0.85" strokeLinecap="round" />
          <path d="M4.5 7.5v9L12 21" stroke="white" strokeWidth="1.5" strokeOpacity="0.6" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M19.5 7.5v9L12 21" stroke="white" strokeWidth="1.5" strokeOpacity="0.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
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
  { label: "Home", href: "/" },
  { label: "Products", href: "/products" },
  { label: "Demos", href: "/demos" },
  { label: "About", href: "/about" },
  { label: "Contact", href: "/contact" },
];

export function MarketingHeader({ activePath = "" }: { activePath?: string }) {
  const [open, setOpen] = useState(false);
  const bookDemoUrl = buildWhatsAppUrl(
    "Hello SSAMENJ Technologies! I'd like to book a product demo for my organisation.",
  );

  function isActive(href: string) {
    return activePath === href || activePath.startsWith(href + "/");
  }

  return (
    <header
      className="fixed top-0 inset-x-0 z-50 border-b"
      style={{ background: "rgba(255,255,255,0.97)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)", borderColor: "#D8E2F0" }}
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
                  color: isActive(link.href) ? "#0F5BD8" : "#374151",
                  background: isActive(link.href) ? "#EAF3FF" : "transparent",
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
                color: isActive(link.href) ? "#0F5BD8" : "#374151",
                background: isActive(link.href) ? "#EAF3FF" : "transparent",
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
    </header>
  );
}
