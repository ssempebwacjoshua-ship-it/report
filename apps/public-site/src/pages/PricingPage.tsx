import { Link } from "react-router-dom";
import type { ReactNode } from "react";
import { buildWhatsAppUrl, WHATSAPP_DISPLAY } from "../config/contact";
import {
  CheckIcon,
  CreditIcon,
  DocumentIcon,
  WrenchIcon,
} from "../components/marketing/Icons";
import { TestimonialsSection } from "../components/marketing/TestimonialsSection";

// ── WhatsApp links ─────────────────────────────────────────────────────────────

const REQUEST_PRICING_WA = buildWhatsAppUrl(
  "Hello SSAMENJ Technologies, I would like to ask about pricing for School Connect.",
);
const ENTERPRISE_WA = buildWhatsAppUrl(
  "Hello SSAMENJ Technologies! I would like a custom quote for a school above 2,000 students.",
);
const SETUP_WA = buildWhatsAppUrl(
  "Hello SSAMENJ Technologies! I would like to discuss setup and onboarding for School Connect.",
);
const BOOK_DEMO_WA = buildWhatsAppUrl(
  "Hello SSAMENJ Technologies! I would like to book a demo for School Connect.",
);

function planWA(range: string) {
  return buildWhatsAppUrl(
    `Hello SSAMENJ Technologies! I would like to get started with School Connect for ${range}.`,
  );
}
function creditWA(pack: string) {
  return buildWhatsAppUrl(
    `Hello SSAMENJ Technologies! I would like to get the ${pack} Smart Pages credit pack.`,
  );
}

// ── Badge ──────────────────────────────────────────────────────────────────────

function Badge({
  children,
  tone = "blue",
}: {
  children: ReactNode;
  tone?: "blue" | "emerald" | "amber" | "slate";
}) {
  const toneClass =
    tone === "emerald"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : tone === "amber"
        ? "border-amber-200 bg-amber-50 text-amber-700"
        : tone === "slate"
          ? "border-slate-200 bg-slate-50 text-slate-700"
          : "border-blue-200 bg-blue-50 text-blue-700";
  return (
    <span className={`inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] ${toneClass}`}>
      {children}
    </span>
  );
}

// ── Annual Plan Card ───────────────────────────────────────────────────────────

function AnnualPlanCard({
  range,
  annualPrice,
  setupFee,
  href,
  highlighted = false,
  isCustom = false,
}: {
  range: string;
  annualPrice?: string;
  setupFee?: string;
  href: string;
  highlighted?: boolean;
  isCustom?: boolean;
}) {
  return (
    <article
      className={[
        "group relative flex flex-col overflow-hidden rounded-2xl border bg-white shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-xl",
        highlighted ? "border-blue-300 ring-1 ring-blue-200" : "border-slate-200 hover:border-blue-200",
      ].join(" ")}
    >
      <div
        className={`h-1 w-full ${highlighted ? "bg-gradient-to-r from-blue-600 via-sky-400 to-cyan-300" : "bg-gradient-to-r from-slate-200 via-blue-100 to-slate-200"}`}
      />
      {highlighted && (
        <div className="pointer-events-none absolute -right-8 top-4 h-24 w-24 rounded-full bg-blue-50/60 blur-2xl" />
      )}

      <div className="flex flex-1 flex-col p-5">
        {highlighted && (
          <div className="mb-3">
            <Badge tone="emerald">Most Popular</Badge>
          </div>
        )}

        <p className="text-[11px] font-black uppercase tracking-[0.2em] text-blue-700">{range}</p>

        {isCustom ? (
          <div className="mt-3 flex-1">
            <p className="text-2xl font-black text-slate-950">Custom Quote</p>
            <p className="mt-1.5 text-xs leading-5 text-slate-500">
              Contact us for pricing for schools above 2,000 students. We&apos;ll configure the right package for your institution.
            </p>
          </div>
        ) : (
          <div className="mt-3 flex-1">
            {/* Annual license — prominent */}
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Annual License</p>
              <div className="mt-1 flex items-baseline gap-1">
                <span className="text-xs font-bold text-slate-500">UGX</span>
                <span className="text-3xl font-black tracking-tight text-slate-950">{annualPrice}</span>
                <span className="text-sm font-bold text-slate-400">/ yr</span>
              </div>
            </div>

            {/* Setup fee — secondary */}
            <div className="mt-3 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">One-time Setup Fee</p>
              <p className="mt-0.5 text-sm font-black text-slate-700">UGX {setupFee}</p>
            </div>
          </div>
        )}

        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          className={[
            "btn marketing-button-motion mt-5 w-full rounded-xl px-4 py-2.5 text-center text-sm font-black",
            highlighted
              ? "bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-600/20 hover:opacity-95"
              : "border border-blue-200 bg-white text-blue-700 hover:bg-blue-50",
          ].join(" ")}
        >
          {isCustom ? "Request Custom Quote" : "Get Started"}
        </a>
      </div>
    </article>
  );
}

