import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { buildWhatsAppUgUrl, buildWhatsAppUrl, WHATSAPP_DISPLAY, WHATSAPP_UG_DISPLAY } from "../config/contact";
import { PhoneIcon } from "../components/marketing/Icons";
import { TestimonialsSection } from "../components/marketing/TestimonialsSection";

function Badge({ children }: { children: ReactNode }) {
  return <span className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-blue-700">{children}</span>;
}

function InfoCard({ title, body, cta, href }: { title: string; body: string; cta: string; href: string }) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-xl">
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-blue-600 via-sky-400 to-cyan-300" />
      <div className="absolute -right-10 top-6 h-24 w-24 rounded-full bg-blue-50/70 blur-3xl transition duration-200 group-hover:bg-blue-100/80" />
      <h3 className="text-base font-black text-slate-950">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-600">{body}</p>
      <a href={href} target="_blank" rel="noreferrer" className="btn marketing-button-motion mt-4 inline-flex rounded-xl border border-blue-200 bg-white px-4 py-2.5 text-sm font-bold text-blue-700 shadow-sm hover:bg-blue-50">
        {cta}
      </a>
    </div>
  );
}

export function ContactPage() {
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
        "Hello SSAMENJ Technologies, I would like to request a demo.",
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
  const ugandaPmHref = buildWhatsAppUgUrl("Hello SSAMENJ Technologies! I would like to speak with the Uganda team.");
  const pricingHref = useMemo(
    () =>
      buildWhatsAppUrl(
        [
          "Hello SSAMENJ Technologies, I would like to ask about pricing.",
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
          "Hello SSAMENJ Technologies, I need setup support.",
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
      <section className="border-b border-blue-100 bg-gradient-to-br from-white via-blue-50 to-slate-50 px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-12 lg:items-center">
          <div className="lg:col-span-7">
            <Badge>School Connect for smart schools</Badge>
            <h1 className="mt-3 max-w-3xl text-4xl font-black tracking-tight text-slate-950 sm:text-5xl">
              Let&apos;s help your school work smarter.
            </h1>
            <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600">
              Request a demo, ask about pricing, or speak to us about setting up Report Lab, Smart Pages, and future School Connect tools for your school.
            </p>

            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              <a href={demoHref} target="_blank" rel="noreferrer" className="btn marketing-button-motion rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 px-4 py-3 text-sm font-black text-white shadow-lg shadow-blue-600/20 hover:shadow-xl hover:shadow-blue-600/25">
                Chat with us on WhatsApp
              </a>
              <a href="#contact-form" className="btn marketing-button-motion rounded-xl border border-blue-200 bg-white px-4 py-3 text-sm font-bold text-blue-700 shadow-sm hover:bg-blue-50">
                Fill contact form
              </a>
            </div>
          </div>

          <div className="lg:col-span-5">
            <div className="grid gap-3">
              <InfoCard title="Book a school demo" body="See how Report Lab and Smart Pages can reduce paperwork, speed up reporting, and support your school's daily work." cta="Request Demo" href={demoHref} />
              <InfoCard title="Ask about pricing" body="Tell us your school size and the products you need. We'll recommend the best starting package." cta="Ask About Pricing" href={pricingHref} />
              <InfoCard title="Setup support" body="Need help with branding, student data, marks import, or school document setup? We can guide you." cta="Chat Now" href={supportHref} />
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
                  <p className="text-sm leading-6 text-slate-600">Fill in the form and open WhatsApp with a prefilled message for your school.</p>
                </div>
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <label className="grid gap-2 text-sm font-semibold text-slate-700">
                  School name
                  <input className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-950 outline-none transition focus:border-blue-300 focus:bg-white" value={form.schoolName} onChange={(event) => setForm((current) => ({ ...current, schoolName: event.target.value }))} placeholder="Your school name" />
                </label>
                <label className="grid gap-2 text-sm font-semibold text-slate-700">
                  Contact person
                  <input className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-950 outline-none transition focus:border-blue-300 focus:bg-white" value={form.contactPerson} onChange={(event) => setForm((current) => ({ ...current, contactPerson: event.target.value }))} placeholder="Name and role" />
                </label>
                <label className="grid gap-2 text-sm font-semibold text-slate-700">
                  Phone / WhatsApp
                  <input className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-950 outline-none transition focus:border-blue-300 focus:bg-white" value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} placeholder="Phone number" />
                </label>
                <label className="grid gap-2 text-sm font-semibold text-slate-700">
                  School location
                  <input className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-950 outline-none transition focus:border-blue-300 focus:bg-white" value={form.location} onChange={(event) => setForm((current) => ({ ...current, location: event.target.value }))} placeholder="Town / district / country" />
                </label>
                <label className="grid gap-2 text-sm font-semibold text-slate-700">
                  Number of students
                  <input className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-950 outline-none transition focus:border-blue-300 focus:bg-white" value={form.students} onChange={(event) => setForm((current) => ({ ...current, students: event.target.value }))} placeholder="Approximate number" />
                </label>
              </div>

              <div className="mt-4 grid gap-2 text-sm font-semibold text-slate-700">
                Interested in:
                <div className="grid gap-2 md:grid-cols-2">
                  {["Report Lab", "Smart Pages", "Full School Connect Bundle", "Not sure yet"].map((option) => (
                    <label key={option} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-700">
                      <input type="radio" name="interest" value={option} checked={form.interest === option} onChange={() => setForm((current) => ({ ...current, interest: option }))} className="h-4 w-4 border-slate-300 text-blue-600 focus:ring-blue-500" />
                      {option}
                    </label>
                  ))}
                </div>
              </div>

              <label className="mt-4 grid gap-2 text-sm font-semibold text-slate-700">
                Message
                <textarea className="min-h-32 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-950 outline-none transition focus:border-blue-300 focus:bg-white" value={form.message} onChange={(event) => setForm((current) => ({ ...current, message: event.target.value }))} placeholder="Tell us what your school needs..." />
              </label>

              <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                <a href={demoHref} target="_blank" rel="noreferrer" className="btn marketing-button-motion rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 px-4 py-3 text-sm font-black text-white shadow-lg shadow-blue-600/20 hover:shadow-xl hover:shadow-blue-600/25">
                  Request Demo
                </a>
                <a href={pricingHref} target="_blank" rel="noreferrer" className="btn marketing-button-motion rounded-xl border border-blue-200 bg-white px-4 py-3 text-sm font-bold text-blue-700 shadow-sm hover:bg-blue-50">
                  Ask About Pricing
                </a>
              </div>
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
              <a
                href={ugandaPmHref}
                target="_blank"
                rel="noreferrer"
                className="marketing-card-motion block rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm transition hover:border-blue-200"
              >
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-2xl bg-slate-50 text-slate-600">
                    <PhoneIcon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Uganda Product Manager</p>
                    <p className="text-sm font-black text-slate-950">{WHATSAPP_UG_DISPLAY}</p>
                  </div>
                </div>
                <p className="mt-2 text-xs font-semibold text-blue-700">Chat with Uganda PM on WhatsApp →</p>
              </a>
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
    </div>
  );
}
