import { useMemo, useState, type ReactNode, type SVGProps } from "react";
import { useNavigate } from "react-router-dom";
import { FloatingWhatsAppButton } from "../components/marketing/FloatingWhatsAppButton";
import { TestimonialsSection } from "../components/marketing/TestimonialsSection";
import { WHATSAPP_DISPLAY, buildWhatsAppUrl } from "../config/contact";

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

function PhoneIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M22 16.9v2a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.4 19.4 0 0 1-6-6A19.8 19.8 0 0 1 2.1 3.2 2 2 0 0 1 4.1 1h2a2 2 0 0 1 2 1.7c.1.9.3 1.7.6 2.5a2 2 0 0 1-.5 2.1L7.4 8.6a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.5c.8.3 1.6.5 2.5.6A2 2 0 0 1 22 16.9Z" />
    </Icon>
  );
}

function Badge({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-blue-700 ${className}`}>
      {children}
    </span>
  );
}

function InfoCard({
  title,
  body,
  cta,
  href,
}: {
  title: string;
  body: string;
  cta: string;
  href: string;
}) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-xl">
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-blue-600 via-sky-400 to-cyan-300" />
      <div className="absolute -right-10 top-6 h-24 w-24 rounded-full bg-blue-50/70 blur-3xl transition duration-200 group-hover:bg-blue-100/80" />
      <h3 className="text-base font-black text-slate-950">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-600">{body}</p>
      <a
        href={href}
        className="btn marketing-button-motion mt-4 inline-flex rounded-xl border border-blue-200 bg-white px-4 py-2.5 text-sm font-bold text-blue-700 shadow-sm hover:bg-blue-50"
      >
        {cta}
      </a>
    </div>
  );
}

export function ContactPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    schoolName: "",
    contactPerson: "",
    phone: "",
    location: "",
    students: "",
    interest: "Not sure yet",
    message: "",
  });

  const demoMessage = useMemo(
    () =>
      [
        "Hello School Connect, I would like to request a demo.",
        `School: ${form.schoolName || "-"}`,
        `Contact person: ${form.contactPerson || "-"}`,
        `Phone: ${form.phone || "-"}`,
        `Location: ${form.location || "-"}`,
        `Students: ${form.students || "-"}`,
        `Interested in: ${form.interest}`,
        `Message: ${form.message || "-"}`,
      ].join("\n"),
    [form],
  );

  const demoHref = useMemo(() => buildWhatsAppUrl(demoMessage), [demoMessage]);
  const pricingHref = useMemo(
    () =>
      buildWhatsAppUrl(
        [
          "Hello School Connect, I would like to ask about pricing.",
          `School: ${form.schoolName || "-"}`,
          `Contact person: ${form.contactPerson || "-"}`,
          `Phone: ${form.phone || "-"}`,
          `Location: ${form.location || "-"}`,
          `Students: ${form.students || "-"}`,
          `Interested in: ${form.interest}`,
          `Message: ${form.message || "-"}`,
        ].join("\n"),
      ),
    [form],
  );
  const supportHref = useMemo(
    () =>
      buildWhatsAppUrl(
        [
          "Hello School Connect, I need setup support.",
          `School: ${form.schoolName || "-"}`,
          `Contact person: ${form.contactPerson || "-"}`,
          `Phone: ${form.phone || "-"}`,
          `Location: ${form.location || "-"}`,
          `Students: ${form.students || "-"}`,
          `Interested in: ${form.interest}`,
          `Message: ${form.message || "-"}`,
        ].join("\n"),
      ),
    [form],
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-2 sm:px-6 lg:px-8">
          <button type="button" onClick={() => void navigate("/demo")} className="flex items-center gap-3 text-left">
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
            <button type="button" onClick={() => void navigate("/pricing")} className="transition hover:text-blue-700">
              Pricing
            </button>
            <a href="#contact-form" className="transition hover:text-blue-700">
              Contact
            </a>
          </nav>

          <div className="flex items-center gap-2">
            <button type="button" onClick={() => void navigate("/login")} className="btn marketing-button-motion rounded-full border border-blue-200 bg-white px-4 py-2 text-sm font-bold text-blue-700 shadow-sm hover:bg-blue-50">
              Sign in
            </button>
            <button type="button" onClick={() => void navigate("/demo")} className="btn marketing-button-motion rounded-full bg-gradient-to-r from-blue-600 to-blue-700 px-4 py-2 text-sm font-black text-white shadow-lg shadow-blue-600/20 hover:shadow-xl hover:shadow-blue-600/25">
              Watch Demo
              <ArrowRightIcon className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      <main>
        <section className="border-b border-blue-100 bg-gradient-to-br from-white via-blue-50 to-slate-50 px-4 py-8 sm:px-6 lg:px-8">
          <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-12 lg:items-center">
            <div className="lg:col-span-7">
              <Badge className="marketing-fade-up">SCHOOL CONNECT FOR SMART SCHOOLS</Badge>
              <h1 className="marketing-fade-up-delay-1 mt-3 max-w-3xl text-4xl font-black tracking-tight text-slate-950 sm:text-5xl">
                Let&apos;s help your school work smarter.
              </h1>
              <p className="marketing-fade-up-delay-2 mt-3 max-w-2xl text-base leading-7 text-slate-600">
                Request a demo, ask about pricing, or speak to us about setting up Report Lab, Smart Pages, and future School Connect tools for your school.
              </p>

              <div className="marketing-fade-up-delay-3 mt-5 flex flex-col gap-3 sm:flex-row">
                <a
                  href={demoHref}
                  target="_blank"
                  rel="noreferrer"
                  className="btn marketing-button-motion rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 px-4 py-3 text-sm font-black text-white shadow-lg shadow-blue-600/20 hover:shadow-xl hover:shadow-blue-600/25"
                >
                  Chat with us on WhatsApp
                </a>
                <button
                  type="button"
                  onClick={() => void navigate("/demo")}
                  className="btn marketing-button-motion rounded-xl border border-blue-200 bg-white px-4 py-3 text-sm font-bold text-blue-700 shadow-sm hover:bg-blue-50"
                >
                  Watch Walkthrough
                </button>
              </div>
            </div>

            <div className="lg:col-span-5">
              <div className="grid gap-3">
                <InfoCard
                  title="Book a school demo"
                  body="See how Report Lab and Smart Pages can reduce paperwork, speed up reporting, and support your school's daily work."
                  cta="Request Demo"
                  href={demoHref}
                />
                <InfoCard
                  title="Ask about pricing"
                  body="Tell us your school size and the products you need. We'll recommend the best starting package."
                  cta="Ask About Pricing"
                  href={pricingHref}
                />
                <InfoCard
                  title="Setup support"
                  body="Need help with branding, student data, marks import, or school document setup? We can guide you."
                  cta="Chat Now"
                  href={supportHref}
                />
              </div>
            </div>
          </div>
        </section>

        <section id="contact-form" className="border-b border-slate-200 bg-white px-4 py-8 sm:px-6 lg:px-8">
          <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-12">
            <div className="lg:col-span-7">
                <div className="marketing-card-motion rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="grid h-11 w-11 place-items-center rounded-2xl bg-blue-50 text-blue-700">
                      <PhoneIcon className="h-5 w-5" />
                    </div>
                  <div>
                    <h2 className="text-2xl font-black tracking-tight text-slate-950">Request a WhatsApp chat</h2>
                    <p className="text-sm leading-6 text-slate-600">
                      Fill in the form and open WhatsApp with a prefilled message for your school.
                    </p>
                  </div>
                </div>

                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  <label className="grid gap-2 text-sm font-semibold text-slate-700">
                    School name
                    <input
                      className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-950 outline-none transition focus:border-blue-300 focus:bg-white"
                      value={form.schoolName}
                      onChange={(event) => setForm((current) => ({ ...current, schoolName: event.target.value }))}
                      placeholder="Your school name"
                    />
                  </label>
                  <label className="grid gap-2 text-sm font-semibold text-slate-700">
                    Contact person
                    <input
                      className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-950 outline-none transition focus:border-blue-300 focus:bg-white"
                      value={form.contactPerson}
                      onChange={(event) => setForm((current) => ({ ...current, contactPerson: event.target.value }))}
                      placeholder="Name and role"
                    />
                  </label>
                  <label className="grid gap-2 text-sm font-semibold text-slate-700">
                    Phone / WhatsApp
                    <input
                      className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-950 outline-none transition focus:border-blue-300 focus:bg-white"
                      value={form.phone}
                      onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
                      placeholder="Phone number"
                    />
                  </label>
                  <label className="grid gap-2 text-sm font-semibold text-slate-700">
                    School location
                    <input
                      className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-950 outline-none transition focus:border-blue-300 focus:bg-white"
                      value={form.location}
                      onChange={(event) => setForm((current) => ({ ...current, location: event.target.value }))}
                      placeholder="Town / district / country"
                    />
                  </label>
                  <label className="grid gap-2 text-sm font-semibold text-slate-700">
                    Number of students
                    <input
                      className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-950 outline-none transition focus:border-blue-300 focus:bg-white"
                      value={form.students}
                      onChange={(event) => setForm((current) => ({ ...current, students: event.target.value }))}
                      placeholder="Approximate number"
                    />
                  </label>
                </div>

                <div className="mt-4 grid gap-2 text-sm font-semibold text-slate-700">
                  Interested in:
                  <div className="grid gap-2 md:grid-cols-2">
                    {["Report Lab", "Smart Pages", "Full School Connect Bundle", "Not sure yet"].map((option) => (
                      <label key={option} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-700">
                        <input
                          type="radio"
                          name="interest"
                          value={option}
                          checked={form.interest === option}
                          onChange={() => setForm((current) => ({ ...current, interest: option }))}
                          className="h-4 w-4 border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                        {option}
                      </label>
                    ))}
                  </div>
                </div>

                <label className="mt-4 grid gap-2 text-sm font-semibold text-slate-700">
                  Message
                  <textarea
                    className="min-h-32 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-950 outline-none transition focus:border-blue-300 focus:bg-white"
                    value={form.message}
                    onChange={(event) => setForm((current) => ({ ...current, message: event.target.value }))}
                    placeholder="Tell us what your school needs..."
                  />
                </label>

                <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                  <a href={demoHref} target="_blank" rel="noreferrer" className="btn marketing-button-motion rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 px-4 py-3 text-sm font-black text-white shadow-lg shadow-blue-600/20 hover:shadow-xl hover:shadow-blue-600/25">
                    Request Demo
                  </a>
                  <a
                    href={pricingHref}
                    target="_blank"
                    rel="noreferrer"
                    className="btn marketing-button-motion rounded-xl border border-blue-200 bg-white px-4 py-3 text-sm font-bold text-blue-700 shadow-sm hover:bg-blue-50"
                  >
                    Ask About Pricing
                  </a>
                </div>

                <p className="mt-3 text-sm leading-6 text-slate-600">
                  Your message will open in WhatsApp, ready to send.
                </p>
              </div>
            </div>

            <div className="lg:col-span-5">
              <div className="grid gap-3">
                <div className="marketing-card-motion rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="grid h-10 w-10 place-items-center rounded-2xl bg-emerald-50 text-emerald-700">
                      <PhoneIcon className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-black text-slate-950">WhatsApp</p>
                      <p className="text-sm leading-6 text-slate-600">{WHATSAPP_DISPLAY}</p>
                    </div>
                  </div>
                </div>
                <div className="marketing-card-motion rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="grid h-10 w-10 place-items-center rounded-2xl bg-emerald-50 text-emerald-700">
                      <PhoneIcon className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-black text-slate-950">Direct line</p>
                      <p className="text-sm leading-6 text-slate-600">Fast replies on WhatsApp</p>
                    </div>
                  </div>
                </div>
                <div className="marketing-card-motion rounded-[1.5rem] border border-blue-200 bg-blue-50 p-5 shadow-sm">
                  <p className="text-sm font-black text-slate-950">Need a quick start?</p>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    We can help with a demo, pricing guidance, or a setup discussion for Report Lab and Smart Pages.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <TestimonialsSection className="bg-slate-50 px-4 py-8 sm:px-6 lg:px-8" compact />

        <section className="border-t border-slate-200 bg-blue-50/40 px-4 py-8 sm:px-6 lg:px-8">
          <div className="marketing-card-motion mx-auto max-w-7xl rounded-[2rem] border border-blue-200 bg-white p-6 shadow-sm sm:p-7">
            <div className="grid gap-6 lg:grid-cols-12 lg:items-center">
              <div className="lg:col-span-8">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-700">Ready to see School Connect in action?</p>
                <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-950">
                  Start with a walkthrough, then request the right package for your school.
                </h2>
              </div>
              <div className="flex flex-col gap-3 lg:col-span-4 lg:items-end">
                <button type="button" onClick={() => void navigate("/demo")} className="btn marketing-button-motion rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 px-4 py-2.5 text-sm font-black text-white shadow-lg shadow-blue-600/20 hover:shadow-xl hover:shadow-blue-600/25">
                  Watch Demo
                </button>
                <a href={pricingHref} target="_blank" rel="noreferrer" className="btn marketing-button-motion rounded-xl border border-blue-200 bg-white px-4 py-2.5 text-sm font-bold text-blue-700 shadow-sm hover:bg-blue-50">
                  Request Pricing on WhatsApp
                </a>
                <a href={demoHref} target="_blank" rel="noreferrer" className="btn marketing-button-motion rounded-xl border border-blue-200 bg-white px-4 py-2.5 text-sm font-bold text-blue-700 shadow-sm hover:bg-blue-50">
                  Chat on WhatsApp
                </a>
              </div>
            </div>
          </div>
        </section>
      </main>
      <FloatingWhatsAppButton />
    </div>
  );
}



