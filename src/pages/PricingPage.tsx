import { type ReactNode, type SVGProps } from "react";
import { useNavigate } from "react-router-dom";
import { TestimonialsSection } from "../components/marketing/TestimonialsSection";

function Icon({ children, className, ...props }: SVGProps<SVGSVGElement> & { children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} {...props}>
      {children}
    </svg>
  );
}

function ArrowRightIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M5 12h14" />
      <path d="m13 5 7 7-7 7" />
    </Icon>
  );
}

function SchoolIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M3 10 12 4l9 6-9 6-9-6Z" />
      <path d="M6 11v6c0 1.1 2.7 2 6 2s6-.9 6-2v-6" />
      <path d="M12 10v9" />
    </Icon>
  );
}

function CheckIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="m20 6-11 11-5-5" />
    </Icon>
  );
}

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

  return (
    <span className={`inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] ${toneClass}`}>
      {children}
    </span>
  );
}

function PricingCard({
  title,
  badge,
  description,
  items,
  cta,
  highlighted = false,
}: {
  title: string;
  badge: string;
  description: string;
  items: string[];
  cta: string;
  highlighted?: boolean;
}) {
  return (
    <article
      className={[
        "rounded-[1.75rem] border bg-white p-5 shadow-sm",
        highlighted ? "border-blue-200 bg-blue-50/40 ring-1 ring-blue-200" : "border-slate-200",
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <Badge tone={highlighted ? "emerald" : "blue"}>{badge}</Badge>
          <h3 className="mt-3 text-2xl font-black tracking-tight text-slate-950">{title}</h3>
          <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
        </div>
        {highlighted ? (
          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-emerald-700">
            Recommended
          </span>
        ) : null}
      </div>

      <ul className="mt-4 grid gap-2 text-sm text-slate-700">
        {items.map((item) => (
          <li key={item} className="flex items-start gap-2">
            <CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-blue-700" />
            <span>{item}</span>
          </li>
        ))}
      </ul>

      <button
        type="button"
        className={[
          "btn mt-5 w-full rounded-2xl px-4 py-3 text-sm font-black",
          highlighted ? "btn-primary" : "btn-secondary",
        ].join(" ")}
      >
        {cta}
      </button>
    </article>
  );
}

function InfoCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="text-base font-black text-slate-950">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-600">{body}</p>
    </div>
  );
}

