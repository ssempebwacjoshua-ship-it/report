import { Link } from "react-router-dom";
import { buildWhatsAppUrl } from "../../config/contact";
import { WhatsAppIcon } from "./Icons";

const BOOK_DEMO_URL = buildWhatsAppUrl(
  "Hello SSAMENJ Technologies! I would like to book a demo.",
);

const NAV_LINKS = [
  { label: "Products", href: "/products" },
  { label: "Demos", href: "/demos" },
  { label: "Pricing", href: "/pricing" },
  { label: "About", href: "/about" },
  { label: "Contact", href: "/contact" },
];

function LogoLight() {
  return (
    <div className="flex items-center gap-2.5">
      <img
        src="/ssamenj-logo.png"
        alt="SSAMENJ"
        className="h-8 w-8 shrink-0 object-contain"
        style={{ filter: "brightness(0) invert(1)" }}
        onError={(e) => {
          const target = e.currentTarget;
          target.style.display = "none";
          const fallback = target.nextElementSibling as HTMLElement | null;
          if (fallback) fallback.style.display = "grid";
        }}
      />
      {/* fallback: inline display:none; onError sets display:grid via inline style which overrides nothing */}
      <div
        className="h-[28px] w-[28px] shrink-0 place-items-center rounded-lg border"
        style={{ display: "none", background: "rgba(255,255,255,0.12)", borderColor: "rgba(255,255,255,0.2)", color: "white" }}
      >
        <span className="text-[13px] font-black leading-none">S</span>
      </div>
      <div>
        <div className="text-[13px] font-extrabold leading-none tracking-tight text-white">SSAMENJ</div>
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
      <div className="mx-auto max-w-7xl px-4 pb-6 pt-10 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-3">

          {/* Brand */}
          <div>
            <LogoLight />
            <p className="mt-3 text-xs font-semibold text-[#93C5FD]">Smart Systems. Simple Work.</p>
            <a
              href={BOOK_DEMO_URL}
              target="_blank"
              rel="noreferrer"
              className="mt-4 inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-bold text-white transition-all hover:opacity-90"
              style={{ background: "#0F5BD8" }}
            >
              Book Demo
            </a>
          </div>

          {/* Navigation */}
          <div>
            <h3 className="mb-4 text-[10px] font-bold uppercase tracking-widest text-[#93C5FD]">Navigation</h3>
            <ul className="space-y-2.5">
              {NAV_LINKS.map((item) => (
                <li key={item.label}>
                  <Link to={item.href} className="text-sm text-[#BFDBFE] transition-colors hover:text-white">
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Get in Touch */}
          <div>
            <h3 className="mb-4 text-[10px] font-bold uppercase tracking-widest text-[#93C5FD]">Get in Touch</h3>
            <ul className="space-y-3">
              <li>
                <a
                  href="https://wa.me/971563704103"
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-start gap-2 text-xs text-[#BFDBFE] transition-colors hover:text-white"
                >
                  <WhatsAppIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>
                    <span className="block text-[10px] font-bold uppercase tracking-wide text-[#93C5FD]">Global</span>
                    +971 56 370 4103
                  </span>
                </a>
              </li>
              <li>
                <a
                  href="https://wa.me/256774549869"
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-start gap-2 text-xs text-[#BFDBFE] transition-colors hover:text-white"
                >
                  <WhatsAppIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>
                    <span className="block text-[10px] font-bold uppercase tracking-wide text-[#93C5FD]">Uganda PM</span>
                    +256 774 549 869
                  </span>
                </a>
              </li>
              <li className="pt-1">
                <a
                  href={BOOK_DEMO_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-[#BFDBFE] transition-colors hover:text-white"
                >
                  Request demo on WhatsApp →
                </a>
              </li>
            </ul>
          </div>

        </div>

        <div
          className="mt-8 flex flex-col items-center justify-between gap-2 border-t pt-5 sm:flex-row"
          style={{ borderColor: "rgba(255,255,255,0.1)" }}
        >
          <p className="text-[11px] text-[#60A5FA]">© {year} SSAMENJ Technologies. All rights reserved.</p>
          <p className="text-[11px] font-medium text-[#93C5FD]">Smart Systems. Simple Work.</p>
        </div>
      </div>
    </footer>
  );
}
