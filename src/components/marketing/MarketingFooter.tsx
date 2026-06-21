import { buildWhatsAppUrl } from "../../config/contact";

const BOOK_DEMO_URL = buildWhatsAppUrl(
  "Hello SSAMENJ Technologies! I would like to book a demo.",
);
const REQUEST_DEMO_URL = buildWhatsAppUrl(
  "Hello SSAMENJ Technologies, I would like to request a demo.",
);

const PRODUCT_LINKS = [
  { label: "Report Lab",         href: "/products#report-lab" },
  { label: "Smart Pages",        href: "/products#smart-pages" },
  { label: "Legal Smart Pages",  href: "/products#legal-smart-pages" },
  { label: "School Connect",     href: "/products#school-connect" },
  { label: "Kids Wallet",        href: "/products#kids-wallet" },
  { label: "NFC Bands",          href: "/products#nfc-bands" },
  { label: "PearlMart",          href: "/products#pearlmart" },
  { label: "Wideh Cash",         href: "/products#wideh-cash" },
  { label: "Custom Digital",     href: "/contact" },
];

const COMPANY_LINKS = [
  { label: "Home",     href: "/" },
  { label: "Products", href: "/products" },
  { label: "Demos",    href: "/demos" },
  { label: "About",    href: "/about" },
  { label: "Contact",  href: "/contact" },
];

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 flex-shrink-0" fill="currentColor" aria-hidden="true">
      <path d="M12.04 2C6.58 2 2.13 6.38 2.13 11.76c0 1.72.46 3.4 1.33 4.87L2 22l5.52-1.42a10.1 10.1 0 0 0 4.52 1.08h.01c5.46 0 9.91-4.38 9.91-9.76C21.96 6.38 17.51 2 12.04 2Zm0 17.97h-.01a8.35 8.35 0 0 1-4.25-1.16l-.31-.18-3.27.84.87-3.12-.2-.32a7.91 7.91 0 0 1-1.22-4.27c0-4.44 3.76-8.05 8.39-8.05 2.24 0 4.35.86 5.93 2.38a7.86 7.86 0 0 1 2.46 5.71c0 4.44-3.76 8.17-8.39 8.17Zm4.6-6.1c-.25-.12-1.49-.72-1.72-.8-.23-.08-.4-.12-.57.12-.17.25-.65.8-.8.96-.15.17-.3.19-.55.06-.25-.12-1.06-.38-2.02-1.2-.75-.66-1.25-1.47-1.4-1.72-.15-.25-.02-.38.11-.5.12-.11.25-.3.38-.45.13-.15.17-.25.25-.42.08-.17.04-.31-.02-.43-.06-.12-.57-1.35-.78-1.85-.2-.49-.41-.42-.57-.43h-.49c-.17 0-.43.06-.66.31-.23.25-.87.84-.87 2.05s.89 2.38 1.02 2.55c.13.17 1.75 2.63 4.24 3.68.59.25 1.05.4 1.41.51.59.18 1.13.15 1.56.09.48-.07 1.49-.6 1.7-1.18.21-.58.21-1.08.15-1.18-.06-.1-.23-.16-.48-.28Z" />
    </svg>
  );
}

