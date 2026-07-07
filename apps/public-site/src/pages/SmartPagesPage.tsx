import { Link } from "react-router-dom";
import { FaqSection } from "../components/marketing/FaqSection";
import { buildWhatsAppUrl } from "../config/contact";
import { SMART_PAGES_FAQS } from "../content/discoverability";

const BOOK_DEMO_URL = buildWhatsAppUrl(
  "Hello SSAMENJ Technologies! I would like a demo of Smart Pages for our school.",
);

const SMART_PAGES_BULLETS = [
  "Turn school documents into clean digital pages",
  "Useful for circulars, notices, timetables, letters, and forms",
  "Supports school workflows that want less typing and faster sharing",
  "Works as a standalone tool or alongside Report Lab",
  "Fits the first-term-free launch offer where relevant",
];

export function SmartPagesPage() {
  return (
    <div className="bg-slate-50 text-slate-950">
      <section className="site-hero-blue site-hero-compact border-b text-white" style={{ borderColor: "rgba(15,91,216,0.3)" }}>
        <div className="absolute inset-0 bg-dot-grid opacity-[0.15]" />
        <div className="relative mx-auto grid max-w-7xl gap-6 px-4 sm:px-6 lg:grid-cols-12 lg:items-center lg:px-8">
          <div className="lg:col-span-7">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.2em] text-blue-50">
              Smart Pages Uganda
            </div>
            <h1 className="mt-2 hero-title font-black text-white">
              Digital school documents without the typing grind.
            </h1>
            <p className="mt-2.5 max-w-2xl text-sm leading-7 text-blue-50 sm:text-base">
              Smart Pages helps schools turn handwritten or scanned documents into clear, structured digital pages and PDFs. It is useful for circulars, notices, timetables, letters, forms, and other school documents that need to look polished quickly.
            </p>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
              <a
                href={BOOK_DEMO_URL}
                target="_blank"
                rel="noreferrer"
                className="btn marketing-button-motion motion-cta rounded-xl bg-white px-4 py-3 text-sm font-black text-blue-700 hover:bg-blue-50"
              >
                Request Demo
              </a>
              <Link
                to="/pricing"
                className="btn marketing-button-motion motion-cta rounded-xl border border-white/25 bg-white/10 px-4 py-3 text-sm font-bold text-white hover:bg-white/15"
              >
                View Pricing
              </Link>
              <Link
                to="/report-lab"
                className="btn marketing-button-motion motion-cta rounded-xl border border-white/25 bg-white/10 px-4 py-3 text-sm font-bold text-white hover:bg-white/15"
              >
                Explore Report Lab
              </Link>
            </div>
          </div>

          <div className="lg:col-span-5">
            <div className="motion-media floating-media soft-glow rounded-[1.75rem] border border-white/20 bg-white/95 p-5 shadow-xl backdrop-blur">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-blue-700">What Smart Pages solves</p>
              <ul className="mt-3 space-y-3">
                {SMART_PAGES_BULLETS.map((bullet) => (
                  <li key={bullet} className="flex items-start gap-2 text-sm leading-6 text-slate-700">
                    <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-blue-500" />
                    {bullet}
                  </li>
                ))}
              </ul>
              <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                Smart Pages trial includes 10 pages on the launch offer.
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-slate-200 bg-white px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-700">Document workflow</p>
            <h2 className="mt-2 text-xl font-black text-slate-950">Less typing, more clarity.</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Schools can convert raw documents into a cleaner format for sharing, printing, and keeping organized.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-700">Useful for schools</p>
            <h2 className="mt-2 text-xl font-black text-slate-950">Ideal for circulars and notices.</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Smart Pages is especially handy for circulars, notices, timetables, forms, and school letters that need a tidy digital format.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-700">Standalone or bundled</p>
            <h2 className="mt-2 text-xl font-black text-slate-950">Use it by itself or with Report Lab.</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Schools can start with Smart Pages alone or include it in a wider workflow with Report Lab and other School Connect tools.
            </p>
          </div>
        </div>
      </section>

      <section className="border-b border-slate-200 bg-slate-50 px-4 py-8 sm:px-6 lg:px-8">
        <FaqSection
          title="Smart Pages questions from schools"
          description="These questions cover the most common reasons a school looks at Smart Pages in the first place."
          items={SMART_PAGES_FAQS}
        />
      </section>

      <section className="border-t border-slate-200 bg-blue-50/40 px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-4 rounded-[2rem] border border-blue-200 bg-white p-6 shadow-sm lg:grid-cols-12 lg:items-center">
          <div className="lg:col-span-8">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-700">Ready for a walkthrough?</p>
            <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-950">
              Book a demo and see how Smart Pages fits your school.
            </h2>
          </div>
          <div className="grid gap-3 lg:col-span-4">
            <a
              href={BOOK_DEMO_URL}
              target="_blank"
              rel="noreferrer"
              className="btn marketing-button-motion motion-cta rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 px-4 py-3 text-center text-sm font-black text-white shadow-lg shadow-blue-600/20 hover:shadow-xl hover:shadow-blue-600/25"
            >
              Book a Demo
            </a>
            <Link
              to="/contact"
              className="btn marketing-button-motion motion-cta rounded-xl border border-blue-200 bg-white px-4 py-3 text-center text-sm font-bold text-blue-700 shadow-sm hover:bg-blue-50"
            >
              Contact SSAMENJ
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
