import { Link } from "react-router-dom";
import type { ReactNode } from "react";
import { buildWhatsAppUrl } from "../config/contact";
import { CheckIcon, SchoolIcon } from "../components/marketing/Icons";
import { TestimonialsSection } from "../components/marketing/TestimonialsSection";

const BOOK_DEMO_URL = buildWhatsAppUrl(
  "Hello SSAMENJ Technologies! I would like to ask about pricing.",
);

function Badge({
  children,
  tone = "blue",
}: {
  children: ReactNode;
  tone?: "blue" | "emerald" | "slate";
}) {
  const toneClass =
    tone === "emerald"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : tone === "slate"
        ? "border-slate-200 bg-slate-50 text-slate-700"
        : "border-blue-200 bg-blue-50 text-blue-700";

  return <span className={`inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] ${toneClass}`}>{children}</span>;
}

function PricingCard({
  title,
  badge,
  description,
  items,
  cta,
  href,
  highlighted = false,
}: {
  title: string;
  badge: string;
  description: string;
  items: string[];
  cta: string;
  href: string;
  highlighted?: boolean;
}) {
  return (
    <article className={`group relative overflow-hidden rounded-2xl border bg-white p-4 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-xl ${highlighted ? "border-blue-200 bg-blue-50/40 ring-1 ring-blue-200" : "border-slate-200"}`}>
      <div className={`absolute inset-x-0 top-0 h-1 ${highlighted ? "bg-gradient-to-r from-blue-600 via-sky-400 to-cyan-300" : "bg-gradient-to-r from-slate-300 via-blue-200 to-cyan-100"}`} />
      <div className="absolute -right-10 top-6 h-24 w-24 rounded-full bg-blue-50/70 blur-3xl transition duration-200 group-hover:bg-blue-100/80" />
      <div className="relative">
        <Badge tone={highlighted ? "emerald" : "blue"}>{badge}</Badge>
        <h3 className="mt-3 text-2xl font-black tracking-tight text-slate-950">{title}</h3>
        <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
      </div>
      <ul className="mt-4 grid gap-2 text-sm text-slate-700">
        {items.map((item) => (
          <li key={item} className="flex items-start gap-2">
            <CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-blue-700" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
      <a href={href} target="_blank" rel="noreferrer" className={`btn marketing-button-motion mt-5 inline-flex w-full rounded-2xl px-4 py-3 text-sm font-black ${highlighted ? "bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-600/20 hover:shadow-xl hover:shadow-blue-600/25" : "border border-blue-200 bg-white text-blue-700 shadow-sm hover:bg-blue-50"}`}>
        {cta}
      </a>
    </article>
  );
}

function InfoCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-xl">
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-blue-600 via-sky-400 to-cyan-300" />
      <div className="absolute -right-10 top-6 h-24 w-24 rounded-full bg-blue-50/70 blur-3xl transition duration-200 group-hover:bg-blue-100/80" />
      <h3 className="text-base font-black text-slate-950">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-600">{body}</p>
    </div>
  );
}

export function PricingPage() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <section className="border-b border-blue-100 bg-gradient-to-br from-white via-blue-50 to-slate-50 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-12 lg:items-center">
          <div className="lg:col-span-7">
            <Badge>Pricing</Badge>
            <h1 className="mt-3 max-w-3xl text-4xl font-black tracking-tight text-slate-950 sm:text-5xl">
              First term free for early onboarding schools.
            </h1>
            <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600">
              Start with one free academic term, then choose the plan that matches your school size and workflow.
            </p>

            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              <a href={BOOK_DEMO_URL} target="_blank" rel="noreferrer" className="btn marketing-button-motion rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 px-4 py-3 text-sm font-black text-white shadow-lg shadow-blue-600/20 hover:shadow-xl hover:shadow-blue-600/25">
                Request pricing
              </a>
              <Link to="/demos" className="btn marketing-button-motion rounded-xl border border-blue-200 bg-white px-4 py-3 text-sm font-bold text-blue-700 shadow-sm hover:bg-blue-50">
                View demos
              </Link>
            </div>
          </div>

          <div className="lg:col-span-5">
            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
              <div className="rounded-2xl border border-blue-200 bg-white p-3.5 shadow-sm">
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-blue-700">Launch offer</p>
                <p className="mt-1.5 text-xs leading-5 text-slate-600">One academic term at no subscription cost for early onboarding schools.</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm">
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Setup</p>
                <p className="mt-1.5 text-xs leading-5 text-slate-600">Standard setup can be waived for early onboarding and multi-term commitment.</p>
              </div>
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3.5 shadow-sm">
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-emerald-700">Included support</p>
                <p className="mt-1.5 text-xs leading-5 text-slate-600">Demo guidance, package advice, and setup support after the call.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-slate-200 bg-white px-4 py-6 sm:px-6 lg:px-8 lg:py-7">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-3 lg:grid-cols-3">
            <PricingCard
              title="First Term Free"
              badge="Launch offer"
              description="For early onboarding schools, multi-term commitment, or annual upfront payment."
              items={["Standard setup can be waived", "One academic term at no subscription cost", "Works with Report Lab and Smart Pages"]}
              cta="Start onboarding"
              href={BOOK_DEMO_URL}
              highlighted
            />
            <PricingCard
              title="Starter School"
              badge="UGX 350,000 / term"
              description="For schools up to 300 students."
              items={["Simple term pricing", "Fits smaller school teams", "Includes onboarding guidance"]}
              cta="Ask about Starter"
              href={BOOK_DEMO_URL}
            />
            <PricingCard
              title="Standard School"
              badge="UGX 750,000 / term"
              description="For schools with 301 to 800 students."
              items={["Balanced for growing schools", "Works with core Report Lab workflows", "Supports school setup planning"]}
              cta="Ask about Standard"
              href={BOOK_DEMO_URL}
            />
          </div>

          <div className="mt-3 grid gap-3 lg:grid-cols-2">
            <PricingCard
              title="Pro School"
              badge="UGX 1,500,000 / term"
              description="For large schools with 800+ students."
              items={["Large-school pricing", "Structured for bigger operations", "Built for scale and support"]}
              cta="Ask about Pro"
              href={BOOK_DEMO_URL}
            />
            <PricingCard
              title="Enterprise / Large Institutions"
              badge="Custom pricing"
              description="For multi-campus schools, groups, and institutions needing custom workflows."
              items={["Custom setup", "Tailored workflow design", "Integration planning"]}
              cta="Contact us"
              href="/contact"
            />
          </div>

          <div className="mt-6">
            <div className="max-w-2xl">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-700">Smart Pages credit packs</p>
              <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-950">Credits are separate from school term pricing.</h2>
            </div>
            <div className="mt-3 grid gap-3 lg:grid-cols-4">
              <InfoCard title="Trial" body="20 credits free" />
              <InfoCard title="Starter" body="100 credits - UGX 50,000" />
              <InfoCard title="Standard" body="500 credits - UGX 225,000" />
              <InfoCard title="School Pro" body="1,000 credits - UGX 400,000" />
            </div>
          </div>

          <div className="mt-6 rounded-[2rem] border border-slate-200 bg-slate-50 p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-2xl bg-blue-50 text-blue-700">
                <SchoolIcon className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-2xl font-black tracking-tight text-slate-950">Usage guide</h3>
                <p className="text-sm leading-6 text-slate-600">
                  Pricing stays simple and predictable for schools while Smart Pages credits are consumed by use.
                </p>
              </div>
            </div>
            <ul className="mt-4 grid gap-2 text-sm text-slate-700">
              <li className="flex items-start gap-2"><CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-blue-700" />Normal document extraction: 1 credit per page</li>
              <li className="flex items-start gap-2"><CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-blue-700" />High accuracy extraction: 2 credits per page</li>
              <li className="flex items-start gap-2"><CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-blue-700" />Generate clean document: +1 credit per output page</li>
              <li className="flex items-start gap-2"><CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-blue-700" />Publish or share secure document: +1 credit per document</li>
              <li className="flex items-start gap-2"><CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-blue-700" />Standard setup: UGX 250,000</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="border-b border-slate-200 bg-slate-50 px-4 py-6 sm:px-6 lg:px-8 lg:py-7">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-2xl">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-700">Add-ons</p>
            <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-950">Add the support your school needs.</h2>
          </div>
          <div className="mt-3 grid gap-3 lg:grid-cols-4">
            <InfoCard title="School branding setup" body="Logo, colors, report header, footer, and school identity setup." />
            <InfoCard title="Data import support" body="Help moving existing students, marks, and school records into the system." />
            <InfoCard title="Parent delivery setup" body="Support for sharing reports and documents with parents using secure links." />
            <InfoCard title="Custom workflows" body="Extra setup for schools with unique approval or document processes." />
          </div>
        </div>
      </section>

      <section className="border-b border-slate-200 bg-white px-4 py-6 sm:px-6 lg:px-8 lg:py-7">
        <div className="mx-auto max-w-4xl">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-700">FAQ</p>
          <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-950">Common pricing questions</h2>
          <div className="mt-3 grid gap-3">
            <InfoCard title="Can we start with Report Lab only?" body="Yes. A school can start with Report Lab and add Smart Pages or other School Connect tools later." />
            <InfoCard title="Can we use Smart Pages without Report Lab?" body="Yes. Smart Pages can be used as a document workflow product on its own." />
            <InfoCard title="Do you charge by students or by school?" body="Pricing can depend on school size, number of users, selected products, and setup requirements." />
            <InfoCard title="Is setup included?" body="Basic onboarding is included. Larger data imports, custom branding, or special workflows may require additional setup support." />
            <InfoCard title="Can we try the system first?" body="Yes. Schools can watch the demo and request a guided walkthrough before choosing a package." />
          </div>
        </div>
      </section>

      <TestimonialsSection className="bg-slate-50 px-4 py-6 sm:px-6 lg:px-8 lg:py-7" compact />

      <section className="border-t border-slate-200 bg-blue-50/40 px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl rounded-[2rem] border border-blue-200 bg-white p-6 shadow-sm sm:p-7">
          <div className="grid gap-6 lg:grid-cols-12 lg:items-center">
            <div className="lg:col-span-8">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-700">Ready to choose the right package?</p>
              <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-950">
                Book a short demo and we&apos;ll recommend the best School Connect setup for your school.
              </h2>
            </div>
            <div className="grid gap-3 lg:col-span-4 lg:items-end">
              <a href={BOOK_DEMO_URL} target="_blank" rel="noreferrer" className="btn marketing-button-motion rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 px-4 py-3 text-center text-sm font-black text-white shadow-lg shadow-blue-600/20 hover:shadow-xl hover:shadow-blue-600/25">
                Request pricing on WhatsApp
              </a>
              <Link to="/demos" className="btn marketing-button-motion rounded-xl border border-blue-200 bg-white px-4 py-3 text-sm font-bold text-blue-700 shadow-sm hover:bg-blue-50">
                Watch demo
              </Link>
            </div>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3.5">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Direct line</p>
              <p className="mt-2 text-sm font-semibold text-slate-950">Fast replies on WhatsApp</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3.5">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">WhatsApp</p>
              <p className="mt-2 text-sm font-semibold text-slate-950">+971 56 370 4103</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3.5">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Support level</p>
              <p className="mt-2 text-sm font-semibold text-slate-950">Matched after the demo call</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
