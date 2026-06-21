import { buildWhatsAppUrl } from "../../config/contact";

const BOOK_DEMO_URL = buildWhatsAppUrl(
  "Hello SSAMENJ Technologies! I'd like to book a product demo for my organisation.",
);

const PRODUCT_LINKS = [
  "School Connect Report Lab",
  "Smart Pages",
  "Legal Smart Pages",
  "School Connect Operations",
  "Kids Wallet",
  "NFC Wristbands",
];

const COMPANY_LINKS = [
  { label: "Home", href: "/" },
  { label: "Products", href: "/products" },
  { label: "Demos", href: "/demos" },
  { label: "About", href: "/about" },
  { label: "Contact", href: "/contact" },
];

function SSAMENJLogoLight() {
  return (
    <div className="flex items-center gap-2.5">
      <div
        className="w-9 h-9 rounded-xl flex items-center justify-center"
        style={{ background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.15)" }}
      >
        <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5" aria-hidden="true">
          <path d="M12 3 4.5 7.5v9L12 21l7.5-4.5v-9L12 3Z" fill="white" fillOpacity="0.15" />
          <path d="M12 3 4.5 7.5l7.5 4.5 7.5-4.5L12 3Z" fill="white" fillOpacity="0.55" />
          <path d="M12 12v9" stroke="white" strokeWidth="1.5" strokeOpacity="0.85" strokeLinecap="round" />
          <path d="M4.5 7.5v9L12 21" stroke="white" strokeWidth="1.5" strokeOpacity="0.6" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M19.5 7.5v9L12 21" stroke="white" strokeWidth="1.5" strokeOpacity="0.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <div>
        <div className="text-[15px] font-extrabold leading-none text-white tracking-tight">SSAMENJ</div>
        <div className="text-[10px] font-semibold leading-none mt-[3px] tracking-widest uppercase" style={{ color: "#93C5FD" }}>
          Technologies
        </div>
      </div>
    </div>
  );
}

export function MarketingFooter() {
  const year = new Date().getFullYear();

  return (
    <footer style={{ background: "#0B2F6B" }} className="text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-14 pb-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10 mb-12">
          {/* Brand column */}
          <div className="sm:col-span-2 lg:col-span-1">
            <SSAMENJLogoLight />
            <p className="mt-4 text-sm leading-relaxed" style={{ color: "#93C5FD" }}>
              Smart Systems. Simple Work.
            </p>
            <p className="mt-2 text-xs leading-relaxed" style={{ color: "#60A5FA" }}>
              Practical digital systems for schools, offices, legal teams, and growing businesses across Africa and beyond.
            </p>
            <a
              href={BOOK_DEMO_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 mt-5 px-4 py-2 text-sm font-semibold rounded-lg transition-all hover:opacity-90"
              style={{ background: "#0F5BD8", color: "white" }}
            >
              Book a Demo
            </a>
          </div>

          {/* Products */}
          <div>
            <h3 className="text-[11px] font-bold uppercase tracking-widest mb-4" style={{ color: "#93C5FD" }}>
              Products
            </h3>
            <ul className="space-y-2.5">
              {PRODUCT_LINKS.map((p) => (
                <li key={p}>
                  <a
                    href="/products"
                    className="text-sm transition-colors hover:text-white"
                    style={{ color: "#BFDBFE" }}
                  >
                    {p}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Company */}
          <div>
            <h3 className="text-[11px] font-bold uppercase tracking-widest mb-4" style={{ color: "#93C5FD" }}>
              Company
            </h3>
            <ul className="space-y-2.5">
              {COMPANY_LINKS.map((link) => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    className="text-sm transition-colors hover:text-white"
                    style={{ color: "#BFDBFE" }}
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h3 className="text-[11px] font-bold uppercase tracking-widest mb-4" style={{ color: "#93C5FD" }}>
              Get in Touch
            </h3>
            <ul className="space-y-2.5 text-sm" style={{ color: "#BFDBFE" }}>
              <li>
                <a href="https://wa.me/256790685650" target="_blank" rel="noreferrer" className="hover:text-white transition-colors flex items-center gap-2">
                  <svg viewBox="0 0 24 24" className="w-4 h-4 flex-shrink-0" fill="currentColor" aria-hidden="true">
                    <path d="M12.04 2C6.58 2 2.13 6.38 2.13 11.76c0 1.72.46 3.4 1.33 4.87L2 22l5.52-1.42a10.1 10.1 0 0 0 4.52 1.08h.01c5.46 0 9.91-4.38 9.91-9.76C21.96 6.38 17.51 2 12.04 2Z" />
                  </svg>
                  +256 790 685 650
                </a>
              </li>
              <li>
                <a href="/contact" className="hover:text-white transition-colors">
                  Contact form
                </a>
              </li>
              <li>
                <a href="/demos" className="hover:text-white transition-colors">
                  Explore demos
                </a>
              </li>
            </ul>
            <div className="mt-5 p-3 rounded-xl" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}>
              <p className="text-xs font-semibold text-white mb-1">For schools &amp; institutions</p>
              <p className="text-[11px]" style={{ color: "#93C5FD" }}>
                We configure the right solution for your team.
              </p>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="pt-6 border-t flex flex-col sm:flex-row items-center justify-between gap-3" style={{ borderColor: "rgba(255,255,255,0.1)" }}>
          <p className="text-xs" style={{ color: "#60A5FA" }}>
            © {year} SSAMENJ Technologies. All rights reserved.
          </p>
          <p className="text-xs font-medium" style={{ color: "#93C5FD" }}>
            Smart Systems. Simple Work.
          </p>
        </div>
      </div>
    </footer>
  );
}
