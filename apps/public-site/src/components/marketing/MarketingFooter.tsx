import { buildWhatsAppUrl, WHATSAPP_DISPLAY } from "../../config/contact";
import { WhatsAppIcon } from "./Icons";

const BOOK_DEMO_URL = buildWhatsAppUrl(
  "Hello SSAMENJ Technologies! I would like to book a demo.",
);
const REQUEST_DEMO_URL = buildWhatsAppUrl(
  "Hello SSAMENJ Technologies, I would like to request a demo.",
);

const PRODUCT_LINKS = [
  { label: "Report Lab", href: "/report-lab" },
  { label: "Smart Pages", href: "/smart-pages" },
  { label: "School Connect", href: "/products#school-connect" },
  { label: "Legal Smart Pages", href: "/products#legal-smart-pages" },
  { label: "Kids Wallet", href: "/products#kids-wallet" },
  { label: "NFC Bands", href: "/products#nfc-bands" },
  { label: "PearlMart", href: "/products#pearlmart" },
  { label: "Wideh Cash", href: "/products#wideh-cash" },
  { label: "Custom Digital Products", href: "/contact" },
];

const COMPANY_LINKS = [
  { label: "Home", href: "/" },
  { label: "Products", href: "/products" },
  { label: "Demos", href: "/demos" },
  { label: "About", href: "/about" },
  { label: "Contact", href: "/contact" },
];

function LogoLight() {
  return (
    <div className="flex items-center gap-2.5">
      {/* white badge wraps the logo so its white background blends in */}
      <div className="flex h-[36px] w-[36px] shrink-0 items-center justify-center rounded-xl bg-white p-1">
        <img
          src="/ssamenj-logo-footer.png"
          alt="SSAMENJ"
          className="h-full w-full object-contain"
        />
      </div>
      <div>
        <div className="text-[14px] font-extrabold leading-none tracking-tight text-white">SSAMENJ</div>
        <div className="mt-[3px] text-[9px] font-semibold uppercase leading-none tracking-widest text-[#93C5FD]">
          Technologies
        </div>
      </div>
    </div>
  );
}

export function MarketingFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="text-white" style={{ background: "#0B2F6B" }}>
      <div className="mx-auto max-w-7xl px-4 pb-5 pt-8 sm:px-6 lg:px-8">
        <div className="mb-7 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <LogoLight />
            <p className="mt-3 text-xs font-semibold text-[#93C5FD]">Smart Systems. Simple Work.</p>
            <p className="mt-1.5 text-xs leading-relaxed text-[#60A5FA]">
              Practical digital systems for schools, offices, legal teams, and growing businesses.
            </p>
            <a
              href={BOOK_DEMO_URL}
              target="_blank"
              rel="noreferrer"
              className="mt-4 inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold text-white transition-all hover:opacity-90"
              style={{ background: "#0F5BD8" }}
            >
              Book Demo
            </a>
          </div>

          <div>
            <h3 className="mb-3 text-[10px] font-bold uppercase tracking-widest text-[#93C5FD]">Products</h3>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
              {PRODUCT_LINKS.map((item) => (
                <a key={item.label} href={item.href} className="truncate text-xs text-[#BFDBFE] transition-colors hover:text-white">
                  {item.label}
                </a>
              ))}
            </div>
          </div>

          <div>
            <h3 className="mb-3 text-[10px] font-bold uppercase tracking-widest text-[#93C5FD]">Company</h3>
            <ul className="space-y-1.5">
              {COMPANY_LINKS.map((item) => (
                <li key={item.label}>
                  <a href={item.href} className="text-xs text-[#BFDBFE] transition-colors hover:text-white">
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="mb-3 text-[10px] font-bold uppercase tracking-widest text-[#93C5FD]">Get in Touch</h3>
            <ul className="space-y-2">
              <li>
                <a
                  href={buildWhatsAppUrl("Hello SSAMENJ Technologies! I would like to chat with the global team.")}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 text-xs text-[#BFDBFE] transition-colors hover:text-white"
                >
                  <WhatsAppIcon className="h-3.5 w-3.5 flex-shrink-0" />
                  <span>
                    <span className="block text-[10px] font-bold uppercase tracking-wide text-[#93C5FD]">Global Support</span>
                    {WHATSAPP_DISPLAY}
                  </span>
                </a>
              </li>
              <li>
                <a
                  href={buildWhatsAppUrl("Hello SSAMENJ Technologies! I would like to chat with the team.")}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 text-xs text-[#BFDBFE] transition-colors hover:text-white"
                >
                  <WhatsAppIcon className="h-3.5 w-3.5 flex-shrink-0" />
                  <span>
                    <span className="block text-[10px] font-bold uppercase tracking-wide text-[#93C5FD]">Uganda PM</span>
                    +256 774 549 869
                  </span>
                </a>
              </li>
              <li>
                <a href={REQUEST_DEMO_URL} target="_blank" rel="noreferrer" className="text-xs text-[#BFDBFE] transition-colors hover:text-white">
                  Request demo on WhatsApp →
                </a>
              </li>
              <li>
                <a href="/demos" className="text-xs text-[#BFDBFE] transition-colors hover:text-white">
                  Explore demos →
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="flex flex-col items-center justify-between gap-2 border-t pt-5 sm:flex-row" style={{ borderColor: "rgba(255,255,255,0.1)" }}>
          <p className="text-[11px] text-[#60A5FA]">© {year} SSAMENJ Technologies. All rights reserved.</p>
          <p className="text-[11px] font-medium text-[#93C5FD]">Smart Systems. Simple Work.</p>
        </div>
      </div>
    </footer>
  );
}
