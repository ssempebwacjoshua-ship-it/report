import { Link } from "react-router-dom";
import { FaqSection } from "../components/marketing/FaqSection";
import { MarketingFeatureCard } from "../components/marketing/MarketingFeatureCard";
import { buildWhatsAppUrl } from "../config/contact";
import { RENTFLOW_FAQS } from "../content/discoverability";
import { BuildingIcon, CashIcon, DocumentIcon, WrenchIcon } from "../components/marketing/Icons";

const BOOK_DEMO_URL = buildWhatsAppUrl(
  "Hello SSAMENJ Technologies! I would like to book a RentFlow demo for my property portfolio.",
);

const RENTFLOW_FEATURES = [
  {
    step: 1,
    title: "Bookings and tenants",
    body: "Track Airbnb stays, residential tenants, move-in dates, and unit occupancy from one workflow.",
    icon: <BuildingIcon className="h-5 w-5" />,
    tone: "blue" as const,
  },
  {
    step: 2,
    title: "Payments and deposits",
    body: "Record rent, deposits, part-payments, and outstanding balances without spreadsheet drift.",
    icon: <CashIcon className="h-5 w-5" />,
    tone: "slate" as const,
  },
  {
    step: 3,
    title: "Maintenance and cleaning",
    body: "Assign jobs, monitor turnovers, and keep housekeepers and maintenance work visible.",
    icon: <WrenchIcon className="h-5 w-5" />,
    tone: "emerald" as const,
  },
  {
    step: 4,
    title: "Owner statements",
    body: "Prepare statements, checkout balances, and property summaries for owners in one place.",
    icon: <DocumentIcon className="h-5 w-5" />,
    tone: "blue" as const,
  },
] as const;

const PORTFOLIO_TYPES = ["Airbnb rooms", "Residential rentals", "Commercial shops", "Apartments"];
const KEY_METRICS = ["Bookings", "Tenants", "Deposits", "Owner statements"];

