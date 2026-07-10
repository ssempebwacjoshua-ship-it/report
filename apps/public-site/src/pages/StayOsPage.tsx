import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { FaqSection } from "../components/marketing/FaqSection";
import { buildWhatsAppUrl } from "../config/contact";
import { STAYOS_FAQS } from "../content/discoverability";
import {
  BuildingIcon,
  CashIcon,
  CheckIcon,
  DocumentIcon,
  HomeIcon,
  OfficeIcon,
  PhoneIcon,
  PrinterIcon,
  SmartphoneIcon,
  WrenchIcon,
} from "../components/marketing/Icons";

const BOOK_URL = buildWhatsAppUrl(
  "Hello SSAMENJ Technologies, I would like to book a StayOS and RentFlow walkthrough for my property portfolio.",
);

const WORKFLOW = [
  {
    title: "Add the property",
    body: "Register rooms, units, or shops so the portfolio is visible in one clean dashboard.",
    icon: <BuildingIcon className="h-5 w-5" />,
  },
  {
    title: "Record stays and tenants",
    body: "Capture short-stay bookings, residential tenants, and move-in dates without splitting tools.",
    icon: <PhoneIcon className="h-5 w-5" />,
  },
  {
    title: "Track balances",
    body: "See rent, deposits, and pending balances together so nothing gets lost in spreadsheets.",
    icon: <CashIcon className="h-5 w-5" />,
  },
  {
    title: "Close with statements",
    body: "Generate checkout summaries and owner statements from the same workflow.",
    icon: <PrinterIcon className="h-5 w-5" />,
  },
] as const;

const PORTFOLIOS = [
  {
    title: "Short stays",
    body: "For hosts who need bookings, occupancy, and turnover visibility in one place.",
    icon: <HomeIcon className="h-5 w-5" />,
  },
  {
    title: "Residential rentals",
    body: "For landlords who want tenant records, payment tracking, and simple reminders.",
    icon: <BuildingIcon className="h-5 w-5" />,
  },
  {
    title: "Commercial units",
    body: "For shops and offices that need occupancy tracking and straightforward statements.",
    icon: <OfficeIcon className="h-5 w-5" />,
  },
  {
    title: "Cleaning and maintenance",
    body: "For teams that need turnover tasks and follow-up work visible before the next stay.",
    icon: <WrenchIcon className="h-5 w-5" />,
  },
  {
    title: "Owner reporting",
    body: "For monthly summaries that help owners review balances and operational movement.",
    icon: <DocumentIcon className="h-5 w-5" />,
  },
  {
    title: "Phone-first use",
    body: "For caretakers who open the workflow from a phone while they are away from a desktop.",
    icon: <SmartphoneIcon className="h-5 w-5" />,
  },
] as const;

function Breadcrumbs() {
  return (
    <nav aria-label="Breadcrumb" className="text-xs font-semibold text-slate-500">
      <ol className="flex flex-wrap items-center gap-1.5">
        <li>
          <Link to="/" className="hover:text-blue-700">
            Home
          </Link>
        </li>
        <li aria-hidden="true">/</li>
        <li>
          <Link to="/products" className="hover:text-blue-700">
            Products
          </Link>
        </li>
        <li aria-hidden="true">/</li>
        <li className="text-slate-700">StayOS</li>
      </ol>
    </nav>
  );
}

function InfoCard({
  title,
  body,
  icon,
}: {
  title: string;
  body: string;
  icon: ReactNode;
}) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-blue-200 hover:shadow-md">
      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
        {icon}
      </div>
      <h3 className="mt-3 text-sm font-black text-slate-950">{title}</h3>
      <p className="mt-1.5 text-sm leading-6 text-slate-600">{body}</p>
    </article>
  );
}

