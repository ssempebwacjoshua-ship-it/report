import { useMemo, useState, type ReactNode, type SVGProps } from "react";
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

function PhoneIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M22 16.9v2a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.4 19.4 0 0 1-6-6A19.8 19.8 0 0 1 2.1 3.2 2 2 0 0 1 4.1 1h2a2 2 0 0 1 2 1.7c.1.9.3 1.7.6 2.5a2 2 0 0 1-.5 2.1L7.4 8.6a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.5c.8.3 1.6.5 2.5.6A2 2 0 0 1 22 16.9Z" />
    </Icon>
  );
}

function MailIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="m4 6 8 5 8-5" />
      <rect x="4" y="5" width="16" height="14" rx="2" />
    </Icon>
  );
}

function Badge({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-blue-700">
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
    <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="text-base font-black text-slate-950">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-600">{body}</p>
      <a href={href} className="btn btn-secondary mt-4 inline-flex rounded-xl px-4 py-2.5 text-sm font-bold">
        {cta}
      </a>
    </div>
  );
}

const BUSINESS_EMAIL = "REPLACE_WITH_BUSINESS_EMAIL";
const WHATSAPP_NUMBER = "REPLACE_WITH_WHATSAPP_NUMBER";

export function ContactPage() {
  const [form, setForm] = useState({
    schoolName: "",
    contactPerson: "",
    phone: "",
    email: "",
    location: "",
    students: "",
    interest: "Not sure yet",
    message: "",
  });

  const mailtoHref = useMemo(() => {
    const subject = encodeURIComponent(`School Connect enquiry from ${form.schoolName || "a school"}`);
    const body = encodeURIComponent(
      [
        `School name: ${form.schoolName || "-"}`,
        `Contact person: ${form.contactPerson || "-"}`,
        `Phone / WhatsApp: ${form.phone || "-"}`,
        `Email: ${form.email || "-"}`,
        `School location: ${form.location || "-"}`,
        `Number of students: ${form.students || "-"}`,
        `Interested in: ${form.interest}`,
        "",
        form.message || "No message added yet.",
      ].join("\n"),
    );
    return `mailto:${BUSINESS_EMAIL}?subject=${subject}&body=${body}`;
  }, [form]);

  const pricingHref = useMemo(() => {
    const subject = encodeURIComponent(`School Connect pricing request from ${form.schoolName || "a school"}`);
    const body = encodeURIComponent(
      [
        `School name: ${form.schoolName || "-"}`,
        `Contact person: ${form.contactPerson || "-"}`,
        `Email: ${form.email || "-"}`,
        `Interested in: ${form.interest}`,
        "",
        form.message || "No message added yet.",
      ].join("\n"),
    );
    return `mailto:${BUSINESS_EMAIL}?subject=${subject}&body=${body}`;
  }, [form]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <main>
        <section className="border-b border-blue-100 bg-gradient-to-br from-white via-blue-50 to-slate-50 px-4 py-8 sm:px-6 lg:px-8">
          <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-12 lg:items-center">
            <div className="lg:col-span-7">
              <Badge>SCHOOL CONNECT FOR SMART SCHOOLS</Badge>
              <h1 className="mt-3 max-w-3xl text-4xl font-black tracking-tight text-slate-950 sm:text-5xl">
                Let&apos;s help your school work smarter.
              </h1>
              <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600">
                Request a demo, ask about pricing, or speak to us about setting up Report Lab, Smart Pages, and future School Connect tools for your school.
              </p>

              <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={() => document.getElementById("contact-form")?.scrollIntoView({ behavior: "smooth", block: "start" })}
                  className="btn btn-primary rounded-xl px-4 py-3 text-sm font-black"
                >
                  Request a Demo
                </button>
                <a
                  href="/demos"
                  className="btn btn-secondary rounded-xl px-4 py-3 text-sm font-bold"
                >
                  Watch Walkthrough
                </a>
              </div>
            </div>

            <div className="lg:col-span-5">
              <div className="grid gap-3">
                <InfoCard
                  title="Book a school demo"
                  body="See how Report Lab and Smart Pages can reduce paperwork, speed up reporting, and support your school’s daily work."
                  cta="Request Demo"
                  href={mailtoHref}
                />
                <InfoCard
                  title="Ask about pricing"
                  body="Tell us your school size and the products you need. We’ll recommend the best starting package."
                  cta="Request Pricing"
                  href={pricingHref}
                />
                <InfoCard
                  title="Setup support"
                  body="Need help with branding, student data, marks import, or school document setup? We can guide you."
                  cta="Talk to Us"
                  href={`mailto:${BUSINESS_EMAIL}?subject=${encodeURIComponent("School Connect setup support")}`}
                />
              </div>
            </div>
          </div>
        </section>

        <section id="contact-form" className="border-b border-slate-200 bg-white px-4 py-8 sm:px-6 lg:px-8">
          <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-12">
            <div className="lg:col-span-7">
              <div className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="grid h-11 w-11 place-items-center rounded-2xl bg-blue-50 text-blue-700">
                    <MailIcon className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-black tracking-tight text-slate-950">Request a contact callback</h2>
                    <p className="text-sm leading-6 text-slate-600">
                      Fill in the form and use the request button to open your email app with the details prepared.
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
                    Email
                    <input
                      className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-950 outline-none transition focus:border-blue-300 focus:bg-white"
                      value={form.email}
                      onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                      placeholder="Email address"
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
                  <a href={mailtoHref} className="btn btn-primary rounded-xl px-4 py-3 text-sm font-black">
                    Request a Demo
                  </a>
                  <a
                    href={pricingHref}
                    className="btn btn-secondary rounded-xl px-4 py-3 text-sm font-bold"
                  >
                    Contact by Email
                  </a>
                </div>

                <p className="mt-3 text-sm leading-6 text-slate-600">
                  This form opens your email app. No backend submission is wired yet.
                </p>
              </div>
            </div>

            <div className="lg:col-span-5">
              <div className="grid gap-3">
                <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="grid h-10 w-10 place-items-center rounded-2xl bg-blue-50 text-blue-700">
                      <MailIcon className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-black text-slate-950">Email</p>
                      <p className="text-sm leading-6 text-slate-600">{BUSINESS_EMAIL}</p>
                    </div>
                  </div>
                </div>
                <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="grid h-10 w-10 place-items-center rounded-2xl bg-emerald-50 text-emerald-700">
                      <PhoneIcon className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-black text-slate-950">WhatsApp</p>
                      <p className="text-sm leading-6 text-slate-600">{WHATSAPP_NUMBER}</p>
                    </div>
                  </div>
                </div>
                <div className="rounded-[1.5rem] border border-blue-200 bg-blue-50 p-5 shadow-sm">
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
          <div className="mx-auto max-w-7xl rounded-[2rem] border border-blue-200 bg-white p-6 shadow-sm sm:p-7">
            <div className="grid gap-6 lg:grid-cols-12 lg:items-center">
              <div className="lg:col-span-8">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-700">Ready to see School Connect in action?</p>
                <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-950">
                  Start with a walkthrough, then request the right package for your school.
                </h2>
              </div>
              <div className="flex flex-col gap-3 lg:col-span-4 lg:items-end">
                <a href="/demos" className="btn btn-primary rounded-xl px-4 py-2.5 text-sm font-black">
                  Watch Demo
                </a>
                <a href="/pricing" className="btn btn-secondary rounded-xl px-4 py-2.5 text-sm font-bold">
                  Request Pricing
                </a>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
