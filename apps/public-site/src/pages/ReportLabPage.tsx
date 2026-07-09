import { Link } from "react-router-dom";
import { FaqSection } from "../components/marketing/FaqSection";
import { buildWhatsAppUrl } from "../config/contact";
import { REPORT_LAB_FAQS } from "../content/discoverability";

const BOOK_DEMO_URL = buildWhatsAppUrl(
  "Hello SSAMENJ Technologies! I would like a demo of School Connect Report Lab for our school.",
);

const REPORT_LAB_BULLETS = [
  "School report card system for Uganda schools",
  "Upload marks and generate digital school reports",
  "Parent-ready reports with review and release workflow",
  "First term free launch offer, setup fee applies",
  "Works well for schools that want to reduce manual formatting",
];

export function ReportLabPage() {
  return (
    <div className="bg-slate-50 text-slate-950">
      <section className="home-hero-image-bg site-hero-compact hero-rhythm border-b text-white" style={{ borderColor: "rgba(15,91,216,0.3)" }}>
        <div className="absolute inset-0 bg-dot-grid opacity-[0.12]" />
        <div className="home-hero-content mx-auto grid max-w-7xl gap-6 px-4 sm:px-6 lg:grid-cols-12 lg:items-center lg:px-8">
          <div className="lg:col-span-7">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.2em] text-blue-50">
              Report Lab Uganda
            </div>
            <h1 className="mt-2 hero-title font-black text-white">
              The school report card system Uganda schools can actually use.
            </h1>
            <p className="mt-2.5 max-w-2xl text-sm leading-7 text-blue-50 sm:text-base">
              School Connect Report Lab helps teachers and administrators upload marks, review outcomes, and produce clean, digital school reports for parents faster. It is built for Uganda schools that want a practical report workflow without paper bottlenecks.
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
                to="/smart-pages"
                className="btn marketing-button-motion motion-cta rounded-xl border border-white/25 bg-white/10 px-4 py-3 text-sm font-bold text-white hover:bg-white/15"
              >
                Explore Smart Pages
              </Link>
            </div>
          </div>

          <div className="lg:col-span-5">
            <div className="motion-media floating-media soft-glow rounded-[1.75rem] border border-white/20 bg-white/95 p-5 shadow-xl backdrop-blur">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-blue-700">What Report Lab solves</p>
              <ul className="mt-3 space-y-3">
                {REPORT_LAB_BULLETS.map((bullet) => (
                  <li key={bullet} className="flex items-start gap-2 text-sm leading-6 text-slate-700">
                    <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-blue-500" />
                    {bullet}
                  </li>
                ))}
              </ul>
              <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                Launch offer: first term free, setup fee applies.
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-slate-200 bg-white px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-700">For schools</p>
            <h2 className="mt-2 text-xl font-black text-slate-950">Built for teachers, heads, and admin teams.</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Report Lab helps schools reduce manual formatting and keep the report release process organized from marks upload to parent delivery.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-700">Uganda relevance</p>
            <h2 className="mt-2 text-xl font-black text-slate-950">Written for Uganda school reporting needs.</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              The language, pricing story, and launch offer all assume the realities of Uganda schools that want a simple digital report system.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-700">Workflow</p>
            <h2 className="mt-2 text-xl font-black text-slate-950">Upload, review, release, and share.</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              The process is designed to be practical: enter marks, review them, generate reports, and move to parents only when the school is ready.
            </p>
          </div>
        </div>
      </section>

      <section className="border-b border-slate-200 bg-slate-50 px-4 py-8 sm:px-6 lg:px-8">
        <FaqSection
          title="Report Lab questions schools ask first"
          description="A few clear answers help schools understand what Report Lab does before they book a walkthrough."
          items={REPORT_LAB_FAQS}
        />
      </section>

      <section className="border-t border-slate-200 bg-blue-50/40 px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-4 rounded-[2rem] border border-blue-200 bg-white p-6 shadow-sm lg:grid-cols-12 lg:items-center">
          <div className="lg:col-span-8">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-700">Ready to see it?</p>
            <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-950">
              Request a demo or compare it with Smart Pages.
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