// ── Credit Pack Card ───────────────────────────────────────────────────────────

function CreditPackCard({
  name,
  credits,
  price,
  isFree = false,
  cta,
  href,
}: {
  name: string;
  credits: string;
  price: string;
  isFree?: boolean;
  cta: string;
  href: string;
}) {
  return (
    <article className="group relative flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-lg">
      <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-blue-200 via-sky-300 to-blue-200" />

      <div className="mb-3 flex items-start justify-between">
        <div
          className="flex h-9 w-9 items-center justify-center rounded-xl"
          style={{ background: isFree ? "#DCFCE7" : "#EAF3FF", color: isFree ? "#16A34A" : "#0F5BD8" }}
        >
          <CreditIcon className="h-4 w-4" />
        </div>
        {isFree && (
          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
            Free
          </span>
        )}
      </div>

      <h3 className="text-base font-black text-slate-950">{name}</h3>
      <p className="mt-1 text-sm font-bold text-blue-700">{credits}</p>
      <p className="mt-1 text-xs text-slate-400">{isFree ? "No payment required" : price}</p>

      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        className="btn mt-4 w-full rounded-xl border border-blue-200 bg-white px-4 py-2 text-center text-xs font-black text-blue-700 hover:bg-blue-50"
      >
        {cta}
      </a>
    </article>
  );
}

// ── InfoCard ───────────────────────────────────────────────────────────────────

function InfoCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-xl">
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-blue-600 via-sky-400 to-cyan-300" />
      <h3 className="text-sm font-black text-slate-950">{title}</h3>
      <p className="mt-1.5 text-xs leading-5 text-slate-600">{body}</p>
    </div>
  );
}

// ── Included features & add-ons ────────────────────────────────────────────────

const INCLUDED_FEATURES = [
  "Marks upload / import tool",
  "Automatic report generation",
  "Smart Pages document tools",
  "Print and download reports in bulk",
  "Secure parent report links",
  "Administrative Release Center",
  "QR / reference verification system",
  "Official school branding integrated",
  "Basic onboarding & setup support",
];

const OPTIONAL_ADDONS = [
  "SMS or WhatsApp delivery costs",
  "Custom report template design",
  "Custom Smart Pages templates",
  "Website or parent portal integration",
  "Onsite training for teaching staff",
  "Historical data migration",
  "Dedicated premium support package",
];

// ── Plans ──────────────────────────────────────────────────────────────────────

const PLANS = [
  { range: "Up to 500 Students",   annualPrice: "300,000",   setupFee: "500,000" },
  { range: "Up to 1,000 Students", annualPrice: "600,000",   setupFee: "500,000", highlighted: true },
  { range: "Up to 1,500 Students", annualPrice: "900,000",   setupFee: "1,000,000" },
  { range: "Up to 2,000 Students", annualPrice: "1,200,000", setupFee: "1,000,000" },
];

// ── Page ───────────────────────────────────────────────────────────────────────