function SSAMENJLogoLight() {
  return (
    <div className="flex items-center gap-2.5">
      <div
        className="w-8 h-8 rounded-xl flex items-center justify-center p-1 flex-shrink-0"
        style={{ background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.15)" }}
      >
        <img src="/ssamenj-logo.png" alt="SSAMENJ Technologies" className="w-full h-full object-contain" />
      </div>
      <div>
        <div className="text-[14px] font-extrabold leading-none text-white tracking-tight">SSAMENJ</div>
        <div className="text-[9px] font-semibold leading-none mt-[3px] tracking-widest uppercase" style={{ color: "#93C5FD" }}>
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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-5">

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-7">

          {/* ── Col 1: Brand ── */}
          <div>
            <SSAMENJLogoLight />
            <p className="mt-3 text-xs font-semibold" style={{ color: "#93C5FD" }}>
              Smart Systems. Simple Work.
            </p>
            <p className="mt-1.5 text-xs leading-relaxed" style={{ color: "#60A5FA" }}>
              Practical digital systems for schools, offices, legal teams, and growing businesses.
            </p>
            <a
              href={BOOK_DEMO_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 mt-4 px-3 py-1.5 text-xs font-bold rounded-lg transition-all hover:opacity-90"
              style={{ background: "#0F5BD8", color: "white" }}
            >
              Book Demo
            </a>
          </div>

          {/* ── Col 2: Products (2-col sub-grid) ── */}
          <div>
            <h3 className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: "#93C5FD" }}>
              Products
            </h3>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
              {PRODUCT_LINKS.map((p) => (
                <a
                  key={p.label}
                  href={p.href}
                  className="text-xs transition-colors hover:text-white truncate"
                  style={{ color: "#BFDBFE" }}
                >
                  {p.label}
                </a>
              ))}
            </div>
          </div>

          {/* ── Col 3: Company ── */}
          <div>
            <h3 className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: "#93C5FD" }}>
              Company
            </h3>
            <ul className="space-y-1.5">
              {COMPANY_LINKS.map((link) => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    className="text-xs transition-colors hover:text-white"
                    style={{ color: "#BFDBFE" }}
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* ── Col 4: Get in Touch ── */}
          <div>
            <h3 className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: "#93C5FD" }}>
              Get in Touch
            </h3>
            <ul className="space-y-2">
              <li>
                <a
                  href="https://wa.me/971563704103"
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 text-xs transition-colors hover:text-white"
                  style={{ color: "#BFDBFE" }}
                >
                  <WhatsAppIcon />
                  <span>
                    <span className="block text-[10px] font-bold uppercase tracking-wide" style={{ color: "#93C5FD" }}>Global</span>
                    +971 56 370 4103
                  </span>
                </a>
              </li>
              <li>
                <a
                  href="https://wa.me/256774549869"
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 text-xs transition-colors hover:text-white"
                  style={{ color: "#BFDBFE" }}
                >
                  <WhatsAppIcon />
                  <span>
                    <span className="block text-[10px] font-bold uppercase tracking-wide" style={{ color: "#93C5FD" }}>Uganda PM</span>
                    +256 774 549 869
                  </span>
                </a>
              </li>
              <li>
                <a
                  href={REQUEST_DEMO_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs transition-colors hover:text-white"
                  style={{ color: "#BFDBFE" }}
                >
                  Request demo on WhatsApp →
                </a>
              </li>
              <li>
                <a href="/demos" className="text-xs transition-colors hover:text-white" style={{ color: "#BFDBFE" }}>
                  Explore demos →
                </a>
              </li>
            </ul>

            {/* CTA card */}
            <div
              className="mt-4 p-3 rounded-xl"
              style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
            >
              <p className="text-[11px] font-bold text-white leading-snug">
                For schools, businesses &amp; institutions
              </p>
              <p className="text-[10px] mt-1 leading-relaxed" style={{ color: "#93C5FD" }}>
                We configure the right digital solution for your team.
              </p>
              <a
                href={BOOK_DEMO_URL}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 mt-2.5 px-3 py-1 text-[11px] font-bold rounded-lg transition-all hover:opacity-90"
                style={{ background: "#0F5BD8", color: "white" }}
              >
                Book Demo
              </a>
            </div>
          </div>
        </div>

        {/* ── Bottom bar ── */}
        <div
          className="pt-5 border-t flex flex-col sm:flex-row items-center justify-between gap-2"
          style={{ borderColor: "rgba(255,255,255,0.1)" }}
        >
          <p className="text-[11px]" style={{ color: "#60A5FA" }}>
            © {year} SSAMENJ Technologies. All rights reserved.
          </p>
          <p className="text-[11px] font-medium" style={{ color: "#93C5FD" }}>
            Smart Systems. Simple Work.
          </p>
        </div>
      </div>
    </footer>
  );
}
