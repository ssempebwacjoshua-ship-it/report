import { Link } from "react-router-dom";
import type { ReactNode } from "react";
import { buildWhatsAppUrl, WHATSAPP_DISPLAY } from "../config/contact";
import {
  CheckIcon,
  CreditIcon,
  DocumentIcon,
  GiftIcon,
  WrenchIcon,
} from "../components/marketing/Icons";
import { TestimonialsSection } from "../components/marketing/TestimonialsSection";

// ── WhatsApp links ────────────────────────────────────────────────────────────

const GET_STARTED_WA = buildWhatsAppUrl(
  "Hello SSAMENJ Technologies! I would like to get started with the First Term Free offer for my school.",
);
const REQUEST_PRICING_WA = buildWhatsAppUrl(
  "Hello SSAMENJ Technologies, I would like to ask about pricing for School Connect.",
);
const ENTERPRISE_WA = buildWhatsAppUrl(
  "Hello SSAMENJ Technologies! I would like to discuss enterprise / custom pricing for my institution.",
);
const SETUP_WA = buildWhatsAppUrl(
  "Hello SSAMENJ Technologies! I would like to discuss setup and onboarding for School Connect.",
);

function planWA(plan: string) {
  return buildWhatsAppUrl(
    `Hello SSAMENJ Technologies! I would like to get started with the ${plan} plan.`,
  );
}
function creditWA(pack: string) {
  return buildWhatsAppUrl(
    `Hello SSAMENJ Technologies! I would like to get the ${pack} Smart Pages credit pack.`,
  );
}

// ── Badge ──────────────────���─────────────────────────────────��────────────────

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

// ── School Plan Card ────────────────��─────────────────────────────────────────

function SchoolPlanCard({
  title,
  price,
  range,
  features,
  cta,
  href,
  highlighted = false,
  isCustom = false,
}: {
  title: string;
  price: string;
  range: string;
  features: string[];
  cta: string;
  href: string;
  highlighted?: boolean;
  isCustom?: boolean;
}) {
  return (
    <article
      className={[
        "group relative flex flex-col overflow-hidden rounded-2xl border bg-white p-5 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-xl",
        highlighted ? "border-blue-300 ring-1 ring-blue-200" : "border-slate-200 hover:border-blue-200",
      ].join(" ")}
    >
      <div
        className={`absolute inset-x-0 top-0 h-1 ${highlighted ? "bg-gradient-to-r from-blue-600 via-sky-400 to-cyan-300" : "bg-gradient-to-r from-slate-200 via-blue-100 to-slate-200"}`}
      />
      {highlighted && (
        <div className="absolute -right-8 top-4 h-20 w-20 rounded-full bg-blue-50/60 blur-2xl" />
      )}

      <div className="relative flex-1">
        {highlighted && (
          <div className="mb-2">
            <Badge tone="emerald">Most Popular</Badge>
          </div>
        )}
        <h3 className="text-lg font-black tracking-tight text-slate-950">{title}</h3>
        <p className="mt-1 text-xs text-slate-500">{range}</p>

        <div className="mt-4">
          {isCustom ? (
            <div className="text-2xl font-black text-slate-950">Custom pricing</div>
          ) : (
            <>
              <div className="flex items-baseline gap-1">
                <span className="text-xs font-bold text-slate-500">UGX</span>
                <span className="text-3xl font-black tracking-tight text-slate-950">{price}</span>
              </div>
              <span className="mt-0.5 block text-xs text-slate-400">per term</span>
            </>
          )}
        </div>

        <ul className="mt-4 space-y-1.5">
          {features.map((f) => (
            <li key={f} className="flex items-start gap-2 text-xs text-slate-600">
              <CheckIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-blue-600" />
              {f}
            </li>
          ))}
        </ul>
      </div>

      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        className={[
          "btn marketing-button-motion mt-5 w-full rounded-xl px-4 py-2.5 text-center text-sm font-black",
          highlighted
            ? "bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-600/20"
            : "border border-blue-200 bg-white text-blue-700 hover:bg-blue-50",
        ].join(" ")}
      >
        {cta}
      </a>
    </article>
  );
}

