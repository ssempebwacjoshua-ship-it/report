import { useMemo, useState } from "react";
import { FaqSection } from "../components/marketing/FaqSection";
import { buildWhatsAppUrl, WHATSAPP_DISPLAY } from "../config/contact";
import { PhoneIcon, SparklesIcon } from "../components/marketing/Icons";
import { TestimonialsSection } from "../components/marketing/TestimonialsSection";
import { CONTACT_FAQS } from "../content/discoverability";

// Compact action card — white floating card on dark hero background
function ActionCard({ title, body, cta, href }: { title: string; body: string; cta: string; href: string }) {
  return (
    <div className="motion-card motion-card-stagger relative overflow-hidden rounded-2xl border border-white/30 bg-white/95 p-3.5 shadow-sm backdrop-blur-sm">
      <div className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-blue-600 via-sky-400 to-cyan-300" />
      <h3 className="text-sm font-black text-slate-950">{title}</h3>
      <p className="mt-1 text-xs leading-5 text-slate-600">{body}</p>
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        className="btn motion-cta mt-3 w-full rounded-xl border border-blue-200 bg-white px-3 py-2 text-center text-xs font-black text-blue-700 hover:bg-blue-50"
      >
        {cta}
      </a>
    </div>
  );
}

function ContactInfoCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="motion-card rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
      {children}
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
  const globalSupportHref = useMemo(
    () =>
      buildWhatsAppUrl(
        [
          "Hello SSAMENJ Technologies, I would like to speak with the team.",
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
    <div className="bg-slate-50 text-slate-950">
      {/* ── Hero — matches Home/About blue image style ── */}
      <section className="home-hero-image-bg site-hero-compact hero-rhythm border-b text-white" style={{ borderColor: "rgba(15,91,216,0.3)" }}>
        <div className="absolute inset-0 bg-dot-grid opacity-[0.12]" />
        <div className="home-hero-content mx-auto grid max-w-7xl gap-6 px-4 sm:px-6 lg:grid-cols-12 lg:items-center lg:px-8">

          {/* Left — headline + CTAs */}
          <div className="lg:col-span-6">
            <div className="marketing-fade-up inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.2em] text-blue-50">
              <SparklesIcon className="h-3.5 w-3.5" />
              School Connect for smart schools
            </div>
            <h1 className="marketing-fade-up-delay-1 mt-2 hero-title font-black text-white">
              Let&apos;s help your school work smarter.
            </h1>
            <p className="marketing-fade-up-delay-2 mt-2.5 max-w-xl text-sm leading-6 text-blue-50 sm:text-base">
              Request a demo, ask about pricing, or speak to us about setting up Report Lab, Smart Pages, and future School Connect tools for your school.
            </p>
            <div className="marketing-fade-up-delay-3 mt-4 flex flex-col gap-2 sm:flex-row">
              <a
                href={demoHref}
                target="_blank"
                rel="noreferrer"
                className="btn marketing-button-motion motion-cta rounded-xl bg-white px-4 py-2.5 text-sm font-black text-blue-700 hover:bg-blue-50"
              >
                Chat with us on WhatsApp
              </a>
              <a
                href="#contact-form"
                className="btn marketing-button-motion motion-cta rounded-xl border border-white/25 bg-white/10 px-4 py-2.5 text-sm font-bold text-white hover:bg-white/15"
              >
                Fill contact form
              </a>
            </div>
          </div>

          {/* Right — compact action cards */}
          <div className="lg:col-span-6">
            <div className="grid gap-2.5">
              <ActionCard
                title="Book a school demo"
                body="See Report Lab and Smart Pages in action for your school."
                cta="Request Demo"
                href={demoHref}
              />
              <ActionCard
                title="Ask about pricing"
                body="Tell us your school size. We'll recommend the right package."
                cta="Ask About Pricing"
                href={pricingHref}
              />
              <ActionCard
                title="Setup support"
                body="Need help with branding, student data, or document setup?"
                cta="Chat About Setup"
                href={supportHref}
              />
            </div>
          </div>
        </div>
      </section>

      {/* ── Contact form ── */}
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
                  <input
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-950 outline-none transition focus:border-blue-300 focus:bg-white"
                    value={form.schoolName}
                    onChange={(e) => setForm((c) => ({ ...c, schoolName: e.target.value }))}
                    placeholder="Your school name"
                  />
                </label>
                <label className="grid gap-2 text-sm font-semibold text-slate-700">
                  Contact person
                  <input
                    className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-950 outline-none transition focus:border-blue-300 focus:bg-white"
                    value={form.contactPerson}
                    onChange={(e) => setForm((c) => ({ ...c, contactPerson: e.target.value }))}
                    placeholder="Name and role"
                  />
                </label>
                <label className="grid gap-2 text-sm font-semibold text-slate-700">
                  Phone / WhatsApp
                  <input
                    className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-950 outline-none transition focus:border-blue-300 focus:bg-white"
                    value={form.phone}
                    onChange={(e) => setForm((c) => ({ ...c, phone: e.target.value }))}
                    placeholder="Phone number"
                  />
                </label>
                <label className="grid gap-2 text-sm font-semibold text-slate-700">
                  School location
                  <input
                    className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-950 outline-none transition focus:border-blue-300 focus:bg-white"
                    value={form.location}
                    onChange={(e) => setForm((c) => ({ ...c, location: e.target.value }))}
                    placeholder="Town / district / country"
                  />
                </label>
                <label className="grid gap-2 text-sm font-semibold text-slate-700">
                  Number of students
                  <input
                    className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-950 outline-none transition focus:border-blue-300 focus:bg-white"
                    value={form.students}
                    onChange={(e) => setForm((c) => ({ ...c, students: e.target.value }))}
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
                        onChange={() => setForm((c) => ({ ...c, interest: option }))}
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
                  onChange={(e) => setForm((c) => ({ ...c, message: e.target.value }))}
                  placeholder="Tell us what your school needs..."
                />
              </label>

              <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                <a
                  href={demoHref}
                  target="_blank"
                  rel="noreferrer"
                  className="btn marketing-button-motion rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 px-4 py-3 text-sm font-black text-white shadow-lg shadow-blue-600/20 hover:shadow-xl hover:shadow-blue-600/25"
                >
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
            </div>
          </div>

          <div className="lg:col-span-5">
            <div className="grid gap-3">
              <ContactInfoCard>
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-2xl bg-emerald-50 text-emerald-700">
                    <PhoneIcon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-black text-slate-950">WhatsApp</p>
                    <p className="text-sm leading-6 text-slate-600">{WHATSAPP_DISPLAY}</p>
                  </div>
                </div>
              </ContactInfoCard>

              <a
                href={globalSupportHref}
                target="_blank"
                rel="noreferrer"
                className="marketing-card-motion block rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm transition hover:border-blue-200"
              >
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-2xl bg-slate-50 text-slate-600">
                    <PhoneIcon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Global support</p>
                    <p className="text-sm font-black text-slate-950">{WHATSAPP_DISPLAY}</p>
                  </div>
                </div>
                <p className="mt-2 text-xs font-semibold text-blue-700">Chat with SSAMENJ on WhatsApp →</p>
              </a>

              <ContactInfoCard>
                <p className="text-sm font-black text-slate-950">Need a quick start?</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  We can help with a demo, pricing guidance, or a setup discussion for Report Lab and Smart Pages.
                </p>
              </ContactInfoCard>
            </div>
          </div>
        </div>
      </section>

      <TestimonialsSection className="bg-slate-50 px-4 py-8 sm:px-6 lg:px-8" compact />

      <section className="border-t border-slate-200 bg-white px-4 py-8 sm:px-6 lg:px-8">
        <FaqSection
          title="Contact questions"
          description="If you are ready to talk, these answers make the first WhatsApp message a little easier."
          items={CONTACT_FAQS}
        />
      </section>

      <section className="border-t border-slate-200 bg-slate-50 px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-700">Search engine readiness</p>
          <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-950">Google Search Console and Bing Webmaster Tools</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Once verification details are provided, the site can use a config-driven verification tag or file without changing the public offer or pricing.
          </p>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-black text-slate-950">Google Search Console</p>
              <ol className="mt-2 space-y-1 text-sm leading-6 text-slate-600">
                <li>1. Add the https://ssamenj.vercel.app property.</li>
                <li>2. Verify ownership with a provided token or file.</li>
                <li>3. Submit https://ssamenj.vercel.app/sitemap.xml.</li>
              </ol>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-black text-slate-950">Bing Webmaster Tools</p>
              <ol className="mt-2 space-y-1 text-sm leading-6 text-slate-600">
                <li>1. Add the site and verify ownership.</li>
                <li>2. Submit the sitemap.</li>
                <li>3. Check index coverage and URL inspection results.</li>
              </ol>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
