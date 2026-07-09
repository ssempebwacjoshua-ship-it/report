import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { FaqSection } from "../components/marketing/FaqSection";
import { buildWhatsAppUrl } from "../config/contact";
import { CASHLESS_CANTEEN_FAQS } from "../content/discoverability";
import {
  CheckIcon,
  SmartphoneIcon,
  SparklesIcon,
} from "../components/marketing/Icons";

const QUOTE_URL = buildWhatsAppUrl(
  "Hello SSAMENJ Technologies, I would like a quotation for the cashless school canteen workflow with Kids Wallet and NFC for our school.",
);

const FLOW_STEPS = [
  {
    title: "Top up the wallet",
    body: "Parents or school staff fund the student wallet before the canteen rush starts.",
  },
  {
    title: "Tap at the counter",
    body: "The student identifies with an NFC wristband, card, or tag and the canteen staff records the spend.",
  },
  {
    title: "Track the balance",
    body: "The school keeps an internal ledger of wallet movement, spending limits, and approvals.",
  },
  {
    title: "Review the audit trail",
    body: "Administrators can review canteen activity later for accountability and reconciliation.",
  },
] as const;

const BENEFITS = [
  {
    title: "Controlled spending",
    body: "School teams can keep canteen spending inside the approved wallet flow instead of handling loose cash.",
  },
  {
    title: "Faster service",
    body: "Taps are quicker than manual checks, which helps busy lunch queues move more smoothly.",
  },
  {
    title: "Works with NFC",
    body: "The canteen workflow connects naturally to School Connect NFC and the wider student identity setup.",
  },
  {
    title: "Clear records",
    body: "The school can review wallet movement and canteen transactions from the same operational system.",
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
        <li className="text-slate-700">Cashless Canteen</li>
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

export function CashlessCanteenPage() {
  return (
    <div className="bg-slate-50 text-slate-950">
      <section className="site-hero-blue site-hero-compact hero-rhythm border-b text-white" style={{ borderColor: "rgba(15,91,216,0.3)" }}>
        <div className="absolute inset-0 bg-dot-grid opacity-[0.12]" />
        <div className="home-hero-content mx-auto grid max-w-7xl gap-8 px-4 sm:px-6 lg:grid-cols-12 lg:items-center lg:px-8">
          <div className="lg:col-span-7">
            <Breadcrumbs />
            <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.2em] text-blue-50">
              <SparklesIcon className="h-3.5 w-3.5" />
              Kids Wallet + NFC
            </div>
            <h1 className="marketing-fade-up-delay-1 mt-2 hero-title font-black text-white">
              Cashless school canteen Uganda schools can use for simple wallet-based payments.
            </h1>
            <p className="marketing-fade-up-delay-2 mt-2.5 max-w-2xl text-sm leading-7 text-blue-50 sm:text-base">
              The cashless canteen landing page shows how SSAMENJ links student wallets to the school canteen.
              Use NFC wristbands, cards, or tags to record spending, keep the lunch queue moving, and retain a
              clear internal audit trail.
            </p>

            <div className="marketing-fade-up-delay-3 mt-4 flex flex-col gap-3 sm:flex-row">
              <a
                href={QUOTE_URL}
                target="_blank"
                rel="noreferrer"
                className="btn marketing-button-motion rounded-xl bg-white px-4 py-3 text-sm font-black text-blue-700 shadow-lg hover:bg-blue-50"
              >
                Request quotation
              </a>
              <Link
                to="/nfc"
                className="btn marketing-button-motion rounded-xl border border-white/25 bg-white/10 px-4 py-3 text-sm font-bold text-white hover:bg-white/15"
              >
                View NFC
              </Link>
              <Link
                to="/pricing"
                className="btn marketing-button-motion rounded-xl border border-white/25 bg-white/10 px-4 py-3 text-sm font-bold text-white hover:bg-white/15"
              >
                View pricing
              </Link>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              {["Kids Wallet", "Canteen", "NFC", "Audit Trail", "Controlled Spending"].map((tag) => (
                <span key={tag} className="rounded-full border border-white/25 bg-white/10 px-3 py-1 text-[11px] font-bold text-white">
                  {tag}
                </span>
              ))}
            </div>
          </div>

          <div className="lg:col-span-5">
            <div className="overflow-hidden rounded-[1.75rem] border border-white/20 bg-white/95 p-3 shadow-2xl backdrop-blur">
              <img
                src="/images/nfc-player-banner.png"
                alt="School canteen cashless payment workflow preview"
                className="h-full w-full rounded-[1.25rem] object-cover"
                loading="eager"
              />
              <div className="mt-3 grid grid-cols-2 gap-2">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Wallet</p>
                  <p className="mt-1 text-sm font-black text-slate-950">Controlled spending</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Speed</p>
                  <p className="mt-1 text-sm font-black text-slate-950">Faster counter flow</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-slate-200 bg-white px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-2xl">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-700">How it works</p>
            <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-950">
              A simple flow for lunch queues and wallet control.
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              The public page stays focused on the canteen workflow so schools can understand the product quickly
              before moving to a demo or quotation.
            </p>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {FLOW_STEPS.map((step, index) => (
              <article key={step.title} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-blue-700">
                    Step {index + 1}
                  </span>
                  <SmartphoneIcon className="h-5 w-5 text-blue-700" />
                </div>
                <h3 className="mt-3 text-sm font-black text-slate-950">{step.title}</h3>
                <p className="mt-1.5 text-sm leading-6 text-slate-600">{step.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="border-b border-slate-200 bg-slate-50 px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-8 lg:grid-cols-12 lg:items-start">
            <div className="lg:col-span-5">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-700">Why schools use it</p>
              <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-950">
                Cash handling becomes easier to manage and easier to audit.
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                The canteen workflow is part of the wider school identity stack, so schools can keep the
                canteen, attendance, and gate experience aligned without inventing a separate process.
              </p>
              <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                <a
                  href={QUOTE_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="btn marketing-button-motion rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 px-4 py-3 text-sm font-black text-white shadow-lg shadow-blue-600/20"
                >
                  Request quotation
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
                {BENEFITS.map((item) => (
                  <InfoCard
                    key={item.title}
                    title={item.title}
                    body={item.body}
                    icon={<CheckIcon className="h-4 w-4" />}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-slate-200 bg-white px-4 py-8 sm:px-6 lg:px-8">
        <FaqSection
          eyebrow="Cashless Canteen FAQ"
          title="Questions schools ask before they start."
          description="These answers keep the page honest and help Search Console understand what the page covers."
          items={CASHLESS_CANTEEN_FAQS}
        />
      </section>

      <section className="border-t border-slate-200 bg-blue-50/40 px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl rounded-[2rem] border border-blue-200 bg-white p-6 shadow-sm sm:p-7">
          <div className="grid gap-6 lg:grid-cols-12 lg:items-center">
            <div className="lg:col-span-8">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-700">Ready to plan it?</p>
              <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-950">
                Start with the canteen workflow, then connect the rest of the school tools.
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Cashless canteen is strongest when it lives next to NFC, attendance, and the school wallet
                workflow. We can show the full setup in one walkthrough.
              </p>
            </div>
            <div className="grid gap-3 lg:col-span-4">
              <a
                href={QUOTE_URL}
                target="_blank"
                rel="noreferrer"
                className="btn marketing-button-motion rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 px-4 py-3 text-center text-sm font-black text-white shadow-lg shadow-blue-600/20 hover:shadow-xl"
              >
                Request quotation
              </a>
              <Link
                to="/nfc"
                className="btn marketing-button-motion rounded-xl border border-blue-200 bg-white px-4 py-3 text-center text-sm font-bold text-blue-700 shadow-sm hover:bg-blue-50"
              >
                Open NFC page
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
