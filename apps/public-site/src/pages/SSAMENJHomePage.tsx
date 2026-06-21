import { Link } from "react-router-dom";
import { TestimonialsSection } from "../components/marketing/TestimonialsSection";
import {
  ArrowRightIcon,
  BookIcon,
  FileTextIcon,
  GridIcon,
  LockIcon,
  PrinterIcon,
  SchoolIcon,
  ShieldIcon,
  SmartphoneIcon,
  SparklesIcon,
} from "../components/marketing/Icons";
import { MarketingFeatureCard } from "../components/marketing/MarketingFeatureCard";
import { buildWhatsAppUrl } from "../config/contact";

const BOOK_DEMO_URL = buildWhatsAppUrl(
  "Hello SSAMENJ Technologies! I'd like to book a product demo for my organisation.",
);

const SUITE_ITEMS = [
  { abbr: "RL", name: "Report Lab", icon: <FileTextIcon className="h-4 w-4" />, status: "live" as const },
  { abbr: "SP", name: "Smart Pages", icon: <GridIcon className="h-4 w-4" />, status: "live" as const },
  { abbr: "SC", name: "School Connect", icon: <SchoolIcon className="h-4 w-4" />, status: "live" as const },
  { abbr: "LS", name: "Legal Smart Pages", icon: <ShieldIcon className="h-4 w-4" />, status: "demo" as const },
  { abbr: "PM", name: "PearlMart", icon: <BookIcon className="h-4 w-4" />, status: "demo" as const },
  { abbr: "WC", name: "Wideh Cash", icon: <SparklesIcon className="h-4 w-4" />, status: "demo" as const },
  { abbr: "KW", name: "Kids Wallet", icon: <SmartphoneIcon className="h-4 w-4" />, status: "soon" as const },
  { abbr: "NF", name: "NFC Wristbands", icon: <LockIcon className="h-4 w-4" />, status: "soon" as const },
  { abbr: "CD", name: "Custom Digital", icon: <SparklesIcon className="h-4 w-4" />, status: "live" as const },
];

const SUITE_STATUS_META = {
  live: { dot: "#22C55E", text: "Live", textColor: "#16A34A" },
  demo: { dot: "#3B82F6", text: "Demo Available", textColor: "#1D4ED8" },
  soon: { dot: "#94A3B8", text: "Coming Soon", textColor: "#64748B" },
} as const;