export function RentFlowPage() {
  return (
    <div className="bg-slate-50 text-slate-950">
      <section className="site-hero-blue site-hero-compact border-b text-white" style={{ borderColor: "rgba(15,91,216,0.3)" }}>
        <div className="absolute inset-0 bg-dot-grid opacity-[0.12]" />
        <div className="home-hero-content mx-auto grid max-w-7xl gap-6 px-4 sm:px-6 lg:grid-cols-12 lg:items-center lg:px-8">
          <div className="lg:col-span-7">
            <div className="marketing-fade-up inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.2em] text-blue-50">
              <BuildingIcon className="h-3.5 w-3.5" />
              SSAMENJ RentFlow
            </div>
            <h1 className="marketing-fade-up-delay-1 mt-2 hero-title font-black text-white">
              Manage rentals, Airbnb rooms, shops, and apartments from one system.
            </h1>
            <p className="marketing-fade-up-delay-2 mt-2.5 max-w-2xl text-sm leading-7 text-blue-50 sm:text-base">
              SSAMENJ RentFlow helps property owners and managers track bookings, tenants, payments, deposits, maintenance, cleaning, owner statements, and checkout balances.
            </p>

            <div className="marketing-fade-up-delay-3 mt-4 flex flex-col gap-3 sm:flex-row">
              <a
                href={BOOK_DEMO_URL}
                target="_blank"
                rel="noreferrer"
                className="btn marketing-button-motion motion-cta rounded-xl bg-white px-4 py-3 text-sm font-black text-blue-700 hover:bg-blue-50"
              >
                Book a walkthrough
              </a>
              <Link
                to="/pricing"
                className="btn marketing-button-motion motion-cta rounded-xl border border-white/25 bg-white/10 px-4 py-3 text-sm font-bold text-white hover:bg-white/15"
              >
                View pricing
              </Link>
              <Link
                to="/contact"
                className="btn marketing-button-motion motion-cta rounded-xl border border-white/25 bg-white/10 px-4 py-3 text-sm font-bold text-white hover:bg-white/15"
              >
                Contact us
              </Link>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              {KEY_METRICS.map((metric, index) => (
                <div
                  key={metric}
                  className={`marketing-card-motion rounded-2xl border border-white/25 bg-white/[0.12] px-4 py-3 transition-all duration-200 hover:border-white/40 hover:bg-white/[0.18] ${index === 0 ? "marketing-fade-up-delay-1" : index === 1 ? "marketing-fade-up-delay-2" : "marketing-fade-up-delay-3"}`}
                  style={{ backdropFilter: "blur(6px)" }}
                >
                  <p className="text-sm font-black text-white">{metric}</p>
                  <p className="mt-0.5 text-[11px] uppercase tracking-[0.16em] text-blue-100">
                    Property tracking
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="lg:col-span-5">
            <div className="motion-media floating-media soft-glow rounded-[1.75rem] border border-white/20 bg-white/95 p-5 text-slate-950 shadow-xl backdrop-blur">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-blue-700">Pricing</p>
              <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-950">First month free — setup fee applies.</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Simple pricing by number of rooms, units, shops, or apartments.
              </p>
              <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                Built for mixed portfolios that need one reliable operations hub.
              </div>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {PORTFOLIO_TYPES.map((item) => (
                  <div key={item} className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700">
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-slate-200 bg-white px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-2xl">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-700">What RentFlow covers</p>
            <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-950">
              Built for property teams that need bookings, balances, and owner reporting in one system.
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Keep short-stay rentals, residential units, and commercial properties in one clear workflow without splitting the business across separate tools.
            </p>
          </div>

          <div className="mt-4 grid gap-3 lg:grid-cols-2 xl:grid-cols-4">
            {RENTFLOW_FEATURES.map((feature) => (
              <MarketingFeatureCard key={feature.title} {...feature} />
            ))}
          </div>
        </div>
      </section>

      <section className="border-b border-slate-200 bg-slate-50 px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-4 lg:grid-cols-12 lg:items-start">
          <div className="lg:col-span-7">
            <div className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-700">Common portfolio types</p>
              <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-950">
                One system can serve multiple property formats.
              </h2>
              <div className="mt-4 flex flex-wrap gap-2">
                {PORTFOLIO_TYPES.map((item) => (
                  <span key={item} className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-blue-700">
                    {item}
                  </span>
                ))}
              </div>
              <p className="mt-4 text-sm leading-6 text-slate-600">
                Use RentFlow to manage bookings, tenants, deposits, maintenance, cleaning, owner statements, and checkout balances from one branded website experience.
              </p>
            </div>
          </div>

          <div className="lg:col-span-5">
            <div className="rounded-[1.75rem] border border-blue-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-700">Simple pricing</p>
              <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-950">
                First month free — setup fee applies.
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Pricing scales by the rooms, units, shops, or apartments you manage.
              </p>
              <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                <a
                  href={BOOK_DEMO_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="btn marketing-button-motion rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 px-4 py-3 text-sm font-black text-white shadow-lg shadow-blue-600/20 hover:shadow-xl hover:shadow-blue-600/25"
                >
                  Request demo
                </a>
                <Link
                  to="/pricing"
                  className="btn marketing-button-motion rounded-xl border border-blue-200 bg-white px-4 py-3 text-sm font-bold text-blue-700 shadow-sm hover:bg-blue-50"
                >
                  See pricing
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-slate-200 bg-white px-4 py-8 sm:px-6 lg:px-8">
        <FaqSection
          title="RentFlow questions property teams ask first"
          description="A few clear answers help property owners understand what RentFlow does before they book a walkthrough."
          items={RENTFLOW_FAQS}
        />
      </section>

      <section className="border-t border-slate-200 bg-blue-50/40 px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-4 rounded-[2rem] border border-blue-200 bg-white p-6 shadow-sm lg:grid-cols-12 lg:items-center">
          <div className="lg:col-span-8">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-700">Ready to see it?</p>
            <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-950">
              Book a walkthrough or compare RentFlow with the rest of the SSAMENJ suite.
            </h2>
          </div>
          <div className="grid gap-3 lg:col-span-4">
            <a
              href={BOOK_DEMO_URL}
              target="_blank"
              rel="noreferrer"
              className="btn marketing-button-motion motion-cta rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 px-4 py-3 text-center text-sm font-black text-white shadow-lg shadow-blue-600/20 hover:shadow-xl hover:shadow-blue-600/25"
            >
              Book a walkthrough
            </a>
            <Link
              to="/products"
              className="btn marketing-button-motion motion-cta rounded-xl border border-blue-200 bg-white px-4 py-3 text-center text-sm font-bold text-blue-700 shadow-sm hover:bg-blue-50"
            >
              See all products
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