// ── Credit Pack Card ──────────────────��───────────────────────────���───────────

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

// ── InfoCard ─────────��────────────────────────────���───────────────────────────

function InfoCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-xl">
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-blue-600 via-sky-400 to-cyan-300" />
      <h3 className="text-sm font-black text-slate-950">{title}</h3>
      <p className="mt-1.5 text-xs leading-5 text-slate-600">{body}</p>
    </div>
  );
}

// ── Page ───────────��──────────────────────────────────────────────────────────

export function PricingPage() {
  return (
    <div className="bg-slate-50 text-slate-950">
      {/* ── Launch offer banner ── */}
      <div
        className="border-b px-4 py-2.5 text-center sm:px-6 lg:px-8"
        style={{ background: "linear-gradient(90deg, #065F46, #047857)", borderColor: "#064E3B" }}
      >
        <p className="flex items-center justify-center gap-2 text-xs font-bold text-white">
          <GiftIcon className="h-3.5 w-3.5 shrink-0" />
          🎉 Temporary Launch Offer — First Term Free for early onboarding schools.
          <a
            href={GET_STARTED_WA}
            target="_blank"
            rel="noreferrer"
            className="ml-1 whitespace-nowrap underline underline-offset-2 hover:no-underline"
          >
            Claim offer →
          </a>
        </p>
      </div>

      <main>
        {/* ── Hero ── */}
        <section className="site-hero site-hero-compact border-b border-blue-100 px-4 sm:px-6 lg:px-8">
          <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-12 lg:items-start">
            <div className="lg:col-span-7">
              <Badge>Pricing</Badge>
              <h1 className="mt-3 hero-title font-black text-slate-950">
                Per-term pricing for Report Lab &amp; Smart Pages.
              </h1>
              <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600">
                Start using School Connect Report Lab and Smart Pages for one academic term at no
                subscription cost. After the free term, continue with the plan that fits your school
                size and workflow.
              </p>
              <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                <a
                  href={GET_STARTED_WA}
                  target="_blank"
                  rel="noreferrer"
                  className="btn marketing-button-motion rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 px-4 py-3 text-center text-sm font-black text-white shadow-lg shadow-blue-600/20 hover:shadow-xl hover:shadow-blue-600/25"
                >
                  Get Started Free
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
                <div
                  className="marketing-card-motion marketing-fade-up-delay-1 rounded-[1.5rem] border p-3.5 shadow-sm"
                  style={{ background: "#ECFDF5", borderColor: "#6EE7B7" }}
                >
                  <div className="mb-1.5 flex items-center gap-2">
                    <GiftIcon className="h-4 w-4 text-emerald-600" />
                    <p className="text-[11px] font-black uppercase tracking-[0.18em] text-emerald-700">Launch Offer</p>
                  </div>
                  <p className="text-xs leading-5 text-emerald-800">
                    First term free — no payment required for early onboarding schools.
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
                    Upload documents and turn them into clean, editable digital pages.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── School subscription plans ── */}
        <section id="plans" className="border-b border-slate-200 bg-white px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <div className="mx-auto max-w-7xl">
            <div className="mb-6">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-700">Subscription</p>
              <h2 className="mt-1.5 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">
                School Connect Report Lab + Smart Pages
              </h2>
              <p className="mt-2 text-sm text-slate-500">
                Per-term subscription — includes both Report Lab and Smart Pages. First term free for early onboarding schools.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <SchoolPlanCard
                title="Starter School"
                price="350,000"
                range="Up to 300 students"
                features={[
                  "School Connect Report Lab",
                  "Smart Pages (credit top-up separately)",
                  "Up to 300 student records",
                  "Marks upload and report generation",
                  "Secure parent report links",
                  "Standard school branding",
                  "Onboarding support",
                ]}
                cta="Get Starter Plan"
                href={planWA("Starter School")}
              />
              <SchoolPlanCard
                title="Standard School"
                price="750,000"
                range="301 to 800 students"
                features={[
                  "School Connect Report Lab",
                  "Smart Pages (credit top-up separately)",
                  "Up to 800 student records",
                  "Multi-class marks management",
                  "Secure parent report links",
                  "Full school branding setup",
                  "Priority onboarding support",
                ]}
                cta="Get Standard Plan"
                href={planWA("Standard School")}
                highlighted
              />
              <SchoolPlanCard
                title="Pro School"
                price="1,500,000"
                range="800+ students"
                features={[
                  "School Connect Report Lab",
                  "Smart Pages (credit top-up separately)",
                  "Unlimited student records",
                  "Multi-stream and multi-class support",
                  "Secure parent report links",
                  "Custom school branding",
                  "Priority support and onboarding",
                ]}
                cta="Get Pro Plan"
                href={planWA("Pro School")}
              />
            </div>

            {/* Enterprise — full width */}
            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <div className="grid gap-4 lg:grid-cols-12 lg:items-center">
                <div className="lg:col-span-8">
                  <Badge tone="slate">Enterprise / Large Institutions</Badge>
                  <h3 className="mt-2 text-xl font-black tracking-tight text-slate-950">
                    Custom pricing for multi-campus schools and groups
                  </h3>
                  <p className="mt-1.5 text-sm text-slate-600">
                    For large schools, school groups, multi-campus networks, and institutions that
                    need custom workflows, bulk pricing, or integration with existing systems.
                  </p>
                </div>
                <div className="flex flex-col gap-2 lg:col-span-4 lg:items-end">
                  <a
                    href={ENTERPRISE_WA}
                    target="_blank"
                    rel="noreferrer"
                    className="btn marketing-button-motion rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-center text-sm font-black text-slate-700 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                  >
                    Discuss Enterprise Pricing
                  </a>
                </div>
              </div>
            </div>

            <p className="mt-4 text-xs text-slate-400">
              All plans billed per academic term. Setup fee may apply — see below. First term free for early onboarding schools.
            </p>
          </div>
        </section>

        {/* ── Smart Pages credit packs ── */}
        <section id="credits" className="border-b border-slate-200 bg-slate-50 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
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

            {/* Credit usage table */}
            <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center gap-2">
                <DocumentIcon className="h-4 w-4 text-blue-600" />
                <h3 className="text-sm font-black text-slate-950">Credit Usage</h3>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  { action: "Normal extraction", cost: "1 credit per page", note: "Standard document reading" },
                  { action: "High accuracy extraction", cost: "2 credits per page", note: "For complex or handwritten docs" },
                  { action: "Generate clean document", cost: "+1 credit per output", note: "Per output page generated" },
                  { action: "Publish / share document", cost: "+1 credit per document", note: "Per published document" },
                ].map((row) => (
                  <div key={row.action} className="rounded-xl border border-slate-100 bg-slate-50 p-3.5">
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
        <section id="setup" className="border-b border-slate-200 bg-white px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <div className="mx-auto max-w-7xl">
            <div className="mb-5">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-700">Setup &amp; Onboarding</p>
              <h2 className="mt-1.5 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">
                Getting your school started
              </h2>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                <div className="flex items-start gap-3">
                  <WrenchIcon className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" />
                  <div>
                    <h3 className="text-base font-black text-slate-950">Standard Setup</h3>
                    <div className="mt-2 flex items-baseline gap-1">
                      <span className="text-xs font-bold text-slate-400">UGX</span>
                      <span className="text-3xl font-black text-slate-950">250,000</span>
                    </div>
                    <p className="mt-2 text-sm text-slate-600">
                      Covers school configuration, branding, user account setup, and a guided onboarding session for your staff.
                    </p>
                    <ul className="mt-3 space-y-1">
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

              <div
                className="rounded-2xl border p-5"
                style={{ background: "#ECFDF5", borderColor: "#A7F3D0" }}
              >
                <div className="mb-3 flex items-center gap-2">
                  <GiftIcon className="h-4 w-4 text-emerald-600" />
                  <h3 className="text-base font-black text-emerald-800">Setup can be waived</h3>
                </div>
                <p className="mb-3 text-sm leading-relaxed text-emerald-700">
                  The standard setup fee can be waived for qualifying schools under the launch offer.
                </p>
                <ul className="space-y-2">
                  {[
                    "Early onboarding schools (first term free offer)",
                    "Multi-term commitment upfront",
                    "Annual upfront payment",
                    "School groups or multi-campus onboarding",
                  ].map((c) => (
                    <li key={c} className="flex items-start gap-2 text-sm text-emerald-800">
                      <CheckIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
                      {c}
                    </li>
                  ))}
                </ul>
                <p className="mt-4 text-xs text-emerald-600">
                  Ask us about waiver eligibility when you reach out.
                </p>
                <a
                  href={GET_STARTED_WA}
                  target="_blank"
                  rel="noreferrer"
                  className="btn marketing-button-motion mt-4 inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-center text-sm font-black text-white"
                  style={{ background: "#059669" }}
                >
                  Claim Launch Offer
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* ── FAQ ── */}
        <section className="border-b border-slate-200 bg-slate-50 px-4 py-6 sm:px-6 lg:px-8 lg:py-7">
          <div className="mx-auto max-w-4xl">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-700">FAQ</p>
            <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-950">Common pricing questions</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <InfoCard
                title="Can we start with Report Lab only?"
                body="Yes. A school can start with Report Lab and add Smart Pages credits as needed. The plan includes access to both products."
              />
              <InfoCard
                title="Can we use Smart Pages without Report Lab?"
                body="Yes. Smart Pages can be used on its own with a credit pack. Buy credits as you need them."
              />
              <InfoCard
                title="How is the free term applied?"
                body="Early onboarding schools start at no subscription cost for the first academic term. After the term, you choose a plan that fits your school size."
              />
              <InfoCard
                title="What does the setup fee cover?"
                body="It covers school branding, staff account setup, initial configuration, and an onboarding session. It can be waived for qualifying schools."
              />
              <InfoCard
                title="Can we try before committing?"
                body="Yes. Schools can use the 20-credit free trial pack and watch the demo before choosing any plan."
              />
              <InfoCard
                title="Do credits expire?"
                body="No. Smart Pages credits don't have an expiry date once purchased."
              />
            </div>
          </div>
        </section>

        <TestimonialsSection className="bg-white px-4 py-6 sm:px-6 lg:px-8 lg:py-7" compact />

        {/* ── Final CTA ── */}
        <section className="border-t border-slate-200 bg-blue-50/40 px-4 py-6 sm:px-6 lg:px-8 lg:py-7">
          <div className="mx-auto max-w-7xl rounded-[2rem] border border-blue-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="grid gap-5 lg:grid-cols-12 lg:items-center">
              <div className="lg:col-span-8">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-700">Ready to get started?</p>
                <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">
                  Claim your first term free and configure Report Lab for your school.
                </h2>
              </div>
              <div id="contact" className="grid gap-3 lg:col-span-4">
                <a
                  href={GET_STARTED_WA}
                  target="_blank"
                  rel="noreferrer"
                  className="btn marketing-button-motion rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 px-4 py-3 text-center text-sm font-black text-white shadow-lg shadow-blue-600/20 hover:shadow-xl hover:shadow-blue-600/25"
                >
                  Get Started Free
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
                <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Launch offer</p>
                <p className="mt-1.5 text-sm font-semibold text-slate-950">First term free for early onboarding schools</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3.5">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">WhatsApp</p>
                <p className="mt-1.5 text-sm font-semibold text-slate-950">{WHATSAPP_DISPLAY}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3.5">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Setup</p>
                <p className="mt-1.5 text-sm font-semibold text-slate-950">Can be waived for qualifying schools</p>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