function HeroSuiteVisual() {
  const liveCount = SUITE_ITEMS.filter((item) => item.status === "live").length;

  return (
    <div className="marketing-card-motion marketing-fade-up-delay-2 overflow-hidden rounded-[1.5rem] border border-white/25 bg-white/95 shadow-2xl backdrop-blur-sm">
      <div className="flex items-center justify-between border-b px-4 pb-3 pt-4" style={{ borderColor: "#F1F5F9" }}>
        <div className="flex items-center gap-2.5">
          <div className="grid h-6 w-6 place-items-center rounded-lg bg-gradient-to-br from-blue-600 to-blue-700 text-[10px] font-extrabold text-white">
            S
          </div>
          <div>
            <div className="text-[12px] font-extrabold leading-none" style={{ color: "#0B2F6B" }}>
              SSAMENJ Suite
            </div>
            <div className="mt-0.5 text-[9px] leading-none" style={{ color: "#6B7280" }}>
              {SUITE_ITEMS.length} digital products
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-green-500" />
          <span className="text-[10px] font-semibold" style={{ color: "#16A34A" }}>
            {liveCount} Live
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 p-3 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3">
        {SUITE_ITEMS.map((item) => {
          const meta = SUITE_STATUS_META[item.status];
          const isLive = item.status === "live";
          const isDemo = item.status === "demo";

          return (
            <div
              key={item.abbr}
              className="rounded-xl border p-3"
              style={{
                background: isLive ? "#F8FBFF" : isDemo ? "#EEF2FF" : "#F8FAFC",
                borderColor: isLive ? "#E0EBFF" : isDemo ? "#DBEAFE" : "#E2E8F0",
              }}
            >
              <div className="mb-1.5 flex items-center justify-between">
                <div
                  className="flex h-7 w-7 items-center justify-center rounded-lg"
                  style={{
                    background: isLive ? "#EAF3FF" : isDemo ? "#DBEAFE" : "#F1F5F9",
                    color: isLive ? "#0F5BD8" : isDemo ? "#3B82F6" : "#94A3B8",
                  }}
                >
                  {item.icon}
                </div>
                <div className="h-2 w-2 rounded-full" style={{ background: meta.dot }} />
              </div>
              <div className="text-[11px] font-bold leading-snug" style={{ color: "#0B2F6B" }}>
                {item.name}
              </div>
              <div className="mt-0.5 text-[9px] font-semibold" style={{ color: meta.textColor }}>
                {meta.text}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between border-t px-4 py-2.5 text-[10px] font-semibold" style={{ borderColor: "#F1F5F9", color: "#94A3B8" }}>
        <span>Smart Systems. Simple Work.</span>
        <span style={{ color: "#0F5BD8" }}>app.ssamenj.com</span>
      </div>
    </div>
  );
}

export function SSAMENJHomePage() {
  return (
    <div className="bg-slate-50 text-slate-950">
      <section className="relative overflow-hidden border-b border-blue-100 text-white" style={{ backgroundImage: "linear-gradient(90deg, rgba(8, 18, 55, 0.92), rgba(10, 76, 160, 0.72))" }}>
        <div className="absolute inset-0 bg-dot-grid opacity-[0.18]" />
        <div className="relative mx-auto grid max-w-7xl gap-5 px-4 py-5 sm:px-6 lg:grid-cols-12 lg:px-8 lg:py-8">
          <div className="lg:col-span-6">
            <div className="marketing-fade-up inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.2em] text-blue-50">
              <SparklesIcon className="h-3.5 w-3.5" />
              SSAMENJ Technologies
            </div>
            <h1 className="marketing-fade-up-delay-1 mt-2 max-w-xl text-3xl font-black leading-tight tracking-tight text-white lg:text-4xl">
              Smart systems. Simple work.
            </h1>
            <p className="marketing-fade-up-delay-2 mt-2.5 max-w-xl text-sm leading-6 text-blue-50 sm:text-base">
              SSAMENJ Technologies builds practical digital products for schools, legal teams, and growing organizations. Start with Report Lab, Smart Pages, and School Connect, then add more tools as the workflow grows.
            </p>

            <div className="marketing-fade-up-delay-3 mt-3.5 flex flex-col gap-2 sm:flex-row">
              <Link to="/demos" className="btn marketing-button-motion rounded-xl bg-white px-4 py-2.5 text-sm font-black text-blue-700 hover:bg-blue-50">
                View Demos
                <ArrowRightIcon className="h-4 w-4" />
              </Link>
              <Link to="/products" className="btn marketing-button-motion rounded-xl border border-white/25 bg-white/10 px-4 py-2.5 text-sm font-bold text-white hover:bg-white/15">
                Explore Products
              </Link>
              <a href={BOOK_DEMO_URL} target="_blank" rel="noreferrer" className="btn marketing-button-motion rounded-xl border border-white/25 bg-white/10 px-4 py-2.5 text-sm font-bold text-white hover:bg-white/15">
                Book Demo
              </a>
            </div>

            <div className="mt-4 hidden grid-cols-1 gap-3 sm:grid-cols-3 lg:grid">
              <div className="marketing-fade-up-delay-1 rounded-2xl border border-white/15 bg-white/10 px-4 py-3 backdrop-blur">
                <p className="text-lg font-black text-white">School Connect</p>
                <p className="mt-0.5 text-[11px] uppercase tracking-[0.16em] text-blue-100">POWERING SMART SCHOOLS.</p>
              </div>
              <div className="marketing-fade-up-delay-2 rounded-2xl border border-white/15 bg-white/10 px-4 py-3 backdrop-blur">
                <p className="text-lg font-black text-white">Report Lab</p>
                <p className="mt-0.5 text-[11px] uppercase tracking-[0.16em] text-blue-100">STUDENT REPORTS FASTER.</p>
              </div>
              <div className="marketing-fade-up-delay-3 rounded-2xl border border-white/15 bg-white/10 px-4 py-3 backdrop-blur">
                <p className="text-lg font-black text-white">Smart Pages</p>
                <p className="mt-0.5 text-[11px] uppercase tracking-[0.16em] text-blue-100">HANDWRITTEN DOCS TO READY PDFS.</p>
              </div>
            </div>
          </div>

          <div className="lg:col-span-6">
            <div className="marketing-card-motion marketing-fade-up-delay-2 overflow-hidden rounded-[1.5rem] border border-white/30 bg-white/95 p-2 shadow-xl backdrop-blur">
              <div className="mb-2 px-2 pt-1.5">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-700">Full suite overview</p>
                <p className="mt-1 text-sm leading-6 text-slate-600">A compact preview of the SSAMENJ product family.</p>
              </div>
              <HeroSuiteVisual />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:hidden">
            <div className="marketing-fade-up-delay-1 rounded-2xl border border-white/15 bg-white/10 px-4 py-3 backdrop-blur">
              <p className="text-lg font-black text-white">School Connect</p>
              <p className="mt-0.5 text-[11px] uppercase tracking-[0.16em] text-blue-100">POWERING SMART SCHOOLS.</p>
            </div>
            <div className="marketing-fade-up-delay-2 rounded-2xl border border-white/15 bg-white/10 px-4 py-3 backdrop-blur">
              <p className="text-lg font-black text-white">Report Lab</p>
              <p className="mt-0.5 text-[11px] uppercase tracking-[0.16em] text-blue-100">STUDENT REPORTS FASTER.</p>
            </div>
            <div className="marketing-fade-up-delay-3 rounded-2xl border border-white/15 bg-white/10 px-4 py-3 backdrop-blur">
              <p className="text-lg font-black text-white">Smart Pages</p>
              <p className="mt-0.5 text-[11px] uppercase tracking-[0.16em] text-blue-100">HANDWRITTEN DOCS TO READY PDFS.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-slate-200 bg-white px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-2xl">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-700">Report Lab</p>
            <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-950">A smarter way to prepare school reports.</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Report Lab is built to help schools move from manual marksheets and formatting delays to clean, professional student reports. Upload marks, review results, generate reports, print them, and share parent-ready links from one guided workflow.
            </p>
          </div>

          <div className="mt-4 grid gap-3 lg:grid-cols-3">
              <MarketingFeatureCard step={1} title="Upload marks" body="Bring marks into the system by class, stream, subject, and term." icon={<FileTextIcon className="h-5 w-5" />} tone="blue" />
            <MarketingFeatureCard step={2} title="Generate reports" body="Create professional student reports with grades, remarks, summaries, and school-ready presentation." icon={<PrinterIcon className="h-5 w-5" />} tone="slate" />
            <MarketingFeatureCard step={3} title="Print and share" body="Print, download, or share secure parent links when the school is ready." icon={<LockIcon className="h-5 w-5" />} tone="emerald" />
          </div>
        </div>
      </section>

      <section className="border-b border-slate-200 bg-slate-50 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-12 lg:items-center">
          <div className="lg:col-span-5">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-700">Smart Pages</p>
            <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-950">
              From handwritten school documents to ready-to-print PDFs.
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Upload a handwritten note, scanned letter, form, table, or school document. Smart Pages reads it, cleans it, formats it, and helps you produce a polished PDF you can print or share without typing it all again.
            </p>

            <div className="mt-3.5 flex flex-col gap-3 sm:flex-row">
              <Link to="/demos" className="btn marketing-button-motion rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 px-4 py-3 text-sm font-black text-white shadow-lg shadow-blue-600/20 hover:shadow-xl hover:shadow-blue-600/25">
                Watch Demo
              </Link>
              <Link to="/pricing" className="btn marketing-button-motion rounded-xl border border-blue-200 bg-white px-4 py-3 text-sm font-bold text-blue-700 shadow-sm hover:bg-blue-50">
                See Pricing
              </Link>
            </div>
          </div>

          <div className="lg:col-span-7">
            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
              <div className="marketing-card-motion rounded-[1.5rem] border border-blue-200 bg-white p-3.5 shadow-sm">
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-blue-700">School Connect</p>
                <p className="mt-1.5 text-xs leading-5 text-slate-600">One brand, two core products, and room to grow.</p>
              </div>
              <div className="marketing-card-motion rounded-[1.5rem] border border-slate-200 bg-white p-3.5 shadow-sm">
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Report Lab</p>
                <p className="mt-1.5 text-xs leading-5 text-slate-600">Academic reporting for schools that want faster, cleaner reports.</p>
              </div>
              <div className="marketing-card-motion marketing-soft-float rounded-[1.5rem] border border-emerald-200 bg-emerald-50 p-3.5 shadow-sm">
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-emerald-700">Smart Pages</p>
                <p className="mt-1.5 text-xs leading-5 text-slate-600">Handwritten documents turned into polished PDFs and shareable pages.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-slate-200 bg-white px-4 py-6 sm:px-6 lg:px-8 lg:py-7">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-3 lg:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-700">Built for schools</p>
              <h3 className="mt-2 text-2xl font-black tracking-tight text-slate-950">School Connect grows with your workflow.</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Report Lab, Smart Pages, and future school tools are designed to work together without creating unnecessary complexity.
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-700">Security</p>
              <h3 className="mt-2 text-2xl font-black tracking-tight text-slate-950">Public data stays public, private data stays protected.</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                We use role-aware access and neutral public pages so schools can share only what they intend to share.
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-700">Custom work</p>
              <h3 className="mt-2 text-2xl font-black tracking-tight text-slate-950">Tailored systems when the workflow is specific.</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                If a school or institution needs something custom, we build around the problem instead of forcing a generic setup.
              </p>
            </div>
          </div>
        </div>
      </section>

      <TestimonialsSection className="bg-slate-50 px-4 py-6 sm:px-6 lg:px-8 lg:py-7" compact />

      <section className="border-t border-slate-200 bg-blue-50/40 px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl rounded-[2rem] border border-blue-200 bg-white p-6 shadow-sm sm:p-7">
          <div className="grid gap-6 lg:grid-cols-12 lg:items-center">
            <div className="lg:col-span-8">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-700">Ready to see SSAMENJ in action?</p>
              <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-950">
                Start with a walkthrough, then request the right package for your school.
              </h2>
            </div>
            <div className="flex flex-col gap-3 lg:col-span-4 lg:items-end">
              <Link to="/demos" className="btn marketing-button-motion rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 px-4 py-2.5 text-sm font-black text-white shadow-lg shadow-blue-600/20 hover:shadow-xl hover:shadow-blue-600/25">
                Watch Demo
              </Link>
              <a href="/pricing" className="btn marketing-button-motion rounded-xl border border-blue-200 bg-white px-4 py-2.5 text-sm font-bold text-blue-700 shadow-sm hover:bg-blue-50">
                View Pricing
              </a>
              <a href={BOOK_DEMO_URL} target="_blank" rel="noreferrer" className="btn marketing-button-motion rounded-xl border border-blue-200 bg-white px-4 py-2.5 text-sm font-bold text-blue-700 shadow-sm hover:bg-blue-50">
                Chat on WhatsApp
              </a>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