export function StayOsPage() {
  return (
    <div className="bg-slate-50 text-slate-950">
      <section className="site-hero-blue site-hero-compact hero-rhythm border-b text-white" style={{ borderColor: "rgba(15,91,216,0.3)" }}>
        <div className="absolute inset-0 bg-dot-grid opacity-[0.12]" />
        <div className="home-hero-content mx-auto grid max-w-7xl gap-8 px-4 sm:px-6 lg:grid-cols-12 lg:items-center lg:px-8">
          <div className="lg:col-span-7">
            <Breadcrumbs />
            <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.2em] text-blue-50">
              <BuildingIcon className="h-3.5 w-3.5" />
              Property Operations
            </div>
            <h1 className="marketing-fade-up-delay-1 mt-2 hero-title font-black text-white">
              Property management software Uganda landlords can use for stays and rentals.
            </h1>
            <p className="marketing-fade-up-delay-2 mt-2.5 max-w-2xl text-sm leading-7 text-blue-50 sm:text-base">
              StayOS is the public keyword landing page for SSAMENJ's property operations workflow. It points
              property teams to the RentFlow system for bookings, tenants, payments, cleaning, statements, and
              checkout balances.
            </p>

            <div className="marketing-fade-up-delay-3 mt-4 flex flex-col gap-3 sm:flex-row">
              <a
                href={BOOK_URL}
                target="_blank"
                rel="noreferrer"
                className="btn marketing-button-motion rounded-xl bg-white px-4 py-3 text-sm font-black text-blue-700 shadow-lg hover:bg-blue-50"
              >
                Book a walkthrough
              </a>
              <Link
                to="/rentflow"
                className="btn marketing-button-motion rounded-xl border border-white/25 bg-white/10 px-4 py-3 text-sm font-bold text-white hover:bg-white/15"
              >
                Open RentFlow
              </Link>
              <Link
                to="/pricing"
                className="btn marketing-button-motion rounded-xl border border-white/25 bg-white/10 px-4 py-3 text-sm font-bold text-white hover:bg-white/15"
              >
                View pricing
              </Link>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              {["Bookings", "Tenants", "Deposits", "Owner statements", "Cleaning"].map((tag) => (
                <span key={tag} className="rounded-full border border-white/25 bg-white/10 px-3 py-1 text-[11px] font-bold text-white">
                  {tag}
                </span>
              ))}
            </div>
          </div>

          <div className="lg:col-span-5">
            <div className="overflow-hidden rounded-[1.75rem] border border-white/20 bg-white/95 p-4 shadow-2xl backdrop-blur">
              <div className="rounded-[1.35rem] border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-blue-700">StayOS dashboard</p>
                    <p className="mt-1 text-sm font-black text-slate-950">One screen for the portfolio</p>
                  </div>
                  <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-emerald-700">
                    Live
                  </span>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-blue-200 bg-white p-3 shadow-sm">
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Bookings</p>
                    <p className="mt-1 text-sm font-black text-slate-950">Short stays and check-ins</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Balances</p>
                    <p className="mt-1 text-sm font-black text-slate-950">Rent and deposits</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Cleaning</p>
                    <p className="mt-1 text-sm font-black text-slate-950">Turnover tasks</p>
                  </div>
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 shadow-sm">
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Statements</p>
                    <p className="mt-1 text-sm font-black text-slate-950">Owner-ready summaries</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-slate-200 bg-white px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-2xl">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-700">Workflow</p>
            <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-950">
              StayOS keeps the property workflow visible from check-in to checkout.
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              The page is intentionally public and indexable so property teams can find the workflow from search
              and understand what RentFlow covers before booking a walkthrough.
            </p>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {WORKFLOW.map((item, index) => (
              <article key={item.title} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-blue-700">
                    Step {index + 1}
                  </span>
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-blue-700 shadow-sm">
                    {item.icon}
                  </span>
                </div>
                <h3 className="mt-3 text-sm font-black text-slate-950">{item.title}</h3>
                <p className="mt-1.5 text-sm leading-6 text-slate-600">{item.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="border-b border-slate-200 bg-slate-50 px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-8 lg:grid-cols-12 lg:items-start">
            <div className="lg:col-span-5">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-700">Portfolio types</p>
              <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-950">
                One system can serve multiple property types.
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                StayOS is positioned for property teams that need the public site to speak clearly about rentals,
                short stays, and the operational workflow behind them.
              </p>
              <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                <a
                  href={BOOK_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="btn marketing-button-motion rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 px-4 py-3 text-sm font-black text-white shadow-lg shadow-blue-600/20"
                >
                  Book a walkthrough
                </a>
                <Link
                  to="/products"
                  className="btn marketing-button-motion rounded-xl border border-blue-200 bg-white px-4 py-3 text-sm font-bold text-blue-700 shadow-sm hover:bg-blue-50"
                >
                  See products
                </Link>
              </div>
            </div>

            <div className="lg:col-span-7">
              <div className="grid gap-3 md:grid-cols-2">
                {PORTFOLIOS.map((item) => (
                  <InfoCard
                    key={item.title}
                    title={item.title}
                    body={item.body}
                    icon={item.icon}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-slate-200 bg-white px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-700">Relation to RentFlow</p>
              <h3 className="mt-2 text-2xl font-black tracking-tight text-slate-950">StayOS points to the main workflow.</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                If a visitor lands on StayOS first, the page routes them toward RentFlow for the fuller product
                explanation and the walkthrough.
              </p>
              <Link
                to="/rentflow"
                className="mt-4 inline-flex rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm font-bold text-blue-700 hover:bg-blue-100"
              >
                Open RentFlow
              </Link>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-700">What it tracks</p>
              <h3 className="mt-2 text-2xl font-black tracking-tight text-slate-950">The data that matters to property teams.</h3>
              <div className="mt-3 space-y-2 text-sm text-slate-600">
                {["Bookings", "Deposits", "Payments", "Cleaning", "Owner statements"].map((item) => (
                  <div key={item} className="flex items-center gap-2">
                    <CheckIcon className="h-4 w-4 text-blue-700" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-700">Contact</p>
              <h3 className="mt-2 text-2xl font-black tracking-tight text-slate-950">Ask for pricing or a demo.</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                We can walk through the property workflow, explain the launch offer, and show how the public page
                maps to the product.
              </p>
              <Link
                to="/contact"
                className="mt-4 inline-flex rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50"
              >
                Contact us
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-slate-200 bg-white px-4 py-8 sm:px-6 lg:px-8">
        <FaqSection
          eyebrow="StayOS FAQ"
          title="Questions property teams ask first."
          description="These answers help visitors understand how the StayOS page relates to the RentFlow product."
          items={STAYOS_FAQS}
        />
      </section>

      <section className="border-t border-slate-200 bg-blue-50/40 px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl rounded-[2rem] border border-blue-200 bg-white p-6 shadow-sm sm:p-7">
          <div className="grid gap-6 lg:grid-cols-12 lg:items-center">
            <div className="lg:col-span-8">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-700">Ready to explore?</p>
              <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-950">
                Book the walkthrough, then compare the property workflow with the rest of the SSAMENJ suite.
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                The page is built for searchers who want a clean public route and a clear path into the live product.
              </p>
            </div>
            <div className="grid gap-3 lg:col-span-4">
              <a
                href={BOOK_URL}
                target="_blank"
                rel="noreferrer"
                className="btn marketing-button-motion rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 px-4 py-3 text-center text-sm font-black text-white shadow-lg shadow-blue-600/20 hover:shadow-xl"
              >
                Book a walkthrough
              </a>
              <Link
                to="/rentflow"
                className="btn marketing-button-motion rounded-xl border border-blue-200 bg-white px-4 py-3 text-center text-sm font-bold text-blue-700 shadow-sm hover:bg-blue-50"
              >
                Open RentFlow
              </Link>
              <Link
                to="/contact"
                className="btn marketing-button-motion rounded-xl border border-slate-200 bg-white px-4 py-3 text-center text-sm font-medium text-slate-600 shadow-sm hover:bg-slate-50"
              >
                Contact us
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