export function PricingPage() {
  return (
    <div className="bg-slate-50 text-slate-950">
      <main>
        {/* Slim launch offer strip */}
        <div
          className="border-b px-4 py-2 text-center text-[11px] leading-5 text-white"
          style={{ background: "#0B2F6B", borderColor: "rgba(255,255,255,0.1)" }}
        >
          <span className="font-black text-amber-300">Launch Offer:</span>{" "}
          <span className="font-medium text-white/90">First Term Free — setup fee applies. Annual license is billed yearly. Smart Pages trial includes 10 pages.</span>
        </div>

        {/* ── Hero ── */}
        <section className="site-hero site-hero-compact border-b border-blue-100 px-4 sm:px-6 lg:px-8">
          <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-12 lg:items-start">
            <div className="lg:col-span-7">
              <Badge>Pricing</Badge>
              <h1 className="mt-3 hero-title font-black text-slate-950">
                Annual pricing for School Connect Report Lab &amp; Smart Pages.
              </h1>
              <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600">
                One annual license covers both Report Lab and Smart Pages for your entire school.
                Choose the plan that fits your student count. Setup is a one-time fee paid during onboarding.
              </p>
              <p className="mt-2 text-sm font-semibold text-blue-700">
                Annual license is billed yearly. Setup fee is paid once during onboarding.
              </p>
              <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                <a
                  href={REQUEST_PRICING_WA}
                  target="_blank"
                  rel="noreferrer"
                  className="btn marketing-button-motion rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 px-4 py-3 text-center text-sm font-black text-white shadow-lg shadow-blue-600/20 hover:shadow-xl hover:shadow-blue-600/25"
                >
                  Ask About Pricing
                </a>
                <Link
                  to="/demos"
                  className="btn marketing-button-motion rounded-xl border border-blue-200 bg-white px-4 py-3 text-center text-sm font-bold text-blue-700 shadow-sm hover:bg-blue-50"
                >
                  Watch Demo
                </Link>
              </div>
            </div>

            <div className="lg:col-span-5">
              <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
                <div className="marketing-card-motion marketing-fade-up-delay-1 rounded-[1.5rem] border border-slate-200 bg-white p-3.5 shadow-sm">
                  <p className="text-[11px] font-black uppercase tracking-[0.18em] text-blue-700">Annual License</p>
                  <p className="mt-1.5 text-xs leading-5 text-slate-600">
                    One license per year covers your full school — no per-user or per-term fees.
                  </p>
                </div>
                <div className="marketing-card-motion marketing-fade-up-delay-2 rounded-[1.5rem] border border-slate-200 bg-white p-3.5 shadow-sm">
                  <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Report Lab</p>
                  <p className="mt-1.5 text-xs leading-5 text-slate-600">
                    Generate, review, and share professional student reports from marksheets.
                  </p>
                </div>
                <div className="marketing-card-motion marketing-fade-up-delay-3 rounded-[1.5rem] border border-blue-200 bg-blue-50 p-3.5 shadow-sm">
                  <p className="text-[11px] font-black uppercase tracking-[0.18em] text-blue-700">Smart Pages</p>
                  <p className="mt-1.5 text-xs leading-5 text-slate-600">
                    Upload documents and turn them into clean, digital, print-ready pages.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Annual Plans ── */}
        <section id="plans" className="border-b border-slate-200 bg-white px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <div className="mx-auto max-w-7xl">
            <div className="mb-6">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-700">Annual Plans</p>
              <h2 className="mt-1.5 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">
                School Connect Report Lab + Smart Pages
              </h2>
              <p className="mt-2 text-sm text-slate-500">
                All plans include both Report Lab and Smart Pages. Billed annually. Setup fee is one-time.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {PLANS.map((plan) => (
                <AnnualPlanCard
                  key={plan.range}
                  range={plan.range}
                  annualPrice={plan.annualPrice}
                  setupFee={plan.setupFee}
                  href={planWA(plan.range)}
                  highlighted={plan.highlighted}
                />
              ))}
            </div>

            {/* Above 2,000 students — custom */}
            <div className="mt-4">
              <AnnualPlanCard
                range="Above 2,000 Students"
                href={ENTERPRISE_WA}
                isCustom
              />
            </div>

            <p className="mt-4 text-xs text-slate-400">
              Annual license is billed yearly. Setup fee is a one-time payment made during onboarding.
            </p>
          </div>
        </section>

        {/* ── What's Included ── */}
        <section className="border-b border-slate-200 bg-slate-50 px-4 py-6 sm:px-6 lg:px-8 lg:py-7">
          <div className="mx-auto max-w-7xl">
            <div className="grid gap-8 lg:grid-cols-2">
              {/* Included in every plan */}
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-700">Every Plan Includes</p>
                <h2 className="mt-1.5 text-xl font-black tracking-tight text-slate-950">
                  Full access. No hidden extras.
                </h2>
                <ul className="mt-4 space-y-2.5">
                  {INCLUDED_FEATURES.map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-sm text-slate-700">
                      <CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Optional add-ons */}
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Optional Add-ons</p>
                <h2 className="mt-1.5 text-xl font-black tracking-tight text-slate-950">
                  Extend as your school grows.
                </h2>
                <ul className="mt-4 space-y-2.5">
                  {OPTIONAL_ADDONS.map((a) => (
                    <li key={a} className="flex items-start gap-2.5 text-sm text-slate-600">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-300" />
                      {a}
                    </li>
                  ))}
                </ul>
                <a
                  href={REQUEST_PRICING_WA}
                  target="_blank"
                  rel="noreferrer"
                  className="btn marketing-button-motion mt-5 inline-flex rounded-xl border border-blue-200 bg-white px-4 py-2.5 text-sm font-bold text-blue-700 shadow-sm hover:bg-blue-50"
                >
                  Ask about add-ons
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* ── Smart Pages Credit Packs ── */}
        <section id="credits" className="border-b border-slate-200 bg-white px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <div className="mx-auto max-w-7xl">
            <div className="mb-6">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-700">Smart Pages</p>
              <h2 className="mt-1.5 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">
                Credit Packs
              </h2>
              <p className="mt-2 text-sm text-slate-500">
                Smart Pages uses a credit system. Buy credits as needed — they don&apos;t expire.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <CreditPackCard
                name="Trial"
                credits="20 credits"
                price="Free"
                isFree
                cta="Start Free Trial"
                href={creditWA("Trial (20 credits free)")}
              />
              <CreditPackCard
                name="Starter"
                credits="100 credits"
                price="UGX 50,000"
                cta="Buy Starter Pack"
                href={creditWA("Starter (100 credits)")}
              />
              <CreditPackCard
                name="Standard"
                credits="500 credits"
                price="UGX 225,000"
                cta="Buy Standard Pack"
                href={creditWA("Standard (500 credits)")}
              />
              <CreditPackCard
                name="School Pro"
                credits="1,000 credits"
                price="UGX 400,000"
                cta="Buy School Pro Pack"
                href={creditWA("School Pro (1,000 credits)")}
              />
            </div>

            {/* Credit usage */}
            <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-5 shadow-sm">
              <div className="mb-4 flex items-center gap-2">
                <DocumentIcon className="h-4 w-4 text-blue-600" />
                <h3 className="text-sm font-black text-slate-950">Credit Usage</h3>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  { action: "Normal extraction",       cost: "1 credit / page",     note: "Standard document reading" },
                  { action: "High accuracy extraction", cost: "2 credits / page",    note: "For complex or handwritten docs" },
                  { action: "Generate clean document",  cost: "+1 credit / output",  note: "Per output page generated" },
                  { action: "Publish / share document", cost: "+1 credit / document", note: "Per published document" },
                ].map((row) => (
                  <div key={row.action} className="rounded-xl border border-slate-200 bg-white p-3.5">
                    <p className="text-xs font-bold text-slate-950">{row.action}</p>
                    <p className="mt-1 text-sm font-black text-blue-700">{row.cost}</p>
                    <p className="mt-1 text-[11px] text-slate-400">{row.note}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── Setup & Onboarding ── */}
        <section id="setup" className="border-b border-slate-200 bg-slate-50 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <div className="mx-auto max-w-7xl">
            <div className="mb-5">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-700">Setup &amp; Onboarding</p>
              <h2 className="mt-1.5 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">
                Getting your school started
              </h2>
              <p className="mt-2 text-sm text-slate-500">
                Setup fees are one-time and vary by school size. They are paid once during onboarding and never again.
              </p>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-start gap-3">
                  <WrenchIcon className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" />
                  <div>
                    <h3 className="text-base font-black text-slate-950">What Setup Covers</h3>
                    <p className="mt-1.5 text-sm text-slate-600">
                      Covers school configuration, branding, user account setup, and a guided onboarding session for your staff.
                    </p>
                    <ul className="mt-3 space-y-1.5">
                      {[
                        "School profile and branding setup",
                        "Staff accounts and roles",
                        "Initial student and class configuration",
                        "Guided walkthrough for report generation",
                        "Document upload and Smart Pages setup",
                      ].map((item) => (
                        <li key={item} className="flex items-start gap-2 text-xs text-slate-600">
                          <CheckIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-blue-600" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
                <a
                  href={SETUP_WA}
                  target="_blank"
                  rel="noreferrer"
                  className="btn marketing-button-motion mt-5 w-full rounded-xl border border-blue-200 bg-white px-4 py-2.5 text-center text-sm font-black text-blue-700 hover:bg-blue-50"
                >
                  Request Setup
                </a>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="text-base font-black text-slate-950">Setup Fees by School Size</h3>
                <p className="mt-1 text-xs text-slate-500">One-time fee — paid once during onboarding.</p>
                <div className="mt-4 space-y-2">
                  {[
                    { range: "Up to 500 students",   fee: "UGX 500,000" },
                    { range: "Up to 1,000 students",  fee: "UGX 500,000" },
                    { range: "Up to 1,500 students",  fee: "UGX 1,000,000" },
                    { range: "Up to 2,000 students",  fee: "UGX 1,000,000" },
                    { range: "Above 2,000 students",  fee: "Custom" },
                  ].map((row) => (
                    <div key={row.range} className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-4 py-2.5">
                      <span className="text-xs font-semibold text-slate-600">{row.range}</span>
                      <span className="text-sm font-black text-slate-950">{row.fee}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── FAQ ── */}
        <section className="border-b border-slate-200 bg-white px-4 py-6 sm:px-6 lg:px-8 lg:py-7">
          <div className="mx-auto max-w-4xl">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-700">FAQ</p>
            <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-950">Common pricing questions</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <InfoCard
                title="Is this monthly or yearly pricing?"
                body="All School Connect plans are annual — billed once per year. There are no monthly subscriptions or per-term fees."
              />
              <InfoCard
                title="What does the setup fee cover?"
                body="The setup fee is a one-time cost paid during onboarding. It covers school branding, staff setup, student configuration, and a guided onboarding session."
              />
              <InfoCard
                title="Can we start with Report Lab only?"
                body="Yes. A school can start with Report Lab and add Smart Pages credits as needed. The annual plan includes access to both products."
              />
              <InfoCard
                title="Can we use Smart Pages without Report Lab?"
                body="Yes. Smart Pages can be used on its own with a credit pack. Buy credits as you need them — they don't expire."
              />
              <InfoCard
                title="What if our school has more than 2,000 students?"
                body="Contact us for a custom quote. We'll configure the right package and pricing for larger institutions and school groups."
              />
              <InfoCard
                title="Do Smart Pages credits expire?"
                body="No. Smart Pages credits don't have an expiry date once purchased. Use them at your own pace."
              />
            </div>
          </div>
        </section>

        <TestimonialsSection className="bg-slate-50 px-4 py-6 sm:px-6 lg:px-8 lg:py-7" compact />

        {/* ── Final CTA ── */}
        <section className="border-t border-slate-200 bg-blue-50/40 px-4 py-6 sm:px-6 lg:px-8 lg:py-7">
          <div className="mx-auto max-w-7xl rounded-[2rem] border border-blue-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="grid gap-5 lg:grid-cols-12 lg:items-center">
              <div className="lg:col-span-8">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-700">Ready to get started?</p>
                <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">
                  Get your school set up on School Connect this year.
                </h2>
                <p className="mt-2 text-sm text-slate-500">
                  Annual license. One-time setup. Everything your school needs to generate reports and manage documents.
                </p>
              </div>
              <div id="contact" className="grid gap-3 lg:col-span-4">
                <a
                  href={BOOK_DEMO_WA}
                  target="_blank"
                  rel="noreferrer"
                  className="btn marketing-button-motion rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 px-4 py-3 text-center text-sm font-black text-white shadow-lg shadow-blue-600/20 hover:shadow-xl hover:shadow-blue-600/25"
                >
                  Book a Demo
                </a>
                <a
                  href={REQUEST_PRICING_WA}
                  target="_blank"
                  rel="noreferrer"
                  className="btn marketing-button-motion rounded-xl border border-blue-200 bg-white px-4 py-3 text-center text-sm font-bold text-blue-700 shadow-sm hover:bg-blue-50"
                >
                  Request Pricing on WhatsApp
                </a>
              </div>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3.5">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Billing</p>
                <p className="mt-1.5 text-sm font-semibold text-slate-950">Annual license billed once per year</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3.5">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">WhatsApp</p>
                <p className="mt-1.5 text-sm font-semibold text-slate-950">{WHATSAPP_DISPLAY}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3.5">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Setup</p>
                <p className="mt-1.5 text-sm font-semibold text-slate-950">One-time fee during onboarding</p>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