export function PricingPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-2 sm:px-6 lg:px-8">
          <button
            type="button"
            onClick={() => void navigate("/demo")}
            className="flex items-center gap-3 text-left"
          >
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-500/10">
              <SchoolIcon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-black tracking-tight text-slate-950">School Connect</p>
              <p className="text-[11px] uppercase tracking-[0.22em] text-blue-700">Powering Smart Schools</p>
            </div>
          </button>

          <nav className="hidden items-center gap-5 text-sm font-semibold text-slate-600 md:flex">
            <button type="button" onClick={() => void navigate("/demo")} className="transition hover:text-blue-700">
              Demo
            </button>
            <a href="#report-lab" className="transition hover:text-blue-700">
              Report Lab
            </a>
            <a href="#smart-pages" className="transition hover:text-blue-700">
              Smart Pages
            </a>
            <a href="#pricing" className="transition hover:text-blue-700">
              Pricing
            </a>
            <button type="button" onClick={() => void navigate("/contact")} className="transition hover:text-blue-700">
              Contact
            </button>
            <button type="button" onClick={() => void navigate("/login")} className="transition hover:text-blue-700">
              Sign in
            </button>
          </nav>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void navigate("/login")}
              className="btn btn-secondary rounded-full px-4 py-2 text-sm font-bold"
            >
              Sign in
            </button>
            <button
              type="button"
              onClick={() => void navigate("/demo")}
              className="btn btn-primary rounded-full px-4 py-2 text-sm font-black"
            >
              Watch Demo
              <ArrowRightIcon className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      <main>
        <section className="border-b border-blue-100 bg-gradient-to-br from-white via-blue-50 to-slate-50 px-4 py-8 sm:px-6 lg:px-8">
          <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-12 lg:items-end">
            <div className="lg:col-span-7">
              <Badge>Pricing</Badge>
              <h1 className="mt-3 max-w-3xl text-4xl font-black tracking-tight text-slate-950 sm:text-5xl">
                Simple packages for smart schools.
              </h1>
              <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600">
                Start with the tools your school needs today. Add more School Connect products as
                your school grows.
              </p>

              <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={() => document.getElementById("contact")?.scrollIntoView({ behavior: "smooth", block: "start" })}
                  className="btn btn-primary rounded-xl px-4 py-3 text-sm font-black"
                >
                  Request Pricing
                </button>
                <button
                  type="button"
                  onClick={() => void navigate("/demo")}
                  className="btn btn-secondary rounded-xl px-4 py-3 text-sm font-bold"
                >
                  Watch Demo
                </button>
              </div>
            </div>

            <div className="lg:col-span-5">
              <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
                <div className="rounded-[1.5rem] border border-blue-200 bg-white p-4 shadow-sm">
                  <p className="text-[11px] font-black uppercase tracking-[0.18em] text-blue-700">School Connect</p>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    One brand, two core products, and room to grow.
                  </p>
                </div>
                <div className="rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-sm">
                  <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Report Lab</p>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    Academic reporting for schools that want faster, cleaner reports.
                  </p>
                </div>
                <div className="rounded-[1.5rem] border border-emerald-200 bg-emerald-50 p-4 shadow-sm">
                  <p className="text-[11px] font-black uppercase tracking-[0.18em] text-emerald-700">Smart Pages</p>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    Handwritten documents turned into polished PDFs and shareable pages.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="pricing" className="border-b border-slate-200 bg-white px-4 py-8 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="grid gap-4 lg:grid-cols-3">
              <PricingCard
                title="Report Lab"
                badge="Academic Reports"
                description="For schools that want to generate, review, print, and share student reports faster."
                items={[
                  "Marks upload and organization",
                  "Report generation",
                  "Report review workflow",
                  "Print and download reports",
                  "Secure parent-ready report links",
                  "Basic school branding",
                  "Staff onboarding support",
                ]}
                cta="Request Report Lab Pricing"
              />
              <PricingCard
                title="Smart Pages"
                badge="Documents & PDFs"
                description="For schools that want to turn handwritten or scanned documents into ready-to-print PDFs without typing everything again."
                items={[
                  "Upload handwritten or scanned documents",
                  "Extract and clean document content",
                  "Edit and polish pages",
                  "Generate ready PDFs",
                  "Organize documents in collections",
                  "Publish or share approved pages",
                  "Useful for letters, forms, notices, and school records",
                ]}
                cta="Request Smart Pages Pricing"
              />
              <PricingCard
                title="School Connect Bundle"
                badge="Recommended"
                description="For schools that want both academic reporting and intelligent document workflows in one growing smart-school platform."
                items={[
                  "Everything in Report Lab",
                  "Everything in Smart Pages",
                  "Unified school workspace",
                  "User access and role setup",
                  "School branding setup",
                  "Priority onboarding",
                  "Priority support",
                  "Room to add future School Connect tools",
                ]}
                cta="Request Bundle Pricing"
                highlighted
              />
            </div>

            <p className="mx-auto mt-4 max-w-3xl text-sm leading-6 text-slate-600">
              Pricing depends on school size, selected products, setup needs, and support level.
              We&apos;ll recommend the best package after a short demo call.
            </p>
          </div>
        </section>

        <section className="border-b border-slate-200 bg-slate-50 px-4 py-8 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="max-w-2xl">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-700">Optional add-ons</p>
              <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-950">Add the support your school needs.</h2>
            </div>

            <div className="mt-4 grid gap-3 lg:grid-cols-4">
              <InfoCard title="School branding setup" body="Logo, colors, report header, footer, and school identity setup." />
              <InfoCard title="Data import support" body="Help moving existing students, marks, and school records into the system." />
              <InfoCard title="Parent delivery setup" body="Support for sharing reports and documents with parents using secure links." />
              <InfoCard title="Custom workflows" body="Extra setup for schools with unique approval or document processes." />
            </div>
          </div>
        </section>

        <section className="border-b border-slate-200 bg-white px-4 py-8 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-4xl">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-700">FAQ</p>
            <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-950">Common pricing questions</h2>

            <div className="mt-4 grid gap-3">
              <InfoCard title="Can we start with Report Lab only?" body="Yes. A school can start with Report Lab and add Smart Pages or other School Connect tools later." />
              <InfoCard title="Can we use Smart Pages without Report Lab?" body="Yes. Smart Pages can be used as a document workflow product on its own." />
              <InfoCard title="Do you charge by students or by school?" body="Pricing can depend on school size, number of users, selected products, and setup requirements." />
              <InfoCard title="Is setup included?" body="Basic onboarding is included. Larger data imports, custom branding, or special workflows may require additional setup support." />
              <InfoCard title="Can we try the system first?" body="Yes. Schools can watch the demo and request a guided walkthrough before choosing a package." />
            </div>
          </div>
        </section>

        <TestimonialsSection className="bg-slate-50 px-4 py-8 sm:px-6 lg:px-8" compact />

        <section id="report-lab" className="border-b border-slate-200 bg-blue-50/40 px-4 py-8 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="rounded-[2rem] border border-blue-200 bg-white p-6 shadow-sm sm:p-7">
              <div className="grid gap-6 lg:grid-cols-12 lg:items-center">
                <div className="lg:col-span-8">
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-700">Ready to choose the right package?</p>
                  <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-950">
                    Book a short demo and we&apos;ll recommend the best School Connect setup for your school.
                  </h2>
                </div>
                <div id="contact" className="grid gap-3 lg:col-span-4">
                  <a
                    href="mailto:pricing@schoolconnect.example?subject=School%20Connect%20Pricing"
                    className="btn btn-primary rounded-xl px-4 py-3 text-center text-sm font-black"
                  >
                    Request Pricing
                  </a>
                  <button
                    type="button"
                    onClick={() => void navigate("/demo")}
                    className="btn btn-secondary rounded-xl px-4 py-3 text-sm font-bold"
                  >
                    Watch Demo
                  </button>
                </div>
              </div>

              <div className="mt-6 grid gap-3 md:grid-cols-3">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Email</p>
                  <p className="mt-2 text-sm font-semibold text-slate-950">pricing@schoolconnect.example</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Phone</p>
                  <p className="mt-2 text-sm font-semibold text-slate-950">+1 (555) 010-2020</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Support level</p>
                  <p className="mt-2 text-sm font-semibold text-slate-950">Matched after the demo call</p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
