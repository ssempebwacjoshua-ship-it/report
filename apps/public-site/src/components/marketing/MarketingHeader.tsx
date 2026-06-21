import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { buildWhatsAppUrl } from "../../config/contact";
import { ArrowRightIcon, CloseIcon, MenuIcon } from "./Icons";

const BOOK_DEMO_URL = buildWhatsAppUrl(
  "Hello SSAMENJ Technologies! I'd like to book a product demo for my organisation.",
);

const NAV_ITEMS = [
  { label: "Products", href: "/products" },
  { label: "Demos", href: "/demos" },
  { label: "Pricing", href: "/pricing" },
  { label: "About", href: "/about" },
  { label: "Contact", href: "/contact" },
];

export function MarketingHeader() {
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const [hidden, setHidden] = useState(false);
  const lastScrollY = useRef(0);

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(href + "/");
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

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <header
      className="fixed inset-x-0 top-0 z-50"
      style={{
        background: "rgba(255,255,255,0.98)",
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
        borderBottom: "1px solid #D8E2F0",
        transform: hidden && !open ? "translateY(-100%)" : "translateY(0)",
        transition: "transform 250ms ease",
      }}
    >
      <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8">
        <div className="flex h-[56px] items-center justify-between gap-2">
          <Link to="/" className="flex shrink-0 items-center gap-1.5" style={{ textDecoration: "none" }}>
            <div className="flex items-center gap-2">
              <img
                src="/ssamenj-logo.png"
                alt="SSAMENJ"
                className="h-8 w-8 object-contain"
                onError={(e) => {
                  const target = e.currentTarget;
                  target.style.display = "none";
                  const fallback = target.nextElementSibling as HTMLElement | null;
                  if (fallback) fallback.style.display = "grid";
                }}
              />
              <div
                className="hidden h-[28px] w-[28px] place-items-center rounded-lg border"
                style={{ background: "#EAF3FF", borderColor: "#C2D8FF", color: "#0B2F6B" }}
              >
                <span className="text-[13px] font-black leading-none">S</span>
              </div>
              <div>
                <div className="text-[12px] font-extrabold leading-none tracking-tight text-[#0B2F6B]">
                  SSAMENJ
                </div>
                <div className="mt-[2px] text-[7.5px] font-semibold uppercase leading-none tracking-[0.14em] text-[#0F5BD8]">
                  Technologies
                </div>
              </div>
            </div>
          </Link>

          <nav className="hidden flex-1 min-w-0 items-center justify-center gap-1 xl:flex" aria-label="Main navigation">
            <Link
              to="/"
              className="rounded-lg px-2.5 py-1 text-[13px] font-bold transition-colors hover:bg-[#F5F8FF]"
              style={{ color: isActive("/") ? "#0F5BD8" : "#0B0F19", background: isActive("/") ? "#EAF3FF" : "transparent" }}
            >
              Home
            </Link>
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                to={item.href}
                className="rounded-lg px-2.5 py-1 text-[13px] font-bold transition-colors hover:bg-[#F5F8FF]"
                style={{ color: isActive(item.href) ? "#0F5BD8" : "#0B0F19", background: isActive(item.href) ? "#EAF3FF" : "transparent" }}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="hidden items-center gap-2 xl:flex">
            <a
              href="/demos"
              className="whitespace-nowrap rounded-lg px-3 py-1.5 text-[12px] font-bold transition-colors hover:bg-[#EAF3FF]"
              style={{ color: "#0F5BD8" }}
            >
              View Demos
            </a>
            <a
              href={BOOK_DEMO_URL}
              target="_blank"
              rel="noreferrer"
              className="whitespace-nowrap rounded-lg bg-[#0F5BD8] px-3 py-1.5 text-[12px] font-bold text-white shadow-sm transition-all hover:opacity-90 active:scale-95"
            >
              Book Demo
            </a>
          </div>

          <button
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-700 xl:hidden"
            onClick={() => setOpen((value) => !value)}
            aria-label={open ? "Close menu" : "Open menu"}
            type="button"
          >
            {open ? <CloseIcon className="h-5 w-5" /> : <MenuIcon className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {open ? (
        <div className="border-t border-[#EAF3FF] bg-white xl:hidden">
          <div className="mx-auto max-w-[1440px] space-y-0.5 px-4 py-3 sm:px-6">
            <Link to="/" className="block rounded-lg px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">
              Home
            </Link>
            <div className="pt-2 pb-1">
              <p className="mb-1 px-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Explore</p>
              {NAV_ITEMS.map((item) => (
                <Link
                  key={item.href}
                  to={item.href}
                  className="block rounded-lg px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  {item.label}
                </Link>
              ))}
            </div>
            <div className="border-t border-[#EAF3FF] pt-3 pb-2 space-y-2">
              <a
                href={BOOK_DEMO_URL}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-center rounded-xl bg-[#0F5BD8] px-4 py-2.5 text-sm font-bold text-white"
              >
                Book a Demo
              </a>
              <a
                href="/demos"
                className="flex items-center justify-center rounded-xl border border-[#D8E2F0] px-4 py-2.5 text-sm font-bold text-[#0F5BD8]"
              >
                View Demos
                <ArrowRightIcon className="ml-1 h-4 w-4" />
              </a>
            </div>
          </div>
        </div>
      ) : null}

    </header>
  );
}
